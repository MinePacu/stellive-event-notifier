import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { describeApiError, isApiError } from '@/lib/api'
import { type MessageKey, useT } from '@/lib/i18n'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { announcementsApi } from '../data/api'
import {
  type AnnouncementFormValues,
  announcementFormSchema,
  fieldForPath,
  toFormValues,
  toInput,
} from '../data/form'
import {
  ACTION_LABEL_KEYS,
  ANNOUNCEMENT_SEVERITIES,
  ANNOUNCEMENT_TYPES,
  type Announcement,
  type AnnouncementAction,
  type AnnouncementJob,
  SEVERITY_LABEL_KEYS,
  TYPE_LABEL_KEYS,
} from '../data/types'
import { AnnouncementBadges } from './announcement-badges'

type ConfirmableAction = AnnouncementAction | 'delete'

const CONFIRM_KEYS: Record<ConfirmableAction, MessageKey> = {
  publish: 'announcement.publishConfirm',
  resolve: 'announcement.resolveConfirm',
  archive: 'announcement.archiveConfirm',
  resend: 'announcement.resendConfirm',
  'bump-attention': 'announcement.bumpConfirm',
  delete: 'announcement.deleteConfirm',
}

type ApiValidationError = { path?: string; message?: string }

function validationErrors(error: unknown): ApiValidationError[] {
  if (!isApiError(error) || error.status !== 400) return []
  const body = error.body
  if (!body || typeof body !== 'object' || !('errors' in body)) return []
  const errors = (body as { errors: unknown }).errors
  return Array.isArray(errors) ? (errors as ApiValidationError[]) : []
}

type AnnouncementEditorProps = {
  /** null = compose a new announcement. */
  announcement: Announcement | null
  /** Rebind the editor to a saved announcement, or null after deletion. */
  onBind: (item: Announcement | null) => void
}

/**
 * Create/edit form plus lifecycle actions. Mounted with a fresh `key` every
 * time the bound announcement changes, so defaults are read once.
 */
