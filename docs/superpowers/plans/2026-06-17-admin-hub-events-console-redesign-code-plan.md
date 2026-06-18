Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Source Mockup:** `mockups/admin-hub-events-console-redesign-mockup.html`

**Goal:** Apply the redesigned Hub Events admin console layout so filters and event selection become compact on the left, while event editing is grouped into clear right-side sections.

**Architecture:** Keep the current server-rendered `adminConsoleHtml.ts` model and existing browser JavaScript behavior. Change only the Hub Events section markup and local CSS classes while preserving existing element IDs used by current JavaScript. Do not introduce a frontend build step, client framework, new API, or backend data contract change.

**Tech Stack:** TypeScript HTML template string, plain CSS, browser DOM APIs, Fastify admin page, Vitest HTML assertions.

**Token Policy:** Use `rtk` for all shell commands. Inspect only `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`, `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`, and the mockup file unless a focused test failure points elsewhere. Prefer targeted `rg`, small line reads, and focused Vitest tests. Avoid full repo searches, unrelated backend changes, mobile app files, Prisma changes, CHZZK, push, Docker, and CI files.

## Files

Modify:

- `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`

Reference only:

- `mockups/admin-hub-events-console-redesign-mockup.html`

Do not modify:

- backend routes, repositories, Prisma schema, Docker, CI, mobile app files, push payload files

## Design Intent

The current Hub Events section makes the left side visually heavy because the filter controls stretch into very tall full-width combo boxes. The redesigned UI should make the page work more like an operations editor:

- Left pane: compact state/status/search filters and event list cards.
- Right pane: event editor grouped by purpose.
- Top action bar: refresh, validate, save draft, publish, destructive actions.
- Bottom area: validation and audit log panels.

The current functionality must remain unchanged.

## DOM Compatibility Rules

Preserve these IDs because existing JavaScript reads them directly:

- `hub-event-refresh`
- `hub-event-validate`
- `hub-event-save-draft`
- `hub-event-publish`
- `hub-event-cancel`
- `hub-event-deactivate`
- `hub-event-delete`
- `hub-event-state-filter`
- `hub-event-status-filter`
- `hub-event-search`
- `hub-event-list`
- `hub-event-form`
- `hub-event-validation`
- `hub-event-audit-log`
- every existing `hub-event-*` field ID used by `hubEventFields`

The markup may move these elements into new wrappers, but their IDs and intended form values must stay stable.

## Target Layout

Add local Hub Events layout classes:

- `hub-events-workspace`
- `hub-events-toolbar`
- `hub-events-sidebar`
- `hub-events-filters`
- `hub-events-list`
- `hub-events-editor`
- `hub-events-editor-grid`
- `hub-events-section`
- `hub-events-section-title`
- `hub-events-section-body`
- `hub-events-two`
- `hub-events-three`
- `hub-events-footer`

Left pane:

- header with item count or short "Events" title
- compact two-column filters for publication state and public status
- compact search input
- scrollable table/list area using existing `hub-event-list`

Right pane:

- `Basic information`
- `Source and thumbnail`
- `Schedule`
- `Links and venue`
- footer panels for `Validation` and `Audit log`

## Step 1: Inspect Current Hub Events Section

- [ ] Run:

```bash
rtk git status --short
rtk rg -n "Hub events|hub-event-form|hub-event-list|hub-event-validation|hub-event-audit-log|hubEventFields|renderHubEvents" backend/stellive-hub-api/src/admin/adminConsoleHtml.ts
rtk rg -n "renders hub event|renderAdminConsoleHtml|hub-event-image|backend-supported" backend/stellive-hub-api/test/adminHubEventRoutes.test.ts
```

Expected:

- Hub Events HTML lives inside `renderAdminConsoleHtml()`.
- JavaScript depends on IDs, not on current layout classes.
- Existing tests already assert some admin form IDs and enum values.

## Step 2: Add Failing HTML Structure Tests

- [ ] In `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`, add tests that assert the new layout wrappers are present.

Required assertions:

```ts
expect(html).toContain('class="hub-events-workspace"');
expect(html).toContain('class="hub-events-sidebar"');
expect(html).toContain('class="hub-events-editor"');
expect(html).toContain("Basic information");
expect(html).toContain("Source and thumbnail");
expect(html).toContain("Schedule");
expect(html).toContain("Links and venue");
```

