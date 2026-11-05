import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n'
import { formatUptime } from '../format'

/**
 * Service uptime that keeps ticking between refreshes: the value reported at
 * `reportedAt` plus the seconds elapsed since then.
 */
export function LiveUptime({
  seconds,
  reportedAt,
}: {
  seconds: number
  reportedAt: number
}) {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const elapsed = Math.max(0, Math.floor((now - reportedAt) / 1000))
  return <>{formatUptime(seconds + elapsed, t)}</>
}
