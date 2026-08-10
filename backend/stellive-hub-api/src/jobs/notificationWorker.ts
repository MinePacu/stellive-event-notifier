import { randomUUID } from "node:crypto";
import { resolveNotificationDelivery } from "../notification/loadReductionPolicy.js";
import { buildPushPayload } from "../push/pushPayloadFactory.js";
import type { PushSendResult } from "../push/fcmClient.js";
import type { PushTargetDevice, PushSender } from "../push/pushSender.js";
import type {
  ClaimedNotificationJob,
  ClaimNotificationJobsInput,
  FailNotificationJobInput,
  NotificationJobRepository
} from "./notificationJobRepository.js";
import type { SummaryNotificationRepository } from "./summaryNotificationRepository.js";
import type { CreateDeliveryAttemptInput, DeliveryAttemptRepository } from "../repositories/deliveryAttemptRepository.js";
import type DeviceRepository from "../repositories/deviceRepository.js";
import type PlatformEventRepository from "../repositories/platformEventRepository.js";
import type PreferenceRepository from "../repositories/preferenceRepository.js";
import type { PreferenceResolutionService } from "../preferences/preferenceResolution.js";
import type {
  NotificationDeliveryLevel,
  PlatformEvent,
  ResolvedNotificationPreference,
  UserNotificationPreference
} from "../types.js";

export interface NotificationWorkerDrainInput {
  limit?: number;
  lockedBy?: string;
  now?: Date;
}

export interface NotificationWorkerDrainResult {
  claimed: number;
  completed: number;
  failed: number;
  skipped: number;
  sent: number;
  queued: number;
  status: "ok" | "disabled" | "partial";
  reason?: string;
}

interface NotificationWorkerDependencies {
  notificationJobs: Pick<NotificationJobRepository, "claimReady" | "renewLock" | "complete" | "fail">;
  platformEvents: Pick<PlatformEventRepository, "findById">;
  hubEventSchedules?: {
    isScheduleNotificationCurrent(event: PlatformEvent, now: Date): Promise<boolean>;
  };
  devices: {
    listPushTargetsPage?(input: { cursor?: string; limit: number }): Promise<{ items: PushTargetDevice[]; nextCursor: string | null }>;
    listPushTargets?(): Promise<PushTargetDevice[]>;
    markTokenInvalid(deviceId: string, reason: string): Promise<void>;
  };
  preferences: Pick<PreferenceRepository, "listForDevice"> | { listForDevices(deviceIds: string[]): Promise<UserNotificationPreference[]> };
  deliveryAttempts: {
    create(input: CreateDeliveryAttemptInput): Promise<void>;
    createMany?(inputs: CreateDeliveryAttemptInput[]): Promise<void>;
    listSentDeviceIds(input: { eventId: string; deviceIds: string[] }): Promise<Set<string>>;
    countSentByDeviceInWindow(input: { deviceIds: string[]; since: Date; until: Date }): Promise<Map<string, number>>;
  };
  summaryNotifications: Pick<SummaryNotificationRepository, "enqueue">;
  preferenceResolution: Pick<PreferenceResolutionService, "resolve">;
  pushSender: PushSender;
  now?: () => Date;
  random?: () => number;
  deviceBatchSize?: number;
  preferenceBatchSize?: number;
  deliveryAttemptBatchSize?: number;
}

interface MutableDrainTotals extends NotificationWorkerDrainResult {}

interface DeviceProcessResult {
  sent?: boolean;
  skipped?: boolean;
  queued?: boolean;
  summaryEnqueueFailure?: boolean;
  transientFailure?: boolean;
  retryAfterMs?: number;
  leaseLost?: boolean;
}

const retryDelaysMs = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const notificationJobStaleLockMs = 300_000;

function clampDrainLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 25;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function emptyDrainResult(claimed: number): MutableDrainTotals {
  return {
    claimed,
    completed: 0,
    failed: 0,
    skipped: 0,
    sent: 0,
    queued: 0,
    status: "ok"
  };
}

