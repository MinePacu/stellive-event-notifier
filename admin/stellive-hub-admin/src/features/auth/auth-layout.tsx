import { BellRing } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { isTauri } from '@/lib/runtime'
import { LanguageSwitch } from '@/components/language-switch'
import { ThemeSwitch } from '@/components/theme-switch'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const t = useT()
  return (
    <div className='relative container grid h-svh max-w-none items-center justify-center desktop:pt-(--titlebar-height)'>
      {isTauri() && (
        // Desktop: window drag strip under the traffic lights (overlay title bar).
        <div
          data-tauri-drag-region
          className='fixed inset-x-0 top-0 h-(--titlebar-height) select-none'
        />
      )}
      <div className='absolute end-4 top-4 flex items-center gap-1 desktop:top-1'>
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:p-8'>
        <div className='mb-4 flex items-center justify-center gap-2'>
          <div className='flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
            <BellRing className='size-4' />
          </div>
          <h1 className='text-xl font-medium'>{t('app.name')}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
