import { describe, expect, it, vi } from "vitest";
import { ChzzkOpenApiAdapter } from "../src/adapters/chzzk/chzzkOpenApiAdapter.js";
import type { ChzzkNormalizedLiveStatus } from "../src/adapters/chzzk/chzzkApiClient.js";
import type { Member, PlatformEvent } from "../src/types.js";

const liveMember = member("ayatsuno-yuni", "member", "active", "chzzk-channel-id");
const noChannelMember = member("akane-lize", "member", "active");
const formerMember = member("former-member", "member", "former", "former-channel-id");
const officialMember = member("stellive-official", "official_channel", "active", "official-channel-id");

describe("ChzzkOpenApiAdapter", () => {
  it("polls only MVP-allowed catalog entries with CHZZK channel IDs and skips former members", async () => {
    const apiClient = { getLiveStatus: vi.fn().mockResolvedValue(liveStatus({ isLive: false })) };
    const adapter = createAdapter({
      members: [liveMember, noChannelMember, formerMember, officialMember],
      apiClient
    });

    const result = await adapter.pollLiveStatuses();

    expect(apiClient.getLiveStatus).toHaveBeenCalledTimes(1);
    expect(apiClient.getLiveStatus).toHaveBeenCalledWith("chzzk-channel-id");
    expect(result).toMatchObject({ checked: 1, skipped: 3 });
  });

  it("upserts live status with startedAt from official openDate", async () => {
    const writes: unknown[] = [];
    const adapter = createAdapter({
      previous: { isLive: false },
      writes,
      statuses: [liveStatus({ isLive: true, openDate: "2026-06-11T03:00:00.000Z" })]
    });

    await adapter.pollLiveStatuses();

    expect(writes[0]).toMatchObject({
      memberId: "ayatsuno-yuni",
      generationId: "gen1",
      isLive: true,
      startedAt: new Date("2026-06-11T03:00:00.000Z"),
      sourceVerificationState: "verified"
    });
  });

  it("creates started and ended events for live transitions without duplicates", async () => {
    const startedEvents: PlatformEvent[] = [];
    const startedAdapter = createAdapter({
      previous: { isLive: false },
      events: startedEvents,
      statuses: [liveStatus({ isLive: true, openDate: "2026-06-11T03:00:00.000Z" })]
    });

    await expect(startedAdapter.pollLiveStatuses()).resolves.toMatchObject({ eventsCreated: 1 });
    expect(startedEvents[0]).toMatchObject({
      type: "chzzk_live_started",
      dedupeKey: "chzzk:chzzk_live_started:chzzk-channel-id:2026-06-11T03:00:00.000Z"
    });

    const repeatedEvents: PlatformEvent[] = [];
    const repeatedAdapter = createAdapter({
      previous: { isLive: true },
      events: repeatedEvents,
      statuses: [liveStatus({ isLive: true, openDate: "2026-06-11T03:00:00.000Z" })]
    });

    await expect(repeatedAdapter.pollLiveStatuses()).resolves.toMatchObject({ eventsCreated: 0 });
    expect(repeatedEvents).toHaveLength(0);

    const endedEvents: PlatformEvent[] = [];
    const endedAdapter = createAdapter({
      previous: { isLive: true },
      events: endedEvents,
      statuses: [liveStatus({ isLive: false })]
    });

    await expect(endedAdapter.pollLiveStatuses()).resolves.toMatchObject({ eventsCreated: 1 });
    expect(endedEvents[0].type).toBe("chzzk_live_ended");
  });

  it("never emits chzzk_chat", async () => {
    const events: PlatformEvent[] = [];
    const adapter = createAdapter({
      previous: { isLive: false },
      events,
      statuses: [liveStatus({ isLive: true })]
    });

    await adapter.pollLiveStatuses();

    expect(events.map((event) => event.type)).not.toContain("chzzk_chat");
  });
});

function createAdapter(options: {
  members?: Member[];
  previous?: { isLive: boolean };
  events?: PlatformEvent[];
  writes?: unknown[];
  statuses?: ChzzkNormalizedLiveStatus[];
  apiClient?: { getLiveStatus: ReturnType<typeof vi.fn> };
}) {
  const statuses = options.statuses ?? [liveStatus({ isLive: false })];
  const events = options.events ?? [];
  const writes = options.writes ?? [];

  return new ChzzkOpenApiAdapter({
    catalog: {
      getMembers: () => options.members ?? [liveMember],
      isSupportedEventForMember: (_memberId, eventType) => eventType !== "chzzk_chat"
    },
    apiClient: options.apiClient ?? {
      getLiveStatus: vi.fn(async () => statuses.shift() ?? liveStatus({ isLive: false }))
    },
    liveStatusRepository: {
      getByMemberId: vi.fn(async () => previousRecord(options.previous?.isLive)),
      upsertLiveStatus: vi.fn(async (input) => {
        writes.push(input);
        return input as never;
      })
    },
    ingestEvent: vi.fn(async (event) => {
      events.push(event);
    }),
    clock: () => new Date("2026-06-11T03:05:00.000Z")
  });
}

function liveStatus(overrides: Partial<ChzzkNormalizedLiveStatus>): ChzzkNormalizedLiveStatus {
  return {
    channelId: "chzzk-channel-id",
    isLive: false,
    platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
    sourceVerificationState: "verified",
    ...overrides
  };
}

function previousRecord(isLive: boolean | undefined) {
  if (isLive === undefined) return null;
  return {
    memberId: "ayatsuno-yuni",
    generationId: "gen1",
    isLive,
    title: null,
    viewerCount: null,
    startedAt: null,
    platformUrl: null,
    lastCheckedAt: new Date("2026-06-11T03:00:00.000Z"),
    sourceVerificationState: "verified",
    lastTransitionAt: null
  };
}

function member(id: string, catalogRole: Member["catalogRole"], activeStatus: string, chzzkChannelId?: string): Member {
  return {
    id,
    koreanName: id,
    englishName: id,
    generationId: "gen1",
    generationName: "1기생",
    unitName: "1기생",
    catalogRole,
    activeStatus: activeStatus as Member["activeStatus"],
    roleLabel: "member",
    isPerson: true,
    avatar: { preferredSource: "placeholder", licenseStatus: "unknown" },
    platforms: { chzzkChannelId, externalUrls: {} },
    supportedEventTypes: ["chzzk_live_started", "chzzk_live_ended"]
  };
}
