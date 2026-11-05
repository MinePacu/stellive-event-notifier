import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { type FieldPath, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { type TranslateFn, useT } from '@/lib/i18n'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  HUB_EVENT_GOODS_SALES_CHANNELS,
  type HubEventGoodsItem,
  type HubEventScheduleItem,
  type HubEventValidationError,
} from '../types'
import { type GoodsMember } from './goods-api'
import {
  salesChannelLabelKeys,
  salesPhaseLabel,
  salesPhaseOptions,
} from './goods-format'
import { goodsFieldControlName } from './goods-import'

// Radix Select items cannot use an empty value.
const NO_PHASE = '__none'

const optionalCount = (min: number, message: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (/^\d+$/.test(value) && Number(value) >= min),
      message
    )

function createSchema(t: TranslateFn) {
  return z.object({
    name: z.string().trim().min(1, t('goods.err.name_required')).max(160),
    groupLabel: z.string().max(80),
    memberIds: z.array(z.string()),
    priceKrw: optionalCount(0, t('goods.err.unknown')),
    priceNote: z.string().max(120),
    salesChannel: z.enum(HUB_EVENT_GOODS_SALES_CHANNELS),
    purchaseLimit: optionalCount(1, t('goods.err.unknown')),
    limitNote: z.string().max(200),
    purchaseUrl: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (value) => value === '' || /^https:\/\/\S+$/i.test(value),
        t('hubEvent.linkUrlHttps')
      ),
    scheduleItemId: z.string(),
    isBonus: z.boolean(),
  })
}

type GoodsFormValues = z.infer<ReturnType<typeof createSchema>>

function toDefaults(item: HubEventGoodsItem | null): GoodsFormValues {
  return {
    name: item?.name ?? '',
    groupLabel: item?.groupLabel ?? '',
    memberIds: item?.memberIds ?? [],
    priceKrw: typeof item?.priceKrw === 'number' ? String(item.priceKrw) : '',
    priceNote: item?.priceNote ?? '',
    salesChannel: item?.salesChannel ?? 'online',
    purchaseLimit:
      typeof item?.purchaseLimit === 'number' ? String(item.purchaseLimit) : '',
    limitNote: item?.limitNote ?? '',
    purchaseUrl: item?.purchaseUrl ?? '',
    scheduleItemId: item?.scheduleItemId || NO_PHASE,
    isBonus: item?.isBonus === true,
  }
}

/** Request body (without `expectedRevision`); empty optional fields are null. */
function toGoodsInput(values: GoodsFormValues) {
  const text = (value: string) => value.trim() || null
  const count = (value: string) => (value.trim() ? Number(value) : null)
  return {
    name: values.name.trim(),
    groupLabel: text(values.groupLabel),
    memberIds: values.memberIds,
    priceKrw: count(values.priceKrw),
    priceNote: text(values.priceNote),
    salesChannel: values.salesChannel,
    purchaseLimit: count(values.purchaseLimit),
    limitNote: text(values.limitNote),
    isBonus: values.isBonus,
    purchaseUrl: text(values.purchaseUrl),
    scheduleItemId:
      values.scheduleItemId === NO_PHASE ? null : values.scheduleItemId,
  }
}

const formFields = new Set<string>([
  'name',
  'groupLabel',
  'memberIds',
  'priceKrw',
  'priceNote',
  'salesChannel',
  'purchaseLimit',
  'limitNote',
  'purchaseUrl',
  'scheduleItemId',
  'isBonus',
])

type GoodsDialogProps = {
  item: HubEventGoodsItem | null
  scheduleItems: HubEventScheduleItem[]
  members: GoodsMember[] | undefined
  membersUnavailable: boolean
  pending: boolean
  serverErrors?: HubEventValidationError[]
  onClose: () => void
  onSubmit: (input: Record<string, unknown>) => void
}

