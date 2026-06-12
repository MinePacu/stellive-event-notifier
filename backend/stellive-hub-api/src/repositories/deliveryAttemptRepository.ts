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
    create?(args: { data: Record<string, unknown> }): Promise<unknown>;
    findMany?(args: unknown): Promise<Array<DeliveryAttemptRecord | DeliveryAttemptStatusRecord>>;
  };
}

export interface CreateDeliveryAttemptInput {
  eventId: string;
  deviceId: string;
  attemptedAt: Date;
  deliveredAt?: Date;
  status: "queued" | "sent" | "failed" | "skipped";
  reason?: string;
  source: string;
  eventType: string;
  generationId: string;
  memberId: string;
  deliveryMode: string;
  deliveryLevel: string;
  pushPriority: "normal" | "high";
  providerMessageId?: string;
  providerErrorCode?: string;
  retryCount?: number;
  expiresAt?: Date;
  tapActionUsed?: string;
  title?: string;
  body?: string;
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

function toIso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

function toDiagnostic(record: DeliveryAttemptRecord): DeliveryAttemptDiagnostic {
  return {
    id: record.id,
    eventId: record.eventId,
    attemptedAt: record.attemptedAt.toISOString(),
    deliveredAt: toIso(record.deliveredAt),
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
  return { sent: 0, queued: 0, skipped: 0, failed: 0 };
}

function isDiagnosticRecord(record: DeliveryAttemptRecord | DeliveryAttemptStatusRecord): record is DeliveryAttemptRecord {
  return "eventId" in record;
}

export class DeliveryAttemptRepository {
  constructor(private readonly prisma: DeliveryAttemptDelegate = getPrismaClient() as unknown as DeliveryAttemptDelegate) {}

  async create(input: CreateDeliveryAttemptInput): Promise<void> {
    if (!this.prisma.deliveryAttempt.create) throw new Error("delivery_attempt_create_unavailable");
    await this.prisma.deliveryAttempt.create({
      data: {
        eventId: input.eventId,
        deviceId: input.deviceId,
        attemptedAt: input.attemptedAt,
        deliveredAt: input.deliveredAt,
        status: input.status,
        reason: input.reason,
        tapActionUsed: input.tapActionUsed ?? "open_app",
        title: input.title ?? "",
        body: input.body ?? "",
        source: input.source,
        eventType: input.eventType,
        generationId: input.generationId,
        memberId: input.memberId,
        deliveryMode: input.deliveryMode,
        deliveryLevel: input.deliveryLevel,
        pushPriority: input.pushPriority,
        providerMessageId: input.providerMessageId,
        providerErrorCode: input.providerErrorCode,
        retryCount: input.retryCount,
        expiresAt: input.expiresAt
      }
    });
  }

  async listRecent(limit = 25): Promise<DeliveryAttemptDiagnostic[]> {
    if (!this.prisma.deliveryAttempt.findMany) throw new Error("delivery_attempt_diagnostics_unavailable");
    const records = await this.prisma.deliveryAttempt.findMany({
      orderBy: { attemptedAt: "desc" },
      take: clampDiagnosticLimit(limit, 25),
      select: deliveryAttemptDiagnosticSelect
    });
    return records.filter(isDiagnosticRecord).map(toDiagnostic);
  }

  async summarizeRecent(limit = 100): Promise<DeliveryAttemptSummary> {
    if (!this.prisma.deliveryAttempt.findMany) return emptySummary();
    const records = await this.prisma.deliveryAttempt.findMany({
      orderBy: { attemptedAt: "desc" },
      take: clampDiagnosticLimit(limit, 100),
      select: { status: true }
    });
    const summary = emptySummary();
    for (const record of records) {
      const status = record.status;
      if (status === "sent" || status === "queued" || status === "skipped" || status === "failed") {
        summary[status] += 1;
      }
    }
    return summary;
  }
}

export default DeliveryAttemptRepository;
