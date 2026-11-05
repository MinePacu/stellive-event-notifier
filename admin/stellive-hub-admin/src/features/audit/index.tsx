import { Cog, Database, KeyRound, RefreshCw } from 'lucide-react'
import { type MessageKey, useT } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { PageHeading } from '@/components/page-heading'

// Static explanation of where operator-facing activity is recorded, as in the
// legacy console.
const ENTRIES: {
  title: MessageKey
  description: MessageKey
  icon: typeof KeyRound
}[] = [
  {
    title: 'dashboard.adminSession',
    description: 'dashboard.loginDescription',
    icon: KeyRound,
  },
  {
    title: 'dashboard.hubEventChanges',
    description: 'hubEvent.auditDescription',
    icon: Database,
  },
  {
    title: 'dashboard.adapterRefresh',
    description: 'dashboard.refreshDescription',
    icon: RefreshCw,
  },
  {
    title: 'dashboard.internalOperations',
    description: 'dashboard.operationsDescription',
    icon: Cog,
  },
]

export function Audit() {
  const t = useT()
  return (
    <>
      <AppHeader />
      <Main>
        <PageHeading
          title={t('nav.audit')}
          description={t('page.auditDescription')}
        />
        <Card>
          <CardHeader>
            <CardTitle>{t('audit.recent')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className='divide-y'>
              {ENTRIES.map(({ title, description, icon: Icon }) => (
                <li
                  key={title}
                  className='flex items-start gap-3 py-3 first:pt-0 last:pb-0'
                >
                  <Icon className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                  <div className='min-w-0 space-y-0.5'>
                    <div className='text-sm font-medium'>{t(title)}</div>
                    <div className='text-sm text-muted-foreground'>
                      {t(description)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
