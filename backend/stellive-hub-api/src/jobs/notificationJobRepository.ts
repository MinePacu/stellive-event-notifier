import { getPrismaClient } from "../storage/prisma.js";
import type { NotificationJobDiagnostic, NotificationJobSummary } from "../admin/adminTypes.js";

interface NotificationJobRecord {
  id: string;
  eventId: string;
  priority: number;
  status: string;
  runAfter: Date;
  lockedAt: Date | null;
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
    create(args: { data: { eventId: string; priority: number; status: string } }): Promise<unknown>;
    groupBy?(args: {
      by: ["status"];
      _count: { status: true };
    }): Promise<Array<{ status: string; _count: { status: number } }>>;
    findFirst?(args: {
      where: { status: string };
      orderBy: { runAfter: "asc" };
      select: { runAfter: true };
    }): Promise<{ runAfter: Date } | null>;
    findMany?(args: {
      orderBy: { createdAt: "desc" };
      take: number;
      select: NotificationJobDiagnosticSelect;
    }): Promise<NotificationJobRecord[]>;
  };
}

export interface EnqueueNotificationJobInput {
  eventId: string;
  priority: number;
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

function clampDiagnosticLimit(limit: number, defaultLimit: number): number {
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

export class NotificationJobRepository {
  constructor(private readonly prisma: NotificationJobDelegate = getPrismaClient() as unknown as NotificationJobDelegate) {}

  async enqueue(input: EnqueueNotificationJobInput) {
    return this.prisma.notificationJob.create({
      data: {
        eventId: input.eventId,
        priority: input.priority,
        status: "queued"
      }
    });
  }

  async summarize(): Promise<NotificationJobSummary> {
    if (!this.prisma.notificationJob.groupBy || !this.prisma.notificationJob.findFirst) {
      throw new Error("notification_job_summary_unavailable");
    }

    const grouped = await this.prisma.notificationJob.groupBy({ by: ["status"], _count: { status: true } });
    const oldestQueued = await this.prisma.notificationJob.findFirst({
      where: { status: "queued" },
      orderBy: { runAfter: "asc" },
      select: { runAfter: true }
    });
    const byStatus = new Map(grouped.map((item) => [item.status, item._count.status]));

    return {
      queued: byStatus.get("queued") ?? 0,
      locked: byStatus.get("locked") ?? 0,
      completed: byStatus.get("completed") ?? 0,
      failed: byStatus.get("failed") ?? 0,
      oldestQueuedAt: oldestQueued?.runAfter.toISOString()
    };
  }

  async listDiagnostics(limit = 25): Promise<NotificationJobDiagnostic[]> {
    if (!this.prisma.notificationJob.findMany) {
      throw new Error("notification_job_diagnostics_unavailable");
    }

    const records = await this.prisma.notificationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: clampDiagnosticLimit(limit, 25),
      select: notificationJobDiagnosticSelect
    });

    return records.map(toDiagnostic);
  }
}
