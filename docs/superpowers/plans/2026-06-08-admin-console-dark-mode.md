# Admin Console Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persisted `Light / System / Dark / Black` theme support to both `/admin/login` and `/admin`.

**Architecture:** Keep the admin console embedded in the existing Fastify backend with dependency-free HTML, CSS, and JavaScript. Add one shared admin theme HTML helper so the login page and console page use the same theme storage key, control markup, initialization script, and CSS tokens. Theme selection remains browser-local and never affects authentication, internal API calls, notification behavior, or backend persistence.

**Tech Stack:** TypeScript, Fastify, Vitest, plain HTML/CSS/JavaScript, browser `localStorage`, `matchMedia`.

---

## Spec Reference

Design document: `docs/superpowers/specs/2026-06-08-admin-console-dark-mode-design.md`

## File Structure

- Create: `backend/stellive-hub-api/src/admin/adminThemeHtml.ts`  
  Owns the shared theme local storage key, theme control HTML, early initialization script, behavior script, and shared CSS. This keeps login and console pages consistent without adding a frontend dependency.
- Modify: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`  
  Converts the console page from fixed light colors to CSS variables, inserts the shared theme scripts and control, and preserves the existing operational dashboard behavior.
- Modify: `backend/stellive-hub-api/src/routes/adminRoutes.ts`  
  Imports the shared theme helpers and applies them to the login HTML. Authentication, cookies, CSP, and route behavior stay unchanged.
- Modify: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`  
  Adds HTML assertions for the theme control, local storage key, black option, and continued token redaction.

## Task 1: Add Failing Route HTML Tests

**Files:**
- Modify: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- [ ] **Step 1: Add a shared assertion helper near the existing `buildTestApp` helper**

Add this function below `buildTestApp`:

```ts
function expectAdminThemeSupport(html: string) {
  expect(html).toContain("stellive-admin-theme");
  expect(html).toContain('class="theme-control"');
  expect(html).toContain('data-theme-option="light"');
  expect(html).toContain('data-theme-option="system"');
  expect(html).toContain('data-theme-option="dark"');
  expect(html).toContain('data-theme-option="black"');
  expect(html).toContain('data-theme-default="system"');
  expect(html).toContain("dataset.theme");
}
```

- [ ] **Step 2: Assert theme support in the authenticated `/admin` response**

In the existing test named `serves the admin console with a valid admin token`, add this assertion after the existing endpoint URL assertions:

```ts
    expectAdminThemeSupport(response.body);
```

- [ ] **Step 3: Assert theme support in the `/admin/login` response**

In the existing test named `serves a login form when enabled without leaking the admin token`, add this assertion before the token redaction assertion:

```ts
    expectAdminThemeSupport(response.body);
```

- [ ] **Step 4: Strengthen token redaction coverage for both admin HTML pages**

Replace the existing test named `does not leak configured tokens into the admin html response body` with this version:

```ts
  it("does not leak configured tokens into admin html response bodies", async () => {
    const adminToken = "review-admin-token-123";
    const internalToken = "review-internal-token-456";
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        INTERNAL_API_TOKEN: internalToken,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: adminToken
      },
      useProcessEnv: false
    });
    const consoleResponse = await app.inject({
      method: "GET",
      url: "/admin",
      headers: {
        authorization: `Bearer ${adminToken}`,
        origin: "https://example.com"
      }
    });
    const loginResponse = await app.inject({ method: "GET", url: "/admin/login" });
    await app.close();

    expect(consoleResponse.statusCode).toBe(200);
    expect(loginResponse.statusCode).toBe(200);
    expect(consoleResponse.body).not.toContain(adminToken);
    expect(consoleResponse.body).not.toContain(internalToken);
    expect(loginResponse.body).not.toContain(adminToken);
    expect(loginResponse.body).not.toContain(internalToken);
  });
```

- [ ] **Step 5: Run the targeted tests and verify they fail**

Run:

```bash
cd backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: FAIL. The failure should show missing theme strings such as `stellive-admin-theme`, `data-theme-option="black"`, or `data-theme-default="system"`.

- [ ] **Step 6: Commit the failing tests**

```bash
git add backend/stellive-hub-api/test/adminInternalRoutes.test.ts
git commit -m "test: cover admin console theme controls"
```

## Task 2: Add Shared Theme HTML Helpers

**Files:**
- Create: `backend/stellive-hub-api/src/admin/adminThemeHtml.ts`

- [ ] **Step 1: Create `adminThemeHtml.ts`**

Create the file with this full content:

```ts
export const adminThemeStorageKey = "stellive-admin-theme";

