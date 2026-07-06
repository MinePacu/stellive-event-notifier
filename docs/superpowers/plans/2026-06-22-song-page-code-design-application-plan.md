# Song Page Code Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement server-backed song page API communication and mobile UI integration described by the song page mockup and YouTube ingestion plan.

**Architecture:** The backend owns YouTube ingestion, normalized song persistence, filtering, and mobile-safe API DTOs. Android and iPhone apps consume `/v1/songs/facets` and `/v1/songs`, map DTOs into local models, and render with existing app title bars, card colors, background colors, and fallback behavior.

**Tech Stack:** TypeScript, Fastify, Prisma, Zod, OpenAPI, Vitest, Kotlin, Retrofit, Android views, Swift, SwiftUI, XCTest.

---

## Source Inputs

- `docs/mockups/song-page-mobile-preview.html`
- `docs/superpowers/plans/2026-06-22-youtube-song-page-ingestion-plan.md`
- `docs/superpowers/plans/2026-06-22-song-page-ui-api-communication-plan.md`
- `docs/API_IMPLEMENTATION_PLAN.md`
- `docs/PROJECT_RULES.md`
- `docs/NOTIFICATION_POLICY.md`
- `docs/REALTIME_DELIVERY.md`

## File Structure

Shared contracts:
- Modify `shared/schemas/domain.ts` for `SongType`, `SongGenerationFilterId`, `SongThumbnail`, `SongCatalogItem`, `SongFacetSummary`, and display setting types.
- Modify `shared/schemas/mobileApi.ts` for `SongListResponse`, `SongFacetsResponse`, and filter helper types.
- Modify `shared/openapi/openapi.yaml` for `GET /v1/songs` and `GET /v1/songs/facets`.

Backend:
- Modify `backend/stellive-hub-api/prisma/schema.prisma` for `Song`, `YoutubeChannelState`, and `SongClassificationOverride`.
- Create `backend/stellive-hub-api/src/repositories/songRepository.ts` for song reads, facets, pagination, upsert, and channel state.
- Create `backend/stellive-hub-api/src/songs/songClassifier.ts` for `original`, `cover`, and `unknown` classification.
- Create `backend/stellive-hub-api/src/songs/songIngestionService.ts` for normalized song persistence.
- Create `backend/stellive-hub-api/src/adapters/youtube/youtubeAtomParser.ts` for minimal WebSub Atom parsing.
- Create `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts` for bounded official API backfill and metadata recovery.
- Create `backend/stellive-hub-api/src/adapters/youtube/youtubeWebSubSubscriptionService.ts` for subscription renewal.
- Create `backend/stellive-hub-api/src/routes/songRoutes.ts` for mobile song reads.
- Create or modify `backend/stellive-hub-api/src/routes/webhookRoutes.ts` for YouTube WebSub verification/receipt.
- Modify `backend/stellive-hub-api/src/routes/routes.ts`, `backend/stellive-hub-api/src/routes/internalRoutes.ts`, `backend/stellive-hub-api/src/config/env.ts`, and `backend/stellive-hub-api/.env.example`.

Android:
- Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt` and `HubApiModels.kt` for song endpoints and DTOs.
- Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt` for song models.
- Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt` and `MockHubRepository.kt` for server mapping and fallback.
- Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt` and `MainActivity.kt` for tab policy, settings history entry, and song screen rendering.

iOS:
- Modify `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift` for song request/response structs and methods.
- Modify `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift` and `MockHubStore.swift` for server mapping and fallback.
- Modify `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift` for song models.
- Modify `ios/StelliveHubiOS/StelliveHubiOS/Views/ContentView.swift` and `SettingsView.swift`.
- Create `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`.

Docs:
- Modify `CODEMAP.md` for new files.
- Modify `docs/AI_HANDOFF.md` after implementation with status and verification.

## Token Usage Minimization Plan

- Prefix shell commands with `rtk` and prefer focused commands: `rtk rg`, `rtk fd`, `rtk sed -n`, `rtk git diff -- <path>`, and focused test targets.
- Use `CODEMAP.md` before broad traversal, then inspect only files named in this plan.
- Read narrow line ranges around symbols after initial orientation.
- Keep each implementation batch scoped to one task and one platform boundary.
- Avoid rewriting large UI files wholesale; patch only policy, mapping, and rendering sections needed for the song page.
- Add focused tests first and run only those tests until each task is green.
- Run only the tests needed for the files changed in the current batch; expand test scope only when shared contracts, route registration, app bootstrap, or model changes affect multiple consumers.
- Do not run full backend/mobile suites by default. Reserve broader suites for final pre-merge confidence or when focused tests cannot cover the touched integration boundary.
- Keep DTOs compact and shared; do not duplicate large sample payloads across tests.
- Use tiny YouTube Atom/Data API fixtures with only required fields.
- Never paste raw YouTube payloads, secrets, production tokens, or binary/image data into tests or docs.
- After each task, use `rtk git diff -- <changed-files>` to review only touched files.

