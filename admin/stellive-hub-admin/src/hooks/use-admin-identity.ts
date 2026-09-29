import { useAuthStore } from '@/stores/auth-store'
import { useT } from '@/lib/i18n'
import { isTauri } from '@/lib/runtime'

/** Secondary identity label: the desktop server host, or "Admin session" on web. */
export function useAdminIdentityLabel(): string {
  const t = useT()
  const serverUrl = useAuthStore((state) => state.serverUrl)
  if (isTauri() && serverUrl) {
    try {
      return new URL(serverUrl).host
    } catch {
      return serverUrl
    }
  }
  return t('nav.adminSession')
}
