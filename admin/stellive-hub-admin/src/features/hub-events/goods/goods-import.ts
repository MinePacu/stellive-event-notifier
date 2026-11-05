// Goods list paste import (TSV or JSON). TypeScript port of the legacy
// console parser in backend/stellive-hub-api/src/admin/adminGoodsImport.ts;
// keep the two in step while the legacy console still exists.
import { type HubEventGoodsSalesChannel } from '../types'

export const GOODS_IMPORT_MAX_ITEMS = 200

export type GoodsImportErrorCode =
  | 'empty'
  | 'json_parse'
  | 'json_shape'
  | 'too_many'
  | 'item_not_object'
  | 'unknown_column'
  | 'duplicate_column'
  | 'missing_name_column'
  | 'extra_cells'
  | 'number_invalid'
  | 'price_invalid'
  | 'channel_invalid'
  | 'bool_invalid'
  | 'member_unknown'
  | 'schedule_label_unmatched'
  | 'schedule_label_ambiguous'
  | 'schedule_conflict'
  | 'name_required'

export interface GoodsImportError {
  /** 0-based item index (matches the server's `items[i]`), -1 for global errors. */
  row: number
  field: string
  code: GoodsImportErrorCode
  detail: string
}

/** Bulk-replace write item (no id / sortOrder / cancelledAt). */
export type GoodsImportItem = {
  name?: string
  groupLabel?: string
  memberIds?: string[]
  priceKrw?: number
  priceNote?: string
  salesChannel?: HubEventGoodsSalesChannel
  purchaseLimit?: number
  limitNote?: string
  isBonus?: boolean
  purchaseUrl?: string
  scheduleItemId?: string
} & Record<string, unknown>

export interface GoodsImportResult {
  format: 'json' | 'tsv' | ''
  items: GoodsImportItem[]
  errors: GoodsImportError[]
}

export interface GoodsImportMember {
  id: string
  koreanName: string
  englishName?: string
}

export interface GoodsImportScheduleItem {
  id: string
  label?: string
  title?: string
  cancelledAt?: string
}

export interface GoodsImportContext {
  scheduleItems?: GoodsImportScheduleItem[]
  /** null = catalog unavailable; member tokens then pass through as ids. */
  members?: GoodsImportMember[] | null
}

const headerAliases: Record<string, string> = {
  순서: 'sortOrder',
  order: 'sortOrder',
  sortorder: 'sortOrder',
  상품명: 'name',
  상품: 'name',
  이름: 'name',
  name: 'name',
  그룹: 'groupLabel',
  grouplabel: 'groupLabel',
  멤버: 'memberIds',
  memberids: 'memberIds',
  members: 'memberIds',
  가격: 'priceKrw',
  pricekrw: 'priceKrw',
  price: 'priceKrw',
  가격메모: 'priceNote',
  pricenote: 'priceNote',
  채널: 'salesChannel',
  판매채널: 'salesChannel',
  saleschannel: 'salesChannel',
  구매제한: 'purchaseLimit',
  purchaselimit: 'purchaseLimit',
  제한메모: 'limitNote',
  limitnote: 'limitNote',
  특전: 'isBonus',
  isbonus: 'isBonus',
  구매url: 'purchaseUrl',
  purchaseurl: 'purchaseUrl',
  판매차수: 'scheduleItemLabel',
  scheduleitemlabel: 'scheduleItemLabel',
  scheduleitemid: 'scheduleItemId',
}

const channelAliases: Record<string, HubEventGoodsSalesChannel> = {
  현장: 'onsite',
  오프라인: 'onsite',
  onsite: 'onsite',
  온라인: 'online',
  online: 'online',
  '현장/온라인': 'both',
  '온라인/현장': 'both',
  둘다: 'both',
  both: 'both',
}

const trueWords = ['예', '네', 'y', 'yes', 'true', '1', 'o', '특전', '있음']
const falseWords = [
  '아니오',
  '아니요',
  '아니',
  'n',
  'no',
  'false',
  '0',
  'x',
  '없음',
]

