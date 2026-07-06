Implementation Plan
> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining CHZZK Live API wiring so the backend polls official/allowed CHZZK live status and Android/iOS live pages display backend-normalized member live data instead of mock-only state.

**Architecture:** Keep CHZZK credentials, OAuth state, token refresh, CHZZK host calls, live polling, transition detection, event persistence, and notification job enqueueing inside the TypeScript backend. Mobile apps consume only `/v1/bootstrap` and `/v1/live-status` normalized DTOs, merge those DTOs into existing member screen models, and keep mock data only as a network-failure fallback. Default flags remain disabled until OAuth token state, allowed endpoint scope, adapter health, and cache freshness are verified.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Vitest, Kotlin, Retrofit, Moshi, Coroutines, JUnit, Swift, SwiftUI, URLSession, XCTest.

Source status doc: `docs/CHZZK_LIVE_API_STATUS.md`

## Rules

- Do not add CHZZK API calls, direct CHZZK host constants, OAuth credentials, access tokens, refresh tokens, or token metadata to Android or iOS.
- Do not implement login-cookie scraping, private CHZZK endpoints, private WebSocket/session bypasses, `NID_AUT`, `NID_SES`, or HTML crawling.
- Do not include Former members in catalog, notification targets, tests, seeds, live polling, or UI filters.
- Poll only `active`/`upcoming` catalog entries whose `catalogRole` is `member` or Gangzi `representative` and whose `chzzkChannelId` is present.
- Keep `CHZZK_LIVE_POLLING_ENABLED=false` as the default.
- `chzzk_live_started` and `chzzk_live_ended` events must pass through event guards, dedupe, `PlatformEventRepository`, `NotificationJobRepository`, and notification worker preference resolution. The adapter must not send push directly.
- `chzzk_chat` remains off by default and is not part of this plan.
- `realtime_best_effort` must not bypass global off, platform/event/member settings, quiet hours, keyword filters, rate limits, OS policies, or push-service policies.
- Store normalized live status and minimal metadata only. Do not store raw provider payloads.

## Token Budget Rules

- Always prefix shell commands with `rtk`.
- Prefer `rtk rg` and `rtk rg --files` for discovery. Avoid broad recursive reads after the target files are known.
- Read only the file sections needed for the current step with `rtk proxy sed -n '<start>,<end>p' <file>` instead of dumping whole large files.
- Run focused tests first, using the command listed in the current phase. Run full backend/Android/iOS suites only at the final verification step.
- Keep command output filtered through `rtk npm test`, `rtk :app:testDebugUnitTest`, or `rtk xcodebuild test`; use raw commands only when debugging missing detail from a failing focused test.
- When updating docs, edit only the specific section affected by the implementation result. Do not regenerate existing long plans or handoff documents.
- When reporting progress, summarize the changed files, focused tests, and blockers in 3-5 bullets. Do not paste full diffs, full test logs, or raw provider responses.
- Do not read generated directories such as `dist`, `build`, `.gradle`, `DerivedData`, or `node_modules` unless a failure points there directly.

## Current State

- `backend/stellive-hub-api/src/adapters/chzzk/chzzkAuthClient.ts` exists.
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts` exists and calls `https://openapi.chzzk.naver.com/open/v1/lives/{channelId}` server-side.
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts` exists and can poll catalog CHZZK targets when injected.
- `backend/stellive-hub-api/src/routes/chzzkAuthRoutes.ts` exists.
- `backend/stellive-hub-api/src/routes/internalRoutes.ts` has `POST /v1/internal/schedulers/chzzk/live-status`, but default `buildApp()` does not assemble a real `chzzkLiveAdapter`.
- `backend/stellive-hub-api/src/mobile/bootstrapService.ts` can include `liveStatus`, but default app route dependencies are not fully wired to repository-backed bootstrap in every runtime path.
- Android DTOs include `BootstrapResponseDto.liveStatus`, but `ServerHubRepository.bootstrap()` returns `fallback.bootstrap()` after a successful server call.
- iOS DTOs include `BootstrapResponse.liveStatus`, but `ServerHubStore.bootstrap()` currently keeps the existing `MockHubStore` state.

## Files

Create:

- `backend/stellive-hub-api/src/events/chzzkEventIngestor.ts`
- `backend/stellive-hub-api/test/chzzkLiveApiWiring.test.ts`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerLiveStatusMappingTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOSTests/ServerLiveStatusMappingTests.swift`

Modify:

