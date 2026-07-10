import { describe, expect, it } from "vitest";
import { calculateRetryDelayMs, NotificationWorker } from "../src/jobs/notificationWorker.js";
import type { ClaimedNotificationJob } from "../src/jobs/notificationJobRepository.js";
import type { PushSendResult } from "../src/push/fcmClient.js";
import type { MinimalPushPayload } from "../src/push/pushPayloadFactory.js";
import type { PushTargetDevice } from "../src/push/pushSender.js";
import type {
  NotificationDeliveryLevel,
  PlatformEvent,
  ResolvedNotificationPreference,
  UserNotificationPreference
} from "../src/types.js";

const now = new Date("2026-06-12T00:00:00.000Z");

function event(overrides: Partial<PlatformEvent> = {}): PlatformEvent {
  return {
    id: overrides.id ?? "event-1",
    source: overrides.source ?? "hub_event",
    type: overrides.type ?? "event_cancelled",
    memberId: overrides.memberId ?? "stellive-official",
    generationId: overrides.generationId ?? "official",
    title: overrides.title ?? "공식 굿즈 취소",
    body: overrides.body ?? "일정이 취소됐습니다.",
    thumbnailUrl: overrides.thumbnailUrl,
    platformUrl: overrides.platformUrl ?? "https://example.com/source",
    appDeepLink: overrides.appDeepLink ?? "stellivehub://hub-events/event-1",
    occurredAt: overrides.occurredAt ?? "2026-06-12T00:00:00.000Z",
    receivedAt: overrides.receivedAt ?? "2026-06-12T00:00:01.000Z",
    dedupeKey: overrides.dedupeKey ?? "hub_event:event-1:event_cancelled:2026-06-12T00:00:00.000Z",
    rawPayload: overrides.rawPayload ?? { hubEventId: "event-1" },
    realtimeEligible: overrides.realtimeEligible ?? false,
    deliveryMode: overrides.deliveryMode ?? "standard"
  };
}

function job(overrides: Partial<ClaimedNotificationJob> = {}): ClaimedNotificationJob {
  return {
    id: overrides.id ?? "job-1",
    eventId: overrides.eventId ?? "event-1",
    priority: overrides.priority ?? 5,
    attempts: overrides.attempts ?? 0,
    runAfter: overrides.runAfter ?? now,
    lockedAt: overrides.lockedAt ?? now,
    lockedBy: overrides.lockedBy ?? "test-worker"
  };
}

function device(overrides: Partial<PushTargetDevice> = {}): PushTargetDevice {
  return {
    deviceId: overrides.deviceId ?? "device-1",
    platform: overrides.platform ?? "android",
    pushProvider: overrides.pushProvider ?? "fcm",
    pushToken: overrides.pushToken ?? "token-redacted",
    tokenStatus: overrides.tokenStatus ?? "active",
    timezone: overrides.timezone ?? "Asia/Seoul",
    locale: overrides.locale ?? "ko-KR",
    appVersion: overrides.appVersion ?? "1.0.0"
  };
}

function resolution(
  overrides: Partial<ResolvedNotificationPreference> = {}
): ResolvedNotificationPreference {
  return {
    eventId: overrides.eventId ?? "event-1",
    deviceId: overrides.deviceId ?? "device-1",
    shouldNotify: overrides.shouldNotify ?? true,
    reason: overrides.reason ?? "allowed",
    matchedRules: overrides.matchedRules ?? ["global:on"],
    tapAction: overrides.tapAction ?? "open_app",
    deliveryMode: overrides.deliveryMode ?? "standard",
    pushPriority: overrides.pushPriority ?? "normal",
    foregroundStreamEligible: overrides.foregroundStreamEligible ?? false
  };
}

