import { Fragment, useState } from 'react'
import { intlLocale, useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { readValidationResult } from '../hub-events-api'
import {
  type HubEventScheduleItem,
  type HubEventValidationError,
} from '../types'
import { type GoodsMember } from './goods-api'
import {
  channelLabel,
  formatPrice,
  issueText,
  memberName,
  salesPhaseLabel,
} from './goods-format'
import {
  type GoodsImportError,
  type GoodsImportItem,
  parseGoodsImport,
  parseGoodsServerErrorField,
} from './goods-import'

type ImportState = {
  text: string
  format: string
  items: GoodsImportItem[]
  errors: GoodsImportError[]
  serverErrors: HubEventValidationError[]
}

type GoodsImportPanelProps = {
  scheduleItems: HubEventScheduleItem[]
  /** null when the member catalog could not be loaded. */
  members: GoodsMember[] | null
  existingCount: number
  disabled: boolean
  /** Saves the list; rejects with the API error when the server refuses it. */
  onApply: (items: GoodsImportItem[]) => Promise<void>
}

export function GoodsImportPanel({
  scheduleItems,
  members,
  existingCount,
  disabled,
  onApply,
}: GoodsImportPanelProps) {
  const t = useT()
  const { locale } = useLocale()
  const numberLocale = intlLocale(locale)
  const [text, setText] = useState('')
  const [state, setState] = useState<ImportState | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [applying, setApplying] = useState(false)

  const errorText = (error: GoodsImportError) => {
    const base = issueText(t, 'goods.err.', error.code, 'goods.err.unknown', {
      detail: error.detail,
    })
    return error.field &&
      error.code !== 'unknown_column' &&
      error.code !== 'duplicate_column'
      ? `${error.field}: ${base}`
      : base
  }

  const byRow = new Map<number, string[]>()
  const global: string[] = []
  const push = (row: number, message: string) => {
    if (row < 0) global.push(message)
    else byRow.set(row, [...(byRow.get(row) ?? []), message])
  }
  for (const error of state?.errors ?? []) push(error.row, errorText(error))
  for (const error of state?.serverErrors ?? []) {
    const parsed = parseGoodsServerErrorField(error.field)
    push(
      parsed ? parsed.row : -1,
      [parsed ? parsed.field : error.field, error.reason, error.message]
        .filter(Boolean)
        .join(' - ')
    )
  }
  const errorCount =
    (state?.errors.length ?? 0) + (state?.serverErrors.length ?? 0)
  const stale = state !== null && state.text !== text
  const canApply =
    state !== null && errorCount === 0 && state.items.length > 0 && !stale

  const preview = () => {
    const result = parseGoodsImport(text, { scheduleItems, members })
    setState({
      text,
      format: result.format,
      items: result.items,
      errors: result.errors,
      serverErrors: [],
    })
  }

  const apply = async () => {
    if (!state) return
    setApplying(true)
    try {
      await onApply(state.items)
      setState(null)
      setText('')
    } catch (error) {
      const result = readValidationResult(error)
      if (result)
        setState((previous) =>
          previous ? { ...previous, serverErrors: result.errors } : previous
        )
    } finally {
      setApplying(false)
      setConfirming(false)
    }
  }

  const headers = [
    t('goods.rowNumber'),
    t('goods.name'),
    t('goods.groupLabel'),
    t('goods.members'),
    t('goods.price'),
    t('goods.salesChannel'),
    t('goods.purchaseLimit'),
    t('goods.bonus'),
    t('goods.salesPhase'),
    t('goods.purchaseUrl'),
  ]

  return (
    <section className='grid gap-3 rounded-md border p-3'>
      <div className='space-y-1'>
        <h4 className='text-sm font-semibold'>{t('goods.importTitle')}</h4>
        <p className='text-sm text-muted-foreground'>{t('goods.importHelp')}</p>
      </div>
      <Textarea
        rows={8}
        spellCheck={false}
        className='font-mono text-xs'
        placeholder={t('goods.importPlaceholder')}
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-label={t('goods.importTitle')}
      />
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={preview}
          disabled={disabled || !text.trim()}
        >
          {t('goods.importPreview')}
        </Button>
        {canApply ? (
          <Button
            type='button'
            variant='destructive'
            size='sm'
            onClick={() => setConfirming(true)}
            disabled={disabled || applying}
          >
            {t('goods.importApply')}
          </Button>
        ) : null}
      </div>

      {state ? (
        <div className='grid gap-3' aria-live='polite'>
          <p
            className={cn(
              'text-sm',
              errorCount > 0 || stale ? 'text-destructive' : ''
            )}
          >
            {[
              state.format
                ? t('goods.importFormat', {
                    format: state.format.toUpperCase(),
                  })
                : '',
              t('goods.importRows', { count: state.items.length }),
              state.serverErrors.length ? t('goods.importServerErrors') : '',
              state.errors.length
                ? t('goods.importHasErrors', { count: state.errors.length })
                : state.serverErrors.length === 0
                  ? t('goods.importReady')
                  : '',
              stale ? t('goods.importStale') : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </p>
          {global.length ? (
            <Alert variant='destructive'>
              <AlertDescription>
                <strong>{t('goods.globalErrors')}</strong>
                <ul className='list-disc ps-4'>
                  {global.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          {state.items.length ? (
            <div className='overflow-x-auto rounded-md border'>
              <Table className='text-xs'>
                <TableHeader>
                  <TableRow>
                    {headers.map((label) => (
                      <TableHead key={label}>{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.items.map((item, index) => {
                    const problems = byRow.get(index) ?? []
                    return (
                      <Fragment key={index}>
                        <TableRow
                          aria-invalid={problems.length > 0 || undefined}
                          className={cn(problems.length && 'bg-destructive/10')}
                        >
                          {[
                            String(index + 1),
                            item.name ?? '',
                            item.groupLabel ?? '',
                            (item.memberIds ?? [])
                              .map((id) => memberName(members ?? [], id))
                              .join(', '),
                            formatPrice(item.priceKrw, numberLocale),
                            item.salesChannel
                              ? channelLabel(t, item.salesChannel)
                              : '',
                            item.purchaseLimit === undefined ||
                            item.purchaseLimit === null
                              ? ''
                              : String(item.purchaseLimit),
                            item.isBonus ? t('common.yes') : '',
                            item.scheduleItemId
                              ? salesPhaseLabel(
                                  scheduleItems,
                                  item.scheduleItemId
                                )
                              : '',
                            item.purchaseUrl ?? '',
                          ].map((value, cellIndex) => (
                            <TableCell
                              key={cellIndex}
                              className='align-top whitespace-normal'
                            >
                              {value}
                            </TableCell>
                          ))}
                        </TableRow>
                        {problems.length ? (
                          <TableRow className='bg-destructive/5'>
                            <TableCell
                              colSpan={headers.length}
                              className='whitespace-normal text-destructive'
                            >
                              <strong>
                                {t('goods.rowErrors', { row: index + 1 })}
                              </strong>
                              <ul className='list-disc ps-4'>
                                {problems.map((message, problemIndex) => (
                                  <li key={problemIndex}>{message}</li>
                                ))}
                              </ul>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !open && !applying && setConfirming(false)}
        title={t('goods.importConfirmTitle')}
        desc={t('goods.importConfirm', {
          existing: existingCount,
          count: state?.items.length ?? 0,
        })}
        confirmText={t('goods.importApply')}
        destructive
        isLoading={applying}
        handleConfirm={() => void apply()}
      />
    </section>
  )
}
