import { create } from 'zustand'
import { readLocal, writeLocal } from '@/lib/storage'

/** Console preferences shared across pages (localStorage). */
export const PREFERENCES_STORAGE_KEY = 'stellive-admin.preferences'

export const HUB_EVENT_PAGE_SIZES = [10, 15, 25] as const
export type HubEventPageSize = (typeof HUB_EVENT_PAGE_SIZES)[number]

/** Dashboard auto-refresh interval (same as the legacy console). */
export const DASHBOARD_AUTO_REFRESH_MS = 30_000

type Preferences = {
  /** Dashboard polls the overview every DASHBOARD_AUTO_REFRESH_MS when on. */
  dashboardAutoRefresh: boolean
  /** Hub events list page size. */
  hubEventPageSize: HubEventPageSize
}

type PreferencesState = Preferences & {
  setDashboardAutoRefresh: (enabled: boolean) => void
  setHubEventPageSize: (size: HubEventPageSize) => void
}

const defaults: Preferences = {
  dashboardAutoRefresh: false,
  hubEventPageSize: 10,
}

function load(): Preferences {
  try {
    const raw = readLocal(PREFERENCES_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Preferences>
    return {
      dashboardAutoRefresh:
        typeof parsed.dashboardAutoRefresh === 'boolean'
          ? parsed.dashboardAutoRefresh
          : defaults.dashboardAutoRefresh,
      hubEventPageSize: HUB_EVENT_PAGE_SIZES.includes(
        parsed.hubEventPageSize as HubEventPageSize
      )
        ? (parsed.hubEventPageSize as HubEventPageSize)
        : defaults.hubEventPageSize,
    }
  } catch {
    return defaults
  }
}

function save(preferences: Preferences) {
  writeLocal(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
}

export const usePreferencesStore = create<PreferencesState>()((set, get) => ({
  ...load(),
  setDashboardAutoRefresh: (dashboardAutoRefresh) => {
    set({ dashboardAutoRefresh })
    save({ dashboardAutoRefresh, hubEventPageSize: get().hubEventPageSize })
  },
  setHubEventPageSize: (hubEventPageSize) => {
    set({ hubEventPageSize })
    save({ dashboardAutoRefresh: get().dashboardAutoRefresh, hubEventPageSize })
  },
}))
