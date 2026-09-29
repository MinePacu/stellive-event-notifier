import { api, apiFetch, isApiError } from '@/lib/api'
import {
  type AdminHubEvent,
  type AdminHubEventListResult,
  type HubEventAuditLogEntry,
  type HubEventLifecycleAction,
  type HubEventListFilters,
  type HubEventScheduleDeleteResult,
  type HubEventValidationError,
  type HubEventValidationResult,
} from './types'

const BASE = '/v1/admin/hub-events'

export const hubEventKeys = {
  all: ['hub-events'] as const,
  lists: () => [...hubEventKeys.all, 'list'] as const,
  list: (filters: HubEventListFilters, cursor: string, limit: number) =>
    [...hubEventKeys.lists(), { filters, cursor, limit }] as const,
  auditLogs: () => [...hubEventKeys.all, 'audit-log'] as const,
  auditLog: (id: string) => [...hubEventKeys.auditLogs(), id] as const,
}

function eventPath(id: string, suffix = '') {
  return `${BASE}/${encodeURIComponent(id)}${suffix}`
}

function schedulePath(id: string, scheduleItemId: string, suffix = '') {
  return eventPath(
    id,
    `/schedule-items/${encodeURIComponent(scheduleItemId)}${suffix}`
  )
}

export function listHubEvents(
  filters: HubEventListFilters,
  cursor: string,
  limit: number,
  signal?: AbortSignal
) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (cursor) params.set('cursor', cursor)
  if (filters.publicationState)
    params.set('publicationState', filters.publicationState)
  if (filters.status) params.set('status', filters.status)
  if (filters.category) params.set('category', filters.category)
  if (filters.tag) params.set('tag', filters.tag)
  if (filters.participationMode)
    params.set('participationMode', filters.participationMode)
  if (filters.generationId.trim())
    params.set('generationId', filters.generationId.trim())
  if (filters.memberId.trim()) params.set('memberId', filters.memberId.trim())
  if (filters.includeDeleted) params.set('includeDeleted', 'true')
  if (filters.query.trim()) params.set('query', filters.query.trim())
  return api.get<AdminHubEventListResult>(`${BASE}?${params.toString()}`, {
    signal,
  })
}

export function getHubEvent(id: string) {
  return api.get<AdminHubEvent>(eventPath(id))
}

export async function listHubEventAuditLog(id: string, signal?: AbortSignal) {
  // The route returns a bare array; accept `{ items }` too.
  const result = await api.get<
    HubEventAuditLogEntry[] | { items?: HubEventAuditLogEntry[] }
  >(eventPath(id, '/audit-log'), { signal })
  if (Array.isArray(result)) return result
  return result?.items ?? []
}

/**
 * Validate without saving. The server answers 400 with the same
 * `{ valid: false, errors }` shape when invalid, so both are returned.
 */
export async function validateHubEvent(
  input: Record<string, unknown>
): Promise<HubEventValidationResult> {
  try {
    return await api.post<HubEventValidationResult>(`${BASE}/validate`, input)
  } catch (error) {
    const result = readValidationResult(error)
    if (result) return result
    throw error
  }
}

export function saveHubEvent(
  id: string | undefined,
  input: Record<string, unknown>
) {
  return id
    ? api.put<AdminHubEvent>(eventPath(id), input)
    : api.post<AdminHubEvent>(BASE, input)
}

export function runHubEventAction(
  id: string,
  action: HubEventLifecycleAction,
  reason: string
) {
  const body = reason.trim() ? { reason: reason.trim() } : undefined
  if (action === 'delete') {
    return apiFetch<AdminHubEvent>(eventPath(id), { method: 'DELETE', body })
  }
  return api.post<AdminHubEvent>(eventPath(id, `/${action}`), body)
}

export function saveScheduleItem(
  id: string,
  scheduleItemId: string | undefined,
  input: Record<string, unknown>
) {
  return scheduleItemId
    ? api.patch<AdminHubEvent>(schedulePath(id, scheduleItemId), input)
    : api.post<AdminHubEvent>(eventPath(id, '/schedule-items'), input)
}

export async function cancelScheduleItem(
  id: string,
  scheduleItemId: string,
  expectedRevision: number
) {
  const result = await apiFetch<HubEventScheduleDeleteResult>(
    schedulePath(id, scheduleItemId),
    { method: 'DELETE', body: { expectedRevision } }
  )
  return result.event
}

export function restoreScheduleItem(
  id: string,
  scheduleItemId: string,
  expectedRevision: number
) {
  return api.post<AdminHubEvent>(schedulePath(id, scheduleItemId, '/restore'), {
    expectedRevision,
  })
}

export function setPrimaryScheduleItem(
  id: string,
  scheduleItemId: string,
  expectedRevision: number
) {
  return api.patch<AdminHubEvent>(schedulePath(id, scheduleItemId), {
    expectedRevision,
    isPrimary: true,
  })
}

export function reorderScheduleItems(
  id: string,
  scheduleItemIds: string[],
  expectedRevision: number
) {
  return api.put<AdminHubEvent>(eventPath(id, '/schedule-items/order'), {
    expectedRevision,
    scheduleItemIds,
  })
}

/** `{ valid: false, errors }` from a 400 response, if that is what failed. */
export function readValidationResult(
  error: unknown
): HubEventValidationResult | null {
  if (!isApiError(error) || error.status !== 400) return null
  const body = error.body as { errors?: unknown } | undefined
  if (!body || !Array.isArray(body.errors)) return null
  return { valid: false, errors: body.errors as HubEventValidationError[] }
}

export type RevisionConflict = {
  expectedRevision?: number
  currentRevision?: number
}

/** Details of a 409 revision conflict, if that is what failed. */
export function readRevisionConflict(error: unknown): RevisionConflict | null {
  if (!isApiError(error) || error.status !== 409) return null
  const body = (error.body ?? {}) as Record<string, unknown>
  return {
    expectedRevision:
      typeof body.expectedRevision === 'number'
        ? body.expectedRevision
        : undefined,
    currentRevision:
      typeof body.currentRevision === 'number'
        ? body.currentRevision
        : undefined,
  }
}
