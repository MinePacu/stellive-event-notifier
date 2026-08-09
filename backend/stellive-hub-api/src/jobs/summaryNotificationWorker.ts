import { resolveNotificationDelivery } from "../notification/loadReductionPolicy.js";
import { buildSummaryPushPayload } from "../push/pushPayloadFactory.js";
import type { PushSender, PushTargetDevice } from "../push/pushSender.js";
import type { CreateDeliveryAttemptInput, DeliveryAttemptRepository } from "../repositories/deliveryAttemptRepository.js";
import type DeviceRepository from "../repositories/deviceRepository.js";
import type PlatformEventRepository from "../repositories/platformEventRepository.js";
import type PreferenceRepository from "../repositories/preferenceRepository.js";
import type { PreferenceResolutionService } from "../preferences/preferenceResolution.js";
import type { PlatformEvent, ResolvedNotificationPreference, UserNotificationPreference } from "../types.js";
import type { ClaimedSummaryNotificationBucket, SummaryNotificationRepository } from "./summaryNotificationRepository.js";

export interface SummaryNotificationWorkerDrainResult {
  claimed: number;
  completed: number;
  failed: number;
  skipped: number;
  sent: number;
  queued: number;
  status: "ok" | "disabled" | "partial";
  reason?: string;
}

interface SummaryNotificationWorkerDependencies {
  summaries: Pick<SummaryNotificationRepository, "claimReady" | "complete" | "skip" | "fail">;
  platformEvents: Pick<PlatformEventRepository, "findById">;
  hubEventSchedules?: { isScheduleNotificationCurrent(event: PlatformEvent, now: Date): Promise<boolean> };
  devices: Pick<DeviceRepository, "findPushTarget" | "markTokenInvalid">;
  preferences: Pick<PreferenceRepository, "listForDevice">;
  deliveryAttempts: Pick<DeliveryAttemptRepository, "create" | "countSentByDeviceInWindow" | "listSentDeviceIds">;
  preferenceResolution: Pick<PreferenceResolutionService, "resolve">;
  pushSender: PushSender;
  enabled?: boolean;
  now?: () => Date;
  random?: () => number;
}

const retryDelaysMs = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

function retryAt(attempts: number, now: Date, retryAfterMs?: number, random = () => 0.5): Date | undefined {
  const base = retryDelaysMs[attempts];
  if (base === undefined) return undefined;
  const delay = retryAfterMs ?? Math.round(base * (0.9 + Math.min(Math.max(random(), 0), 1) * 0.2));
  return new Date(now.getTime() + Math.max(0, delay));
}

function emptyResult(claimed: number): SummaryNotificationWorkerDrainResult {
  return { claimed, completed: 0, failed: 0, skipped: 0, sent: 0, queued: 0, status: "ok" };
}

function priority(resolution: ResolvedNotificationPreference): "normal" | "high" {
  return resolution.pushPriority === "high" ? "high" : "normal";
}

export class SummaryNotificationWorker {
  constructor(private readonly dependencies: SummaryNotificationWorkerDependencies) {}

  async drain(input: { limit?: number; lockedBy?: string; now?: Date } = {}): Promise<SummaryNotificationWorkerDrainResult> {
    if (this.dependencies.enabled === false) {
      return { ...emptyResult(0), status: "disabled", reason: "summary_notification_worker_disabled" };
    }
    const now = input.now ?? this.dependencies.now?.() ?? new Date();
    const buckets = await this.dependencies.summaries.claimReady({
      limit: input.limit,
      lockedBy: input.lockedBy ?? `summary-worker-${process.pid}`,
      now,
      staleLockMs: 5 * 60_000
    });
    const totals = emptyResult(buckets.length);
    for (const bucket of buckets) await this.processBucket(bucket, totals, now);
    if (totals.failed > 0 || totals.queued > 0) totals.status = "partial";
    return totals;
  }

