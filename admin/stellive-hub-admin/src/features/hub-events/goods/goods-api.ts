import { useQuery } from '@tanstack/react-query'
import { api, apiFetch } from '@/lib/api'
import { type AdminHubEvent } from '../types'
import { type GoodsImportItem } from './goods-import'

const BASE = '/v1/admin/hub-events'

function goodsPath(id: string, suffix = '') {
  return `${BASE}/${encodeURIComponent(id)}/goods-items${suffix}`
}

function itemPath(id: string, goodsItemId: string, suffix = '') {
  return goodsPath(id, `/${encodeURIComponent(goodsItemId)}${suffix}`)
}

/** Create (no goodsItemId) or update one goods item. */
export function saveGoodsItem(
  id: string,
  goodsItemId: string | undefined,
  input: Record<string, unknown>
) {
  return goodsItemId
    ? api.patch<AdminHubEvent>(itemPath(id, goodsItemId), input)
    : api.post<AdminHubEvent>(goodsPath(id), input)
}

export function cancelGoodsItem(
  id: string,
  goodsItemId: string,
  expectedRevision: number
) {
  return apiFetch<AdminHubEvent>(itemPath(id, goodsItemId), {
    method: 'DELETE',
    body: { expectedRevision },
  })
}

export function restoreGoodsItem(
  id: string,
  goodsItemId: string,
  expectedRevision: number
) {
  return api.post<AdminHubEvent>(itemPath(id, goodsItemId, '/restore'), {
    expectedRevision,
  })
}

export function reorderGoodsItems(
  id: string,
  goodsItemIds: string[],
  expectedRevision: number
) {
  return api.put<AdminHubEvent>(goodsPath(id, '/order'), {
    expectedRevision,
    goodsItemIds,
  })
}

/** Replaces every goods item (cancelled ones included) in one transaction. */
export function replaceGoodsItems(
  id: string,
  items: GoodsImportItem[],
  expectedRevision: number
) {
  return api.put<AdminHubEvent>(goodsPath(id), { expectedRevision, items })
}

export interface GoodsMember {
  id: string
  koreanName: string
  englishName?: string
  generationId?: string
  generationName?: string
}

type CatalogMember = GoodsMember & {
  isPerson?: boolean
  activeStatus?: string
}

/**
 * Members that goods items may reference: active / upcoming people from the
 * public catalog, without the representative (same filter as the legacy
 * console). The server re-validates every id.
 */
export function useGoodsMembers() {
  return useQuery({
    queryKey: ['goods-members'],
    queryFn: async ({ signal }) => {
      const list = await api.get<CatalogMember[]>('/v1/members', { signal })
      return (Array.isArray(list) ? list : []).filter(
        (member) =>
          member &&
          member.isPerson !== false &&
          member.id !== 'gangzi' &&
          (member.activeStatus === 'active' ||
            member.activeStatus === 'upcoming')
      )
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
}
