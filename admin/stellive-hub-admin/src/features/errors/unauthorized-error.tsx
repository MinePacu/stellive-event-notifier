import { useT } from '@/lib/i18n'
import { ErrorPage } from './error-page'

export function UnauthorisedError() {
  const t = useT()
  return (
    <ErrorPage
      code='401'
      title={t('errors.unauthorized.title')}
      description={t('errors.unauthorized.description')}
    />
  )
}
