import { type Locale, intlLocale } from '@/lib/i18n'

export function formatDateTime(
  value: string | null | undefined,
  locale: Locale
): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

/** ISO timestamp -> `datetime-local` input value (local time). */
export function toLocalDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

/** `datetime-local` input value -> ISO timestamp, or null when empty/invalid. */
export function fromLocalDateTime(value: string): string | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}
