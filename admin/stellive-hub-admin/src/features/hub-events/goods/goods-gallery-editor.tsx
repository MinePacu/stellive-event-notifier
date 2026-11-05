import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ImageOff, Plus, X } from 'lucide-react'
import { type MessageKey, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  HUB_EVENT_GOODS_LIST_IMAGE_KINDS,
  HUB_EVENT_IMAGE_POLICY_STATES,
  type HubEventGoodsListImageKind,
  type HubEventImagePolicyState,
  type HubEventValidationError,
} from '../types'
import { issueText } from './goods-format'
import {
  GOODS_GALLERY_ALT_PREFIXES,
  GOODS_GALLERY_DEFAULT_LABEL,
  GOODS_GALLERY_MAX,
  type GalleryDraft,
  type GoodsGalleryError,
  type GoodsGalleryRow,
  type GoodsGalleryWarning,
  goodsGalleryCheckImages,
  parseGoodsGalleryImport,
  parseGoodsGalleryServerErrorField,
  toGalleryDraft,
} from './goods-gallery'

const policyLabelKeys: Record<HubEventImagePolicyState, MessageKey> = {
  none: 'goodsGallery.policy.none',
  official_runtime_url: 'goodsGallery.policy.official_runtime_url',
  third_party_allowed: 'goodsGallery.policy.third_party_allowed',
  verify_required: 'goodsGallery.policy.verify_required',
  blocked: 'goodsGallery.policy.blocked',
}

const kindLabelKeys: Record<HubEventGoodsListImageKind, MessageKey> = {
  md: 'goodsGallery.kindOption.md',
  bonus: 'goodsGallery.kindOption.bonus',
}

type TextField = 'url' | 'altText' | 'sourceLabel' | 'sourceUrl'

type ImportResult = {
  errors: GoodsGalleryError[]
  warnings: GoodsGalleryWarning[]
  applied: number
}

type GoodsGalleryEditorProps = {
  rows: GalleryDraft[]
  dirty: boolean
  /** Validation errors from the last event validate / save. */
  serverErrors: HubEventValidationError[]
  disabled: boolean
  /** The event's official notice URL, used as the default image source. */
  defaultSourceUrl: () => string
  onChange: (rows: GalleryDraft[]) => void
}

/**
 * Edits `goodsListImages`. Changes stay local until the event itself is
 * saved; an untouched gallery is never sent, so it cannot be cleared by
 * accident.
 */