- `backend/stellive-hub-api/src/app.ts`
- `backend/stellive-hub-api/src/routes/routes.ts`
- `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- `backend/stellive-hub-api/src/mobile/bootstrapService.ts`
- `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts`
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
- `backend/stellive-hub-api/test/mobileBootstrap.test.ts`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/HubRepository.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- `docs/API_SETUP.md`
- `docs/AI_HANDOFF.md`

## Phase 1: Backend CHZZK Default Wiring

- [ ] Write failing app wiring tests in `backend/stellive-hub-api/test/chzzkLiveApiWiring.test.ts`.

Test cases:

- With `CHZZK_LIVE_POLLING_ENABLED=false`, `POST /v1/internal/schedulers/chzzk/live-status` returns `{ status: "disabled", reason: "chzzk_live_polling_disabled" }`.
- With `CHZZK_LIVE_POLLING_ENABLED=true` and no `PlatformApiState` access token, the route returns `{ status: "verify_required", reason: "chzzk_oauth_token_missing" }`.
- With `CHZZK_LIVE_POLLING_ENABLED=true`, token metadata present, and a mocked CHZZK fetch returning an offline response, the route returns `{ status: "ok" }` and writes one `LiveStatus` row.
- Former members and official channels are not requested from the mocked CHZZK fetch.

Run:

```bash
rtk npm test -- chzzkLiveApiWiring
```

Expected: FAIL because `buildApp()` does not provide a default `chzzkLiveAdapter`.

- [ ] Create `backend/stellive-hub-api/src/events/chzzkEventIngestor.ts`.

Implementation shape:

```ts
import type { PlatformEvent } from "../types.js";
import NotificationJobRepository from "../jobs/notificationJobRepository.js";
import PlatformEventRepository from "../repositories/platformEventRepository.js";

export default class ChzzkEventIngestor {
  constructor(
    private readonly events = new PlatformEventRepository(),
    private readonly jobs = new NotificationJobRepository()
  ) {}

  async ingest(event: PlatformEvent): Promise<{ created: boolean }> {
    const result = await this.events.createIfNotExists(event);
    if (!result.created) return { created: false };
    await this.jobs.enqueue({ eventId: event.id, priority: event.realtimeEligible ? 1 : 5 });
    return { created: true };
  }
}
```

Use the actual `PlatformEventRepository.createIfNotExists()` return shape and `NotificationJobRepository.enqueue()` input shape from the current code. Do not accept caller-supplied device filters, push payloads, or preference override flags.

- [ ] Modify `backend/stellive-hub-api/src/app.ts` to assemble the default CHZZK adapter.

Required dependencies:

- `CatalogService`
- `LiveStatusRepository`
- `PlatformApiStateRepository`
- `ChzzkAuthClient`
- `ChzzkApiClient`
- `ChzzkOpenApiAdapter`
- `ChzzkEventIngestor`

Behavior:

- Reuse one `PlatformApiStateRepository` for `ChzzkApiClient` and internal route health where practical.
- Pass `catalog`, `apiClient`, `liveStatusRepository`, and `ingestEvent: (event) => chzzkEventIngestor.ingest(event)` into `ChzzkOpenApiAdapter`.
- Preserve `options.internalRoutes?.dependencies?.chzzkLiveAdapter` override for tests.
- Keep route-level flag checks in `internalRoutes`.

- [ ] Run the focused wiring test again.

```bash
rtk npm test -- chzzkLiveApiWiring
```

Expected: PASS.

- [ ] Run existing CHZZK and internal route tests.

```bash
rtk npm test -- chzzkApiClient chzzkAuthRoutes chzzkOpenApiAdapter adminInternalRoutes liveStatus
```

Expected: PASS.

- [ ] Commit backend wiring.

```bash
rtk git add backend/stellive-hub-api/src/app.ts backend/stellive-hub-api/src/events/chzzkEventIngestor.ts backend/stellive-hub-api/test/chzzkLiveApiWiring.test.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
rtk git commit -m "feat(api): wire CHZZK live polling adapter"
```

## Phase 2: Backend Bootstrap Live Status Contract

- [ ] Add failing tests in `backend/stellive-hub-api/test/mobileBootstrap.test.ts`.

Test cases:

- Repository-backed bootstrap includes `liveStatus` from `LiveStatusRepository.listDiagnostics()`.
- `liveStatus` rows include `memberId`, `generationId`, `isLive`, `title`, `viewerCount`, `startedAt`, `platformUrl`, `lastCheckedAt`, and `sourceVerificationState`.
- Bootstrap excludes raw provider payload fields and token state.
- Bootstrap still excludes Former members from `catalog.members`.

Run:

```bash
rtk npm test -- mobileBootstrap
```

Expected: FAIL if default route dependencies still return fallback/mock live state in the tested app path.

- [ ] Modify `backend/stellive-hub-api/src/routes/routes.ts` so default app routes use repository-backed `BootstrapService` when database-backed dependencies are available.

Implementation guidance:

- Keep the existing fallback bootstrap for local/test paths that inject no repository dependencies.
- Prefer `BootstrapService` with `CatalogService`, `DeviceRepository`, `PreferenceRepository`, `LiveStatusRepository`, and `HubEventRepository` when `HUB_EVENTS_STORAGE_MODE=prisma` or when explicit app route dependencies request repository-backed behavior.
- Do not remove legacy routes until mobile tests are migrated.

- [ ] If `LiveStatusRepository.listDiagnostics()` returns admin-only fields that are not part of the mobile contract, add a mobile-safe mapper in `bootstrapService.ts`.

Allowed mobile fields:

- `memberId`
- `generationId`
- `isLive`
- `title`
- `viewerCount`
- `startedAt`
- `platformUrl`
- `lastCheckedAt`
- `sourceVerificationState`

- [ ] Run focused backend contract tests.

```bash
rtk npm test -- mobileBootstrap liveStatus
```

Expected: PASS.

- [ ] Commit backend bootstrap contract work.

```bash
rtk git add backend/stellive-hub-api/src/routes/routes.ts backend/stellive-hub-api/src/mobile/bootstrapService.ts backend/stellive-hub-api/src/repositories/liveStatusRepository.ts backend/stellive-hub-api/test/mobileBootstrap.test.ts
rtk git commit -m "feat(api): expose live status in mobile bootstrap"
```

## Phase 3: Android Live Status Mapping

- [ ] Add failing tests in `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerLiveStatusMappingTest.kt`.

Test cases:

- Given bootstrap catalog member `ayatsuno-yuni` and `liveStatus` with `isLive=true`, `ServerHubRepository.bootstrap()` returns a `HubDataState` whose matching `HubMember.isLive` is true.
- `startedAt` maps to `HubMember.liveStartedAt`.
- `platformUrl` from live status is preserved in the screen model if `HubMember` already has a field for platform URL; if the model lacks a field, preserve the existing member `chzzkChannelId` and document that deep-link URL mapping remains a separate task.
- A server member with no live status remains offline.
- On network error, repository returns `fallback.bootstrap()`.

Run:

```bash
rtk :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ServerLiveStatusMappingTest
```

Expected: FAIL because `ServerHubRepository.bootstrap()` currently returns fallback after a successful bootstrap response.

- [ ] Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt` only if any `LiveStatusDto` fields are missing.

