export type Locale = 'ko' | 'en'

export type MessageDictionary = Record<string, string>

/**
 * Declares a feature's message catalog. `ko` must provide every key that
 * `en` declares, so a missing translation is a type error.
 */
export function defineMessages<const E extends MessageDictionary>(catalog: {
  en: E
  ko: { [K in keyof E]: string }
}) {
  return catalog
}
