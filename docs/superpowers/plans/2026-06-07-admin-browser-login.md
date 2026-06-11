# Admin Browser Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let maintainers open the embedded admin console from a normal browser by logging in with `ADMIN_CONSOLE_TOKEN`, while keeping `/v1/internal/*` protected by `INTERNAL_API_TOKEN`.

**Architecture:** Add a small stateless, signed, HttpOnly cookie session for `/admin` only. Keep the existing Bearer-token path working for curl/API clients, and keep the internal JSON API separate so the console UI still asks for `INTERNAL_API_TOKEN` before calling `/v1/internal/*`.

**Tech Stack:** TypeScript, Fastify, Node `crypto`, Vitest.

---

## File Structure

- Modify `backend/stellive-hub-api/src/admin/adminAuth.ts`
  - Keep existing Bearer helpers.
  - Add signed admin session cookie helpers.
  - Do not log, echo, or serialize token values.
- Modify `backend/stellive-hub-api/src/routes/adminRoutes.ts`
  - Add `GET /admin/login`.
  - Add `POST /admin/login`.
  - Add `POST /admin/logout`.
  - Let `GET /admin` accept either Bearer auth or a valid admin session cookie.
- Modify `backend/stellive-hub-api/test/adminAuth.test.ts`
  - Cover cookie creation, validation, expiry, malformed cookies, and placeholder-token rejection.
