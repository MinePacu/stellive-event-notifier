Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the HubEvent image metadata contract and mobile image-free fallback behavior described in `docs/superpowers/plans/2026-06-12-hub-event-image-policy.md`.

**Architecture:** Add image policy metadata at the shared `HubEvent` contract boundary, validate it in backend admin policy code, persist only URL/source metadata, and keep calendar/widget/push DTOs image-free. Mobile apps decode optional image metadata, gate remote rendering through pure policy helpers, and collapse to existing text-first layouts for missing, blocked, verify-required, invalid, or failed images. Android uses existing OkHttp/coroutines for in-memory image loading; iOS uses SwiftUI `AsyncImage`; neither platform stores image binaries.

**Tech Stack:** TypeScript, Fastify, Prisma JSON metadata, OpenAPI, Vitest, Android Kotlin Views, OkHttp, Kotlin coroutines, JUnit, SwiftUI, AsyncImage, XCTest.

## Source Plan

- Feature composition plan: `docs/superpowers/plans/2026-06-12-hub-event-image-policy.md`
- GitHub issue #19: https://github.com/MinePacu/stellive-event-notifier/issues/19
- GitLab work item #13: https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/13

## Invariants

- Do not store image binaries, base64, app-bundled copied assets, official logos, fan art, screenshots, or copied CDN assets.
- Do not add image upload controls.
- Do not add image fields to `HubCalendarEntry`, widget snapshots, or push payloads.
- Do not render images for `none`, `verify_required`, `blocked`, missing URL, non-HTTPS URL, or load failure.
- Do not show "이미지가 없습니다" or equivalent empty-image copy.
- Do not alter notification preference resolution, realtime behavior, member catalog rules, Gangzi placement, or official YouTube live exclusion.

## Files

Create:

- `backend/stellive-hub-api/test/hubEventImagePolicy.test.ts`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/hubevents/HubEventImagePolicy.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventImagePolicyTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubEventImagePolicy.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventImagePolicyTests.swift`

Modify:

- `shared/schemas/domain.ts`
- `shared/schemas/mobileApi.ts`
- `shared/openapi/openapi.yaml`
- `backend/stellive-hub-api/prisma/schema.prisma`
- `backend/stellive-hub-api/src/hub-events/hubEventAdminTypes.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`
- `backend/stellive-hub-api/src/push/pushPayloadFactory.ts`
- `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`
- `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`
- `backend/stellive-hub-api/test/pushPayloadFactory.test.ts`
- `backend/stellive-hub-api/test/mobileBootstrap.test.ts`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubApiClientTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`
- `ios/StelliveHubiOS/StelliveHubCalendarWidget/StelliveHubCalendarWidget.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`
- `docs/HUB_EVENTS_READ_API_DESIGN.md`
- `docs/UI_GUIDELINES.md`
- `docs/AI_HANDOFF.md`

## Data Contract

```ts
export type HubEventImagePolicyState =
  | "none"
  | "official_runtime_url"
  | "third_party_allowed"
  | "verify_required"
  | "blocked";

export interface HubEventImage {
  policyState: HubEventImagePolicyState;
  url?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  altText?: string;
}
```

`HubEvent.image?: HubEventImage` is optional. `HubCalendarEntry`, `HubCalendarWidgetSnapshot`, and push payload DTOs remain unchanged.

## Backend Implementation Steps

