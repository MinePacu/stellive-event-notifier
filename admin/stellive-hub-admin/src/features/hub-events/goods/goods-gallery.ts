// Official MD list image gallery (`goodsListImages`). TypeScript port of the
// legacy console parser in backend/stellive-hub-api/src/admin/adminGoodsGallery.ts;
// keep the two in step while the legacy console still exists.
import {
  HUB_EVENT_GOODS_LIST_IMAGE_KINDS,
  HUB_EVENT_IMAGE_POLICY_STATES,
  type HubEventGoodsListImage,
  type HubEventGoodsListImageKind,
  type HubEventImagePolicyState,
} from '../types'

export const GOODS_GALLERY_MAX = 20
export const GOODS_GALLERY_DEFAULT_LABEL = '공식 공지'
export const GOODS_GALLERY_ALT_PREFIXES: Record<
  HubEventGoodsListImageKind,
  string
> = { md: 'MD 리스트 ', bonus: '특전 리스트 ' }

/** Editor row; empty string means unset. */
export interface GoodsGalleryRow {
  policyState: HubEventImagePolicyState
  kind: HubEventGoodsListImageKind
  url: string
  altText: string
  sourceLabel: string
  sourceUrl: string
}

export type GoodsGalleryErrorCode =
  | 'empty'
  | 'json_parse'
  | 'json_shape'
  | 'too_many'
  | 'item_not_object'
  | 'field_not_string'
  | 'policy_invalid'
  | 'kind_invalid'
  | 'url_required'
  | 'url_invalid'
  | 'url_not_https'
  | 'source_url_not_https'
  | 'source_url_required'
  | 'source_label_required'

export type GoodsGalleryWarningCode = 'host_not_allowed' | 'duplicate_url'

export interface GoodsGalleryIssue<C extends string> {
  /** 0-based entry index, -1 for the whole list. */
  index: number
  field: string
  code: C
  detail: string
}

export type GoodsGalleryError = GoodsGalleryIssue<GoodsGalleryErrorCode>
export type GoodsGalleryWarning = GoodsGalleryIssue<GoodsGalleryWarningCode>

export interface GoodsGalleryParseResult {
  format: 'json' | 'lines' | ''
  images: (GoodsGalleryRow | null)[]
  errors: GoodsGalleryError[]
  warnings: GoodsGalleryWarning[]
}

export interface GoodsGalleryParseContext {
  sourceUrl?: string
  sourceLabel?: string
  startIndex?: number
  existingUrls?: string[]
  existingKinds?: string[]
}

const isPolicyState = (value: unknown): value is HubEventImagePolicyState =>
  (HUB_EVENT_IMAGE_POLICY_STATES as readonly unknown[]).includes(value)
const isKind = (value: unknown): value is HubEventGoodsListImageKind =>
  (HUB_EVENT_GOODS_LIST_IMAGE_KINDS as readonly unknown[]).includes(value)

/** Same host rule as the server: stellive.me, any subdomain of it, or pbs.twimg.com. */
export function isGoodsGalleryAllowedHost(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase()
  return (
    host === 'pbs.twimg.com' ||
    host === 'stellive.me' ||
    /\.stellive\.me$/.test(host)
  )
}

