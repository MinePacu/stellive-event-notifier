import { ArrowDown, ArrowUp, Pencil } from 'lucide-react'
import { intlLocale, useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { type HubEventGoodsItem, type HubEventScheduleItem } from '../types'
import { type GoodsMember } from './goods-api'
import {
  channelLabel,
  formatPrice,
  memberName,
  salesPhaseLabel,
} from './goods-format'

type GoodsListProps = {
  items: HubEventGoodsItem[]
  scheduleItems: HubEventScheduleItem[]
  members: GoodsMember[] | undefined
  disabled: boolean
  onEdit: (item: HubEventGoodsItem) => void
  onMove: (item: HubEventGoodsItem, delta: number) => void
  onToggleCancelled: (item: HubEventGoodsItem) => void
}

export function GoodsList({
  items,
  scheduleItems,
  members,
  disabled,
  onEdit,
  onMove,
  onToggleCancelled,
}: GoodsListProps) {
  const t = useT()
  const { locale } = useLocale()
  const numberLocale = intlLocale(locale)

  if (items.length === 0)
    return <p className='text-sm text-muted-foreground'>{t('goods.empty')}</p>

  return (
    <div className='grid gap-3'>
      {items.map((item, index) => {
        const detail = [
          item.groupLabel ?? '',
          (item.memberIds ?? [])
            .map((id) => memberName(members, id))
            .join(', '),
          formatPrice(item.priceKrw, numberLocale) || t('goods.priceUnset'),
          item.priceNote ?? '',
        ]
          .filter(Boolean)
          .join(' · ')
        const pills = [
          channelLabel(t, item.salesChannel),
          item.isBonus ? t('goods.bonus') : '',
          item.purchaseLimit
            ? t('goods.limitBadge', { count: item.purchaseLimit })
            : '',
          item.scheduleItemId
            ? salesPhaseLabel(scheduleItems, item.scheduleItemId)
            : '',
          item.cancelledAt ? t('goods.cancelled') : '',
        ].filter(Boolean)
        return (
          <div
            key={item.id}
            className={cn(
              'grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_auto] md:items-center',
              item.cancelledAt && 'bg-muted/50 text-muted-foreground'
            )}
          >
            <div className='grid min-w-0 gap-1'>
              <strong
                className={cn(
                  'break-words',
                  item.cancelledAt && 'line-through'
                )}
              >
                {item.name.trim() || t('goods.untitled')}
              </strong>
              <span className='text-sm break-words text-muted-foreground'>
                {detail}
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
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => onEdit(item)}
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
                {item.cancelledAt ? t('goods.restore') : t('goods.cancel')}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