- [ ] In `backend/stellive-hub-api/test/hubEventImagePolicy.test.ts`, add a failing test that imports `HubEventImagePolicyState` through `../src/types.js` and asserts all five states are assignable.
- [ ] In `backend/stellive-hub-api/test/hubEventImagePolicy.test.ts`, add a failing test that a `HubEvent` with no `image` is valid TypeScript and matches the existing minimal fixture shape.
- [ ] In `shared/schemas/domain.ts`, add `HubEventImagePolicyState`, `HubEventImage`, and `image?: HubEventImage` on `HubEvent`.
- [ ] In `shared/schemas/mobileApi.ts`, keep imports compiling after the `HubEvent` contract extension; do not add separate calendar/widget image fields.
- [ ] Run `rtk npm test -- hubEventImagePolicy` from `backend/stellive-hub-api`; expected result: pass.
- [ ] In `backend/stellive-hub-api/test/hubEventImagePolicy.test.ts`, add failing tests for `canDisplayHubEventImage` cases: `official_runtime_url` with HTTPS URL is true, `third_party_allowed` with HTTPS URL is true, `none` is false, `verify_required` is false, `blocked` is false, HTTP URL is false, missing URL is false.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`, add exported `canDisplayHubEventImage(image: HubEvent["image"]): boolean`.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`, implement `canDisplayHubEventImage` with only `official_runtime_url` and `third_party_allowed` as displayable states and require `https://`.
- [ ] Run `rtk npm test -- hubEventImagePolicy` from `backend/stellive-hub-api`; expected result: pass.
- [ ] In `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`, add a failing admin validation case accepting `image: { policyState: "official_runtime_url", url: "https://example.com/event.jpg", sourceLabel: "공식 공지", sourceUrl: "https://example.com/notice" }`.
- [ ] In `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`, add failing validation cases for displayable image states without `url`, without `sourceLabel`, without `sourceUrl`, with `http://`, and with object keys `bytes`, `base64`, `assetPath`, `filePath`, `localPath`.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventAdminTypes.ts`, extend `HubEventValidationReason` with `image_source_required`, `image_url_not_https`, `image_policy_state_not_allowed`, and `image_asset_fields_not_allowed`.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`, add `validateHubEventImageForAdmin(input, errors)` and call it from `validateHubEventForAdmin`.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`, make `validateHubEventImageForAdmin` reject image upload/binary/local asset keys at any nested `image` level.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`, require `url`, `sourceLabel`, and `sourceUrl` for `official_runtime_url` and `third_party_allowed`.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`, allow `none`, `verify_required`, and `blocked` without URL fields.
- [ ] Run `rtk npm test -- adminHubEventRoutes` from `backend/stellive-hub-api`; expected result: pass.
- [ ] In `backend/stellive-hub-api/prisma/schema.prisma`, add `image Json?` to the `HubEvent` model rather than separate binary or file fields.
- [ ] Run `rtk npm run prisma:generate` from `backend/stellive-hub-api`; expected result: Prisma client generation succeeds.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`, add `image: unknown | null` to `HubEventRecord`.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`, add `normalizeHubEventImage(record.image)` that returns a typed `HubEventImage` only for recognized policy states and strips unknown fields.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`, include normalized `image` in `toPublicHubEvent` and `toAdminHubEvent` via `stripUndefined`.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`, include `image` in create/update data for admin writes.
- [ ] In `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`, add a failing list/detail test that allowed image metadata is returned exactly as URL/source metadata.
- [ ] In `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`, add failing calendar and widget tests asserting no `image` key appears on `HubCalendarEntry`.
- [ ] In `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`, verify no implementation change is needed; if image leaks through spread/copy logic, replace it with explicit field mapping.
- [ ] Run `rtk npm test -- hubEventReadRoutes` from `backend/stellive-hub-api`; expected result: pass.
- [ ] In `backend/stellive-hub-api/test/mobileBootstrap.test.ts`, add a failing test that bootstrap `hubEventsSummary.preview` tolerates events with no `image` and with allowed `image`.
- [ ] Update bootstrap fixtures or mapping only if the test reveals missing serialization.
- [ ] Run `rtk npm test -- mobileBootstrap` from `backend/stellive-hub-api`; expected result: pass.
- [ ] In `backend/stellive-hub-api/test/pushPayloadFactory.test.ts`, add a failing test that a HubEvent platform event with metadata image URL produces no image URL, thumbnail URL, binary, or asset path in FCM data payload.
- [ ] In `backend/stellive-hub-api/src/push/pushPayloadFactory.ts`, keep push data explicitly allowlisted and exclude image metadata.
- [ ] Run `rtk npm test -- pushPayloadFactory` from `backend/stellive-hub-api`; expected result: pass.
- [ ] In `shared/openapi/openapi.yaml`, add `HubEventImagePolicyState` enum schema.
- [ ] In `shared/openapi/openapi.yaml`, add `HubEventImage` object schema with `policyState`, optional `url`, `sourceLabel`, `sourceUrl`, and `altText`.
- [ ] In `shared/openapi/openapi.yaml`, add optional `image` to `HubEvent`.
- [ ] In `shared/openapi/openapi.yaml`, do not add `image` to `HubCalendarEntry`, widget snapshot entries, or push payload schemas.
- [ ] Run `rtk npm run build` from `backend/stellive-hub-api`; expected result: TypeScript build passes.
- [ ] Run `rtk npm test` from `backend/stellive-hub-api`; expected result: full backend test suite passes.

## Android Implementation Steps

- [ ] In `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventImagePolicyTest.kt`, add failing tests for display eligibility of all five policy states, missing URL, invalid URL, and HTTP URL.
- [ ] In `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`, add `enum class HubEventImagePolicyState` with serialized API values.
- [ ] In `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`, add `data class HubEventImage(policyState, url, sourceLabel, sourceUrl, altText)`.
- [ ] In `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`, add `val image: HubEventImage? = null` to `HubEvent`.
- [ ] In `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/hubevents/HubEventImagePolicy.kt`, implement `fun canDisplayHubEventImage(image: HubEventImage?): Boolean`.
- [ ] Run `rtk ./gradlew test --tests dev.minepacu.stelliveeventnotifier.HubEventImagePolicyTest` from `android/StelliveHubAndroid`; expected result: pass.
- [ ] In `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubApiClientTest.kt`, add a failing JSON decode test for `HubEventDto.image` with allowed metadata and `image = null`.
- [ ] In `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`, add DTOs for image metadata and map them to `HubEventImage`.
- [ ] Run `rtk ./gradlew test --tests dev.minepacu.stelliveeventnotifier.HubApiClientTest` from `android/StelliveHubAndroid`; expected result: pass.
- [ ] In `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`, add a private `loadHubEventImage(imageView, image)` helper that uses existing OkHttp/coroutines, decodes with `BitmapFactory`, and never writes to disk.
- [ ] In `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`, update `hubEventCard` to add an `ImageView` only when `canDisplayHubEventImage(event.image)` returns true.
- [ ] In `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`, collapse/remove the `ImageView` on load failure; do not leave a blank box or error copy.
- [ ] In `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`, update detail rendering for `GOODS_EVENT_DETAIL` with the same optional image policy gate.
- [ ] In `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsPolicyTest.kt`, add assertions that text-only HubEvent cards remain the default policy and no user-facing no-image copy is introduced in policy constants.
- [ ] Run `rtk ./gradlew test` from `android/StelliveHubAndroid`; expected result: Android unit tests pass.

## iOS Implementation Steps

- [ ] In `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventImagePolicyTests.swift`, add failing tests for display eligibility of all five policy states, missing URL, invalid URL, and HTTP URL.
- [ ] In `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`, add `enum HubEventImagePolicyState: String, Codable, Hashable`.
- [ ] In `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`, add `struct HubEventImage: Codable, Hashable`.
- [ ] In `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`, add `let image: HubEventImage?` to `HubEvent` and update its initializer call sites with default `nil`.
- [ ] In `ios/StelliveHubiOS/StelliveHubiOS/Services/HubEventImagePolicy.swift`, implement `static func displayURL(for image: HubEventImage?) -> URL?`.
- [ ] Run the iOS test target for `HubEventImagePolicyTests`; expected result: pass.
- [ ] In `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`, add decode coverage for HubEvent JSON with `image = null`, missing `image`, and allowed image metadata.
- [ ] In `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`, update DTO decoding only if current direct model decoding does not already support `HubEvent.image`.
- [ ] Run the iOS test target for `HubAPIClientTests`; expected result: pass.
- [ ] In `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`, add a small optional `HubEventRemoteImage` view that wraps `AsyncImage` behind `HubEventImagePolicy.displayURL(for:)`.
- [ ] In `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`, keep existing text-first row structure when the policy returns nil or AsyncImage fails.
- [ ] In `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`, add the same optional image view above the information section.
- [ ] In `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`, keep the existing "공식 이미지, 포스터는 저장하거나 재사용하지 않습니다." copy because it reinforces policy without implying an image is missing.
- [ ] In `ios/StelliveHubiOS/StelliveHubCalendarWidget/StelliveHubCalendarWidget.swift`, verify no `HubEvent.image` reference is added; keep widget data based on `HubCalendarEntry`.
- [ ] Run the iOS app test scheme; expected result: all available iOS tests pass.

## Documentation Steps

- [ ] In `docs/HUB_EVENTS_READ_API_DESIGN.md`, document optional `HubEvent.image`, the five `policyState` values, and that calendar/widget entries omit image metadata.
- [ ] In `docs/UI_GUIDELINES.md`, document mobile display eligibility, failure fallback, and the rule against "이미지가 없습니다" copy.
- [ ] In `docs/AI_HANDOFF.md`, add implementation status, exact validation commands, and note that images are metadata-only and not part of push/widget surfaces.

## Final Verification

- [ ] Run `rtk npm run build` from `backend/stellive-hub-api`.
- [ ] Run `rtk npm test` from `backend/stellive-hub-api`.
- [ ] Run `rtk ./gradlew test` from `android/StelliveHubAndroid`.
- [ ] Run the iOS test command used by this repository or XcodeBuildMCP with the `StelliveHubiOS` scheme.
- [ ] Run `rtk git diff --stat` from the repository root.
- [ ] Run `rtk git diff --name-only` from the repository root and confirm no prohibited binary/image files were added.
- [ ] Inspect `pushPayloadFactory` diff and tests to confirm no image fields are included in push payloads.
- [ ] Inspect `HubCalendarEntry` schemas/models on TypeScript, Android, and iOS to confirm image fields were not added.
- [ ] Inspect admin HTML diff to confirm no image upload input was added.
