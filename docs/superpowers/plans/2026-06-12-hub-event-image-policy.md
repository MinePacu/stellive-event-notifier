Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a safe HubEvent image URL policy so goods/event screens can optionally display allowed runtime images while treating missing, blocked, unverified, or failed images as normal text-first layouts.

**Architecture:** Keep image authority on the backend/shared contract, not in platform-specific UI heuristics. Store and return only URL and source policy metadata; never store image binaries, official logos, fan art, screenshots, copied CDN assets, or raw private platform payloads. Android, iOS, calendar, widgets, and push must render without image dependency and may show an image only when `policyState` and URL validation allow it.

**Tech Stack:** TypeScript shared schemas, Fastify backend, OpenAPI, Android Kotlin, SwiftUI, WidgetKit, Vitest, Android unit tests, Xcode/Swift tests where available.

## Sources

- GitHub issue #19: `[mobile][policy] 굿즈/이벤트 이미지 URL 표시 정책과 이미지 없는 레이아웃 구현`
- GitHub URL: https://github.com/MinePacu/stellive-event-notifier/issues/19
- GitLab work item #13: `[mobile][policy] 굿즈/이벤트 이미지 URL 표시 정책과 이미지 없는 레이아웃 구현`
- GitLab URL: https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/13
- Verification: GitHub issue body and GitLab work item description SHA-256 are identical: `5e2a1f54111d1d3738e734985fc07cfbde8f8b83e9978e44ee8c6c53369e364d`.

## Requirements From Issues

- HubEvent may have no image, and that must be a first-class normal state.
- If an image exists, this project must not store or redistribute the image binary.
- The backend may store only image URL and source metadata when the URL is hosted by the original rights holder, an official source, or an explicitly allowed third party.
- Define HubEvent image metadata with `policyState`: `none`, `official_runtime_url`, `third_party_allowed`, `verify_required`, `blocked`.
- Mobile may display images only when `policyState` is `official_runtime_url` or `third_party_allowed` and the URL is valid.
- For missing images, `blocked`, `verify_required`, and load failure, mobile must use an intentional image-free card/detail layout.
- Calendar, widget, and push surfaces must not depend on images.
- UI must not show unnecessary copy such as "이미지가 없습니다".
- Server and repository must not store image binaries, official logos, fan art, captured images, or copied CDN assets.

## Policy Decisions

- `none`: no image was supplied or no image is needed. UI renders text-first layout.
- `official_runtime_url`: runtime URL from an official or original source. UI may attempt remote display with normal loading/error fallback.
- `third_party_allowed`: runtime URL from a third-party source with explicit permission or acceptable rights posture. UI may attempt remote display with normal loading/error fallback.
- `verify_required`: image URL/source exists but is not verified. UI must not render the image.
- `blocked`: image URL/source is known disallowed by project policy, platform terms, or rights risk. UI must not render the image.
- Image metadata is optional and omitted from push payloads unless a future provider requires a non-displayed trace field. The default is no image in push.
- Do not add image upload inputs to the admin console in this feature.

## Files

Create:

- `docs/superpowers/plans/2026-06-12-hub-event-image-policy.md`

Modify:

