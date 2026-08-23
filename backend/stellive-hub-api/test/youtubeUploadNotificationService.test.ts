import { describe, expect, it, vi } from "vitest";
import { YoutubeUploadNotificationService, YoutubeUploadMetadataRetryableError } from "../src/events/youtubeUploadNotificationService.js";
import type { Member, PlatformEvent } from "../src/types.js";
import type { EventPersistenceUnitOfWork, EventPersistenceScope } from "../src/storage/eventPersistenceUnitOfWork.js";

function member(input: Partial<Member>): Member {
  return {
    id: "member",
    koreanName: "멤버",
    englishName: "Member",
    generationId: "gen1",
    generationName: "1기생",
    unitName: "Everys",
    catalogRole: "member",
    activeStatus: "active",
    isPerson: true,
    avatar: { preferredSource: "placeholder", licenseStatus: "unknown" },
    platforms: { youtubeChannelId: "UC_MEMBER", externalUrls: {} },
    ...input,
  };
}

const candidate = {
  videoId: "video-1",
  channelId: "UC_MEMBER",
  title: "새 영상",
  sourceUrl: "https://www.youtube.com/watch?v=video-1",
  publishedAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:01:00.000Z",
};

function persistence(created = true) {
  const createIfNotExists = vi.fn(async (_event: PlatformEvent) => ({ created, eventId: "event-1" }));
  const enqueue = vi.fn(async () => ({ created: true }));
  const scope = {
    platformEvents: { createIfNotExists },
    notificationJobs: { enqueue },
  } as unknown as Pick<EventPersistenceScope, "platformEvents" | "notificationJobs">;
  const unitOfWork: EventPersistenceUnitOfWork = {
    runInTransaction: async (operation) => operation(scope as EventPersistenceScope),
  };
  return { unitOfWork, createIfNotExists, enqueue };
}

function catalog(members: Member[]) {
  return {
    getMembers: () => members,
    isSupportedEventForMember: (_memberId: string, eventType: string) => eventType === "youtube_upload" || eventType === "official_youtube_upload",
  };
}

describe("YoutubeUploadNotificationService", () => {
  it("persists a regular upload and notification job atomically", async () => {
    const persistenceState = persistence();
    const service = new YoutubeUploadNotificationService({
      catalog: catalog([member({})]),
      unitOfWork: persistenceState.unitOfWork,
      now: () => new Date("2026-08-20T00:02:00.000Z"),
    });

    await expect(service.handleYoutubeUpload(candidate)).resolves.toMatchObject({ status: "created", eventType: "youtube_upload" });
    expect(persistenceState.createIfNotExists).toHaveBeenCalledWith(expect.objectContaining({
      type: "youtube_upload",
      dedupeKey: "youtube:youtube_upload:UC_MEMBER:video-1",
      rawPayload: expect.objectContaining({ youtubeVideoId: "video-1", youtubeChannelId: "UC_MEMBER" }),
    }));
    expect(persistenceState.enqueue).toHaveBeenCalledWith({ eventId: "event-1", priority: 1 });
  });

  it("creates official upload notifications only after metadata proves a non-live video", async () => {
    const persistenceState = persistence();
    const fetchVideos = vi.fn(async () => [{ videoId: "video-1", channelId: "UC_OFFICIAL", liveBroadcastContent: "none", tags: [] }]);
    const service = new YoutubeUploadNotificationService({
      catalog: catalog([member({ id: "official", generationId: "official", catalogRole: "official_channel", platforms: { youtubeChannelId: "UC_OFFICIAL", externalUrls: {} }, supportedEventTypes: ["official_youtube_upload"] })]),
      youtube: { fetchVideos },
      unitOfWork: persistenceState.unitOfWork,
    });

    await expect(service.handleYoutubeUpload({ ...candidate, channelId: "UC_OFFICIAL" })).resolves.toMatchObject({ status: "created", eventType: "official_youtube_upload" });
    expect(fetchVideos).toHaveBeenCalledWith(["video-1"]);
    expect(persistenceState.createIfNotExists).toHaveBeenCalledWith(expect.objectContaining({ type: "official_youtube_upload" }));
  });

  it("skips official live videos without writing an event or job", async () => {
    const persistenceState = persistence();
    const service = new YoutubeUploadNotificationService({
      catalog: catalog([member({ id: "official", generationId: "official", catalogRole: "official_channel", platforms: { youtubeChannelId: "UC_OFFICIAL", externalUrls: {} }, supportedEventTypes: ["official_youtube_upload"] })]),
      youtube: { fetchVideos: async () => [{ videoId: "video-1", channelId: "UC_OFFICIAL", liveBroadcastContent: "live", tags: [] }] },
      unitOfWork: persistenceState.unitOfWork,
    });

    await expect(service.handleYoutubeUpload({ ...candidate, channelId: "UC_OFFICIAL" })).resolves.toEqual({ status: "skipped", reason: "official_live" });
    expect(persistenceState.createIfNotExists).not.toHaveBeenCalled();
    expect(persistenceState.enqueue).not.toHaveBeenCalled();
  });

  it("skips completed official broadcasts identified by live metadata", async () => {
    const persistenceState = persistence();
    const service = new YoutubeUploadNotificationService({
      catalog: catalog([member({ id: "official", generationId: "official", catalogRole: "official_channel", platforms: { youtubeChannelId: "UC_OFFICIAL", externalUrls: {} }, supportedEventTypes: ["official_youtube_upload"] })]),
      youtube: { fetchVideos: async () => [{ videoId: "video-1", channelId: "UC_OFFICIAL", liveBroadcastContent: "none", actualEndTime: "2026-08-20T00:05:00.000Z", tags: [] }] },
      unitOfWork: persistenceState.unitOfWork,
    });

    await expect(service.handleYoutubeUpload({ ...candidate, channelId: "UC_OFFICIAL" })).resolves.toEqual({ status: "skipped", reason: "official_live" });
    expect(persistenceState.createIfNotExists).not.toHaveBeenCalled();
    expect(persistenceState.enqueue).not.toHaveBeenCalled();
  });

  it("fails retryably when official metadata is unavailable or mismatched", async () => {
    const persistenceState = persistence();
    const service = new YoutubeUploadNotificationService({
      catalog: catalog([member({ id: "official", generationId: "official", catalogRole: "official_channel", platforms: { youtubeChannelId: "UC_OFFICIAL", externalUrls: {} }, supportedEventTypes: ["official_youtube_upload"] })]),
      youtube: { fetchVideos: async () => [] },
      unitOfWork: persistenceState.unitOfWork,
    });

    await expect(service.handleYoutubeUpload({ ...candidate, channelId: "UC_OFFICIAL" })).rejects.toBeInstanceOf(YoutubeUploadMetadataRetryableError);
    expect(persistenceState.createIfNotExists).not.toHaveBeenCalled();
  });
});
