// DTO shapes for /v1/admin/hub-events (see shared/schemas/domain.ts and
// backend/stellive-hub-api/src/hub-events/hubEventAdminTypes.ts).

export const HUB_EVENT_CATEGORIES = [
  'online_goods',
  'online_collab',
  'offline_concert',
  'offline_collab',
  'offline_popup',
  'ticketing',
] as const
export type HubEventCategory = (typeof HUB_EVENT_CATEGORIES)[number]

export const HUB_EVENT_PARTICIPATION_MODES = [
  'online',
  'offline',
  'hybrid',
] as const
export type HubEventParticipationMode =
  (typeof HUB_EVENT_PARTICIPATION_MODES)[number]

export const HUB_EVENT_STATUSES = [
  'announced',
  'upcoming',
  'open',
  'closing_soon',
  'ended',
  'cancelled',
] as const
export type HubEventStatus = (typeof HUB_EVENT_STATUSES)[number]

export const HUB_EVENT_SOURCE_TYPES = [
  'official',
  'member',
  'official_collab',
] as const
export type HubEventSourceType = (typeof HUB_EVENT_SOURCE_TYPES)[number]

export const HUB_EVENT_IMAGE_POLICY_STATES = [
  'none',
  'official_runtime_url',
  'third_party_allowed',
  'verify_required',
  'blocked',
] as const
export type HubEventImagePolicyState =
  (typeof HUB_EVENT_IMAGE_POLICY_STATES)[number]

export const HUB_EVENT_PUBLICATION_STATES = [
  'draft',
  'published',
  'inactive',
  'deleted',
] as const
export type HubEventPublicationState =
  (typeof HUB_EVENT_PUBLICATION_STATES)[number]

export const HUB_EVENT_SCHEDULE_KINDS = [
  'main_window',
  'announcement',
  'sales_open',
  'ticket_open',
  'content_reveal',
  'release',
  'deadline',
  'custom',
] as const
export type HubEventScheduleKind = (typeof HUB_EVENT_SCHEDULE_KINDS)[number]

export const HUB_EVENT_LINK_KINDS = [
  'source',
  'purchase',
  'ticket',
  'reservation',
  'content',
  'video',
  'map',
  'custom',
] as const
export type HubEventLinkKind = (typeof HUB_EVENT_LINK_KINDS)[number]

export type HubEventTimePrecision = 'date' | 'datetime'

export interface HubEventLink {
  id?: string
  kind: HubEventLinkKind
  label?: string
  url: string
  sortOrder: number
}

export interface HubEventScheduleItem {
  id: string
  kind: HubEventScheduleKind
  title?: string
  label: string
  description?: string
  startsAt: string
  endsAt?: string
  timePrecision: HubEventTimePrecision
  timezone: string
  actionUrl?: string
  sourceUrl?: string
  sourceLabel?: string
  links?: HubEventLink[]
  notificationEligible: boolean
  isPrimary: boolean
  sortOrder: number
  cancelledAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface HubEventImage {
  policyState: HubEventImagePolicyState
  url?: string
  sourceLabel?: string
  sourceUrl?: string
}

export interface AdminHubEvent {
  id: string
  category: HubEventCategory
  tags: string[]
  participationMode: HubEventParticipationMode
  status: HubEventStatus
  title: string
  summary?: string
  memberId?: string
  generationId: string
  sourceUrl: string
  sourceLabel: string
  sourceType: HubEventSourceType
  scheduleMode?: 'single_window' | 'timeline'
  scheduleItems?: HubEventScheduleItem[]
  links?: HubEventLink[]
  announcedAt?: string
  startsAt?: string
  endsAt?: string
  purchaseUrl?: string
  ticketUrl?: string
  venueName?: string
  venueAddress?: string
  image?: HubEventImage
  notificationEligible: boolean
  createdAt: string
  updatedAt: string
  publicationState: HubEventPublicationState
  revision: number
  deletedAt?: string
}

export interface AdminHubEventListResult {
  items: AdminHubEvent[]
  nextCursor?: string
}

export interface HubEventValidationError {
  field: string
  reason: string
  message: string
}

export interface HubEventValidationResult {
  valid: boolean
  errors: HubEventValidationError[]
}

export interface HubEventAuditLogEntry {
  id: string
  hubEventId: string
  action: string
  actorId?: string
  reason?: string
  createdAt: string
}

export interface HubEventScheduleDeleteResult {
  event: AdminHubEvent
  scheduleItemId: string
  deletion: 'cancelled' | 'hard_deleted'
}

/** List filters. `''` means "no filter" for every field. */
export interface HubEventListFilters {
  publicationState: string
  status: string
  category: string
  participationMode: string
  tag: string
  generationId: string
  memberId: string
  query: string
  includeDeleted: boolean
}

export const DEFAULT_HUB_EVENT_FILTERS: HubEventListFilters = {
  publicationState: '',
  // The legacy console defaulted the public status filter to open events.
  status: 'open',
  category: '',
  participationMode: '',
  tag: '',
  generationId: '',
  memberId: '',
  query: '',
  includeDeleted: false,
}

export type HubEventLifecycleAction =
  | 'publish'
  | 'cancel'
  | 'deactivate'
  | 'delete'
