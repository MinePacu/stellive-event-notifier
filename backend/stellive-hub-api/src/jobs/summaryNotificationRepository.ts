import { summaryTopicKey, summaryWindow } from "../notification/summaryNotificationPolicy.js";
import { getPrismaClient } from "../storage/prisma.js";
import type { PlatformEvent } from "../types.js";

export interface EnqueueSummaryNotificationInput {
  event: PlatformEvent;
  deviceId: string;
  evaluatedAt: Date;
}

export interface SummaryNotificationItem {
  id: string;
  bucketId: string;
  deviceId: string;
  eventId: string;
  status: string;
  reason?: string | null;
  createdAt: Date;
}

export interface ClaimedSummaryNotificationBucket {
  id: string;
  deviceId: string;
  topicKey: string;
  windowStart: Date;
  deliverAfter: Date;
  attempts: number;
  lockedAt: Date;
  lockedBy: string;
  items: SummaryNotificationItem[];
}

export interface SummaryNotificationDiagnostic {
  id: string;
  deviceId: string;
  topicKey: string;
  windowStart: string;
  deliverAfter: string;
  status: string;
  attempts: number;
  lockedAt?: string;
  lastError?: string;
  itemCount: number;
}

export interface SummaryNotificationStatus {
  queued: number;
  locked: number;
  completed: number;
  skipped: number;
  failed: number;
  oldestDueAt?: string;
}

interface SummaryBucketRecord {
  id: string;
  deviceId: string;
  topicKey: string;
  windowStart: Date;
  deliverAfter: Date;
  status: string;
  attempts: number;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  items: SummaryNotificationItem[];
  _count?: { items: number };
}

interface SummaryPrismaDelegate {
  $transaction?<T>(operation: (transaction: SummaryPrismaDelegate) => Promise<T>): Promise<T>;
  notificationSummaryBucket: {
    upsert?(args: unknown): Promise<SummaryBucketRecord>;
    findUnique?(args: unknown): Promise<SummaryBucketRecord | null>;
    findMany?(args: unknown): Promise<SummaryBucketRecord[]>;
    findFirst?(args: unknown): Promise<{ deliverAfter: Date } | null>;
    update?(args: unknown): Promise<unknown>;
    updateMany?(args: unknown): Promise<{ count: number }>;
    groupBy?(args: unknown): Promise<Array<{ status: string; _count: { status: number } }>>;
  };
  notificationSummaryItem: {
    create?(args: unknown): Promise<SummaryNotificationItem>;
    findUnique?(args: unknown): Promise<(SummaryNotificationItem & { bucket?: SummaryBucketRecord }) | null>;
    updateMany?(args: unknown): Promise<{ count: number }>;
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function clampLimit(limit: number | undefined, fallback = 25): number {
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.trunc(limit ?? fallback), 1), 100);
}

function claimableWhere(now: Date, staleAt: Date): Record<string, unknown> {
  return {
    OR: [
      { status: "queued", deliverAfter: { lte: now } },
      { status: "locked", lockedAt: { lte: staleAt } }
    ]
  };
}

export class SummaryNotificationRepository {
  constructor(private readonly prisma: SummaryPrismaDelegate = getPrismaClient() as unknown as SummaryPrismaDelegate) {}