## Task 1: Shared Song Contract

**Files:**
- Modify: `shared/schemas/domain.ts`
- Modify: `shared/schemas/mobileApi.ts`
- Modify: `shared/openapi/openapi.yaml`
- Test: `backend/stellive-hub-api/test/mobileSongsContract.test.ts`

- [ ] **Step 1: Write focused contract tests**

  Test `songTypeValues` equals `original`, `cover`, `unknown`, and `songGenerationFilterValues` equals `all`, `gen1`, `gen2`, `gen3` with no `gamja`, `official`, or `gen4-upcoming`.

- [ ] **Step 2: Run RED test**

  Run from `backend/stellive-hub-api`: `rtk npm test -- mobileSongsContract`.

  Expected: FAIL because song contract exports do not exist.

- [ ] **Step 3: Add shared types**

  Add compact domain and mobile API response types for song list items, thumbnails, facet counts, display settings, and paginated list responses.

- [ ] **Step 4: Update OpenAPI**

  Add `GET /v1/songs` and `GET /v1/songs/facets` using the contract in `docs/superpowers/plans/2026-06-22-song-page-ui-api-communication-plan.md`.

- [ ] **Step 5: Run contract tests and build**

  Run from `backend/stellive-hub-api`: `rtk npm test -- mobileSongsContract` and `rtk npm run build`.

  Expected: PASS.

## Task 2: Backend Song Read API Skeleton

**Files:**
- Create: `backend/stellive-hub-api/src/repositories/songRepository.ts`
- Create: `backend/stellive-hub-api/src/routes/songRoutes.ts`
- Modify: `backend/stellive-hub-api/src/routes/routes.ts`
- Test: `backend/stellive-hub-api/test/songRoutes.test.ts`

- [ ] **Step 1: Write route tests**

  Assert facets return only `all`, `gen1`, `gen2`, `gen3`; invalid generation filters return `400 unsupported_song_generation_filter`; `type=unknown` returns `400 unsupported_song_type_filter`; cache headers are `private, max-age=60` for facets and `private, max-age=30` for list.

- [ ] **Step 2: Run RED test**

  Run from `backend/stellive-hub-api`: `rtk npm test -- songRoutes`.

  Expected: FAIL because `songRoutes.ts` does not exist.

- [ ] **Step 3: Implement repository port**

  Define `listSongs(filters)` and `facets(filters)` in `songRepository.ts`; keep route handlers dependent on this port so tests can inject fixtures without YouTube calls.

- [ ] **Step 4: Implement and register routes**

  Validate query parameters, set cache headers, call the repository, and register routes from `routes.ts`.

- [ ] **Step 5: Run route tests and build**

  Run from `backend/stellive-hub-api`: `rtk npm test -- songRoutes` and `rtk npm run build`.

  Expected: PASS.

## Task 3: Backend Persistence And Ingestion Hooks

**Files:**
- Modify: `backend/stellive-hub-api/prisma/schema.prisma`
- Modify: `backend/stellive-hub-api/src/repositories/songRepository.ts`
- Create: `backend/stellive-hub-api/src/songs/songClassifier.ts`
- Create: `backend/stellive-hub-api/src/songs/songIngestionService.ts`
- Create: `backend/stellive-hub-api/src/adapters/youtube/youtubeAtomParser.ts`
- Test: `backend/stellive-hub-api/test/songRepository.test.ts`
- Test: `backend/stellive-hub-api/test/songClassifier.test.ts`
- Test: `backend/stellive-hub-api/test/youtubeAtomParser.test.ts`

- [ ] **Step 1: Write focused tests**

  Cover dedupe key `youtube:upload:<channelId>:<videoId>`, generation exclusion, original/cover/unknown classification, and minimal Atom parsing.

- [ ] **Step 2: Run RED tests**

  Run from `backend/stellive-hub-api`: `rtk npm test -- songRepository songClassifier youtubeAtomParser`.

  Expected: FAIL because storage and parser/classifier files are absent or incomplete.

- [ ] **Step 3: Add Prisma models**

  Add only fields required by the mobile API and low-load ingestion plan: YouTube identity, dedupe key, title, member/generation IDs, song type, confidence, source URL, thumbnail metadata, duration, privacy status, publish time, and timestamps.

- [ ] **Step 4: Implement parser, classifier, ingestion, and repository**

  Persist normalized song rows only. Do not store full raw YouTube payloads long term.

