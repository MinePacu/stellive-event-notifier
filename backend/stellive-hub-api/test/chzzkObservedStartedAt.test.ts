import { describe, expect, it, vi } from "vitest";
import { ChzzkOpenApiAdapter } from "../src/adapters/chzzk/chzzkOpenApiAdapter.js";

describe("ChzzkOpenApiAdapter observed startedAt fallback", () => {
  it("interprets timezone-less CHZZK openDate values as Korea time", async () => {
    const writes: Array<{ startedAt?: Date }> = [];
    const member = {
      id: "sakihane-huya",
      generationId: "gen1",
      catalogRole: "member",
      activeStatus: "active",
      platforms: { chzzkChannelId: "chzzk-channel-id" }
    };
    const adapter = new ChzzkOpenApiAdapter({
      catalog: {
        getMembers: () => [member],
        isSupportedEventForMember: () => true
      },
      apiClient: {
        getLiveStatus: vi.fn(async () => ({
          channelId: "chzzk-channel-id",
          isLive: true,
          title: "Live with local openDate",
          openDate: "2026-06-15 16:59:46",
          viewerCount: 2648,
          platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
          sourceVerificationState: "verified"
        }))
      },
      liveStatusRepository: {
        getByMemberId: vi.fn(async () => null),
        upsertLiveStatus: vi.fn(async (input) => {
          writes.push(input);
          return input;
        })
      },
      ingestEvent: vi.fn(),
      clock: () => new Date("2026-06-15T11:00:00.000Z")
    } as any);

    await adapter.pollLiveStatuses();

    expect(writes).toHaveLength(1);
    expect(writes[0].startedAt?.toISOString()).toBe("2026-06-15T07:59:46.000Z");
  });

  it("writes an observed startedAt when the live API omits provider start time", async () => {
    const now = new Date("2026-06-15T11:00:00.000Z");
    const writes: Array<{ startedAt?: Date; lastTransitionAt?: Date }> = [];
    const member = {
      id: "sakihane-huya",
      generationId: "gen1",
      catalogRole: "member",
      activeStatus: "active",
      platforms: { chzzkChannelId: "chzzk-channel-id" }
    };
    const adapter = new ChzzkOpenApiAdapter({
      catalog: {
        getMembers: () => [member],
        isSupportedEventForMember: () => true
      },
      apiClient: {
        getLiveStatus: vi.fn(async () => ({
          channelId: "chzzk-channel-id",
          isLive: true,
          title: "Live without openDate",
          viewerCount: 2648,
          platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
          sourceVerificationState: "verified"
        }))
      },
      liveStatusRepository: {
        getByMemberId: vi.fn(async () => null),
        upsertLiveStatus: vi.fn(async (input) => {
          writes.push(input);
          return input;
        })
      },
      ingestEvent: vi.fn(),
      clock: () => now
    } as any);

    await adapter.pollLiveStatuses();

    expect(writes).toHaveLength(1);
    expect(writes[0].startedAt?.toISOString()).toBe("2026-06-15T11:00:00.000Z");
    expect(writes[0].lastTransitionAt).toBeUndefined();
  });

  it("preserves a previous observed startedAt while the live remains online", async () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const previousStartedAt = new Date("2026-06-15T11:00:00.000Z");
    const writes: Array<{ startedAt?: Date; lastTransitionAt?: Date }> = [];
    const member = {
      id: "sakihane-huya",
      generationId: "gen1",
      catalogRole: "member",
      activeStatus: "active",
      platforms: { chzzkChannelId: "chzzk-channel-id" }
    };
    const adapter = new ChzzkOpenApiAdapter({
      catalog: {
        getMembers: () => [member],
        isSupportedEventForMember: () => true
      },
      apiClient: {
        getLiveStatus: vi.fn(async () => ({
          channelId: "chzzk-channel-id",
          isLive: true,
          title: "Still live without openDate",
          viewerCount: 3012,
          platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
          sourceVerificationState: "verified"
        }))
      },
      liveStatusRepository: {
        getByMemberId: vi.fn(async () => ({
          isLive: true,
          startedAt: previousStartedAt,
          lastTransitionAt: previousStartedAt
        })),
        upsertLiveStatus: vi.fn(async (input) => {
          writes.push(input);
          return input;
        })
      },
      ingestEvent: vi.fn(),
      clock: () => now
    } as any);

    await adapter.pollLiveStatuses();

    expect(writes).toHaveLength(1);
    expect(writes[0].startedAt?.toISOString()).toBe("2026-06-15T11:00:00.000Z");
    expect(writes[0].lastTransitionAt?.toISOString()).toBe("2026-06-15T11:00:00.000Z");
  });
});
