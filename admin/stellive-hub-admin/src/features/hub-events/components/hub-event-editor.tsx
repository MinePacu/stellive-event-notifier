import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Loader2,
  MoreVertical,
  RefreshCw,
  Save,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { describeApiError } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Form } from '@/components/ui/form'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  type HubEventFormValues,
  ImagePolicyNoneWithMetadataError,
  isTimelineMode,
  lifecycleCopy,
  toFormValues,
  toHubEventInput,
  validationFieldToFormField,
} from '../form'
import {
  buildGoodsGalleryPayload,
  type GalleryDraft,
  toGalleryDraft,
} from '../goods/goods-gallery'
import { GoodsTab, type RunGoodsMutation } from '../goods/goods-tab'
import {
  cancelScheduleItem,
  getHubEvent,
  hubEventKeys,
  readRevisionConflict,
  readValidationResult,
  reorderScheduleItems,
  restoreScheduleItem,
  type RevisionConflict,
  runHubEventAction,
  saveHubEvent,
  saveScheduleItem,
  setPrimaryScheduleItem,
  validateHubEvent,
} from '../hub-events-api'
import {
  type AdminHubEvent,
  type HubEventLifecycleAction,
  type HubEventScheduleItem,
  type HubEventValidationError,
  type HubEventValidationResult,
} from '../types'
import { AuditLog } from './audit-log'
import { HubEventInfoForm } from './hub-event-info-form'
import { PublicationStateBadge } from './hub-event-table'
import { LifecycleConfirmDialog } from './lifecycle-confirm-dialog'
import { type LinkRowErrors } from './link-editor'
import { ScheduleDialog, type ScheduleDialogItem } from './schedule-dialog'
import { ScheduleList } from './schedule-list'
import { ValidationPanel } from './validation-panel'

type HubEventEditorProps = {
  /** Event to edit, or null to create a new one. */
  initialEvent: AdminHubEvent | null
  /** Called whenever the saved event changes (create, save, actions). */
  onCurrentChange: (event: AdminHubEvent | null) => void
  onClose: () => void
}

type GoodsMutationVars = {
  label: string
  run: () => Promise<AdminHubEvent>
}

type GalleryState = { rows: GalleryDraft[]; dirty: boolean }

function toGalleryState(event: AdminHubEvent | null): GalleryState {
  return {
    rows: (event?.goodsListImages ?? []).map((image) => toGalleryDraft(image)),
    dirty: false,
  }
}

type ScheduleMutationVars = {
  label: string
  run: () => Promise<AdminHubEvent>
  /** Close the schedule dialog on success. */
  fromDialog?: boolean
}

