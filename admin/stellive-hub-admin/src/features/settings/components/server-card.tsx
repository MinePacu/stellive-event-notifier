import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Server } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { type TranslateFn, useT } from '@/lib/i18n'
import { normalizeServerUrl } from '@/lib/server-url'
import { signOut } from '@/lib/session'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

function createSchema(t: TranslateFn) {
  return z.object({
    serverUrl: z
      .string()
      .refine((value) => normalizeServerUrl(value) !== null, {
        message: t('auth.serverUrlInvalid'),
      }),
  })
}

type FormValues = z.infer<ReturnType<typeof createSchema>>

/** Desktop (Tauri) only: API server the app talks to. */
export function ServerCard() {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const serverUrl = useAuthStore((state) => state.serverUrl)
  const setServerUrl = useAuthStore((state) => state.setServerUrl)

  const form = useForm<FormValues>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: { serverUrl },
  })

  async function onSubmit(data: FormValues) {
    const next = normalizeServerUrl(data.serverUrl)
    if (!next || next === serverUrl) {
      toast.info(t('settings.serverUnchanged'))
      return
    }
    await signOut()
    setServerUrl(next)
    queryClient.clear()
    toast.success(t('settings.serverSaved'))
    await navigate({ to: '/sign-in', replace: true })
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div className='space-y-1.5'>
            <CardTitle className='flex items-center gap-2'>
              <Server className='size-4' />
              {t('settings.server')}
            </CardTitle>
            <CardDescription>{t('settings.serverDescription')}</CardDescription>
          </div>
          <Badge variant='outline'>{t('settings.desktopOnly')}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='grid gap-3'
            noValidate
          >
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
                      spellCheck={false}
                      placeholder={t('auth.serverUrlPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <Button type='submit' disabled={form.formState.isSubmitting}>
                {t('settings.serverSave')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
