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
import type { DeliveryAttemptRepository } from "../repositories/deliveryAttemptRepository.js";
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
  notificationJobs: Pick<NotificationJobRepository, "claimReady" | "complete" | "fail">;
  platformEvents: Pick<PlatformEventRepository, "findById">;
  devices: Pick<DeviceRepository, "listPushTargets" | "markTokenInvalid">;
  preferences: Pick<PreferenceRepository, "listForDevice"> | { listForDevices(deviceIds: string[]): Promise<UserNotificationPreference[]> };
  deliveryAttempts: Pick<DeliveryAttemptRepository, "create">;
  preferenceResolution: Pick<PreferenceResolutionService, "resolve">;
  pushSender: PushSender;
  now?: () => Date;
  random?: () => number;
}

interface MutableDrainTotals extends NotificationWorkerDrainResult {}

interface DeviceProcessResult {
  sent?: boolean;
  skipped?: boolean;
  transientFailure?: boolean;
  retryAfterMs?: number;
}

const retryDelaysMs = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

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
  if (retryAfterMs !== undefined) return Math.max(0, retryAfterMs);
  const delay = retryDelaysMs[attempts];
  if (delay === undefined) return undefined;
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

export class NotificationWorker {
  constructor(private readonly dependencies: NotificationWorkerDependencies) {}

  async drain(input: NotificationWorkerDrainInput = {}): Promise<NotificationWorkerDrainResult> {
    const now = input.now ?? this.dependencies.now?.() ?? new Date();
    const limit = clampDrainLimit(input.limit);
    const lockedBy = input.lockedBy ?? `worker-${process.pid}`;
    const jobs = await this.dependencies.notificationJobs.claimReady({
      limit,
      lockedBy,
      now
    } satisfies ClaimNotificationJobsInput);
    const totals = emptyDrainResult(jobs.length);

    for (const claimedJob of jobs) {
      await this.processJob(claimedJob, totals, now);
    }

    if (totals.queued > 0 || totals.failed > 0) totals.status = "partial";
    return totals;
  }

  private async processJob(job: ClaimedNotificationJob, totals: MutableDrainTotals, now: Date): Promise<void> {
    const event = await this.dependencies.platformEvents.findById(job.eventId);
    if (!event) {
      await this.dependencies.notificationJobs.fail({
        jobId: job.id,
        attempts: job.attempts,
        reason: "platform_event_missing",
        terminal: true
      });
      totals.failed += 1;
      return;
    }

    const devices = await this.dependencies.devices.listPushTargets();
    const preferences = await listPreferences(
      this.dependencies.preferences,
      devices.map((device) => device.deviceId)
    );
    let hadTransientFailure = false;
    let providerRetryAfterMs: number | undefined;

    if (this.dependencies.pushSender.sendToDevices) {
      const groups = new Map<string, Array<{
        device: PushTargetDevice;
        resolution: ResolvedNotificationPreference;
        deliveryLevel: NotificationDeliveryLevel;
        payload: ReturnType<typeof buildPushPayload>;
      }>>();

      for (const device of devices) {
        const resolution = this.dependencies.preferenceResolution.resolve(event, device.deviceId, preferences);
        const delivery = resolveNotificationDelivery(event, resolution);
        if (!resolution.shouldNotify || !delivery.shouldEnqueuePush) {
          await this.recordAttempt({
            event,
            device,
            resolution,
            deliveryLevel: delivery.deliveryLevel,
            status: "skipped",
            reason: resolution.shouldNotify ? "push_not_enqueued" : resolution.reason,
            now
          });
          totals.skipped += 1;
          continue;
        }
        const payload = buildPushPayload({ event, resolution, deliveryLevel: delivery.deliveryLevel });
        const key = JSON.stringify(payload);
        const group = groups.get(key) ?? [];
        group.push({ device, resolution, deliveryLevel: delivery.deliveryLevel, payload });
        groups.set(key, group);
      }

      for (const group of groups.values()) {
        const results = await this.dependencies.pushSender.sendToDevices({
          devices: group.map((item) => item.device),
          payload: group[0].payload
        });
        for (let index = 0; index < group.length; index += 1) {
          const item = group[index];
          const result = await this.handleSendResult({
            event,
            device: item.device,
            resolution: item.resolution,
            deliveryLevel: item.deliveryLevel,
            sendResult: results[index] ?? { status: "transient_failure", reason: "fcm_batch_result_missing" },
            now
          });
          if (result.sent) totals.sent += 1;
          if (result.skipped) totals.skipped += 1;
          if (result.transientFailure) hadTransientFailure = true;
          if (result.retryAfterMs !== undefined) {
            providerRetryAfterMs = Math.max(providerRetryAfterMs ?? 0, result.retryAfterMs);
          }
        }
      }
    } else {

      for (const device of devices) {
        const result = await this.processDevice({ event, device, preferences, job, now });
        if (result.sent) totals.sent += 1;
        if (result.skipped) totals.skipped += 1;
        if (result.transientFailure) hadTransientFailure = true;
        if (result.retryAfterMs !== undefined) {
          providerRetryAfterMs = Math.max(providerRetryAfterMs ?? 0, result.retryAfterMs);
        }
      }
    }

    if (hadTransientFailure) {
      await this.retryOrFailJob(job, "transient_push_failure", now, providerRetryAfterMs);
      totals.queued += 1;
      return;
    }

    await this.dependencies.notificationJobs.complete(job.id);
    totals.completed += 1;
  }

