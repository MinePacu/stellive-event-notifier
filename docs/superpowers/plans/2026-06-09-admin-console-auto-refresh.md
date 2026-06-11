# Admin Console Auto Refresh Implementation Plan

Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Auto Refresh` toggle to the embedded admin console so `/v1/internal/admin/overview` refreshes approximately every 5 seconds while enabled, without removing the manual `Refresh` button.

**Architecture:** Keep the feature entirely in the existing Fastify-rendered admin console HTML. Reuse the current `refreshDashboard()` and overview API contract, adding browser-local timer state, a real checkbox toggle, compact status text, and a no-overlap guard for overview requests. No backend route, auth, adapter, notification, preference, push, or database behavior changes are required.

**Tech Stack:** TypeScript, Fastify, Vitest, embedded HTML/CSS/JavaScript, browser `setInterval`, `clearInterval`, `beforeunload`, same-origin `fetch`.

## Files

Modify:

- `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

Reference:

- `docs/superpowers/specs/2026-06-09-admin-console-auto-refresh-design.md`

## Task 1: Add Failing HTML Coverage

**Files:** Modify `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

Context: the existing test named `serves the admin console with a valid admin token` already verifies `/admin` returns authenticated HTML.

- [ ] Add assertions after the existing HTML/content-security assertions:

```ts
expect(response.body).toContain('id="refresh"');
expect(response.body).toContain(">Refresh<");
expect(response.body).toContain('id="auto-refresh"');
expect(response.body).toContain('type="checkbox"');
expect(response.body).toContain("Auto Refresh");
expect(response.body).toContain('id="auto-refresh-status"');
expect(response.body).toContain('aria-live="polite"');
```

- [ ] Strengthen token redaction in the same test, or in the existing token redaction test if one already exists nearby:

```ts
expect(response.body).not.toContain("admin-token");
expect(response.body).not.toContain("internal-test-token");
```

- [ ] From `backend/stellive-hub-api`, run the targeted test and confirm it fails before implementation:

```bash
rtk npm test -- adminInternalRoutes
```

Expected result: FAIL because the HTML does not yet contain `auto-refresh` or `auto-refresh-status`.

## Task 2: Add Toggle Markup And Stable Styling

**Files:** Modify `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`

Context: the controls row currently contains `Refresh`, `Drain jobs`, `Renew YouTube`, and `Poll CHZZK`.

- [ ] Add CSS for the auto refresh control near the existing button/input styles:

```css
.toggle-control {
  align-items: center;
  display: inline-flex;
  gap: 8px;
  min-height: 32px;
}

.toggle-control input {
  height: 16px;
  margin: 0;
  width: 16px;
}

.auto-refresh-status {
  color: var(--admin-muted);
  min-width: 112px;
}
```

- [ ] Insert the toggle immediately after the manual `Refresh` button:

```html
<label class="toggle-control">
  <input id="auto-refresh" type="checkbox">
  <span>Auto Refresh</span>
