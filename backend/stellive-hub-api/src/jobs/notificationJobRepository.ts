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
  notificationJob: {
    create?(args: { data: { eventId: string; priority: number; status: string } }): Promise<unknown>;
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
}

export interface FailNotificationJobInput {
  jobId: string;
  attempts: number;
  reason: string;
  retryAt?: Date;
  terminal: boolean;
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

export class NotificationJobRepository {
  constructor(private readonly prisma: NotificationJobDelegate = getPrismaClient() as unknown as NotificationJobDelegate) {}

  async enqueue(input: EnqueueNotificationJobInput): Promise<unknown> {
    if (!this.prisma.notificationJob.create) throw new Error("notification_job_enqueue_unavailable");
    return this.prisma.notificationJob.create({
      data: {
        eventId: input.eventId,
        priority: input.priority,
        status: "queued"
      }
    });
  }

  async claimReady(input: ClaimNotificationJobsInput): Promise<ClaimedNotificationJob[]> {
    if (!this.prisma.notificationJob.findMany || !this.prisma.notificationJob.updateMany) {
      throw new Error("notification_job_claim_unavailable");
    }
    const limit = clampLimit(input.limit, 25);
    const records = await this.prisma.notificationJob.findMany({
      where: { status: "queued", runAfter: { lte: input.now } },
      orderBy: [{ priority: "asc" }, { runAfter: "asc" }, { createdAt: "asc" }],
      take: limit
    });
    if (records.length === 0) return [];

    const ids = records.map((record) => record.id);
    const updated = await this.prisma.notificationJob.updateMany({
      where: { id: { in: ids }, status: "queued" },
      data: { status: "locked", lockedAt: input.now, lockedBy: input.lockedBy }
    });
    if (updated.count !== records.length) return [];

    return records.map((record) => toClaimed(record, input.now, input.lockedBy));
  }

  async complete(jobId: string): Promise<void> {
    if (!this.prisma.notificationJob.update) throw new Error("notification_job_update_unavailable");
    await this.prisma.notificationJob.update({
      where: { id: jobId },
      data: { status: "completed", lockedAt: null, lockedBy: null }
    });
  }

  async fail(input: FailNotificationJobInput): Promise<void> {
    if (!this.prisma.notificationJob.update) throw new Error("notification_job_update_unavailable");
    const data: Record<string, unknown> = {
      status: input.terminal ? "failed" : "queued",
      lockedAt: null,
      lockedBy: null,
      attempts: { increment: 1 },
      lastError: input.reason
    };
    if (!input.terminal) data.runAfter = input.retryAt;
    await this.prisma.notificationJob.update({
      where: { id: input.jobId },
      data
    });
  }

  async summarize(): Promise<NotificationJobSummary> {
    if (!this.prisma.notificationJob.groupBy || !this.prisma.notificationJob.findFirst) {
      return { queued: 0, locked: 0, completed: 0, failed: 0 };
    }
    const [counts, oldestQueued] = await Promise.all([
      this.prisma.notificationJob.groupBy({ by: ["status"], _count: { status: true } }),
      this.prisma.notificationJob.findFirst({
        where: { status: "queued" },
        orderBy: { runAfter: "asc" },
        select: { runAfter: true }
      })
    ]);
    const byStatus = new Map(counts.map((entry) => [entry.status, entry._count.status]));
    return {
      queued: byStatus.get("queued") ?? 0,
      locked: byStatus.get("locked") ?? 0,
      completed: byStatus.get("completed") ?? 0,
      failed: byStatus.get("failed") ?? 0,
      oldestQueuedAt: oldestQueued?.runAfter.toISOString()
    };
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