- [ ] **Step 5: Run tests and Prisma generation**

  Run from `backend/stellive-hub-api`: `rtk npm test -- songRepository songClassifier youtubeAtomParser`, `rtk npm run prisma:generate`, and `rtk npm run build`.

  Expected: PASS.

## Task 4: Android API Integration And UI Wiring

**Files:**
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`

- [ ] **Step 1: Write Android policy tests**

  Assert bottom tabs are `홈`, `라이브`, `노래`, `굿즈/행사`; song generation filters are `전체`, `1기생`, `2기생`, `3기생`; `감자` and `기타` are absent; title bar policy handles `songs`; history is reachable from settings.

- [ ] **Step 2: Run RED test**

  Run from `android/StelliveHubAndroid`: `rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest`.

  Expected: FAIL until policy and DTO mapping exist.

- [ ] **Step 3: Add DTOs and repository calls**

  Add Retrofit methods and DTOs for `v1/songs` and `v1/songs/facets`. Map DTOs into Android models and keep fallback behavior.

- [ ] **Step 4: Render Android song screen**

  Add `songs` navigation, keep the existing Android title bar, reuse existing colors, render video-ratio thumbnail placeholders, and move history entry into settings.

- [ ] **Step 5: Run Android test**

  Run the same focused Gradle command.

  Expected: PASS.

## Task 5: iOS API Integration And UI Wiring

**Files:**
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/ContentView.swift`
- Create: `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SettingsView.swift`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`

- [ ] **Step 1: Write iOS policy tests**

  Assert bottom tabs are `홈`, `라이브`, `노래`, `굿즈/행사`; song generation filters are `전체`, `1기생`, `2기생`, `3기생`; `감자` and `기타` are absent; existing toolbar/title-bar behavior is reused; history is reachable from settings.

- [ ] **Step 2: Run RED test**

  Run: `rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/SongUiPolicyTests`.

  Expected: FAIL until song tab and API mapping exist.

- [ ] **Step 3: Add API client and store methods**

  Add Codable response structs and `HubAPIClient.songs(...)` / `HubAPIClient.songFacets(...)`. Store latest successful server data in `ServerHubStore` and fall back to `MockHubStore` on failure.

- [ ] **Step 4: Render iOS song screen**

  Add `SongsView`, keep existing iPhone toolbar/title-bar behavior, reuse current styling/color tokens, render video-ratio thumbnail placeholders, and move history into settings.

- [ ] **Step 5: Run iOS test**

  Run the same focused XCTest command.

  Expected: PASS.

## Task 6: End-To-End Verification And Handoff

**Files:**
- Modify: `CODEMAP.md`
- Modify: `docs/AI_HANDOFF.md`

- [ ] **Step 1: Run backend verification for touched code**

  Run only the focused backend tests that correspond to changed backend files. Examples: shared contract changes run `rtk npm test -- mobileSongsContract`; song route changes run `rtk npm test -- songRoutes`; repository/classifier/parser changes run `rtk npm test -- songRepository songClassifier youtubeAtomParser`.

  Expected: PASS for the relevant focused targets. Run `rtk npm run build` only when TypeScript contracts, route registration, Prisma-generated types, or imports changed.

- [ ] **Step 2: Run mobile verification for touched code**

  Run the focused Android or iOS tests from Tasks 4 and 5 only for the platform code changed in the current batch.

  Expected: PASS for the relevant focused target, or document simulator/sandbox blockers in `docs/AI_HANDOFF.md`.

- [ ] **Step 3: Run targeted policy scan**

  Run the policy scan only across changed paths and directly related contract/catalog paths. Example from repository root: `rtk rg -n "Former|former|gamja|official_youtube_live|youtube_live|cookie|scrap|logo|base64|assetPath|filePath" <changed-paths> shared/member-catalog shared/schemas`.

  Expected: matches are policy references, explicit exclusions, or safe existing code only.

- [ ] **Step 4: Update CODEMAP and AI handoff**

  Add all new source/test/docs files to `CODEMAP.md`. Add completed status, verification commands, and unresolved blockers to `docs/AI_HANDOFF.md`.

## Self-Review

- Spec coverage: this plan connects mockup UI regions to mobile API endpoints, backend repository routes, Android/iOS mapping, fallback behavior, title bar reuse, color-token reuse, and verification.
- Placeholder scan: the plan avoids unresolved placeholder markers and names exact files, routes, filters, validation behavior, and focused commands.
- Type consistency: song type values, generation filter values, response names, and route names match the UI/API communication plan.
- Policy check: the design keeps YouTube access backend-only, excludes Former members and non-song categories from filters, avoids image binaries, and keeps official YouTube live events out of scope.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-song-page-code-design-application-plan.md`.

Recommended execution order: shared/backend contract, backend persistence and ingestion hooks, Android integration, iOS integration, final verification.
