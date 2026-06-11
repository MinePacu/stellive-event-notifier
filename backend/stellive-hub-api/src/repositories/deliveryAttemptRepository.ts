import type { DeliveryAttemptDiagnostic, DeliveryAttemptSummary } from "../admin/adminTypes.js";
import { getPrismaClient } from "../storage/prisma.js";

interface DeliveryAttemptRecord {
  id: string;
  eventId: string;
  attemptedAt: Date;
  deliveredAt: Date | null;
  status: string;
  reason: string | null;
  source: string;
  eventType: string;
  generationId: string;
  memberId: string;
  deliveryMode: string;
  deliveryLevel: string | null;
  pushPriority: string;
  providerErrorCode: string | null;
}

interface DeliveryAttemptStatusRecord {
  status: string;
}

interface DeliveryAttemptDiagnosticSelect {
  id: true;
  eventId: true;
  attemptedAt: true;
  deliveredAt: true;
  status: true;
  reason: true;
  source: true;
  eventType: true;
  generationId: true;
  memberId: true;
  deliveryMode: true;
  deliveryLevel: true;
  pushPriority: true;
  providerErrorCode: true;
}

interface DeliveryAttemptDelegate {
  deliveryAttempt: {
    findMany(args: {
      orderBy: { attemptedAt: "desc" };
      take: number;
      select: DeliveryAttemptDiagnosticSelect;
    }): Promise<DeliveryAttemptRecord[]>;
    findMany(args: {
      orderBy: { attemptedAt: "desc" };
      take: number;
      select: { status: true };
    }): Promise<DeliveryAttemptStatusRecord[]>;
  };
}

const deliveryAttemptDiagnosticSelect: DeliveryAttemptDiagnosticSelect = {
  id: true,
  eventId: true,
  attemptedAt: true,
  deliveredAt: true,
  status: true,
  reason: true,
  source: true,
  eventType: true,
  generationId: true,
  memberId: true,
  deliveryMode: true,
  deliveryLevel: true,
  pushPriority: true,
  providerErrorCode: true
};

function clampDiagnosticLimit(limit: number, defaultLimit: number): number {
  if (!Number.isFinite(limit)) return defaultLimit;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function toDiagnostic(record: DeliveryAttemptRecord): DeliveryAttemptDiagnostic {
  return {
    id: record.id,
    eventId: record.eventId,
    attemptedAt: record.attemptedAt.toISOString(),
    deliveredAt: record.deliveredAt?.toISOString(),
    status: record.status,
    reason: record.reason ?? undefined,
    source: record.source,
    eventType: record.eventType,
    generationId: record.generationId,
    memberId: record.memberId,
    deliveryMode: record.deliveryMode,
    deliveryLevel: record.deliveryLevel ?? undefined,
    pushPriority: record.pushPriority,
    providerErrorCode: record.providerErrorCode ?? undefined
  };
}

function emptySummary(): DeliveryAttemptSummary {
  return {
    sent: 0,
    queued: 0,
    skipped: 0,
    failed: 0
  };
}

export class DeliveryAttemptRepository {
  constructor(private readonly prisma: DeliveryAttemptDelegate = getPrismaClient() as unknown as DeliveryAttemptDelegate) {}

  async listRecent(limit = 25): Promise<DeliveryAttemptDiagnostic[]> {
    const records = await this.prisma.deliveryAttempt.findMany({
      orderBy: { attemptedAt: "desc" },
      take: clampDiagnosticLimit(limit, 25),
      select: deliveryAttemptDiagnosticSelect
    });

    return records.map(toDiagnostic);
  }

  async summarizeRecent(limit = 100): Promise<DeliveryAttemptSummary> {
    const records = await this.prisma.deliveryAttempt.findMany({
      orderBy: { attemptedAt: "desc" },
      take: clampDiagnosticLimit(limit, 100),
      select: { status: true }
    });
    const summary = emptySummary();

    for (const record of records) {
      if (record.status === "sent" || record.status === "queued" || record.status === "skipped" || record.status === "failed") {
        summary[record.status] += 1;
      }
    }

    return summary;
  }
}
