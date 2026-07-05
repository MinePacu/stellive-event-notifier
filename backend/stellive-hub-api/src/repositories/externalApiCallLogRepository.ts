import type {
  ExternalApiCallListResult,
  ExternalApiCallRecentItem,
  ExternalApiCallResultStatus,
  ExternalApiCallTrend
} from "../admin/adminTypes.js";
import { getPrismaClient } from "../storage/prisma.js";

export interface RecordExternalApiCallInput {
  source: string;
  operation: string;
  method: string;
  url: string;
  statusCode?: number;
  resultStatus: ExternalApiCallResultStatus;
  durationMs?: number;
  quotaUnits?: number;
  rateLimited?: boolean;
  errorCode?: string;
  errorReason?: string;
  requestedAt: Date;
  completedAt?: Date;
}

interface ExternalApiCallLogRecord {
  id: string;
  source: string;
  operation: string;
  method: string;
  host: string;
  path: string;
  statusCode: number | null;
  resultStatus: string;
  durationMs: number | null;
  quotaUnits: number;
  rateLimited: boolean;
  errorCode: string | null;
  errorReason: string | null;
  requestedAt: Date;
  completedAt: Date | null;
}

interface ExternalApiCallLogDelegate {
  $queryRaw?<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  externalApiCallLog: {
    create?(args: { data: Record<string, unknown> }): Promise<unknown>;
    findMany?(args: unknown): Promise<ExternalApiCallLogRecord[]>;
    deleteMany?(args: unknown): Promise<{ count: number }>;
  };
}

interface ExternalApiDailyAggregateRow {
  date: string;
  source: string;
  total: unknown;
  ok: unknown;
  failed: unknown;
  rateLimited: unknown;
  quotaExceeded: unknown;
  quotaUnits: unknown;
}

function aggregateNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

const trackedResultStatuses = ["ok", "not_modified", "quota_exceeded", "rate_limited", "auth_required", "http_error", "network_error", "timeout", "parse_error", "unknown_error"];

function clampDays(days: number | undefined, defaultDays: number): number {
  if (!Number.isFinite(days)) return defaultDays;
  return Math.min(Math.max(Math.trunc(days ?? defaultDays), 1), 31);
}

function clampLimit(limit: number | undefined, defaultLimit: number): number {
  if (!Number.isFinite(limit)) return defaultLimit;
  return Math.min(Math.max(Math.trunc(limit ?? defaultLimit), 1), 100);
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

function buildKstDateKeys(days: number, now: Date): string[] {
  const todayStart = kstMidnightUtcFromKey(formatKstDateKey(now));
  const firstStart = addUtcDays(todayStart, -(days - 1));
  return Array.from({ length: days }, (_, index) => formatKstDateKey(addUtcDays(firstStart, index)));
}

function createEmptyPoint(date: string) {
  return {
    date,
    total: 0,
    ok: 0,
    failed: 0,
    rateLimited: 0,
    quotaExceeded: 0,
    quotaUnits: 0,
    bySource: {} as Record<string, number>
  };
}

export function emptyExternalApiCallTrend(days = 14, now = new Date()): ExternalApiCallTrend {
  const normalizedDays = clampDays(days, 14);
  const items = buildKstDateKeys(normalizedDays, now).map(createEmptyPoint);
  return {
    timezone: "Asia/Seoul",
    days: normalizedDays,
    generatedAt: now.toISOString(),
    items,
    totals: { total: 0, ok: 0, failed: 0, rateLimited: 0, quotaExceeded: 0, quotaUnits: 0, bySource: {} }
  };
}

function sanitizeUrl(input: string): { host: string; path: string } {
  const url = new URL(input);
  return { host: url.host, path: url.pathname || "/" };
}

function retentionBoundary(now: Date): Date {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() - 31);
  return next;
}

function toRecentItem(record: ExternalApiCallLogRecord): ExternalApiCallRecentItem {
  return {
    id: record.id,
    source: record.source,
    operation: record.operation,
    method: record.method,
    host: record.host,
    path: record.path,
    statusCode: record.statusCode ?? undefined,
    resultStatus: record.resultStatus,
    durationMs: record.durationMs ?? undefined,
    quotaUnits: record.quotaUnits,
    rateLimited: record.rateLimited,
    errorCode: record.errorCode ?? undefined,
    errorReason: record.errorReason ?? undefined,
    requestedAt: record.requestedAt.toISOString(),
    completedAt: record.completedAt?.toISOString()
  };
}

export class ExternalApiCallLogRepository {
  constructor(private readonly prisma: ExternalApiCallLogDelegate = getPrismaClient() as unknown as ExternalApiCallLogDelegate) {}

