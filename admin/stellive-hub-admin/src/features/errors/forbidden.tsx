import { useT } from '@/lib/i18n'
import { ErrorPage } from './error-page'

export function ForbiddenError() {
  const t = useT()
  return (
    <ErrorPage
      code='403'
      title={t('errors.forbidden.title')}
      description={t('errors.forbidden.description')}
    />
  )
}
