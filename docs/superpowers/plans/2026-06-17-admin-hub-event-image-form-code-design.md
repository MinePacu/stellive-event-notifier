Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Source Design:** `docs/superpowers/plans/2026-06-17-hub-event-thumbnail-feature-design.md`, `docs/superpowers/plans/2026-06-17-hub-event-thumbnail-code-design.md`

**Goal:** Add `image.policyState`, `image.url`, `image.sourceLabel`, and `image.sourceUrl` inputs to the `/admin` Hub Event form so operators can register safe goods/event thumbnail metadata without direct API calls.

**Architecture:** Reuse the existing `HubEvent.image` contract and backend validation. The admin console only collects, binds, clears, and submits optional image metadata; it must not add image upload, image proxying, binary storage, or copied asset support. Validation remains owned by the existing admin Hub Event service and image policy.

**Tech Stack:** TypeScript, Fastify admin HTML string, browser `fetch`, Vitest route/UI behavior tests.

**Token Policy:** Use `rtk` for every shell command. Inspect only `adminConsoleHtml.ts`, admin Hub Event route tests, and image policy tests unless a failure points elsewhere. Keep patches small and avoid formatting unrelated admin console code.

## Files

Modify:

- `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`
- `backend/stellive-hub-api/test/hubEventImagePolicy.test.ts` only if current coverage does not already prove admin image validation

Do not modify:

- `.env.example`
- mobile app files
- push payload files
- CHZZK live-status code
- catalog seed/member policy files
- Docker or CI files

## Current State

The backend already accepts and validates optional `HubEvent.image` metadata. Displayable thumbnail states are:

- `official_runtime_url`
- `third_party_allowed`

Non-display or fallback states are:

- `none`
- `verify_required`
- `blocked`

The `/admin` form currently exposes core Hub Event fields such as title, summary, category, source URL, purchase URL, venue, and notification eligibility, but it does not expose `image` inputs. Operators must currently use direct API payloads to register thumbnail metadata.

## UI Design

Add an image metadata section near the source fields in the Hub Event form. Use plain form controls consistent with the existing admin console.

Fields:

- `Image policy state`
- `Image URL`
- `Image source label`
- `Image source URL`

DOM IDs:

- `hub-event-image-policy-state`
- `hub-event-image-url`
- `hub-event-image-source-label`
- `hub-event-image-source-url`

Form names:

- `imagePolicyState`
- `imageUrl`
- `imageSourceLabel`
- `imageSourceUrl`

Policy state options:

- `none`
- `official_runtime_url`
- `third_party_allowed`
- `verify_required`
- `blocked`

Operator behavior:

- Default new drafts to `none`.
- If policy state is `none`, submit `image: null` or omit `image` according to the current repository clearing semantics.
- If policy state is `official_runtime_url` or `third_party_allowed`, collect `url`, `sourceLabel`, and `sourceUrl`.
- If policy state is `verify_required` or `blocked`, allow optional source context but do not require a display URL.
- Do not show upload controls, file pickers, base64 inputs, local asset path inputs, or preview download behavior.

## Data Mapping

When collecting the form:

```ts
image:
  imagePolicyState === "none"
    ? null
    : {
        policyState: imagePolicyState,
        url: imageUrl || undefined,
        sourceLabel: imageSourceLabel || undefined,
        sourceUrl: imageSourceUrl || undefined,
      }
```

When binding an existing event:

```ts
hubEventFields.imagePolicyState.value = event.image?.policyState || "none";
hubEventFields.imageUrl.value = event.image?.url || "";
hubEventFields.imageSourceLabel.value = event.image?.sourceLabel || "";
hubEventFields.imageSourceUrl.value = event.image?.sourceUrl || "";
```

When resetting the form:

```ts
hubEventFields.imagePolicyState.value = "none";
hubEventFields.imageUrl.value = "";
hubEventFields.imageSourceLabel.value = "";
hubEventFields.imageSourceUrl.value = "";
```

## Validation Policy

The admin form should not duplicate all backend validation. It may rely on the existing `Validate` button and server response for authoritative errors.

Required backend validation expectations:

- Displayable images require HTTPS `image.url`.
- Displayable images require source context through `image.sourceLabel` and HTTPS `image.sourceUrl`.
- Non-HTTPS image URLs are rejected.
- Binary/local/copy-prone fields remain rejected: `imageUrl`, `logoUrl`, `posterUrl`, `thumbnailUrl`, `profileImageUrl`, `bytes`, `base64`, `assetPath`, `filePath`, `localPath`.
- `verify_required`, `blocked`, and `none` must not display image thumbnails in apps.

## Step 1: Inspect Current Form And Tests

- [ ] Run:

```bash
rtk git status --short
rtk rg -n "hub-event-image|hubEventFields|collectHubEventInput|bindHubEventForm|resetHubEventForm" backend/stellive-hub-api/src/admin/adminConsoleHtml.ts
rtk rg -n "image|thumbnail|create hub event|updates hub event" backend/stellive-hub-api/test/adminHubEventRoutes.test.ts backend/stellive-hub-api/test/hubEventImagePolicy.test.ts
```

Expected:

- `adminConsoleHtml.ts` has no existing image form fields.
- Backend image validation tests already cover most policy behavior from the thumbnail work.

## Step 2: Add Failing Admin Form Coverage

- [ ] Add focused tests if the project has admin console HTML tests.
- [ ] If there is no HTML test harness, add route/service tests only for payload acceptance and rely on `git diff --check` plus manual source inspection for the static HTML wiring.

Test cases:

- create/update payload accepts `image.policyState: "official_runtime_url"` with HTTPS `url`, `sourceLabel`, and HTTPS `sourceUrl`
- create/update payload accepts `image.policyState: "third_party_allowed"` with HTTPS metadata
- create/update payload rejects `image.url: "http://..."`
- create/update payload rejects local/binary image fields

Run:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/adminHubEventRoutes.test.ts test/hubEventImagePolicy.test.ts
```

Expected before UI wiring:

- Existing backend validation tests pass.
- Any newly added tests should describe the server contract the form will submit.

## Step 3: Add Form Controls

- [ ] In `adminConsoleHtml.ts`, add a compact image metadata section after `Source type` or near source URL fields.
- [ ] Add the four controls with the DOM IDs listed above.
- [ ] Keep the existing visual language: `.field`, existing inputs, and existing select styling.
- [ ] Do not add previews, upload buttons, or external image fetching from the admin page.

Acceptance:

- New controls appear in the Hub Event form.
- Existing form layout remains usable on narrow screens.

## Step 4: Wire Field References

- [ ] Extend `hubEventFields` with:

```ts
imagePolicyState: document.getElementById("hub-event-image-policy-state"),
imageUrl: document.getElementById("hub-event-image-url"),
imageSourceLabel: document.getElementById("hub-event-image-source-label"),
imageSourceUrl: document.getElementById("hub-event-image-source-url"),
```

Acceptance:

- No references use undeclared DOM IDs.
- Existing fields remain untouched.

## Step 5: Submit Image Metadata

- [ ] Update `collectHubEventInput()` to include optional `image`.
- [ ] Trim image text fields before submission.
- [ ] Submit `image: null` when policy state is `none` so operators can clear an existing thumbnail.
- [ ] Submit metadata object for all other policy states.

Acceptance:

- Saving a draft with `official_runtime_url` sends safe image metadata to `/v1/admin/hub-events`.
- Saving with `none` clears image metadata.
- Validation errors still render through the existing validation list.

## Step 6: Bind Existing Events

- [ ] Update `bindHubEventForm(event)` to populate image fields from `event.image`.
- [ ] Update any new-form/reset path to return image fields to `none` and empty strings.

Acceptance:

- Selecting an event with image metadata fills the image fields.
- Selecting an event without image metadata shows `none` and blank URL/source fields.

## Step 7: Focused Verification

- [ ] Run backend focused tests:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/adminHubEventRoutes.test.ts test/hubEventImagePolicy.test.ts
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

- Admin route/image policy tests pass.
- TypeScript build passes.
- Diff contains only admin form/test/doc changes for this task.

## Manual Verification

Use a local or server admin session:

1. Open `/admin`.
2. Fill a Hub Event with `Image policy state = official_runtime_url`.
3. Enter HTTPS `Image URL`, `Image source label`, and HTTPS `Image source URL`.
4. Click `Validate`; expect no image validation error.
5. Click `Save draft`.
6. Re-select the saved item; expect the image fields to remain populated.
7. Change `Image policy state` to `none` and save; expect image metadata to clear.

## Safety Checklist

- [ ] No image binaries, base64, local paths, copied media, official logos, fan art, profile images, screenshots, secrets, or production tokens are added.
- [ ] `.env.example` remains unchanged.
- [ ] Existing backend image policy remains authoritative.
- [ ] Mobile app fallback behavior remains unchanged.
- [ ] Notification preferences, global off, quiet hours, dedupe, and realtime policy remain unchanged.
- [ ] Former members, Gangzi category rules, and official YouTube live exclusion remain untouched.

## Commit

Commit only after verification passes:

```bash
rtk git add backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/test/adminHubEventRoutes.test.ts backend/stellive-hub-api/test/hubEventImagePolicy.test.ts docs/superpowers/plans/2026-06-17-admin-hub-event-image-form-code-design.md
rtk git commit -m "feat: add admin hub event image form plan" -m "- Plan image metadata fields for the Hub Event admin form\n- Reuse existing safe thumbnail validation policy\n- Keep uploads, binaries, and unrelated app behavior out of scope"
```