/** Create / edit dialog for one goods item. Mounted only while open. */
export function GoodsDialog({
  item,
  scheduleItems,
  members,
  membersUnavailable,
  pending,
  serverErrors,
  onClose,
  onSubmit,
}: GoodsDialogProps) {
  const t = useT()
  const schema = useMemo(() => createSchema(t), [t])
  const form = useForm<GoodsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(item),
  })

  // Point server errors at their controls ("memberIds[2]" -> memberIds).
  useEffect(() => {
    for (const error of serverErrors ?? []) {
      const name = goodsFieldControlName(error.field)
      if (formFields.has(name))
        form.setError(name as FieldPath<GoodsFormValues>, {
          type: 'server',
          message: error.message || error.reason,
        })
    }
  }, [serverErrors, form])

  const phaseOptions = useMemo(() => {
    const options = salesPhaseOptions(scheduleItems)
    const current = item?.scheduleItemId
    // Keep a stale (cancelled or removed) phase visible so it is not lost.
    if (current && !options.some((option) => option.id === current))
      options.push({
        id: current,
        label: salesPhaseLabel(scheduleItems, current),
      })
    return options
  }, [scheduleItems, item?.scheduleItemId])

  const memberGroups = useMemo(() => {
    const groups = new Map<string, GoodsMember[]>()
    for (const member of members ?? []) {
      const key = member.generationName || member.generationId || ''
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)?.push(member)
    }
    return [...groups.entries()]
  }, [members])

  const submit = form.handleSubmit((values) => onSubmit(toGoodsInput(values)))

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {item?.id ? t('goods.dialogEdit') : t('goods.dialogCreate')}
          </DialogTitle>
          <DialogDescription>{t('goods.help')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='hub-event-goods-form'
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
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('goods.name')}</FormLabel>
                  <FormControl>
                    <Input autoComplete='off' maxLength={160} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='groupLabel'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('goods.groupLabel')}</FormLabel>
                    <FormControl>
                      <Input autoComplete='off' maxLength={80} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='salesChannel'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('goods.salesChannel')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {HUB_EVENT_GOODS_SALES_CHANNELS.map((channel) => (
                          <SelectItem key={channel} value={channel}>
                            {t(salesChannelLabelKeys[channel])}
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
              name='memberIds'
              render={({ field }) => {
                const selected = new Set(field.value)
                const toggle = (id: string, checked: boolean) => {
                  const next = new Set(selected)
                  if (checked) next.add(id)
                  else next.delete(id)
                  field.onChange([...next])
                }
                const unknownIds = field.value.filter(
                  (id) => !(members ?? []).some((member) => member.id === id)
                )
                return (
                  <FormItem>
                    <FormLabel>{t('goods.members')}</FormLabel>
                    {membersUnavailable ? (
                      <Alert variant='destructive'>
                        <AlertDescription>
                          {t('goods.membersUnavailable')}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <div className='grid max-h-56 gap-3 overflow-y-auto rounded-md border p-3'>
                      {memberGroups.map(([group, groupMembers]) => (
                        <fieldset key={group} className='grid gap-2'>
                          {group ? (
                            <legend className='mb-1 text-xs font-medium text-muted-foreground'>
                              {group}
                            </legend>
                          ) : null}
                          <div className='flex flex-wrap gap-x-4 gap-y-2'>
                            {groupMembers.map((member) => {
                              const id = `hub-event-goods-member-${member.id}`
                              return (
                                <div
                                  key={member.id}
                                  className='flex items-center gap-2'
                                >
                                  <Checkbox
                                    id={id}
                                    checked={selected.has(member.id)}
                                    onCheckedChange={(checked) =>
                                      toggle(member.id, checked === true)
                                    }
                                  />
                                  <label htmlFor={id} className='text-sm'>
                                    {member.koreanName}
                                  </label>
                                </div>
                              )
                            })}
                          </div>
                        </fieldset>
                      ))}
                      {unknownIds.length ? (
                        <div className='flex flex-wrap gap-x-4 gap-y-2'>
                          {unknownIds.map((memberId) => {
                            const id = `hub-event-goods-member-${memberId}`
                            return (
                              <div
                                key={memberId}
                                className='flex items-center gap-2'
                              >
                                <Checkbox
                                  id={id}
                                  checked
                                  onCheckedChange={(checked) =>
                                    toggle(memberId, checked === true)
                                  }
                                />
                                <label htmlFor={id} className='text-sm'>
                                  {memberId}
                                </label>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                    <FormDescription>{t('goods.membersHelp')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='priceKrw'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('goods.price')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        step={1}
                        inputMode='numeric'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='priceNote'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('goods.priceNote')}</FormLabel>
                    <FormControl>
                      <Input autoComplete='off' maxLength={120} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='purchaseLimit'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('goods.purchaseLimit')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        max={9999}
                        step={1}
                        inputMode='numeric'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='limitNote'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('goods.limitNote')}</FormLabel>
                    <FormControl>
                      <Input autoComplete='off' maxLength={200} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name='purchaseUrl'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('goods.purchaseUrl')}</FormLabel>
                  <FormControl>
                    <Input
                      type='url'
                      autoComplete='off'
                      maxLength={2048}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid gap-4 sm:grid-cols-2 sm:items-end'>
              <FormField
                control={form.control}
                name='scheduleItemId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('goods.salesPhase')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PHASE}>
                          {t('goods.salesPhaseNone')}
                        </SelectItem>
                        {phaseOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
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
                name='isBonus'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center gap-2 pb-2'>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                      />
                    </FormControl>
                    <FormLabel className='font-normal'>
                      {t('goods.isBonus')}
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>
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
          <Button type='submit' form='hub-event-goods-form' disabled={pending}>
            {pending ? <Loader2 className='animate-spin' /> : null}
            {t('goods.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
