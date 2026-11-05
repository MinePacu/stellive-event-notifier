import { useSearch } from '@tanstack/react-router'
import { useT } from '@/lib/i18n'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const t = useT()
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className='w-full max-w-sm gap-4' aria-label={t('login.mainAria')}>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {t('login.signIn')}
          </CardTitle>
          <CardDescription>{t('login.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
        <CardFooter>
          <p className='w-full text-center text-sm text-muted-foreground'>
            {t('login.sessionOnly')}
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
