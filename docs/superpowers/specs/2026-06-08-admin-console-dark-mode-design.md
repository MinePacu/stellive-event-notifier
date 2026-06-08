# Admin Console Dark Mode Design

## Goal

Add dark mode support to the embedded Stellive Hub server admin console, including both `/admin/login` and `/admin`, while preserving the current lightweight Fastify-hosted HTML/CSS/JavaScript architecture.

The feature gives maintainers predictable visual control during operational work without introducing a separate frontend build, external assets, user-account settings, or any change to privileged backend behavior.

## Context

The admin console is served by the existing backend:

- `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts` renders the authenticated `/admin` console.
- `backend/stellive-hub-api/src/routes/adminRoutes.ts` renders `/admin/login` and handles login/logout.
- The console is dependency-free and uses same-origin calls to `/v1/internal/*`.
- The console is disabled by default and protected by `ADMIN_CONSOLE_TOKEN`; internal APIs are separately protected by `INTERNAL_API_TOKEN`.

The login screen already has limited `prefers-color-scheme: dark` styling. The main console is currently locked to a light palette through fixed colors and `color-scheme: light`.

## Non-Goals

- Do not add a separate React, Vite, Next.js, or bundled frontend app.
- Do not add a server-side user profile, database preference, or admin role model for theme.
- Do not expose or store secrets, tokens, production device tokens, raw private provider responses, profile images, logos, fan art, or copied media.
- Do not change admin authentication, internal API authentication, notification jobs, schedulers, adapters, preference resolution, push delivery, or event ingestion.
- Do not add proprietary platform branding or clone Samsung, Apple, CHZZK, YouTube, X, Naver, or Stellive designs.

## Selected Approach

Use a shared three-state browser theme preference:

- `System`: follow `prefers-color-scheme`.
- `Light`: force the light palette.
- `Dark`: force the dark palette.

The theme control appears on both `/admin/login` and `/admin`. The selected value is stored in browser `localStorage` under a non-sensitive key such as `stellive-admin-theme`. If no value exists, the default is `System`. If the stored value is invalid, the client falls back to `System` and replaces the invalid value on the next explicit selection.

This approach is selected because it keeps the console lightweight, works before and after login, avoids any backend persistence for a cosmetic preference, and gives maintainers direct control when the OS preference is not the desired operational view.

## Alternatives Considered

### System Preference Only

The console would use only `@media (prefers-color-scheme: dark)`. This is the smallest implementation, but it does not let maintainers override a browser or OS setting during operational sessions.

### Toggle With Browser Persistence

This is the selected approach. It adds a small inline script and a compact segmented control, but keeps the preference local to the browser and avoids any new backend surface.

### Session-Only Toggle

The console would let the maintainer switch themes for the current tab only. This avoids storage entirely, but it is less useful for repeated operations and creates a mismatch between login and console pages after reloads.

## User Experience

### Login Page

The login page gets a compact theme control near the top of the form or page shell. The control must not distract from the token field and login button.

Expected behavior:

- First visit defaults to `System`.
- Selecting `Dark` immediately applies the dark login palette.
- After successful login, `/admin` opens with the same selected theme.
- Logging out and returning to `/admin/login` preserves the local theme preference.

### Console Page

The main console gets the same `Light / System / Dark` control in the header, near the logout action. The header remains compact and operational rather than marketing-like.

Expected behavior:

- Changing theme updates the page immediately.
- Refreshing the page preserves `Light` or `Dark`.
- Choosing `System` follows live OS/browser scheme changes where the browser supports `matchMedia` change events.
- The internal API bearer token field and operational buttons keep their existing behavior.

## Visual Design

Use CSS custom properties for shared admin colors. The light theme should preserve the current console appearance as closely as practical.

Light token intent:

- Page background: `#f3f5f8`
- Surface: `#ffffff`
- Text: `#1f2733`
- Muted text: `#657286`
- Border: `#d6dde7`
- Input border: `#bcc7d4`
- Hover surface: `#eef3f8`

Dark token intent:

- Page background: `#0f172a`
- Header and panels: `#111827`
- Elevated or hover surface: `#1f2937`
- Text: `#e5edf7`
- Muted text: `#94a3b8`
- Border: `#334155`
- Input border: `#475569`

Status pills keep their semantic meaning but receive dark-safe variants for contrast. For example, enabled/configured remains green, missing/disabled remains neutral, degraded/failed remains red, and verify-required remains amber.

