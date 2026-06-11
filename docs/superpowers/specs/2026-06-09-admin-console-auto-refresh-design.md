# Admin Console Auto Refresh Design

## Source Issues

- GitLab issue 7: `어드민 콘솔 Auto Refresh 토글로 overview 주기 갱신 추가`
- GitHub issue 12: same feature request for the admin console overview refresh flow

Both issues describe the current limitation: `Queue` and `Recent delivery` values update only after pressing `Refresh`, so it is hard to observe delivery state changes while operating the server. The requested feature is an `Auto Refresh` toggle that periodically polls `/v1/internal/admin/overview` while enabled. The existing manual `Refresh` button must remain available.

## Goal

Add an `Auto Refresh` control to the embedded admin console overview so maintainers can observe queue and recent delivery changes without repeatedly pressing `Refresh`.

## Constraints

- Keep the admin console dependency-free and Fastify-rendered from `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`.
- Do not add a separate React, Vite, Next.js, or static frontend build.
- Do not change admin authentication, internal API authentication, platform adapters, notification job semantics, preference resolution, push delivery, or event ingestion.
- Continue to call only the existing internal overview API: `GET /v1/internal/admin/overview`.
- Do not expose `ADMIN_CONSOLE_TOKEN`, `INTERNAL_API_TOKEN`, secrets, production device tokens, raw provider payloads, images, logos, or copied media.
- Preserve the manual `Refresh` button.
- Preserve project policy: no Former members, no unauthorized crawling, no bypassing notification preferences or realtime constraints.

## Current State

`/admin` renders a single HTML document through `renderAdminConsoleHtml()`. The browser stores the internal API token locally, then `refreshDashboard()` fetches `/v1/internal/admin/overview` and re-renders:

- `Service`
- `Database`
- `Feature flags`
- `Secrets`
- `Queue`
- `Adapters`
- `WebSub subscriptions`
- `Live status`
- `Recent delivery`

The current button row includes:

- `Refresh`
- `Drain jobs`
- `Renew YouTube`
- `Poll CHZZK`

Manual actions already call `refreshDashboard()` after completion, so auto refresh should coordinate with this existing fetch path rather than adding a second API client.

## UX Design

Add an `Auto Refresh` toggle near the existing `Refresh` button:

```html
<label class="toggle-control">
  <input id="auto-refresh" type="checkbox" />
  <span>Auto Refresh</span>
</label>
```

Display compact status text next to the toggle:

- `Off` when disabled.
- `Every 5s` when enabled.
- `Paused while busy` if a manual action or refresh is already in flight.
- `Retrying` after a failed polling request while the toggle remains enabled.

Keep the manual `Refresh` button visible and usable in all states. Manual refresh should immediately fetch overview even when auto refresh is enabled, using the same concurrency guard.

## Polling Behavior

- Poll interval: 5 seconds.
- Enabled state is browser-local only.
- Do not persist the toggle by default. A fresh admin tab starts with auto refresh off so the console does not begin background polling unexpectedly.
- Use one timer per page.
- Do not overlap overview requests. If a poll fires while `refreshDashboard()` is in progress, skip that tick and show `Paused while busy`.
- When the tab becomes hidden, keep the timer active only if the browser allows it; do not add visibility workarounds, workers, or wake locks.
- When toggled off, clear the timer and do not make another automatic request.
- When the page unloads, clear the timer defensively.

## Error Handling

Reuse the existing message area for fetch errors. If an automatic refresh fails:

- keep the toggle enabled,
- show the error in the existing message area,
- update auto refresh status to `Retrying`,
- try again on the next interval.

Authentication failures should not clear the stored internal token automatically. The maintainer can edit the token and press `Refresh`, matching current behavior.

## Implementation Shape

All implementation should stay in `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`.

Add small client-side state:

```js
const autoRefreshIntervalMs = 5000;
let autoRefreshTimer = null;
let refreshInFlight = false;
```

Split the fetch behavior so both manual and automatic paths share it:

- `refreshDashboard({ source = "manual" } = {})`
- `startAutoRefresh()`
- `stopAutoRefresh()`
- `setAutoRefreshStatus(text)`

`refreshDashboard()` should:

1. Check `refreshInFlight`.
2. If already busy and source is `auto`, skip the tick.
3. If already busy and source is `manual`, return without starting a duplicate request.
4. Set `refreshInFlight = true`.
5. Fetch and render overview.
6. Clear `refreshInFlight` in `finally`.

`runAction()` should keep using the shared busy behavior and call `refreshDashboard()` after the action completes.

## Accessibility

- Use a real checkbox for the toggle.
- Associate visible text with the checkbox through the wrapping label or `for`/`id`.
- Make status text discoverable with `aria-live="polite"`.
- Keep focus styles visible through the existing admin theme variables.
- Ensure the control does not shift layout when status text changes.

## Tests

Add focused coverage around HTML output and client behavior where practical:

- `/admin` HTML contains `Auto Refresh`, `id="auto-refresh"`, and the status element.
- HTML still contains the manual `Refresh` button.
- HTML does not contain `ADMIN_CONSOLE_TOKEN` or `INTERNAL_API_TOKEN`.
- Existing admin route tests still pass.

Because the console JavaScript is embedded in a string and the backend test suite currently uses Fastify injection, avoid heavy browser automation for MVP unless the project already introduces a local browser test harness. If later browser coverage is added, verify:

- enabling auto refresh calls overview repeatedly,
- disabling clears the timer,
- manual refresh still works while enabled,
- failed automatic refresh keeps the toggle enabled and retries.

## Acceptance Criteria

- Maintainer can enable `Auto Refresh` from `/admin`.
- Overview data refreshes approximately every 5 seconds while enabled.
- Queue and recent delivery panels update through the existing overview payload.
- Manual `Refresh` remains available.
- Automatic polling does not create overlapping overview requests.
- No backend API contract changes are required.
- No secrets or policy-prohibited assets are exposed.

