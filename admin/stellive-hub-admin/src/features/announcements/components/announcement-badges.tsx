import { Pin } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import {
  type Announcement,
  SEVERITY_LABEL_KEYS,
  STATE_LABEL_KEYS,
  TYPE_LABEL_KEYS,
} from '../data/types'

const STATE_VARIANT = {
  draft: 'secondary',
  published: 'default',
  archived: 'outline',
} as const

const SEVERITY_VARIANT = {
  info: 'outline',
  important: 'secondary',
  critical: 'destructive',
} as const

/** State / type / severity / flags of an announcement as badges. */
export function AnnouncementBadges({ item }: { item: Announcement }) {
  const t = useT()
  return (
    <div className='flex flex-wrap items-center gap-1'>
      <Badge variant={STATE_VARIANT[item.publicationState]}>
        {t(STATE_LABEL_KEYS[item.publicationState])}
      </Badge>
      <Badge variant='outline'>{t(TYPE_LABEL_KEYS[item.type])}</Badge>
      <Badge variant={SEVERITY_VARIANT[item.severity]}>
        {t(SEVERITY_LABEL_KEYS[item.severity])}
      </Badge>
      {item.resolvedAt ? (
        <Badge variant='outline'>{t('status.resolved')}</Badge>
      ) : null}
      {item.isPinned ? (
        <Badge variant='outline'>
          <Pin />
          {t('announcement.pinned')}
        </Badge>
      ) : null}
      <span className='text-xs text-muted-foreground'>
        {t('announcement.attention', { revision: item.attentionRevision })}
      </span>
    </div>
  )
}
