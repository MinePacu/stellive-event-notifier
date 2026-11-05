/**
 * Normalizes an operator-entered server URL: trims whitespace, requires
 * http(s), drops query/hash and trailing slashes. Returns null when invalid.
 */
export function normalizeServerUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  const pathname = url.pathname.replace(/\/+$/, '')
  return `${url.origin}${pathname}`
}
