import type { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import {
  authenticateAdminSessionCookie,
  authenticateBearerToken,
  clearAdminSessionCookie,
  createAdminSessionCookie,
  shouldEnableAdminConsole
} from "../admin/adminAuth.js";
import { renderAdminConsoleHtml } from "../admin/adminConsoleHtml.js";
import { translateAdmin, type AdminLocale } from "../admin/adminI18n.js";
import { renderAdminLanguageHtml } from "../admin/adminLanguageHtml.js";
import { createAdminLanguageCookie, resolveAdminLocale } from "../admin/adminLocale.js";
import {
  renderAdminThemeBehaviorScript,
  renderAdminThemeControl,
  renderAdminThemeInitScript,
  renderAdminThemeStyle
} from "../admin/adminThemeHtml.js";
import type { AppEnv } from "../config/env.js";

export interface AdminRoutesOptions {
  env: AppEnv;
}

const privilegedRouteOptions: RouteShorthandOptions = {
  config: {
    cors: false
  } as unknown as RouteShorthandOptions["config"]
};

const adminConsoleContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'"
].join("; ");

export async function registerAdminRoutes(app: FastifyInstance, options: AdminRoutesOptions) {
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (request, body, done) => {
    if (!isAdminLoginRequestPath(request.url)) {
      const error = new Error("Unsupported Media Type") as Error & { statusCode: number };
      error.statusCode = 415;
      done(error);
      return;
    }

    done(null, body);
  });

  app.get("/admin", privilegedRouteOptions, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!options.env.ADMIN_CONSOLE_ENABLED) {
      return reply.callNotFound();
    }

    if (!shouldEnableAdminConsole(options.env)) {
      return reply.code(503).send({ error: "admin_console_token_missing" });
    }

    const locale = resolveAdminRequestLocale(request);
    applyAdminLocaleHeaders(request, reply, options.env, locale);
    const authorizationHeader = readAuthorizationHeader(request.headers.authorization);
    if (authorizationHeader) {
      const auth = authenticateBearerToken(authorizationHeader, options.env.ADMIN_CONSOLE_TOKEN);
      if (!auth.ok) {
        return reply.code(401).send({ error: auth.reason });
      }

      applyAdminConsoleHeaders(reply);
      return reply.type("text/html; charset=utf-8").send(renderAdminConsoleHtml(locale));
    }

    const sessionAuth = authenticateAdminSessionCookie(readHeader(request.headers.cookie), options.env.ADMIN_CONSOLE_TOKEN);
    if (!sessionAuth.ok) {
      return redirectToAdminLogin(reply);
    }

    applyAdminConsoleHeaders(reply);
    return reply.type("text/html; charset=utf-8").send(renderAdminConsoleHtml(locale));
  });

  app.get("/admin/login", privilegedRouteOptions, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!options.env.ADMIN_CONSOLE_ENABLED) {
      return reply.callNotFound();
    }

    if (!shouldEnableAdminConsole(options.env)) {
      return reply.code(503).send({ error: "admin_console_token_missing" });
    }

    const locale = resolveAdminRequestLocale(request);
    applyAdminLocaleHeaders(request, reply, options.env, locale);
    applyAdminConsoleHeaders(reply);
    return reply.type("text/html; charset=utf-8").send(renderAdminLoginHtml(locale));
  });

  app.post("/admin/login", privilegedRouteOptions, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!options.env.ADMIN_CONSOLE_ENABLED) {
      return reply.callNotFound();
    }

    if (!shouldEnableAdminConsole(options.env)) {
      return reply.code(503).send({ error: "admin_console_token_missing" });
    }

    const locale = resolveAdminRequestLocale(request);
    const token = readLoginToken(request.body);
    const auth = authenticateBearerToken(token ? `Bearer ${token}` : undefined, options.env.ADMIN_CONSOLE_TOKEN);
    if (!auth.ok) {
      applyAdminConsoleHeaders(reply);
      applyAdminLocaleHeaders(request, reply, options.env, locale);
      return reply.code(401).type("text/html; charset=utf-8").send(renderAdminLoginHtml(locale, translateAdmin(locale, "error.invalidAdminToken")));
    }

    const cookie = createAdminSessionCookie({
      adminToken: options.env.ADMIN_CONSOLE_TOKEN,
      secure: isSecureRequest(request, options.env.ADMIN_CONSOLE_COOKIE_SECURE)
    });
    if (!cookie) {
      return reply.code(503).send({ error: "admin_console_token_missing" });
    }

    return reply
      .code(303)
      .header("Set-Cookie", [cookie.header, createAdminLanguageCookie(locale, isSecureRequest(request, options.env.ADMIN_CONSOLE_COOKIE_SECURE))])
      .header("Content-Language", locale)
      .header("Location", "/admin")
      .headers(adminConsoleNoStoreHeaders())
      .send();
  });

  app.post("/admin/logout", privilegedRouteOptions, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!options.env.ADMIN_CONSOLE_ENABLED) {
      return reply.callNotFound();
    }

    if (!shouldEnableAdminConsole(options.env)) {
      return reply.code(503).send({ error: "admin_console_token_missing" });
    }

    const locale = resolveAdminRequestLocale(request);
    const secure = isSecureRequest(request, options.env.ADMIN_CONSOLE_COOKIE_SECURE);
    return reply
      .code(303)
      .header("Set-Cookie", [clearAdminSessionCookie(secure), createAdminLanguageCookie(locale, secure)])
      .header("Content-Language", locale)
      .header("Location", "/admin/login")
      .headers(adminConsoleNoStoreHeaders())
      .send();
  });
}

function readAuthorizationHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value.join(",");
  }

  return value;
}

function readHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value.join("; ");
  }

  return value;
}

function applyAdminConsoleHeaders(reply: FastifyReply) {
  reply.headers(adminConsoleNoStoreHeaders());
  reply.header("X-Frame-Options", "DENY");
  reply.header("Content-Security-Policy", adminConsoleContentSecurityPolicy);
}

function resolveAdminRequestLocale(request: FastifyRequest): AdminLocale {
  const queryStart = request.url.indexOf("?");
  const queryLanguage = queryStart >= 0 ? new URLSearchParams(request.url.slice(queryStart + 1)).get("lang") : undefined;
  return resolveAdminLocale({
    queryLanguage,
    cookieHeader: readHeader(request.headers.cookie),
    acceptLanguage: readHeader(request.headers["accept-language"])
  });
}

function applyAdminLocaleHeaders(request: FastifyRequest, reply: FastifyReply, env: AppEnv, locale: AdminLocale) {
  reply.header("Content-Language", locale);
  reply.header("Set-Cookie", createAdminLanguageCookie(locale, isSecureRequest(request, env.ADMIN_CONSOLE_COOKIE_SECURE)));
}

function adminConsoleNoStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    Pragma: "no-cache"
  };
}

function redirectToAdminLogin(reply: FastifyReply) {
  applyAdminConsoleHeaders(reply);
  return reply.code(303).header("Location", "/admin/login").send();
}

function readLoginToken(body: unknown): string | undefined {
  if (typeof body !== "string") return undefined;

  const form = new URLSearchParams(body);
  return form.get("token")?.trim() || undefined;
}

function isAdminLoginRequestPath(url: string): boolean {
  return url === "/admin/login" || url.startsWith("/admin/login?");
}

function isSecureRequest(request: FastifyRequest, forceSecureCookie: boolean): boolean {
  return forceSecureCookie || request.protocol === "https";
}