Required fields:

- `memberId: String`
- `generationId: String`
- `isLive: Boolean`
- `title: String?`
- `viewerCount: Int?`
- `startedAt: String?`
- `platformUrl: String?`
- `lastCheckedAt: String?`
- `sourceVerificationState: String`

- [ ] Add mapper functions in `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`.

Implementation guidance:

- Convert server generations and members into existing `GenerationFilter` and `HubMember` models.
- Merge live status by `memberId`.
- Parse ISO timestamps with `Instant.parse`.
- Treat invalid/missing timestamps as `null`, not a crash.
- Preserve existing setting/history/hub-event fallback data where server DTOs do not yet cover the screen.
- Register device when bootstrap response has `device == null`, then still use the successful bootstrap response for UI data.

- [ ] Run focused Android test.

```bash
rtk :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ServerLiveStatusMappingTest
```

Expected: PASS.

- [ ] Run existing Android unit tests.

```bash
rtk :app:testDebugUnitTest
```

Expected: PASS.

- [ ] Commit Android mapping.

```bash
rtk git add android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerLiveStatusMappingTest.kt
rtk git commit -m "feat(android): map server live status into live page"
```

## Phase 4: iOS Live Status Mapping

- [ ] Add failing tests in `ios/StelliveHubiOS/StelliveHubiOSTests/ServerLiveStatusMappingTests.swift`.

Test cases:

- Given bootstrap catalog member `ayatsuno-yuni` and `liveStatus` with `isLive=true`, `ServerHubStore.bootstrap()` updates the store so the matching member is live.
- `startedAt` maps to the member live start date.
- Missing live status leaves a member offline.
- Invalid live timestamp leaves `liveStartedAt == nil`.
- API failure leaves the fallback store unchanged.

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected: FAIL because `ServerHubStore.bootstrap()` does not merge bootstrap live status into app state.

- [ ] Modify `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift` only if `LiveStatusResponse` is missing fields.