- Modify `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
  - Cover browser login page, failed login, successful login, cookie-authenticated `/admin`, logout, and existing Bearer behavior.
- Modify `docs/API_SETUP.md`
  - Document normal browser flow and the continued split between admin-console login and internal API token.
- Optionally modify `docs/ARCHITECTURE.md`
  - Update auth topology from “auth-header-protected HTML route” to “Bearer or session-cookie protected HTML route.”

## Security Rules

- `ADMIN_CONSOLE_TOKEN` authenticates only the HTML console surface.
- `INTERNAL_API_TOKEN` remains required for `/v1/internal/*`.
- Do not accept `INTERNAL_API_TOKEN` for `/admin` unless it is also exactly the configured `ADMIN_CONSOLE_TOKEN`.
- Do not put tokens in query strings.
- Do not store the admin token in the cookie.
- Cookie must be `HttpOnly`, `SameSite=Strict`, `Path=/admin`, and `Cache-Control: no-store` responses should remain on admin HTML.
- Use a stateless HMAC signature derived from `ADMIN_CONSOLE_TOKEN`, so rotating the token invalidates existing admin sessions.
- Keep local HTTP usable in Docker. Set `Secure` only when the request is HTTPS or `x-forwarded-proto=https`; do not force `Secure` for `http://localhost:4000`.

## Task 1: Admin Session Helper Tests

**Files:**
- Modify: `backend/stellive-hub-api/test/adminAuth.test.ts`
- Modify later: `backend/stellive-hub-api/src/admin/adminAuth.ts`

- [ ] **Step 1: Add failing tests for admin session cookies**

Append these imports and tests to `backend/stellive-hub-api/test/adminAuth.test.ts`.

```ts
import {
  authenticateAdminSessionCookie,
  createAdminSessionCookie,
  clearAdminSessionCookie,
  adminSessionCookieName
} from "../src/admin/adminAuth.js";
```

```ts
describe("admin session cookies", () => {
  const now = new Date("2026-06-07T13:00:00.000Z");
  const later = new Date("2026-06-07T14:00:00.000Z");

  it("creates a signed HttpOnly admin session cookie without exposing the token", () => {
    const cookie = createAdminSessionCookie({
      adminToken: "admin-token",
      now,
      secure: false
    });

    expect(cookie.name).toBe(adminSessionCookieName);
    expect(cookie.value).not.toContain("admin-token");
    expect(cookie.header).toContain(`${adminSessionCookieName}=`);
    expect(cookie.header).toContain("HttpOnly");
    expect(cookie.header).toContain("SameSite=Strict");
    expect(cookie.header).toContain("Path=/admin");
    expect(cookie.header).toContain("Max-Age=28800");
    expect(cookie.header).not.toContain("Secure");
  });

  it("adds Secure when requested", () => {
    const cookie = createAdminSessionCookie({
      adminToken: "admin-token",
      now,
      secure: true
    });

    expect(cookie.header).toContain("Secure");
  });

  it("accepts a fresh signed admin session cookie", () => {
    const cookie = createAdminSessionCookie({
      adminToken: "admin-token",
      now,
      secure: false
    });

    expect(
      authenticateAdminSessionCookie(`${adminSessionCookieName}=${cookie.value}`, "admin-token", later)
    ).toEqual({ ok: true });
  });

  it("rejects missing, malformed, expired, and wrong-token session cookies", () => {
    const cookie = createAdminSessionCookie({
      adminToken: "admin-token",
      now,
      secure: false
    });
    const expiredAt = new Date("2026-06-08T00:00:01.000Z");

    expect(authenticateAdminSessionCookie(undefined, "admin-token", later)).toEqual({
      ok: false,
      reason: "missing_authorization"
    });
    expect(authenticateAdminSessionCookie(`${adminSessionCookieName}=bad`, "admin-token", later)).toEqual({
      ok: false,
      reason: "invalid_token"
    });
    expect(authenticateAdminSessionCookie(`${adminSessionCookieName}=${cookie.value}`, "wrong-token", later)).toEqual({
      ok: false,
      reason: "invalid_token"
    });
    expect(authenticateAdminSessionCookie(`${adminSessionCookieName}=${cookie.value}`, "admin-token", expiredAt)).toEqual({
      ok: false,
      reason: "invalid_token"
    });
  });

  it("does not create or accept cookies when the admin token is not effectively configured", () => {
    expect(createAdminSessionCookie({ adminToken: "replace_with_admin_console_token", now, secure: false })).toBeUndefined();
    expect(authenticateAdminSessionCookie(`${adminSessionCookieName}=anything`, "verify_required", later)).toEqual({
      ok: false,
      reason: "token_not_configured"
    });
  });

  it("creates a clearing Set-Cookie header for logout", () => {
    expect(clearAdminSessionCookie(false)).toContain(`${adminSessionCookieName}=`);
    expect(clearAdminSessionCookie(false)).toContain("Max-Age=0");
    expect(clearAdminSessionCookie(false)).toContain("HttpOnly");
    expect(clearAdminSessionCookie(false)).toContain("SameSite=Strict");
    expect(clearAdminSessionCookie(false)).not.toContain("Secure");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/backend/stellive-hub-api
npm test -- adminAuth
```

Expected: FAIL because the new session exports do not exist.

## Task 2: Admin Session Helpers

**Files:**
- Modify: `backend/stellive-hub-api/src/admin/adminAuth.ts`
- Test: `backend/stellive-hub-api/test/adminAuth.test.ts`

- [ ] **Step 1: Implement stateless signed cookie helpers**

Add these exports and helpers to `backend/stellive-hub-api/src/admin/adminAuth.ts`.

```ts
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
```

Replace the existing import line with the line above, then add:

```ts
export const adminSessionCookieName = "stellive_admin_session";

const adminSessionVersion = "v1";
const adminSessionMaxAgeSeconds = 8 * 60 * 60;

export interface AdminSessionCookieOptions {
  adminToken: string | undefined;
  now?: Date;
  secure: boolean;
}

export interface CreatedAdminSessionCookie {
  name: typeof adminSessionCookieName;
  value: string;
  header: string;
}

export function createAdminSessionCookie(options: AdminSessionCookieOptions): CreatedAdminSessionCookie | undefined {
  const configuredAdminToken = normalizeConfiguredSecret(options.adminToken);
  if (!configuredAdminToken) return undefined;

  const issuedAtMs = (options.now ?? new Date()).getTime();
  const nonce = base64UrlEncode(randomBytes(24));
  const unsignedValue = `${adminSessionVersion}.${issuedAtMs}.${nonce}`;
  const signature = signAdminSessionValue(unsignedValue, configuredAdminToken);
  const value = `${unsignedValue}.${signature}`;

  return {
    name: adminSessionCookieName,
    value,
    header: serializeAdminSessionCookie(value, adminSessionMaxAgeSeconds, options.secure)
  };
}

export function authenticateAdminSessionCookie(
  cookieHeader: string | undefined,
  adminToken: string | undefined,
  now: Date = new Date()
): AuthResult {
  const configuredAdminToken = normalizeConfiguredSecret(adminToken);
  if (!configuredAdminToken) return { ok: false, reason: "token_not_configured" };
  if (!cookieHeader) return { ok: false, reason: "missing_authorization" };

  const sessionValue = readCookieValue(cookieHeader, adminSessionCookieName);
  if (!sessionValue) return { ok: false, reason: "missing_authorization" };

  const parts = sessionValue.split(".");
  if (parts.length !== 4) return { ok: false, reason: "invalid_token" };

  const [version, issuedAtRaw, nonce, suppliedSignature] = parts;
  if (version !== adminSessionVersion || !issuedAtRaw || !nonce || !suppliedSignature) {
    return { ok: false, reason: "invalid_token" };
  }

  const issuedAtMs = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAtMs)) return { ok: false, reason: "invalid_token" };
  if (issuedAtMs > now.getTime()) return { ok: false, reason: "invalid_token" };
  if (now.getTime() - issuedAtMs > adminSessionMaxAgeSeconds * 1000) {
    return { ok: false, reason: "invalid_token" };
  }

  const unsignedValue = `${version}.${issuedAtRaw}.${nonce}`;
  const expectedSignature = signAdminSessionValue(unsignedValue, configuredAdminToken);

  return timingSafeStringEqual(suppliedSignature, expectedSignature) ? { ok: true } : { ok: false, reason: "invalid_token" };
}

export function clearAdminSessionCookie(secure: boolean): string {
  return serializeAdminSessionCookie("", 0, secure);
}

function serializeAdminSessionCookie(value: string, maxAgeSeconds: number, secure: boolean): string {
  const attributes = [
    `${adminSessionCookieName}=${value}`,
    "Path=/admin",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Strict"
  ];

  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function readCookieValue(cookieHeader: string, name: string): string | undefined {
  for (const cookiePart of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split("=");
    if (rawName === name) return rawValueParts.join("=");
  }

  return undefined;
}

function signAdminSessionValue(value: string, adminToken: string): string {
  return createHmac("sha256", adminToken).update(value).digest("base64url");
}

function base64UrlEncode(value: Buffer): string {
  return value.toString("base64url");
}

function timingSafeStringEqual(actual: string, expected: string): boolean {
  const actualDigest = sha256Digest(actual);
  const expectedDigest = sha256Digest(expected);

  return timingSafeEqual(actualDigest, expectedDigest);
}
```

- [ ] **Step 2: Keep existing token comparison behavior**

In `timingSafeTokenEqual`, leave the digest comparison as-is. The new `timingSafeStringEqual` intentionally uses the same digest approach so length differences do not throw.

- [ ] **Step 3: Run the focused auth tests**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/backend/stellive-hub-api
npm test -- adminAuth
```

Expected: PASS.

## Task 3: Browser Login Route Tests

**Files:**
- Modify: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
- Modify later: `backend/stellive-hub-api/src/routes/adminRoutes.ts`

- [ ] **Step 1: Add failing tests for normal browser login**

Append these tests inside `describe("admin console routes", () => { ... })` in `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`.

```ts
  it("serves an admin login form when the console is enabled", async () => {
    const app = await buildTestApp({
      ADMIN_CONSOLE_ENABLED: true,
      ADMIN_CONSOLE_TOKEN: "admin-token"
    });

    const response = await app.inject({ method: "GET", url: "/admin/login" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Stellive Hub Admin Login");
    expect(response.body).not.toContain("admin-token");
  });

  it("rejects a wrong admin login token", async () => {
    const app = await buildTestApp({
      ADMIN_CONSOLE_ENABLED: true,
      ADMIN_CONSOLE_TOKEN: "admin-token"
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/login",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "token=wrong-token"
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toContain("Invalid admin token.");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("sets an HttpOnly session cookie after successful admin login", async () => {
    const app = await buildTestApp({
      ADMIN_CONSOLE_ENABLED: true,
      ADMIN_CONSOLE_TOKEN: "admin-token"
    });

    const response = await app.inject({
      method: "POST",
      url: "/admin/login",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "token=admin-token"
    });

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/admin");
    expect(response.headers["set-cookie"]).toContain("stellive_admin_session=");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Strict");
  });

  it("serves the admin console to a browser with a valid admin session cookie", async () => {
    const app = await buildTestApp({
      ADMIN_CONSOLE_ENABLED: true,
      ADMIN_CONSOLE_TOKEN: "admin-token"
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/admin/login",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "token=admin-token"
    });
    const cookieHeader = String(loginResponse.headers["set-cookie"]).split(";")[0];

    const response = await app.inject({
      method: "GET",
      url: "/admin",
      headers: { cookie: cookieHeader }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Stellive Hub Admin");
    expect(response.body).toContain("Internal API bearer token");
  });

  it("clears the admin session cookie on logout", async () => {
    const app = await buildTestApp({
      ADMIN_CONSOLE_ENABLED: true,
      ADMIN_CONSOLE_TOKEN: "admin-token"
    });

    const response = await app.inject({ method: "POST", url: "/admin/logout" });

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/admin/login");
    expect(response.headers["set-cookie"]).toContain("stellive_admin_session=");
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");
  });
```

- [ ] **Step 2: Run the focused route tests and verify they fail**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: FAIL because `/admin/login` and `/admin/logout` do not exist, and `/admin` does not accept cookie sessions yet.

## Task 4: Admin Browser Routes

**Files:**
- Modify: `backend/stellive-hub-api/src/routes/adminRoutes.ts`
- Test: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- [ ] **Step 1: Add imports for session helpers**

Update the import from `../admin/adminAuth.js` in `backend/stellive-hub-api/src/routes/adminRoutes.ts`.

```ts
import {
  authenticateAdminSessionCookie,
  authenticateBearerToken,
  clearAdminSessionCookie,
  createAdminSessionCookie,
  shouldEnableAdminConsole
} from "../admin/adminAuth.js";
```

- [ ] **Step 2: Add login, logout, and cookie auth routes**

Replace `registerAdminRoutes` in `backend/stellive-hub-api/src/routes/adminRoutes.ts` with:

```ts
export async function registerAdminRoutes(app: FastifyInstance, options: AdminRoutesOptions) {
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

    const submittedToken = readFormToken(request.body);
    const auth = authenticateBearerToken(submittedToken ? `Bearer ${submittedToken}` : undefined, options.env.ADMIN_CONSOLE_TOKEN);
    if (!auth.ok) {
      applyAdminConsoleHeaders(reply);
      return reply.code(401).type("text/html; charset=utf-8").send(renderAdminLoginHtml("Invalid admin token."));
    }

    const sessionCookie = createAdminSessionCookie({
      adminToken: options.env.ADMIN_CONSOLE_TOKEN,
      secure: shouldUseSecureCookie(request)
    });
    if (!sessionCookie) {
      return reply.code(503).send({ error: "admin_console_token_missing" });
    }

    return reply.header("Set-Cookie", sessionCookie.header).redirect(303, "/admin");
  });

  app.post("/admin/logout", privilegedRouteOptions, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .header("Set-Cookie", clearAdminSessionCookie(shouldUseSecureCookie(request)))
      .redirect(303, "/admin/login");
  });

  app.get("/admin", privilegedRouteOptions, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!options.env.ADMIN_CONSOLE_ENABLED) {
      return reply.callNotFound();
    }

    if (!shouldEnableAdminConsole(options.env)) {
      return reply.code(503).send({ error: "admin_console_token_missing" });
    }

    const auth = authenticateAdminConsoleRequest(request, options.env);
    if (!auth.ok) {
      return reply.redirect(303, "/admin/login");
    }

    applyAdminConsoleHeaders(reply);
    return reply.type("text/html; charset=utf-8").send(renderAdminConsoleHtml());
  });
}
```

- [ ] **Step 3: Add request parsing and HTML helpers**

Add these helpers below `registerAdminRoutes` in `backend/stellive-hub-api/src/routes/adminRoutes.ts`.

```ts
function authenticateAdminConsoleRequest(request: FastifyRequest, env: AppEnv) {
  const bearerAuth = authenticateBearerToken(readAuthorizationHeader(request.headers.authorization), env.ADMIN_CONSOLE_TOKEN);
  if (bearerAuth.ok) return bearerAuth;

  return authenticateAdminSessionCookie(readCookieHeader(request.headers.cookie), env.ADMIN_CONSOLE_TOKEN);
}

function readCookieHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.join("; ");
  return value;
}

function readFormToken(body: unknown): string | undefined {
  if (typeof body === "string") {
    const form = new URLSearchParams(body);
    return form.get("token") ?? undefined;
  }

  if (body && typeof body === "object" && "token" in body) {
    const token = (body as { token?: unknown }).token;
    return typeof token === "string" ? token : undefined;
  }

  return undefined;
}

function shouldUseSecureCookie(request: FastifyRequest): boolean {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const forwardedProtoValue = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return forwardedProtoValue === "https" || request.protocol === "https";
}

function renderAdminLoginHtml(errorMessage?: string): string {
  const escapedError = errorMessage ? escapeHtml(errorMessage) : "";
  const errorBlock = escapedError ? `<p class="error">${escapedError}</p>` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stellive Hub Admin Login</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #20242a; }
    main { width: min(420px, calc(100vw - 32px)); background: #fff; border: 1px solid #d7dce2; border-radius: 8px; padding: 24px; box-shadow: 0 8px 28px rgba(20, 28, 38, 0.08); }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0 0 18px; color: #5c6673; }
    label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 700; }
    input { box-sizing: border-box; width: 100%; min-height: 42px; border: 1px solid #b9c2cc; border-radius: 6px; padding: 8px 10px; font: inherit; }
    button { margin-top: 14px; width: 100%; min-height: 42px; border: 0; border-radius: 6px; background: #1f6feb; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    .error { color: #b42318; }
  </style>
</head>
<body>
  <main>
    <h1>Stellive Hub Admin Login</h1>
    <p>Enter the admin console token to open the internal console.</p>
    ${errorBlock}
    <form method="post" action="/admin/login" autocomplete="off">
      <label for="token">Admin console token</label>
      <input id="token" name="token" type="password" autocomplete="off" spellcheck="false" required autofocus>
      <button type="submit">Open Console</button>
    </form>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

- [ ] **Step 4: Register a form body parser**

Fastify does not parse `application/x-www-form-urlencoded` by default. Add this near the start of `registerAdminRoutes`, before the route declarations:

```ts
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });
```

- [ ] **Step 5: Run route tests**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: PASS.

## Task 5: Console Logout Control

**Files:**
- Modify: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- Test: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- [ ] **Step 1: Add a logout form to the console HTML test**

Add this assertion to the existing `serves the admin console with a valid admin token` test and the new cookie-authenticated test:

```ts
expect(response.body).toContain('action="/admin/logout"');
```

- [ ] **Step 2: Add a logout form to `renderAdminConsoleHtml`**

In `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`, add this form inside the `<header>` after the subtitle paragraph:

```html
    <form method="post" action="/admin/logout">
      <button type="submit">Logout</button>
    </form>
```

If the existing header styling makes this look cramped, add restrained CSS for `header form` and `header button` in the same file. Do not redesign the console.

- [ ] **Step 3: Run route tests**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: PASS.

## Task 6: Documentation

**Files:**
- Modify: `docs/API_SETUP.md`
- Modify: `docs/ARCHITECTURE.md`
- Optional: `backend/stellive-hub-api/.env.example`

- [ ] **Step 1: Update setup documentation**

In `docs/API_SETUP.md`, replace the line:

```md
- `/admin` is an auth-header-protected HTML route. It is not a session login flow.
```

with:

```md
- `/admin` can be opened from a normal browser through `GET /admin/login`. Login validates `ADMIN_CONSOLE_TOKEN` and sets a short-lived HttpOnly, SameSite=Strict cookie scoped to `/admin`.
- Bearer authentication still works for direct clients: `Authorization: Bearer <ADMIN_CONSOLE_TOKEN>`.
```

Then replace:

```md
- The current `/admin` page loads as HTML with `ADMIN_CONSOLE_TOKEN`, then its browser-side UI separately calls `/v1/internal/*` with `INTERNAL_API_TOKEN`.
```

with:

```md
- The `/admin` page loads after either an admin session cookie or `ADMIN_CONSOLE_TOKEN` Bearer authentication. Its browser-side UI separately calls `/v1/internal/*` with `INTERNAL_API_TOKEN`, which the maintainer enters into the page.
```

- [ ] **Step 2: Add browser test instructions**

Add this section under “OCI Admin Console” in `docs/API_SETUP.md`:

```md
### Local Browser Check

After setting real local-only values for `ADMIN_CONSOLE_TOKEN` and `INTERNAL_API_TOKEN`, start the backend and open:

```text
http://localhost:4000/admin/login
```

Enter `ADMIN_CONSOLE_TOKEN` in the login page. After the console opens, enter `INTERNAL_API_TOKEN` in the `Internal API bearer token` field and click Refresh.

Do not pass either token in the URL query string. Query strings can appear in browser history, proxy logs, and server logs.
```

- [ ] **Step 3: Update architecture wording**

In `docs/ARCHITECTURE.md`, update the auth topology sentence so it says:

```md
The auth topology is intentionally split. `ADMIN_CONSOLE_ENABLED` controls only whether `/admin` and `/admin/login` are mounted. `/v1/internal/*` does not depend on that flag and remains independently available whenever `INTERNAL_API_TOKEN` is configured. `/admin` accepts either a valid admin session cookie created by `/admin/login` or a Bearer token matching `ADMIN_CONSOLE_TOKEN`, while the embedded UI separately uses `INTERNAL_API_TOKEN` when it calls `/v1/internal/*`.
```

- [ ] **Step 4: Run documentation search**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti
rg -n "auth-header-protected|not a session login|/admin/login|ADMIN_CONSOLE_TOKEN|INTERNAL_API_TOKEN" docs backend/stellive-hub-api/.env.example
```

Expected: no stale statement claiming `/admin` is not a session login flow.

## Task 7: Full Verification

**Files:**
- All touched files.

- [ ] **Step 1: Run backend tests**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/backend/stellive-hub-api
npm test
```

Expected: PASS.

- [ ] **Step 2: Build the backend**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/backend/stellive-hub-api
npm run build
```

Expected: PASS.

- [ ] **Step 3: Manual local Docker check**

Use a local `.env` or update Compose to read `.env` instead of `.env.example`, then recreate containers:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/backend/stellive-hub-api
docker compose up --build --force-recreate
```

Expected:
- `http://localhost:4000/admin/login` shows a login page in a normal browser.
- Entering `ADMIN_CONSOLE_TOKEN` redirects to `/admin`.
- Entering `INTERNAL_API_TOKEN` in the console and clicking Refresh loads overview data.
- `curl -i -H "Authorization: Bearer <ADMIN_CONSOLE_TOKEN>" http://localhost:4000/admin` still returns HTML.
- `curl -i -H "Authorization: Bearer <INTERNAL_API_TOKEN>" http://localhost:4000/v1/internal/admin/overview` still returns JSON.

## Self-Review

- Spec coverage: The plan covers ordinary browser access, login form, cookie issuance, logout, existing Bearer clients, internal API token separation, local Docker usability, tests, and docs.
- Placeholder scan: No implementation step says TBD/TODO/fill later. Optional doc/env updates are clearly marked as optional and do not block the feature.
- Type consistency: Session helper names are consistent across auth code, route code, and tests: `createAdminSessionCookie`, `authenticateAdminSessionCookie`, `clearAdminSessionCookie`, and `adminSessionCookieName`.
