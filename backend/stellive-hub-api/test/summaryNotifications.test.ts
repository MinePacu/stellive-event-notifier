import { describe, expect, it, vi } from "vitest";
import { SummaryNotificationRepository } from "../src/jobs/summaryNotificationRepository.js";
import { SummaryNotificationWorker } from "../src/jobs/summaryNotificationWorker.js";
import { backfillRecentSkippedSummaries } from "../src/jobs/summaryNotificationBackfill.js";
import { summaryTopicKey, summaryWindow } from "../src/notification/summaryNotificationPolicy.js";
import { buildSummaryPushPayload, SUMMARY_DATA_BUDGET_BYTES } from "../src/push/pushPayloadFactory.js";
import type { PlatformEvent, ResolvedNotificationPreference } from "../src/types.js";

const now = new Date("2026-08-09T01:19:59.999Z");

function event(overrides: Partial<PlatformEvent> = {}): PlatformEvent {
  return {
    id: overrides.id ?? "event-1",
    source: overrides.source ?? "hub_event",
    type: overrides.type ?? "event_updated",
    memberId: overrides.memberId ?? "stellive-official",
    generationId: overrides.generationId ?? "official",
    title: overrides.title ?? "첫 번째 소식",
    body: overrides.body ?? "기존 본문",
    platformUrl: overrides.platformUrl ?? "https://example.com/event-1",
    appDeepLink: overrides.appDeepLink ?? "stellivehub://hub-events/event-1",
    occurredAt: overrides.occurredAt ?? "2026-08-09T00:00:00.000Z",
    receivedAt: overrides.receivedAt ?? "2026-08-09T00:00:01.000Z",
    dedupeKey: overrides.dedupeKey ?? "summary-event-1",
    rawPayload: overrides.rawPayload ?? {},
    realtimeEligible: overrides.realtimeEligible ?? false,
    deliveryMode: overrides.deliveryMode ?? "standard"
  };
}

function resolution(): ResolvedNotificationPreference {
  return {
    eventId: "event-1",
    deviceId: "device-1",
    shouldNotify: true,
    reason: "allowed",
    matchedRules: ["global:on"],
    tapAction: "open_app",
    deliveryMode: "standard",
    pushPriority: "normal",
    foregroundStreamEligible: false
  };
}

describe("summary notification policy and payload", () => {
  it("uses worker decision time and floors exact UTC ten-minute windows", () => {
    expect(summaryWindow(now)).toEqual({
      windowStart: new Date("2026-08-09T01:10:00.000Z"),
      deliverAfter: new Date("2026-08-09T01:20:00.000Z")
    });
    expect(summaryWindow(new Date("2026-08-09T01:20:00.000Z"))).toEqual({
      windowStart: new Date("2026-08-09T01:20:00.000Z"),
      deliverAfter: new Date("2026-08-09T01:30:00.000Z")
    });
  });

  it("builds stable topic keys for hub, official, and member sources", () => {
    expect(summaryTopicKey(event())).toBe("hub_event");
    expect(summaryTopicKey(event({ source: "youtube", type: "official_youtube_upload" }))).toBe("official:youtube");
    expect(summaryTopicKey(event({ source: "youtube", type: "youtube_upload", memberId: "member-a", generationId: "gen3" })))
      .toBe("member:member-a:youtube");
  });

  it("uses the latest two titles plus a remainder and stays within the data budget", () => {
    const events = Array.from({ length: 12 }, (_, index) => event({
      id: `event-${index}`,
      title: `제목 ${index} ${"가".repeat(500)}`,
      receivedAt: `2026-08-09T00:${String(index).padStart(2, "0")}:00.000Z`
    }));
    const payload = buildSummaryPushPayload({ bucketId: "bucket-1", topicKey: "hub_event", events, resolution: resolution() });

    expect(payload.notification.title).toBe("굿즈/행사 업데이트 12건");
    expect(payload.notification.body).toContain("제목 11");
    expect(payload.notification.body).toContain("제목 10");
    expect(payload.notification.body).toContain("외 10건");
    expect(payload.data.summaryGroupId).toBe("hub_event");
    expect(payload.data.supersedesEventIds?.split(",").length).toBeLessThanOrEqual(10);
    expect(Buffer.byteLength(JSON.stringify(payload.data), "utf8")).toBeLessThanOrEqual(SUMMARY_DATA_BUDGET_BYTES);
    expect(payload.android.priority).toBe("normal");
    expect(payload.notification.imageUrl).toBeUndefined();
  });

  it("preserves the normal title and body for one item", () => {
    const payload = buildSummaryPushPayload({ bucketId: "bucket-1", topicKey: "hub_event", events: [event()], resolution: resolution() });
    expect(payload.notification).toEqual({ title: "굿즈/행사 일정이 변경됐어요", body: "첫 번째 소식" });
  });
});

