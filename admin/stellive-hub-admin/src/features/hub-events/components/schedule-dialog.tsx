import { useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, Loader2 } from 'lucide-react'
import { type TranslateFn, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  collectLinks,
  scheduleDisplayTitle,
  scheduleEditorLinks,
  scheduleKindLabelKeys,
  toIsoFromLocal,
  toLinkDrafts,
  toLocalDateTime,
  toScheduleDate,
} from '../form'
import {
  HUB_EVENT_LINK_KINDS,
  HUB_EVENT_SCHEDULE_KINDS,
  type HubEventScheduleItem,
  type HubEventValidationError,
} from '../types'
import { LinkEditor, type LinkRowErrors } from './link-editor'

function createSchema(t: TranslateFn) {
  return z
    .object({
      kind: z.enum(HUB_EVENT_SCHEDULE_KINDS),
      title: z
        .string()
        .trim()
        .min(1, t('hubEvent.scheduleTitleRequired'))
        .max(160),
      label: z.string().max(80),
      description: z.string().max(2000),
      timing: z.enum(['point', 'period']),
      precision: z.enum(['datetime', 'date']),
      startsAt: z.string().min(1, t('hubEvent.scheduleDateRequired')),
      endsAt: z.string(),
      timezone: z.string(),
      notificationEligible: z.boolean(),
      isPrimary: z.boolean(),
      links: z.array(
        z.object({
          key: z.string(),
          id: z.string().optional(),
          kind: z.enum(HUB_EVENT_LINK_KINDS),
          label: z.string(),
          url: z.string(),
        })
      ),
    })
    .superRefine((values, ctx) => {
      if (values.timing === 'period' && !values.endsAt) {
        ctx.addIssue({
          code: 'custom',
          path: ['endsAt'],
          message: t('hubEvent.scheduleEndRequired'),
        })
      }
      values.links.forEach((link, index) => {
        if (!/^https:\/\/\S+/i.test(link.url.trim())) {
          ctx.addIssue({
            code: 'custom',
            path: ['links', index, 'url'],
            message: t('hubEvent.linkUrlHttps'),
          })
        }
        if (link.kind === 'custom' && !link.label.trim()) {
          ctx.addIssue({
            code: 'custom',
            path: ['links', index, 'label'],
            message: t('hubEvent.linkCustomLabelRequired'),
          })
        }
      })
    })
}

type ScheduleFormValues = z.infer<ReturnType<typeof createSchema>>

/** Schedule item being edited; `isPrimary` is the effective primary flag. */
export type ScheduleDialogItem = Partial<HubEventScheduleItem>

function toDefaults(
  item: ScheduleDialogItem | null,
  hasActiveItems: boolean
): ScheduleFormValues {
  const value = item ?? {}
  const precision = value.timePrecision ?? 'datetime'
  const title = scheduleDisplayTitle(value)
  const label = String(value.label ?? '').trim()
  const toInput = (iso?: string) =>
    precision === 'date'
      ? toScheduleDate(iso, value.timezone)
      : toLocalDateTime(iso)
  return {
    kind: value.kind ?? 'custom',
    title,
    label: label && label !== title ? label : '',
    description: value.description ?? '',
    timing: value.endsAt ? 'period' : 'point',
    precision,
    startsAt: toInput(value.startsAt),
    endsAt: toInput(value.endsAt),
    timezone: value.timezone || 'Asia/Seoul',
    notificationEligible: value.notificationEligible !== false,
    isPrimary: value.isPrimary === true || (!value.id && !hasActiveItems),
    links: toLinkDrafts(scheduleEditorLinks(value)),
  }
}

/** Request body (without `expectedRevision`) from the dialog values. */
function toScheduleInput(values: ScheduleFormValues) {
  const title = values.title.trim()
  const date = values.precision === 'date'
  return {
    kind: values.kind,
    title,
    label: values.label.trim() || title,
    description: values.description.trim() || null,
    startsAt: date
      ? values.startsAt
      : (toIsoFromLocal(values.startsAt) ?? null),
    endsAt:
      values.timing === 'period'
        ? date
          ? values.endsAt || null
          : (toIsoFromLocal(values.endsAt) ?? null)
        : null,
    timePrecision: values.precision,
    timezone: values.timezone.trim() || 'Asia/Seoul',
    links: collectLinks(values.links),
    notificationEligible: values.notificationEligible,
    isPrimary: values.isPrimary,
  }
}

type ScheduleDialogProps = {
  item: ScheduleDialogItem | null
  hasActiveItems: boolean
  pending: boolean
  /** Server validation errors from the last save attempt. */
  serverErrors?: HubEventValidationError[]
  onClose: () => void
  onSubmit: (input: Record<string, unknown>) => void
}