export function renderAdminThemeInitScript(): string {
  return `<script>
    (function () {
      var storageKey = "${adminThemeStorageKey}";
      var allowed = { light: true, system: true, dark: true, black: true };

      function readPreference() {
        try {
          var stored = window.localStorage ? window.localStorage.getItem(storageKey) : null;
          return stored && allowed[stored] ? stored : "system";
        } catch (_error) {
          return "system";
        }
      }

      function resolveTheme(preference) {
        if (preference === "light" || preference === "dark" || preference === "black") {
          return preference;
        }

        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
          return "dark";
        }

        return "light";
      }

      var preference = readPreference();
      document.documentElement.dataset.themePreference = preference;
      document.documentElement.dataset.theme = resolveTheme(preference);
    })();
  </script>`;
}

export function renderAdminThemeControl(): string {
  return `<div class="theme-control" role="group" aria-label="Theme" data-theme-default="system">
    <button type="button" class="theme-option" data-theme-option="light" aria-pressed="false">Light</button>
    <button type="button" class="theme-option" data-theme-option="system" aria-pressed="false">System</button>
    <button type="button" class="theme-option" data-theme-option="dark" aria-pressed="false">Dark</button>
    <button type="button" class="theme-option" data-theme-option="black" aria-pressed="false">Black</button>
  </div>`;
}

export function renderAdminThemeStyle(): string {
  return `
    :root {
      color-scheme: light dark;
      --admin-bg: #f3f5f8;
      --admin-surface: #ffffff;
      --admin-surface-hover: #eef3f8;
      --admin-text: #1f2733;
      --admin-muted: #657286;
      --admin-label: #526073;
      --admin-border: #d6dde7;
      --admin-soft-border: #edf1f5;
      --admin-input-border: #bcc7d4;
      --admin-danger: #a13224;
      --admin-primary: #2563eb;
      --admin-primary-text: #ffffff;
      --admin-pill-bg: #e9edf3;
      --admin-pill-text: #344155;
      --admin-pill-ok-bg: #dbeee1;
      --admin-pill-ok-text: #19643a;
      --admin-pill-neutral-bg: #edf0f5;
      --admin-pill-neutral-text: #556274;
      --admin-pill-danger-bg: #fde5df;
      --admin-pill-danger-text: #9a3222;
      --admin-pill-warning-bg: #fff0cd;
      --admin-pill-warning-text: #865d00;
    }

    :root[data-theme="dark"] {
      --admin-bg: #0f172a;
      --admin-surface: #111827;
      --admin-surface-hover: #1f2937;
      --admin-text: #e5edf7;
      --admin-muted: #94a3b8;
      --admin-label: #cbd5e1;
      --admin-border: #334155;
      --admin-soft-border: #243244;
      --admin-input-border: #475569;
      --admin-danger: #fca5a5;
      --admin-primary: #3b82f6;
      --admin-primary-text: #ffffff;
      --admin-pill-bg: #243244;
      --admin-pill-text: #d8e2ee;
      --admin-pill-ok-bg: #123d2a;
      --admin-pill-ok-text: #b7f7cf;
      --admin-pill-neutral-bg: #253044;
      --admin-pill-neutral-text: #cbd5e1;
      --admin-pill-danger-bg: #4c1d1d;
      --admin-pill-danger-text: #fecaca;
      --admin-pill-warning-bg: #4a3411;
      --admin-pill-warning-text: #fde68a;
    }

    :root[data-theme="black"] {
      --admin-bg: #000000;
      --admin-surface: #050505;
      --admin-surface-hover: #111111;
      --admin-text: #f2f5f8;
      --admin-muted: #a3aab5;
      --admin-label: #d1d5db;
      --admin-border: #262626;
      --admin-soft-border: #1f1f1f;
      --admin-input-border: #3a3a3a;
      --admin-danger: #fca5a5;
      --admin-primary: #60a5fa;
      --admin-primary-text: #020617;
      --admin-pill-bg: #171717;
      --admin-pill-text: #e5e7eb;
      --admin-pill-ok-bg: #052e1a;
      --admin-pill-ok-text: #bbf7d0;
      --admin-pill-neutral-bg: #171717;
      --admin-pill-neutral-text: #d4d4d8;
      --admin-pill-danger-bg: #450a0a;
      --admin-pill-danger-text: #fecaca;
      --admin-pill-warning-bg: #422006;
      --admin-pill-warning-text: #fde68a;
    }

    .theme-control {
      display: inline-grid;
      grid-template-columns: repeat(4, minmax(0, auto));
      gap: 2px;
      align-items: center;
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      padding: 2px;
      background: var(--admin-bg);
    }

    .theme-option {
      min-height: 28px;
      border: 0;
      border-radius: 6px;
      padding: 5px 8px;
      background: transparent;
      color: var(--admin-muted);
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }

    .theme-option:hover {
      background: var(--admin-surface-hover);
      color: var(--admin-text);
    }

    .theme-option[aria-pressed="true"] {
      background: var(--admin-surface);
      color: var(--admin-text);
      box-shadow: inset 0 0 0 1px var(--admin-border);
    }

    .theme-option:focus-visible {
      outline: 2px solid var(--admin-primary);
      outline-offset: 2px;
    }
  `;
}

