import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { readRevisionConflict, readValidationResult } from '../hub-events-api'
import {
  type AdminHubEvent,
  type HubEventCategory,
  type HubEventGoodsItem,
  type HubEventScheduleItem,
  type HubEventValidationError,
} from '../types'
import {
  cancelGoodsItem,
  reorderGoodsItems,
  replaceGoodsItems,
  restoreGoodsItem,
  saveGoodsItem,
  useGoodsMembers,
} from './goods-api'
import { GoodsDialog } from './goods-dialog'
import { GOODS_DEFAULT_CATEGORIES } from './goods-format'
import { type GalleryDraft } from './goods-gallery'
import { GoodsGalleryEditor } from './goods-gallery-editor'
import { GoodsImportPanel } from './goods-import-panel'
import { GoodsList } from './goods-list'

/** Runs a goods mutation against the current event id and revision. */
export type RunGoodsMutation = (
  label: string,
  run: (id: string, revision: number) => Promise<AdminHubEvent>
) => Promise<AdminHubEvent>

type GoodsTabProps = {
  event: AdminHubEvent | null
  category: HubEventCategory
  scheduleItems: HubEventScheduleItem[]
  /** Goods items are loading from the admin detail endpoint. */
  loading: boolean
  loadError: string | null
  disabled: boolean
  /** Bumped by the editor after "save draft, then add goods". */
  addRequest: number
  /** Asks the editor to save the new event before adding goods. */
  onRequireSave: () => void
  runGoods: RunGoodsMutation
  gallery: {
    rows: GalleryDraft[]
    dirty: boolean
    serverErrors: HubEventValidationError[]
    defaultSourceUrl: () => string
    onChange: (rows: GalleryDraft[]) => void
  }
}

export function GoodsTab({
  event,
  category,
  scheduleItems,
  loading,
  loadError,
  disabled,
  addRequest,
  onRequireSave,
  runGoods,
  gallery,
}: GoodsTabProps) {
  const t = useT()
  const membersQuery = useGoodsMembers()
  const members = membersQuery.data
  const membersUnavailable = membersQuery.isError
  const [dialog, setDialog] = useState<{
    item: HubEventGoodsItem | null
  } | null>(null)
  const [dialogErrors, setDialogErrors] = useState<
    HubEventValidationError[] | undefined
  >()
  const [dialogPending, setDialogPending] = useState(false)
  const [forceOpen, setForceOpen] = useState(false)

  const items = event?.goodsItems ?? []
  const optional =
    !GOODS_DEFAULT_CATEGORIES.includes(category) && items.length === 0
  const open = !optional || forceOpen

  const openDialog = (item: HubEventGoodsItem | null) => {
    setDialogErrors(undefined)
    setDialog({ item })
  }

  // The editor saved a new event so goods can be added to it.
  const [seenAddRequest, setSeenAddRequest] = useState(addRequest)
  if (addRequest !== seenAddRequest) {
    setSeenAddRequest(addRequest)
    openDialog(null)
  }

  const handleAdd = () => {
    if (!event?.id) onRequireSave()
    else openDialog(null)
  }

  const handleMove = (item: HubEventGoodsItem, delta: number) => {
    const ids = items.map((candidate) => candidate.id)
    const index = ids.indexOf(item.id)
    const next = index + delta
    if (index < 0 || next < 0 || next >= ids.length) return
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    void runGoods(
      delta < 0 ? t('hubEvent.moveUp') : t('hubEvent.moveDown'),
      (id, revision) => reorderGoodsItems(id, ids, revision)
    ).catch(() => undefined)
  }

  const handleToggleCancelled = (item: HubEventGoodsItem) => {
    const label = item.cancelledAt ? t('goods.restore') : t('goods.cancel')
    void runGoods(label, (id, revision) =>
      item.cancelledAt
        ? restoreGoodsItem(id, item.id, revision)
        : cancelGoodsItem(id, item.id, revision)
    ).catch(() => undefined)
  }

  const handleSubmit = async (input: Record<string, unknown>) => {
    const itemId = dialog?.item?.id
    setDialogPending(true)
    try {
      await runGoods(t('goods.save'), (id, revision) =>
        saveGoodsItem(id, itemId, { ...input, expectedRevision: revision })
      )
      setDialog(null)
      setDialogErrors(undefined)
    } catch (error) {
      // The dialog covers the editor, so repeat inline errors inside it.
      const revision = readRevisionConflict(error)
      setDialogErrors(
        revision
          ? [
              {
                field: '',
                reason: '',
                message: t('hubEvent.revisionConflict', {
                  expected: revision.expectedRevision ?? '?',
                  current: revision.currentRevision ?? '?',
                }),
              },
            ]
          : readValidationResult(error)?.errors
      )
    } finally {
      setDialogPending(false)
    }
  }

  return (
    <div className='grid gap-6'>
      <GoodsGalleryEditor
        rows={gallery.rows}
        dirty={gallery.dirty}
        serverErrors={gallery.serverErrors}
        disabled={disabled}
        defaultSourceUrl={gallery.defaultSourceUrl}
        onChange={gallery.onChange}
      />

      <Separator />

      <section className='grid gap-4'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div className='min-w-0 space-y-1'>
            <h3 className='font-semibold'>{t('goods.title')}</h3>
            <p className='text-sm text-muted-foreground'>{t('goods.help')}</p>
          </div>
          <div className='flex flex-wrap gap-2'>
            {optional ? (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => setForceOpen((value) => !value)}
              >
                {forceOpen ? t('goods.hide') : t('goods.show')}
              </Button>
            ) : null}
            {open ? (
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={handleAdd}
                disabled={disabled}
              >
                <Plus />
                {t('goods.add')}
              </Button>
            ) : null}
          </div>
        </div>

        {membersUnavailable ? (
          <Alert variant='destructive'>
            <AlertDescription>{t('goods.membersUnavailable')}</AlertDescription>
          </Alert>
        ) : null}

        {!open ? (
          <p className='text-sm text-muted-foreground'>
            {t('goods.collapsedHelp')}
          </p>
        ) : loading ? (
          <p className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' />
            {t('goods.loading')}
          </p>
        ) : loadError ? (
          <Alert variant='destructive'>
            <AlertDescription>
              {t('goods.loadFailed', { reason: loadError })}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <GoodsList
              items={items}
              scheduleItems={scheduleItems}
              members={members}
              disabled={disabled}
              onEdit={openDialog}
              onMove={handleMove}
              onToggleCancelled={handleToggleCancelled}
            />
            {event?.id ? (
              <GoodsImportPanel
                scheduleItems={scheduleItems}
                members={membersUnavailable ? null : (members ?? null)}
                existingCount={items.length}
                // Member names resolve against the catalog, so wait for it.
                disabled={disabled || membersQuery.isPending}
                onApply={async (importItems) => {
                  await runGoods(t('goods.importApply'), (id, revision) =>
                    replaceGoodsItems(id, importItems, revision)
                  )
                }}
              />
            ) : (
              <p className='text-sm text-muted-foreground'>
                {t('goods.saveFirst')}
              </p>
            )}
          </>
        )}
      </section>

      {dialog ? (
        <GoodsDialog
          item={dialog.item}
          scheduleItems={scheduleItems}
          members={members}
          membersUnavailable={membersUnavailable}
          pending={dialogPending}
          serverErrors={dialogErrors}
          onClose={() => {
            setDialog(null)
            setDialogErrors(undefined)
          }}
          onSubmit={(input) => void handleSubmit(input)}
        />
      ) : null}
    </div>
  )
}
