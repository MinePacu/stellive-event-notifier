import { type MessageKey, type TranslateFn } from '@/lib/i18n'
import { messages } from '@/lib/i18n/messages'
import {
  type HubEventCategory,
  type HubEventGoodsSalesChannel,
  type HubEventScheduleItem,
} from '../types'
import { type GoodsMember } from './goods-api'

/** Categories that show the goods list expanded by default. */
export const GOODS_DEFAULT_CATEGORIES: readonly HubEventCategory[] = [
  'online_goods',
  'offline_popup',
  'online_collab',
  'offline_collab',
  'offline_concert',
]

export const salesChannelLabelKeys: Record<
  HubEventGoodsSalesChannel,
  MessageKey
> = {
  onsite: 'goods.channelOnsite',
  online: 'goods.channelOnline',
  both: 'goods.channelBoth',
}

export function channelLabel(t: TranslateFn, channel: string | undefined) {
  return channel && channel in salesChannelLabelKeys
    ? t(salesChannelLabelKeys[channel as HubEventGoodsSalesChannel])
    : channel || '-'
}

export function formatPrice(value: number | undefined, intlLocale: string) {
  return typeof value === 'number'
    ? `₩${new Intl.NumberFormat(intlLocale).format(value)}`
    : ''
}

export function memberName(members: GoodsMember[] | undefined, id: string) {
  return members?.find((member) => member.id === id)?.koreanName ?? id
}

function scheduleLabelOf(item: Partial<HubEventScheduleItem>, id: string) {
  return (
    String(item.label ?? '').trim() || String(item.title ?? '').trim() || id
  )
}

/** Active schedule items a goods item can be assigned to (sales phase). */
export function salesPhaseOptions(items: HubEventScheduleItem[]) {
  return items
    .filter((item) => !item.cancelledAt)
    .map((item) => ({ id: item.id, label: scheduleLabelOf(item, item.id) }))
}

export function salesPhaseLabel(items: HubEventScheduleItem[], id: string) {
  const found = items.find((item) => item.id === id)
  return found ? scheduleLabelOf(found, id) : id
}

/** Translates `prefix + code` when the catalog has it, else `fallback`. */
export function issueText(
  t: TranslateFn,
  prefix: string,
  code: string,
  fallback: MessageKey,
  params?: Record<string, string | number>
) {
  const key = `${prefix}${code}`
  return key in messages.en ? t(key as MessageKey, params) : t(fallback)
}
