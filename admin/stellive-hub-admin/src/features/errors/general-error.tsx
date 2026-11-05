import { useT } from '@/lib/i18n'
import { ErrorPage } from './error-page'

type GeneralErrorProps = React.HTMLAttributes<HTMLDivElement> & {
  minimal?: boolean
}

export function GeneralError({
  className,
  minimal = false,
}: GeneralErrorProps) {
  const t = useT()
  return (
    <ErrorPage
      className={className}
      code={minimal ? undefined : '500'}
      title={t('errors.general.title')}
      description={t('errors.general.description')}
      showActions={!minimal}
    />
  )
}
