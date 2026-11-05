import { type TranslateFn } from '@/lib/i18n'
import {
  type AdapterHealth,
  type DeliveryAttemptSummary,
  type NotificationJobSummary,
} from './types'

/** Date buckets and timestamps are shown in the service's timezone (KST). */
export const ADMIN_TIME_ZONE = 'Asia/Seoul'

export function numericValue(value: unknown): number {
  const next = Number(value)
  return Number.isFinite(next) && next >= 0 ? next : 0
}

export function formatNumber(value: unknown, intl: string): string {
  return new Intl.NumberFormat(intl).format(numericValue(value))
}

export function formatPercent(part: number, total: number): string {
  if (numericValue(total) === 0) return '0%'
  return `${((numericValue(part) / numericValue(total)) * 100).toFixed(1)}%`
}

/** "MM/DD" label for a KST date key such as "2026-09-29". */
export function shortDateLabel(dateKey: string, intl: string): string {
  const date = new Date(`${dateKey}T00:00:00+09:00`)
  if (Number.isNaN(date.getTime())) return dateKey || '-'
  return new Intl.DateTimeFormat(intl, {
    month: '2-digit',
    day: '2-digit',
    timeZone: ADMIN_TIME_ZONE,
  }).format(date)
}

export function formatDateTime(
  value: string | undefined | null,
  intl: string,
  long = false
): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(
    intl,
    long
      ? {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
          timeZone: ADMIN_TIME_ZONE,
        }
      : { timeZone: ADMIN_TIME_ZONE }
  )
}

export function formatLastChecked(
  value: string,
  intl: string,
  t: TranslateFn
): string {
  if (!value || value === '1970-01-01T00:00:00.000Z')
    return t('dashboard.notChecked')
  return formatDateTime(value, intl, true)
}

export function formatUptime(seconds: number, t: TranslateFn): string {
  const total = Math.floor(Number(seconds))
  if (!Number.isFinite(total) || total < 0) return '-'
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const unit = (
    key:
      | 'dashboard.unitDay'
      | 'dashboard.unitHour'
      | 'dashboard.unitMinute'
      | 'dashboard.unitSecond',
    n: number
  ) => t(key, { n })
  if (days > 0)
    return hours > 0
      ? `${unit('dashboard.unitDay', days)} ${unit('dashboard.unitHour', hours)}`
      : unit('dashboard.unitDay', days)
  if (hours > 0)
    return minutes > 0
      ? `${unit('dashboard.unitHour', hours)} ${unit('dashboard.unitMinute', minutes)}`
      : unit('dashboard.unitHour', hours)
  if (minutes > 0)
    return `${unit('dashboard.unitMinute', minutes)} ${unit('dashboard.unitSecond', secs)}`
  return unit('dashboard.unitSecond', secs)
}

export function formatQueueState(
  queue: Partial<NotificationJobSummary> | undefined,
  t: TranslateFn
): string {
  return t('dashboard.queueStateValue', {
    queued: queue?.queued ?? 0,
    locked: queue?.locked ?? 0,
    failed: queue?.failed ?? 0,
    missing: queue?.missingJobCount ?? 0,
  })
}

export function formatDeliveryState(
  delivery: Partial<DeliveryAttemptSummary> | undefined,
  t: TranslateFn
): string {
  return t('dashboard.deliveryStateValue', {
    sent: delivery?.sent ?? 0,
    skipped: delivery?.skipped ?? 0,
    failed: delivery?.failed ?? 0,
  })
}

export function summarizeSecrets(
  secrets: Record<string, string> | undefined,
  t: TranslateFn
): string {
  const values = Object.values(secrets ?? {})
  if (values.length === 0) return t('dashboard.noData')
  return t('dashboard.secretsSummary', {
    configured: values.filter((value) => value === 'configured').length,
    missing: values.filter((value) => value === 'missing').length,
  })
}

export function summarizeAdapters(
  adapters: AdapterHealth[] | undefined,
  t: TranslateFn
): string {
  const rows = Array.isArray(adapters) ? adapters : []
  if (rows.length === 0) return t('dashboard.noDiagnostics')
  return t('dashboard.adapterSummaryValue', {
    ready: rows.filter(
      (adapter) => adapter.status === 'enabled' || adapter.status === 'ready'
    ).length,
    disabled: rows.filter((adapter) => adapter.status === 'disabled').length,
    total: rows.length,
  })
}
