import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type LinkDraft, linkKindLabelKeys, newLinkKey } from '../form'
import { HUB_EVENT_LINK_KINDS, type HubEventLinkKind } from '../types'

export type LinkRowErrors = { url?: string; label?: string; row?: boolean }

type LinkEditorProps = {
  idPrefix: string
  title: string
  description: string
  links: LinkDraft[]
  onChange: (links: LinkDraft[]) => void
  /** Per-row errors, keyed by row index. */
  errors?: Record<number, LinkRowErrors>
  disabled?: boolean
}

/** Ordered list of kind / label / HTTPS URL link rows. */
export function LinkEditor({
  idPrefix,
  title,
  description,
  links,
  onChange,
  errors,
  disabled,
}: LinkEditorProps) {
  const t = useT()

  const update = (index: number, patch: Partial<LinkDraft>) =>
    onChange(
      links.map((link, i) => (i === index ? { ...link, ...patch } : link))
    )

  const move = (index: number, delta: number) => {
    const next = index + delta
    if (next < 0 || next >= links.length) return
    const copy = links.slice()
    const [row] = copy.splice(index, 1)
    copy.splice(next, 0, row)
    onChange(copy)
  }

  const add = () =>
    onChange([
      ...links,
      { key: newLinkKey(), kind: 'source', label: '', url: '' },
    ])

  return (
    <div className='grid gap-3'>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div className='min-w-0 space-y-1'>
          <p className='text-sm font-medium'>
            {title} ({links.length})
          </p>
          <p className='text-sm text-muted-foreground'>{description}</p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={add}
          disabled={disabled}
        >
          <Plus />
          {t('hubEvent.addLink')}
        </Button>
      </div>
      {links.map((link, index) => {
        const rowErrors = errors?.[index]
        const custom = link.kind === 'custom'
        return (
          <div
            key={link.key}
            className={cn(
              'grid gap-3 rounded-md border p-3 sm:grid-cols-[10rem_1fr] md:grid-cols-[9rem_10rem_1fr_auto] md:items-end',
              rowErrors && 'border-destructive'
            )}
          >
            <div className='grid gap-1.5'>
              <Label htmlFor={`${idPrefix}-${link.key}-kind`}>
                {t('hubEvent.linkKind')}
              </Label>
              <Select
                value={link.kind}
                onValueChange={(value) =>
                  update(index, { kind: value as HubEventLinkKind })
                }
                disabled={disabled}
              >
                <SelectTrigger
                  id={`${idPrefix}-${link.key}-kind`}
                  className='w-full'
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HUB_EVENT_LINK_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(linkKindLabelKeys[kind])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor={`${idPrefix}-${link.key}-label`}>
                {t('hubEvent.linkLabel')}
              </Label>
              <Input
                id={`${idPrefix}-${link.key}-label`}
                value={link.label}
                maxLength={80}
                required={custom}
                placeholder={
                  custom
                    ? t('hubEvent.linkCustomLabelRequired')
                    : t('hubEvent.linkOptional')
                }
                aria-invalid={rowErrors?.label ? true : undefined}
                onChange={(event) =>
                  update(index, { label: event.target.value })
                }
                disabled={disabled}
              />
              {rowErrors?.label ? (
                <p className='text-sm text-destructive'>{rowErrors.label}</p>
              ) : null}
            </div>
            <div className='grid gap-1.5 sm:col-span-2 md:col-span-1'>
              <Label htmlFor={`${idPrefix}-${link.key}-url`}>
                {t('hubEvent.linkHttpsUrl')}
              </Label>
              <Input
                id={`${idPrefix}-${link.key}-url`}
                type='url'
                inputMode='url'
                autoComplete='off'
                value={link.url}
                placeholder='https://'
                aria-invalid={rowErrors?.url ? true : undefined}
                onChange={(event) => update(index, { url: event.target.value })}
                disabled={disabled}
              />
              {rowErrors?.url ? (
                <p className='text-sm text-destructive'>{rowErrors.url}</p>
              ) : null}
            </div>
            <div className='flex items-center gap-1 sm:col-span-2 md:col-span-1'>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label={t('hubEvent.linkMoveUp')}
                title={t('hubEvent.linkMoveUp')}
                onClick={() => move(index, -1)}
                disabled={disabled || index === 0}
              >
                <ArrowUp />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label={t('hubEvent.linkMoveDown')}
                title={t('hubEvent.linkMoveDown')}
                onClick={() => move(index, 1)}
                disabled={disabled || index === links.length - 1}
              >
                <ArrowDown />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='text-destructive'
                onClick={() => onChange(links.filter((_, i) => i !== index))}
                disabled={disabled}
              >
                <Trash2 />
                {t('hubEvent.linkRemove')}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
