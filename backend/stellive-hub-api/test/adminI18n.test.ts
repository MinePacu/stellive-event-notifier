import { describe, expect, it } from "vitest";
import { renderAdminConsoleHtml } from "../src/admin/adminConsoleHtml.js";
import {
  adminMessages,
  enAdminMessages,
  escapeAdminAttr,
  escapeAdminText,
  koAdminMessages,
  localizeAdminDocument,
  serializeAdminScriptValue,
  t,
  tAttr,
  translateAdmin
} from "../src/admin/adminI18n.js";
import { renderAdminLanguageHtml } from "../src/admin/adminLanguageHtml.js";
import {
  adminLanguageCookieName,
  createAdminLanguageCookie,
  normalizeAdminLocale,
  resolveAdminLocale
} from "../src/admin/adminLocale.js";
import { renderAdminLoginHtml } from "../src/routes/adminRoutes.js";
import { buildApp } from "../src/app.js";

const env = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  ADMIN_CONSOLE_ENABLED: "true",
  ADMIN_CONSOLE_TOKEN: "admin-token"
};

describe("admin i18n", () => {
  it("normalizes supported language tags and rejects unsupported values", () => {
    expect(normalizeAdminLocale("ko-KR")).toBe("ko");
    expect(normalizeAdminLocale("ko_kr")).toBe("ko");
    expect(normalizeAdminLocale("en-US")).toBe("en");
    expect(normalizeAdminLocale("ja-JP")).toBeUndefined();
  });

  it("resolves query, cookie, Accept-Language, then English fallback", () => {
    expect(resolveAdminLocale({ queryLanguage: "en", cookieHeader: `${adminLanguageCookieName}=ko`, acceptLanguage: "ko-KR" })).toBe("en");
    expect(resolveAdminLocale({ cookieHeader: `${adminLanguageCookieName}=ko`, acceptLanguage: "en-US" })).toBe("ko");
    expect(resolveAdminLocale({ acceptLanguage: "en-US;q=0.4, ko-KR;q=0.9" })).toBe("ko");
    expect(resolveAdminLocale({ queryLanguage: "invalid" })).toBe("en");
  });

  it("keeps English and Korean catalog keys in parity and interpolates parameters", () => {
    expect(Object.keys(koAdminMessages).sort()).toEqual(Object.keys(enAdminMessages).sort());
    expect(adminMessages.en).toBe(enAdminMessages);
    expect(translateAdmin("ko", "common.itemCount", { count: 3 })).toBe("3개 항목");
    expect(translateAdmin("en", "announcement.deleteConfirm", { title: "Notice" })).toContain('"Notice"');
  });

  it("serializes script values without executable closing tags or line separators", () => {
    const serialized = serializeAdminScriptValue({ unsafe: "</script><script>alert(1)</script>\u2028\u2029" });
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain("\u2028");
    expect(serialized).not.toContain("\u2029");
    expect(serialized).toContain("\\u003c/script>");
  });

  it("renders native language links with current-language accessibility state", () => {
    const html = renderAdminLanguageHtml("ko", "/admin");
    expect(html).toContain('href="/admin?lang=ko"');
    expect(html).toContain('href="/admin?lang=en"');
    expect(html).toContain('lang="ko" hreflang="ko" aria-current="page" aria-pressed="true"');
    expect(html).toContain("한국어");
    expect(html).toContain("English");
  });

  it("renders localized login and console output while preserving machine identifiers", () => {
    const english = renderAdminConsoleHtml();
    const korean = renderAdminConsoleHtml("ko");
    const englishLogin = renderAdminLoginHtml();
    const koreanLogin = renderAdminLoginHtml("ko");
    expect(english).toContain('<html lang="en">');
    expect(english).toContain("Announcement management");
    expect(korean).toContain('<html lang="ko">');
    expect(korean).toContain("공지 관리");
    expect(korean).toContain("대시보드");
    expect(englishLogin).toContain("Enter your admin console token to continue.");
    expect(englishLogin).toContain("Authorized administrators only.");
    expect(koreanLogin).toContain("관리자 콘솔 토큰을 입력해 계속하세요.");
    expect(koreanLogin).toContain("승인된 관리자만 사용할 수 있습니다.");
    expect(koreanLogin).toContain("관리자 콘솔 토큰");
    expect(englishLogin).not.toContain("Internal API bearer token");
    expect(koreanLogin).not.toContain("내부 API Bearer 토큰");
    expect(korean).toContain('t("announcement.deleteConfirm"');
    expect(korean).toContain('t("announcement.publishConfirm"');

    const extract = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].map((match) => match[1]).sort();
    expect(extract(korean, /\sid="([^"]+)"/g)).toEqual(extract(english, /\sid="([^"]+)"/g));
    expect(extract(korean, /<option value="([^"]*)"/g)).toEqual(extract(english, /<option value="([^"]*)"/g));
    expect(extract(korean, /^\s+\w+: "(\/v1\/[^"]+)"/gm)).toEqual(extract(english, /^\s+\w+: "(\/v1\/[^"]+)"/gm));
  });

  it("resolves text and attribute slots for both locales, including parameters", () => {
    const document = `<p>${t("common.all")}</p><input aria-label="${tAttr("common.status")}"><span>${t("common.itemCount", { count: 3 })}</span>`;
    expect(localizeAdminDocument(document, "en")).toBe('<p>All</p><input aria-label="Status"><span>3 items</span>');
    expect(localizeAdminDocument(document, "ko")).toBe('<p>\uc804\uccb4</p><input aria-label="\uc0c1\ud0dc"><span>3\uac1c \ud56d\ubaa9</span>');
  });

  it("escapes resolved values per slot context", () => {
    expect(escapeAdminText('<a href="x">&')).toBe("&lt;a href=\"x\"&gt;&amp;");
    expect(escapeAdminAttr('<a href="x">&\'')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });

  it("throws on an unknown slot key", () => {
    const document = `<p>${"\uFFF9"}Tcommon.doesNotExist${"\uFFFB"}</p>`;
    expect(() => localizeAdminDocument(document, "ko")).toThrow(/common\.doesNotExist/);
  });

  it("throws when a malformed slot cannot be resolved", () => {
    expect(() => localizeAdminDocument(`<p>${"\uFFF9"}Tcommon.all</p>`, "ko")).toThrow(/unresolved admin i18n slot/);
    expect(() => localizeAdminDocument(`<p>${"\uFFFB"}</p>`, "en")).toThrow(/unresolved admin i18n slot/);
  });

  it("leaves no sentinel characters in rendered console output", () => {
    for (const html of [renderAdminConsoleHtml("en"), renderAdminConsoleHtml("ko")]) {
      expect(html).not.toContain("\uFFF9");
      expect(html).not.toContain("\uFFFA");
      expect(html).not.toContain("\uFFFB");
    }
  });

  it("never rewrites client-side JavaScript string sentinels (D1 regression)", () => {
    const english = renderAdminConsoleHtml("en");
    const korean = renderAdminConsoleHtml("ko");
    for (const html of [english, korean]) {
      expect(html).toContain('state === "off"');
      expect(html).toContain('setAutoRefreshStatus(t("dashboard.off"), "off")');
      expect(html).toContain('setAutoRefreshStatus(t("dashboard.retrying"), "retrying")');
      expect(html).toContain('<option value="">');
    }
    const optionValues = (html: string) => [...html.matchAll(/<option value="([^"]*)"/g)].map((match) => match[1]);
    expect(optionValues(korean)).toEqual(optionValues(english));
    expect(korean).toContain(`<option value="none">${translateAdmin("ko", "common.none")}</option>`);
    expect(english).toContain('<option value="none">None</option>');
  });

  it("localizes the auto-refresh status pill through a data-state attribute", () => {
    const english = renderAdminConsoleHtml("en");
    const korean = renderAdminConsoleHtml("ko");
    for (const html of [english, korean]) {
      expect(html).toMatch(/id="auto-refresh-status"[^>]*data-state="off"/);
      expect(html).toMatch(/id="auto-refresh-status"[^>]*class="auto-refresh-status pill disabled"/);
    }
    expect(english).toContain(`data-state="off" aria-live="polite">${translateAdmin("en", "dashboard.off")}<`);
    expect(korean).toContain(`data-state="off" aria-live="polite">${translateAdmin("ko", "dashboard.off")}<`);
    expect(korean).not.toContain('aria-live="polite">Off<');
    expect(translateAdmin("ko", "dashboard.autoRefreshEvery", { seconds: 30 })).toBe("30초마다");
    expect(translateAdmin("en", "dashboard.autoRefreshEvery", { seconds: 30 })).toBe("Every 30s");
    expect(translateAdmin("ko", "dashboard.autoRefreshPaused")).toBe("작업 중 일시중지");
  });

  it("localizes schedule kind option labels while keeping option values stable", () => {
    const english = renderAdminConsoleHtml("en");
    const korean = renderAdminConsoleHtml("ko");
    const kinds = [
      ["main_window", "hubEvent.kindMainWindow"],
      ["announcement", "hubEvent.kindAnnouncement"],
      ["sales_open", "hubEvent.kindSalesOpen"],
      ["ticket_open", "hubEvent.kindTicketOpen"],
      ["content_reveal", "hubEvent.kindContentReveal"],
      ["release", "hubEvent.kindRelease"],
      ["deadline", "hubEvent.kindDeadline"],
      ["custom", "hubEvent.kindCustom"]
    ] as const;
    for (const [value, key] of kinds) {
      expect(english).toContain(`<option value="${value}">${translateAdmin("en", key)}</option>`);
      expect(korean).toContain(`<option value="${value}">${translateAdmin("ko", key)}</option>`);
      expect(translateAdmin("ko", key)).not.toBe(translateAdmin("en", key));
    }
  });

  it("localizes internal operation button labels and action names", () => {
    const english = renderAdminConsoleHtml("en");
    const korean = renderAdminConsoleHtml("ko");
    const operations = [
      ["renew-youtube", "operations.renewYoutube"],
      ["poll-chzzk", "operations.pollChzzk"],
      ["drain", "operations.drainJobs"],
      ["recalculate-special-days", "operations.recalculate"]
    ] as const;
    for (const [id, key] of operations) {
      expect(english).toMatch(new RegExp(`id="${id}" type="button">${translateAdmin("en", key)}<`));
      expect(korean).toMatch(new RegExp(`id="${id}" type="button">${translateAdmin("ko", key)}<`));
      expect(korean).toContain(`"${translateAdmin("ko", key)}"`);
    }
    expect(korean).not.toContain("Renew YouTube");
    expect(korean).not.toContain("Poll CHZZK");
    expect(korean).not.toContain("Drain jobs");
  });

  it("localizes accessible labels rendered as HTML attributes", () => {
    const english = renderAdminConsoleHtml("en");
    const korean = renderAdminConsoleHtml("ko");
    expect(english).toContain(`id="refresh" type="button" aria-label="${translateAdmin("en", "common.refresh")}"`);
    expect(korean).toContain(`id="refresh" type="button" aria-label="${translateAdmin("ko", "common.refresh")}"`);
    expect(korean).toContain(`role="list" aria-label="${translateAdmin("ko", "nav.hubEvents")}"`);
  });

  it("sets localized response headers and a persistent language cookie", async () => {
    const app = await buildApp({ env, useProcessEnv: false });
    const response = await app.inject({
      method: "GET",
      url: "/admin?lang=ko",
      headers: { authorization: "Bearer admin-token", "accept-language": "en-US" }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-language"]).toBe("ko");
    expect(response.headers["set-cookie"]).toContain(`${adminLanguageCookieName}=ko`);
    expect(response.body).toContain('<html lang="ko">');
  });

  it("creates a one-year non-HttpOnly language cookie", () => {
    const cookie = createAdminLanguageCookie("en", true);
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("HttpOnly");
  });

  it("preserves the language cookie when the admin session is cleared", async () => {
    const app = await buildApp({ env, useProcessEnv: false });
    const response = await app.inject({
      method: "POST",
      url: "/admin/logout",
      headers: { cookie: `${adminLanguageCookieName}=ko` }
    });
    await app.close();

    const cookies = String(response.headers["set-cookie"]);
    expect(cookies).toContain("stellive_admin_session=");
    expect(cookies).toContain("Max-Age=0");
    expect(cookies).toContain(`${adminLanguageCookieName}=ko`);
    expect(cookies).toContain("Max-Age=31536000");
    expect(response.headers["content-language"]).toBe("ko");
  });
});
