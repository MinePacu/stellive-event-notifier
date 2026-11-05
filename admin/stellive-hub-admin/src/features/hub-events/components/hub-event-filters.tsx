import { type MessageKey, useT } from '@/lib/i18n'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  categoryLabelKeys,
  participationLabelKeys,
  publicationStateLabelKeys,
  statusLabelKeys,
} from '../form'
import {
  HUB_EVENT_CATEGORIES,
  HUB_EVENT_PARTICIPATION_MODES,
  HUB_EVENT_PUBLICATION_STATES,
  HUB_EVENT_STATUSES,
  type HubEventListFilters,
} from '../types'

/** Radix Select cannot use '' as an item value. */
const ALL = '__all__'

type FilterSelectProps = {
  id: string
  label: string
  tooltip?: string
  value: string
  allLabel: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}

function FilterSelect({
  id,
  label,
  tooltip,
  value,
  allLabel,
  options,
  onChange,
}: FilterSelectProps) {
  return (
    <div className='grid min-w-0 gap-1.5'>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Label htmlFor={id} className='w-fit cursor-help'>
              {label}
            </Label>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}
      <Select
        value={value || ALL}
        onValueChange={(next) => onChange(next === ALL ? '' : next)}
      >
        <SelectTrigger id={id} className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

type HubEventFiltersProps = {
  filters: HubEventListFilters
  onChange: (patch: Partial<HubEventListFilters>) => void
}

export function HubEventFilters({ filters, onChange }: HubEventFiltersProps) {
  const t = useT()
  const options = <T extends string>(
    values: readonly T[],
    keys: Record<T, MessageKey>
  ) => values.map((value) => ({ value, label: t(keys[value]) }))

  return (
    <div className='grid gap-3'>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
        <FilterSelect
          id='hub-event-state-filter'
          label={t('hubEvent.publicationState')}
          tooltip={t('hubEvent.publicationStateHelp')}
          value={filters.publicationState}
          allLabel={t('common.all')}
          options={options(
            HUB_EVENT_PUBLICATION_STATES,
            publicationStateLabelKeys
          )}
          onChange={(publicationState) => onChange({ publicationState })}
        />
        <FilterSelect
          id='hub-event-status-filter'
          label={t('hubEvent.publicStatus')}
          tooltip={t('hubEvent.publicStatusHelp')}
          value={filters.status}
          allLabel={t('hubEvent.allStatuses')}
          options={options(HUB_EVENT_STATUSES, statusLabelKeys)}
          onChange={(status) => onChange({ status })}
        />
        <FilterSelect
          id='hub-event-category-filter'
          label={t('hubEvent.category')}
          value={filters.category}
          allLabel={t('common.all')}
          options={options(HUB_EVENT_CATEGORIES, categoryLabelKeys)}
          onChange={(category) => onChange({ category })}
        />
        <FilterSelect
          id='hub-event-participation-mode-filter'
          label={t('hubEvent.participation')}
          value={filters.participationMode}
          allLabel={t('common.all')}
          options={options(
            HUB_EVENT_PARTICIPATION_MODES,
            participationLabelKeys
          )}
          onChange={(participationMode) => onChange({ participationMode })}
        />
        <FilterSelect
          id='hub-event-tag-filter'
          label={t('hubEvent.tags')}
          value={filters.tag}
          allLabel={t('common.all')}
          options={[{ value: 'album', label: t('hubEvent.album') }]}
          onChange={(tag) => onChange({ tag })}
        />
      </div>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_auto] lg:items-end'>
        <div className='grid gap-1.5'>
          <Label htmlFor='hub-event-generation-filter'>
            {t('hubEvent.generation')}
          </Label>
          <Input
            id='hub-event-generation-filter'
            autoComplete='off'
            placeholder='official, gen1, gen2, gen3'
            value={filters.generationId}
            onChange={(event) => onChange({ generationId: event.target.value })}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='hub-event-member-filter'>
            {t('hubEvent.member')}
          </Label>
          <Input
            id='hub-event-member-filter'
            autoComplete='off'
            placeholder='akane-lize'
            value={filters.memberId}
            onChange={(event) => onChange({ memberId: event.target.value })}
          />
        </div>
        <div className='grid gap-1.5 sm:col-span-2 lg:col-span-1'>
          <Label htmlFor='hub-event-search'>{t('hubEvent.search')}</Label>
          <Input
            id='hub-event-search'
            type='search'
            autoComplete='off'
            spellCheck={false}
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
          />
        </div>
        <div className='flex h-9 items-center gap-2'>
          <Checkbox
            id='hub-event-include-deleted'
            checked={filters.includeDeleted}
            onCheckedChange={(checked) =>
              onChange({ includeDeleted: checked === true })
            }
          />
          <Label htmlFor='hub-event-include-deleted'>
            {t('hubEvent.includeDeleted')}
          </Label>
        </div>
      </div>
    </div>
  )
}
