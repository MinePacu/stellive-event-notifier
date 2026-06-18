Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Source Design:** `docs/superpowers/plans/2026-06-17-admin-hub-event-validation-alignment-feature-design.md`

**Source Issues:** GitHub `#39`, GitLab `#22`

**Goal:** Fix the admin Hub Event validation request shape, align form enum values with backend policy, and add minimal generation/member guidance without changing unrelated backend or app behavior.

**Architecture:** Keep the fix inside the existing admin console and admin route boundary. Reuse the current `collectHubEventInput()` builder as the single source of form payload truth, make `Validate` send that same shape, and update form selects so they only emit values already accepted by `hubEventPolicy`. Add only lightweight helper text for operator guidance instead of introducing a new catalog picker.

**Tech Stack:** TypeScript, Fastify admin HTML string rendering, browser `fetch`, Vitest.

**Token Policy:** Use `rtk` for all shell commands. Read only the files named in this plan unless a focused test failure proves a dependency mismatch. Prefer `rg`, short `awk`/`sed`, and targeted Vitest commands over broad file reads or full test suites. Do not inspect or modify Android, iOS, CHZZK, push payload, CI, Docker, or unrelated docs during implementation. Keep patches small and avoid formatting-only churn.

## Files

Modify:

- `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`

Maybe modify only if a focused failure requires it:

- `backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts`
- `backend/stellive-hub-api/test/hubEventImagePolicy.test.ts`

Do not modify:

- `.env.example`
- mobile app files
- push payload files
- thumbnail rendering files
- catalog seed data
- Docker or CI files

## Implementation Boundaries

This plan fixes three narrow behaviors:

1. `Validate` must send the same top-level Hub Event input shape as `Save draft`.
2. Admin form selects must emit only server-supported enum values.
3. The form should show minimal generation/member guidance without adding a new selection system.

This plan explicitly avoids:

- changing backend Hub Event policy semantics
- adding new API endpoints
- adding server-side member lookup
- adding live validation against the catalog on every keystroke

## Step 1: Confirm The Current Mismatch

- [ ] Run:

```bash
rtk git status --short
rtk rg -n "hub-events/validate|collectHubEventInput|sourceType|offline_event|official_collab|ticketing|store|generationId|memberId" backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts shared/schemas/domain.ts
```

Expected findings:

- `adminHubEventRoutes.ts` validates `request.body` directly.
- `adminConsoleHtml.ts` uses `collectHubEventInput()` for draft save.
- The current validation click path wraps the body or otherwise diverges from the save path.
- The form exposes one or more legacy enum values not accepted by `hubEventPolicy`.

## Step 2: Add Or Update Focused Tests

- [ ] In `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`, add narrow assertions for admin console HTML content.

Test cases:

- the form renders only supported `Category` option values
- the form renders only supported `Source type` option values
- the form includes lightweight guidance text for `Generation` and `Member`
- the form still renders the image metadata controls added previously

Run:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/adminHubEventRoutes.test.ts
```

Expected before implementation:

- New HTML assertions fail if they describe the desired fixed state.

## Step 3: Fix Validate Payload Construction

- [ ] Update the admin console validation path to send `collectHubEventInput()` directly to `/v1/admin/hub-events/validate`.
- [ ] Do not send `{ mode, input }` unless the route is intentionally changed to expect it.
- [ ] Preserve existing validation result rendering and error list behavior.

Acceptance:

- `Validate` and `Save draft` operate on the same Hub Event input shape.
- Real filled values are visible to server-side validation.

## Step 4: Align Admin Form Select Values

- [ ] Update `Category` select values to:

```text
online_goods
online_collab
offline_concert
offline_collab
offline_popup
ticketing
```

- [ ] Update `Source type` select values to:

```text
official
member
official_collab
```

- [ ] Keep `Status` aligned to:

```text
announced
upcoming
open
closing_soon
ended
cancelled
```

- [ ] Remove legacy invalid values from the rendered HTML.

Acceptance:

- The UI cannot emit `offline_event`, `venue`, `store`, or other unsupported values from its select controls.

## Step 5: Add Minimal Generation/Member Guidance

- [ ] Add small inline helper text or placeholder text near `Generation` and `Member`.
- [ ] Keep guidance static and low-cost. Examples:

```text
Generation examples: official, gen1, gen2, gen3
Member example: akane-lize
Member-scoped events should use the member's matching generation.
```

- [ ] Do not add a heavy picker, dynamic catalog fetch, or autocomplete in this bug-fix scope.

Acceptance:

- Operators can see valid examples without leaving the form.
- The form layout remains compact and consistent with the existing admin console.

## Step 6: Verify Existing Image Input Still Works

- [ ] Confirm the previously added image fields still flow through `collectHubEventInput()`.
- [ ] Confirm the validation path still includes `image` metadata when filled.
- [ ] Avoid changing backend image policy logic unless a focused test proves a regression.

Run only if needed:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/hubEventImagePolicy.test.ts
```

Expected:

- No regression to `image.policyState`, `image.url`, `image.sourceLabel`, `image.sourceUrl`.

## Step 7: Focused Verification

- [ ] Run admin-focused tests:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/adminHubEventRoutes.test.ts
```

- [ ] Run backend image policy test only if the payload path or image structure changed:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/hubEventImagePolicy.test.ts
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

- Admin console tests pass.
- Build passes.
- Diff is limited to the targeted admin files and the new docs.

## Step 8: Server Manual Verification

- [ ] Sync and rebuild the internal server only after local tests pass.
- [ ] Verify the real admin console flow with a valid sample event.

Manual verification scenario:

1. Open `http://192.168.50.9:4000/admin`.
2. Fill:
   `Category = offline_concert`
   `Participation mode = offline`
   `Status = upcoming`
   `Generation = gen2`
   `Member = akane-lize`
   `Source type = official`
   HTTPS source URL, announced/start/end times, and optional image metadata.
3. Click `Validate`.
4. Confirm there is no false `source_required`, `unsupported_category`, `unsupported_status`, or `date_window_required` error.
5. Click `Save draft`.
6. Reopen the saved event and confirm values persist.

## Token-Minimizing Execution Rules

- [ ] Start with targeted grep on the exact admin files instead of reading whole files.
- [ ] Reuse the existing `collectHubEventInput()` path instead of introducing a second payload builder.
- [ ] Prefer updating current select literals and helper text over adding new components or abstractions.
- [ ] Prefer a single focused test file, `test/adminHubEventRoutes.test.ts`, over broad backend suites.
- [ ] Run `test/hubEventImagePolicy.test.ts` only if the image path changes.
- [ ] Use one server rebuild at the end instead of repeated remote rebuilds during local iteration.
- [ ] Avoid unrelated file reads, repo-wide searches, or full-suite test runs unless a focused failure forces expansion.

## Safety Checklist

- [ ] No secrets, tokens, screenshots, copied media, or production device tokens are added.
- [ ] `.env.example` remains unchanged.
- [ ] No mobile app, push payload, or CHZZK behavior changes are introduced.
- [ ] Existing image metadata behavior remains intact.
- [ ] Existing backend validation remains the source of truth.

## Commit

Commit only after verification passes:

```bash
rtk git add backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/test/adminHubEventRoutes.test.ts docs/superpowers/plans/2026-06-17-admin-hub-event-validation-alignment-feature-design.md docs/superpowers/plans/2026-06-17-admin-hub-event-validation-alignment-code-design.md
rtk git commit -m "fix: align admin hub event validation flow" -m "- Send the same payload shape for validate and draft save\n- Align admin hub event select values with backend enums\n- Add low-cost generation and member guidance for operators"
```
