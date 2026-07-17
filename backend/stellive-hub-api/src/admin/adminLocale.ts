import type { AdminLocale } from "./adminI18n.js";

export const adminLanguageCookieName = "stellive_admin_language";

export function normalizeAdminLocale(value: string | null | undefined): AdminLocale | undefined {
  const normalized = value?.trim().toLowerCase().replaceAll("_", "-");
  if (!normalized) return undefined;
  if (normalized === "ko" || normalized.startsWith("ko-")) return "ko";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return undefined;
}

export function resolveAdminLocale(input: {
  queryLanguage?: string | null;
  cookieHeader?: string;
  acceptLanguage?: string;
}): AdminLocale {
  return normalizeAdminLocale(input.queryLanguage)
    ?? normalizeAdminLocale(readCookie(input.cookieHeader, adminLanguageCookieName))
    ?? resolveAcceptLanguage(input.acceptLanguage)
    ?? "en";
}

export function resolveAcceptLanguage(value: string | undefined): AdminLocale | undefined {
  if (!value) return undefined;
  return value.split(",")
    .map((part, index) => {
      const [language, ...parameters] = part.trim().split(";");
      const quality = Number(parameters.find((item) => item.trim().startsWith("q="))?.trim().slice(2) ?? "1");
      return { locale: normalizeAdminLocale(language), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((item): item is { locale: AdminLocale; quality: number; index: number } => Boolean(item.locale) && item.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)[0]?.locale;
}

export function createAdminLanguageCookie(locale: AdminLocale, secure: boolean): string {
  return `${adminLanguageCookieName}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function adminIntlLocale(locale: AdminLocale): "ko-KR" | "en-US" {
  return locale === "ko" ? "ko-KR" : "en-US";
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    if (segment.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(segment.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