export function renderAdminLoginHtml(locale: AdminLocale = "en", errorMessage?: string): string {
  const t = (key: Parameters<typeof translateAdmin>[1]) => translateAdmin(locale, key);
  const themeLabels = { label: t("theme.label"), light: t("theme.light"), system: t("theme.system"), dark: t("theme.dark"), black: t("theme.black") };
  const errorHtml = errorMessage ? `<p role="alert" class="error">${escapeHtml(errorMessage)}</p>` : "";

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(t("login.title"))}</title>
    ${renderAdminThemeInitScript()}
    <style>
      ${renderAdminThemeStyle()}
      :root {
        --login-action-bg: #243b73;
        --login-action-text: #ffffff;
        font-family: ui-sans-serif, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
        background: var(--admin-bg);
        color: var(--admin-text);
      }
      :root[data-theme="dark"] {
        --login-action-bg: #c7d2fe;
        --login-action-text: #111827;
      }
      :root[data-theme="black"] {
        --login-action-bg: #86efac;
        --login-action-text: #020617;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: var(--admin-bg);
        color: var(--admin-text);
      }
      .login-shell {
        width: min(100%, 460px);
      }
      .login-brand-title {
        font-size: 0.95rem;
        font-weight: 800;
        color: var(--admin-text);
      }
      .login-card {
        display: grid;
        width: 100%;
        gap: 18px;
        padding: 28px;
        border: 1px solid var(--admin-border);
        border-radius: 12px;
        background: var(--admin-surface);
      }
      h1 {
        margin: 0;
        font-size: 1.55rem;
        letter-spacing: -0.01em;
      }
      .login-card-title {
        display: grid;
        gap: 6px;
      }
      .login-description,
      .login-session-note {
        margin: 0;
        color: var(--admin-muted);
        font-size: 0.9rem;
        line-height: 1.5;
      }
      label {
        display: grid;
        gap: 8px;
        font-weight: 600;
        color: var(--admin-label);
      }
      input {
        width: 100%;
        border: 1px solid var(--admin-input-border);
        border-radius: 10px;
        padding: 12px 13px;
        font: inherit;
        background: var(--admin-surface);
        color: var(--admin-text);
      }
      .password-wrap {
        display: block;
        position: relative;
      }
      .password-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        width: 18px;
        height: 18px;
        transform: translateY(-50%);
        color: var(--admin-muted);
        pointer-events: none;
      }
      .password-wrap input {
        padding-left: 42px;
      }
      input:focus-visible,
      button:focus-visible {
        outline: 2px solid var(--login-action-bg);
        outline-offset: 2px;
      }
      .login-button {
        border: 0;
        border-radius: 10px;
        padding: 12px;
        font: inherit;
        font-weight: 700;
        color: var(--login-action-text);
        background: var(--login-action-bg);
        cursor: pointer;
      }
      .error {
        margin: 0;
        color: var(--admin-danger);
        font-weight: 600;
      }
      .login-session-note {
        text-align: center;
      }
      .login-utility {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding-top: 2px;
      }
      .language-control {
        display: flex;
        gap: 6px;
      }
      .language-control a {
        border-radius: 6px;
        padding: 6px 8px;
        color: var(--admin-muted);
        font-size: 12px;
        font-weight: 700;
        text-decoration: none;
      }
      .language-control a[aria-current="page"] {
        background: var(--admin-surface-hover);
        color: var(--admin-text);
      }
      @media (max-width: 520px) {
        body {
          place-items: start center;
          padding: 16px;
        }
        .login-card {
          gap: 16px;
          padding: 22px;
        }
        .login-utility {
          justify-content: center;
        }
      }
    </style>
  </head>
  <body>
    <main class="login-shell" aria-label="${escapeHtml(t("login.mainAria"))}">
      <form method="post" action="/admin/login" class="login-card" autocomplete="off">
        <div class="login-brand-title">Stellive Hub Admin</div>
        <div class="login-card-title">
          <h1>${escapeHtml(t("login.signIn"))}</h1>
          <p class="login-description">${escapeHtml(t("login.description"))}</p>
        </div>
        ${errorHtml}
        <label>
          <span>${escapeHtml(t("login.token"))}</span>
          <span class="password-wrap">
            <svg class="password-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
              <path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12a1 1 0 0 1 1 1v9H5v-9a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <input name="token" type="password" required autofocus autocomplete="current-password" spellcheck="false" placeholder="${escapeHtml(t("login.tokenPlaceholder"))}">
          </span>
        </label>
        <button class="login-button" type="submit">${escapeHtml(t("login.signIn"))}</button>
        <p class="login-session-note">${escapeHtml(t("login.sessionOnly"))}</p>
        <footer class="login-utility">
          ${renderAdminThemeControl(themeLabels)}
          ${renderAdminLanguageHtml(locale, "/admin/login")}
        </footer>
      </form>
    </main>
    ${renderAdminThemeBehaviorScript()}
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
