# Admin Console Usability And Responsive Design

## Problem

The server admin console is usable on desktop, but several areas feel cramped or break down on narrow mobile screens.

- The `Events` card header and subtitle sit too close to the card edge.
- Action controls, filters, and operational items do not expose hover/focus hints.
- `Validation` and `Audit log` panels also place their headings too close to the left card edge.
- Mobile browsers show horizontal overflow and clipped controls, especially around the internal token toolbar and Hub events action buttons.

## Goal

Improve admin-console spacing, tooltip affordances, and mobile layout without changing backend behavior, route contracts, authentication, storage, or Hub event data processing.

## Scope

In scope:

- Add consistent inner padding to the Events list card, Hub events workspace card, Validation panel, and Audit log panel.
- Add hover/focus tooltips for operational controls and form/filter fields that are visible on pointer devices and accessible through `aria-label` or `title`.
- Make admin-console controls wrap and fit on mobile widths around 360px to 430px.
- Preserve the existing dark/light/system/black theme variables.
- Add focused tests that validate the static HTML includes the intended tooltip and responsive layout hooks.

Out of scope:

- No change to admin API endpoints.
- No change to HubEvent validation, draft, publish, delete, or audit behavior.
- No mobile app changes.
- No screenshots, logos, profile images, or copied media assets.
- No new frontend framework or browser bundle.

## UX Requirements

### Card Spacing

Events filtering/list card:

- Card content must have enough horizontal and vertical padding so `Events` and `Filter and select existing Hub events.` do not touch the card border.
- Filter controls must remain visually grouped under the header.

Validation and Audit log panels:

- Panel headings must use the same card body padding as peer panels.
- Empty state and generated content must align to the padded heading edge.

### Tooltips

Every interactive admin control in the visible operational console should have a short purpose hint:

- Internal API bearer token input
- Refresh and auto refresh controls
- Drain jobs, Renew YouTube, Poll CHZZK, Recalculate special days
- Hub events actions: Refresh events, Validate, Save draft, Publish, Cancel, Deactivate, Delete
- Event filters: Publication state, Public status, Search
- Main Hub event editor fields and selects

Implementation preference:

- Use a reusable class such as `has-tooltip` and a `data-tooltip` attribute for custom hover/focus display.
- Keep a `title` attribute as a native fallback.
- Tooltips must appear on `:hover` and `:focus-visible`.
- Tooltip text must be concise and operational, not documentation-heavy.
- Tooltips must not include real tokens, secrets, or raw payloads.

### Mobile Layout

The admin console must be usable on narrow browsers:

- The page should not create horizontal document overflow at 360px width.
- Root container width should be `min(100%, <desktop max>)` with mobile-safe padding.
- Toolbars should wrap.
- Buttons should have mobile-friendly hit targets and line wrapping where needed.
- Form grids should collapse to one column.
- Tables should be contained in horizontal scroll regions instead of forcing the whole page wider.
- The internal token input and action rows must fit without clipping.
- The sticky mobile browser bottom toolbar may cover the bottom of the page, so the page should include safe bottom padding.

## Technical Design

`backend/stellive-hub-api/src/admin/adminConsoleHtml.ts` remains the only UI implementation file for this work.

Add CSS utilities:

- `.card-body` or equivalent padded content wrapper for cards that need consistent inner spacing.
- `.has-tooltip` with `position: relative`.
- `.has-tooltip::after` and `.has-tooltip::before` for tooltip bubble and pointer.
- `@media (max-width: 640px)` rules for mobile layout.
- `.table-scroll` or equivalent wrapper around tables that may overflow.

Add markup helpers inside the HTML template or script:

- A helper pattern for buttons and fields to include `class="has-tooltip"`, `data-tooltip`, and `title`.
- Existing IDs must remain unchanged so JavaScript and tests continue to work.

For dynamic table rows, prefer no per-cell custom tooltip unless text truncation is introduced. If truncation is added, use native `title` with the full text.

## Token Cost Minimization

Implementation should keep token usage low by treating this as a narrow static admin-console edit:

- Read only `adminConsoleHtml.ts` and the relevant `/admin` HTML response test section unless a test failure points elsewhere.
- Prefer `rtk rg -n` for locating selectors and IDs instead of reading whole files.
- Prefer `rtk proxy sed -n '<start>,<end>p'` for short source windows after locating line numbers.
- Avoid opening generated files, mobile app files, Prisma files, adapter files, notification code, Docker files, and CI files.
- Use static HTML assertions for tooltip and responsive hooks instead of screenshot-heavy or broad DOM snapshots.
- Run focused tests first: `rtk npm test -- adminInternalRoutes`.
- Run full backend tests only after focused tests and build pass.
- Do not deploy to the server or run browser verification unless explicitly requested after code implementation.

## Accessibility

- Tooltips must be reachable by keyboard focus for controls.
- Native `title` provides fallback, but visible custom tooltip should be triggered by `:focus-visible`.
- Do not rely only on color to identify state.
- Keep existing labels associated with form controls.
- Avoid putting long explanatory text only in tooltips.

## Verification

Automated checks:

- `rtk npm test -- adminInternalRoutes`
- `rtk npm run build`

Manual checks:

- Desktop: open `http://192.168.50.9:4000/admin`, confirm Events, Validation, and Audit log spacing.
- Desktop: hover and keyboard-focus controls, confirm tooltips appear and do not cover adjacent controls incoherently.
- Mobile width around 390px: confirm no page-wide horizontal overflow, action buttons wrap, token input fits, and Hub events controls remain usable.

## Risks

- Pure CSS tooltips can overflow narrow screens if not constrained. Mobile media rules should disable or reposition tooltip bubbles on narrow screens.
- Adding wrappers around tables may affect visual alignment. Keep wrappers local and avoid changing data rendering logic.
- Tests can validate HTML hooks, but final mobile quality needs manual browser verification.