The page must declare `color-scheme: light dark` so native form controls render correctly in both modes.

## Code Design

### Shared Theme Script

Add a small inline script to both HTML documents. It should:

1. Read `localStorage.getItem("stellive-admin-theme")`.
2. Accept only `light`, `system`, or `dark`.
3. Resolve the active theme:
   - `light` -> `light`
   - `dark` -> `dark`
   - `system` -> `dark` only when `window.matchMedia("(prefers-color-scheme: dark)").matches`
4. Set `document.documentElement.dataset.themePreference`.
5. Set `document.documentElement.dataset.theme`.
6. Update the selected state and accessible pressed/current state of the control.
7. Listen for `prefers-color-scheme` changes when the preference is `system`.

The script must not read, write, log, or transmit admin tokens or internal API tokens.

### Shared Theme Markup

Add a segmented control with three buttons:

```html
<div class="theme-control" role="group" aria-label="Theme">
  <button type="button" class="theme-option" data-theme-option="light">Light</button>
  <button type="button" class="theme-option" data-theme-option="system">System</button>
  <button type="button" class="theme-option" data-theme-option="dark">Dark</button>
</div>
```

The console header and login form can place the same markup differently, but the classes and data attributes should be shared.

### CSS Token Structure

Convert fixed admin colors to CSS variables:

```css
:root {
  color-scheme: light dark;
  --admin-bg: #f3f5f8;
  --admin-surface: #ffffff;
  --admin-text: #1f2733;
}

:root[data-theme="dark"] {
  --admin-bg: #0f172a;
  --admin-surface: #111827;
  --admin-text: #e5edf7;
}
```

Existing selectors should then consume variables:

```css
body {
  background: var(--admin-bg);
  color: var(--admin-text);
}
```

### Flash Reduction

Place the minimal theme initialization script in the document head before the main style block or before body rendering where practical. This reduces a light-to-dark flash for maintainers with a stored dark preference.

The script should be defensive. If `localStorage` is unavailable, it should silently use `System`.

## Accessibility

- The theme control uses `role="group"` and a clear `aria-label`.
- Each option is a real `button type="button"`.
- The selected option uses `aria-pressed="true"` or `aria-current="true"` consistently.
- Focus states must remain visible in both light and dark modes.
- Text, borders, inputs, and status pills must maintain readable contrast in both themes.
- The control must not resize or shift the header when selected states change.

## Security And Privacy

The theme preference is a cosmetic browser-local value only. It is not sent to the backend and is not included in internal API requests.

Security-sensitive behavior remains unchanged:

- `/admin/login` still validates only `ADMIN_CONSOLE_TOKEN`.
- `/admin` still requires a valid admin session cookie or Bearer admin token.
- `/v1/internal/*` still requires `INTERNAL_API_TOKEN`.
- Admin and internal API tokens must not be inserted into HTML responses or logs.
- The Content Security Policy can continue allowing existing inline script and style for the embedded console.

## Testing

Add route-level HTML assertions in `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`:

- `/admin/login` contains the theme control and local storage key when enabled.
- `/admin` contains the theme control and local storage key when authenticated.
- The HTML responses do not contain configured `ADMIN_CONSOLE_TOKEN` or `INTERNAL_API_TOKEN` values.
- Existing redirect, cookie, no-store, CSP, no-CORS, and token separation tests continue to pass.

Manual browser verification should cover:

- Login page default `System` behavior.
- Selecting `Dark` on login and confirming `/admin` stays dark after login.
- Selecting `Light`, `System`, and `Dark` on `/admin`.
- Refresh persistence.
- Logout persistence back to `/admin/login`.
- Mobile-width header wrapping without overlap.

## Implementation Notes

Keep the implementation in the existing admin HTML rendering files. If duplication between login and console markup/scripts becomes noisy, introduce small string helper functions in `adminRoutes.ts` or move shared admin theme helpers into a new file such as `backend/stellive-hub-api/src/admin/adminThemeHtml.ts`.

Do not introduce a frontend dependency for this feature. The current admin console is deliberately dependency-free to keep the OCI deployment small and operationally simple.

## Open Decisions

No open product decisions remain. The approved scope is:

- Include both `/admin/login` and `/admin`.
- Use a `Light / System / Dark` control.
- Persist the choice in browser local storage.
- Default to `System`.