const has = (object: object, key: string) =>
  Object.prototype.hasOwnProperty.call(object, key)

function parseCount(value: unknown, suffixPattern: RegExp): number | null {
  const stripped = String(value)
    .replace(/[\s,₩]/g, '')
    .replace(suffixPattern, '')
  return /^\d+$/.test(stripped) ? Number(stripped) : null
}

function mapChannel(value: string): HubEventGoodsSalesChannel | null {
  const key = value
    .replace(/\s/g, '')
    .replace(/[·ㆍ・•,+&]/g, '/')
    .toLowerCase()
  return has(channelAliases, key) ? channelAliases[key] : null
}

function mapBool(value: string): boolean | null {
  const key = value.replace(/\s/g, '').toLowerCase()
  if (trueWords.includes(key)) return true
  if (falseWords.includes(key)) return false
  return null
}

function headerKey(header: string): string {
  const normalized = header.replace(/[\s_-]/g, '').toLowerCase()
  return has(headerAliases, normalized) ? headerAliases[normalized] : ''
}

/** Splits TSV text into cells; double quotes wrap cells with tabs or newlines. */
function parseDelimited(input: string): string[][] {
  const table: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let cellStart = true
  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i)
    if (inQuotes) {
      if (ch === '"') {
        if (input.charAt(i + 1) === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"' && cellStart) {
      inQuotes = true
      cellStart = false
      continue
    }
    if (ch === '\t') {
      row.push(cell)
      cell = ''
      cellStart = true
      continue
    }
    if (ch === '\r') continue
    if (ch === '\n') {
      row.push(cell)
      table.push(row)
      row = []
      cell = ''
      cellStart = true
      continue
    }
    cell += ch
    cellStart = false
  }
  row.push(cell)
  table.push(row)
  return table
}

