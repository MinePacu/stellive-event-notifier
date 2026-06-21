Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the Hub Events admin `Save draft` flow from unintentionally clearing `Image URL`, `Image source label`, and `Image source URL` when image metadata was entered or already stored.

**Architecture:** Keep the public/mobile Hub Event DTO unchanged. Fix the admin form and backend draft validation so `imagePolicyState=none` cannot silently discard filled image fields, while display eligibility remains controlled only by `image.policyState` and HTTPS URL checks. Draft saves should either preserve explicit image metadata under a non-`none` policy state or fail with a clear validation error when the form state is contradictory.

**Tech Stack:** TypeScript, Fastify route tests, admin console inline HTML/JS, Vitest.

## Files

Modify:
- `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
- `backend/stellive-hub-api/test/hubEventImagePolicy.test.ts`
- `docs/AI_HANDOFF.md`

Do not modify:
- Mobile DTO models.
- Public `/v1/hub-events` response shape.
- Push notification behavior.
- Catalog/member seed data.
- External provider adapters.

## Current Root Cause

- `adminConsoleHtml.ts` `collectHubEventInput()` always sends `input.image = null` when `imagePolicyState === "none"`.
- The same function excludes `imagePolicyState`, `imageUrl`, `imageSourceLabel`, and `imageSourceUrl` from top-level input and rebuilds `input.image` separately.
- If an admin fills image fields but leaves `Image policy state` as `None`, `Save draft` sends `image: null`.
- After save, `bindHubEventForm(result)` repopulates fields from `event.image?.url`, `event.image?.sourceLabel`, and `event.image?.sourceUrl`; when the saved response has `image: null`, those inputs become empty.
- This is not caused by `Source type`; `sourceType` is top-level event-source metadata, while thumbnail display is controlled by nested `image.policyState`.

## Desired Behavior

- If `Image policy state` is `None` and all image fields are empty, save `image: null`.
- If any image field has a value while `Image policy state` is `None`, block save with a clear validation error before the fields are cleared.
- If `Image policy state` is displayable (`official_runtime_url` or `third_party_allowed`), require:
  - HTTPS `image.url`
  - non-empty `image.sourceLabel`
  - HTTPS `image.sourceUrl`
- If `Image policy state` is non-displayable but non-none (`verify_required` or `blocked`), allow metadata to be saved for audit/review without displaying it in mobile clients.
- Existing stored image metadata must round-trip through edit form binding and draft save unless the admin intentionally chooses `None` with empty image fields.

## Token-Minimized Execution Rules

- Use `rtk` for every shell command.
- Search only scoped files:
  - `rtk rg -n "collectHubEventInput|imagePolicyState|imageSourceLabel|imageSourceUrl" backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
  - `rtk rg -n "validateHubEventImageForAdmin|image_policy_state_not_allowed|image_source_required" backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts backend/stellive-hub-api/test`
- Avoid broad repository reads; use `sed -n` on the exact function ranges found by `rg`.
- Run focused tests first:
  - `rtk npm test -- hubEventImagePolicy`
  - `rtk npm test -- adminInternalRoutes`
- Run broad backend tests only after focused tests pass:
  - `rtk npm run build`
  - `rtk npm test`
- Record only command names and pass/fail summaries in `docs/AI_HANDOFF.md`; do not paste full logs.

## Implementation Steps

- [ ] Confirm current form behavior in code.
  - Read `collectHubEventInput()` and `bindHubEventForm()` in `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`.
  - Verify that `imagePolicyState === "none"` produces `input.image = null`.

- [ ] Add backend validation tests for contradictory image form state.
  - File: `backend/stellive-hub-api/test/hubEventImagePolicy.test.ts`
  - Add a test where `image.policyState = "none"` and `image.url`, `image.sourceLabel`, or `image.sourceUrl` exists.
  - Expected result: invalid with a reason that clearly identifies image fields are present while policy is `none`.

- [ ] Add backend validation tests for review-only metadata.
  - File: `backend/stellive-hub-api/test/hubEventImagePolicy.test.ts`
  - Add cases for `policyState = "verify_required"` and `policyState = "blocked"` with image metadata.
  - Expected result: draft validation allows metadata storage, but displayability remains false.

- [ ] Add admin route regression test for draft save.
  - File: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
  - Create or update a draft Hub Event with `image.policyState = "verify_required"`, `url`, `sourceLabel`, and `sourceUrl`.
  - Expected response includes the same nested `image` fields.

- [ ] Run focused tests to confirm RED.
  - Command: `rtk npm test -- hubEventImagePolicy`
  - Command: `rtk npm test -- adminInternalRoutes`
  - Expected: at least the new contradictory-state or round-trip tests fail before implementation.

- [ ] Implement backend validation.
  - File: `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`
  - Add a validation branch:
    - `policyState === "none"` plus any non-empty `url`, `sourceLabel`, `sourceUrl`, or `altText` returns a validation error.
    - `verify_required` and `blocked` may carry metadata but are not displayable.
    - Existing displayable-state requirements remain unchanged.

- [ ] Implement admin client-side guard.
  - File: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
  - Before returning payload in `collectHubEventInput()`, detect image fields with `imagePolicyState === "none"`.
  - Throw or surface a client-side validation message instead of sending `image: null`.
  - Keep `image: null` only when image policy is `none` and all image fields are empty.

- [ ] Preserve form round-trip behavior.
  - File: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
  - Keep `bindHubEventForm(event)` binding from `event.image?.url`, `event.image?.sourceLabel`, and `event.image?.sourceUrl`.
  - Do not clear image inputs on failed save.

- [ ] Run focused tests to confirm GREEN.
  - Command: `rtk npm test -- hubEventImagePolicy`
  - Command: `rtk npm test -- adminInternalRoutes`
  - Expected: new and existing focused tests pass.

- [ ] Run backend build and full backend tests.
  - Command: `rtk npm run build`
  - Command: `rtk npm test`
  - Expected: TypeScript build and all backend tests pass.

- [ ] Run policy grep.
  - Command: `rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|profileImageUrl|posterUrl|logoUrl|rawPayload|providerResponse|NID_AUT|NID_SES|login-cookie|cookie scraping" backend/stellive-hub-api/src backend/stellive-hub-api/test docs/superpowers/plans/2026-06-21-admin-hub-event-image-form-preserve-fields-code-design.md`
  - Expected: matches are existing policy references, explicit exclusions, or unrelated legacy text only.

- [ ] Update handoff.
  - File: `docs/AI_HANDOFF.md`
  - Record:
    - Root cause.
    - Files changed.
    - Focused and broad verification results.
    - Any manual admin-console check skipped or completed.

- [ ] Confirm final diff scope.
  - Command: `rtk git status --short`
  - Command: `rtk git diff --stat`
  - Expected: diff limited to admin form, Hub Event image validation/tests, this plan, and handoff notes.

## Commit Boundary

Suggested single commit:

```bash
rtk sh -lc "printf '%s\n' 'fix: preserve hub event image metadata drafts' '- Block contradictory admin image form saves when policy is none but image fields are filled' '- Preserve verify-required and blocked image metadata for review without enabling mobile display' '- Cover image policy validation and admin draft round-trip behavior' > /private/tmp/commit_msg && rtk git commit -F /private/tmp/commit_msg"
```
