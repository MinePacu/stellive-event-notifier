import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'
import { signOut } from '@/lib/session'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut()
      queryClient.clear()
      toast.success(t('auth.signedOut'))
      onOpenChange(false)
      await navigate({
        to: '/sign-in',
        search: { redirect: location.href },
        replace: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('nav.logout')}
      desc={t('nav.logoutConfirm')}
      confirmText={t('nav.logout')}
      destructive
      isLoading={isLoading}
      handleConfirm={() => void handleSignOut()}
      className='sm:max-w-sm'
    />
  )
}