export function GoodsGalleryEditor({
  rows,
  dirty,
  serverErrors,
  disabled,
  defaultSourceUrl,
  onChange,
}: GoodsGalleryEditorProps) {
  const t = useT()
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [pendingReplace, setPendingReplace] = useState<GalleryDraft[] | null>(
    null
  )
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({})

  const checked = useMemo(() => goodsGalleryCheckImages(rows), [rows])
  const { rowServerErrors, globalServerErrors } = useMemo(() => {
    const perRow = new Map<number, { field: string; text: string }[]>()
    const global: string[] = []
    for (const error of serverErrors) {
      const parsed = parseGoodsGalleryServerErrorField(error.field)
      if (!parsed) continue
      const text = [parsed.field || error.field, error.reason, error.message]
        .filter(Boolean)
        .join(' - ')
      if (parsed.row >= 0 && parsed.row < rows.length)
        perRow.set(parsed.row, [
          ...(perRow.get(parsed.row) ?? []),
          { field: parsed.field, text },
        ])
      else global.push(text)
    }
    return { rowServerErrors: perRow, globalServerErrors: global }
  }, [serverErrors, rows.length])

  const updateRow = (index: number, patch: Partial<GoodsGalleryRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const next = rows.slice()
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onChange(next)
  }

  const addRow = () => {
    if (rows.length >= GOODS_GALLERY_MAX) return
    onChange([
      ...rows,
      toGalleryDraft({
        policyState: 'official_runtime_url',
        kind: 'md',
        altText:
          GOODS_GALLERY_ALT_PREFIXES.md +
          (rows.filter((row) => row.kind !== 'bonus').length + 1),
        sourceLabel: GOODS_GALLERY_DEFAULT_LABEL,
        sourceUrl: defaultSourceUrl(),
      }),
    ])
  }

  const runImport = (mode: 'append' | 'replace') => {
    const base = mode === 'replace' ? [] : rows
    const result = parseGoodsGalleryImport(importText, {
      sourceUrl: defaultSourceUrl(),
      sourceLabel: GOODS_GALLERY_DEFAULT_LABEL,
      startIndex: base.length,
      existingUrls: base.map((row) => row.url),
      existingKinds: base.map((row) => row.kind),
    })
    if (result.errors.length > 0) {
      setImportResult({
        errors: result.errors,
        warnings: result.warnings,
        applied: 0,
      })
      return
    }
    const next = [
      ...base,
      ...result.images.map((image) => toGalleryDraft(image)),
    ]
    const finish = () => {
      onChange(next)
      setImportText('')
      setImportResult({
        errors: [],
        warnings: result.warnings,
        applied: result.images.length,
      })
    }
    if (mode === 'replace' && rows.length > 0) {
      setPendingReplace(next)
      // Remember the warnings for after the confirmation.
      setImportResult({
        errors: [],
        warnings: result.warnings,
        applied: 0,
      })
      return
    }
    finish()
  }

  const confirmReplace = () => {
    if (!pendingReplace) return
    onChange(pendingReplace)
    setImportText('')
    setImportResult((previous) => ({
      errors: [],
      warnings: previous?.warnings ?? [],
      applied: pendingReplace.length,
    }))
    setPendingReplace(null)
  }

  const importIssueText = (
    kind: 'err' | 'warn',
    issue: GoodsGalleryError | GoodsGalleryWarning
  ) => {
    const text = issueText(
      t,
      `goodsGallery.${kind}.`,
      issue.code,
      kind === 'err' ? 'goodsGallery.err.unknown' : 'goodsGallery.warn.unknown',
      { detail: issue.detail }
    )
    return issue.index >= 0
      ? `${t('goodsGallery.importRow', { row: issue.index + 1 })}: ${
          issue.field ? `${issue.field} - ` : ''
        }${text}`
      : text
  }

  const textFields: { name: TextField; label: MessageKey; wide?: boolean }[] = [
    { name: 'url', label: 'goodsGallery.url', wide: true },
    { name: 'altText', label: 'goodsGallery.altText' },
    { name: 'sourceLabel', label: 'goodsGallery.sourceLabel' },
    { name: 'sourceUrl', label: 'goodsGallery.sourceUrl' },
  ]

  return (
    <section className='grid gap-3'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div className='min-w-0 space-y-1'>
          <h3 className='font-semibold'>{t('goodsGallery.title')}</h3>
          <p className='text-sm text-muted-foreground'>
            {t('goodsGallery.help')}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-medium' aria-live='polite'>
            {t('goodsGallery.count', {
              count: rows.length,
              max: GOODS_GALLERY_MAX,
            })}
          </span>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={addRow}
            disabled={disabled || rows.length >= GOODS_GALLERY_MAX}
          >
            <Plus />
            {t('goodsGallery.add')}
          </Button>
        </div>
      </div>

      {dirty ? (
        <Alert>
          <AlertDescription>{t('goodsGallery.unsaved')}</AlertDescription>
        </Alert>
      ) : null}
      {globalServerErrors.length ? (
        <Alert variant='destructive'>
          <AlertDescription>
            <ul className='list-disc ps-4'>
              {globalServerErrors.map((text, index) => (
                <li key={index}>{text}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          {t('goodsGallery.empty')}
        </p>
      ) : (
        <div className='grid gap-2'>
          {rows.map((row, index) => {
            const errors = [
              ...checked.errors
                .filter((issue) => issue.index === index)
                .map((issue) => ({
                  field: issue.field,
                  text: issueText(
                    t,
                    'goodsGallery.err.',
                    issue.code,
                    'goodsGallery.err.unknown',
                    { detail: issue.detail }
                  ),
                })),
              ...(rowServerErrors.get(index) ?? []),
            ]
            const warnings = checked.warnings
              .filter((issue) => issue.index === index)
              .map((issue) =>
                issueText(
                  t,
                  'goodsGallery.warn.',
                  issue.code,
                  'goodsGallery.warn.unknown',
                  { detail: issue.detail }
                )
              )
            const invalidFields = new Set(errors.map((error) => error.field))
            const thumbUrl = /^https:\/\//i.test(row.url.trim())
              ? row.url.trim()
              : ''
            const broken = Boolean(thumbUrl && brokenThumbs[thumbUrl])
            const idPrefix = `hub-event-gallery-${row.key}`
            return (
              <div
                key={row.key}
                aria-invalid={errors.length > 0 || undefined}
                className={cn(
                  'grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-[96px_minmax(0,1fr)]',
                  errors.length > 0 && 'border-destructive'
                )}
              >
                <div className='grid h-40 w-full place-items-center overflow-hidden rounded border bg-background sm:h-32 sm:w-24'>
                  {thumbUrl && !broken ? (
                    <img
                      src={thumbUrl}
                      alt=''
                      loading='lazy'
                      decoding='async'
                      referrerPolicy='no-referrer'
                      className='size-full object-cover'
                      onError={() =>
                        setBrokenThumbs((previous) => ({
                          ...previous,
                          [thumbUrl]: true,
                        }))
                      }
                    />
                  ) : (
                    <span className='grid justify-items-center gap-1 p-1 text-center text-[11px] text-muted-foreground'>
                      <ImageOff className='size-4' />
                      {broken ? t('goodsGallery.thumbFailed') : null}
                    </span>
                  )}
                </div>
                <div className='grid min-w-0 gap-2'>
                  <div className='flex items-center justify-between gap-2'>
                    <strong className='text-sm'>
                      {t('goodsGallery.rowLabel', { n: index + 1 })}
                    </strong>
                    <div className='flex gap-1'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        aria-label={t('goodsGallery.moveUp')}
                        title={t('goodsGallery.moveUp')}
                        onClick={() => move(index, -1)}
                        disabled={disabled || index === 0}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        aria-label={t('goodsGallery.moveDown')}
                        title={t('goodsGallery.moveDown')}
                        onClick={() => move(index, 1)}
                        disabled={disabled || index === rows.length - 1}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        aria-label={t('goodsGallery.remove')}
                        title={t('goodsGallery.remove')}
                        onClick={() =>
                          onChange(rows.filter((_row, i) => i !== index))
                        }
                        disabled={disabled}
                      >
                        <X />
                      </Button>
                    </div>
                  </div>
                  <div className='grid gap-2 sm:grid-cols-2'>
                    {textFields.map((field) => (
                      <label
                        key={field.name}
                        htmlFor={`${idPrefix}-${field.name}`}
                        className={cn(
                          'grid min-w-0 gap-1 text-xs text-muted-foreground',
                          field.wide && 'sm:col-span-2'
                        )}
                      >
                        {t(field.label)}
                        <Input
                          id={`${idPrefix}-${field.name}`}
                          type={
                            field.name === 'url' || field.name === 'sourceUrl'
                              ? 'url'
                              : 'text'
                          }
                          autoComplete='off'
                          spellCheck={false}
                          value={row[field.name]}
                          aria-invalid={
                            invalidFields.has(field.name) || undefined
                          }
                          disabled={disabled}
                          onChange={(event) =>
                            updateRow(index, {
                              [field.name]: event.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
                    <div className='grid min-w-0 gap-1 text-xs text-muted-foreground'>
                      <span id={`${idPrefix}-kind-label`}>
                        {t('goodsGallery.kind')}
                      </span>
                      <Select
                        value={row.kind}
                        onValueChange={(value) =>
                          updateRow(index, {
                            kind: value as HubEventGoodsListImageKind,
                          })
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger
                          className='w-full'
                          aria-labelledby={`${idPrefix}-kind-label`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HUB_EVENT_GOODS_LIST_IMAGE_KINDS.map((kind) => (
                            <SelectItem key={kind} value={kind}>
                              {t(kindLabelKeys[kind])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='grid min-w-0 gap-1 text-xs text-muted-foreground'>
                      <span id={`${idPrefix}-policy-label`}>
                        {t('goodsGallery.policyState')}
                      </span>
                      <Select
                        value={row.policyState}
                        onValueChange={(value) =>
                          updateRow(index, {
                            policyState: value as HubEventImagePolicyState,
                          })
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger
                          className='w-full'
                          aria-labelledby={`${idPrefix}-policy-label`}
                          aria-invalid={
                            invalidFields.has('policyState') || undefined
                          }
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HUB_EVENT_IMAGE_POLICY_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {t(policyLabelKeys[state])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {errors.length || warnings.length ? (
                    <ul className='list-disc ps-4 text-xs' aria-live='polite'>
                      {errors.map((error, errorIndex) => (
                        <li key={`e${errorIndex}`} className='text-destructive'>
                          {error.text}
                        </li>
                      ))}
                      {warnings.map((text, warningIndex) => (
                        <li
                          key={`w${warningIndex}`}
                          className='text-amber-700 dark:text-amber-400'
                        >
                          {text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className='grid gap-2 rounded-md border p-3'>
        <div className='space-y-1'>
          <h4 className='text-sm font-semibold'>
            {t('goodsGallery.importTitle')}
          </h4>
          <p className='text-sm text-muted-foreground'>
            {t('goodsGallery.importHelp')}
          </p>
        </div>
        <Textarea
          rows={5}
          spellCheck={false}
          className='font-mono text-xs'
          placeholder={t('goodsGallery.importPlaceholder')}
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          aria-label={t('goodsGallery.importTitle')}
        />
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => runImport('append')}
            disabled={disabled || !importText.trim()}
          >
            {t('goodsGallery.importAppend')}
          </Button>
          <Button
            type='button'
            variant='destructive'
            size='sm'
            onClick={() => runImport('replace')}
            disabled={disabled || !importText.trim()}
          >
            {t('goodsGallery.importReplace')}
          </Button>
        </div>
        {importResult ? (
          <div className='grid gap-2 text-sm' aria-live='polite'>
            {importResult.errors.length ? (
              <div className='text-destructive'>
                <strong>
                  {t('goodsGallery.importErrors', {
                    count: importResult.errors.length,
                  })}
                </strong>
                <ul className='list-disc ps-4 text-xs'>
                  {importResult.errors.map((issue, index) => (
                    <li key={index}>{importIssueText('err', issue)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {importResult.applied > 0 ? (
              <p className='text-muted-foreground'>
                {t('goodsGallery.importApplied', {
                  count: importResult.applied,
                })}
              </p>
            ) : null}
            {importResult.warnings.length && importResult.applied > 0 ? (
              <div className='text-amber-700 dark:text-amber-400'>
                <strong>
                  {t('goodsGallery.importWarnings', {
                    count: importResult.warnings.length,
                  })}
                </strong>
                <ul className='list-disc ps-4 text-xs'>
                  {importResult.warnings.map((issue, index) => (
                    <li key={index}>{importIssueText('warn', issue)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingReplace !== null}
        onOpenChange={(open) => !open && setPendingReplace(null)}
        title={t('goodsGallery.importReplaceConfirmTitle')}
        desc={t('goodsGallery.importReplaceConfirm', {
          existing: rows.length,
          count: pendingReplace?.length ?? 0,
        })}
        confirmText={t('goodsGallery.importReplace')}
        destructive
        handleConfirm={confirmReplace}
      />
    </section>
  )
}