describe("SummaryNotificationRepository", () => {
  it("atomically upserts the decision-time bucket and enqueues one item", async () => {
    const upsert = vi.fn(async () => ({ id: "bucket-1" }));
    const create = vi.fn(async () => ({ id: "item-1" }));
    const prisma: any = {
      notificationSummaryBucket: { upsert },
      notificationSummaryItem: { create },
      async $transaction(operation: (tx: unknown) => Promise<unknown>) { return operation(this); }
    };
    const repository = new SummaryNotificationRepository(prisma);

    await expect(repository.enqueue({ event: event({ receivedAt: "2020-01-01T00:00:00.000Z" }), deviceId: "device-1", evaluatedAt: now }))
      .resolves.toEqual({ bucketId: "bucket-1", topicKey: "hub_event", created: true });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { deviceId_topicKey_windowStart: { deviceId: "device-1", topicKey: "hub_event", windowStart: new Date("2026-08-09T01:10:00.000Z") } },
      create: expect.objectContaining({ deliverAfter: new Date("2026-08-09T01:20:00.000Z") })
    }));
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventId: "event-1", reason: "summary_queued" }) });
  });

  it("reclaims stale locks and records item reasons on terminal failure", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const itemUpdateMany = vi.fn(async () => ({ count: 1 }));
    const bucketUpdate = vi.fn(async () => ({}));
    const prisma: any = {
      notificationSummaryBucket: {
        findMany: async () => [{ id: "bucket-1", deviceId: "device-1", topicKey: "hub_event", windowStart: now, deliverAfter: now, status: "locked", attempts: 4, lockedAt: new Date(now.getTime() - 600_000), lockedBy: "dead", items: [] }],
        updateMany,
        update: bucketUpdate
      },
      notificationSummaryItem: { updateMany: itemUpdateMany },
      async $transaction(operation: (tx: unknown) => Promise<unknown>) { return operation(this); }
    };
    const repository = new SummaryNotificationRepository(prisma);
    const claimed = await repository.claimReady({ now, lockedBy: "worker-2", staleLockMs: 300_000 });
    await repository.fail({ bucketId: "bucket-1", reason: "fcm_transient", terminal: true });

    expect(claimed).toHaveLength(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "locked", lockedAt: now, lockedBy: "worker-2" } }));
    expect(itemUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "failed", reason: "fcm_transient" }
    }));
    expect(bucketUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed", attempts: { increment: 1 } }) }));
  });
});

describe("summary notification backfill", () => {
  it("only counts newly created items from the explicit recent-ten-minute candidate scan", async () => {
    const attemptedAt = new Date(now.getTime() - 60_000);
    const enqueue = vi.fn()
      .mockResolvedValueOnce({ bucketId: "bucket-1", topicKey: "hub_event", created: true })
      .mockResolvedValueOnce({ bucketId: "bucket-1", topicKey: "hub_event", created: false });
    const listRecentSkippedSummaryCandidates = vi.fn(async () => [
      { eventId: "event-1", deviceId: "device-1", attemptedAt },
      { eventId: "event-2", deviceId: "device-1", attemptedAt },
      { eventId: "missing", deviceId: "device-2", attemptedAt }
    ]);

    const result = await backfillRecentSkippedSummaries({
      deliveryAttempts: { listRecentSkippedSummaryCandidates },
      platformEvents: { findById: async (eventId) => eventId === "missing" ? undefined : event({ id: eventId }) },
      summaries: { enqueue }
    }, { now, limit: 50 });

    expect(listRecentSkippedSummaryCandidates).toHaveBeenCalledWith({
      since: new Date(now.getTime() - 10 * 60_000),
      until: now,
      limit: 50
    });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ deviceId: "device-1", evaluatedAt: attemptedAt }));
    expect(result).toEqual({ candidates: 3, enqueued: 1, missingEvents: 1 });
  });
});