/** Create / edit dialog for one schedule item. Mounted only while open. */
export function ScheduleDialog({
  item,
  hasActiveItems,
  pending,
  serverErrors,
  onClose,
  onSubmit,
}: ScheduleDialogProps) {
  const t = useT()
  const schema = useMemo(() => createSchema(t), [t])
  const defaults = useMemo(
    () => toDefaults(item, hasActiveItems),
    [item, hasActiveItems]
  )
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })
  const [moreOpen, setMoreOpen] = useState(
    Boolean(defaults.description || defaults.label || defaults.links.length)
  )

  const [timing, precision, links] = useWatch({
    control: form.control,
    name: ['timing', 'precision', 'links'],
  })
  const period = timing === 'period'
  const inputType = precision === 'date' ? 'date' : 'datetime-local'
  // An existing primary cannot be unset here; another item must replace it.
  const primaryLocked = Boolean(item?.id && item.isPrimary)
  const cancelled = Boolean(item?.cancelledAt)

  const linkErrors: Record<number, LinkRowErrors> = {}
  form.formState.errors.links?.forEach?.((error, index) => {
    if (!error) return
    linkErrors[index] = {
      url: error.url?.message,
      label: error.label?.message,
    }
  })

  const changePrecision = (next: string) => {
    for (const field of ['startsAt', 'endsAt'] as const) {
      const current = form.getValues(field)
      if (!current) continue
      if (next === 'date') form.setValue(field, current.slice(0, 10))
      else if (current.length === 10) form.setValue(field, `${current}T00:00`)
    }
  }

  const submit = form.handleSubmit(
    (values) => onSubmit(toScheduleInput(values)),
    (errors) => {
      if (errors.links || errors.description || errors.label) setMoreOpen(true)
    }
  )

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {item?.id
              ? t('hubEvent.scheduleEdit')
              : t('hubEvent.scheduleCreate')}
          </DialogTitle>
          <DialogDescription>{t('hubEvent.scheduleHelp')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='hub-event-schedule-form'
            className='grid gap-4'
            onSubmit={submit}
            noValidate
          >
            {serverErrors?.length ? (
              <Alert variant='destructive'>
                <AlertDescription>
                  <ul className='list-disc ps-4'>
                    {serverErrors.map((error, index) => (
                      <li key={index}>
                        {[error.field, error.reason, error.message]
                          .filter(Boolean)
                          .join(' - ')}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='kind'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('hubEvent.linkKind')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {HUB_EVENT_SCHEDULE_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {t(scheduleKindLabelKeys[kind])}
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
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('hubEvent.title')}</FormLabel>
                    <FormControl>
                      <Input autoComplete='off' maxLength={160} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='timing'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('hubEvent.scheduleTiming')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='point'>
                          {t('hubEvent.schedulePoint')}
                        </SelectItem>
                        <SelectItem value='period'>
                          {t('hubEvent.schedulePeriod')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='precision'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('hubEvent.timePrecision')}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        changePrecision(value)
                        field.onChange(value)
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='datetime'>
                          {t('hubEvent.dateTime')}
                        </SelectItem>
                        <SelectItem value='date'>
                          {t('hubEvent.dateOnly')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='startsAt'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {period ? t('hubEvent.startsAt') : t('hubEvent.occursAt')}
                    </FormLabel>
                    <FormControl>
                      <Input type={inputType} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {period ? (
                <FormField
                  control={form.control}
                  name='endsAt'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('hubEvent.endsAt')}</FormLabel>
                      <FormControl>
                        <Input type={inputType} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>
            <div className='flex flex-wrap gap-x-6 gap-y-3'>
              <FormField
                control={form.control}
                name='isPrimary'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center gap-2'>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                        disabled={primaryLocked || cancelled}
                      />
                    </FormControl>
                    <FormLabel className='font-normal'>
                      {t('hubEvent.setAsPrimary')}
                    </FormLabel>
                    {primaryLocked ? (
                      <FormDescription className='basis-full'>
                        {t('hubEvent.primaryLocked')}
                      </FormDescription>
                    ) : null}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='notificationEligible'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center gap-2'>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                      />
                    </FormControl>
                    <FormLabel className='font-normal'>
                      {t('hubEvent.notificationEligible')}
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>
            <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='-ms-2'
                >
                  <ChevronDown
                    className={cn(
                      'transition-transform',
                      moreOpen && 'rotate-180'
                    )}
                  />
                  {t('hubEvent.additionalInfo')}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className='grid gap-4 pt-2'>
                <FormField
                  control={form.control}
                  name='description'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('hubEvent.scheduleDescriptionOptional')}
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={3} maxLength={2000} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='label'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('hubEvent.scheduleShortLabelOptional')}
                      </FormLabel>
                      <FormControl>
                        <Input autoComplete='off' maxLength={80} {...field} />
                      </FormControl>
                      <FormDescription>
                        {t('hubEvent.scheduleShortLabelHelp')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='timezone'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('hubEvent.timezone')}</FormLabel>
                      <FormControl>
                        <Input autoComplete='off' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <LinkEditor
                  idPrefix='hub-event-schedule-link'
                  title={t('hubEvent.scheduleLinks')}
                  description={t('hubEvent.scheduleLinksHelp')}
                  links={links}
                  errors={linkErrors}
                  onChange={(next) =>
                    form.setValue('links', next, {
                      shouldDirty: true,
                      shouldValidate: form.formState.isSubmitted,
                    })
                  }
                />
              </CollapsibleContent>
            </Collapsible>
          </form>
        </Form>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={onClose}
            disabled={pending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type='submit'
            form='hub-event-schedule-form'
            disabled={pending}
          >
            {pending ? <Loader2 className='animate-spin' /> : null}
            {t('hubEvent.scheduleSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