export function renderAdminThemeBehaviorScript(): string {
  return `<script>
    (function () {
      var storageKey = "${adminThemeStorageKey}";
      var allowed = { light: true, system: true, dark: true, black: true };
      var mediaQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

      function readPreference() {
        try {
          var stored = window.localStorage ? window.localStorage.getItem(storageKey) : null;
          return stored && allowed[stored] ? stored : "system";
        } catch (_error) {
          return "system";
        }
      }

      function writePreference(preference) {
        try {
          if (window.localStorage) {
            window.localStorage.setItem(storageKey, preference);
          }
        } catch (_error) {
          // Theme selection is cosmetic; storage failures should not block admin work.
        }
      }

      function resolveTheme(preference) {
        if (preference === "light" || preference === "dark" || preference === "black") {
          return preference;
        }
        return mediaQuery && mediaQuery.matches ? "dark" : "light";
      }

      function applyPreference(preference, shouldStore) {
        var normalized = allowed[preference] ? preference : "system";
        if (shouldStore) {
          writePreference(normalized);
        }

        document.documentElement.dataset.themePreference = normalized;
        document.documentElement.dataset.theme = resolveTheme(normalized);

        var options = document.querySelectorAll("[data-theme-option]");
        for (var index = 0; index < options.length; index += 1) {
          var option = options[index];
          var isSelected = option.getAttribute("data-theme-option") === normalized;
          option.setAttribute("aria-pressed", isSelected ? "true" : "false");
        }
      }

      var controls = document.querySelectorAll("[data-theme-option]");
      for (var index = 0; index < controls.length; index += 1) {
        controls[index].addEventListener("click", function (event) {
          var nextPreference = event.currentTarget.getAttribute("data-theme-option") || "system";
          applyPreference(nextPreference, true);
        });
      }

      if (mediaQuery) {
        var onSystemThemeChange = function () {
          if (document.documentElement.dataset.themePreference === "system") {
            applyPreference("system", false);
          }
        };

        if (typeof mediaQuery.addEventListener === "function") {
          mediaQuery.addEventListener("change", onSystemThemeChange);
        } else if (typeof mediaQuery.addListener === "function") {
          mediaQuery.addListener(onSystemThemeChange);
        }
      }

      applyPreference(readPreference(), false);
    })();
  </script>`;
}
```

- [ ] **Step 2: Run the targeted tests and verify they still fail**

Run:

```bash
cd backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: FAIL. The helper exists, but neither `/admin/login` nor `/admin` imports it yet.

- [ ] **Step 3: Commit the shared helper**

```bash
git add backend/stellive-hub-api/src/admin/adminThemeHtml.ts
git commit -m "feat: add shared admin theme html helpers"
```

## Task 3: Apply Theme Support To `/admin`

**Files:**
- Modify: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`

- [ ] **Step 1: Import the shared helpers**

Add this import at the top of `adminConsoleHtml.ts`:

```ts
import {
  renderAdminThemeBehaviorScript,
  renderAdminThemeControl,
  renderAdminThemeInitScript,
  renderAdminThemeStyle
} from "./adminThemeHtml.js";
```

- [ ] **Step 2: Insert the early theme init script in the `<head>`**

Inside the returned HTML, place this line after the `<title>` element and before `<style>`:

```ts
  ${renderAdminThemeInitScript()}
