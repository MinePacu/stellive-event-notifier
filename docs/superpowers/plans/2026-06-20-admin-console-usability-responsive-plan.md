# Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서버 어드민 콘솔의 카드 여백, 툴팁, 모바일 레이아웃을 개선한다.

**Architecture:** 기존 정적 admin console HTML/CSS/JS 구조를 유지하고 `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts` 안에서만 레이아웃 클래스, 툴팁 속성, responsive CSS를 추가한다. API route, HubEvent service, storage, notification, mobile app 코드는 변경하지 않는다.

**Tech Stack:** TypeScript, Fastify server-rendered HTML, CSS, Vitest.

**Token Policy:** 모든 shell command는 `rtk` prefix를 사용한다. 탐색은 `CODEMAP.md`, `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`, `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`, 필요 시 `backend/stellive-hub-api/src/admin/adminThemeHtml.ts`로 제한한다. `rg`로 selector/ID line number를 찾은 뒤 `rtk proxy sed -n '<start>,<end>p'`로 80~180줄 단위만 읽는다. generated `dist`, mobile apps, Prisma, notification, adapter, Docker, CI 파일은 실패가 직접 가리키지 않으면 열지 않는다. 검증은 focused test -> build -> full backend test 순서로 진행하고, 서버 배포/브라우저 검증은 사용자가 요청할 때만 수행한다.

## Token Cost Minimization Rules

- [ ] Do not re-read full `adminConsoleHtml.ts`; use `rtk rg -n` and short `sed` windows only.
- [ ] Do not inspect route/service/repository files because this task is static admin HTML/CSS unless TypeScript errors point there.
- [ ] Keep tests as static HTML hook checks, not broad snapshots.
- [ ] Use one focused test file first: `rtk npm test -- adminInternalRoutes`.
- [ ] Use `rtk npm run build` only after focused tests pass.
- [ ] Use `rtk npm test` only once at the end unless a broad regression appears.
- [ ] Do not run remote server sync, Docker rebuild, Playwright, or screenshot tooling unless the user explicitly asks for visual verification.
- [ ] When reporting failures, include only the failing test name, error summary, and changed file reference.

## Files

Modify:

- `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

Do not modify:

- Android or iOS app files
- HubEvent service/repository behavior
- Internal/admin API route contracts
- Prisma schema or migrations
- OpenAPI contracts
- Docker or CI files

## Step 1: Inspect Current Admin Console Markup

- [ ] Run one locator command:

```bash
rtk rg -n "Events|Hub events|Validation|Audit log|internal-token|hub-event-refresh|hub-event-validate|recalculate-special-days|@media|\\.grid|\\.toolbar|button" backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
```

- [ ] Read only short matching sections. Adjust line ranges from the locator output and avoid reading the whole file:

```bash
rtk proxy sed -n '70,220p' backend/stellive-hub-api/src/admin/adminConsoleHtml.ts
rtk proxy sed -n '430,570p' backend/stellive-hub-api/src/admin/adminConsoleHtml.ts
rtk proxy sed -n '620,710p' backend/stellive-hub-api/test/adminInternalRoutes.test.ts
```

Expected: Identify existing CSS selectors for cards, grids, toolbar buttons, and existing `/admin` HTML response tests.

## Step 2: Add Failing HTML Contract Tests

- [ ] Modify `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`.
- [ ] Add a test in the admin console HTML response section that asserts:

```ts
expect(response.body).toContain('class="events-card');
expect(response.body).toContain('class="card-body events-card-body"');
expect(response.body).toContain('class="panel validation-panel"');
expect(response.body).toContain('class="panel audit-log-panel"');
expect(response.body).toContain('data-tooltip="Refresh adapter, secret, feature flag, and job status."');
expect(response.body).toContain('data-tooltip="Validate the current Hub event form without saving."');
expect(response.body).toContain('@media (max-width: 640px)');
expect(response.body).toContain('class="table-scroll"');
```

- [ ] Keep assertions limited to static hooks. Do not assert exact CSS declarations for every property.
- [ ] Do not add full HTML snapshots because they create high-token diffs and brittle failures.

## Step 3: Verify Tests Fail

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- adminInternalRoutes
```

Expected: FAIL because the new classes, tooltip attributes, and mobile CSS hooks do not exist yet.

## Step 4: Add Card Padding Structure

- [ ] Modify `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`.
- [ ] Add reusable card body CSS:

```css
.card-body {
  padding: 20px;
}

.events-card-body,
.validation-panel,
.audit-log-panel {
  padding: 20px;
}
```

- [ ] Apply `events-card` and `card-body events-card-body` to the Events list/filter card that contains the `Events` title and `Filter and select existing Hub events.` subtitle.
- [ ] Apply `validation-panel` and `audit-log-panel` classes to the `Validation` and `Audit log` panels.
- [ ] Preserve existing IDs and JavaScript selectors.

