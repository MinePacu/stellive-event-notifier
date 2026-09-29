import { create } from 'zustand'
import { normalizeServerUrl } from '@/lib/server-url'
import { readLocal, readSession, writeLocal, writeSession } from '@/lib/storage'

/** Internal API bearer token (sessionStorage only; same key as the legacy console). */
export const INTERNAL_TOKEN_STORAGE_KEY = 'stellive.admin.internalApiToken'
/** Admin console token, used as a bearer token by the desktop app only (sessionStorage). */
export const ADMIN_TOKEN_STORAGE_KEY = 'stellive-admin.admin-token'
/** Desktop app server URL (localStorage). */
export const SERVER_URL_STORAGE_KEY = 'stellive-admin.server-url'

export type SessionStatus = 'unknown' | 'authenticated' | 'unauthenticated'

type AuthState = {
  /** Last known admin session state. */
  status: SessionStatus
  /** Epoch ms of the last successful/failed session check. */
  checkedAt: number
  /** Desktop only: admin console token sent as `Authorization: Bearer`. */
  adminToken: string
  /** Desktop only: normalized API server URL without trailing slash. */
  serverUrl: string
  /** Bearer token for `/v1/internal/*` (session only, never persisted). */
  internalToken: string

  setStatus: (status: SessionStatus) => void
  setAdminToken: (token: string | null) => void
  setServerUrl: (url: string | null) => void
  setInternalToken: (token: string | null) => void
  /** Sign-out: forget session state and all tokens (keeps the server URL). */
  reset: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  checkedAt: 0,
  adminToken: readSession(ADMIN_TOKEN_STORAGE_KEY) ?? '',
  serverUrl: normalizeServerUrl(readLocal(SERVER_URL_STORAGE_KEY) ?? '') ?? '',
  internalToken: readSession(INTERNAL_TOKEN_STORAGE_KEY) ?? '',

  setStatus: (status) => set({ status, checkedAt: Date.now() }),
  setAdminToken: (token) => {
    const value = token?.trim() ?? ''
    writeSession(ADMIN_TOKEN_STORAGE_KEY, value)
    set({ adminToken: value })
  },
  setServerUrl: (url) => {
    const value = normalizeServerUrl(url ?? '') ?? ''
    writeLocal(SERVER_URL_STORAGE_KEY, value)
    set({ serverUrl: value })
  },
  setInternalToken: (token) => {
    const value = token?.trim() ?? ''
    writeSession(INTERNAL_TOKEN_STORAGE_KEY, value)
    set({ internalToken: value })
  },
  reset: () => {
    writeSession(ADMIN_TOKEN_STORAGE_KEY, null)
    writeSession(INTERNAL_TOKEN_STORAGE_KEY, null)
    set({
      status: 'unauthenticated',
      checkedAt: Date.now(),
      adminToken: '',
      internalToken: '',
    })
  },
}))
