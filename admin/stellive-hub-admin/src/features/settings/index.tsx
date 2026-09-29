import { useT } from '@/lib/i18n'
import { isTauri } from '@/lib/runtime'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { PageHeading } from '@/components/page-heading'
import { InternalTokenCard } from './components/internal-token-card'
import { PreferencesCard } from './components/preferences-card'
import { RoutingCard } from './components/routing-card'
import { SecurityNotesCard } from './components/security-notes-card'
import { ServerCard } from './components/server-card'

export function Settings() {
  const t = useT()
  const desktop = isTauri()
  return (
    <>
      <AppHeader />
      <Main>
        <PageHeading
          title={t('nav.settings')}
          description={t('settings.description')}
        />
        <div className='grid items-start gap-4 lg:grid-cols-2'>
          <div className='grid gap-4'>
            <InternalTokenCard />
            <SecurityNotesCard />
          </div>
          <div className='grid gap-4'>
            {desktop ? <ServerCard /> : null}
            <PreferencesCard />
            <RoutingCard />
          </div>
        </div>
      </Main>
    </>
  )
}
