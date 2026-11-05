import { ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingsNote } from './settings-note'

export function SecurityNotesCard() {
  const t = useT()
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <ShieldCheck className='size-4' />
          {t('settings.securityNotes')}
        </CardTitle>
      </CardHeader>
      <CardContent className='grid gap-3'>
        <SettingsNote
          title={t('settings.adminSessionFirst')}
          description={t('settings.sessionDescription')}
        />
        <SettingsNote
          title={t('settings.internalTokenLater')}
          description={t('settings.bearerDescription')}
        />
        <SettingsNote
          title={t('settings.noBundledAssets')}
          description={t('settings.assetsDescription')}
        />
      </CardContent>
    </Card>
  )
}
