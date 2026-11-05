import { type FieldPath, type UseFormReturn, useWatch } from 'react-hook-form'
import { type MessageKey, useT } from '@/lib/i18n'
import { Checkbox } from '@/components/ui/checkbox'
import {
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
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  categoryLabelKeys,
  type HubEventFormValues,
  imagePolicyLabelKeys,
  participationLabelKeys,
  sourceTypeLabelKeys,
  statusLabelKeys,
} from '../form'
import {
  HUB_EVENT_CATEGORIES,
  HUB_EVENT_IMAGE_POLICY_STATES,
  HUB_EVENT_PARTICIPATION_MODES,
  HUB_EVENT_SOURCE_TYPES,
  HUB_EVENT_STATUSES,
} from '../types'
import { LinkEditor, type LinkRowErrors } from './link-editor'

type Form = UseFormReturn<HubEventFormValues>
type TextField = Exclude<
  FieldPath<HubEventFormValues>,
  'album' | 'notificationEligible' | 'links' | `links.${string}`
>

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className='grid gap-4'>
      <h3 className='font-semibold'>{title}</h3>
      {children}
    </section>
  )
}

function TextInputField({
  form,
  name,
  label,
  description,
  type,
  placeholder,
  readOnly,
  multiline,
}: {
  form: Form
  name: TextField
  label: string
  description?: string
  type?: string
  placeholder?: string
  readOnly?: boolean
  multiline?: boolean
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {multiline ? (
              <Textarea rows={3} {...field} value={field.value as string} />
            ) : (
              <Input
                type={type}
                autoComplete='off'
                placeholder={placeholder}
                readOnly={readOnly}
                {...field}
                value={field.value as string}
              />
            )}
          </FormControl>
          {description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function EnumSelectField<T extends string>({
  form,
  name,
  label,
  values,
  labels,
}: {
  form: Form
  name: TextField
  label: string
  values: readonly T[]
  labels: Record<T, MessageKey>
}) {
  const t = useT()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={field.value as string} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {values.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(labels[value])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CheckboxField({
  form,
  name,
  label,
}: {
  form: Form
  name: 'album' | 'notificationEligible'
  label: string
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className='flex flex-row items-center gap-2'>
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          </FormControl>
          <FormLabel className='font-normal'>{label}</FormLabel>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type HubEventInfoFormProps = {
  form: Form
  /** Timeline mode: start/end come from the schedule items. */
  timelineMode: boolean
  linkErrors: Record<number, LinkRowErrors>
}

export function HubEventInfoForm({
  form,
  timelineMode,
  linkErrors,
}: HubEventInfoFormProps) {
  const t = useT()
  const links = useWatch({ control: form.control, name: 'links' })

  return (
    <div className='grid gap-6'>
      <Section title={t('hubEvent.basic')}>
        <TextInputField form={form} name='title' label={t('hubEvent.title')} />
        <TextInputField
          form={form}
          name='summary'
          label={t('hubEvent.summary')}
          multiline
        />
        <div className='grid gap-4 sm:grid-cols-3'>
          <EnumSelectField
            form={form}
            name='category'
            label={t('hubEvent.category')}
            values={HUB_EVENT_CATEGORIES}
            labels={categoryLabelKeys}
          />
          <EnumSelectField
            form={form}
            name='participationMode'
            label={t('hubEvent.participation')}
            values={HUB_EVENT_PARTICIPATION_MODES}
            labels={participationLabelKeys}
          />
          <EnumSelectField
            form={form}
            name='status'
            label={t('common.status')}
            values={HUB_EVENT_STATUSES}
            labels={statusLabelKeys}
          />
        </div>
        <CheckboxField form={form} name='album' label={t('hubEvent.album')} />
        <TextInputField
          form={form}
          name='generationId'
          label={t('hubEvent.generation')}
          placeholder='official, gen1, gen2, gen3'
          description={t('hubEvent.generationHelp')}
        />
        <TextInputField
          form={form}
          name='memberId'
          label={t('hubEvent.member')}
          placeholder='akane-lize'
          description={t('hubEvent.memberHelp')}
        />
      </Section>
      <Separator />
      <Section title={t('hubEvent.sourceThumbnail')}>
        <div className='grid gap-4 sm:grid-cols-2'>
          <EnumSelectField
            form={form}
            name='sourceType'
            label={t('hubEvent.sourceType')}
            values={HUB_EVENT_SOURCE_TYPES}
            labels={sourceTypeLabelKeys}
          />
          <EnumSelectField
            form={form}
            name='imagePolicyState'
            label={t('hubEvent.imagePolicy')}
            values={HUB_EVENT_IMAGE_POLICY_STATES}
            labels={imagePolicyLabelKeys}
          />
        </div>
        <TextInputField
          form={form}
          name='sourceUrl'
          type='url'
          label={t('hubEvent.sourceUrl')}
        />
        <TextInputField
          form={form}
          name='sourceLabel'
          label={t('hubEvent.sourceLabel')}
        />
        <div
          aria-label={t('hubEvent.sourceMetadataHelp')}
          className='grid gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground'
        >
          <strong className='text-foreground'>
            {t('hubEvent.noBundledImage')}
          </strong>
          <p>
            <strong>{t('hubEvent.sourceType')}:</strong>{' '}
            {t('hubEvent.helpSourceType')}
          </p>
          <p>
            <strong>{t('hubEvent.imagePolicy')}:</strong>{' '}
            {t('hubEvent.helpImagePolicy')}
          </p>
          <p>
            <strong>{t('hubEvent.helpCommon')}:</strong>{' '}
            {t('hubEvent.metadataNotice')}
          </p>
        </div>
        <TextInputField
          form={form}
          name='imageUrl'
          type='url'
          label={t('hubEvent.imageUrl')}
        />
        <TextInputField
          form={form}
          name='imageSourceLabel'
          label={t('hubEvent.imageSourceLabel')}
        />
        <TextInputField
          form={form}
          name='imageSourceUrl'
          type='url'
          label={t('hubEvent.imageSourceUrl')}
        />
      </Section>
      <Separator />
      <Section title={t('hubEvent.schedule')}>
        <TextInputField
          form={form}
          name='announcedAt'
          type='datetime-local'
          label={t('hubEvent.announcedAt')}
        />
        <div className='grid gap-4 sm:grid-cols-2'>
          <TextInputField
            form={form}
            name='startsAt'
            type='datetime-local'
            label={t('hubEvent.startsAt')}
            readOnly={timelineMode}
          />
          <TextInputField
            form={form}
            name='endsAt'
            type='datetime-local'
            label={t('hubEvent.endsAt')}
            readOnly={timelineMode}
          />
        </div>
        <p className='text-sm text-muted-foreground'>
          {t('hubEvent.scheduleMode')}:{' '}
          {timelineMode ? t('hubEvent.timeline') : t('hubEvent.singleWindow')}
        </p>
      </Section>
      <Separator />
      <Section title={t('hubEvent.linksVenue')}>
        <LinkEditor
          idPrefix='hub-event-link'
          title={t('hubEvent.relatedLinks')}
          description={t('hubEvent.relatedLinksHelp')}
          links={links}
          errors={linkErrors}
          onChange={(next) =>
            form.setValue('links', next, { shouldDirty: true })
          }
        />
        <TextInputField
          form={form}
          name='venueName'
          label={t('hubEvent.venueName')}
        />
        <TextInputField
          form={form}
          name='venueAddress'
          label={t('hubEvent.venueAddress')}
        />
        <CheckboxField
          form={form}
          name='notificationEligible'
          label={t('hubEvent.notificationEligible')}
        />
      </Section>
    </div>
  )
}
