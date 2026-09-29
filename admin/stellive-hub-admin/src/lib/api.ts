import { useAuthStore } from '@/stores/auth-store'
import { t } from '@/lib/i18n'
import { isTauri } from '@/lib/runtime'

/**
 * Error codes produced on the client (no HTTP response involved). Server
 * error codes come from the JSON body's `error` field, e.g.
 * `invalid_admin_token` or `admin_console_token_missing`.
 */
export type ClientErrorCode =
  | 'network_error'
  | 'server_url_missing'
  | 'internal_token_missing'

/**
 * Any failed API call. `status` is the HTTP status, or 0 when the request
 * never produced a response (network failure, missing configuration).
 */
export class ApiError extends Error {
  readonly status: number
  /** Parsed response body (JSON object, text, or undefined). */
  readonly body: unknown
  /** `body.error` when present, or a {@link ClientErrorCode}. */
  readonly code: string | undefined
  readonly path: string

  constructor(options: {
    status: number
    path: string
    body?: unknown
    code?: string
    message?: string
  }) {
    const code = options.code ?? extractErrorCode(options.body)
    super(
      options.message ??
        `${options.status || 'request'} ${code ?? 'request_failed'} (${options.path})`
    )
    this.name = 'ApiError'
    this.status = options.status
    this.body = options.body
    this.code = code
    this.path = options.path
  }
}

/** Thrown before any request when `/v1/internal/*` is called without a token. */
export class InternalTokenMissingError extends ApiError {
  constructor(path: string) {
    super({ status: 0, path, code: 'internal_token_missing' })
    this.name = 'InternalTokenMissingError'
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

function extractErrorCode(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'error' in body) {
    const value = (body as { error: unknown }).error
    if (typeof value === 'string') return value
  }
  return undefined
}

export type ApiRequestInit = Omit<RequestInit, 'body'> & {
  /**
   * Plain objects/arrays are sent as JSON with `Content-Type:
   * application/json`. Strings, FormData, Blob, URLSearchParams, etc. are
   * passed through unchanged.
   */
  body?: unknown
}

const ADMIN_PREFIX = '/v1/admin/'
const INTERNAL_PREFIX = '/v1/internal/'
const SESSION_PATH = '/v1/admin/session'

let unauthorizedHandler: (() => void) | null = null

/**
 * Registered once by the app shell: called when a `/v1/admin/*` request
 * (other than the session endpoint itself) returns 401.
 */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

function isJsonBody(body: unknown): boolean {
  if (body === null || typeof body !== 'object') return false
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams)
    return false
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return false
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
    return false
  return true
}

function pathOnly(path: string): string {
  return path.split(/[?#]/, 1)[0]
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined
  const text = await response.text()
  if (!text) return undefined
  const contentType = response.headers.get('content-type') ?? ''
  if (
    contentType.includes('application/json') ||
    contentType.includes('+json')
  ) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

type FetchFn = typeof fetch

async function getFetch(): Promise<FetchFn> {
  if (isTauri()) {
    // Loaded lazily so the web bundle never evaluates Tauri-only code.
    const mod = await import('@tauri-apps/plugin-http')
    return mod.fetch as FetchFn
  }
  return window.fetch.bind(window)
}

/**
 * The single HTTP entry point for all features.
 *
 * - `path` is an absolute API path such as `/v1/admin/hub-events`.
 * - Web: same-origin request; `/v1/admin/*` is authorized by the session cookie.
 * - Desktop (Tauri): request goes to the configured server URL and
 *   `/v1/admin/*` carries `Authorization: Bearer <admin token>`.
 * - Both: `/v1/internal/*` carries `Authorization: Bearer <internal token>`
 *   from Settings, or throws {@link InternalTokenMissingError} if unset.
 * - Resolves with the parsed JSON (or text / undefined for empty bodies).
 * - Rejects with {@link ApiError} for non-2xx and network failures.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: ApiRequestInit = {}
): Promise<T> {
  const auth = useAuthStore.getState()
  const bare = pathOnly(path)
  const isAdminPath = bare.startsWith(ADMIN_PREFIX) || bare === SESSION_PATH
  const isInternalPath = bare.startsWith(INTERNAL_PREFIX)
  const tauri = isTauri()

  const headers = new Headers(init.headers)
  if (!headers.has('accept')) headers.set('accept', 'application/json')

  if (isInternalPath && !headers.has('authorization')) {
    if (!auth.internalToken) throw new InternalTokenMissingError(path)
    headers.set('authorization', `Bearer ${auth.internalToken}`)
  } else if (
    isAdminPath &&
    tauri &&
    auth.adminToken &&
    !headers.has('authorization')
  ) {
    headers.set('authorization', `Bearer ${auth.adminToken}`)
  }

  let body: BodyInit | null | undefined
  if (init.body === undefined || init.body === null) {
    body = init.body as null | undefined
  } else if (isJsonBody(init.body)) {
    body = JSON.stringify(init.body)
    if (!headers.has('content-type'))
      headers.set('content-type', 'application/json')
  } else {
    body = init.body as BodyInit
  }

  let url = path
  if (tauri) {
    if (!auth.serverUrl) {
      throw new ApiError({ status: 0, path, code: 'server_url_missing' })
    }
    url = `${auth.serverUrl}${path}`
  }

  const fetchFn = await getFetch()
  let response: Response
  try {
    response = await fetchFn(url, {
      ...init,
      headers,
      body,
      credentials: tauri ? 'omit' : 'same-origin',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error
    throw new ApiError({
      status: 0,
      path,
      code: 'network_error',
      message: error instanceof Error ? error.message : String(error),
    })
  }

  const payload = await parseBody(response)
  if (!response.ok) {
    const error = new ApiError({ status: response.status, path, body: payload })
    if (
      response.status === 401 &&
      bare.startsWith(ADMIN_PREFIX) &&
      bare !== SESSION_PATH
    ) {
      useAuthStore.getState().reset()
      unauthorizedHandler?.()
    }
    throw error
  }
  return payload as T
}

/** Convenience wrappers. */
export const api = {
  get: <T = unknown>(path: string, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: 'PUT', body }),
  patch: <T = unknown>(path: string, body?: unknown, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, init?: ApiRequestInit) =>
    apiFetch<T>(path, { ...init, method: 'DELETE' }),
}

/**
 * Localized, operator-facing message for any error thrown by `apiFetch`
 * (or anything else). Safe to show in toasts and inline status text.
 */
export function describeApiError(error: unknown): string {
  if (!isApiError(error)) {
    return error instanceof Error && error.message
      ? error.message
      : t('error.unknown')
  }
  switch (error.code) {
    case 'internal_token_missing':
      return t('error.internalTokenRequired')
    case 'server_url_missing':
      return t('error.serverUrlMissing')
    case 'network_error':
      return t('error.network')
    case 'invalid_admin_token':
      return t('error.invalidAdminToken')
    case 'admin_console_token_missing':
      return t('error.adminTokenNotConfigured')
  }
  const isInternal = pathOnly(error.path).startsWith(INTERNAL_PREFIX)
  switch (error.status) {
    case 401:
      return isInternal
        ? t('error.internalTokenRejected')
        : t('error.sessionExpired')
    case 403:
      return t('error.forbidden')
    case 404:
      return pathOnly(error.path).startsWith('/v1/admin/session')
        ? t('error.consoleDisabled')
        : t('error.notFound')
  }
  if (error.status >= 500) return t('error.server', { status: error.status })
  return t('error.requestFailedWithStatus', {
    status: error.status,
    code: error.code ?? 'request_failed',
  })
}
