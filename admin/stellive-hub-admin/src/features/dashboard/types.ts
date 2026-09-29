// Response shapes of GET /v1/internal/admin/overview and
// GET /v1/internal/admin/external-api-calls (see the backend's adminTypes.ts).

export type AdminHealthStatus =
  | 'ok'
  | 'degraded'
  | 'disabled'
  | 'verify_required'
  | 'rate_limited'

export type AdapterHealth = {
  source: string
  status: string
  reason: string
  lastCheckedAt: string
}

export type NotificationJobSummary = {
  queued: number
  locked: number
  completed: number
  failed: number
  missingJobCount?: number
}

export type DeliveryAttemptSummary = {
  sent: number
  queued: number
  skipped: number
  failed: number
}

export type DailyDeliveryQueuePoint = DeliveryAttemptSummary & {
  date: string
  total: number
}

export type DailyDeliveryQueueTrend = {
  days: number
  items: DailyDeliveryQueuePoint[]
  totals: DeliveryAttemptSummary & { total: number }
}

export type ExternalApiCallDailyPoint = {
  date: string
  total: number
  ok: number
  failed: number
  rateLimited: number
  quotaExceeded: number
  quotaUnits: number
  bySource: Record<string, number>
}

export type ExternalApiCallTrend = {
  days: number
  items: ExternalApiCallDailyPoint[]
  totals: {
    total: number
    ok: number
    failed: number
    rateLimited: number
    quotaExceeded: number
    quotaUnits: number
    bySource: Record<string, number>
  }
}

export type ExternalApiCallRecentItem = {
  id: string
  source: string
  operation: string
  statusCode?: number
  resultStatus: string
  durationMs?: number
  quotaUnits: number
  requestedAt: string
}

export type ExternalApiCallListResult = {
  items: ExternalApiCallRecentItem[]
}

export type AdminOverview = {
  service: { name: string; environment: string; uptimeSeconds: number }
  database: { status: string; reason: string }
  featureFlags: Record<string, boolean | string>
  secrets: Record<string, string>
  queue: NotificationJobSummary
  adapters: AdapterHealth[]
  recentDelivery: DeliveryAttemptSummary
  dailyDeliveryQueue: DailyDeliveryQueueTrend
  externalApiCalls: { daily: ExternalApiCallTrend }
}

/** Sources with a fixed chart color; anything else falls back to "other". */
export const KNOWN_API_SOURCES = [
  'youtube',
  'chzzk',
  'fcm',
  'websub',
  'other',
] as const
