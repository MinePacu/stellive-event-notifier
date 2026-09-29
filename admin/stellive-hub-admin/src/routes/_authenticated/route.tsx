import { createFileRoute, redirect } from '@tanstack/react-router'
import { checkAdminSession } from '@/lib/session'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // Network failure, console disabled (404) or token not configured (503)
    // also lead to sign-in, which reports the exact reason on submit.
    const authenticated = await checkAdminSession().catch(() => false)
    if (!authenticated) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
  },
  component: AuthenticatedLayout,
})
