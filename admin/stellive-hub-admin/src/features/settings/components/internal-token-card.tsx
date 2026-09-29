import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { apiFetch, describeApiError } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'

/** Endpoint used by "Test connection" (same as the legacy console). */
const CONNECTION_TEST_PATH = '/v1/internal/admin/overview'

type Status = { text: string; tone: 'info' | 'success' | 'error' }

export function InternalTokenCard() {
  const t = useT()
  const storedToken = useAuthStore((state) => state.internalToken)
  const setInternalToken = useAuthStore((state) => state.setInternalToken)
  const [value, setValue] = useState(storedToken)
  const [status, setStatus] = useState<Status | null>(null)
  const [testing, setTesting] = useState(false)

  const handleSave = () => {
    setInternalToken(value)
    setStatus({
      text: value.trim()
        ? t('settings.tokenStored')
        : t('settings.tokenCleared'),
      tone: 'success',
    })
  }

  const handleClear = () => {
    setValue('')
    setInternalToken(null)
    setStatus({ text: t('settings.tokenCleared'), tone: 'success' })
  }

  const handleTest = async () => {
    if (!value.trim()) {
      setStatus({ text: t('settings.tokenEmpty'), tone: 'error' })
      return
    }
    setInternalToken(value)
    setTesting(true)
    setStatus({ text: t('settings.tokenTesting'), tone: 'info' })
    try {
      await apiFetch(CONNECTION_TEST_PATH)
      setStatus({ text: t('settings.tokenTestOk'), tone: 'success' })
    } catch (error) {
      setStatus({
        text: t('settings.tokenTestFailed', {
          reason: describeApiError(error),
        }),
        tone: 'error',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div className='space-y-1.5'>
            <CardTitle className='flex items-center gap-2'>
              <KeyRound className='size-4' />
              {t('settings.internalToken')}
            </CardTitle>
            <CardDescription>{t('settings.internalTokenHelp')}</CardDescription>
          </div>
          <div className='flex flex-wrap gap-1.5'>
            <Badge variant='outline'>{t('settings.sessionOnly')}</Badge>
            <Badge variant={storedToken ? 'default' : 'secondary'}>
              {storedToken
                ? t('settings.tokenActive')
                : t('settings.tokenNotSet')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className='grid gap-2'>
        <Label htmlFor='internal-token'>{t('settings.internalToken')}</Label>
        <PasswordInput
          id='internal-token'
          autoComplete='off'
          spellCheck={false}
          placeholder={t('settings.tokenPlaceholder')}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSave()
            }
          }}
        />
        <p
          aria-live='polite'
          className={cn(
            'min-h-5 text-sm',
            status?.tone === 'error' && 'text-destructive',
            status?.tone === 'success' &&
              'text-emerald-600 dark:text-emerald-400',
            status?.tone === 'info' && 'text-muted-foreground'
          )}
        >
          {status?.text}
        </p>
      </CardContent>
      <CardFooter className='flex flex-wrap gap-2'>
        <Button type='button' onClick={handleSave} disabled={testing}>
          {t('settings.useToken')}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => void handleTest()}
          disabled={testing}
        >
          {testing ? <Loader2 className='animate-spin' /> : null}
          {t('settings.testConnection')}
        </Button>
        <Button
          type='button'
          variant='ghost'
          onClick={handleClear}
          disabled={testing}
        >
          {t('common.clear')}
        </Button>
      </CardFooter>
    </Card>
  )
}
