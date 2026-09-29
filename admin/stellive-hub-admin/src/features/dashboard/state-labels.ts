import { type MessageKey, useT } from '@/lib/i18n'

export type Tone = 'good' | 'warn' | 'bad' | 'muted'

export const STATE: Record<string, { key: MessageKey; tone: Tone }> = {
  ok: { key: 'dashboard.stateOk', tone: 'good' },
  healthy: { key: 'status.healthy', tone: 'good' },
  enabled: { key: 'status.enabled', tone: 'good' },
  ready: { key: 'dashboard.stateReady', tone: 'good' },
  configured: { key: 'dashboard.stateConfigured', tone: 'good' },
  degraded: { key: 'dashboard.stateDegraded', tone: 'warn' },
  verify_required: { key: 'status.verifyRequired', tone: 'warn' },
  rate_limited: { key: 'dashboard.stateRateLimited', tone: 'warn' },
  missing: { key: 'dashboard.stateMissing', tone: 'bad' },
  failed: { key: 'status.failed', tone: 'bad' },
  disabled: { key: 'status.disabled', tone: 'muted' },
}

/** Localized status label for a raw backend state value. */
export function useStateLabel() {
  const t = useT()
  return (value: string) => {
    const entry = STATE[value]
    return entry ? t(entry.key) : value || '-'
  }
}
