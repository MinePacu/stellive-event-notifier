import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { safeRedirect } from '@/lib/session'
import { SignIn } from '@/features/auth/sign-in'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    // Skip the form when a recent session check already succeeded.
    if (useAuthStore.getState().status === 'authenticated') {
      throw redirect({ href: safeRedirect(search.redirect), replace: true })
    }
  },
  component: SignIn,
})