export function calculateRetryDelayMs(attempts: number, retryAfterMs?: number, random = () => 0.5): number | undefined {
  const delay = retryDelaysMs[attempts];
  if (delay === undefined) return undefined;
  if (retryAfterMs !== undefined) return Math.max(0, retryAfterMs);
  return Math.round(delay * (0.9 + Math.min(Math.max(random(), 0), 1) * 0.2));
}

function retryAt(attempts: number, now: Date, retryAfterMs?: number, random?: () => number): Date | undefined {
  const delay = calculateRetryDelayMs(attempts, retryAfterMs, random);
  return delay === undefined ? undefined : new Date(now.getTime() + delay);
}

async function listPreferences(
  preferences: NotificationWorkerDependencies["preferences"],
  deviceIds: string[]
): Promise<UserNotificationPreference[]> {
  if ("listForDevices" in preferences) return preferences.listForDevices(deviceIds);
  const perDevice = await Promise.all(deviceIds.map((deviceId) => preferences.listForDevice(deviceId)));
  return perDevice.flat();
}

function deliveryPriority(resolution: ResolvedNotificationPreference): "normal" | "high" {
  return resolution.pushPriority === "high" ? "high" : "normal";
}

function batchSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 500;
  return Math.min(Math.max(Math.trunc(value), 50), 5_000);
}

export class NotificationWorker {
  constructor(private readonly dependencies: NotificationWorkerDependencies) {}

  async drain(input: NotificationWorkerDrainInput = {}): Promise<NotificationWorkerDrainResult> {
    const now = input.now ?? this.currentTime();
    const limit = clampDrainLimit(input.limit);
    const lockedBy = input.lockedBy ?? `worker-${process.pid}-${randomUUID()}`;
    const jobs = await this.dependencies.notificationJobs.claimReady({
      limit,
      lockedBy,
      now,
      staleLockMs: notificationJobStaleLockMs
    } satisfies ClaimNotificationJobsInput);
    const totals = emptyDrainResult(jobs.length);

    for (const claimedJob of jobs) {
      const completed = await this.processJob(claimedJob, totals, now, input.now);
      if (!completed && totals.reason === "notification_job_lock_lost") break;
    }

    if (totals.failed > 0) totals.status = "partial";
    return totals;
  }

