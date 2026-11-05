import {
  DASHBOARD_AUTO_REFRESH_MS,
  HUB_EVENT_PAGE_SIZES,
  type HubEventPageSize,
  usePreferencesStore,
} from '@/stores/preferences-store'
import { type Locale, useLocale, useT } from '@/lib/i18n'
import { useTheme } from '@/context/theme-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

type Theme = 'light' | 'dark' | 'system'

function PreferenceRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string
  description?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <div className='min-w-0 flex-1 space-y-1'>
        <Label htmlFor={htmlFor}>{title}</Label>
        {description ? (
          <p className='text-sm text-muted-foreground'>{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

export function PreferencesCard() {
  const t = useT()
  const { locale, setLocale } = useLocale()
  const { theme, setTheme } = useTheme()
  const autoRefresh = usePreferencesStore((state) => state.dashboardAutoRefresh)
  const setAutoRefresh = usePreferencesStore(
    (state) => state.setDashboardAutoRefresh
  )
  const pageSize = usePreferencesStore((state) => state.hubEventPageSize)
  const setPageSize = usePreferencesStore((state) => state.setHubEventPageSize)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.consolePreferences')}</CardTitle>
      </CardHeader>
      <CardContent className='grid gap-4'>
        <PreferenceRow
          title={t('language.label')}
          description={t('settings.languageDescription')}
          htmlFor='settings-language'
        >
          <Select
            value={locale}
            onValueChange={(value) => setLocale(value as Locale)}
          >
            <SelectTrigger id='settings-language' className='w-40'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='ko' lang='ko'>
                {t('language.ko')}
              </SelectItem>
              <SelectItem value='en' lang='en'>
                {t('language.en')}
              </SelectItem>
            </SelectContent>
          </Select>
        </PreferenceRow>
        <Separator />
        <PreferenceRow
          title={t('theme.label')}
          description={t('settings.themeDescription')}
          htmlFor='settings-theme'
        >
          <Select
            value={theme}
            onValueChange={(value) => setTheme(value as Theme)}
          >
            <SelectTrigger id='settings-theme' className='w-40'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='light'>{t('theme.light')}</SelectItem>
              <SelectItem value='dark'>{t('theme.dark')}</SelectItem>
              <SelectItem value='system'>{t('theme.system')}</SelectItem>
            </SelectContent>
          </Select>
        </PreferenceRow>
        <Separator />
        <PreferenceRow
          title={t('dashboard.autoRefresh')}
          description={t('settings.autoRefreshDescription', {
            seconds: DASHBOARD_AUTO_REFRESH_MS / 1000,
          })}
          htmlFor='settings-auto-refresh'
        >
          <Switch
            id='settings-auto-refresh'
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
            aria-label={t('settings.refreshDashboard')}
          />
        </PreferenceRow>
        <Separator />
        <PreferenceRow
          title={t('settings.hubEventPageSize')}
          description={t('settings.eventsPerPage')}
          htmlFor='settings-page-size'
        >
          <Select
            value={String(pageSize)}
            onValueChange={(value) =>
              setPageSize(Number(value) as HubEventPageSize)
            }
          >
            <SelectTrigger id='settings-page-size' className='w-40'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HUB_EVENT_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PreferenceRow>
      </CardContent>
    </Card>
  )
}
