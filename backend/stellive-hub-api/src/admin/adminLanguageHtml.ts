import { translateAdmin, type AdminLocale } from "./adminI18n.js";

export function renderAdminLanguageHtml(locale: AdminLocale, pathname: "/admin" | "/admin/login"): string {
  const link = (target: AdminLocale, label: string) => {
    const current = target === locale;
    return `<a href="${pathname}?lang=${target}" lang="${target}" hreflang="${target}"${current ? ' aria-current="page" aria-pressed="true"' : ' aria-pressed="false"'}>${escapeHtml(label)}</a>`;
  };
  return `<nav class="language-control" aria-label="${escapeHtml(translateAdmin(locale, "language.label"))}">${link("ko", translateAdmin(locale, "language.ko"))}${link("en", translateAdmin(locale, "language.en"))}</nav>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
