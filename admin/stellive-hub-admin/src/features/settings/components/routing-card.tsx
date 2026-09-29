import { useT } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingsNote } from './settings-note'

export function RoutingCard() {
  const t = useT()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.recommendedRouting')}</CardTitle>
      </CardHeader>
      <CardContent className='grid gap-3'>
        <SettingsNote
          title={t('nav.dashboard')}
          description={t('settings.dashboardRouting')}
        />
        <SettingsNote
          title={t('nav.operations')}
          description={t('settings.operationsRouting')}
        />
      </CardContent>
    </Card>
  )
}
