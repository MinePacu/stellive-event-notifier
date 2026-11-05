import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react'
import { intlLocale, useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  effectivePrimary,
  formatDateTime,
  labelKey,
  scheduleDisplayTitle,
  scheduleEditorLinks,
  scheduleKindLabelKeys,
} from '../form'
import { type HubEventScheduleItem } from '../types'

type ScheduleListProps = {
  items: HubEventScheduleItem[]
  /** Row indexes flagged by server validation (`scheduleItems.N`). */
  invalidIndexes: Set<number>
  disabled: boolean
  onAdd: () => void
  onEdit: (item: HubEventScheduleItem, isPrimary: boolean) => void
  onSetPrimary: (item: HubEventScheduleItem) => void
  onMove: (item: HubEventScheduleItem, delta: number) => void
  onToggleCancelled: (item: HubEventScheduleItem) => void
}

export function ScheduleList({
  items,
  invalidIndexes,
  disabled,
  onAdd,
  onEdit,
  onSetPrimary,
  onMove,
  onToggleCancelled,
}: ScheduleListProps) {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = intlLocale(locale)
  const primary = effectivePrimary(items)

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div className='min-w-0 space-y-1'>
          <h3 className='font-semibold'>{t('hubEvent.scheduleDetail')}</h3>
          <p className='text-sm text-muted-foreground'>
            {t('hubEvent.scheduleHelp')} {t('hubEvent.primaryReplacementHelp')}
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={onAdd}
          disabled={disabled}
        >
          <Plus />
          {t('hubEvent.addSchedule')}
        </Button>
      </div>
      {primary.duplicate ? (
        <Alert variant='destructive'>
          <AlertDescription>
            {t('hubEvent.duplicatePrimaryWarning')}
          </AlertDescription>
        </Alert>
      ) : null}
      {items.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          {t('hubEvent.scheduleEmpty')}
        </p>
      ) : (
        <RadioGroup
          value={primary.id}
          onValueChange={(id) => {
            const item = items.find((candidate) => candidate.id === id)
            if (item) onSetPrimary(item)
          }}
          disabled={disabled}
          className='gap-3'
        >
          {items.map((item, index) => {
            const title = scheduleDisplayTitle(item)
            const displayTitle = title || t('hubEvent.untitled')
            const isPrimary = item.id === primary.id
            const kindKey = labelKey(scheduleKindLabelKeys, item.kind)
            const linkCount = scheduleEditorLinks(item).length
            const shortLabel = String(item.label ?? '').trim()
            const pills = [
              kindKey ? t(kindKey) : item.kind,
              item.endsAt
                ? t('hubEvent.schedulePeriod')
                : t('hubEvent.schedulePoint'),
              item.cancelledAt
                ? t('hubEvent.scheduleCancelled')
                : t('hubEvent.scheduleActive'),
              isPrimary ? t('hubEvent.schedulePrimary') : '',
              item.notificationEligible ? t('hubEvent.scheduleNotified') : '',
              linkCount
                ? t('hubEvent.scheduleLinkCount', { count: linkCount })
                : '',
              shortLabel && shortLabel !== title
                ? t('hubEvent.scheduleShortLabelMeta', { label: shortLabel })
                : '',
            ].filter(Boolean)
            const timing = [
              item.startsAt ? formatDateTime(item.startsAt, dateLocale) : '-',
              item.endsAt ? formatDateTime(item.endsAt, dateLocale) : '',
            ]
              .filter(Boolean)
              .join(' - ')
            const radioId = `hub-event-primary-${item.id}`
            return (
              <div
                key={item.id}
                aria-invalid={invalidIndexes.has(index) || undefined}
                className={cn(
                  'grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_auto] md:items-center',
                  item.cancelledAt && 'bg-muted/50 text-muted-foreground',
                  invalidIndexes.has(index) && 'border-destructive'
                )}
              >
                <div className='grid min-w-0 gap-1'>
                  <strong
                    className={cn(
                      'break-words',
                      item.cancelledAt && 'line-through'
                    )}
                  >
                    {displayTitle}
                  </strong>
                  {item.description?.trim() ? (
                    <span className='text-sm break-words text-muted-foreground'>
                      {item.description.trim()}
                    </span>
                  ) : null}
                  <span className='text-sm text-muted-foreground'>
                    {timing}
                  </span>
                  <div className='flex flex-wrap gap-1'>
                    {pills.map((pill, pillIndex) => (
                      <Badge key={pillIndex} variant='secondary'>
                        {pill}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className='flex flex-wrap items-center gap-1'>
                  <div className='me-1 flex items-center gap-2'>
                    <RadioGroupItem
                      id={radioId}
                      value={item.id}
                      disabled={disabled || Boolean(item.cancelledAt)}
                      aria-label={t('hubEvent.setPrimaryAria', {
                        title: displayTitle,
                      })}
                    />
                    <Label htmlFor={radioId} className='font-normal'>
                      {t('hubEvent.schedulePrimary')}
                    </Label>
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => onEdit(item, isPrimary)}
                    disabled={disabled}
                  >
                    <Pencil />
                    {t('common.edit')}
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    aria-label={t('hubEvent.moveUp')}
                    title={t('hubEvent.moveUp')}
                    onClick={() => onMove(item, -1)}
                    disabled={disabled || index === 0}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    aria-label={t('hubEvent.moveDown')}
                    title={t('hubEvent.moveDown')}
                    onClick={() => onMove(item, 1)}
                    disabled={disabled || index === items.length - 1}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => onToggleCancelled(item)}
                    disabled={disabled}
                  >
                    {item.cancelledAt
                      ? t('hubEvent.scheduleRestore')
                      : t('hubEvent.scheduleCancel')}
                  </Button>
                </div>
              </div>
            )
          })}
        </RadioGroup>
      )}
    </div>
  )
}
