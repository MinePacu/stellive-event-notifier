import { useAuthStore } from '@/stores/auth-store'
import { ApiError, apiFetch, isApiError } from '@/lib/api'
import { isTauri } from '@/lib/runtime'

const SESSION_PATH = '/v1/admin/session'
/** How long a successful session check is trusted before re-checking. */
const SESSION_CACHE_MS = 30_000

let inflight: Promise<boolean> | null = null

/**
 * Returns whether the admin session is valid (`GET /v1/admin/session`).
 * A positive result is cached for 30s. 401 resolves `false`; other failures
 * (network, 404 console disabled, 503 token missing) reject with ApiError.
 */
export async function checkAdminSession(
  options: { force?: boolean } = {}
): Promise<boolean> {
  const state = useAuthStore.getState()
  if (
    !options.force &&
    state.status === 'authenticated' &&
    Date.now() - state.checkedAt < SESSION_CACHE_MS
  ) {
    return true
  }
  if (isTauri() && (!state.serverUrl || !state.adminToken)) {
    state.setStatus('unauthenticated')
    return false
  }
  if (inflight) return inflight

  inflight = (async () => {
    try {
      await apiFetch(SESSION_PATH, { method: 'GET' })
      useAuthStore.getState().setStatus('authenticated')
      return true
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        useAuthStore.getState().setStatus('unauthenticated')
        return false
      }
      throw error
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/**
 * Signs in with the admin console token.
 * - Web: `POST /v1/admin/session` sets the session cookie.
 * - Desktop: stores server URL + token, then verifies with
 *   `GET /v1/admin/session` using the bearer token.
 * Rejects with ApiError (401 invalid token, 404 disabled, 503 not configured,
 * status 0 network).
 */
export async function signIn(input: {
  token: string
  serverUrl?: string
}): Promise<void> {
  const token = input.token.trim()
  const store = useAuthStore.getState()

  if (isTauri()) {
    if (input.serverUrl !== undefined) store.setServerUrl(input.serverUrl)
    store.setAdminToken(token)
    try {
      await apiFetch(SESSION_PATH, { method: 'GET' })
    } catch (error) {
      useAuthStore.getState().setAdminToken(null)
      useAuthStore.getState().setStatus('unauthenticated')
      if (isApiError(error) && error.status === 401) {
        throw new ApiError({
          status: 401,
          path: SESSION_PATH,
          body: error.body,
          code: 'invalid_admin_token',
        })
      }
      throw error
    }
  } else {
    await apiFetch(SESSION_PATH, { method: 'POST', body: { token } })
  }
  useAuthStore.getState().setStatus('authenticated')
}

/**
 * Signs out: web deletes the session cookie (errors ignored); both runtimes
 * forget the admin token and the internal API token.
 */
export async function signOut(): Promise<void> {
  if (!isTauri()) {
    try {
      await apiFetch(SESSION_PATH, { method: 'DELETE' })
    } catch {
      // Clear local state even if the server is unreachable.
    }
  }
  useAuthStore.getState().reset()
}

/**
 * Sanitizes a post-sign-in redirect target: only in-app absolute paths are
 * allowed (no protocol-relative URLs, no bouncing back to /sign-in).
 */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return '/'
  if (value.startsWith('/sign-in')) return '/'
  return value
}