```

- [ ] **Step 3: Replace fixed root and shared color CSS with theme variables**

Update the beginning of the `<style>` block to this structure:

```css
    ${renderAdminThemeStyle()}
    :root {
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--admin-bg);
      color: var(--admin-text);
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--admin-bg);
      color: var(--admin-text);
    }
    header {
      border-bottom: 1px solid var(--admin-border);
      background: var(--admin-surface);
      padding: 16px 20px;
    }
```

- [ ] **Step 4: Convert the remaining console selectors to variables**

Use these replacements inside the existing style block:

```css
    .header-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex: 0 0 auto;
      flex-wrap: wrap;
    }
    .logout-form {
      margin: 0;
      flex: 0 0 auto;
    }
    .subtle {
      margin-top: 4px;
      color: var(--admin-muted);
      font-size: 13px;
    }
    .panel {
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      background: var(--admin-surface);
      padding: 14px;
      min-width: 0;
    }
    .field label {
      font-size: 12px;
      font-weight: 600;
      color: var(--admin-label);
    }
    input {
      width: 100%;
      min-width: 0;
      border: 1px solid var(--admin-input-border);
      border-radius: 6px;
      padding: 8px 10px;
      font: inherit;
      font-size: 13px;
      background: var(--admin-surface);
      color: var(--admin-text);
    }
    button {
      border: 1px solid var(--admin-input-border);
      border-radius: 6px;
      background: var(--admin-surface);
      color: var(--admin-text);
      padding: 8px 10px;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      min-height: 36px;
      white-space: nowrap;
    }
    button:hover {
      background: var(--admin-surface-hover);
    }
    button:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--admin-primary);
      outline-offset: 2px;
    }
    .logout-button {
      min-height: 32px;
      padding: 6px 10px;
      color: var(--admin-label);
    }
    .message {
      min-height: 18px;
      font-size: 13px;
      color: var(--admin-muted);
    }
    .message.error {
      color: var(--admin-danger);
    }
    .metric {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      border-top: 1px solid var(--admin-soft-border);
      font-size: 13px;
    }
    .metric-key,
    th,
    .empty {
      color: var(--admin-muted);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 0 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      background: var(--admin-pill-bg);
      color: var(--admin-pill-text);
    }
    .pill.ok,
    .pill.enabled,
    .pill.configured {
      background: var(--admin-pill-ok-bg);
      color: var(--admin-pill-ok-text);
    }
    .pill.disabled,
    .pill.missing {
      background: var(--admin-pill-neutral-bg);
      color: var(--admin-pill-neutral-text);
    }
    .pill.degraded,
    .pill.failed,
    .pill.rate-limited {
      background: var(--admin-pill-danger-bg);
      color: var(--admin-pill-danger-text);
    }
    .pill.verify-required {
      background: var(--admin-pill-warning-bg);
      color: var(--admin-pill-warning-text);
    }
    th,
    td {
      border-top: 1px solid var(--admin-soft-border);
      padding: 8px 6px;
      vertical-align: top;
      text-align: left;
      word-break: break-word;
    }
```

Keep existing layout selectors such as `.stack`, `.grid`, `.toolbar`, `.metric:first-of-type`, `.metric:last-of-type`, table padding, and media queries unless the variable conversion touches them.

- [ ] **Step 5: Add the theme control next to logout**

Replace the current logout form block in the header:

```html
      <form class="logout-form" method="post" action="/admin/logout">
        <button class="logout-button" type="submit">Log out</button>
      </form>
```

with:

```ts
      <div class="header-actions">
        ${renderAdminThemeControl()}
        <form class="logout-form" method="post" action="/admin/logout">
          <button class="logout-button" type="submit">Log out</button>
        </form>
      </div>
```

- [ ] **Step 6: Add the behavior script before the existing dashboard script closes the body**

Place this before the existing `<script>` block that defines `const endpoints`:

```ts
  ${renderAdminThemeBehaviorScript()}
```

- [ ] **Step 7: Run the targeted tests and verify `/admin` assertions pass while login assertions still fail**

Run:

```bash
cd backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: FAIL only for `/admin/login` theme support. If `/admin` still fails, fix the missing strings before moving on.

