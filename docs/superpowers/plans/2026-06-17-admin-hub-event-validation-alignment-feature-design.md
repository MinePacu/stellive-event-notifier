# Admin Hub Event Validation Alignment Feature Design

**Source Issues:** GitHub `#39`, GitLab `#22`

**Goal:** Make the `/admin` Hub Event form validate and save the same logical payload, align form option values with backend policy enums, and reduce operator mistakes when entering `Generation` and `Member`.

**Problem Summary:**

- The admin console `Validate` flow can report `source_required`, `unsupported_category`, `unsupported_status`, and `date_window_required` even when the operator has already filled those fields.
- The form still exposes legacy or unsupported option values for some Hub Event fields.
- Operators can easily enter mismatched `Generation` and `Member` combinations because the current form does not help them align catalog IDs.

## Current Behavior

`Save draft` and `Publish` are expected to send a Hub Event input object. The validation route also validates a Hub Event input object.

Current friction points:

- `/v1/admin/hub-events/validate` validates `request.body` directly.
- The admin console validation button currently sends a wrapped body shape instead of the raw Hub Event input shape.
- The form still exposes UI option values that do not exactly match current backend enums.
- The form uses free-text inputs for `Generation` and `Member` with no built-in mapping help.

## User-Facing Outcome

After this change:

- `Validate` should succeed whenever the same field set would succeed in `Save draft`.
- The category, status, and source type selects should only expose values accepted by backend validation.
- Operators should have a low-friction way to choose a correct `Generation` and `Member` combination.
- The image metadata fields added recently should keep working unchanged.

## Approaches Considered

### Approach A: Fix Validate Payload Only

Change only the `Validate` request body shape.

Pros:

- Smallest code change.
- Fastest path to remove the misleading validation errors.

Cons:

- Leaves invalid legacy select values in the form.
- Leaves `Generation` and `Member` guidance problem unsolved.

### Approach B: Validate Payload + Enum Alignment

Fix the request body shape and replace legacy select values with server-supported enums.

Pros:

- Fixes the validation mismatch and most operator-facing failures.
- Keeps scope small.

Cons:

- `Generation` and `Member` are still easy to mismatch.

### Approach C: Validate Payload + Enum Alignment + Minimal Catalog Guidance

Fix the request body shape, align select values, and add lightweight operator guidance for valid `Generation` and `Member` usage.

Pros:

- Solves the actual failures and the most common operator confusion.
- Still stays within the existing admin console structure.

Cons:

- Slightly more UI work than the narrowest bug fix.

**Chosen Direction:** Approach C.

Reasoning:

- The payload mismatch is the direct bug.
- Enum mismatch is a second hard failure in the same workflow.
- Generation/member guidance is a small addition with a meaningful reduction in repeated operator error.

## Functional Requirements

### 1. Validation Request Shape

The validation button must submit the same top-level Hub Event input shape that `Save draft` uses.

Expected shape:

```json
{
  "title": "...",
  "summary": "...",
  "category": "offline_concert",
  "participationMode": "offline",
  "status": "upcoming",
  "generationId": "gen2",
  "memberId": "akane-lize",
  "sourceUrl": "https://...",
  "sourceLabel": "...",
  "sourceType": "official",
  "announcedAt": "2026-05-24T10:13:00.000Z",
  "startsAt": "2026-07-11T09:00:00.000Z",
  "endsAt": "2026-07-11T14:00:00.000Z",
  "ticketUrl": "https://...",
  "image": {
    "policyState": "official_runtime_url",
    "url": "https://...",
    "sourceLabel": "...",
    "sourceUrl": "https://..."
  }
}
```

### 2. Form Enum Alignment

The admin form must expose only backend-supported values for these fields.

`Category`:

- `online_goods`
- `online_collab`
- `offline_concert`
- `offline_collab`
- `offline_popup`
- `ticketing`

`Participation mode`:

- `online`
- `offline`
- `hybrid`

`Status`:

- `announced`
- `upcoming`
- `open`
- `closing_soon`
- `ended`
- `cancelled`

`Source type`:

- `official`
- `member`
- `official_collab`

Legacy or invalid values such as `offline_event`, `venue`, `ticketing` as a source type, or `store` as a source type must no longer be emitted by the form.

### 3. Generation And Member Guidance

The admin form should keep the current lightweight text-input model, but it should add minimal guidance:

- `Generation` placeholder or helper text with examples: `official`, `gen1`, `gen2`, `gen3`
- `Member` helper text with common examples or a short static hint
- A note that member-scoped events should use a generation ID that matches the member catalog entry

This change should not introduce a heavy searchable catalog picker in this bug-fix scope.

### 4. Validation Messaging

After the request shape is fixed, validation failures should reflect real input errors:

- Missing required fields
- HTTPS URL issues
- invalid category/status/source type
- invalid image metadata
- missing date window for publish validation

The UI should stop reporting missing source or date fields when those values are already present.

## Non-Goals

- No new backend validation rules beyond current policy unless required to match existing enums.
- No member search modal, autocomplete, or full catalog selector.
- No mobile app changes.
- No push payload changes.
- No database migration.
- No image upload, proxy, or storage changes.

## Acceptance Criteria

- `Validate` succeeds on a valid example that also succeeds in `Save draft`.
- The form cannot submit legacy invalid enum values through its select controls.
- A member event example such as `akane-lize` with `gen2` validates cleanly when the rest of the fields are valid.
- Existing image metadata fields continue to validate through the same backend image policy.
- The bug reproduced in GitHub `#39` and GitLab `#22` no longer occurs.