- `shared/schemas/domain.ts`: add HubEvent image metadata types and optional `image` field on `HubEvent`.
- `shared/schemas/mobileApi.ts`: re-export or include the updated HubEvent image contract through existing DTOs.
- `shared/openapi/openapi.yaml`: document `HubEventImage`, `HubEventImagePolicyState`, and optional `HubEvent.image`.
- `backend/stellive-hub-api/src/hub-events/hubEventAdminTypes.ts`: add admin validation types for optional image URL and policy metadata.
- `backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts`: validate and persist only URL/source metadata.
- `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`: map image metadata for memory and Prisma-backed storage modes.
- `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts`: return image metadata in list/detail responses only when stored policy permits it.
- `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`: add metadata-only image URL policy controls if admin editing is in scope for this task; do not add uploads.
- `backend/stellive-hub-api/prisma/schema.prisma`: add nullable metadata fields if Prisma storage is active for HubEvent.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`: add image metadata model and policy enum.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`: add DTO parsing for image metadata.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/hub/MainActivity.kt`: render text-first HubEvent cards/details and optional allowed image display.
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`: add image metadata model and policy enum.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`: decode optional image metadata.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`: render image-free rows as normal layout and optional allowed image display.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`: render image-free detail as normal layout and optional allowed image display.
- `ios/StelliveHubiOS/StelliveHubCalendarWidget/StelliveHubCalendarWidget.swift`: verify widget layout ignores images.
- `docs/HUB_EVENTS_READ_API_DESIGN.md`: update API contract with optional image metadata and image-free behavior.
- `docs/UI_GUIDELINES.md`: add mobile image policy and no-empty-image-copy rule.
- `docs/AI_HANDOFF.md`: update handoff status after implementation.

Test:

- `backend/stellive-hub-api/test/hubEvents.test.ts`: shared HubEvent image metadata shape and forbidden binary cases.
- `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`: admin accepts metadata-only URL and rejects unsafe policy/source combinations.
- `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`: list/detail/calendar/widget responses tolerate absent image metadata and expose allowed metadata consistently.
- `backend/stellive-hub-api/test/mobileBootstrap.test.ts`: bootstrap summary remains valid with and without image metadata.
- `android/StelliveHubAndroid/app/src/test/...`: model parsing and UI policy tests for allowed, missing, blocked, verify-required, and load-failure paths.
- `ios/StelliveHubiOS/StelliveHubiOSTests/...`: model decoding and view policy tests where the current test target supports them.

## Implementation Steps

- [ ] Add a failing shared schema test that constructs a `HubEvent` with no `image` and verifies existing required fields still compile.
- [ ] Add a failing shared schema test that constructs `HubEvent.image.policyState = "official_runtime_url"` with `url`, `sourceLabel`, and `sourceUrl`.
- [ ] Add a failing shared schema test that rejects or type-checks against image binary fields such as `bytes`, `base64`, `assetPath`, or local copied file references.
- [ ] Update `shared/schemas/domain.ts` with `HubEventImagePolicyState` and `HubEventImage` types.
- [ ] Add `image?: HubEventImage` to `HubEvent` in `shared/schemas/domain.ts`.
- [ ] Run `rtk npm test -- hubEvents` from `backend/stellive-hub-api` and verify the new shared contract tests pass.
- [ ] Update `shared/openapi/openapi.yaml` with `HubEventImagePolicyState`, `HubEventImage`, and optional `HubEvent.image`.
- [ ] Add OpenAPI examples for no image, allowed official runtime URL, and verify-required URL.
- [ ] Add a backend read-route test proving `GET /v1/hub-events` succeeds when all events omit `image`.
- [ ] Add a backend read-route test proving `GET /v1/hub-events/:id` returns allowed image metadata without binary data.
- [ ] Add a backend read-route test proving calendar response entries do not require or expose image metadata.
- [ ] Add a backend read-route test proving widget snapshot response entries do not require or expose image metadata.
- [ ] Update backend HubEvent fixtures to include one no-image event and one allowed runtime image URL event.
- [ ] Update `hubEventReadRoutes` or underlying mappers only as needed to pass the read-route tests.
- [ ] Run `rtk npm test -- hubEventReadRoutes` from `backend/stellive-hub-api`.
- [ ] Add admin validation tests for `none`, `official_runtime_url`, `third_party_allowed`, `verify_required`, and `blocked`.
- [ ] Add admin validation tests that reject image upload/file fields, copied local paths, and missing source metadata when a displayable URL is supplied.
- [ ] Update `hubEventAdminTypes.ts` and `hubEventAdminService.ts` with metadata-only validation.
- [ ] If Prisma HubEvent storage is active, add nullable metadata columns or JSON metadata in `prisma/schema.prisma`; otherwise document that the current memory mode stores the same normalized shape.
- [ ] Update `hubEventRepository.ts` mappings so storage mode does not change API image behavior.
- [ ] Run `rtk npm test -- adminHubEventRoutes` from `backend/stellive-hub-api`.
- [ ] Add push payload tests proving HubEvent push payloads do not include image URL or binary fields.
- [ ] Confirm `pushPayloadFactory` keeps payloads limited to normalized event IDs, event type, generation/member IDs, tap action, deep link, and source URL.
- [ ] Run `rtk npm test -- pushPayloadFactory` from `backend/stellive-hub-api`.
- [ ] Add Android model tests for decoding `image = null`, `policyState = official_runtime_url`, `policyState = third_party_allowed`, `policyState = verify_required`, and `policyState = blocked`.
- [ ] Add Android UI policy helpers that return `true` for image display only for `official_runtime_url` and `third_party_allowed` with a valid URL.
- [ ] Update Android HubEvent list/detail rendering so no-image states use the normal text-first layout without "이미지가 없습니다".
- [ ] Add Android load-failure fallback behavior that removes the image slot or collapses to the text-first layout rather than leaving a broken box.
- [ ] Run the relevant Android unit tests with `rtk ./gradlew test` from `android/StelliveHubAndroid`.
- [ ] Add iOS model decoding tests for no image and all five policy states.
- [ ] Add iOS view policy helpers that return image display eligibility only for `official_runtime_url` and `third_party_allowed` with a valid URL.
- [ ] Update `HubEventsView.swift` so rows use text-first layout by default and optional remote image display only for eligible metadata.
- [ ] Update `HubEventDetailView.swift` so details use text-first layout by default and optional remote image display only for eligible metadata.
- [ ] Verify WidgetKit snapshot rendering ignores image metadata and does not regress when image metadata is absent.
- [ ] Run the relevant iOS test target with XcodeBuildMCP or `xcodebuild` according to the repo's existing iOS workflow.
- [ ] Update `docs/HUB_EVENTS_READ_API_DESIGN.md` with the image metadata response contract and calendar/widget non-dependency rule.
- [ ] Update `docs/UI_GUIDELINES.md` with allowed image states, fallback layout rules, and the no "이미지가 없습니다" copy rule.
- [ ] Update `docs/AI_HANDOFF.md` with implementation status, test results, and any storage-mode caveats.
- [ ] Run backend build and full tests: `rtk npm run build` and `rtk npm test` from `backend/stellive-hub-api`.
- [ ] Run Android tests after model/UI changes: `rtk ./gradlew test` from `android/StelliveHubAndroid`.
- [ ] Run iOS build/tests for touched targets and record the exact command/output summary in `docs/AI_HANDOFF.md`.
- [ ] Review final diff to confirm no image binaries, official logos, fan art, screenshots, copied CDN assets, API secrets, production tokens, or prohibited Former member data were added.

## Acceptance Criteria

- HubEvent list, detail, calendar, widget, and bootstrap surfaces work when `image` is absent.
- Mobile list/detail surfaces can show allowed image URLs only for `official_runtime_url` and `third_party_allowed`.
- `none`, `verify_required`, `blocked`, invalid URL, and image load failure render intentional text-first layouts.
- UI does not display "이미지가 없습니다" or equivalent unnecessary empty-image text.
- Calendar, widget, and push behavior does not depend on images.
- Backend and storage contain only URL/source metadata and never image binaries or copied assets.
- OpenAPI, shared TypeScript types, Android models, and iOS models agree on the same five `policyState` values.
- Tests cover absent image, allowed image, blocked image, verify-required image, load failure fallback, and push/widget non-dependency.

## Non-Goals

- No image uploads.
- No server-side image proxying, resizing, cropping, optimization, or CDN redistribution.
- No committing profile images, official logos, fan art, captured images, copied media, or generated screenshots.
- No automatic rights verification workflow beyond explicit `policyState` metadata.
- No change to notification preference resolution, realtime delivery, or HubEvent notification job semantics.

## Risk Notes

- Remote image URLs can change availability or terms. Treat load failure as normal and avoid caching image binaries.
- `third_party_allowed` requires clear provenance. If provenance is unclear, store `verify_required` or `blocked`.
- Admin UI controls must avoid encouraging uploads or asset copying.
- Mobile image display must not make calendar/widget/push regress on constrained layouts or network failure.