  private async processBucket(
    bucket: ClaimedSummaryNotificationBucket,
    totals: SummaryNotificationWorkerDrainResult,
    now: Date
  ): Promise<void> {
    const device = await this.dependencies.devices.findPushTarget(bucket.deviceId);
    if (!device || device.tokenStatus !== "active") {
      await this.dependencies.summaries.skip(bucket.id, "summary_device_unavailable", now);
      totals.skipped += 1;
      totals.completed += 1;
      return;
    }

    const loaded = await Promise.all(bucket.items.map(async (item) => ({ item, event: await this.dependencies.platformEvents.findById(item.eventId) })));
    const preferences = await this.dependencies.preferences.listForDevice(bucket.deviceId) as UserNotificationPreference[];
    const recentCounts = await this.dependencies.deliveryAttempts.countSentByDeviceInWindow({
      deviceIds: [bucket.deviceId],
      since: new Date(now.getTime() - 60_000),
      until: now
    });
    const allowed: Array<{ event: PlatformEvent; resolution: ResolvedNotificationPreference }> = [];
    const skippedEventIds: string[] = [];
    for (const entry of loaded) {
      if (!entry.event) {
        skippedEventIds.push(entry.item.eventId);
        continue;
      }
      if (
        this.dependencies.hubEventSchedules &&
        !(await this.dependencies.hubEventSchedules.isScheduleNotificationCurrent(entry.event, now))
      ) {
        skippedEventIds.push(entry.event.id);
        continue;
      }
      const resolution = this.dependencies.preferenceResolution.resolve(entry.event, bucket.deviceId, preferences, {
        evaluatedAt: now,
        recentNotificationsInLastMinute: recentCounts.get(bucket.deviceId) ?? 0
      });
      const delivery = resolveNotificationDelivery(entry.event, resolution);
      if (!resolution.shouldNotify || delivery.action === "history_only") {
        skippedEventIds.push(entry.event.id);
        continue;
      }
      allowed.push({ event: entry.event, resolution });
    }

    if (allowed.length === 0) {
      await this.dependencies.summaries.skip(bucket.id, "summary_revalidation_blocked", now);
      totals.skipped += 1;
      totals.completed += 1;
      return;
    }

    const representative = [...allowed].sort(
      (left, right) => new Date(right.event.receivedAt).getTime() - new Date(left.event.receivedAt).getTime()
    )[0];
    const checkpointEventId = `summary:${bucket.id}`;
    const sentCheckpoints = await this.dependencies.deliveryAttempts.listSentDeviceIds({
      eventId: checkpointEventId,
      deviceIds: [bucket.deviceId]
    });
    if (sentCheckpoints.has(bucket.deviceId)) {
      await this.dependencies.summaries.complete({
        bucketId: bucket.id,
        sentEventIds: allowed.map((entry) => entry.event.id),
        skippedEventIds,
        completedAt: now
      });
      totals.completed += 1;
      return;
    }
    const payload = buildSummaryPushPayload({
      bucketId: bucket.id,
      topicKey: bucket.topicKey,
      events: allowed.map((entry) => entry.event),
      resolution: representative.resolution
    });
    const result = await this.dependencies.pushSender.sendToDevice({ device, payload });

    if (result.status === "sent") {
      await this.dependencies.deliveryAttempts.create(this.attempt({
        bucket,
        device,
        event: representative.event,
        resolution: representative.resolution,
        now,
        status: "sent",
        reason: "summary_sent",
        providerMessageId: result.providerMessageId,
        providerErrorCode: result.providerErrorCode
      }));
      await this.dependencies.summaries.complete({
        bucketId: bucket.id,
        sentEventIds: allowed.map((entry) => entry.event.id),
        skippedEventIds,
        providerMessageId: result.providerMessageId,
        completedAt: now
      });
      totals.sent += 1;
      totals.completed += 1;
      return;
    }

    if (result.status === "permanent_token_failure") {
      await this.dependencies.devices.markTokenInvalid(
        device.deviceId,
        result.providerErrorCode ?? result.reason ?? "permanent_token_failure"
      );
      await this.dependencies.summaries.skip(bucket.id, result.reason ?? "permanent_token_failure", now);
      await this.dependencies.deliveryAttempts.create(this.attempt({
        bucket,
        device,
        event: representative.event,
        resolution: representative.resolution,
        now,
        status: "skipped",
        reason: result.reason ?? "permanent_token_failure",
        providerErrorCode: result.providerErrorCode
      }));
      totals.skipped += 1;
      totals.completed += 1;
      return;
    }

    const nextRun = retryAt(bucket.attempts, now, result.retryAfterMs, this.dependencies.random);
    const terminal = nextRun === undefined;
    await this.dependencies.summaries.fail({
      bucketId: bucket.id,
      reason: result.reason ?? result.status,
      retryAt: nextRun,
      terminal
    });
    await this.dependencies.deliveryAttempts.create(this.attempt({
      bucket,
      device,
      event: representative.event,
      resolution: representative.resolution,
      now,
      status: terminal ? "failed" : "queued",
      reason: result.reason ?? result.status,
      providerErrorCode: result.providerErrorCode
    }));
    if (terminal) totals.failed += 1;
    else totals.queued += 1;
  }

  private attempt(input: {
    bucket: ClaimedSummaryNotificationBucket;
    device: PushTargetDevice;
    event: PlatformEvent;
    resolution: ResolvedNotificationPreference;
    now: Date;
    status: "queued" | "sent" | "failed" | "skipped";
    reason: string;
    providerMessageId?: string;
    providerErrorCode?: string;
  }): CreateDeliveryAttemptInput {
    return {
      eventId: `summary:${input.bucket.id}`,
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
      deliveryLevel: "summary_push",
      pushPriority: priority(input.resolution),
      providerMessageId: input.providerMessageId,
      providerErrorCode: input.providerErrorCode,
      retryCount: input.bucket.attempts,
      tapActionUsed: input.resolution.tapAction,
      title: input.event.title,
      body: input.event.body
    };
  }
}

export default SummaryNotificationWorker;
