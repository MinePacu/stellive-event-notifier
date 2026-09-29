import { type MessageKey } from '@/lib/i18n'
import {
  type AdminHubEvent,
  type HubEventCategory,
  type HubEventImagePolicyState,
  type HubEventLifecycleAction,
  type HubEventLink,
  type HubEventLinkKind,
  type HubEventParticipationMode,
  type HubEventPublicationState,
  type HubEventScheduleItem,
  type HubEventScheduleKind,
  type HubEventSourceType,
  type HubEventStatus,
} from './types'

// ---------------------------------------------------------------------------
// Labels

export const categoryLabelKeys: Record<HubEventCategory, MessageKey> = {
  online_goods: 'hubEvent.onlineGoods',
  online_collab: 'hubEvent.onlineCollab',
  offline_concert: 'hubEvent.offlineConcert',
  offline_collab: 'hubEvent.offlineCollab',
  offline_popup: 'hubEvent.offlinePopup',
  ticketing: 'hubEvent.ticketing',
}

export const participationLabelKeys: Record<
  HubEventParticipationMode,
  MessageKey
> = {
  online: 'hubEvent.online',
  offline: 'hubEvent.offline',
  hybrid: 'hubEvent.hybrid',
}

export const statusLabelKeys: Record<HubEventStatus, MessageKey> = {
  announced: 'hubEvent.announced',
  upcoming: 'hubEvent.upcoming',
  open: 'status.open',
  closing_soon: 'hubEvent.closingSoon',
  ended: 'status.ended',
  cancelled: 'status.cancelled',
}

export const sourceTypeLabelKeys: Record<HubEventSourceType, MessageKey> = {
  official: 'hubEvent.sourceOfficial',
  member: 'hubEvent.member',
  official_collab: 'hubEvent.sourceOfficialCollab',
}

export const imagePolicyLabelKeys: Record<
  HubEventImagePolicyState,
  MessageKey
> = {
  none: 'common.none',
  official_runtime_url: 'hubEvent.imagePolicyOfficialRuntimeUrl',
  third_party_allowed: 'hubEvent.imagePolicyThirdPartyAllowed',
  verify_required: 'status.verifyRequired',
  blocked: 'status.blocked',
}

export const publicationStateLabelKeys: Record<
  HubEventPublicationState,
  MessageKey
> = {
  draft: 'status.draft',
  published: 'status.published',
  inactive: 'status.inactive',
  deleted: 'status.deleted',
}

export const scheduleKindLabelKeys: Record<HubEventScheduleKind, MessageKey> = {
  main_window: 'hubEvent.kindMainWindow',
  announcement: 'hubEvent.kindAnnouncement',
  sales_open: 'hubEvent.kindSalesOpen',
  ticket_open: 'hubEvent.kindTicketOpen',
  content_reveal: 'hubEvent.kindContentReveal',
  release: 'hubEvent.kindRelease',
  deadline: 'hubEvent.kindDeadline',
  custom: 'hubEvent.kindCustom',
}

export const linkKindLabelKeys: Record<HubEventLinkKind, MessageKey> = {
  source: 'hubEvent.linkKindSource',
  purchase: 'hubEvent.linkKindPurchase',
  ticket: 'hubEvent.linkKindTicket',
  reservation: 'hubEvent.linkKindReservation',
  content: 'hubEvent.linkKindContent',
  video: 'hubEvent.linkKindVideo',
  map: 'hubEvent.linkKindMap',
  custom: 'hubEvent.linkKindCustom',
}

/** Button label and confirm copy for lifecycle actions. */
export const lifecycleCopy: Record<
  HubEventLifecycleAction,
  { label: MessageKey; title: MessageKey; desc: MessageKey }
> = {
  publish: {
    label: 'hubEvent.publish',
    title: 'hubEvent.confirmPublishTitle',
    desc: 'hubEvent.confirmPublishDesc',
  },
  cancel: {
    label: 'hubEvent.cancelEvent',
    title: 'hubEvent.confirmCancelTitle',
    desc: 'hubEvent.confirmCancelDesc',
  },
  deactivate: {
    label: 'hubEvent.deactivate',
    title: 'hubEvent.confirmDeactivateTitle',
    desc: 'hubEvent.confirmDeactivateDesc',
  },
  delete: {
    label: 'common.delete',
    title: 'hubEvent.confirmDeleteTitle',
    desc: 'hubEvent.confirmDeleteDesc',
  },
}

/** Label key for a server enum value, or undefined for unknown values. */
export function labelKey<T extends string>(
  map: Record<T, MessageKey>,
  value: string | undefined
): MessageKey | undefined {
  return value && value in map ? map[value as T] : undefined
}

// ---------------------------------------------------------------------------
// Dates (same conversions as the legacy console)

