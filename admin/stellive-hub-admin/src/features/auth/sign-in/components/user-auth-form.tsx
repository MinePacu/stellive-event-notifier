import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { describeApiError } from '@/lib/api'
import { type TranslateFn, useT } from '@/lib/i18n'
import { isTauri } from '@/lib/runtime'
import { normalizeServerUrl } from '@/lib/server-url'
import { safeRedirect, signIn } from '@/lib/session'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

function createSchema(t: TranslateFn, desktop: boolean) {
  return z.object({
    serverUrl: desktop
      ? z.string().refine((value) => normalizeServerUrl(value) !== null, {
          message: t('auth.serverUrlInvalid'),
        })
      : z.string(),
    token: z.string().trim().min(1, t('auth.tokenRequired')),
  })
}

type FormValues = z.infer<ReturnType<typeof createSchema>>

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const t = useT()
  const desktop = isTauri()
  const navigate = useNavigate()
  const storedServerUrl = useAuthStore((state) => state.serverUrl)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(createSchema(t, desktop)),
    defaultValues: {
      serverUrl: storedServerUrl,
      token: '',
    },
  })

  async function onSubmit(data: FormValues) {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      await signIn({
        token: data.token,
        serverUrl: desktop ? data.serverUrl : undefined,
      })
      toast.success(t('auth.signedIn'))
      await navigate({ href: safeRedirect(redirectTo), replace: true })
    } catch (error) {
      setErrorMessage(describeApiError(error))
      form.resetField('token')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        noValidate
        {...props}
      >
        {errorMessage ? (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {desktop ? (
          <FormField
            control={form.control}
            name='serverUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.serverUrl')}</FormLabel>
                <FormControl>
                  <Input
                    type='url'
                    inputMode='url'
                    autoComplete='url'
                    spellCheck={false}
                    placeholder={t('auth.serverUrlPlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>{t('auth.serverUrlHelp')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        <FormField
          control={form.control}
          name='token'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('login.token')}</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete='off'
                  spellCheck={false}
                  autoFocus
                  placeholder={t('login.tokenPlaceholder')}
                  {...field}
                />
              </FormControl>
              {desktop ? (
                <FormDescription>{t('auth.desktopTokenNote')}</FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          {isLoading ? t('auth.signingIn') : t('login.signIn')}
        </Button>
      </form>
    </Form>
  )
}