- [ ] **Step 8: Commit the `/admin` page implementation**

```bash
git add backend/stellive-hub-api/src/admin/adminConsoleHtml.ts
git commit -m "feat: add theme control to admin console"
```

## Task 4: Apply Theme Support To `/admin/login`

**Files:**
- Modify: `backend/stellive-hub-api/src/routes/adminRoutes.ts`

- [ ] **Step 1: Import the shared helpers**

Add this import near the existing admin imports:

```ts
import {
  renderAdminThemeBehaviorScript,
  renderAdminThemeControl,
  renderAdminThemeInitScript,
  renderAdminThemeStyle
} from "../admin/adminThemeHtml.js";
```

- [ ] **Step 2: Add early theme initialization to the login page**

In `renderAdminLoginHtml`, insert this after the `<title>` line:

```ts
    ${renderAdminThemeInitScript()}
```

- [ ] **Step 3: Replace the login CSS with token-based styles**

Replace the login page `<style>` body with this content:

```css
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
```

- [ ] **Step 4: Add the theme control to the login form**

Replace:

```html
        <h1>Stellive Hub Admin</h1>
```

with:

```ts
        <div class="login-header">
          <h1>Stellive Hub Admin</h1>
          ${renderAdminThemeControl()}
        </div>
```

- [ ] **Step 5: Keep the submit button visually distinct**

Change the login submit button from:

```html
        <button type="submit">Log in</button>
```

to:

```html
        <button class="login-button" type="submit">Log in</button>
```

- [ ] **Step 6: Add the theme behavior script before `</body>`**

Insert this after the closing `</main>` and before `</body>`:

```ts
    ${renderAdminThemeBehaviorScript()}
```

- [ ] **Step 7: Run the targeted tests and verify they pass**

Run:

```bash
cd backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: PASS.

- [ ] **Step 8: Commit the login page implementation**

```bash
git add backend/stellive-hub-api/src/routes/adminRoutes.ts
git commit -m "feat: add theme control to admin login"
```

## Task 5: Full Verification

**Files:**
- Verify: `backend/stellive-hub-api/src/admin/adminThemeHtml.ts`
- Verify: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- Verify: `backend/stellive-hub-api/src/routes/adminRoutes.ts`
- Verify: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- [ ] **Step 1: Run backend tests**

Run:

```bash
cd backend/stellive-hub-api
npm test
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript build**

Run:

```bash
cd backend/stellive-hub-api
npm run build
```

Expected: PASS.

- [ ] **Step 3: Inspect the final diff for policy-sensitive regressions**

Run:

```bash
git diff -- backend/stellive-hub-api/src/admin/adminThemeHtml.ts backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/src/routes/adminRoutes.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
```

Expected:

- No admin token or internal token values are hardcoded.
- No changes to `authenticateBearerToken`, `authenticateAdminSessionCookie`, cookie creation, route auth checks, internal API URLs, notification jobs, schedulers, adapters, preference resolution, or push delivery.
- No external assets, logos, images, or network calls are introduced.

- [ ] **Step 4: Commit any verification-only fixes**

If Steps 1-3 require a small correction, commit only those changed files:

```bash
git add backend/stellive-hub-api/src/admin/adminThemeHtml.ts backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/src/routes/adminRoutes.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
git commit -m "fix: polish admin theme verification"
```

If no changes are needed, skip this commit.

## Manual Browser Verification

Run the backend locally using the existing project setup:

```bash
cd backend/stellive-hub-api
npm run dev
```

Open `/admin/login` with `ADMIN_CONSOLE_ENABLED=true`, `ADMIN_CONSOLE_TOKEN`, and `INTERNAL_API_TOKEN` configured in the local environment.

Verify:

- `/admin/login` defaults to `System` when no theme is stored.
- Selecting `Dark` immediately changes the login page.
- Selecting `Black` immediately changes the login page to a pure-black page background.
- Logging in preserves the chosen theme on `/admin`.
- `/admin` lets the maintainer switch between `Light`, `System`, `Dark`, and `Black`.
- Refreshing `/admin` preserves `Light`, `Dark`, or `Black`.
- Logging out returns to `/admin/login` with the same local theme preference.
- At mobile width, the theme control and logout button wrap without overlapping.

Do not commit local `.env` files, screenshots, generated assets, or browser storage artifacts.