export function AnnouncementEditor({
  announcement,
  onBind,
}: AnnouncementEditorProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const id = announcement?.id
  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: toFormValues(announcement),
  })
  const [pending, setPending] = useState<ConfirmableAction | null>(null)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const run = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: async (
      job: AnnouncementJob
    ): Promise<{ item?: Announcement }> => {
      if (job.kind === 'delete') {
        if (!id) return {}
        await announcementsApi.remove(id, job.reason.trim())
        return {}
      }
      // Publish acts on the stored record, so persist pending edits first.
      const needsSave =
        job.kind === 'save' ||
        (job.kind === 'publish' && (!id || form.formState.isDirty))
      let target = announcement
      if (needsSave) {
        target = await announcementsApi.save(id, toInput(form.getValues()))
      }
      if (job.kind === 'save') return { item: target ?? undefined }
      if (!target) return {}
      const trimmed = job.reason.trim()
      const body =
        job.kind === 'publish'
          ? {
              sendPush: form.getValues('pushEnabled'),
              ...(trimmed ? { reason: trimmed } : {}),
            }
          : trimmed
            ? { reason: trimmed }
            : undefined
      const result = await announcementsApi.run(target.id, job.kind, body)
      // resend answers with a dispatch receipt rather than the announcement.
      if (job.kind === 'resend') return {}
      return { item: result && result.id ? (result as Announcement) : target }
    },
    onSuccess: (result, job) => {
      const label = t(
        job.kind === 'save'
          ? 'announcement.saveDraft'
          : ACTION_LABEL_KEYS[job.kind]
      )
      toast.success(t('announcement.actionDone', { action: label }))
      setFormError(null)
      closeDialog()
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
      if (job.kind === 'delete') onBind(null)
      else if (result.item) onBind(result.item)
    },
    onError: (error) => {
      closeDialog()
      // A failed publish may still have saved the edits.
      void queryClient.invalidateQueries({ queryKey: ['announcements'] })
      const issues = validationErrors(error)
      if (issues.length === 0) {
        toast.error(describeApiError(error))
        return
      }
      setFormError(t('announcement.validationFailed'))
      for (const issue of issues) {
        const field = issue.path ? fieldForPath(issue.path) : null
        if (field && issue.message) {
          form.setError(field, { type: 'server', message: issue.message })
        }
      }
    },
  })

  function closeDialog() {
    setPending(null)
    setReason('')
  }

  function publishSummary() {
    const values = toInput(form.getValues())
    return t('announcement.publishSummary', {
      platforms: values.targetPlatforms
        .map((platform) => (platform === 'ios' ? 'iOS' : 'Android'))
        .join(', '),
      min: values.minimumAppVersion ?? t('announcement.noLimit'),
      max: values.maximumAppVersion ?? t('announcement.noLimit'),
      pinned: values.isPinned ? t('common.yes') : t('common.no'),
      push: values.pushEnabled
        ? t('announcement.send')
        : t('announcement.doNotSend'),
    })
  }

  function dialogDescription(action: ConfirmableAction) {
    const title = form.getValues('title').trim() || t('announcement.untitled')
    const text =
      action === 'publish'
        ? t(CONFIRM_KEYS.publish, { summary: publishSummary() })
        : t(CONFIRM_KEYS[action], { title })
    return <div className='whitespace-pre-line'>{text}</div>
  }

  const busy = run.isPending
  const published = announcement?.publicationState === 'published'
  const archived = announcement?.publicationState === 'archived'
  const platformError = form.formState.errors.android?.message

  return (
    <Card>
      <CardHeader className='gap-2'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle>
            {announcement ? t('announcement.edit') : t('announcement.new')}
          </CardTitle>
          {form.formState.isDirty ? (
            <Badge variant='outline'>{t('announcement.unsaved')}</Badge>
          ) : null}
        </div>
        {announcement ? <AnnouncementBadges item={announcement} /> : null}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            id='announcement-form'
            noValidate
            className='grid gap-6'
            onSubmit={form.handleSubmit(() => run.mutate({ kind: 'save' }))}
          >
            {formError ? (
              <Alert variant='destructive'>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <section className='grid gap-4'>
              <h3 className='text-sm font-semibold'>
                {t('announcement.content')}
              </h3>
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='type'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('announcement.type')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className='w-full'>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ANNOUNCEMENT_TYPES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(TYPE_LABEL_KEYS[value])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='severity'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('announcement.severity')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className='w-full'>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ANNOUNCEMENT_SEVERITIES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(SEVERITY_LABEL_KEYS[value])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('announcement.subject')}</FormLabel>
                    <FormControl>
                      <Input maxLength={120} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='summary'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('announcement.summary')}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} maxLength={300} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='body'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('announcement.body')}</FormLabel>
                    <FormControl>
                      <Textarea rows={10} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className='grid gap-4'>
              <h3 className='text-sm font-semibold'>
                {t('announcement.targetAndAction')}
              </h3>
              <div className='grid gap-2'>
                <Label>{t('announcement.platforms')}</Label>
                <div className='grid gap-2 sm:grid-cols-2'>
                  {(['android', 'ios'] as const).map((name) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem className='flex items-center justify-between gap-3 rounded-md border p-3'>
                          <FormLabel>
                            {name === 'ios' ? 'iOS' : 'Android'}
                          </FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                {platformError ? (
                  <p className='text-sm text-destructive'>{platformError}</p>
                ) : null}
              </div>
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='minimumAppVersion'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('announcement.minimumVersion')}</FormLabel>
                      <FormControl>
                        <Input placeholder='1.0.0' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='maximumAppVersion'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('announcement.maximumVersion')}</FormLabel>
                      <FormControl>
                        <Input placeholder='2.0.0' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name='expiresAt'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('announcement.expiresAt')}</FormLabel>
                    <FormControl>
                      <Input type='datetime-local' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='actionLabel'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('announcement.actionLabel')}</FormLabel>
                    <FormControl>
                      <Input maxLength={40} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='appDeepLink'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('announcement.deepLink')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='stellivehub://announcements/...'
                        spellCheck={false}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='externalUrl'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('announcement.externalUrl')}</FormLabel>
                    <FormControl>
                      <Input
                        type='url'
                        inputMode='url'
                        spellCheck={false}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='isPinned'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between gap-3 rounded-md border p-3'>
                    <FormLabel>{t('announcement.pinHome')}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='pushEnabled'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between gap-3 rounded-md border p-3'>
                    <FormLabel>{t('announcement.sendPush')}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </section>
          </form>
        </Form>
      </CardContent>
      <CardFooter className='flex flex-wrap gap-2'>
        <Button type='submit' form='announcement-form' disabled={busy}>
          {busy && run.variables?.kind === 'save' ? (
            <Loader2 className='animate-spin' />
          ) : null}
          {announcement && announcement.publicationState !== 'draft'
            ? t('common.save')
            : t('announcement.saveDraft')}
        </Button>
        <Button
          type='button'
          variant='secondary'
          disabled={busy || published}
          onClick={() => setPending('publish')}
        >
          {t('announcement.publish')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type='button'
              variant='outline'
              size='icon'
              disabled={busy || !id}
              aria-label={t('announcement.moreActions')}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onSelect={() => setPending('resolve')}>
              {t('announcement.resolve')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={archived}
              onSelect={() => setPending('archive')}
            >
              {t('announcement.archive')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPending('bump-attention')}>
              {t('announcement.bumpAttention')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!published}
              onSelect={() => setPending('resend')}
            >
              {t('announcement.resend')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant='destructive'
              onSelect={() => setPending('delete')}
            >
              {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) closeDialog()
        }}
        title={pending ? t(ACTION_LABEL_KEYS[pending]) : ''}
        desc={pending ? dialogDescription(pending) : ''}
        destructive={pending === 'delete'}
        isLoading={busy}
        confirmText={busy ? <Loader2 className='animate-spin' /> : undefined}
        handleConfirm={() => {
          if (pending) run.mutate({ kind: pending, reason })
        }}
      >
        <div className='grid gap-2'>
          <Label htmlFor='announcement-reason'>
            {t('announcement.reason')}
          </Label>
          <Textarea
            id='announcement-reason'
            rows={2}
            value={reason}
            placeholder={t('announcement.reasonPlaceholder')}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </ConfirmDialog>
    </Card>
  )
}
