import type { NotificationJobDiagnostic, NotificationJobSummary } from "../admin/adminTypes.js";
import { getPrismaClient } from "../storage/prisma.js";

interface NotificationJobRecord {
  id: string;
  eventId: string;
  priority: number;
  status: string;
  runAfter: Date;
  lockedAt: Date | null;
  lockedBy?: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationJobDiagnosticSelect {
  id: true;
  eventId: true;
  priority: true;
  status: true;
  runAfter: true;
  lockedAt: true;
  attempts: true;
  lastError: true;
  createdAt: true;
  updatedAt: true;
}

interface NotificationJobDelegate {
  $queryRawUnsafe?(query: string): Promise<unknown[]>;
  notificationJob: {
    create?(args: { data: { eventId: string; priority: number; status: string; runAfter?: Date } }): Promise<unknown>;
    createMany?(args: {
      data: { eventId: string; priority: number; status: string; runAfter?: Date };
      skipDuplicates: boolean;
    }): Promise<{ count: number }>;
    groupBy?(args: {
      by: ["status"];
      _count: { status: true };
    }): Promise<Array<{ status: string; _count: { status: number } }>>;
    findFirst?(args: {
      where: { status: string };
      orderBy: { runAfter: "asc" };
      select: { runAfter: true };
    }): Promise<{ runAfter: Date } | null>;
    findMany?(args: unknown): Promise<NotificationJobRecord[]>;
    updateMany?(args: unknown): Promise<{ count: number }>;
    update?(args: unknown): Promise<unknown>;
  };
}

export interface EnqueueNotificationJobInput {
  eventId: string;
  priority: number;
  runAfter?: Date;
}

export interface ClaimedNotificationJob {
  id: string;
  eventId: string;
  priority: number;
  attempts: number;
  runAfter: Date;
  lockedAt: Date;
  lockedBy: string;
}

export interface ClaimNotificationJobsInput {
  limit: number;
  lockedBy: string;
  now: Date;
  staleLockMs?: number;
}

export interface FailNotificationJobInput {
  jobId: string;
  lockedBy: string;
  attempts: number;
  reason: string;
  retryAt?: Date;
  terminal: boolean;
}

export interface CompleteNotificationJobInput {
  jobId: string;
  lockedBy: string;
}

export interface RenewNotificationJobLockInput {
  jobId: string;
  lockedBy: string;
  now: Date;
}

const notificationJobDiagnosticSelect: NotificationJobDiagnosticSelect = {
  id: true,
  eventId: true,
  priority: true,
  status: true,
  runAfter: true,
  lockedAt: true,
  attempts: true,
  lastError: true,
  createdAt: true,
  updatedAt: true
};

function clampLimit(limit: number, defaultLimit: number): number {
  if (!Number.isFinite(limit)) return defaultLimit;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function toIso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

function toDiagnostic(record: NotificationJobRecord): NotificationJobDiagnostic {
  return {
    id: record.id,
    eventId: record.eventId,
    priority: record.priority,
    status: record.status,
    runAfter: record.runAfter.toISOString(),
    lockedAt: toIso(record.lockedAt),
    attempts: record.attempts,
    lastError: record.lastError ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toClaimed(record: NotificationJobRecord, lockedAt: Date, lockedBy: string): ClaimedNotificationJob {
  return {
    id: record.id,
    eventId: record.eventId,
    priority: record.priority,
    attempts: record.attempts,
    runAfter: record.runAfter,
    lockedAt,
    lockedBy
  };
}

function claimableWhere(now: Date, staleAt: Date): Record<string, unknown> {
  return {
    OR: [
      { status: "queued", runAfter: { lte: now } },
      { status: "locked", lockedAt: { lte: staleAt } }
    ]
  };
}

export class NotificationJobRepository {
  constructor(private readonly prisma: NotificationJobDelegate = getPrismaClient() as unknown as NotificationJobDelegate) {}

  async enqueue(input: EnqueueNotificationJobInput): Promise<{ created: boolean }> {
    const data = {
      eventId: input.eventId,
      priority: input.priority,
      status: "queued",
      runAfter: input.runAfter
    };
    if (!this.prisma.notificationJob.createMany) throw new Error("notification_job_enqueue_unavailable");
    const result = await this.prisma.notificationJob.createMany({ data, skipDuplicates: true });
    return { created: result.count === 1 };
  }

  async claimReady(input: ClaimNotificationJobsInput): Promise<ClaimedNotificationJob[]> {
    if (!this.prisma.notificationJob.findMany || !this.prisma.notificationJob.updateMany) {
      throw new Error("notification_job_claim_unavailable");
    }
    const limit = clampLimit(input.limit, 25);
    const staleAt = new Date(input.now.getTime() - Math.max(0, input.staleLockMs ?? 5 * 60_000));
    const where = claimableWhere(input.now, staleAt);
    const records = await this.prisma.notificationJob.findMany({
      where,
      orderBy: [{ priority: "asc" }, { runAfter: "asc" }, { createdAt: "asc" }],
      take: limit
    });
    if (records.length === 0) return [];

    const claimed: ClaimedNotificationJob[] = [];
    for (const record of records) {
      const updated = await this.prisma.notificationJob.updateMany({
        where: { id: record.id, ...where },
        data: { status: "locked", lockedAt: input.now, lockedBy: input.lockedBy }
      });
      if (updated.count !== 1) continue;
      claimed.push(toClaimed(record, input.now, input.lockedBy));
    }
    return claimed;
  }

  async renewLock(input: RenewNotificationJobLockInput): Promise<boolean> {
    if (!this.prisma.notificationJob.updateMany) throw new Error("notification_job_update_unavailable");
    const updated = await this.prisma.notificationJob.updateMany({
      where: { id: input.jobId, status: "locked", lockedBy: input.lockedBy },
      data: { lockedAt: input.now }
    });
    return updated.count === 1;
  }

  async complete(input: CompleteNotificationJobInput): Promise<boolean> {
    if (!this.prisma.notificationJob.updateMany) throw new Error("notification_job_update_unavailable");
    const updated = await this.prisma.notificationJob.updateMany({
      where: { id: input.jobId, status: "locked", lockedBy: input.lockedBy },
      data: { status: "completed", lockedAt: null, lockedBy: null }
    });
    return updated.count === 1;
  }

  async fail(input: FailNotificationJobInput): Promise<boolean> {
    if (!this.prisma.notificationJob.updateMany) throw new Error("notification_job_update_unavailable");
    const data: Record<string, unknown> = {
      status: input.terminal ? "failed" : "queued",
      lockedAt: null,
      lockedBy: null,
      attempts: { increment: 1 },
      lastError: input.reason
    };
    if (!input.terminal) data.runAfter = input.retryAt;
    const updated = await this.prisma.notificationJob.updateMany({
      where: { id: input.jobId, status: "locked", lockedBy: input.lockedBy },
      data
    });
    return updated.count === 1;
  }

  async summarize(): Promise<NotificationJobSummary> {
    if (!this.prisma.notificationJob.groupBy || !this.prisma.notificationJob.findFirst) {
      return { queued: 0, locked: 0, completed: 0, failed: 0, missingJobCount: 0 };
    }
    const [counts, oldestQueued, orphanRows] = await Promise.all([
      this.prisma.notificationJob.groupBy({ by: ["status"], _count: { status: true } }),
      this.prisma.notificationJob.findFirst({
        where: { status: "queued" },
        orderBy: { runAfter: "asc" },
        select: { runAfter: true }
      }),
      this.readOrphanSummary()
    ]);
    const byStatus = new Map(counts.map((entry) => [entry.status, entry._count.status]));
    const orphan = orphanRows[0];
    return {
      queued: byStatus.get("queued") ?? 0,
      locked: byStatus.get("locked") ?? 0,
      completed: byStatus.get("completed") ?? 0,
      failed: byStatus.get("failed") ?? 0,
      oldestQueuedAt: oldestQueued?.runAfter.toISOString(),
      missingJobCount: Number(orphan?.missingJobCount ?? 0),
      oldestMissingJobReceivedAt: orphan?.oldestMissingJobReceivedAt?.toISOString()
    };
  }

  private async readOrphanSummary(): Promise<Array<{
    missingJobCount: bigint | number;
    oldestMissingJobReceivedAt: Date | null;
  }>> {
    if (!this.prisma.$queryRawUnsafe) return [];
    return this.prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::bigint AS "missingJobCount",
        MIN(event."receivedAt") AS "oldestMissingJobReceivedAt"
      FROM "PlatformEvent" AS event
      LEFT JOIN "NotificationJob" AS job ON job."eventId" = event."id"
      WHERE job."id" IS NULL
    `) as Promise<Array<{
      missingJobCount: bigint | number;
      oldestMissingJobReceivedAt: Date | null;
    }>>;
  }

  async listDiagnostics(limit = 25): Promise<NotificationJobDiagnostic[]> {
    if (!this.prisma.notificationJob.findMany) throw new Error("notification_job_diagnostics_unavailable");
    const records = await this.prisma.notificationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: clampLimit(limit, 25),
      select: notificationJobDiagnosticSelect
    });
    return records.map(toDiagnostic);
  }
}

export default NotificationJobRepository;