</label>
<span id="auto-refresh-status" class="auto-refresh-status" aria-live="polite">Off</span>
```

- [ ] Keep the existing `Refresh` button unchanged:

```html
<button id="refresh" type="button">Refresh</button>
```

## Task 3: Add Auto Refresh State

**Files:** Modify `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`

Context: the script already binds `overviewRoot`, `messageRoot`, `tokenInput`, and `logoutForm`.

- [ ] Add DOM bindings with the other element constants:

```js
const autoRefreshInput = document.getElementById("auto-refresh");
const autoRefreshStatusRoot = document.getElementById("auto-refresh-status");
```

- [ ] Add timer and request state near the storage key:

```js
const autoRefreshIntervalMs = 5000;
let autoRefreshTimer = null;
let refreshInFlight = false;
```

- [ ] Add a status helper near `setMessage()`:

```js
function setAutoRefreshStatus(text) {
  autoRefreshStatusRoot.textContent = text;
}
```

## Task 4: Share Refresh Logic Between Manual And Automatic Paths

**Files:** Modify `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`

Context: `refreshDashboard()` currently sets busy, fetches overview, renders it, catches errors, and clears busy. `runAction()` calls `refreshDashboard()` after a command completes.

- [ ] Change `refreshDashboard()` to accept an optional source:

```js
async function refreshDashboard(options) {
  const source = options && options.source === "auto" ? "auto" : "manual";
```

- [ ] Add a no-overlap guard at the start:

```js
  if (refreshInFlight) {
    if (source === "auto") {
      setAutoRefreshStatus("Paused while busy");
    }
    return;
  }

  refreshInFlight = true;
```

- [ ] Keep `setBusy(true)` and the existing message behavior for manual refreshes only:

```js
  if (source === "manual") {
    setBusy(true);
    setMessage("Loading overview...", false);
  } else {
    setAutoRefreshStatus("Every 5s");
  }
```

- [ ] Fetch and render using the existing path:

```js
const overview = await api(endpoints.overview);
renderOverview(overview);
if (source === "manual") {
  setMessage("Overview refreshed.", false);
}
if (autoRefreshInput.checked) {
  setAutoRefreshStatus("Every 5s");
}
```

- [ ] On failure, reuse the existing message area and distinguish automatic retry status:

```js
catch (error) {
  setMessage(error instanceof Error ? error.message : "unknown_error", true);
  if (source === "auto" && autoRefreshInput.checked) {
    setAutoRefreshStatus("Retrying");
  }
}
```

- [ ] In `finally`, always clear both request state and busy state:

```js
finally {
  refreshInFlight = false;
  setBusy(false);
}
```

- [ ] Update the manual listener to pass the manual source explicitly:

```js
document.getElementById("refresh").addEventListener("click", function () {
  return refreshDashboard({ source: "manual" });
});
```

- [ ] Keep `runAction()` calling `await refreshDashboard({ source: "manual" });` after a command completes.

## Task 5: Add Timer Lifecycle

**Files:** Modify `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`

- [ ] Add `startAutoRefresh()` and `stopAutoRefresh()` below `refreshDashboard()`:

```js
function startAutoRefresh() {
  if (autoRefreshTimer) {
    return;
  }
  setAutoRefreshStatus("Every 5s");
  autoRefreshTimer = window.setInterval(function () {
    refreshDashboard({ source: "auto" });
  }, autoRefreshIntervalMs);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    window.clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
  setAutoRefreshStatus("Off");
}
```

- [ ] Bind the checkbox:

```js
autoRefreshInput.addEventListener("change", function () {
  if (autoRefreshInput.checked) {
    startAutoRefresh();
    refreshDashboard({ source: "auto" });
    return;
  }
  stopAutoRefresh();
});
```

- [ ] Clear the timer when the page is unloading:

```js
window.addEventListener("beforeunload", stopAutoRefresh);
```

- [ ] Do not persist the checkbox state to `localStorage` or `sessionStorage`.

## Task 6: Run Targeted Verification

**Files:** Verify existing behavior only.

- [ ] From `backend/stellive-hub-api`, run admin route tests:

```bash
rtk npm test -- adminInternalRoutes
```

Expected result: PASS.

- [ ] From `backend/stellive-hub-api`, run the backend type check:

```bash
rtk npm run build
```

Expected result: PASS.

- [ ] If tests fail because unrelated dirty worktree changes altered admin routes or backend config, inspect the failure and only edit files required for this auto refresh feature.

## Task 7: Manual Browser Check

**Files:** No code edits unless the check exposes a defect.

- [ ] Start the backend using the project’s existing local command or current Docker/dev workflow.
- [ ] Open `/admin` with `ADMIN_CONSOLE_ENABLED=true` and a valid `ADMIN_CONSOLE_TOKEN`.
- [ ] Confirm the controls row shows `Refresh`, `Auto Refresh`, status text, `Drain jobs`, `Renew YouTube`, and `Poll CHZZK`.
- [ ] Enter a valid internal API token.
- [ ] Press `Refresh`; confirm overview loads.
- [ ] Enable `Auto Refresh`; confirm status changes to `Every 5s`.
- [ ] Watch `Queue` and `Recent delivery` refresh on the interval.
- [ ] Disable `Auto Refresh`; confirm status changes to `Off` and polling stops.

## Task 8: Review And Commit Scope

**Files:** Review modified files only.

- [ ] Inspect the final diff:

```bash
rtk git diff -- backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
```

- [ ] Confirm the diff does not include secrets, tokens, images, logos, catalog changes, adapter changes, notification preference changes, or push delivery changes.
- [ ] Because this repository currently has unrelated dirty files, do not run broad staging commands. If the user explicitly asks for a commit, stage only the two implementation files:

```bash
rtk git add backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
rtk git commit -m "feat: add admin console auto refresh"
```
