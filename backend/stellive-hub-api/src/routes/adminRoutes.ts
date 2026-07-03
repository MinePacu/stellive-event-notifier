import type { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import {
  authenticateAdminSessionCookie,
  authenticateBearerToken,
  clearAdminSessionCookie,
  createAdminSessionCookie,
  shouldEnableAdminConsole
} from "../admin/adminAuth.js";
import { renderAdminConsoleHtml } from "../admin/adminConsoleHtml.js";
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

    const authorizationHeader = readAuthorizationHeader(request.headers.authorization);
    if (authorizationHeader) {
      const auth = authenticateBearerToken(authorizationHeader, options.env.ADMIN_CONSOLE_TOKEN);
      if (!auth.ok) {
        return reply.code(401).send({ error: auth.reason });
      }

      applyAdminConsoleHeaders(reply);
      return reply.type("text/html; charset=utf-8").send(renderAdminConsoleHtml());
    }

    const sessionAuth = authenticateAdminSessionCookie(readHeader(request.headers.cookie), options.env.ADMIN_CONSOLE_TOKEN);
    if (!sessionAuth.ok) {
      return redirectToAdminLogin(reply);
    }

    applyAdminConsoleHeaders(reply);
    return reply.type("text/html; charset=utf-8").send(renderAdminConsoleHtml());
  });

  app.get("/admin/login", privilegedRouteOptions, async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!options.env.ADMIN_CONSOLE_ENABLED) {
      return reply.callNotFound();
    }

    if (!shouldEnableAdminConsole(options.env)) {
      return reply.code(503).send({ error: "admin_console_token_missing" });
    }

    applyAdminConsoleHeaders(reply);
    return reply.type("text/html; charset=utf-8").send(renderAdminLoginHtml());
  });

  app.post("/admin/login", privilegedRouteOptions, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!options.env.ADMIN_CONSOLE_ENABLED) {
      return reply.callNotFound();
    }

    if (!shouldEnableAdminConsole(options.env)) {
      return reply.code(503).send({ error: "admin_console_token_missing" });
    }

    const token = readLoginToken(request.body);
    const auth = authenticateBearerToken(token ? `Bearer ${token}` : undefined, options.env.ADMIN_CONSOLE_TOKEN);
    if (!auth.ok) {
      applyAdminConsoleHeaders(reply);
      return reply.code(401).type("text/html; charset=utf-8").send(renderAdminLoginHtml("Invalid admin token."));
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
      .header("Set-Cookie", cookie.header)
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

    return reply
      .code(303)
      .header("Set-Cookie", clearAdminSessionCookie(isSecureRequest(request, options.env.ADMIN_CONSOLE_COOKIE_SECURE)))
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

function renderAdminLoginHtml(errorMessage?: string): string {
  const errorHtml = errorMessage ? `<p role="alert" class="error">${escapeHtml(errorMessage)}</p>` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Stellive Hub Admin Login</title>
    ${renderAdminThemeInitScript()}
    <style>
      ${renderAdminThemeStyle()}
      :root {
        font-family: ui-sans-serif, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
        background: var(--admin-bg);
        color: var(--admin-text);
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, var(--admin-bg), color-mix(in srgb, var(--admin-bg) 90%, var(--admin-primary) 10%));
        color: var(--admin-text);
      }
      .login-shell {
        width: min(100% - 32px, 1280px);
        min-height: min(720px, calc(100vh - 32px));
        display: grid;
        grid-template-columns: minmax(0, 1.16fr) minmax(400px, 0.84fr);
        border: 1px solid color-mix(in srgb, var(--admin-border) 72%, transparent);
        border-radius: 26px;
        background: color-mix(in srgb, var(--admin-surface) 76%, transparent);
        box-shadow: 0 24px 70px rgba(34, 48, 78, 0.12);
        overflow: hidden;
      }
      .login-copy {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 24px;
        padding: 42px;
        background:
          radial-gradient(circle at 14% 16%, color-mix(in srgb, var(--admin-accent) 28%, transparent), transparent 34%),
          radial-gradient(circle at 84% 80%, color-mix(in srgb, var(--admin-primary) 16%, transparent), transparent 32%),
          linear-gradient(160deg, color-mix(in srgb, var(--admin-surface) 96%, white), color-mix(in srgb, var(--admin-bg) 86%, white));
      }
      :root[data-theme="dark"] .login-shell {
        background: rgba(17, 25, 42, 0.78);
        border-color: rgba(170, 184, 255, 0.10);
        box-shadow: 0 32px 88px rgba(2, 6, 23, 0.48);
      }
      :root[data-theme="dark"] .login-copy {
        background:
          radial-gradient(circle at 14% 16%, rgba(112, 214, 190, 0.18), transparent 34%),
          radial-gradient(circle at 84% 80%, rgba(170, 184, 255, 0.20), transparent 32%),
          linear-gradient(160deg, #17233a, #111a2c);
      }
      .login-panel {
        display: grid;
        align-items: center;
        padding: 34px;
        background: color-mix(in srgb, var(--admin-surface) 86%, transparent);
      }
      .login-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .login-brand-mark {
        width: 36px;
        height: 36px;
        border: 1px solid color-mix(in srgb, var(--admin-primary) 30%, var(--admin-border) 70%);
        border-radius: 12px;
        background: color-mix(in srgb, var(--admin-accent) 18%, var(--admin-surface) 82%);
      }
      .login-brand-title {
        font-size: 1.05rem;
        font-weight: 850;
        color: var(--admin-text);
      }
      .login-hero {
        display: grid;
        align-content: center;
        gap: 18px;
        max-width: 620px;
      }
      .login-badge,
      .private-badge {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        min-height: 24px;
        padding: 0 9px;
        border: 1px solid color-mix(in srgb, var(--admin-primary) 24%, var(--admin-border) 76%);
        border-radius: 999px;
        color: var(--admin-primary);
        background: color-mix(in srgb, var(--admin-primary) 7%, transparent);
        font-size: 12px;
        font-weight: 750;
      }
      .login-card {
        display: grid;
        width: 100%;
        max-width: 420px;
        margin: 0 auto;
        gap: 16px;
        padding: 26px;
        border: 1px solid var(--admin-border);
        border-radius: 26px;
        background: color-mix(in srgb, var(--admin-surface) 92%, transparent);
        box-shadow: 0 12px 28px rgba(34, 48, 78, 0.08);
      }
      .login-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      h1 {
        margin: 0;
        font-size: 1.45rem;
      }
      .login-copy h2 {
        margin: 0;
        max-width: 520px;
        font-size: clamp(2rem, 5vw, 3.6rem);
        line-height: 1;
        letter-spacing: -0.02em;
      }
      .login-copy p,
      .login-flow p,
      .login-note {
        margin: 0;
        color: var(--admin-muted);
        line-height: 1.6;
      }
      .login-flow {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        max-width: 560px;
      }
      .login-flow-item {
        padding: 14px;
        border: 1px solid var(--admin-border);
        border-radius: 16px;
        background: color-mix(in srgb, var(--admin-surface) 72%, transparent);
      }
      .login-flow-item strong {
        display: block;
        margin-bottom: 4px;
        color: var(--admin-text);
      }
      .login-card-title {
        display: grid;
        gap: 4px;
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
        border-radius: 15px;
        padding: 11px 13px;
        font: inherit;
        background: var(--admin-surface);
        color: var(--admin-text);
      }
      .password-wrap {
        position: relative;
      }
      .password-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--admin-muted);
        font-size: 14px;
        pointer-events: none;
      }
      .password-wrap input {
        padding-left: 36px;
      }
      input:focus-visible,
      button:focus-visible {
        outline: 2px solid var(--admin-primary);
        outline-offset: 2px;
      }
      .login-button {
        border: 0;
        border-radius: 15px;
        padding: 11px 12px;
        font: inherit;
        font-weight: 700;
        color: var(--admin-primary-text);
        background: var(--admin-primary);
        cursor: pointer;
      }
      .error {
        margin: 0;
        color: var(--admin-danger);
        font-weight: 600;
      }
      @media (max-width: 920px) {
        .login-shell {
          grid-template-columns: 1fr;
          align-items: stretch;
          min-height: auto;
        }
        .login-copy,
        .login-panel {
          padding: 28px;
        }
        .login-hero {
          align-content: start;
        }
      }
      @media (max-width: 520px) {
        body {
          place-items: stretch;
          padding: 0;
        }
        .login-shell {
          width: 100%;
          min-height: 100vh;
          border-radius: 0;
          border-left: 0;
          border-right: 0;
        }
        .login-copy,
        .login-panel {
          padding: 22px;
        }
        .login-flow {
          grid-template-columns: 1fr;
        }
        .login-header {
          display: grid;
          gap: 12px;
        }
      }
    </style>
  </head>
  <body>
    <main class="login-shell" aria-label="Stellive Hub Admin login">
      <section class="login-copy" aria-label="Admin access overview">
        <div class="login-brand">
          <div class="login-brand-mark" aria-hidden="true"></div>
          <div class="login-brand-title">Stellive Hub Admin</div>
        </div>
        <div class="login-hero">
          <span class="login-badge">Admin console</span>
          <h2>Secure access for hub operations.</h2>
          <p>Dashboard is for status review, Hub events is for publishing work, and Settings keeps tokens and console preferences separated from the login step.</p>
          <div class="login-flow">
            <div class="login-flow-item">
              <strong>Admin session first</strong>
              <p>Sign in with the admin console token to open the server-rendered console.</p>
            </div>
            <div class="login-flow-item">
              <strong>Internal token later</strong>
              <p>Enter the Internal API bearer token after login in Settings when an internal operation needs it.</p>
            </div>
          </div>
        </div>
      </section>
      <section class="login-panel">
      <form method="post" action="/admin/login" class="login-card" autocomplete="off">
        <div class="login-header">
          <div class="login-card-title">
            <h1>Sign in</h1>
            <p class="login-note">Admin session access only.</p>
          </div>
          ${renderAdminThemeControl()}
        </div>
        ${errorHtml}
        <label>
          <span>Admin console token <span class="private-badge">private</span></span>
          <span class="password-wrap">
            <span class="password-icon" aria-hidden="true">lock</span>
            <input name="token" type="password" required autofocus autocomplete="current-password" spellcheck="false" placeholder="Enter admin console token">
          </span>
        </label>
        <button class="login-button" type="submit">Sign in</button>
      </form>
      </section>
    </main>
    ${renderAdminThemeBehaviorScript()}
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