  async record(input: RecordExternalApiCallInput): Promise<void> {
    if (!this.prisma.externalApiCallLog.create) return;
    const { host, path } = sanitizeUrl(input.url);
    await this.prisma.externalApiCallLog.create({
      data: {
        source: input.source,
        operation: input.operation,
        method: input.method.toUpperCase(),
        host,
        path,
        statusCode: input.statusCode,
        resultStatus: trackedResultStatuses.includes(input.resultStatus) ? input.resultStatus : "unknown_error",
        durationMs: input.durationMs,
        quotaUnits: input.quotaUnits ?? 0,
        rateLimited: input.rateLimited ?? input.resultStatus === "rate_limited",
        errorCode: input.errorCode,
        errorReason: input.errorReason,
        requestedAt: input.requestedAt,
        completedAt: input.completedAt
      }
    });
  }

  async summarizeDaily(input: { days?: number; now?: Date; timezone?: "Asia/Seoul" } = {}): Promise<ExternalApiCallTrend> {
    const days = clampDays(input.days, 14);
    const now = input.now ?? new Date();
    if (!this.prisma.$queryRaw) return emptyExternalApiCallTrend(days, now);
    const dateKeys = buildKstDateKeys(days, now);
    const bucketByDate = new Map(dateKeys.map((date) => [date, createEmptyPoint(date)]));
    const startAt = kstMidnightUtcFromKey(dateKeys[0] ?? formatKstDateKey(now));
    const rows = await this.prisma.$queryRaw<ExternalApiDailyAggregateRow[]>`
      SELECT
        to_char("requestedAt" AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date,
        source,
        count(*) AS total,
        count(*) FILTER (WHERE "resultStatus" IN ('ok', 'not_modified')) AS ok,
        count(*) FILTER (WHERE "resultStatus" NOT IN ('ok', 'not_modified')) AS failed,
        count(*) FILTER (WHERE "resultStatus" = 'rate_limited' OR "rateLimited" = true) AS "rateLimited",
        count(*) FILTER (WHERE "resultStatus" = 'quota_exceeded') AS "quotaExceeded",
        coalesce(sum("quotaUnits"), 0) AS "quotaUnits"
      FROM "ExternalApiCallLog"
      WHERE "requestedAt" >= ${startAt}
        AND "requestedAt" <= ${now}
      GROUP BY date, source
      ORDER BY date ASC, source ASC
    `;

    for (const row of rows) {
      const point = bucketByDate.get(row.date);
      if (!point) continue;
      const total = aggregateNumber(row.total);
      point.total += total;
      point.ok += aggregateNumber(row.ok);
      point.failed += aggregateNumber(row.failed);
      point.rateLimited += aggregateNumber(row.rateLimited);
      point.quotaExceeded += aggregateNumber(row.quotaExceeded);
      point.quotaUnits += aggregateNumber(row.quotaUnits);
      point.bySource[row.source] = (point.bySource[row.source] ?? 0) + total;
    }

    const items = dateKeys.map((date) => bucketByDate.get(date) ?? createEmptyPoint(date));
    const totals = items.reduce(
      (next, item) => {
        next.total += item.total;
        next.ok += item.ok;
        next.failed += item.failed;
        next.rateLimited += item.rateLimited;
        next.quotaExceeded += item.quotaExceeded;
        next.quotaUnits += item.quotaUnits;
        for (const [source, count] of Object.entries(item.bySource)) {
          next.bySource[source] = (next.bySource[source] ?? 0) + count;
        }
        return next;
      },
      { total: 0, ok: 0, failed: 0, rateLimited: 0, quotaExceeded: 0, quotaUnits: 0, bySource: {} as Record<string, number> }
    );

    return { timezone: input.timezone ?? "Asia/Seoul", days, generatedAt: now.toISOString(), items, totals };
  }

  async listRecent(input: { limit?: number; source?: string; operation?: string; resultStatus?: string; since?: Date; until?: Date; now?: Date } = {}): Promise<ExternalApiCallListResult> {
    if (!this.prisma.externalApiCallLog.findMany) return { items: [] };
    const now = input.now ?? new Date();
    const minSince = retentionBoundary(now);
    const since = input.since && input.since > minSince ? input.since : minSince;
    const until = input.until && input.until < now ? input.until : now;
    const where: Record<string, unknown> = {
      requestedAt: { gte: since, lte: until }
    };
    if (input.source) where.source = input.source;
    if (input.operation) where.operation = input.operation;
    if (input.resultStatus) where.resultStatus = input.resultStatus;

    const records = await this.prisma.externalApiCallLog.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      take: clampLimit(input.limit, 50)
    });
    return { items: records.map(toRecentItem) };
  }

  async pruneOlderThan(input: { days?: number; now?: Date } = {}): Promise<{ deleted: number }> {
    if (!this.prisma.externalApiCallLog.deleteMany) return { deleted: 0 };
    const days = clampDays(input.days, 31);
    const now = input.now ?? new Date();
    const olderThan = new Date(now);
    olderThan.setUTCDate(olderThan.getUTCDate() - days);
    const result = await this.prisma.externalApiCallLog.deleteMany({
      where: { requestedAt: { lt: olderThan } }
    });
    return { deleted: result.count };
  }
}

export default ExternalApiCallLogRepository;
