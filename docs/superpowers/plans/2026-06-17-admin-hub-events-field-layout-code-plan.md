Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the `/admin` Hub Events editor field layout so each section uses readable full-width rows where requested.

**Architecture:** Keep the server-rendered admin console in `adminConsoleHtml.ts`. Change only Hub Events section markup/CSS classes and focused admin HTML tests. Preserve every existing `hub-event-*` ID and JavaScript behavior.

**Tech Stack:** TypeScript, Fastify admin HTML template, Vitest.

**Files:**
- Modify: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- Modify: `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`

**Token Budget Policy:**
- Use `rtk` for shell commands.
- Inspect only `adminConsoleHtml.ts`, `adminHubEventRoutes.test.ts`, and this plan unless a focused failure requires more context.
- Do not touch mobile apps, API routes, Prisma, Docker, CI, CHZZK, push logic, or unrelated admin sections.
- Prefer targeted `rg` and short line reads.
- Run only focused tests plus build/check commands listed below.

## Layout Requirements

- Basic information:
  - Keep title and summary full width.
  - Keep category, participation mode, and status compact on one row.
  - Place `Generation` on its own full-width row.
  - Place `Member` on its own full-width row.
- Source and thumbnail:
  - Place `Source type` and `Image policy state` on the same row.
  - Place `Source URL`, `Source label`, `Image URL`, `Image source label`, and `Image source URL` each on its own full-width row.
- Schedule:
  - Place `Announced at`, `Starts at`, and `Ends at` each on its own full-width row.
- Links and venue:
  - Place `Purchase URL`, `Ticket URL`, `Venue name`, `Venue address`, and `Notification eligible` each on its own full-width row.
- Preserve validation and audit log placement.
- Preserve all existing form field IDs, names, input types, options, helper copy, and `collectHubEventInput()` behavior.

## Step 1: Inspect Current Markup

- [ ] Run:

```bash
rtk rg -n "hub-events-section|hub-events-two|hub-events-three|hub-event-generation|hub-event-source-url|hub-event-announced-at|hub-event-purchase-url" backend/stellive-hub-api/src/admin/adminConsoleHtml.ts
```

- [ ] Confirm the current Hub Events editor uses `hub-events-two` and `hub-events-three` wrappers for the fields that need row changes.

## Step 2: Add Focused Structure Test

- [ ] In `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`, extend the redesigned console test or add one focused test that asserts stable field ordering anchors.
- [ ] Assert that the HTML still contains all key section titles:

```ts
expect(html).toContain("Basic information");
expect(html).toContain("Source and thumbnail");
expect(html).toContain("Schedule");
expect(html).toContain("Links and venue");
```

- [ ] Assert that all preserved IDs still exist:

```ts
for (const id of [
  "hub-event-generation",
  "hub-event-member",
  "hub-event-source-type",
  "hub-event-image-policy-state",
  "hub-event-source-url",
  "hub-event-source-label",
  "hub-event-image-url",
  "hub-event-image-source-label",
  "hub-event-image-source-url",
  "hub-event-announced-at",
  "hub-event-starts-at",
  "hub-event-ends-at",
  "hub-event-purchase-url",
  "hub-event-ticket-url",
  "hub-event-venue-name",
  "hub-event-venue-address",
  "hub-event-notification-eligible"
]) {
  expect(html).toContain(`id="${id}"`);
}
```

## Step 3: Update Basic Information Layout

- [ ] In `adminConsoleHtml.ts`, leave title, summary, and the category row unchanged.
- [ ] Replace the `hub-events-two` wrapper around `Generation` and `Member` with two separate full-width field rows.
- [ ] Keep the existing helper text unchanged.

## Step 4: Update Source and Thumbnail Layout

- [ ] Move `Source type` next to `Image policy state` in one `hub-events-two` row.
- [ ] Render `Source URL`, `Source label`, `Image URL`, `Image source label`, and `Image source URL` as separate full-width `.field` blocks.
- [ ] Keep every existing select option and input attribute unchanged.

## Step 5: Update Schedule Layout

- [ ] Remove the `hub-events-three` wrapper from the schedule body.
- [ ] Render `Announced at`, `Starts at`, and `Ends at` as full-width `.field` blocks.

## Step 6: Update Links and Venue Layout

- [ ] Remove the two `hub-events-two` wrappers in `Links and venue`.
- [ ] Render `Purchase URL`, `Ticket URL`, `Venue name`, and `Venue address` as full-width `.field` blocks.
- [ ] Keep `Notification eligible` as a full-width switch row.

## Step 7: Verify Locally

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/adminHubEventRoutes.test.ts
```

- [ ] Expected: PASS.

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

- [ ] Expected: PASS.

- [ ] Run:

```bash
rtk git diff --check
rtk git status --short
```

- [ ] Expected: no whitespace errors; diff limited to admin console HTML/test files for implementation.

## Acceptance Criteria

- Basic information shows `Generation` and `Member` as separate wide rows.
- Source and thumbnail shows only `Source type` and `Image policy state` on the same row.
- Schedule fields are each wide rows.
- Links and venue fields are each wide rows.
- Existing admin save, validate, publish, cancel, deactivate, delete, audit log, and list behavior remains unchanged.
- Focused Vitest test and TypeScript build pass.