## Step 5: Add Tooltip CSS

- [ ] Add reusable tooltip styles in the existing `<style>` block:

```css
.has-tooltip {
  position: relative;
}

.has-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  z-index: 20;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translateX(-50%);
  max-width: min(280px, calc(100vw - 32px));
  width: max-content;
  padding: 8px 10px;
  border: 1px solid var(--admin-border);
  border-radius: 8px;
  background: var(--admin-surface);
  color: var(--admin-text);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
  font-size: 12px;
  line-height: 1.35;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease, transform 120ms ease;
}

.has-tooltip:hover::after,
.has-tooltip:focus-visible::after,
.has-tooltip:focus-within::after {
  opacity: 1;
  transform: translateX(-50%) translateY(-2px);
}
```

- [ ] If pseudo-element tooltips on label wrappers interfere with form layout, limit `.has-tooltip` to controls and action buttons first.
- [ ] Do not add JavaScript for tooltip positioning unless CSS cannot satisfy mobile constraints.

## Step 6: Add Tooltip Attributes To Controls

- [ ] Add `class="has-tooltip"`, `data-tooltip`, and `title` to these controls:

```text
internal-token
refresh
auto-refresh label or wrapper
drain
renew-youtube
poll-chzzk
recalculate-special-days
hub-event-refresh
hub-event-validate
hub-event-save
hub-event-publish
hub-event-cancel
hub-event-deactivate
hub-event-delete
publication-state filter
public-status filter
search filter
main Hub event editor inputs/selects
```

- [ ] Tooltip copy must be concise:

```text
Refresh adapter, secret, feature flag, and job status.
Run notification job draining once.
Renew YouTube WebSub subscriptions.
Poll CHZZK live status once.
Recalculate special day calendar status.
Refresh Hub event list from the server.
Validate the current Hub event form without saving.
Save the current form as a draft.
Publish the selected Hub event.
Cancel the selected Hub event.
Deactivate the selected Hub event.
Delete the selected Hub event.
```

- [ ] Do not include token examples, real secrets, raw payloads, or production identifiers in tooltip text.

## Step 7: Add Mobile Responsive CSS

- [ ] Add mobile CSS under `@media (max-width: 640px)`:

```css
@media (max-width: 640px) {
  body {
    overflow-x: hidden;
  }

  main,
  .shell,
  .panel,
  .card,
  .hub-events-workspace {
    width: 100%;
    max-width: 100%;
  }

  .grid,
  .toolbar,
  .hub-events-workspace,
  .hub-event-actions {
    grid-template-columns: 1fr;
  }

  .toolbar,
  .hub-event-actions {
    display: flex;
    flex-wrap: wrap;
  }

  input,
  select,
  textarea,
  button {
    max-width: 100%;
  }

  .table-scroll {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .has-tooltip::after {
    display: none;
  }
}
```

- [ ] Adjust selector names to match the existing template exactly.
- [ ] Add bottom padding for mobile browser toolbars if the current root container has insufficient scroll room.

## Step 8: Wrap Tables In Scroll Containers

- [ ] Wrap admin diagnostic tables and Hub event tables with `class="table-scroll"` where they can exceed mobile width.
- [ ] Preserve table IDs and tbody IDs used by JavaScript.
- [ ] Do not change row rendering logic.

## Step 9: Verify Admin Route Tests Pass

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- adminInternalRoutes
```

Expected: PASS.

## Step 10: Run Focused Build

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Expected: PASS.

## Step 11: Run Full Backend Tests

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test
```

Expected: PASS.

## Step 12: Manual Browser Verification

- [ ] Deploy or run the backend admin console using the existing server workflow only if requested.
- [ ] Open `/admin` on desktop width and verify:

```text
Events heading and subtitle have clear inner spacing.
Validation and Audit log headings have clear inner spacing.
Hovering buttons and fields shows concise tooltips.
Keyboard focus on buttons and fields shows the same tooltip affordance.
```

- [ ] Open `/admin` around 390px width and verify:

```text
No page-wide horizontal overflow.
Internal token input fits.
Top action toolbar wraps.
Hub events action buttons wrap and remain tappable.
Tables scroll inside their own containers.
Tooltip bubbles are hidden or constrained on mobile and do not create overflow.
```

## Step 13: Diff Hygiene

- [ ] Run:

```bash
rtk git diff --check
rtk git status --short --branch
```

Expected: Only planned admin console docs/tests/source files changed, alongside any pre-existing unrelated local changes.

## Rollback Notes

If layout breaks:

- Revert only the CSS and class/attribute changes in `adminConsoleHtml.ts`.
- Keep route behavior untouched.
- Re-run `rtk npm test -- adminInternalRoutes` and `rtk npm run build`.