export function parseGoodsImport(
  text: string,
  context: GoodsImportContext = {}
): GoodsImportResult {
  const scheduleItems = Array.isArray(context.scheduleItems)
    ? context.scheduleItems
    : []
  const members = Array.isArray(context.members) ? context.members : null
  const errors: GoodsImportError[] = []
  const addError = (
    row: number,
    field: string,
    code: GoodsImportErrorCode,
    detail?: unknown
  ) => {
    errors.push({
      row,
      field: field || '',
      code,
      detail: detail === undefined || detail === null ? '' : String(detail),
    })
  }
  const done = (
    format: GoodsImportResult['format'],
    items: GoodsImportItem[]
  ): GoodsImportResult => ({ format, items, errors })

  const trimmed = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
  if (!trimmed) {
    addError(-1, '', 'empty')
    return done('', [])
  }

  let rawRows: unknown[]
  let format: 'json' | 'tsv'
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    format = 'json'
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch (error) {
      addError(
        -1,
        '',
        'json_parse',
        error instanceof Error ? error.message : ''
      )
      return done(format, [])
    }
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { goodsItems?: unknown }).goodsItems)
        ? (parsed as { goodsItems: unknown[] }).goodsItems
        : null
    if (!list) {
      addError(-1, '', 'json_shape')
      return done(format, [])
    }
    rawRows = list
  } else {
    format = 'tsv'
    const rows = tsvToRows(trimmed)
    if (!rows) return done(format, [])
    rawRows = rows
  }

  if (rawRows.length === 0) {
    addError(-1, '', 'empty')
    return done(format, [])
  }
  if (rawRows.length > GOODS_IMPORT_MAX_ITEMS)
    addError(-1, '', 'too_many', GOODS_IMPORT_MAX_ITEMS)

  const normalized = rawRows.map((raw, index) => normalizeItem(raw, index))
  const orders = normalized.map((entry) => entry.order)
  let items = normalized.map((entry) => entry.item)
  if (orders.every((value): value is number => typeof value === 'number')) {
    const indexes = items.map((_item, index) => index)
    indexes.sort(
      (left, right) =>
        (orders[left] as number) - (orders[right] as number) || left - right
    )
    // Explicit order values reorder the items; error rows are remapped so
    // they keep pointing at the right item.
    if (indexes.some((value, position) => value !== position)) {
      const remap = new Map<number, number>()
      indexes.forEach((oldIndex, newIndex) => remap.set(oldIndex, newIndex))
      for (const error of errors) {
        if (error.row >= 0 && remap.has(error.row))
          error.row = remap.get(error.row) as number
      }
      items = indexes.map((oldIndex) => items[oldIndex])
    }
  }
  return done(format, items)

  function tsvToRows(input: string): Record<string, unknown>[] | null {
    const table = parseDelimited(input).filter((cells) =>
      cells.some((cell) => cell.trim() !== '')
    )
    if (table.length === 0) {
      addError(-1, '', 'empty')
      return null
    }
    const keys: string[] = []
    const seen: Record<string, boolean> = {}
    let headerOk = true
    for (const header of table[0].map((cell) => cell.trim())) {
      const key = headerKey(header)
      if (!key) {
        addError(-1, header, 'unknown_column', header)
        headerOk = false
        keys.push('')
        continue
      }
      if (seen[key]) {
        addError(-1, header, 'duplicate_column', header)
        headerOk = false
      }
      seen[key] = true
      keys.push(key)
    }
    if (!seen.name) {
      addError(-1, 'name', 'missing_name_column')
      headerOk = false
    }
    if (!headerOk) return null
    return table.slice(1).map((cells) => {
      const row: Record<string, unknown> = {}
      cells.forEach((cell, cellIndex) => {
        const value = cell.trim()
        if (cellIndex >= keys.length) {
          if (value) row.__extraCells = true
          return
        }
        if (value) row[keys[cellIndex]] = value
      })
      return row
    })
  }

  function resolveMember(token: string): string | null {
    if (!members) return token
    const lower = token.toLowerCase()
    let found = members.filter(
      (member) => String(member.id).toLowerCase() === lower
    )
    if (found.length === 0)
      found = members.filter((member) => member.koreanName === token)
    if (found.length === 0)
      found = members.filter(
        (member) => String(member.englishName ?? '').toLowerCase() === lower
      )
    if (found.length === 0) {
      // Short names: "유니" for "아야츠노 유니" (one whitespace-separated part
      // of the name, and only if unambiguous).
      found = members.filter(
        (member) =>
          String(member.koreanName ?? '')
            .split(/\s+/)
            .includes(token) ||
          String(member.englishName ?? '')
            .toLowerCase()
            .split(/\s+/)
            .includes(lower)
      )
    }
    return found.length === 1 ? found[0].id : null
  }

  function resolveScheduleLabel(label: string) {
    const active = scheduleItems.filter((item) => !item.cancelledAt)
    let matches = active.filter(
      (item) => String(item.label ?? '').trim() === label
    )
    if (matches.length === 0)
      matches = active.filter(
        (item) =>
          !String(item.label ?? '').trim() &&
          String(item.title ?? '').trim() === label
      )
    return matches
  }

  function normalizeItem(
    raw: unknown,
    index: number
  ): { item: GoodsImportItem; order: number | null } {
    const out: GoodsImportItem = {}
    let order: number | null = null
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      addError(index, '', 'item_not_object')
      return { item: out, order: null }
    }
    const source = raw as Record<string, unknown>
    if (source.__extraCells) addError(index, '', 'extra_cells')
    const dropped = new Set([
      'id',
      'createdAt',
      'updatedAt',
      'hubEventId',
      'cancelledAt',
      '__extraCells',
    ])
    for (const key of Object.keys(source)) {
      if (dropped.has(key)) continue
      const value = source[key]
      if (key === 'sortOrder') {
        if (typeof value === 'number' && Number.isFinite(value)) order = value
        else if (typeof value === 'string' && value.trim() !== '') {
          const parsedOrder = parseCount(value, /$^/)
          if (parsedOrder === null)
            addError(index, key, 'number_invalid', value)
          else order = parsedOrder
        } else if (value !== null && value !== undefined && value !== '')
          addError(index, key, 'number_invalid', value)
        continue
      }
      if (key === 'scheduleItemLabel') {
        if (
          value === null ||
          value === undefined ||
          (typeof value === 'string' && value.trim() === '')
        )
          continue
        if (typeof value !== 'string') {
          addError(index, key, 'schedule_label_unmatched', value)
          continue
        }
        const label = value.trim()
        const matches = resolveScheduleLabel(label)
        if (matches.length === 0)
          addError(index, key, 'schedule_label_unmatched', label)
        else if (matches.length > 1)
          addError(index, key, 'schedule_label_ambiguous', label)
        else if (out.scheduleItemId && out.scheduleItemId !== matches[0].id)
          addError(index, key, 'schedule_conflict', label)
        else out.scheduleItemId = matches[0].id
        continue
      }
      if (key === 'scheduleItemId') {
        if (typeof value === 'string' && value.trim() === '') continue
        if (out.scheduleItemId && value && out.scheduleItemId !== value) {
          addError(index, 'scheduleItemLabel', 'schedule_conflict', value)
          continue
        }
        if (value !== null && value !== undefined)
          out.scheduleItemId = value as string
        continue
      }
      if (key === 'memberIds') {
        let tokens: unknown[]
        if (Array.isArray(value)) tokens = value
        else if (typeof value === 'string') tokens = value.split(/[,;，、]/)
        else if (value === null || value === undefined) continue
        else {
          addError(index, key, 'member_unknown', value)
          continue
        }
        const ids: string[] = []
        for (const token of tokens) {
          if (
            token !== null &&
            token !== undefined &&
            typeof token !== 'string'
          ) {
            addError(index, key, 'member_unknown', token)
            continue
          }
          const text = typeof token === 'string' ? token.trim() : ''
          if (!text) continue
          const id = resolveMember(text)
          if (id === null) {
            addError(index, key, 'member_unknown', text)
            continue
          }
          if (!ids.includes(id)) ids.push(id)
        }
        out.memberIds = ids
        continue
      }
      if (typeof value === 'string') {
        const cell = value.trim()
        if (cell === '') continue
        if (key === 'priceKrw') {
          const price = parseCount(cell, /(원|krw)$/i)
          if (price === null) addError(index, key, 'price_invalid', cell)
          else out[key] = price
        } else if (key === 'purchaseLimit') {
          const limit = parseCount(cell, /(개|명|점)$/)
          if (limit === null) addError(index, key, 'number_invalid', cell)
          else out[key] = limit
        } else if (key === 'salesChannel') {
          const channel = mapChannel(cell)
          if (channel === null) addError(index, key, 'channel_invalid', cell)
          else out[key] = channel
        } else if (key === 'isBonus') {
          const flag = mapBool(cell)
          if (flag === null) addError(index, key, 'bool_invalid', cell)
          else out[key] = flag
        } else {
          out[key] = cell
        }
        continue
      }
      out[key] = value
    }
    if (typeof out.name !== 'string' || out.name === '')
      addError(index, 'name', 'name_required')
    return { item: out, order }
  }
}

/** `items[3].priceKrw` -> `{ row: 3, field: 'priceKrw' }`; null if not an item path. */
export function parseGoodsServerErrorField(
  field: string | undefined
): { row: number; field: string } | null {
  const match = /^items\[(\d+)\](?:\.(.+))?$/.exec(String(field ?? ''))
  return match ? { row: Number(match[1]), field: match[2] || '' } : null
}

/** Strips list indexes so `memberIds[2]` addresses the memberIds control. */
export function goodsFieldControlName(field: string | undefined): string {
  return String(field ?? '').replace(/\[\d+\].*$/, '')
}