function createWorker(options: {
  jobs?: ClaimedNotificationJob[];
  event?: PlatformEvent | undefined;
  devices?: PushTargetDevice[];
  resolve?: (input: { event: PlatformEvent; deviceId: string }) => ResolvedNotificationPreference;
  send?: (input: { device: PushTargetDevice; payload: MinimalPushPayload }) => Promise<PushSendResult>;
  sendBatch?: (input: { devices: PushTargetDevice[]; payload: MinimalPushPayload }) => Promise<PushSendResult[]>;
  useListFallback?: boolean;
  deviceBatchSize?: number;
  preferenceBatchSize?: number;
  deliveryAttemptBatchSize?: number;
  withoutCreateMany?: boolean;
}) {
  const calls = {
    completed: [] as string[],
    failed: [] as unknown[],
    attempts: [] as unknown[],
    sent: [] as Array<{ device: PushTargetDevice; payload: MinimalPushPayload }>,
    batches: [] as Array<{ devices: PushTargetDevice[]; payload: MinimalPushPayload }>,
    invalidated: [] as unknown[],
    preferenceDeviceIds: [] as string[][],
    attemptBatches: [] as unknown[][]
  };
  const pushTargets = options.devices ?? [device()];
  const worker = new NotificationWorker({
    notificationJobs: {
      async claimReady() {
        return options.jobs ?? [job()];
      },
      async complete(jobId: string) {
        calls.completed.push(jobId);
      },
      async fail(input: unknown) {
        calls.failed.push(input);
      }
    },
    platformEvents: {
      async findById() {
        return options.event ?? event();
      }
    },
    devices: {
      ...(!options.useListFallback
        ? {
            async listPushTargetsPage(input: { cursor?: string; limit: number }) {
              const offset = input.cursor ? Number(input.cursor) : 0;
              const items = pushTargets.slice(offset, offset + input.limit);
              const nextOffset = offset + items.length;
              return { items, nextCursor: nextOffset < pushTargets.length ? String(nextOffset) : null };
            }
          }
        : {}),
      async listPushTargets() {
        return pushTargets;
      },
      async markTokenInvalid(deviceId: string, reason: string) {
        calls.invalidated.push({ deviceId, reason });
      }
    },
    preferences: {
      async listForDevices(deviceIds: string[]) {
        calls.preferenceDeviceIds.push(deviceIds);
        return [] as UserNotificationPreference[];
      }
    },
    deliveryAttempts: {
      async create(input: unknown) {
        calls.attempts.push(input);
      },
      ...(!options.withoutCreateMany
        ? {
            async createMany(inputs: unknown[]) {
              calls.attemptBatches.push(inputs);
              calls.attempts.push(...inputs);
            }
          }
        : {})
    },
    preferenceResolution: {
      resolve(eventInput: PlatformEvent, deviceId: string) {
        return options.resolve?.({ event: eventInput, deviceId }) ?? resolution({ deviceId });
      }
    },
    pushSender: {
      async sendToDevice(input: { device: PushTargetDevice; payload: MinimalPushPayload }) {
        calls.sent.push(input);
        return options.send?.(input) ?? { status: "sent", providerMessageId: "message-1" };
      },
      ...(options.sendBatch
        ? {
            async sendToDevices(input: { devices: PushTargetDevice[]; payload: MinimalPushPayload }) {
              calls.batches.push(input);
              return options.sendBatch?.(input) ?? [];
            }
          }
        : {})
    },
    now: () => now,
    deviceBatchSize: options.deviceBatchSize,
    preferenceBatchSize: options.preferenceBatchSize,
    deliveryAttemptBatchSize: options.deliveryAttemptBatchSize
  });
  return { worker, calls };
}