- [ ] Add a compatibility test that verifies important IDs still exist:

```ts
for (const id of [
  "hub-event-state-filter",
  "hub-event-status-filter",
  "hub-event-search",
  "hub-event-list",
  "hub-event-form",
  "hub-event-validation",
  "hub-event-audit-log"
]) {
  expect(html).toContain(`id="${id}"`);
}
```

Run:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/adminHubEventRoutes.test.ts
```

Expected before implementation:

- New layout wrapper assertions fail.

## Step 3: Add Scoped CSS

- [ ] Add CSS classes to `adminConsoleHtml.ts` near existing admin styles.
- [ ] Scope new rules with `hub-events-` prefixes to avoid changing overview, diagnostics, secrets, and other admin sections.
- [ ] Keep colors consistent with the current dark admin theme variables.
- [ ] Use responsive breakpoints:

```css
@media (max-width: 1040px) { ... }
@media (max-width: 640px) { ... }
```

Required behavior:

- desktop: two-column layout with compact left pane
- tablet/mobile: stacked panes
- event list has bounded height and scrolls
- form sections have stable spacing and no nested card styling beyond section containers

## Step 4: Restructure Hub Events Markup

- [ ] Move existing action buttons into a `hub-events-toolbar`.
- [ ] Move publication state, public status, and search into `hub-events-sidebar`.
- [ ] Keep `hub-event-list` in the sidebar under the filters.
- [ ] Move `hub-event-form` into `hub-events-editor`.
- [ ] Split form fields into the four target sections.
- [ ] Keep existing field IDs and names.
- [ ] Keep `Notification eligible` checkbox behavior unchanged.
- [ ] Move `hub-event-validation` and `hub-event-audit-log` into footer panels.

Do not change:

- `collectHubEventInput()`
- `bindHubEventForm()`
- `renderHubEvents()`
- admin API routes

Only update JavaScript if a wrapper class rename accidentally breaks query selectors.

## Step 5: Improve Event List Rendering Only If Needed

- [ ] Prefer preserving the current table/list rendering if it still works in the left pane.
- [ ] If table width remains awkward, update `renderHubEvents()` to render compact row/card DOM while preserving click behavior:

```ts
row.addEventListener("click", function () {
  bindHubEventForm(event);
  loadHubEventAuditLog(event.id);
});
```

Do not add sorting, pagination, dynamic counters, or new API fields in this scope.

## Step 6: Focused Verification

- [ ] Run admin route tests:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/adminHubEventRoutes.test.ts
```

- [ ] Run backend build:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

- [ ] Run diff checks:

```bash
rtk git diff --check
rtk git status --short
```

Expected:

- Admin HTML tests pass.
- TypeScript build passes.
- Diff is limited to admin HTML/test files and this plan.

## Step 7: Browser Review

- [ ] Rebuild/redeploy to the test server only after local tests pass.
- [ ] Open `http://192.168.50.9:4000/admin`.
- [ ] Verify Hub Events visually:

Checklist:

- left filters are compact and not full-height oversized controls
- event list is usable in the left pane
- editor sections are clear
- image metadata fields are still present
- `Validate`, `Save draft`, `Publish`, and `Delete` buttons remain visible
- validation and audit log panels are still visible
- mobile/narrow width stacks panes cleanly

## Acceptance Criteria

- The Hub Events section visually matches the direction in `mockups/admin-hub-events-console-redesign-mockup.html`.
- Existing admin form field IDs are preserved.
- Existing validation/save/publish JavaScript behavior remains intact.
- No backend data contract changes are introduced.
- Focused tests and backend build pass.

## Commit

Commit only after verification passes:

```bash
rtk git add backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/test/adminHubEventRoutes.test.ts docs/superpowers/plans/2026-06-17-admin-hub-events-console-redesign-code-plan.md
rtk git commit -m "style: redesign admin hub events console" -m "- Compact the Hub Events filters and list into a left editor pane" -m "- Group event editing fields into clearer right-side sections" -m "- Preserve existing admin form IDs and save/validate behavior"
```
