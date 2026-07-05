import type {
  DailyDeliveryQueuePoint,
  DailyDeliveryQueueTrend,
  DeliveryAttemptDiagnostic,
  DeliveryAttemptSummary
} from "../admin/adminTypes.js";
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

interface DeliveryAttemptTrendRecord {
  attemptedAt: Date;
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
  $queryRaw?<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  deliveryAttempt: {
    create?(args: { data: Record<string, unknown> }): Promise<unknown>;
    findMany?(args: unknown): Promise<Array<DeliveryAttemptRecord | DeliveryAttemptStatusRecord | DeliveryAttemptTrendRecord>>;
  };
}

interface DeliveryAttemptDailyAggregateRow {
  date: string;
  sent: unknown;
  queued: unknown;
  skipped: unknown;
  failed: unknown;
  total: unknown;
}

function aggregateNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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

const deliveryAttemptStatuses = ["sent", "queued", "skipped", "failed"] as const;
type DeliveryAttemptKnownStatus = (typeof deliveryAttemptStatuses)[number];

function isDeliveryAttemptKnownStatus(status: string): status is DeliveryAttemptKnownStatus {
  return deliveryAttemptStatuses.includes(status as DeliveryAttemptKnownStatus);
}

function clampTrendDays(days: number | undefined): number {
  if (!Number.isFinite(days)) return 14;
  return Math.min(Math.max(Math.trunc(days ?? 14), 1), 30);
}

function formatKstDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function kstMidnightUtcFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function createEmptyPoint(date: string): DailyDeliveryQueuePoint {
  return { date, sent: 0, queued: 0, skipped: 0, failed: 0, total: 0 };
}

function buildKstDateKeys(days: number, now: Date): string[] {
  const todayStart = kstMidnightUtcFromKey(formatKstDateKey(now));
  const firstStart = addUtcDays(todayStart, -(days - 1));
  return Array.from({ length: days }, (_, index) => formatKstDateKey(addUtcDays(firstStart, index)));
}

export function emptyDailyDeliveryQueueTrend(days = 14, now = new Date()): DailyDeliveryQueueTrend {
  const normalizedDays = clampTrendDays(days);
  const items = buildKstDateKeys(normalizedDays, now).map(createEmptyPoint);
  return {
    timezone: "Asia/Seoul",
    days: normalizedDays,
    generatedAt: now.toISOString(),
    items,
    totals: { sent: 0, queued: 0, skipped: 0, failed: 0, total: 0 }
  };
}

function isDiagnosticRecord(
  record: DeliveryAttemptRecord | DeliveryAttemptStatusRecord | DeliveryAttemptTrendRecord
): record is DeliveryAttemptRecord {
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

  async summarizeDailyBuckets(input: { days?: number; now?: Date; timezone?: "Asia/Seoul" } = {}): Promise<DailyDeliveryQueueTrend> {
    const days = clampTrendDays(input.days ?? 14);
    const now = input.now ?? new Date();
    if (!this.prisma.$queryRaw) return emptyDailyDeliveryQueueTrend(days, now);

    const dateKeys = buildKstDateKeys(days, now);
    const bucketByDate = new Map(dateKeys.map((date) => [date, createEmptyPoint(date)]));
    const startAt = kstMidnightUtcFromKey(dateKeys[0] ?? formatKstDateKey(now));
    // Prisma stores these UTC values in a PostgreSQL timestamp without time zone column.
    const rows = await this.prisma.$queryRaw<DeliveryAttemptDailyAggregateRow[]>`
      SELECT
        to_char(("attemptedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date,
        count(*) FILTER (WHERE status = 'sent') AS sent,
        count(*) FILTER (WHERE status = 'queued') AS queued,
        count(*) FILTER (WHERE status = 'skipped') AS skipped,
        count(*) FILTER (WHERE status = 'failed') AS failed,
        count(*) AS total
      FROM "DeliveryAttempt"
      WHERE "attemptedAt" >= ${startAt}
        AND "attemptedAt" <= ${now}
        AND status IN ('sent', 'queued', 'skipped', 'failed')
      GROUP BY date
      ORDER BY date ASC
    `;

    for (const row of rows) {
      const point = bucketByDate.get(row.date);
      if (!point) continue;
      point.sent = aggregateNumber(row.sent);
      point.queued = aggregateNumber(row.queued);
      point.skipped = aggregateNumber(row.skipped);
      point.failed = aggregateNumber(row.failed);
      point.total = aggregateNumber(row.total);
    }

    const items = dateKeys.map((date) => bucketByDate.get(date) ?? createEmptyPoint(date));
    const totals = items.reduce(
      (next, item) => ({
        sent: next.sent + item.sent,
        queued: next.queued + item.queued,
        skipped: next.skipped + item.skipped,
        failed: next.failed + item.failed,
        total: next.total + item.total
      }),
      { sent: 0, queued: 0, skipped: 0, failed: 0, total: 0 }
    );

    return {
      timezone: input.timezone ?? "Asia/Seoul",
      days,
      generatedAt: now.toISOString(),
      items,
      totals
    };
  }
}

export default DeliveryAttemptRepository;