  async enqueue(input: EnqueueSummaryNotificationInput): Promise<{ bucketId: string; topicKey: string; created: boolean }> {
    if (!this.prisma.$transaction) throw new Error("summary_notification_transaction_unavailable");
    const topicKey = summaryTopicKey(input.event);
    const { windowStart, deliverAfter } = summaryWindow(input.evaluatedAt);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (!transaction.notificationSummaryBucket.upsert || !transaction.notificationSummaryItem.create) {
          throw new Error("summary_notification_enqueue_unavailable");
        }
        const bucket = await transaction.notificationSummaryBucket.upsert({
          where: { deviceId_topicKey_windowStart: { deviceId: input.deviceId, topicKey, windowStart } },
          create: {
            deviceId: input.deviceId,
            topicKey,
            windowStart,
            deliverAfter,
            status: "queued"
          },
          update: {}
        });
        await transaction.notificationSummaryItem.create({
          data: {
            bucketId: bucket.id,
            deviceId: input.deviceId,
            eventId: input.event.id,
            status: "queued",
            reason: "summary_queued"
          }
        });
        return { bucketId: bucket.id, topicKey, created: true };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error) || !this.prisma.notificationSummaryItem.findUnique) throw error;
      const existing = await this.prisma.notificationSummaryItem.findUnique({
        where: { deviceId_eventId: { deviceId: input.deviceId, eventId: input.event.id } },
        include: { bucket: true }
      });
      if (!existing?.bucket) throw error;
      return { bucketId: existing.bucket.id, topicKey: existing.bucket.topicKey, created: false };
    }
  }

  async claimReady(input: {
    limit?: number;
    lockedBy: string;
    now: Date;
    staleLockMs?: number;
  }): Promise<ClaimedSummaryNotificationBucket[]> {
    if (!this.prisma.notificationSummaryBucket.findMany || !this.prisma.notificationSummaryBucket.updateMany) {
      throw new Error("summary_notification_claim_unavailable");
    }
    const staleAt = new Date(input.now.getTime() - Math.max(0, input.staleLockMs ?? 5 * 60_000));
    const where = claimableWhere(input.now, staleAt);
    const candidates = await this.prisma.notificationSummaryBucket.findMany({
      where,
      orderBy: [{ deliverAfter: "asc" }, { createdAt: "asc" }],
      take: clampLimit(input.limit),
      include: { items: { where: { status: "queued" }, orderBy: { createdAt: "asc" } } }
    });
    const claimed: ClaimedSummaryNotificationBucket[] = [];
    for (const candidate of candidates) {
      const result = await this.prisma.notificationSummaryBucket.updateMany({
        where: { id: candidate.id, ...where },
        data: { status: "locked", lockedAt: input.now, lockedBy: input.lockedBy }
      });
      if (result.count !== 1) continue;
      claimed.push({ ...candidate, lockedAt: input.now, lockedBy: input.lockedBy });
    }
    return claimed;
  }

  async complete(input: {
    bucketId: string;
    sentEventIds: string[];
    skippedEventIds: string[];
    providerMessageId?: string;
    completedAt: Date;
  }): Promise<void> {
    if (!this.prisma.$transaction) throw new Error("summary_notification_transaction_unavailable");
    await this.prisma.$transaction(async (transaction) => {
      if (!transaction.notificationSummaryBucket.update || !transaction.notificationSummaryItem.updateMany) {
        throw new Error("summary_notification_complete_unavailable");
      }
      if (input.sentEventIds.length > 0) {
        await transaction.notificationSummaryItem.updateMany({
          where: { bucketId: input.bucketId, eventId: { in: input.sentEventIds } },
          data: { status: "sent", reason: "summary_sent" }
        });
      }
      if (input.skippedEventIds.length > 0) {
        await transaction.notificationSummaryItem.updateMany({
          where: { bucketId: input.bucketId, eventId: { in: input.skippedEventIds } },
          data: { status: "skipped", reason: "summary_revalidation_blocked" }
        });
      }
      await transaction.notificationSummaryBucket.update({
        where: { id: input.bucketId },
        data: {
          status: "completed",
          lockedAt: null,
          lockedBy: null,
          providerMessageId: input.providerMessageId,
          completedAt: input.completedAt
        }
      });
    });
  }

  async skip(bucketId: string, reason: string, now: Date): Promise<void> {
    if (!this.prisma.$transaction) throw new Error("summary_notification_transaction_unavailable");
    await this.prisma.$transaction(async (transaction) => {
      if (!transaction.notificationSummaryBucket.update || !transaction.notificationSummaryItem.updateMany) {
        throw new Error("summary_notification_complete_unavailable");
      }
      await transaction.notificationSummaryItem.updateMany({ where: { bucketId }, data: { status: "skipped", reason } });
      await transaction.notificationSummaryBucket.update({
        where: { id: bucketId },
        data: { status: "skipped", lockedAt: null, lockedBy: null, lastError: reason, completedAt: now }
      });
    });
  }

  async fail(input: { bucketId: string; reason: string; retryAt?: Date; terminal: boolean }): Promise<void> {
    if (!this.prisma.$transaction) throw new Error("summary_notification_transaction_unavailable");
    await this.prisma.$transaction(async (transaction) => {
      if (!transaction.notificationSummaryBucket.update || !transaction.notificationSummaryItem.updateMany) {
        throw new Error("summary_notification_update_unavailable");
      }
      await transaction.notificationSummaryItem.updateMany({
        where: { bucketId: input.bucketId, status: "queued" },
        data: { ...(input.terminal ? { status: "failed" } : {}), reason: input.reason }
      });
      await transaction.notificationSummaryBucket.update({
        where: { id: input.bucketId },
        data: {
          status: input.terminal ? "failed" : "queued",
          lockedAt: null,
          lockedBy: null,
          attempts: { increment: 1 },
          lastError: input.reason,
          ...(input.terminal ? {} : { deliverAfter: input.retryAt })
        }
      });
    });
  }

  async summarize(now = new Date()): Promise<SummaryNotificationStatus> {
    if (!this.prisma.notificationSummaryBucket.groupBy || !this.prisma.notificationSummaryBucket.findFirst) {
      return { queued: 0, locked: 0, completed: 0, skipped: 0, failed: 0 };
    }
    const [counts, oldest] = await Promise.all([
      this.prisma.notificationSummaryBucket.groupBy({ by: ["status"], _count: { status: true } }),
      this.prisma.notificationSummaryBucket.findFirst({
        where: { status: "queued", deliverAfter: { lte: now } },
        orderBy: { deliverAfter: "asc" },
        select: { deliverAfter: true }
      })
    ]);
    const byStatus = new Map(counts.map((entry) => [entry.status, entry._count.status]));
    return {
      queued: byStatus.get("queued") ?? 0,
      locked: byStatus.get("locked") ?? 0,
      completed: byStatus.get("completed") ?? 0,
      skipped: byStatus.get("skipped") ?? 0,
      failed: byStatus.get("failed") ?? 0,
      oldestDueAt: oldest?.deliverAfter.toISOString()
    };
  }

  async listDiagnostics(limit = 25): Promise<SummaryNotificationDiagnostic[]> {
    if (!this.prisma.notificationSummaryBucket.findMany) throw new Error("summary_notification_diagnostics_unavailable");
    const records = await this.prisma.notificationSummaryBucket.findMany({
      orderBy: { createdAt: "desc" },
      take: clampLimit(limit),
      include: { _count: { select: { items: true } } }
    });
    return records.map((record) => ({
      id: record.id,
      deviceId: record.deviceId,
      topicKey: record.topicKey,
      windowStart: record.windowStart.toISOString(),
      deliverAfter: record.deliverAfter.toISOString(),
      status: record.status,
      attempts: record.attempts,
      lockedAt: record.lockedAt?.toISOString(),
      lastError: record.lastError ?? undefined,
      itemCount: record._count?.items ?? record.items?.length ?? 0
    }));
  }
}

export default SummaryNotificationRepository;