Required fields:

- `memberId`
- `generationId`
- `isLive`
- `title`
- `viewerCount`
- `startedAt`
- `platformUrl`
- `lastCheckedAt`
- `sourceVerificationState`

- [ ] Add a store update method in `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`.

Suggested shape:

```swift
@MainActor
func applyBootstrap(_ response: BootstrapResponse) {
    // Map catalog and liveStatus into existing published state.
}
```

Implementation guidance:

- Merge live status by `memberId`.
- Parse ISO timestamps with `ISO8601DateFormatter`.
- Keep fallback/mock history and hub events where server DTOs do not yet cover the full UI.
- Do not expose CHZZK credentials, OAuth state, or direct CHZZK URLs beyond normalized `platformUrl`.

- [ ] Modify `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`.

Behavior:

- On successful `api.bootstrap`, call `fallback.applyBootstrap(response)`.
- If `response.device == nil`, register device and retain the same bootstrap data for the UI.
- On thrown API error, return the unchanged fallback store.

- [ ] Run focused iOS tests.

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:StelliveHubiOSTests/ServerLiveStatusMappingTests
```

Expected: PASS.

- [ ] Run full iOS unit test target.

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected: PASS.

- [ ] Commit iOS mapping.

```bash
rtk git add ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift ios/StelliveHubiOS/StelliveHubiOSTests/ServerLiveStatusMappingTests.swift
rtk git commit -m "feat(ios): map server live status into live page"
```

## Phase 5: Operational Verification Hooks

- [ ] Update `docs/API_SETUP.md`.

Add the exact enablement sequence:

1. Register `https://<backend-public-origin>/v1/auth/chzzk/callback` and `http://localhost:4000/v1/auth/chzzk/callback` in CHZZK Developers when allowed.
2. Set backend-only `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `CHZZK_REDIRECT_URI`, `CHZZK_AUTH_STATE_SECRET`, and `INTERNAL_API_TOKEN`.
3. Set `CHZZK_OAUTH_ENABLED=true`.
4. Open `/v1/auth/chzzk/connect` from a maintainer-controlled session.
5. Confirm `PlatformApiState` contains CHZZK token metadata without logging token values.
6. Run `POST /v1/internal/schedulers/chzzk/live-status` with `INTERNAL_API_TOKEN`.
7. Confirm `/v1/live-status` and `/v1/bootstrap` include fresh live status.
8. Enable scheduled polling and set `CHZZK_LIVE_POLLING_ENABLED=true` only after adapter health is not `verify_required`.

- [ ] Update `docs/AI_HANDOFF.md`.

Record:

- Which tests passed.
- Whether OAuth setup is complete.
- Whether scheduler is enabled.
- Whether adapter health is `enabled`, `disabled`, `verify_required`, or `rate_limited`.
- Whether Android and iOS are displaying server live status or fallback mock state.

- [ ] Run final backend checks.

```bash
rtk npm run build
rtk npm test
```

Working directory: `backend/stellive-hub-api`

Expected: PASS.

- [ ] Run final Android checks.

```bash
rtk :app:testDebugUnitTest
```

Working directory: `android/StelliveHubAndroid`

Expected: PASS.

- [ ] Run final iOS checks.

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected: PASS or document the exact local simulator/toolchain failure.

- [ ] Commit docs and final verification notes.

```bash
rtk git add docs/API_SETUP.md docs/AI_HANDOFF.md docs/superpowers/plans/2026-06-14-chzzk-live-api-code-design.md
rtk git commit -m "docs: add CHZZK live API code design plan"
```

## Acceptance Criteria

- `POST /v1/internal/schedulers/chzzk/live-status` is backed by a real default `ChzzkOpenApiAdapter` in `buildApp()`.
- With polling disabled, CHZZK live collection stays disabled and creates no events.
- With OAuth token missing, CHZZK live collection returns `verify_required` and creates no events.
- With verified OAuth state and allowed endpoint response, backend updates `LiveStatus`.
- Live start/end transitions create deduped normalized `PlatformEvent` records and enqueue notification jobs without direct push sending.
- `/v1/bootstrap` includes mobile-safe live status fields.
- Android live page reflects backend `liveStatus` when bootstrap succeeds.
- iOS live page reflects backend `liveStatus` when bootstrap succeeds.
- Server failure keeps existing mock/fallback behavior on mobile.
- No mobile code contains CHZZK credentials, token keys, OAuth logic, or direct CHZZK API calls.
- Former members remain excluded from polling, bootstrap catalog, mobile filters, tests, and UI.
