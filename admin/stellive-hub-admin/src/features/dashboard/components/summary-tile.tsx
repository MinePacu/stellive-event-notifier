import { useLocale, intlLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { formatNumber } from '../format'

/** Small labelled number used beside the charts. */
export function SummaryTile({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: number | string
  hint?: string
  className?: string
}) {
  const { locale } = useLocale()
  return (
    <div className={cn('rounded-lg border p-3', className)}>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='text-xl font-semibold tabular-nums'>
        {typeof value === 'number'
          ? formatNumber(value, intlLocale(locale))
          : value || '-'}
      </div>
      {hint ? (
        <div className='text-xs text-muted-foreground'>{hint}</div>
      ) : null}
    </div>
  )
}
