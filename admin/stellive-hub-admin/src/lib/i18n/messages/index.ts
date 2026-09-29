import { type Locale, type MessageDictionary } from '../define'
import { announcementsMessages } from './announcements'
import { auditMessages } from './audit'
import { authMessages } from './auth'
import { commonMessages } from './common'
import { dashboardMessages } from './dashboard'
import { hubEventsMessages } from './hubEvents'
import { navMessages } from './nav'
import { operationsMessages } from './operations'
import { settingsMessages } from './settings'

// Each feature owns its own catalog file so parallel work does not collide.
const catalogs = [
  commonMessages,
  navMessages,
  authMessages,
  settingsMessages,
  dashboardMessages,
  hubEventsMessages,
  announcementsMessages,
  operationsMessages,
  auditMessages,
] as const

type Catalog = (typeof catalogs)[number]

// Union of every key declared in any feature catalog.
export type MessageKey = Catalog extends infer C
  ? C extends { en: infer E }
    ? keyof E & string
    : never
  : never

function merge(locale: Locale): MessageDictionary {
  return Object.assign(
    {},
    ...catalogs.map((catalog) => catalog[locale] as MessageDictionary)
  )
}

export const messages: Record<Locale, MessageDictionary> = {
  en: merge('en'),
  ko: merge('ko'),
}