function parseUrl(value: string): URL | null {
  if (!value || /\s/.test(value)) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function newGoodsGalleryRow(
  image?: Partial<HubEventGoodsListImage> | Partial<GoodsGalleryRow> | null
): GoodsGalleryRow {
  const source = image ?? {}
  return {
    policyState: source.policyState || 'official_runtime_url',
    kind: source.kind === 'bonus' ? 'bonus' : 'md',
    url: source.url || '',
    altText: source.altText || '',
    sourceLabel: source.sourceLabel || '',
    sourceUrl: source.sourceUrl || '',
  }
}

/** Editor row with a client-only React key. */
export type GalleryDraft = GoodsGalleryRow & { key: string }

let galleryKeySeed = 0
export function toGalleryDraft(
  image?: Parameters<typeof newGoodsGalleryRow>[0]
): GalleryDraft {
  galleryKeySeed += 1
  return { ...newGoodsGalleryRow(image), key: `gallery-${galleryKeySeed}` }
}

/**
 * Client-side checks for an ordered list of images; null entries are skipped.
 * existingUrls: urls already in the list before these images (duplicates only).
 */
export function goodsGalleryCheckImages(
  images: (Partial<GoodsGalleryRow> | null)[],
  existingUrls: string[] = []
): { errors: GoodsGalleryError[]; warnings: GoodsGalleryWarning[] } {
  const errors: GoodsGalleryError[] = []
  const warnings: GoodsGalleryWarning[] = []
  const seen = new Set(
    existingUrls.map((url) => String(url || '').trim()).filter(Boolean)
  )
  const issue = <C extends string>(
    index: number,
    field: string,
    code: C,
    detail?: unknown
  ): GoodsGalleryIssue<C> => ({
    index,
    field,
    code,
    detail: detail === undefined || detail === null ? '' : String(detail),
  })
  images.forEach((image, index) => {
    if (!image) return
    const policy = image.policyState || ''
    if (policy === 'none') return
    const url = String(image.url ?? '').trim()
    const needsSource =
      policy === 'official_runtime_url' || policy === 'third_party_allowed'
    if (!url) {
      errors.push(issue(index, 'url', 'url_required'))
    } else {
      const parsed = parseUrl(url)
      if (!parsed) {
        errors.push(issue(index, 'url', 'url_invalid'))
      } else if (parsed.protocol !== 'https:') {
        errors.push(issue(index, 'url', 'url_not_https'))
      } else if (
        policy === 'official_runtime_url' &&
        !isGoodsGalleryAllowedHost(parsed.hostname)
      ) {
        warnings.push(issue(index, 'url', 'host_not_allowed', parsed.hostname))
      }
      if (seen.has(url)) warnings.push(issue(index, 'url', 'duplicate_url'))
      seen.add(url)
    }
    const sourceUrl = String(image.sourceUrl ?? '').trim()
    if (sourceUrl) {
      const parsedSource = parseUrl(sourceUrl)
      if (!parsedSource || parsedSource.protocol !== 'https:')
        errors.push(issue(index, 'sourceUrl', 'source_url_not_https'))
    } else if (needsSource) {
      errors.push(issue(index, 'sourceUrl', 'source_url_required'))
    }
    if (needsSource && !String(image.sourceLabel ?? '').trim())
      errors.push(issue(index, 'sourceLabel', 'source_label_required'))
  })
  return { errors, warnings }
}

/** Parses one URL per line, or `{ goodsListImages: [...] }` / a bare JSON array. */
export function parseGoodsGalleryImport(
  text: string,
  context: GoodsGalleryParseContext = {}
): GoodsGalleryParseResult {
  const startIndex =
    typeof context.startIndex === 'number' && context.startIndex > 0
      ? context.startIndex
      : 0
  const defaultSourceLabel =
    context.sourceLabel === undefined || context.sourceLabel === null
      ? GOODS_GALLERY_DEFAULT_LABEL
      : String(context.sourceLabel)
  const defaultSourceUrl = context.sourceUrl
    ? String(context.sourceUrl).trim()
    : ''
  // Alt text numbering is per kind and continues after the existing rows.
  const kindCounts = { md: 0, bonus: 0 }
  if (Array.isArray(context.existingKinds)) {
    for (const kind of context.existingKinds)
      kindCounts[kind === 'bonus' ? 'bonus' : 'md'] += 1
  } else {
    kindCounts.md = startIndex
  }
  const errors: GoodsGalleryError[] = []
  const addError = (
    index: number,
    field: string,
    code: GoodsGalleryErrorCode,
    detail?: unknown
  ) =>
    errors.push({
      index,
      field,
      code,
      detail: detail === undefined || detail === null ? '' : String(detail),
    })
  const done = (
    format: GoodsGalleryParseResult['format'],
    images: (GoodsGalleryRow | null)[],
    warnings: GoodsGalleryWarning[] = []
  ): GoodsGalleryParseResult => ({ format, images, errors, warnings })

  const trimmed = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
  if (!trimmed) {
    addError(-1, '', 'empty')
    return done('', [])
  }

  let rawEntries: unknown[]
  let format: 'json' | 'lines'
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
    if (Array.isArray(parsed)) {
      rawEntries = parsed
    } else if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { goodsListImages?: unknown }).goodsListImages)
    ) {
      rawEntries = (parsed as { goodsListImages: unknown[] }).goodsListImages
    } else {
      addError(-1, '', 'json_shape')
      return done(format, [])
    }
  } else {
    format = 'lines'
    rawEntries = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '')
  }

  if (startIndex + rawEntries.length > GOODS_GALLERY_MAX)
    addError(-1, '', 'too_many', GOODS_GALLERY_MAX)

  const textFields = ['url', 'altText', 'sourceLabel', 'sourceUrl'] as const
  const images = rawEntries.map((raw, index): GoodsGalleryRow | null => {
    let entry: Record<string, unknown>
    if (typeof raw === 'string') {
      entry = { url: raw }
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      entry = raw as Record<string, unknown>
    } else {
      addError(index, '', 'item_not_object')
      return null
    }
    let policyState: HubEventImagePolicyState = 'official_runtime_url'
    if (
      entry.policyState !== undefined &&
      entry.policyState !== null &&
      entry.policyState !== ''
    ) {
      if (!isPolicyState(entry.policyState))
        addError(index, 'policyState', 'policy_invalid', entry.policyState)
      else policyState = entry.policyState
    }
    let kind: HubEventGoodsListImageKind = 'md'
    if (entry.kind !== undefined && entry.kind !== null && entry.kind !== '') {
      if (!isKind(entry.kind))
        addError(index, 'kind', 'kind_invalid', entry.kind)
      else kind = entry.kind
    }
    kindCounts[kind] += 1
    const image: GoodsGalleryRow = {
      policyState,
      kind,
      url: '',
      altText: '',
      sourceLabel: '',
      sourceUrl: '',
    }
    for (const field of textFields) {
      const value = entry[field]
      if (value === undefined || value === null) continue
      if (typeof value !== 'string') {
        addError(index, field, 'field_not_string')
        continue
      }
      image[field] = value.trim()
    }
    if (policyState !== 'none') {
      if (!image.altText)
        image.altText = GOODS_GALLERY_ALT_PREFIXES[kind] + kindCounts[kind]
      if (!image.sourceLabel) image.sourceLabel = defaultSourceLabel
      if (!image.sourceUrl) image.sourceUrl = defaultSourceUrl
    }
    return image
  })

  const checked = goodsGalleryCheckImages(images, context.existingUrls)
  errors.push(...checked.errors)
  return done(format, images, checked.warnings)
}

/** Request body value for `goodsListImages` (empty strings are omitted). */
export function buildGoodsGalleryPayload(
  rows: GoodsGalleryRow[]
): HubEventGoodsListImage[] {
  return rows.map((row) => {
    const out: HubEventGoodsListImage = {
      policyState: row.policyState || 'official_runtime_url',
    }
    if (out.policyState === 'none') return out
    out.kind = row.kind === 'bonus' ? 'bonus' : 'md'
    for (const field of [
      'url',
      'altText',
      'sourceLabel',
      'sourceUrl',
    ] as const) {
      const value = String(row[field] ?? '').trim()
      if (value) out[field] = value
    }
    return out
  })
}

/** `goodsListImages.3.url` -> `{ row: 3, field: 'url' }`; row -1 for the list itself. */
export function parseGoodsGalleryServerErrorField(
  field: string | undefined
): { row: number; field: string } | null {
  const match = /^goodsListImages(?:\.(\d+)(?:\.(.+))?)?$/.exec(
    String(field ?? '')
  )
  if (!match) return null
  return {
    row: match[1] === undefined ? -1 : Number(match[1]),
    field: match[2] || '',
  }
}