export function HubEventEditor({
  initialEvent,
  onCurrentChange,
  onClose,
}: HubEventEditorProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const [current, setCurrent] = useState<AdminHubEvent | null>(initialEvent)
  const form = useForm<HubEventFormValues>({
    defaultValues: toFormValues(initialEvent),
  })
  const [tab, setTab] = useState('info')
  const [validation, setValidation] = useState<HubEventValidationResult | null>(
    null
  )
  const [clientError, setClientError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<RevisionConflict | null>(null)
  const [scheduleDialog, setScheduleDialog] = useState<{
    item: ScheduleDialogItem | null
  } | null>(null)
  const [scheduleErrors, setScheduleErrors] = useState<
    HubEventValidationError[] | undefined
  >()
  const [pendingAction, setPendingAction] =
    useState<HubEventLifecycleAction | null>(null)
  // What to add once a new event has been saved as a draft.
  const [saveFirstTarget, setSaveFirstTarget] = useState<
    'schedule' | 'goods' | null
  >(null)
  const [goodsAddRequest, setGoodsAddRequest] = useState(0)
  const [gallery, setGallery] = useState<GalleryState>(() =>
    toGalleryState(initialEvent)
  )
  const category = useWatch({ control: form.control, name: 'category' })
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const scheduleItems = useMemo(
    () => current?.scheduleItems ?? [],
    [current?.scheduleItems]
  )
  const timelineMode = isTimelineMode(scheduleItems)
  const deleted = current?.publicationState === 'deleted'
  // Read during render so react-hook-form keeps `isDirty` up to date for the
  // handlers below (formState is a subscription proxy).
  const formDirty = form.formState.isDirty
  const isDirty = formDirty || gallery.dirty

  // Server validation errors that point into links / schedule items.
  const { linkErrors, invalidScheduleIndexes } = useMemo(() => {
    const links: Record<number, LinkRowErrors> = {}
    const schedule = new Set<number>()
    for (const error of validation?.errors ?? []) {
      const linkMatch = /^links\.(\d+)(?:\.(.+))?$/.exec(error.field)
      if (linkMatch) {
        const index = Number(linkMatch[1])
        const row = (links[index] ??= { row: true })
        if (linkMatch[2] === 'url') row.url = error.message
        if (linkMatch[2] === 'label') row.label = error.message
        continue
      }
      const scheduleMatch = /^scheduleItems\.(\d+)/.exec(error.field)
      if (scheduleMatch) schedule.add(Number(scheduleMatch[1]))
    }
    return { linkErrors: links, invalidScheduleIndexes: schedule }
  }, [validation])

  const refreshQueries = (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: hubEventKeys.lists() })
    if (id)
      void queryClient.invalidateQueries({
        queryKey: hubEventKeys.auditLog(id),
      })
  }

  const acceptEvent = (event: AdminHubEvent, resetForm: boolean) => {
    // Only the admin detail and goods responses carry goodsItems; keep the
    // loaded list when another response for the same event omits it.
    setCurrent((previous) =>
      event.goodsItems === undefined && previous?.id === event.id
        ? { ...event, goodsItems: previous.goodsItems }
        : event
    )
    onCurrentChange(event)
    if (resetForm) {
      form.reset(toFormValues(event))
      setGallery(toGalleryState(event))
    }
  }

  const applyValidation = (result: HubEventValidationResult) => {
    setValidation(result)
    setClientError(null)
    form.clearErrors()
    for (const error of result.errors) {
      const field = validationFieldToFormField[error.field]
      if (field)
        form.setError(field, { type: 'server', message: error.message })
    }
  }

  /** Shows validation / conflict errors inline; toasts everything else. */
  const handleError = (error: unknown) => {
    const result = readValidationResult(error)
    if (result) {
      applyValidation(result)
      toast.error(t('hubEvent.validationFailed'))
      return result
    }
    const revision = readRevisionConflict(error)
    if (revision) {
      setConflict(revision)
      return null
    }
    toast.error(describeApiError(error))
    return null
  }

  const done = (label: string) =>
    toast.success(t('hubEvent.completed', { action: label }))

  /** Request body from the form, or null when a client check fails. */
  const buildInput = () => {
    try {
      const input = toHubEventInput(form.getValues())
      // An untouched gallery is not sent, so it is never cleared by accident.
      if (gallery.dirty)
        input.goodsListImages = buildGoodsGalleryPayload(gallery.rows)
      setClientError(null)
      return input
    } catch (error) {
      if (!(error instanceof ImagePolicyNoneWithMetadataError)) throw error
      const message = t('hubEvent.imagePolicyNoneWithMetadata')
      setClientError(message)
      form.setError('imagePolicyState', { type: 'client', message })
      setTab('info')
      return null
    }
  }

  const validateMutation = useMutation({
    mutationFn: validateHubEvent,
    meta: { suppressErrorToast: true },
    onSuccess: (result) => {
      applyValidation(result)
      if (result.valid) done(t('hubEvent.validate'))
      else toast.error(t('hubEvent.validationFailed'))
    },
    onError: handleError,
  })

  const saveMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      saveHubEvent(current?.id, input),
    meta: { suppressErrorToast: true },
    onSuccess: (saved) => {
      acceptEvent(saved, true)
      setValidation(null)
      refreshQueries(saved.id)
      done(t('hubEvent.saveDraft'))
    },
    onError: handleError,
  })

  const lifecycleMutation = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string
      action: HubEventLifecycleAction
      reason: string
    }) => runHubEventAction(id, action, reason),
    meta: { suppressErrorToast: true },
    onSuccess: (updated, { id, action }) => {
      setPendingAction(null)
      refreshQueries(id)
      done(t(lifecycleCopy[action].label))
      if (action === 'delete') {
        onCurrentChange(null)
        onClose()
        return
      }
      if (updated && typeof updated === 'object' && 'id' in updated)
        acceptEvent(updated, !form.formState.isDirty && !gallery.dirty)
    },
    onError: (error) => {
      setPendingAction(null)
      handleError(error)
    },
  })

  const scheduleMutation = useMutation({
    mutationFn: (vars: ScheduleMutationVars) => vars.run(),
    meta: { suppressErrorToast: true },
    onSuccess: (updated, vars) => {
      acceptEvent(updated, !form.formState.isDirty && !gallery.dirty)
      setConflict(null)
      if (vars.fromDialog) {
        setScheduleDialog(null)
        setScheduleErrors(undefined)
      }
      refreshQueries(updated.id)
      done(vars.label)
    },
    onError: (error, vars) => {
      const result = handleError(error)
      if (!vars.fromDialog) return
      // The dialog covers the editor, so repeat inline errors inside it.
      const revision = readRevisionConflict(error)
      setScheduleErrors(
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
          : result?.errors
      )
    },
  })

  const goodsMutation = useMutation({
    mutationFn: (vars: GoodsMutationVars) => vars.run(),
    meta: { suppressErrorToast: true },
    onSuccess: (updated, vars) => {
      acceptEvent(updated, !form.formState.isDirty && !gallery.dirty)
      setConflict(null)
      refreshQueries(updated.id)
      done(vars.label)
    },
    onError: handleError,
  })

  const runGoods: RunGoodsMutation = (label, run) => {
    if (!current?.id) return Promise.reject(new Error('hub_event_required'))
    const { id, revision } = current
    return goodsMutation.mutateAsync({ label, run: () => run(id, revision) })
  }

  // List rows have no goodsItems; the admin detail endpoint does.
  const currentId = current?.id
  const goodsMissing = Boolean(currentId) && current?.goodsItems === undefined
  const goodsQuery = useQuery({
    queryKey: [...hubEventKeys.all, 'detail', currentId],
    queryFn: () => getHubEvent(currentId as string),
    enabled: goodsMissing,
    staleTime: 0,
    gcTime: 0,
  })
  const goodsItems =
    current?.goodsItems ??
    (goodsQuery.data && goodsQuery.data.id === currentId
      ? (goodsQuery.data.goodsItems ?? [])
      : undefined)
  const goodsEvent =
    current && goodsItems !== undefined ? { ...current, goodsItems } : current

  const reloadMutation = useMutation({
    mutationFn: (id: string) => getHubEvent(id),
    onSuccess: (latest) => {
      acceptEvent(latest, !form.formState.isDirty && !gallery.dirty)
      setConflict(null)
      refreshQueries(latest.id)
    },
  })

  const busy =
    validateMutation.isPending ||
    saveMutation.isPending ||
    lifecycleMutation.isPending ||
    scheduleMutation.isPending ||
    goodsMutation.isPending ||
    reloadMutation.isPending

  const handleValidate = () => {
    const input = buildInput()
    if (input) validateMutation.mutate(input)
  }

  const handleSave = () => {
    const input = buildInput()
    if (input) saveMutation.mutate(input)
  }

  const runSchedule = (
    label: string,
    run: (id: string, revision: number) => Promise<AdminHubEvent>,
    fromDialog = false
  ) => {
    if (!current?.id) return
    const { id, revision } = current
    scheduleMutation.mutate({ label, run: () => run(id, revision), fromDialog })
  }

  const handleAddSchedule = () => {
    if (!current?.id) {
      setSaveFirstTarget('schedule')
      return
    }
    setScheduleErrors(undefined)
    setScheduleDialog({ item: null })
  }

  const handleSaveThenAdd = async () => {
    const target = saveFirstTarget
    const input = buildInput()
    if (!input) {
      setSaveFirstTarget(null)
      return
    }
    try {
      await saveMutation.mutateAsync(input)
    } catch {
      // Already reported by the mutation's onError.
      setSaveFirstTarget(null)
      return
    }
    setSaveFirstTarget(null)
    if (target === 'goods') {
      setGoodsAddRequest((value) => value + 1)
      return
    }
    setScheduleErrors(undefined)
    setScheduleDialog({ item: null })
  }

  const handleMove = (item: HubEventScheduleItem, delta: number) => {
    const ids = scheduleItems.map((candidate) => candidate.id)
    const index = ids.indexOf(item.id)
    const next = index + delta
    if (index < 0 || next < 0 || next >= ids.length) return
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    runSchedule(
      delta < 0 ? t('hubEvent.moveUp') : t('hubEvent.moveDown'),
      (id, revision) => reorderScheduleItems(id, ids, revision)
    )
  }

  const requestClose = () => {
    if (busy) return
    if (isDirty) setConfirmDiscard(true)
    else onClose()
  }

  const title = current
    ? current.title || t('hubEvent.untitled')
    : t('hubEvent.create')

  return (
    <Sheet open onOpenChange={(open) => !open && requestClose()}>
      <SheetContent
        aria-label={t('hubEvent.editorAria')}
        className='w-full gap-0 sm:max-w-3xl'
      >
        <SheetHeader className='gap-3 border-b pe-12'>
          <div className='grid gap-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <SheetTitle className='break-words'>{title}</SheetTitle>
              {current ? (
                <PublicationStateBadge state={current.publicationState} />
              ) : null}
            </div>
            <SheetDescription>
              {current ? t('hubEvent.editEvent') : t('hubEvent.goodsControls')}
            </SheetDescription>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleValidate}
                  disabled={busy}
                >
                  {validateMutation.isPending ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <CheckCircle2 />
                  )}
                  {t('hubEvent.validate')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('hubEvent.validateTooltip')}</TooltipContent>
            </Tooltip>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={handleSave}
              disabled={busy || deleted}
            >
              {saveMutation.isPending ? (
                <Loader2 className='animate-spin' />
              ) : (
                <Save />
              )}
              {t('hubEvent.saveDraft')}
            </Button>
            <Button
              type='button'
              size='sm'
              onClick={() => setPendingAction('publish')}
              disabled={busy || deleted || !current?.id}
            >
              <Send />
              {t('hubEvent.publish')}
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={t('hubEvent.moreActions')}
                  title={t('hubEvent.moreActions')}
                  disabled={busy || deleted || !current?.id}
                >
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onSelect={() => setPendingAction('cancel')}>
                  {t('hubEvent.cancelEvent')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setPendingAction('deactivate')}
                >
                  {t('hubEvent.deactivate')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant='destructive'
                  onSelect={() => setPendingAction('delete')}
                >
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SheetHeader>

        <div className='grid flex-1 content-start gap-4 overflow-y-auto p-4'>
          {conflict ? (
            <Alert variant='destructive'>
              <AlertTitle>{t('hubEvent.revisionConflictTitle')}</AlertTitle>
              <AlertDescription className='grid gap-2'>
                <span>
                  {t('hubEvent.revisionConflict', {
                    expected: conflict.expectedRevision ?? '?',
                    current: conflict.currentRevision ?? '?',
                  })}
                </span>
                {current?.id ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='w-fit'
                    onClick={() => reloadMutation.mutate(current.id)}
                    disabled={busy}
                  >
                    <RefreshCw
                      className={
                        reloadMutation.isPending ? 'animate-spin' : undefined
                      }
                    />
                    {t('hubEvent.reloadLatest')}
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs value={tab} onValueChange={setTab} className='gap-4'>
            <TabsList
              aria-label={t('hubEvent.editorAria')}
              className='h-auto w-full flex-wrap justify-start'
            >
              <TabsTrigger value='info'>{t('hubEvent.infoTab')}</TabsTrigger>
              <TabsTrigger value='schedule'>
                {t('hubEvent.scheduleTab', { count: scheduleItems.length })}
              </TabsTrigger>
              <TabsTrigger value='goods'>
                {t('goods.tab', {
                  count: (goodsItems ?? []).filter((item) => !item.cancelledAt)
                    .length,
                })}
              </TabsTrigger>
              <TabsTrigger value='history'>
                {t('hubEvent.historyTab')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value='info'>
              <Form {...form}>
                <form
                  id='hub-event-form'
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleSave()
                  }}
                  noValidate
                >
                  <HubEventInfoForm
                    form={form}
                    timelineMode={timelineMode}
                    linkErrors={linkErrors}
                  />
                </form>
              </Form>
            </TabsContent>
            <TabsContent value='schedule'>
              <ScheduleList
                items={scheduleItems}
                invalidIndexes={invalidScheduleIndexes}
                disabled={busy || deleted}
                onAdd={handleAddSchedule}
                onEdit={(item, isPrimary) => {
                  setScheduleErrors(undefined)
                  setScheduleDialog({ item: { ...item, isPrimary } })
                }}
                onSetPrimary={(item) =>
                  runSchedule(t('hubEvent.schedulePrimary'), (id, revision) =>
                    setPrimaryScheduleItem(id, item.id, revision)
                  )
                }
                onMove={handleMove}
                onToggleCancelled={(item) =>
                  item.cancelledAt
                    ? runSchedule(
                        t('hubEvent.scheduleRestore'),
                        (id, revision) =>
                          restoreScheduleItem(id, item.id, revision)
                      )
                    : runSchedule(
                        t('hubEvent.scheduleCancel'),
                        (id, revision) =>
                          cancelScheduleItem(id, item.id, revision)
                      )
                }
              />
            </TabsContent>
            <TabsContent value='goods'>
              <GoodsTab
                event={goodsEvent}
                category={category}
                scheduleItems={scheduleItems}
                loading={goodsItems === undefined && goodsQuery.isPending}
                loadError={
                  goodsQuery.isError ? describeApiError(goodsQuery.error) : null
                }
                disabled={busy || deleted}
                addRequest={goodsAddRequest}
                onRequireSave={() => setSaveFirstTarget('goods')}
                runGoods={runGoods}
                gallery={{
                  rows: gallery.rows,
                  dirty: gallery.dirty,
                  serverErrors: validation?.errors ?? [],
                  defaultSourceUrl: () => form.getValues('sourceUrl').trim(),
                  onChange: (rows) => setGallery({ rows, dirty: true }),
                }}
              />
            </TabsContent>
            <TabsContent value='history'>
              <AuditLog eventId={current?.id} />
            </TabsContent>
          </Tabs>

          <ValidationPanel result={validation} clientError={clientError} />
        </div>

        {scheduleDialog ? (
          <ScheduleDialog
            item={scheduleDialog.item}
            hasActiveItems={scheduleItems.some((item) => !item.cancelledAt)}
            pending={scheduleMutation.isPending}
            serverErrors={scheduleErrors}
            onClose={() => {
              setScheduleDialog(null)
              setScheduleErrors(undefined)
            }}
            onSubmit={(input) => {
              const itemId = scheduleDialog.item?.id
              runSchedule(
                t('hubEvent.scheduleSave'),
                (id, revision) =>
                  saveScheduleItem(id, itemId, {
                    ...input,
                    expectedRevision: revision,
                  }),
                true
              )
            }}
          />
        ) : null}

        {pendingAction && current?.id ? (
          <LifecycleConfirmDialog
            action={pendingAction}
            eventTitle={current.title || t('hubEvent.untitled')}
            pending={lifecycleMutation.isPending}
            onCancel={() => setPendingAction(null)}
            onConfirm={(reason) =>
              lifecycleMutation.mutate({
                id: current.id,
                action: pendingAction,
                reason,
              })
            }
          />
        ) : null}

        <ConfirmDialog
          open={saveFirstTarget !== null}
          onOpenChange={(open) => !open && !busy && setSaveFirstTarget(null)}
          title={
            saveFirstTarget === 'goods'
              ? t('goods.dialogCreate')
              : t('hubEvent.scheduleCreate')
          }
          desc={
            saveFirstTarget === 'goods'
              ? t('goods.saveBeforeAdd')
              : t('hubEvent.saveBeforeSchedule')
          }
          confirmText={
            saveFirstTarget === 'goods'
              ? t('goods.saveDraftThenAdd')
              : t('hubEvent.saveDraftThenAdd')
          }
          isLoading={saveMutation.isPending}
          handleConfirm={() => void handleSaveThenAdd()}
        />

        <ConfirmDialog
          open={confirmDiscard}
          onOpenChange={setConfirmDiscard}
          title={t('hubEvent.discardTitle')}
          desc={t('hubEvent.discardDesc')}
          confirmText={t('hubEvent.discard')}
          destructive
          handleConfirm={() => {
            setConfirmDiscard(false)
            onClose()
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