describe("NotificationWorker", () => {
  it("calculates injectable retry jitter deterministically", () => {
    expect(calculateRetryDelayMs(0, undefined, () => 0)).toBe(54_000);
    expect(calculateRetryDelayMs(0, undefined, () => 1)).toBe(66_000);
  });
  it("sends allowed HubEvent pushes and skips blocked devices with delivery attempts", async () => {
    const allowedDevice = device({ deviceId: "allowed-device" });
    const blockedDevice = device({ deviceId: "blocked-device", pushToken: "blocked-token" });
    const { worker, calls } = createWorker({
      devices: [allowedDevice, blockedDevice],
      resolve: ({ deviceId }) =>
        deviceId === "blocked-device"
          ? resolution({ deviceId, shouldNotify: false, reason: "global_off" })
          : resolution({ deviceId })
    });

    const result = await worker.drain({ limit: 5, lockedBy: "test-worker", now });

    expect(result).toMatchObject({
      claimed: 1,
      completed: 1,
      failed: 0,
      sent: 1,
      skipped: 1,
      queued: 0,
      status: "ok"
    });
    expect(calls.sent).toHaveLength(1);
    expect(calls.sent[0].device.deviceId).toBe("allowed-device");
    expect(calls.sent[0].payload.data).toMatchObject({
      eventId: "event-1",
      source: "hub_event",
      eventType: "event_cancelled",
      generationId: "official",
      memberId: "stellive-official",
      tapAction: "open_app",
      appDeepLink: "stellivehub://hub-events/event-1",
      platformUrl: "https://example.com/source"
    });
    expect(calls.attempts).toEqual([
      expect.objectContaining({
        eventId: "event-1",
        deviceId: "allowed-device",
        status: "sent",
        deliveryLevel: "immediate_push",
        providerMessageId: "message-1"
      }),
      expect.objectContaining({
        eventId: "event-1",
        deviceId: "blocked-device",
        status: "skipped",
        reason: "global_off",
        deliveryLevel: "in_app_history_only"
      })
    ]);
    expect(calls.completed).toEqual(["job-1"]);
  });

  it("requeues jobs when a transient provider failure occurs", async () => {
    const { worker, calls } = createWorker({
      send: async () => ({
        status: "transient_failure",
        providerErrorCode: "messaging/server-unavailable",
        reason: "fcm_transient"
      })
    });

    const result = await worker.drain({ limit: 5, lockedBy: "test-worker", now });

    expect(result).toMatchObject({
      claimed: 1,
      completed: 0,
      failed: 0,
      sent: 0,
      skipped: 0,
      queued: 1,
      status: "partial"
    });
    expect(calls.attempts).toEqual([
      expect.objectContaining({
        eventId: "event-1",
        deviceId: "device-1",
        status: "failed",
        reason: "fcm_transient",
        providerErrorCode: "messaging/server-unavailable"
      })
    ]);
    expect(calls.failed).toEqual([
      expect.objectContaining({
        jobId: "job-1",
        attempts: 0,
        reason: "transient_push_failure",
        terminal: false,
        retryAt: new Date("2026-06-12T00:01:00.000Z")
      })
    ]);
  });

  it("prefers provider retryAfterMs over the default retry delay", async () => {
    const { worker, calls } = createWorker({
      send: async () => ({ status: "transient_failure", retryAfterMs: 125_000, reason: "quota_exceeded" })
    });

    await worker.drain({ now });

    expect(calls.failed).toEqual([
      expect.objectContaining({ retryAt: new Date("2026-06-12T00:02:05.000Z"), terminal: false })
    ]);
  });

  it("records multicast partial success and invalid tokens per device while preserving image payloads", async () => {
    const devices = [
      device({ deviceId: "device-1", pushToken: "token-1" }),
      device({ deviceId: "device-2", pushToken: "token-2" }),
      device({ deviceId: "device-3", pushToken: "token-3" })
    ];
    const { worker, calls } = createWorker({
      event: event({ thumbnailUrl: "https://example.com/event.jpg" }),
      devices,
      sendBatch: async ({ devices: batch }) =>
        batch.map((target, index) =>
          index === 0
            ? { status: "sent", providerMessageId: `message-${target.deviceId}` }
            : index === 1
              ? { status: "permanent_token_failure", providerErrorCode: "messaging/invalid-registration-token" }
              : { status: "transient_failure", retryAfterMs: 90_000, reason: "quota_exceeded" }
        )
    });

    const result = await worker.drain({ now });

    expect(calls.batches).toHaveLength(1);
    expect(calls.batches[0].payload.notification.imageUrl).toBe("https://example.com/event.jpg");
    expect(result).toMatchObject({ sent: 1, skipped: 1, queued: 1, status: "partial" });
    expect(calls.invalidated).toEqual([
      { deviceId: "device-2", reason: "messaging/invalid-registration-token" }
    ]);
    expect(calls.failed).toEqual([
      expect.objectContaining({ retryAt: new Date("2026-06-12T00:01:30.000Z") })
    ]);
  });

  it("marks permanent token failures invalid and completes the job", async () => {
    const { worker, calls } = createWorker({
      send: async () => ({
        status: "permanent_token_failure",
        providerErrorCode: "messaging/registration-token-not-registered",
        reason: "invalid_token"
      })
    });

    const result = await worker.drain({ limit: 5, lockedBy: "test-worker", now });

    expect(result).toMatchObject({
      claimed: 1,
      completed: 1,
      sent: 0,
      skipped: 1,
      queued: 0,
      status: "ok"
    });
    expect(calls.invalidated).toEqual([
      {
        deviceId: "device-1",
        reason: "messaging/registration-token-not-registered"
      }
    ]);
    expect(calls.completed).toEqual(["job-1"]);
  });

  it("processes push targets in pages and flushes delivery attempts per page", async () => {
    const devices = Array.from({ length: 1201 }, (_, index) => device({ deviceId: `device-${index}` }));
    const { worker, calls } = createWorker({
      devices,
      sendBatch: async ({ devices: batch }) => batch.map(() => ({ status: "sent" })),
      deviceBatchSize: 500,
      preferenceBatchSize: 500,
      deliveryAttemptBatchSize: 500
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ sent: 1201, completed: 1 });
    expect(calls.preferenceDeviceIds.map((ids) => ids.length)).toEqual([500, 500, 201]);
    expect(calls.batches.map((batch) => batch.devices.length)).toEqual([500, 500, 201]);
    expect(calls.attemptBatches.map((batch) => batch.length)).toEqual([500, 500, 201]);
  });

  it("falls back to listPushTargets when listPushTargetsPage is unavailable", async () => {
    const { worker, calls } = createWorker({ useListFallback: true });

    await worker.drain({ now });

    expect(calls.sent).toHaveLength(1);
  });

  it("falls back to create when createMany is unavailable", async () => {
    const { worker, calls } = createWorker({ withoutCreateMany: true });

    await worker.drain({ now });

    expect(calls.attempts).toHaveLength(1);
    expect(calls.attemptBatches).toHaveLength(0);
  });
});
