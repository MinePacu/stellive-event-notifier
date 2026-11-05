import { type MessageKey } from '@/lib/i18n'

export const ANNOUNCEMENT_TYPES = [
  'general',
  'incident',
  'maintenance',
  'version_update',
] as const
export const ANNOUNCEMENT_SEVERITIES = [
  'info',
  'important',
  'critical',
] as const
export const PUBLICATION_STATES = ['draft', 'published', 'archived'] as const

export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number]
export type AnnouncementSeverity = (typeof ANNOUNCEMENT_SEVERITIES)[number]
export type PublicationState = (typeof PUBLICATION_STATES)[number]
export type AnnouncementPlatform = 'android' | 'ios'

/** Admin view of a service announcement (`GET /v1/admin/announcements`). */
export type Announcement = {
  id: string
  type: AnnouncementType
  severity: AnnouncementSeverity
  publicationState: PublicationState
  title: string
  summary: string
  body: string
  isPinned: boolean
  targetPlatforms: AnnouncementPlatform[]
  minimumAppVersion: string | null
  maximumAppVersion: string | null
  appDeepLink: string | null
  externalUrl: string | null
  actionLabel: string | null
  publishedAt: string | null
  expiresAt: string | null
  resolvedAt: string | null
  archivedAt: string | null
  pushEnabled: boolean
  pushStatus: string
  attentionRevision: number
  revision: number
  createdAt: string
  updatedAt: string
}

export type AnnouncementPage = {
  items: Announcement[]
  nextCursor?: string
}

export type AuditEntry = {
  id: string
  action: string
  actorId?: string
  reason?: string
  createdAt: string
}

export type PushAttempt = {
  id: string
  topic?: string
  eventId?: string
  status: string
  providerErrorCode?: string
  requestedAt: string
}

export type PushAttemptsResult = {
  items: PushAttempt[]
  summary?: Record<string, number>
}

/** POST actions that operate on an existing announcement. */
export type AnnouncementAction =
  | 'publish'
  | 'resolve'
  | 'archive'
  | 'resend'
  | 'bump-attention'

export type AnnouncementJob =
  | { kind: 'save' }
  | { kind: AnnouncementAction | 'delete'; reason: string }

export const TYPE_LABEL_KEYS: Record<AnnouncementType, MessageKey> = {
  general: 'enum.general',
  incident: 'enum.incident',
  maintenance: 'enum.maintenance',
  version_update: 'enum.versionUpdate',
}

export const SEVERITY_LABEL_KEYS: Record<AnnouncementSeverity, MessageKey> = {
  info: 'enum.info',
  important: 'enum.important',
  critical: 'enum.critical',
}

export const STATE_LABEL_KEYS: Record<PublicationState, MessageKey> = {
  draft: 'status.draft',
  published: 'status.published',
  archived: 'status.archived',
}

export const ACTION_LABEL_KEYS: Record<
  AnnouncementAction | 'delete',
  MessageKey
> = {
  publish: 'announcement.publish',
  resolve: 'announcement.resolve',
  archive: 'announcement.archive',
  resend: 'announcement.resend',
  'bump-attention': 'announcement.bumpAttention',
  delete: 'common.delete',
}
