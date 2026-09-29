import { useRef, useState } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { PageHeading } from '@/components/page-heading'
import { AnnouncementEditor } from './components/announcement-editor'
import { AnnouncementHistory } from './components/announcement-history'
import {
  AnnouncementList,
  type StateFilter,
} from './components/announcement-list'
import { type Announcement } from './data/types'

type Binding = { item: Announcement | null; nonce: number }

export function Announcements() {
  const t = useT()
  const queryClient = useQueryClient()
  const fetching = useIsFetching({ queryKey: ['announcements'] }) > 0
  const [filter, setFilter] = useState<StateFilter>('all')
  // `nonce` remounts the editor so its form re-reads the bound item.
  const [binding, setBinding] = useState<Binding>({ item: null, nonce: 0 })
  const editorRef = useRef<HTMLDivElement>(null)

  const bind = (item: Announcement | null) =>
    setBinding((current) => ({ item, nonce: current.nonce + 1 }))

  const select = (item: Announcement) => {
    bind(item)
    // Single-column (phone/tablet) layout: bring the editor into view.
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      requestAnimationFrame(() =>
        editorRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      )
    }
  }

  return (
    <>
      <AppHeader />
      <Main>
        <PageHeading
          title={t('announcement.title')}
          description={t('announcement.description')}
          actions={
            <>
              <Button
                type='button'
                variant='outline'
                onClick={() =>
                  void queryClient.invalidateQueries({
                    queryKey: ['announcements'],
                  })
                }
                disabled={fetching}
              >
                <RefreshCw className={fetching ? 'animate-spin' : undefined} />
                {t('common.refresh')}
              </Button>
              <Button type='button' onClick={() => bind(null)}>
                <Plus />
                {t('announcement.new')}
              </Button>
            </>
          }
        />
        <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]'>
          <AnnouncementList
            filter={filter}
            onFilterChange={setFilter}
            selectedId={binding.item?.id}
            onSelect={select}
          />
          <div ref={editorRef} className='grid scroll-mt-20 gap-4'>
            <AnnouncementEditor
              key={binding.nonce}
              announcement={binding.item}
              onBind={bind}
            />
            {binding.item ? (
              <AnnouncementHistory key={binding.item.id} id={binding.item.id} />
            ) : null}
          </div>
        </div>
      </Main>
    </>
  )
}