describe("SummaryNotificationWorker", () => {
  function setup(sendResult: any, checkpoint = false) {
    const complete = vi.fn(async () => undefined);
    const skip = vi.fn(async () => undefined);
    const fail = vi.fn(async () => undefined);
    const sendToDevice = vi.fn(async () => sendResult);
    const create = vi.fn(async () => undefined);
    const markTokenInvalid = vi.fn(async () => undefined);
    const worker = new SummaryNotificationWorker({
      summaries: {
        claimReady: async () => [{ id: "bucket-1", deviceId: "device-1", topicKey: "hub_event", windowStart: now, deliverAfter: now, attempts: 0, lockedAt: now, lockedBy: "worker", items: [{ id: "item-1", bucketId: "bucket-1", deviceId: "device-1", eventId: "event-1", status: "queued", reason: "summary_queued", createdAt: now }] }],
        complete,
        skip,
        fail
      },
      platformEvents: { findById: async () => event() },
      devices: {
        findPushTarget: async () => ({ deviceId: "device-1", platform: "android", pushProvider: "fcm", pushToken: "redacted", tokenStatus: "active", timezone: "Asia/Seoul" }),
        markTokenInvalid
      },
      preferences: { listForDevice: async () => [] },
      deliveryAttempts: {
        create,
        countSentByDeviceInWindow: async () => new Map(),
        listSentDeviceIds: async () => new Set(checkpoint ? ["device-1"] : [])
      },
      preferenceResolution: { resolve: () => resolution() },
      pushSender: { sendToDevice },
      random: () => 0.5
    });
    return { worker, complete, skip, fail, sendToDevice, create, markTokenInvalid };
  }

  it("writes one synthetic sent checkpoint before completing the bucket", async () => {
    const test = setup({ status: "sent", providerMessageId: "provider-1" });
    await expect(test.worker.drain({ now })).resolves.toMatchObject({ claimed: 1, completed: 1, sent: 1 });
    expect(test.create).toHaveBeenCalledTimes(1);
    expect(test.create).toHaveBeenCalledWith(expect.objectContaining({ eventId: "summary:bucket-1", status: "sent" }));
    expect(test.complete).toHaveBeenCalledTimes(1);
  });

  it("uses an existing synthetic checkpoint without sending again", async () => {
    const test = setup({ status: "sent" }, true);
    await expect(test.worker.drain({ now })).resolves.toMatchObject({ completed: 1, sent: 0 });
    expect(test.sendToDevice).not.toHaveBeenCalled();
    expect(test.create).not.toHaveBeenCalled();
    expect(test.complete).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures and invalidates permanent tokens", async () => {
    const retry = setup({ status: "transient_failure", reason: "fcm_transient", retryAfterMs: 30_000 });
    await expect(retry.worker.drain({ now })).resolves.toMatchObject({ queued: 1, status: "partial" });
    expect(retry.fail).toHaveBeenCalledWith(expect.objectContaining({ terminal: false, retryAt: new Date(now.getTime() + 30_000) }));

    const permanent = setup({ status: "permanent_token_failure", reason: "registration-token-not-registered" });
    await expect(permanent.worker.drain({ now })).resolves.toMatchObject({ skipped: 1, completed: 1 });
    expect(permanent.markTokenInvalid).toHaveBeenCalledWith("device-1", "registration-token-not-registered");
    expect(permanent.skip).toHaveBeenCalledWith("bucket-1", "registration-token-not-registered", now);
  });
});
