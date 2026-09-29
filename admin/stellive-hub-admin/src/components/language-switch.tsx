import { Check, Languages } from 'lucide-react'
import { type Locale, locales, useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const localeLabelKey = {
  ko: 'language.ko',
  en: 'language.en',
} as const satisfies Record<Locale, string>

export function LanguageSwitch() {
  const t = useT()
  const { locale, setLocale } = useLocale()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='scale-95 rounded-full'
          aria-label={t('common.changeLanguage')}
          title={t('language.label')}
        >
          <Languages className='size-[1.2rem]' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {locales.map((value) => (
          <DropdownMenuItem
            key={value}
            lang={value}
            onClick={() => setLocale(value)}
          >
            {t(localeLabelKey[value])}
            <Check
              size={14}
              className={cn('ms-auto', locale !== value && 'hidden')}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