  private async processJob(
    job: ClaimedNotificationJob,
    totals: MutableDrainTotals,
    now: Date,
    evaluatedAtOverride?: Date
  ): Promise<boolean> {
    if (!(await this.renewJobLock(job, totals))) return false;

    const event = await this.dependencies.platformEvents.findById(job.eventId);
    if (!event) {
      const failed = await this.dependencies.notificationJobs.fail({
        jobId: job.id,
        lockedBy: job.lockedBy,
        attempts: job.attempts,
        reason: "platform_event_missing",
        terminal: true
      });
      if (!failed) {
        this.markLockLost(totals);
        return false;
      }
      totals.failed += 1;
      return true;
    }

    if (
      this.dependencies.hubEventSchedules &&
      !(await this.dependencies.hubEventSchedules.isScheduleNotificationCurrent(event, now))
    ) {
      const completed = await this.dependencies.notificationJobs.complete({
        jobId: job.id,
        lockedBy: job.lockedBy
      });
      if (!completed) {
        this.markLockLost(totals);
        return false;
      }
      totals.completed += 1;
      totals.skipped += 1;
      return true;
    }

    let hadTransientFailure = false;
    let hadSummaryEnqueueFailure = false;
    let providerRetryAfterMs: number | undefined;
    let leaseLost = false;

    const processPage = async (devices: PushTargetDevice[]) => {
      if (!(await this.renewJobLock(job, totals))) return false;
      const sentDeviceIds = await this.dependencies.deliveryAttempts.listSentDeviceIds({
        eventId: event.id,
        deviceIds: devices.map((device) => device.deviceId)
      });
      const pendingDevices = devices.filter((device) => !sentDeviceIds.has(device.deviceId));
      totals.skipped += devices.length - pendingDevices.length;
      const attemptBuffer: CreateDeliveryAttemptInput[] = [];
      const preferenceBatchSize = batchSize(this.dependencies.preferenceBatchSize);
      for (let offset = 0; offset < pendingDevices.length; offset += preferenceBatchSize) {
        if (!(await this.renewJobLock(job, totals, attemptBuffer))) return false;
        const deviceBatch = pendingDevices.slice(offset, offset + preferenceBatchSize);
        const recentSentCounts = await this.dependencies.deliveryAttempts.countSentByDeviceInWindow({
          deviceIds: deviceBatch.map((device) => device.deviceId),
          since: new Date(now.getTime() - 60_000),
          until: now
        });
        const preferences = await listPreferences(
          this.dependencies.preferences,
          deviceBatch.map((device) => device.deviceId)
        );
      const result = await this.processDeviceBatch({
          event,
          devices: deviceBatch,
          preferences,
          recentSentCounts,
          job,
          totals,
          now,
          evaluatedAtOverride,
          attemptBuffer
        });
        totals.sent += result.sent;
        totals.skipped += result.skipped;
        totals.queued += result.queued;
        hadTransientFailure ||= result.hadTransientFailure;
        hadSummaryEnqueueFailure ||= result.hadSummaryEnqueueFailure;
        if (result.providerRetryAfterMs !== undefined) {
          providerRetryAfterMs = Math.max(providerRetryAfterMs ?? 0, result.providerRetryAfterMs);
        }
        if (result.leaseLost) return false;
      }
      await this.flushAttempts(attemptBuffer);
      return true;
    };

    if (this.dependencies.devices.listPushTargetsPage) {
      let cursor: string | undefined;
      do {
        if (!(await this.renewJobLock(job, totals))) return false;
        const page = await this.dependencies.devices.listPushTargetsPage({
          cursor,
          limit: batchSize(this.dependencies.deviceBatchSize)
        });
        if (!(await processPage(page.items))) {
          leaseLost = true;
          break;
        }
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
    } else if (this.dependencies.devices.listPushTargets) {
      if (!(await this.renewJobLock(job, totals))) return false;
      const devices = await this.dependencies.devices.listPushTargets();
      if (!(await processPage(devices))) leaseLost = true;
    } else {
      throw new Error("device_push_target_listing_unavailable");
    }
    if (leaseLost) return false;

    if (hadTransientFailure) {
      const terminal = await this.retryOrFailJob(
        job,
        hadSummaryEnqueueFailure ? "summary_enqueue_failure" : "transient_push_failure",
        now,
        providerRetryAfterMs,
        totals
      );
      if (terminal === undefined) return false;
      if (terminal) totals.failed += 1;
      else totals.queued += 1;
      totals.status = "partial";
      return true;
    }

    const completed = await this.dependencies.notificationJobs.complete({
      jobId: job.id,
      lockedBy: job.lockedBy
    });
    if (!completed) {
      this.markLockLost(totals);
      return false;
    }
    totals.completed += 1;
    return true;
  }

  private async processDeviceBatch(input: {
    event: PlatformEvent;
    devices: PushTargetDevice[];
    preferences: UserNotificationPreference[];
    recentSentCounts: Map<string, number>;
    job: ClaimedNotificationJob;
    totals: MutableDrainTotals;
    now: Date;
    evaluatedAtOverride?: Date;
    attemptBuffer: CreateDeliveryAttemptInput[];
  }): Promise<{
    sent: number;
    skipped: number;
    queued: number;
    hadTransientFailure: boolean;
    hadSummaryEnqueueFailure: boolean;
    providerRetryAfterMs?: number;
    leaseLost?: boolean;
  }> {
    let sent = 0;
    let skipped = 0;
    let queued = 0;
    let hadTransientFailure = false;
    let hadSummaryEnqueueFailure = false;
    let providerRetryAfterMs: number | undefined;
    if (this.dependencies.pushSender.sendToDevices) {
      const groups = new Map<string, Array<{
        device: PushTargetDevice;
        resolution: ResolvedNotificationPreference;
        deliveryLevel: NotificationDeliveryLevel;
        payload: ReturnType<typeof buildPushPayload>;
      }>>();

      for (const device of input.devices) {
        const evaluatedAt = input.evaluatedAtOverride ?? this.currentTime();
        const resolution = this.dependencies.preferenceResolution.resolve(input.event, device.deviceId, input.preferences, {
          evaluatedAt,
          recentNotificationsInLastMinute: input.recentSentCounts.get(device.deviceId) ?? 0
        });
        const delivery = resolveNotificationDelivery(input.event, resolution);
        if (delivery.action === "history_only") {
          this.recordAttempt(input.attemptBuffer, {
            event: input.event,
            device,
            resolution,
            deliveryLevel: delivery.deliveryLevel,
            status: "skipped",
            reason: resolution.shouldNotify ? (delivery.loadReductionReason ?? "history_only") : resolution.reason,
            now: input.now,
            retryCount: input.job.attempts
          });
          skipped += 1;
          continue;
        }
        if (delivery.action === "enqueue_summary") {
          const result = await this.enqueueSummary(input.attemptBuffer, {
            event: input.event,
            device,
            resolution,
            evaluatedAt,
            now: input.now,
            retryCount: input.job.attempts
          });
          if (result.queued) queued += 1;
          if (result.transientFailure) hadTransientFailure = true;
          if (result.summaryEnqueueFailure) hadSummaryEnqueueFailure = true;
          continue;
        }
        const payload = buildPushPayload({ event: input.event, resolution, deliveryLevel: delivery.deliveryLevel });
        const key = JSON.stringify(payload);
        const group = groups.get(key) ?? [];
        group.push({ device, resolution, deliveryLevel: delivery.deliveryLevel, payload });
        groups.set(key, group);
      }

      for (const group of groups.values()) {
        if (!(await this.renewJobLock(input.job, input.totals, input.attemptBuffer))) {
          return { sent, skipped, queued, hadTransientFailure, hadSummaryEnqueueFailure, providerRetryAfterMs, leaseLost: true };
        }
        const results = await this.dependencies.pushSender.sendToDevices({
          devices: group.map((item) => item.device),
          payload: group[0].payload
        });
        for (let index = 0; index < group.length; index += 1) {
          const item = group[index];
          const result = await this.handleSendResult(input.attemptBuffer, {
            event: input.event,
            device: item.device,
            resolution: item.resolution,
            deliveryLevel: item.deliveryLevel,
            sendResult: results[index] ?? { status: "transient_failure", reason: "fcm_batch_result_missing" },
            now: input.now,
            retryCount: input.job.attempts
          });
          if (result.sent) sent += 1;
          if (result.skipped) skipped += 1;
          if (result.transientFailure) hadTransientFailure = true;
          if (result.retryAfterMs !== undefined) {
            providerRetryAfterMs = Math.max(providerRetryAfterMs ?? 0, result.retryAfterMs);
          }
        }
      }
    } else {

      for (const device of input.devices) {
        const result = await this.processDevice({ ...input, device });
        if (result.sent) sent += 1;
        if (result.skipped) skipped += 1;
        if (result.queued) queued += 1;
        if (result.transientFailure) hadTransientFailure = true;
        if (result.summaryEnqueueFailure) hadSummaryEnqueueFailure = true;
        if (result.retryAfterMs !== undefined) {
          providerRetryAfterMs = Math.max(providerRetryAfterMs ?? 0, result.retryAfterMs);
        }
        if (result.leaseLost) return { sent, skipped, queued, hadTransientFailure, hadSummaryEnqueueFailure, providerRetryAfterMs, leaseLost: true };
      }
    }
    return { sent, skipped, queued, hadTransientFailure, hadSummaryEnqueueFailure, providerRetryAfterMs };
  }

  private async processDevice(input: {
    event: PlatformEvent;
    device: PushTargetDevice;
    preferences: UserNotificationPreference[];
    recentSentCounts: Map<string, number>;
    job: ClaimedNotificationJob;
    totals: MutableDrainTotals;
    now: Date;
    evaluatedAtOverride?: Date;
    attemptBuffer: CreateDeliveryAttemptInput[];
  }): Promise<DeviceProcessResult> {
    const evaluatedAt = input.evaluatedAtOverride ?? this.currentTime();
    const resolution = this.dependencies.preferenceResolution.resolve(
      input.event,
      input.device.deviceId,
      input.preferences,
      {
        evaluatedAt,
        recentNotificationsInLastMinute: input.recentSentCounts.get(input.device.deviceId) ?? 0
      }
    );
    const delivery = resolveNotificationDelivery(input.event, resolution);

    if (delivery.action === "history_only") {
      this.recordAttempt(input.attemptBuffer, {
        event: input.event,
        device: input.device,
        resolution,
        deliveryLevel: delivery.deliveryLevel,
        status: "skipped",
        reason: resolution.shouldNotify ? (delivery.loadReductionReason ?? "history_only") : resolution.reason,
        now: input.now,
        retryCount: input.job.attempts
      });
      return { skipped: true };
    }

    if (delivery.action === "enqueue_summary") {
      return this.enqueueSummary(input.attemptBuffer, {
        event: input.event,
        device: input.device,
        resolution,
        evaluatedAt,
        now: input.now,
        retryCount: input.job.attempts
      });
    }

    const payload = buildPushPayload({
      event: input.event,
      resolution,
      deliveryLevel: delivery.deliveryLevel
    });
    if (!(await this.renewJobLock(input.job, input.totals, input.attemptBuffer))) return { leaseLost: true };
    const sendResult = await this.dependencies.pushSender.sendToDevice({
      device: input.device,
      payload
    });

    return this.handleSendResult(input.attemptBuffer, {
      event: input.event,
      device: input.device,
      resolution,
      deliveryLevel: delivery.deliveryLevel,
      sendResult,
      now: input.now,
      retryCount: input.job.attempts
    });
  }

  private async handleSendResult(attemptBuffer: CreateDeliveryAttemptInput[], input: {
    event: PlatformEvent;
    device: PushTargetDevice;
    resolution: ResolvedNotificationPreference;
    deliveryLevel: NotificationDeliveryLevel;
    sendResult: PushSendResult;
    now: Date;
    retryCount: number;
  }): Promise<DeviceProcessResult> {
    if (input.sendResult.status === "sent") {
      this.recordAttempt(attemptBuffer, {
        ...input,
        status: "sent",
        reason: "allowed",
        providerMessageId: input.sendResult.providerMessageId,
        providerErrorCode: input.sendResult.providerErrorCode
      });
      return { sent: true };
    }

    if (input.sendResult.status === "permanent_token_failure") {
      await this.dependencies.devices.markTokenInvalid(
        input.device.deviceId,
        input.sendResult.providerErrorCode ?? input.sendResult.reason ?? "permanent_token_failure"
      );
      this.recordAttempt(attemptBuffer, {
        ...input,
        status: "skipped",
        reason: input.sendResult.reason ?? "permanent_token_failure",
        providerErrorCode: input.sendResult.providerErrorCode
      });
      return { skipped: true };
    }

    this.recordAttempt(attemptBuffer, {
      ...input,
      status: input.sendResult.status === "disabled" ? "queued" : "failed",
      reason: input.sendResult.reason ?? input.sendResult.status,
      providerErrorCode: input.sendResult.providerErrorCode
    });

    return input.sendResult.status === "transient_failure"
      ? { transientFailure: true, retryAfterMs: input.sendResult.retryAfterMs }
      : { skipped: true };
  }

  private async enqueueSummary(attemptBuffer: CreateDeliveryAttemptInput[], input: {
    event: PlatformEvent;
    device: PushTargetDevice;
    resolution: ResolvedNotificationPreference;
    evaluatedAt: Date;
    now: Date;
    retryCount: number;
  }): Promise<DeviceProcessResult> {
    try {
      await this.dependencies.summaryNotifications.enqueue({
        event: input.event,
        deviceId: input.device.deviceId,
        evaluatedAt: input.evaluatedAt
      });
      this.recordAttempt(attemptBuffer, {
        ...input,
        deliveryLevel: "summary_push",
        status: "queued",
        reason: "summary_queued"
      });
      return { queued: true };
    } catch {
      this.recordAttempt(attemptBuffer, {
        ...input,
        deliveryLevel: "summary_push",
        status: "failed",
        reason: "summary_enqueue_failed"
      });
      return { transientFailure: true, summaryEnqueueFailure: true };
    }
  }

  private recordAttempt(attemptBuffer: CreateDeliveryAttemptInput[], input: {
    event: PlatformEvent;
    device: PushTargetDevice;
    resolution: ResolvedNotificationPreference;
    deliveryLevel: NotificationDeliveryLevel;
    status: "queued" | "sent" | "failed" | "skipped";
    reason: string;
    now: Date;
    providerMessageId?: string;
    providerErrorCode?: string;
    retryCount: number;
  }): void {
    attemptBuffer.push({
      eventId: input.event.id,
      deviceId: input.device.deviceId,
      attemptedAt: input.now,
      deliveredAt: input.status === "sent" ? input.now : undefined,
      status: input.status,
      reason: input.reason,
      source: input.event.source,
      eventType: input.event.type,
      generationId: input.event.generationId,
      memberId: input.event.memberId,
      deliveryMode: input.resolution.deliveryMode,
      deliveryLevel: input.deliveryLevel,
      pushPriority: deliveryPriority(input.resolution),
      providerMessageId: input.providerMessageId,
      providerErrorCode: input.providerErrorCode,
      retryCount: input.retryCount,
      tapActionUsed: input.resolution.tapAction,
      title: input.event.title,
      body: input.event.body
    });
  }

  private async flushAttempts(attempts: CreateDeliveryAttemptInput[]): Promise<void> {
    const size = batchSize(this.dependencies.deliveryAttemptBatchSize);
    for (let offset = 0; offset < attempts.length; offset += size) {
      const batch = attempts.slice(offset, offset + size);
      if (this.dependencies.deliveryAttempts.createMany) {
        await this.dependencies.deliveryAttempts.createMany(batch);
      } else {
        for (const attempt of batch) await this.dependencies.deliveryAttempts.create(attempt);
      }
    }
  }

  private async retryOrFailJob(
    job: ClaimedNotificationJob,
    reason: string,
    now: Date,
    retryAfterMs: number | undefined,
    totals: MutableDrainTotals
  ): Promise<boolean | undefined> {
    const nextRun = retryAt(job.attempts, now, retryAfterMs, this.dependencies.random);
    const terminal = nextRun === undefined;
    const input: FailNotificationJobInput = {
      jobId: job.id,
      lockedBy: job.lockedBy,
      attempts: job.attempts,
      reason,
      terminal,
      retryAt: nextRun
    };
    const failed = await this.dependencies.notificationJobs.fail(input);
    if (!failed) {
      this.markLockLost(totals);
      return undefined;
    }
    return terminal;
  }

  private async renewJobLock(
    job: ClaimedNotificationJob,
    totals?: MutableDrainTotals,
    attemptBuffer?: CreateDeliveryAttemptInput[]
  ): Promise<boolean> {
    const renewed = await this.dependencies.notificationJobs.renewLock({
      jobId: job.id,
      lockedBy: job.lockedBy,
      now: this.currentTime()
    });
    if (renewed) return true;
    if (attemptBuffer && attemptBuffer.length > 0) await this.flushAttempts(attemptBuffer);
    if (totals) this.markLockLost(totals);
    return false;
  }

  private markLockLost(totals: MutableDrainTotals): void {
    totals.status = "partial";
    totals.reason = "notification_job_lock_lost";
  }

  private currentTime(): Date {
    return this.dependencies.now?.() ?? new Date();
  }
}

export default NotificationWorker;
