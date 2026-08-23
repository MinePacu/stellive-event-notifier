import { describe, expect, it } from "vitest";
import {
  calculateRetryDelayMs,
  NotificationWorker,
  type ServiceAnnouncementDispatchCompletion,
} from "../src/jobs/notificationWorker.js";
import type { ClaimedNotificationJob } from "../src/jobs/notificationJobRepository.js";
import { PreferenceResolutionService } from "../src/preferences/preferenceResolution.js";
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

function serviceAnnouncementEvent(rawPayload: unknown): PlatformEvent {
  return event({
    id: "service-announcement-event-1",
    source: "service_announcement",
    type: "service_announcement",
    title: "서비스 공지",
    body: "서비스 공지 본문입니다.",
    appDeepLink: "stellivehub://announcements/notice-1",
    rawPayload,
  });
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
  preferences?: UserNotificationPreference[];
  resolve?: (input: {
    event: PlatformEvent;
    deviceId: string;
    preferences: UserNotificationPreference[];
    evaluatedAt: Date;
    recentNotificationsInLastMinute: number;
  }) => ResolvedNotificationPreference;
  send?: (input: { device: PushTargetDevice; payload: MinimalPushPayload }) => Promise<PushSendResult>;
  sendBatch?: (input: { devices: PushTargetDevice[]; payload: MinimalPushPayload }) => Promise<PushSendResult[]>;
  completeServiceAnnouncementDispatch?: (input: ServiceAnnouncementDispatchCompletion) => Promise<void>;
  useListFallback?: boolean;
  deviceBatchSize?: number;
  preferenceBatchSize?: number;
  deliveryAttemptBatchSize?: number;
  withoutCreateMany?: boolean;
  scheduleCurrent?: boolean;
  previousAttempts?: Array<{ deviceId: string; status: "queued" | "sent" | "failed" | "skipped" }>;
  recentSentCounts?: Record<string, number>;
  enqueueSummary?: (input: { event: PlatformEvent; deviceId: string; evaluatedAt: Date }) => Promise<{
    bucketId: string;
    topicKey: string;
    created: boolean;
  }>;
  clock?: () => Date;
  renewLock?: (input: { jobId: string; lockedBy: string; now: Date }) => Promise<boolean>;
  complete?: (input: { jobId: string; lockedBy: string }) => Promise<boolean>;
  fail?: (input: {
    jobId: string;
    lockedBy: string;
    attempts: number;
    reason: string;
    retryAt?: Date;
    terminal: boolean;
  }) => Promise<boolean>;
  listCurrentPushTokenOwnerIds?: (
    targets: Array<{ deviceId: string; pushToken: string }>
  ) => Promise<Set<string>>;
}) {
  const calls = {
    claims: [] as Array<{ limit: number; lockedBy: string; now: Date; staleLockMs?: number }>,
    renewals: [] as Array<{ jobId: string; lockedBy: string; now: Date }>,
    completed: [] as string[],
    failed: [] as unknown[],
    attempts: [] as unknown[],
    sent: [] as Array<{ device: PushTargetDevice; payload: MinimalPushPayload }>,
    batches: [] as Array<{ devices: PushTargetDevice[]; payload: MinimalPushPayload }>,
    invalidated: [] as unknown[],
    preferenceDeviceIds: [] as string[][],
    attemptBatches: [] as unknown[][],
    sentLookups: [] as Array<{ eventId: string; deviceIds: string[] }>,
    ownershipLookups: [] as Array<Array<{ deviceId: string; pushToken: string }>>,
    recentSentLookups: [] as Array<{ deviceIds: string[]; since: Date; until: Date }>,
    summaries: [] as Array<{ event: PlatformEvent; deviceId: string; evaluatedAt: Date }>,
    resolveContexts: [] as Array<{ deviceId: string; evaluatedAt: Date; recentNotificationsInLastMinute: number }>,
    announcementDispatches: [] as ServiceAnnouncementDispatchCompletion[],
  };
  const pushTargets = options.devices ?? [device()];
  const preferences = options.preferences ?? [];
  const sentDeviceIds = new Set(
    options.previousAttempts?.filter((attempt) => attempt.status === "sent").map((attempt) => attempt.deviceId) ?? []
  );
  const persistSentAttempt = (input: unknown) => {
    if (
      typeof input === "object" &&
      input !== null &&
      "status" in input &&
      input.status === "sent" &&
      "deviceId" in input &&
      typeof input.deviceId === "string"
    ) {
      sentDeviceIds.add(input.deviceId);
    }
  };
  const worker = new NotificationWorker({
    notificationJobs: {
      async claimReady(input) {
        calls.claims.push(input);
        return options.jobs ?? [job()];
      },
      async renewLock(input) {
        calls.renewals.push(input);
        return options.renewLock?.(input) ?? true;
      },
      async complete(input) {
        const completed = await (options.complete?.(input) ?? Promise.resolve(true));
        if (completed) calls.completed.push(input.jobId);
        return completed;
      },
      async fail(input: unknown) {
        calls.failed.push(input);
        return options.fail?.(input as never) ?? true;
      }
    },
    platformEvents: {
      async findById() {
        return options.event ?? event();
      }
    },
    hubEventSchedules: {
      async isScheduleNotificationCurrent() {
        return options.scheduleCurrent ?? true;
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
      async listCurrentPushTokenOwnerIds(targets: Array<{ deviceId: string; pushToken: string }>) {
        calls.ownershipLookups.push(targets);
        return options.listCurrentPushTokenOwnerIds?.(targets) ?? new Set(targets.map((target) => target.deviceId));
      },
      async markTokenInvalid(input: { deviceId: string; expectedToken: string; reason: string }) {
        calls.invalidated.push(input);
        return true;
      }
    },
    preferences: {
      async listForDevices(deviceIds: string[]) {
        calls.preferenceDeviceIds.push(deviceIds);
        return preferences;
      }
    },
    deliveryAttempts: {
      async create(input: unknown) {
        calls.attempts.push(input);
        persistSentAttempt(input);
      },
      async listSentDeviceIds(input: { eventId: string; deviceIds: string[] }) {
        calls.sentLookups.push(input);
        return new Set(input.deviceIds.filter((deviceId) => sentDeviceIds.has(deviceId)));
      },
      async countSentByDeviceInWindow(input: { deviceIds: string[]; since: Date; until: Date }) {
        calls.recentSentLookups.push(input);
        return new Map(
          input.deviceIds.flatMap((deviceId) =>
            options.recentSentCounts?.[deviceId] !== undefined ? [[deviceId, options.recentSentCounts[deviceId] as number]] : []
          )
        );
      },
      ...(!options.withoutCreateMany
        ? {
            async createMany(inputs: unknown[]) {
              calls.attemptBatches.push(inputs);
              calls.attempts.push(...inputs);
              inputs.forEach(persistSentAttempt);
            }
          }
        : {})
    },
    summaryNotifications: {
      async enqueue(input) {
        calls.summaries.push(input);
        return options.enqueueSummary?.(input) ?? { bucketId: "summary-bucket-1", topicKey: "hub_event", created: true };
      }
    },
    ...(options.completeServiceAnnouncementDispatch
      ? {
          serviceAnnouncements: {
            async completeDispatchByEventId(input: ServiceAnnouncementDispatchCompletion) {
              calls.announcementDispatches.push(input);
              await options.completeServiceAnnouncementDispatch?.(input);
            }
          }
        }
      : {}),
    preferenceResolution: {
      resolve(
        eventInput: PlatformEvent,
        deviceId: string,
        preferenceRules: UserNotificationPreference[],
        context: { evaluatedAt: Date; recentNotificationsInLastMinute?: number }
      ) {
        const recentNotificationsInLastMinute = context.recentNotificationsInLastMinute ?? 0;
        calls.resolveContexts.push({ deviceId, evaluatedAt: context.evaluatedAt, recentNotificationsInLastMinute });
        return (
          options.resolve?.({
            event: eventInput,
            deviceId,
            preferences: preferenceRules,
            evaluatedAt: context.evaluatedAt,
            recentNotificationsInLastMinute
          }) ?? resolution({ deviceId })
        );
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
    now: options.clock ?? (() => now),
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

  it("captures a fresh evaluation time immediately before each recipient when drain time is not fixed", async () => {
    let tick = 0;
    const { worker, calls } = createWorker({
      devices: [device({ deviceId: "device-1" }), device({ deviceId: "device-2", pushToken: "token-2" })],
      clock: () => new Date(Date.UTC(2026, 5, 12, 0, 0, tick++))
    });

    await worker.drain();

    expect(calls.resolveContexts).toHaveLength(2);
    expect(calls.resolveContexts.map(({ deviceId }) => deviceId)).toEqual(["device-1", "device-2"]);
    expect(calls.resolveContexts[0].recentNotificationsInLastMinute).toBe(0);
    expect(calls.resolveContexts[1].recentNotificationsInLastMinute).toBe(0);
    expect(calls.resolveContexts[1].evaluatedAt.getTime()).toBeGreaterThan(calls.resolveContexts[0].evaluatedAt.getTime());
  });

  it("completes stale rescheduled or cancelled schedule jobs without sending", async () => {
    const { worker, calls } = createWorker({ scheduleCurrent: false });

    const result = await worker.drain({ limit: 5, lockedBy: "test-worker", now });

    expect(result).toMatchObject({ claimed: 1, completed: 1, skipped: 1, sent: 0, failed: 0 });
    expect(calls.completed).toEqual(["job-1"]);
    expect(calls.sent).toEqual([]);
    expect(calls.attempts).toEqual([]);
  });

  it("claims jobs with the configured stale lock window and explicit owner", async () => {
    const { worker, calls } = createWorker({});

    await worker.drain({ limit: 5, lockedBy: "test-worker", now });

    expect(calls.claims).toEqual([
      {
        limit: 5,
        lockedBy: "test-worker",
        now,
        staleLockMs: 300_000
      }
    ]);
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

  it("enforces service announcement platform and version targets before preference resolution", async () => {
    const { worker, calls } = createWorker({
      event: serviceAnnouncementEvent({
        targetPlatforms: ["ios"],
        minimumAppVersion: "2.0.0",
        maximumAppVersion: "3.0.0",
        targetingPolicyVersion: 1,
      }),
      devices: [
        device({ deviceId: "android-device", appVersion: "2.5.0" }),
        device({ deviceId: "ios-old-device", platform: "ios", appVersion: "1.9.9", pushProvider: "apns_via_fcm", pushToken: "ios-old-token" }),
      ],
      completeServiceAnnouncementDispatch: async () => {},
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 1, sent: 0, skipped: 2, queued: 0, failed: 0 });
    expect(calls.sent).toEqual([]);
    expect(calls.preferenceDeviceIds).toEqual([]);
    expect(calls.resolveContexts).toEqual([]);
    expect(calls.attempts).toEqual([
      expect.objectContaining({
        eventId: "service-announcement-event-1",
        deviceId: "android-device",
        status: "skipped",
        reason: "service_announcement_platform_mismatch",
      }),
      expect.objectContaining({
        eventId: "service-announcement-event-1",
        deviceId: "ios-old-device",
        status: "skipped",
        reason: "service_announcement_version_below_minimum",
      }),
    ]);
    expect(calls.announcementDispatches).toEqual([
      expect.objectContaining({ eventId: "service-announcement-event-1", status: "skipped", completedAt: now }),
    ]);
  });

  it("sends a service announcement to a device inside the inclusive target range", async () => {
    const { worker, calls } = createWorker({
      event: serviceAnnouncementEvent({
        targetPlatforms: ["android"],
        minimumAppVersion: "2.0.0",
        maximumAppVersion: "3.0.0",
        targetingPolicyVersion: 1,
      }),
      devices: [device({ appVersion: "2.0.0" })],
      completeServiceAnnouncementDispatch: async () => {},
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 1, sent: 1, skipped: 0, queued: 0, failed: 0 });
    expect(calls.sent).toHaveLength(1);
    expect(calls.sent[0]?.device.deviceId).toBe("device-1");
    expect(calls.attempts).toEqual([
      expect.objectContaining({
        eventId: "service-announcement-event-1",
        deviceId: "device-1",
        status: "sent",
        deliveryLevel: "immediate_push",
      }),
    ]);
    expect(calls.announcementDispatches).toEqual([
      expect.objectContaining({ eventId: "service-announcement-event-1", status: "sent", completedAt: now, pushSentAt: now }),
    ]);
  });

  it("fails closed for service announcements without targeting metadata", async () => {
    const { worker, calls } = createWorker({
      event: serviceAnnouncementEvent({}),
      completeServiceAnnouncementDispatch: async () => {},
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 1, sent: 0, skipped: 1, queued: 0, failed: 0 });
    expect(calls.sent).toEqual([]);
    expect(calls.preferenceDeviceIds).toEqual([]);
    expect(calls.attempts).toEqual([
      expect.objectContaining({
        eventId: "service-announcement-event-1",
        deviceId: "device-1",
        status: "skipped",
        reason: "service_announcement_target_metadata_missing",
      }),
    ]);
    expect(calls.announcementDispatches).toEqual([
      expect.objectContaining({ eventId: "service-announcement-event-1", status: "skipped", completedAt: now }),
    ]);
  });

  it("marks a terminal service announcement provider failure as failed without reintroducing a send path", async () => {
    const { worker, calls } = createWorker({
      jobs: [job({ attempts: 4 })],
      event: serviceAnnouncementEvent({
        targetPlatforms: ["android"],
        targetingPolicyVersion: 1,
      }),
      send: async () => ({ status: "transient_failure", reason: "fcm_transient" }),
      completeServiceAnnouncementDispatch: async () => {},
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 0, sent: 0, skipped: 0, queued: 0, failed: 1 });
    expect(calls.sent).toHaveLength(1);
    expect(calls.announcementDispatches).toEqual([
      expect.objectContaining({ eventId: "service-announcement-event-1", status: "failed", completedAt: now }),
    ]);
  });

  it("skips default-off events until an exact opt-in enables both axes", async () => {
    const preferenceResolution = new PreferenceResolutionService();
    const defaultOffEvent = event({
      type: "event_updated",
      generationId: "gen4-upcoming",
      memberId: "upcoming-member",
      title: "4기 일정 변경"
    });
    const resolveWithService = ({
      event: eventInput,
      deviceId,
      preferences,
      evaluatedAt,
      recentNotificationsInLastMinute
    }: {
      event: PlatformEvent;
      deviceId: string;
      preferences: UserNotificationPreference[];
      evaluatedAt: Date;
      recentNotificationsInLastMinute: number;
    }) => preferenceResolution.resolve(eventInput, deviceId, preferences, { evaluatedAt, recentNotificationsInLastMinute });

    const blocked = createWorker({ event: defaultOffEvent, resolve: resolveWithService });
    const blockedResult = await blocked.worker.drain({ now });

    expect(blockedResult).toMatchObject({ completed: 1, sent: 0, skipped: 1, queued: 0, failed: 0 });
    expect(blocked.calls.sent).toEqual([]);
    expect(blocked.calls.attempts).toEqual([
      expect.objectContaining({
        deviceId: "device-1",
        status: "skipped",
        reason: "preference_default_off",
        deliveryLevel: "in_app_history_only"
      })
    ]);

    const allowed = createWorker({
      event: defaultOffEvent,
      preferences: [
        {
          deviceId: "device-1",
          scope: "generation_event_type",
          generationId: "gen4-upcoming",
          eventType: "event_updated",
          enabled: true,
          explicitOverride: false,
          tapAction: "open_app",
          deliveryMode: "standard",
          updatedAt: "2026-06-12T00:00:00.000Z"
        }
      ],
      resolve: resolveWithService
    });
    const allowedResult = await allowed.worker.drain({ now });

    expect(allowedResult).toMatchObject({ completed: 1, sent: 0, skipped: 0, queued: 1, failed: 0 });
    expect(allowed.calls.sent).toEqual([]);
    expect(allowed.calls.attempts).toEqual([
      expect.objectContaining({
        deviceId: "device-1",
        status: "queued",
        reason: "summary_queued",
        deliveryLevel: "summary_push"
      })
    ]);
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
        lockedBy: "test-worker",
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
      expect.objectContaining({ lockedBy: "test-worker", retryAt: new Date("2026-06-12T00:02:05.000Z"), terminal: false })
    ]);
  });

  it("stops retrying at the attempt limit even when the provider supplies retryAfterMs", async () => {
    const { worker, calls } = createWorker({
      jobs: [job({ attempts: 4 })],
      send: async () => ({ status: "transient_failure", retryAfterMs: 125_000, reason: "quota_exceeded" })
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ claimed: 1, completed: 0, failed: 1, queued: 0, status: "partial" });
    expect(calls.failed).toEqual([
      expect.objectContaining({ jobId: "job-1", lockedBy: "test-worker", attempts: 4, terminal: true, retryAt: undefined })
    ]);
    expect(calls.attempts).toEqual([
      expect.objectContaining({ deviceId: "device-1", status: "failed", retryCount: 4 })
    ]);
  });

  it("retries only transient recipients after a partial send", async () => {
    const claimedJob = job();
    const devices = [
      device({ deviceId: "sent-device", pushToken: "sent-token" }),
      device({ deviceId: "retry-device", pushToken: "retry-token" })
    ];
    let round = 0;
    const { worker, calls } = createWorker({
      jobs: [claimedJob],
      devices,
      sendBatch: async ({ devices: batch }) => {
        round += 1;
        return batch.map((target) =>
          round === 1 && target.deviceId === "retry-device"
            ? { status: "transient_failure", reason: "fcm_transient" }
            : { status: "sent", providerMessageId: `message-${target.deviceId}-${round}` }
        );
      }
    });

    const first = await worker.drain({ now });
    claimedJob.attempts = 1;
    const second = await worker.drain({ now });

    expect(first).toMatchObject({ sent: 1, skipped: 0, queued: 1, failed: 0 });
    expect(second).toMatchObject({ sent: 1, skipped: 1, completed: 1, queued: 0, failed: 0 });
    expect(calls.batches.map((batch) => batch.devices.map((target) => target.deviceId))).toEqual([
      ["sent-device", "retry-device"],
      ["retry-device"]
    ]);
    expect(calls.attempts).toEqual([
      expect.objectContaining({ deviceId: "sent-device", status: "sent", retryCount: 0 }),
      expect.objectContaining({ deviceId: "retry-device", status: "failed", retryCount: 0 }),
      expect.objectContaining({ deviceId: "retry-device", status: "sent", retryCount: 1 })
    ]);
  });

  it("reevaluates quiet hours at retry time and completes a newly blocked recipient without rescheduling", async () => {
    const claimedJob = job();
    const preferenceResolution = new PreferenceResolutionService();
    const quietHoursPreference: UserNotificationPreference = {
      deviceId: "device-1",
      scope: "global",
      enabled: true,
      explicitOverride: false,
      tapAction: "open_app",
      deliveryMode: "standard",
      quietHours: { enabled: true, start: "00:01", end: "00:02", timezone: "UTC" },
      updatedAt: "2026-06-12T00:00:00.000Z"
    };
    const { worker, calls } = createWorker({
      jobs: [claimedJob],
      preferences: [quietHoursPreference],
      resolve: ({ event, deviceId, preferences, evaluatedAt, recentNotificationsInLastMinute }) =>
        preferenceResolution.resolve(event, deviceId, preferences, { evaluatedAt, recentNotificationsInLastMinute }),
      send: async () => ({ status: "transient_failure", reason: "fcm_transient" })
    });

    const first = await worker.drain({ now: new Date("2026-06-12T00:00:59.000Z") });
    claimedJob.attempts = 1;
    const second = await worker.drain({ now: new Date("2026-06-12T00:01:59.000Z") });

    expect(first).toMatchObject({ completed: 0, queued: 1, skipped: 0 });
    expect(second).toMatchObject({ completed: 1, queued: 0, skipped: 1, failed: 0 });
    expect(calls.failed).toEqual([
      expect.objectContaining({ terminal: false, retryAt: new Date("2026-06-12T00:01:59.000Z") })
    ]);
    expect(calls.completed).toEqual(["job-1"]);
    expect(calls.resolveContexts.map(({ evaluatedAt }) => evaluatedAt)).toEqual([
      new Date("2026-06-12T00:00:59.000Z"),
      new Date("2026-06-12T00:01:59.000Z")
    ]);
    expect(calls.attempts).toEqual([
      expect.objectContaining({ status: "failed", reason: "fcm_transient", retryCount: 0 }),
      expect.objectContaining({ status: "skipped", reason: "quiet_hours", retryCount: 1 })
    ]);
  });

  it("completes without sending when every recipient already has a sent attempt", async () => {
    const devices = [device({ deviceId: "device-1" }), device({ deviceId: "device-2", pushToken: "token-2" })];
    const { worker, calls } = createWorker({
      devices,
      previousAttempts: devices.map((target) => ({ deviceId: target.deviceId, status: "sent" }))
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 1, sent: 0, skipped: 2, queued: 0, failed: 0 });
    expect(calls.sent).toEqual([]);
    expect(calls.batches).toEqual([]);
    expect(calls.attempts).toEqual([]);
    expect(calls.preferenceDeviceIds).toEqual([]);
  });

  it("reprocesses recipients whose previous attempts were not sent", async () => {
    const devices = [
      device({ deviceId: "failed-device" }),
      device({ deviceId: "queued-device", pushToken: "queued-token" }),
      device({ deviceId: "skipped-device", pushToken: "skipped-token" })
    ];
    const { worker, calls } = createWorker({
      devices,
      previousAttempts: [
        { deviceId: "failed-device", status: "failed" },
        { deviceId: "queued-device", status: "queued" },
        { deviceId: "skipped-device", status: "skipped" }
      ],
      sendBatch: async ({ devices: batch }) => batch.map(() => ({ status: "sent" }))
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 1, sent: 3, skipped: 0 });
    expect(calls.batches[0].devices.map((target) => target.deviceId)).toEqual([
      "failed-device",
      "queued-device",
      "skipped-device"
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
      { deviceId: "device-2", expectedToken: "token-2", reason: "messaging/invalid-registration-token" }
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
        expectedToken: "token-redacted",
        reason: "messaging/registration-token-not-registered"
      }
    ]);
    expect(calls.completed).toEqual(["job-1"]);
  });

  it("filters sent recipients independently in each push-target page", async () => {
    const devices = Array.from({ length: 1201 }, (_, index) => device({
      deviceId: `device-${index}`,
      pushToken: `token-${index}`
    }));
    const { worker, calls } = createWorker({
      devices,
      previousAttempts: [0, 500, 1000].map((index) => ({ deviceId: `device-${index}`, status: "sent" })),
      sendBatch: async ({ devices: batch }) => batch.map(() => ({ status: "sent" })),
      deviceBatchSize: 500,
      preferenceBatchSize: 500,
      deliveryAttemptBatchSize: 500
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ sent: 1198, skipped: 3, completed: 1 });
    expect(calls.sentLookups.map((lookup) => lookup.deviceIds.length)).toEqual([500, 500, 201]);
    expect(calls.preferenceDeviceIds.map((ids) => ids.length)).toEqual([499, 499, 200]);
    expect(calls.batches.map((batch) => batch.devices.length)).toEqual([499, 499, 200]);
    expect(calls.attemptBatches.map((batch) => batch.length)).toEqual([499, 499, 200]);
  });

  it("passes recent sent counts into single-device preference resolution and rate-limits matching devices", async () => {
    const preferenceResolution = new PreferenceResolutionService();
    const limitedPreference: UserNotificationPreference = {
      deviceId: "device-1",
      scope: "global",
      enabled: true,
      explicitOverride: false,
      tapAction: "open_app",
      deliveryMode: "standard",
      maxNotificationsPerMinute: 1,
      updatedAt: "2026-06-12T00:00:00.000Z"
    };
    const { worker, calls } = createWorker({
      preferences: [limitedPreference],
      recentSentCounts: { "device-1": 1 },
      resolve: ({ event, deviceId, preferences, evaluatedAt, recentNotificationsInLastMinute }) =>
        preferenceResolution.resolve(event, deviceId, preferences, { evaluatedAt, recentNotificationsInLastMinute })
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 1, sent: 0, skipped: 1, queued: 0, failed: 0 });
    expect(calls.sent).toEqual([]);
    expect(calls.recentSentLookups).toEqual([
      {
        deviceIds: ["device-1"],
        since: new Date("2026-06-11T23:59:00.000Z"),
        until: now
      }
    ]);
    expect(calls.resolveContexts).toEqual([
      { deviceId: "device-1", evaluatedAt: now, recentNotificationsInLastMinute: 1 }
    ]);
    expect(calls.attempts).toEqual([
      expect.objectContaining({
        deviceId: "device-1",
        status: "skipped",
        reason: "rate_limited",
        deliveryLevel: "in_app_history_only"
      })
    ]);
  });

  it("passes recent sent counts into multicast preference resolution and skips only rate-limited recipients", async () => {
    const preferenceResolution = new PreferenceResolutionService();
    const devices = [
      device({ deviceId: "allowed-device", pushToken: "allowed-token" }),
      device({ deviceId: "limited-device", pushToken: "limited-token" })
    ];
    const sharedPreference = (deviceId: string): UserNotificationPreference => ({
      deviceId,
      scope: "global",
      enabled: true,
      explicitOverride: false,
      tapAction: "open_app",
      deliveryMode: "standard",
      maxNotificationsPerMinute: 1,
      updatedAt: "2026-06-12T00:00:00.000Z"
    });
    const { worker, calls } = createWorker({
      devices,
      preferences: [sharedPreference("allowed-device"), sharedPreference("limited-device")],
      recentSentCounts: { "allowed-device": 0, "limited-device": 1 },
      sendBatch: async ({ devices: batch }) => batch.map((target) => ({ status: "sent", providerMessageId: `message-${target.deviceId}` })),
      resolve: ({ event, deviceId, preferences, evaluatedAt, recentNotificationsInLastMinute }) =>
        preferenceResolution.resolve(event, deviceId, preferences, { evaluatedAt, recentNotificationsInLastMinute })
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 1, sent: 1, skipped: 1, queued: 0, failed: 0 });
    expect(calls.batches).toHaveLength(1);
    expect(calls.batches[0].devices.map((target) => target.deviceId)).toEqual(["allowed-device"]);
    expect(calls.recentSentLookups).toEqual([
      {
        deviceIds: ["allowed-device", "limited-device"],
        since: new Date("2026-06-11T23:59:00.000Z"),
        until: now
      }
    ]);
    expect(calls.resolveContexts).toEqual([
      { deviceId: "allowed-device", evaluatedAt: now, recentNotificationsInLastMinute: 0 },
      { deviceId: "limited-device", evaluatedAt: now, recentNotificationsInLastMinute: 1 }
    ]);
    expect(calls.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deviceId: "allowed-device",
          status: "sent"
        }),
        expect.objectContaining({
          deviceId: "limited-device",
          status: "skipped",
          reason: "rate_limited",
          deliveryLevel: "in_app_history_only"
        })
      ])
    );
  });

  it("falls back to listPushTargets when listPushTargetsPage is unavailable", async () => {
    const { worker, calls } = createWorker({ useListFallback: true });

    await worker.drain({ now });

    expect(calls.sent).toHaveLength(1);
  });

  it("skips a single-device send when exact push token ownership was reassigned", async () => {
    const { worker, calls } = createWorker({
      listCurrentPushTokenOwnerIds: async () => new Set()
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 1, sent: 0, skipped: 1, failed: 0 });
    expect(calls.sent).toEqual([]);
    expect(calls.ownershipLookups).toEqual([[
      { deviceId: "device-1", pushToken: "token-redacted" }
    ]]);
    expect(calls.attempts).toEqual([
      expect.objectContaining({ deviceId: "device-1", status: "skipped", reason: "push_token_reassigned" })
    ]);
  });

  it("filters reassigned targets before multicast and keeps result indexes aligned", async () => {
    const devices = [
      device({ deviceId: "owner-1", pushToken: "token-1" }),
      device({ deviceId: "reassigned", pushToken: "token-2" }),
      device({ deviceId: "owner-3", pushToken: "token-3" })
    ];
    const { worker, calls } = createWorker({
      devices,
      listCurrentPushTokenOwnerIds: async () => new Set(["owner-1", "owner-3"]),
      sendBatch: async ({ devices: batch }) => batch.map((target) => ({
        status: "sent",
        providerMessageId: `message-${target.deviceId}`
      }))
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 1, sent: 2, skipped: 1, failed: 0 });
    expect(calls.batches[0].devices.map((target) => target.deviceId)).toEqual(["owner-1", "owner-3"]);
    expect(calls.attempts).toEqual(expect.arrayContaining([
      expect.objectContaining({ deviceId: "owner-1", status: "sent", providerMessageId: "message-owner-1" }),
      expect.objectContaining({ deviceId: "reassigned", status: "skipped", reason: "push_token_reassigned" }),
      expect.objectContaining({ deviceId: "owner-3", status: "sent", providerMessageId: "message-owner-3" })
    ]));
  });

  it("suppresses a duplicate raw token across push-target pages", async () => {
    const devices = Array.from({ length: 51 }, (_, index) => device({
      deviceId: `device-${index}`,
      pushToken: index === 50 ? "token-0" : `token-${index}`
    }));
    const { worker, calls } = createWorker({
      devices,
      deviceBatchSize: 50,
      sendBatch: async ({ devices: batch }) => batch.map(() => ({ status: "sent" }))
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 1, sent: 50, skipped: 1 });
    expect(calls.batches).toHaveLength(1);
    expect(calls.ownershipLookups).toHaveLength(1);
    expect(calls.attempts).toContainEqual(expect.objectContaining({
      deviceId: "device-50",
      status: "skipped",
      reason: "duplicate_push_token"
    }));
  });

  it("suppresses a duplicate raw token across different payload groups", async () => {
    const devices = [
      device({ deviceId: "normal-device", pushToken: "shared-token" }),
      device({ deviceId: "high-device", pushToken: "shared-token" })
    ];
    const { worker, calls } = createWorker({
      devices,
      resolve: ({ deviceId }) => resolution({
        deviceId,
        pushPriority: deviceId === "high-device" ? "high" : "normal"
      }),
      sendBatch: async ({ devices: batch }) => batch.map(() => ({ status: "sent" }))
    });

    const result = await worker.drain({ now });

    expect(result).toMatchObject({ completed: 1, sent: 1, skipped: 1 });
    expect(calls.batches).toHaveLength(1);
    expect(calls.batches[0].devices.map((target) => target.deviceId)).toEqual(["normal-device"]);
    expect(calls.attempts).toContainEqual(expect.objectContaining({
      deviceId: "high-device",
      status: "skipped",
      reason: "duplicate_push_token"
    }));
  });

  it("does not call the provider when ownership validation fails", async () => {
    const { worker, calls } = createWorker({
      listCurrentPushTokenOwnerIds: async () => { throw new Error("ownership_lookup_failed"); }
    });

    await expect(worker.drain({ now })).rejects.toThrow("ownership_lookup_failed");
    expect(calls.sent).toEqual([]);
    expect(calls.batches).toEqual([]);
  });

  it("falls back to create when createMany is unavailable", async () => {
    const { worker, calls } = createWorker({ withoutCreateMany: true });

    await worker.drain({ now });

    expect(calls.attempts).toHaveLength(1);
    expect(calls.attemptBatches).toHaveLength(0);
  });

  it("renews the lease at job start and before each page and preference batch", async () => {
    const times = [
      new Date("2026-06-12T00:00:00.000Z"),
      new Date("2026-06-12T00:00:01.000Z"),
      new Date("2026-06-12T00:00:02.000Z"),
      new Date("2026-06-12T00:00:03.000Z"),
      new Date("2026-06-12T00:00:04.000Z")
    ];
    const { worker, calls } = createWorker({
      sendBatch: async ({ devices: batch }) => batch.map(() => ({ status: "sent", providerMessageId: "message-1" })),
      clock: () => times.shift() ?? new Date("2026-06-12T00:00:05.000Z")
    });

    await worker.drain({ lockedBy: "test-worker", now });

    expect(calls.renewals).toEqual([
      { jobId: "job-1", lockedBy: "test-worker", now: new Date("2026-06-12T00:00:00.000Z") },
      { jobId: "job-1", lockedBy: "test-worker", now: new Date("2026-06-12T00:00:01.000Z") },
      { jobId: "job-1", lockedBy: "test-worker", now: new Date("2026-06-12T00:00:02.000Z") },
      { jobId: "job-1", lockedBy: "test-worker", now: new Date("2026-06-12T00:00:03.000Z") },
      { jobId: "job-1", lockedBy: "test-worker", now: new Date("2026-06-12T00:00:04.000Z") }
    ]);
  });

  it("flushes buffered attempts, marks lock loss, and stops before later claimed jobs after pre-send lease loss", async () => {
    const devices = [device({ deviceId: "device-1" }), device({ deviceId: "device-2", pushToken: "token-2" })];
    const jobs = [job({ id: "job-1", eventId: "event-1" }), job({ id: "job-2", eventId: "event-2" })];
    let renewals = 0;
    const { worker, calls } = createWorker({
      jobs,
      devices,
      sendBatch: async ({ devices: batch }) =>
        batch.map((target) => ({ status: "sent", providerMessageId: `message-${target.deviceId}` })),
      resolve: ({ deviceId }) =>
        deviceId === "device-1"
          ? resolution({ deviceId, shouldNotify: false, reason: "global_off" })
          : resolution({ deviceId }),
      renewLock: async ({ jobId }) => {
        renewals += 1;
        return !(jobId === "job-1" && renewals === 5);
      }
    });

    const result = await worker.drain({ lockedBy: "test-worker", now });

    expect(result).toMatchObject({
      claimed: 2,
      completed: 0,
      failed: 0,
      sent: 0,
      skipped: 1,
      queued: 0,
      status: "partial",
      reason: "notification_job_lock_lost"
    });
    expect(calls.attemptBatches).toEqual([
      expect.arrayContaining([
        expect.objectContaining({ deviceId: "device-1", status: "skipped", reason: "global_off" })
      ])
    ]);
    expect(calls.completed).toEqual([]);
    expect(calls.failed).toEqual([]);
    expect(calls.sentLookups).toHaveLength(1);
  });
});
