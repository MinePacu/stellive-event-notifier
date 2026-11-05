import { api } from '@/lib/api'
import {
  type Announcement,
  type AnnouncementAction,
  type AnnouncementPage,
  type AuditEntry,
  type PublicationState,
  type PushAttempt,
  type PushAttemptsResult,
} from './types'

const BASE = '/v1/admin/announcements'

function itemPath(id: string, suffix = '') {
  return `${BASE}/${encodeURIComponent(id)}${suffix}`
}

/** Write payload built from the editor form (null clears optional fields). */
export type AnnouncementInput = Omit<
  Announcement,
  | 'id'
  | 'publicationState'
  | 'publishedAt'
  | 'resolvedAt'
  | 'archivedAt'
  | 'pushStatus'
  | 'attentionRevision'
  | 'revision'
  | 'createdAt'
  | 'updatedAt'
>

export const announcementsApi = {
  list: (state: PublicationState | undefined, cursor: string | undefined) => {
    const params = new URLSearchParams()
    if (state) params.set('publicationState', state)
    if (cursor) params.set('cursor', cursor)
    const query = params.toString()
    return api.get<AnnouncementPage>(query ? `${BASE}?${query}` : BASE)
  },
  save: (id: string | undefined, input: AnnouncementInput) =>
    id
      ? api.patch<Announcement>(itemPath(id), input)
      : api.post<Announcement>(BASE, input),
  run: (
    id: string,
    action: AnnouncementAction,
    body: { reason?: string; sendPush?: boolean } | undefined
  ) => api.post<Partial<Announcement>>(itemPath(id, `/${action}`), body),
  remove: (id: string, reason: string) =>
    api.delete(itemPath(id), reason ? { body: { reason } } : undefined),
  auditLog: (id: string) => api.get<AuditEntry[]>(itemPath(id, '/audit-log')),
  pushAttempts: async (id: string): Promise<PushAttemptsResult> => {
    const result = await api.get<PushAttempt[] | PushAttemptsResult>(
      itemPath(id, '/push-attempts')
    )
    return Array.isArray(result) ? { items: result } : result
  },
}
