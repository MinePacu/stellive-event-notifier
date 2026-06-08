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
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
        background: var(--admin-bg);
        color: var(--admin-text);
      }
      main {
        width: min(100% - 32px, 420px);
      }
      form {
        display: grid;
        gap: 16px;
        padding: 24px;
        border: 1px solid var(--admin-border);
        border-radius: 8px;
        background: var(--admin-surface);
      }
      .login-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      h1 {
        margin: 0;
        font-size: 1.5rem;
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
        border-radius: 6px;
        padding: 10px 12px;
        font: inherit;
        background: var(--admin-surface);
        color: var(--admin-text);
      }
      input:focus-visible,
      button:focus-visible {
        outline: 2px solid var(--admin-primary);
        outline-offset: 2px;
      }
      .login-button {
        border: 0;
        border-radius: 6px;
        padding: 10px 12px;
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
      @media (max-width: 460px) {
        .login-header {
          display: grid;
          gap: 12px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <form method="post" action="/admin/login" autocomplete="off">
        <div class="login-header">
          <h1>Stellive Hub Admin</h1>
          ${renderAdminThemeControl()}
        </div>
        ${errorHtml}
        <label>
          Admin token
          <input name="token" type="password" required autofocus autocomplete="current-password">
        </label>
        <button class="login-button" type="submit">Log in</button>
      </form>
    </main>
    ${renderAdminThemeBehaviorScript()}
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
