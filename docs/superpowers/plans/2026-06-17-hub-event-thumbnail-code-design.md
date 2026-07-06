Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Source Design:** `docs/superpowers/plans/2026-06-17-hub-event-thumbnail-feature-design.md`

**Source Issues:** GitHub `#38`, GitLab `#21`

**Goal:** Complete metadata-only thumbnail support for goods/event registration, app rendering, notification payloads, and automatic refresh using the existing `HubEvent.image` contract.

**Architecture:** Reuse the existing shared `HubEvent.image` policy as the single thumbnail contract. Backend admin validation normalizes and persists only safe image metadata; read APIs and push payloads expose allowed URL metadata without requiring images. Android and iOS decode optional image metadata, gate display through policy helpers, and keep text-first fallback layouts.

**Tech Stack:** TypeScript, Fastify, Zod, Prisma JSON metadata, Vitest, Android Kotlin Views, JUnit, SwiftUI `AsyncImage`, XCTest.

**Token Policy:** Use `rtk` for all shell commands. Start with `rtk git status --short`, then inspect only files listed below. Use focused tests before full test suites. Keep patches small and avoid formatting unrelated files. Do not touch CHZZK live code, member catalog, CI, settings navigation, or unrelated Android/iOS live-page UI.

## Files

Create:

- None expected unless tests require a small policy helper.

Modify:

- `shared/schemas/domain.ts`
- `shared/schemas/mobileApi.ts`
- `shared/openapi/openapi.yaml`
- `backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventAdminTypes.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`
- `backend/stellive-hub-api/src/push/pushPayloadFactory.ts`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/hubevents/HubEventImagePolicy.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarView.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Models/Models.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`

Test:

- `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`
- `backend/stellive-hub-api/test/hubEvents.test.ts`
- `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`
- `backend/stellive-hub-api/test/pushPayloadFactory.test.ts`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventImagePolicyTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`

## Step 1: Baseline

- [ ] Run:

```bash
rtk git status --short
```

- [ ] Inspect only current image/event contract files:

```bash
rtk grep -n "HubEventImage\\|image\\??:" shared/schemas/domain.ts shared/schemas/mobileApi.ts backend/stellive-hub-api/src/hub-events backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts
```

## Step 2: Backend Admin Validation Tests

- [ ] Add failing tests in `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`.
- [ ] Cover create/update with `official_runtime_url` and HTTPS `url`.
- [ ] Cover create/update with `third_party_allowed`, `sourceLabel`, and `sourceUrl`.
- [ ] Cover rejection for `http://`, `file://`, `assetPath`, `localPath`, `bytes`, and `base64`.
- [ ] Cover `verify_required` and `blocked` accepted as metadata but not displayable.
- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/adminHubEventRoutes.test.ts
```

Expected: new tests fail before implementation.

## Step 3: Backend Admin Implementation

- [ ] Update `hubEventAdminTypes.ts` so create/update schemas accept optional `image`.
- [ ] Add or reuse a normalizer that strips unknown image fields and rejects binary/local fields.
- [ ] Require HTTPS `url` and HTTPS `sourceUrl` for displayable states.
- [ ] Require `sourceLabel` or `sourceUrl` for `official_runtime_url` and `third_party_allowed`.
- [ ] Preserve `image: undefined` as "do not change" for patch/update routes, and allow explicit `image: null` or `policyState: "none"` to clear display metadata if existing route semantics support clearing.
- [ ] Update `hubEventAdminService.ts` and `hubEventRepository.ts` persistence mapping without adding image binary storage.
- [ ] Re-run:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/adminHubEventRoutes.test.ts
```

Expected: admin image tests pass.

## Step 4: Read API Contract

- [ ] Add tests in `hubEventReadRoutes.test.ts` proving allowed metadata is returned on goods/event read responses.
- [ ] Prove calendar/widget projections remain valid when `image` exists.
- [ ] Update `shared/schemas/domain.ts`, `shared/schemas/mobileApi.ts`, and `shared/openapi/openapi.yaml` only if current schema is incomplete.
- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/hubEventReadRoutes.test.ts test/hubEvents.test.ts
```

Expected: read contracts expose normalized metadata and tolerate missing images.

## Step 5: Push Payload Thumbnail

- [ ] Add tests in `pushPayloadFactory.test.ts` for allowed image URL inclusion.
- [ ] Add tests proving blocked, verify-required, missing URL, and non-HTTPS URL are omitted.
- [ ] Update `pushPayloadFactory.ts` to include thumbnail URL only in provider-safe image fields.
- [ ] Keep event ID, type, deep link, source URL, and preference behavior unchanged.
- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/pushPayloadFactory.test.ts
```

Expected: push payload includes allowed thumbnail URL when safe and omits it otherwise.

## Step 6: Android Rendering

- [ ] Extend `HubEventImagePolicyTest.kt` for allowed, blocked, verify-required, missing, invalid, and HTTP image states.
- [ ] Confirm `Models.kt` already decodes optional `HubEventImage`; add only missing fields.
- [ ] Update `HubEventsCalendarView.kt` goods/event card or detail UI to render a thumbnail only when `HubEventImagePolicy.canDisplay(image)` is true.
- [ ] On image load failure, hide the image slot and keep existing text layout.
- [ ] Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

Expected: Android image policy and existing calendar tests pass.

## Step 7: iOS Rendering

- [ ] Confirm `Models.swift` decodes optional image metadata; add missing fields only.
- [ ] Add a pure display URL helper if no equivalent exists.
- [ ] Update `HubEventsView.swift` and `HubEventDetailView.swift` to use `AsyncImage` only for allowed HTTPS URLs.
- [ ] On `AsyncImage` failure, collapse to existing text-first layout.
- [ ] Add or update XCTest coverage for decoding and display policy.
- [ ] Run the existing iOS test target on iPhone 17 simulator:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

Expected: iOS tests pass.

## Step 8: Automatic Refresh Interaction

- [ ] Verify the existing goods/event refresh path re-fetches full event payloads and therefore receives updated `image`.
- [ ] Add focused test coverage only if refresh currently maps partial DTOs that could drop `image`.
- [ ] Do not create a separate polling path just for thumbnails.
- [ ] Confirm notification-tap deep links fetch current event/list data before rendering.

## Step 9: Verification

- [ ] Run backend build and focused tests:

```bash
cd backend/stellive-hub-api
rtk npm run build
rtk npm test -- hubEvent
```

- [ ] Run Android focused tests:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

- [ ] Run iOS tests:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

- [ ] Run diff checks:

```bash
rtk git diff --check
rtk git status --short
```

## Step 10: Acceptance Review

- [ ] Confirm no image binaries, copied media, logos, fan art, screenshots, secrets, or production tokens were added.
- [ ] Confirm unsafe image metadata is rejected by backend admin routes.
- [ ] Confirm read APIs work with and without `image`.
- [ ] Confirm Android and iOS render allowed thumbnails and fall back cleanly.
- [ ] Confirm push payloads omit unsafe thumbnails.
- [ ] Confirm notification preferences, dedupe, quiet hours, and global off remain unchanged.

## Commit

- [ ] Commit after tests pass:

```bash
rtk git add shared backend/stellive-hub-api android/StelliveHubAndroid ios/StelliveHubiOS
rtk git commit -m "feat: add hub event thumbnail support" -m "- Accept safe thumbnail metadata when registering goods/events\n- Expose allowed thumbnail URLs through app and notification payloads\n- Preserve image-free fallback behavior on Android and iOS"
```
