import { describe, expect, it, vi } from "vitest";
import { buildServiceAnnouncementEvent } from "../src/announcements/serviceAnnouncementEvent.js";
import { cleanupLegacyServiceTopics } from "../src/push/legacyServiceTopicCleanup.js";

const announcement = {
  id: "notice-1",
  attentionRevision: 2,
  title: "점검 안내",
  summary: "잠시 점검합니다.",
  body: "서비스 점검이 진행됩니다.",
  externalUrl: null,
  appDeepLink: null,
  targetPlatforms: ["android"] as const,
  severity: "maintenance",
  type: "maintenance",
};

describe("service announcement dispatch", () => {
  it("builds an ordinary platform event with target platforms and stable publish dedupe", () => {
    const event = buildServiceAnnouncementEvent(announcement as never, "publish", new Date("2026-08-14T00:00:00Z"));
    expect(event.source).toBe("service_announcement");
    expect(event.type).toBe("service_announcement");
    expect(event.memberId).toBe("stellive-official");
    expect(event.generationId).toBe("official");
    expect(event.dedupeKey).toContain("r2:publish");
    expect(event.rawPayload).toMatchObject({ targetPlatforms: ["android"] });
  });

  it("retries legacy topic cleanup without logging or exposing tokens", async () => {
    const calls: Array<{ token: string; enabled: boolean }> = [];
    const fcmClient = {
      setTopicSubscriptions: vi.fn(async (input: { token: string; topics: readonly string[]; enabled: boolean }) => {
        calls.push({ token: input.token, enabled: input.enabled });
        return calls.length === 1 ? { status: "transient_failure" } : { status: "synced" };
      }),
    };
    const summary = await cleanupLegacyServiceTopics({
      devices: { listPushTargetsPage: vi.fn().mockResolvedValueOnce({ items: [{ deviceId: "d1", platform: "android", pushProvider: "fcm", pushToken: "secret-token", tokenStatus: "active" }], nextCursor: null }) },
      fcmClient,
      maxAttempts: 2,
    });
    expect(summary).toEqual({ scanned: 1, cleaned: 1, failed: 0, retried: 1 });
    expect(calls).toEqual([{ token: "secret-token", enabled: false }, { token: "secret-token", enabled: false }]);
  });
});