export function toIsoFromLocal(value: string): string | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

/** ISO timestamp -> `YYYY-MM-DDTHH:mm` in the browser's time zone. */
export function toLocalDateTime(value: string | undefined | null): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

/** ISO timestamp -> `YYYY-MM-DD` in the schedule item's time zone. */
export function toScheduleDate(
  value: string | undefined | null,
  timezone: string | undefined
): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10)
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(parsed)
  } catch {
    return String(value).slice(0, 10)
  }
}

export function formatDateTime(
  value: string | undefined | null,
  intlLocale: string
): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString(intlLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// ---------------------------------------------------------------------------
// Links editor

export type LinkDraft = {
  /** Client-only React key. */
  key: string
  id?: string
  kind: HubEventLinkKind
  label: string
  url: string
}

let linkKeySeed = 0
export function newLinkKey() {
  linkKeySeed += 1
  return `link-${linkKeySeed}`
}

export function toLinkDrafts(links: Partial<HubEventLink>[]): LinkDraft[] {
  return links.map((link) => ({
    key: newLinkKey(),
    id: link.id,
    kind: link.kind ?? 'source',
    label: link.label ?? '',
    url: link.url ?? '',
  }))
}

export function collectLinks(drafts: LinkDraft[]) {
  return drafts.map((draft, index) => {
    const result: {
      id?: string
      kind: HubEventLinkKind
      url: string
      label?: string
      sortOrder: number
    } = { kind: draft.kind, url: draft.url.trim(), sortOrder: index }
    if (draft.id) result.id = draft.id
    const label = draft.label.trim()
    if (label) result.label = label
    return result
  })
}

/** Links to edit for an event, falling back to its legacy URL fields. */
export function parentEditorLinks(
  event: AdminHubEvent
): Partial<HubEventLink>[] {
  if (Array.isArray(event.links) && event.links.length) return event.links
  const links: Partial<HubEventLink>[] = []
  if (event.purchaseUrl)
    links.push({ kind: 'purchase', url: event.purchaseUrl, sortOrder: 0 })
  if (event.ticketUrl)
    links.push({ kind: 'ticket', url: event.ticketUrl, sortOrder: 1 })
  if (event.sourceUrl)
    links.push({
      kind: 'source',
      label: event.sourceLabel,
      url: event.sourceUrl,
      sortOrder: 2,
    })
  return links
}

const scheduleActionLinkKinds: Partial<
  Record<HubEventScheduleKind, HubEventLinkKind>
> = {
  sales_open: 'purchase',
  ticket_open: 'ticket',
  deadline: 'reservation',
  main_window: 'reservation',
  announcement: 'source',
}

/** Links to edit for a schedule item, falling back to legacy URL fields. */
export function scheduleEditorLinks(
  item: Partial<HubEventScheduleItem>
): Partial<HubEventLink>[] {
  if (Array.isArray(item.links) && item.links.length) return item.links
  const links: Partial<HubEventLink>[] = []
  if (item.actionUrl)
    links.push({
      kind: (item.kind && scheduleActionLinkKinds[item.kind]) || 'content',
      url: item.actionUrl,
      sortOrder: 0,
    })
  if (item.sourceUrl)
    links.push({
      kind: 'source',
      label: item.sourceLabel,
      url: item.sourceUrl,
      sortOrder: 1,
    })
  return links
}

// ---------------------------------------------------------------------------
// Event form

export type HubEventFormValues = {
  title: string
  summary: string
  category: HubEventCategory
  participationMode: HubEventParticipationMode
  status: HubEventStatus
  album: boolean
  generationId: string
  memberId: string
  sourceType: HubEventSourceType
  imagePolicyState: HubEventImagePolicyState
  sourceUrl: string
  sourceLabel: string
  imageUrl: string
  imageSourceLabel: string
  imageSourceUrl: string
  announcedAt: string
  startsAt: string
  endsAt: string
  links: LinkDraft[]
  venueName: string
  venueAddress: string
  notificationEligible: boolean
}

export function toFormValues(event: AdminHubEvent | null): HubEventFormValues {
  return {
    title: event?.title ?? '',
    summary: event?.summary ?? '',
    category: event?.category ?? 'online_goods',
    participationMode: event?.participationMode ?? 'online',
    status: event?.status ?? 'announced',
    album: Array.isArray(event?.tags) && event.tags.includes('album'),
    generationId: event?.generationId || 'official',
    memberId: event?.memberId ?? '',
    sourceType: event?.sourceType ?? 'official',
    imagePolicyState: event?.image?.policyState ?? 'none',
    sourceUrl: event?.sourceUrl ?? '',
    sourceLabel: event?.sourceLabel ?? '',
    imageUrl: event?.image?.url ?? '',
    imageSourceLabel: event?.image?.sourceLabel ?? '',
    imageSourceUrl: event?.image?.sourceUrl ?? '',
    announcedAt: toLocalDateTime(event?.announcedAt),
    startsAt: toLocalDateTime(event?.startsAt),
    endsAt: toLocalDateTime(event?.endsAt),
    links: event ? toLinkDrafts(parentEditorLinks(event)) : [],
    venueName: event?.venueName ?? '',
    venueAddress: event?.venueAddress ?? '',
    notificationEligible: event ? event.notificationEligible !== false : true,
  }
}

/** Thrown when image policy `none` is combined with image metadata. */
export class ImagePolicyNoneWithMetadataError extends Error {
  constructor() {
    super('image_policy_state_none_with_metadata')
    this.name = 'ImagePolicyNoneWithMetadataError'
  }
}

const optionalTextFields = [
  'title',
  'summary',
  'category',
  'participationMode',
  'status',
  'generationId',
  'memberId',
  'sourceUrl',
  'sourceLabel',
  'sourceType',
  'venueName',
  'venueAddress',
] as const satisfies readonly (keyof HubEventFormValues)[]

/** Request body for validate / create / update (legacy `collectHubEventInput`). */
export function toHubEventInput(
  values: HubEventFormValues
): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  for (const key of optionalTextFields) {
    const value = String(values[key] ?? '').trim()
    if (value) input[key] = value
  }
  input.announcedAt = toIsoFromLocal(values.announcedAt) ?? null
  input.startsAt = toIsoFromLocal(values.startsAt) ?? null
  input.endsAt = toIsoFromLocal(values.endsAt) ?? null
  input.notificationEligible = values.notificationEligible
  input.tags = values.album ? ['album'] : []

  const imageUrl = values.imageUrl.trim()
  const imageSourceLabel = values.imageSourceLabel.trim()
  const imageSourceUrl = values.imageSourceUrl.trim()
  if (values.imagePolicyState === 'none') {
    if (imageUrl || imageSourceLabel || imageSourceUrl) {
      throw new ImagePolicyNoneWithMetadataError()
    }
    input.image = null
  } else {
    const image: Record<string, string> = {
      policyState: values.imagePolicyState,
    }
    if (imageUrl) image.url = imageUrl
    if (imageSourceLabel) image.sourceLabel = imageSourceLabel
    if (imageSourceUrl) image.sourceUrl = imageSourceUrl
    input.image = image
  }
  input.links = collectLinks(values.links)
  return input
}