  private async processDevice(input: {
    event: PlatformEvent;
    device: PushTargetDevice;
    preferences: UserNotificationPreference[];
    job: ClaimedNotificationJob;
    now: Date;
  }): Promise<DeviceProcessResult> {
    const resolution = this.dependencies.preferenceResolution.resolve(
      input.event,
      input.device.deviceId,
      input.preferences
    );
    const delivery = resolveNotificationDelivery(input.event, resolution);

    if (!resolution.shouldNotify || !delivery.shouldEnqueuePush) {
      await this.recordAttempt({
        event: input.event,
        device: input.device,
        resolution,
        deliveryLevel: delivery.deliveryLevel,
        status: "skipped",
        reason: resolution.shouldNotify ? "push_not_enqueued" : resolution.reason,
        now: input.now
      });
      return { skipped: true };
    }

    const payload = buildPushPayload({
      event: input.event,
      resolution,
      deliveryLevel: delivery.deliveryLevel
    });
    const sendResult = await this.dependencies.pushSender.sendToDevice({
      device: input.device,
      payload
    });

    return this.handleSendResult({
      event: input.event,
      device: input.device,
      resolution,
      deliveryLevel: delivery.deliveryLevel,
      sendResult,
      now: input.now
    });
  }

  private async handleSendResult(input: {
    event: PlatformEvent;
    device: PushTargetDevice;
    resolution: ResolvedNotificationPreference;
    deliveryLevel: NotificationDeliveryLevel;
    sendResult: PushSendResult;
    now: Date;
  }): Promise<DeviceProcessResult> {
    if (input.sendResult.status === "sent") {
      await this.recordAttempt({
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
      await this.recordAttempt({
        ...input,
        status: "skipped",
        reason: input.sendResult.reason ?? "permanent_token_failure",
        providerErrorCode: input.sendResult.providerErrorCode
      });
      return { skipped: true };
    }

    await this.recordAttempt({
      ...input,
      status: input.sendResult.status === "disabled" ? "queued" : "failed",
      reason: input.sendResult.reason ?? input.sendResult.status,
      providerErrorCode: input.sendResult.providerErrorCode
    });

    return input.sendResult.status === "transient_failure"
      ? { transientFailure: true, retryAfterMs: input.sendResult.retryAfterMs }
      : { skipped: true };
  }

  private async recordAttempt(input: {
    event: PlatformEvent;
    device: PushTargetDevice;
    resolution: ResolvedNotificationPreference;
    deliveryLevel: NotificationDeliveryLevel;
    status: "queued" | "sent" | "failed" | "skipped";
    reason: string;
    now: Date;
    providerMessageId?: string;
    providerErrorCode?: string;
  }): Promise<void> {
    await this.dependencies.deliveryAttempts.create({
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
      retryCount: 0,
      tapActionUsed: input.resolution.tapAction,
      title: input.event.title,
      body: input.event.body
    });
  }

  private async retryOrFailJob(job: ClaimedNotificationJob, reason: string, now: Date, retryAfterMs?: number): Promise<void> {
    const nextRun = retryAt(job.attempts, now, retryAfterMs, this.dependencies.random);
    const input: FailNotificationJobInput = {
      jobId: job.id,
      attempts: job.attempts,
      reason,
      terminal: nextRun === undefined,
      retryAt: nextRun
    };
    await this.dependencies.notificationJobs.fail(input);
  }
}

export default NotificationWorker;
