import { useCallback } from 'react'
import { create } from 'zustand'
import { readLocal, writeLocal } from '@/lib/storage'
import { type Locale } from './define'
import { type MessageKey, messages } from './messages'

export { defineMessages, type Locale } from './define'
export { type MessageKey } from './messages'

export const LOCALE_STORAGE_KEY = 'stellive-admin.locale'
export const locales: readonly Locale[] = ['ko', 'en']

export type TranslateParams = Record<string, string | number>
export type TranslateFn = (key: MessageKey, params?: TranslateParams) => string

function isLocale(value: unknown): value is Locale {
  return value === 'ko' || value === 'en'
}

function detectLocale(): Locale {
  const stored = readLocal(LOCALE_STORAGE_KEY)
  if (isLocale(stored)) return stored
  const language =
    typeof navigator === 'undefined' ? '' : (navigator.language ?? '')
  return language.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
}

type LocaleState = {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleState>()((set) => {
  const initial = detectLocale()
  applyDocumentLocale(initial)
  return {
    locale: initial,
    setLocale: (locale) => {
      writeLocal(LOCALE_STORAGE_KEY, locale)
      applyDocumentLocale(locale)
      set({ locale })
    },
  }
})

/** Translate `key` for `locale`, filling `{name}` placeholders from params. */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: TranslateParams
): string {
  const template = messages[locale][key] ?? messages.en[key] ?? key
  if (!params) return template
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match
  )
}

/** Non-reactive translation using the current locale (for non-React code). */
export const t: TranslateFn = (key, params) =>
  translate(useLocaleStore.getState().locale, key, params)

/** Reactive translation hook: re-renders when the locale changes. */
export function useT(): TranslateFn {
  const locale = useLocaleStore((state) => state.locale)
  return useCallback(
    (key: MessageKey, params?: TranslateParams) =>
      translate(locale, key, params),
    [locale]
  )
}

export function useLocale() {
  const locale = useLocaleStore((state) => state.locale)
  const setLocale = useLocaleStore((state) => state.setLocale)
  return { locale, setLocale }
}

/** BCP 47 tag for Intl formatters (dates/numbers). */
export function intlLocale(locale: Locale): string {
  return locale === 'ko' ? 'ko-KR' : 'en-US'
}
