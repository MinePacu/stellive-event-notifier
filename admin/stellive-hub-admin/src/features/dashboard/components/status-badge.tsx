import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { STATE, type Tone, useStateLabel } from '../state-labels'

const TONE_CLASS: Record<Tone, string> = {
  good: 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  warn: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
  bad: 'border-transparent bg-destructive/15 text-destructive',
  muted: 'border-transparent bg-muted text-muted-foreground',
}

export function StatusBadge({ value }: { value: string }) {
  const label = useStateLabel()
  const tone = STATE[value]?.tone ?? 'muted'
  return (
    <Badge variant='outline' className={cn(TONE_CLASS[tone])}>
      {label(value)}
    </Badge>
  )
}
