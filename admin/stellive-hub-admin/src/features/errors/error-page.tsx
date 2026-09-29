import { useNavigate, useRouter } from '@tanstack/react-router'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type ErrorPageProps = {
  code?: string
  title: string
  description: string
  showActions?: boolean
  className?: string
}

export function ErrorPage({
  code,
  title,
  description,
  showActions = true,
  className,
}: ErrorPageProps) {
  const t = useT()
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <div className={cn('h-svh w-full', className)}>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2 px-4'>
        {code ? (
          <h1 className='text-[7rem] leading-tight font-bold'>{code}</h1>
        ) : null}
        <span className='font-medium'>{title}</span>
        <p className='max-w-md text-center text-muted-foreground'>
          {description}
        </p>
        {showActions ? (
          <div className='mt-6 flex gap-4'>
            <Button variant='outline' onClick={() => history.go(-1)}>
              {t('common.goBack')}
            </Button>
            <Button onClick={() => navigate({ to: '/' })}>
              {t('common.backHome')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