/** Maps server validation fields to form fields. */
export const validationFieldToFormField: Record<
  string,
  keyof HubEventFormValues
> = {
  title: 'title',
  summary: 'summary',
  category: 'category',
  participationMode: 'participationMode',
  status: 'status',
  tags: 'album',
  generationId: 'generationId',
  memberId: 'memberId',
  sourceType: 'sourceType',
  source: 'sourceUrl',
  sourceUrl: 'sourceUrl',
  sourceLabel: 'sourceLabel',
  image: 'imagePolicyState',
  'image.policyState': 'imagePolicyState',
  'image.url': 'imageUrl',
  'image.source': 'imageSourceLabel',
  'image.sourceLabel': 'imageSourceLabel',
  'image.sourceUrl': 'imageSourceUrl',
  announcedAt: 'announcedAt',
  dateWindow: 'startsAt',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  venueName: 'venueName',
  venueAddress: 'venueAddress',
}

// ---------------------------------------------------------------------------
// Schedule items

/** Deterministic primary among active primaries (legacy ordering). */
export function effectivePrimary(items: HubEventScheduleItem[]) {
  const primaries = items
    .filter((item) => item.isPrimary && !item.cancelledAt)
    .sort(
      (left, right) =>
        (left.sortOrder || 0) - (right.sortOrder || 0) ||
        new Date(left.startsAt || 0).getTime() -
          new Date(right.startsAt || 0).getTime() ||
        new Date(left.createdAt || 0).getTime() -
          new Date(right.createdAt || 0).getTime() ||
        String(left.id || '').localeCompare(String(right.id || ''))
    )
  return { id: primaries[0]?.id ?? '', duplicate: primaries.length > 1 }
}

/** Timeline mode: parent start/end are derived from schedule items. */
export function isTimelineMode(items: HubEventScheduleItem[]) {
  const active = items.filter((item) => !item.cancelledAt)
  return (
    active.length >= 2 || active.some((item) => item.kind !== 'main_window')
  )
}

export function scheduleDisplayTitle(item: Partial<HubEventScheduleItem>) {
  return (
    String(item.title ?? '').trim() || String(item.label ?? '').trim() || ''
  )
}
