Implementation Plan
> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CHZZK live status visible end-to-end in Android and iOS live pages using the backend-managed official CHZZK Open API polling cache.

**Architecture:** Mobile apps must not call CHZZK directly or store CHZZK credentials. The backend internal scheduler calls CHZZK `GET /open/v1/lives` with Client-auth headers, writes normalized rows into `LiveStatus`, and public mobile endpoints expose only normalized live-status DTOs. Android and iOS should read `liveStatus` from bootstrap and also refresh `GET /v1/live-status` when the live page needs current cached state.

**Tech Stack:** TypeScript, Fastify, Prisma, Zod, Vitest, Kotlin, Retrofit, Moshi, Android Views, Swift, SwiftUI, XCTest.

## Current Assessment

Backend CHZZK polling is mostly in place:
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts` uses official Client-auth live-list polling.
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts` maps catalog `chzzkChannelId` values to `LiveStatus` writes and transition events.
- `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts` stores `title`, `viewerCount`, `startedAt`, `platformUrl`, `lastCheckedAt`, and `sourceVerificationState`.
- `backend/stellive-hub-api/src/routes/routes.ts` exposes `GET /v1/live-status` with normalized rows.

Backend mobile bootstrap has a gap:
- `backend/stellive-hub-api/src/app.ts` only installs repository-backed `BootstrapService` when `HUB_EVENTS_STORAGE_MODE=prisma`.
- The default `routes.ts` fallback bootstrap currently omits `liveStatus`.
- Remote probe on 2026-06-15 found `GET /v1/live-status` returns 11 rows, but `GET /v1/bootstrap?deviceId=diagnostic-device&platform=android` did not include a `liveStatus` key.

Android has partial consumption:
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt` defines `LiveStatusDto` with title/viewer/platform fields.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt` merges only `isLive` and `startedAt` into `HubMember`.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt` loads server bootstrap once at app start and renders live page from cached member state.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt` has no `GET v1/live-status` method.

iOS has partial consumption:
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift` defines `LiveStatusResponse` with title/viewer/platform fields.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift` applies bootstrap live status to member `isLive` and `liveStartedAt` only.
- `ios/StelliveHubiOS/StelliveHubiOS/App.swift` loads server bootstrap once at app start.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift` has no `GET /v1/live-status` method.

Conclusion:
- The system should not fetch CHZZK from mobile app requests directly. That would increase provider API calls and would violate the backend-mediated credential boundary.
- The correct flow is scheduler/API cache -> public normalized backend DTO -> Android/iOS live UI.
- The current implementation is not fully configured for live pages because bootstrap can omit `liveStatus`, live page refresh does not call `/v1/live-status`, and mobile UI drops live title/viewer/link/verification metadata.

## Files

Modify:
- `backend/stellive-hub-api/src/routes/routes.ts`
- `backend/stellive-hub-api/test/mobileBootstrap.test.ts`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiClient.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/HubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/ServerLiveStatusMappingTests.swift`

Test:
- `backend/stellive-hub-api/test/mobileBootstrap.test.ts`
- `backend/stellive-hub-api/test/liveStatus.test.ts`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOSTests/ServerLiveStatusMappingTests.swift`

## Step 1: Add Backend Failing Test For Fallback Bootstrap Live Status

- [ ] Add a test in `backend/stellive-hub-api/test/mobileBootstrap.test.ts` named `fallback bootstrap includes cached live status`.

Test setup:
- Build app with `HUB_EVENTS_STORAGE_MODE=memory`.
- Inject `appRoutes.dependencies.liveStatus.listDiagnostics`.
- Do not inject `appRoutes.dependencies.bootstrap`.
- Return one live status row:

```ts
{
  memberId: "ayatsuno-yuni",
  generationId: "gen1",
  isLive: true,
  title: "Live title",
  viewerCount: 123,
  startedAt: "2026-06-11T03:00:00.000Z",
  platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
  lastCheckedAt: "2026-06-11T03:01:00.000Z",
  sourceVerificationState: "verified"
}
```

Expected:
- `GET /v1/bootstrap?deviceId=device-1&platform=android` returns `liveStatus` array with that row.
- Response does not contain `accessToken`, `refreshToken`, `clientSecret`, `NID_AUT`, or `NID_SES`.

## Step 2: Run Backend Test To Verify Failure

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- mobileBootstrap
```

Expected:
- The new fallback bootstrap test fails because fallback bootstrap omits `liveStatus`.

## Step 3: Add Live Status To Fallback Bootstrap

- [ ] Modify `backend/stellive-hub-api/src/routes/routes.ts`.
- [ ] In fallback bootstrap, read `await liveStatusRepository.listDiagnostics(100)`.
- [ ] Map each row to mobile DTO shape and include `platform: "chzzk"`.
- [ ] Return `liveStatus` in the fallback bootstrap response.
- [ ] If repository read fails, return `liveStatus: []` instead of failing the whole bootstrap.

Expected fallback field shape:

```ts
liveStatus: persisted.map((status) => ({
  ...status,
  platform: "chzzk" as const
}))
```

## Step 4: Verify Backend Bootstrap Fix

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- mobileBootstrap liveStatus
rtk npm run build
```

Expected:
- `mobileBootstrap` passes.
- `liveStatus` passes.
- TypeScript build passes.

## Step 5: Add Android Live Status Domain Fields

- [ ] Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`.
- [ ] Add nullable live metadata fields to `HubMember`:

```kotlin
val liveTitle: String? = null,
val liveViewerCount: Int? = null,
val livePlatformUrl: String? = null,
val liveSourceVerificationState: String? = null,
val liveLastCheckedAt: Instant? = null
```

- [ ] Keep defaults null so existing mock data compiles with minimal changes.

## Step 6: Add Android Network Method For Live Status Refresh

- [ ] Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`.
- [ ] Add:

```kotlin
@GET("v1/live-status")
suspend fun liveStatus(): List<LiveStatusDto>
```

- [ ] Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiClient.kt`.
- [ ] Add:

```kotlin
suspend fun liveStatus(): HubNetworkResult<List<LiveStatusDto>> =
    runCatchingNetwork { api.liveStatus() }
```

## Step 7: Preserve Android Live Metadata In Repository

- [ ] Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`.
- [ ] Update `mergeLiveStatus` to copy all live DTO fields into `HubMember`.
- [ ] For members omitted from server `liveStatus`, keep `isLive=false` and clear live metadata.
- [ ] Add a `refreshLiveStatus(current: HubDataState): HubDataState` method that calls `remoteDataSource.liveStatus()` and merges returned rows into current state.

Expected mapping:

```kotlin
member.copy(
    isLive = status.isLive,
    liveStartedAt = status.startedAt?.let(::parseInstantOrNull),
    liveTitle = status.title,
    liveViewerCount = status.viewerCount,
    livePlatformUrl = status.platformUrl,
    liveSourceVerificationState = status.sourceVerificationState,
    liveLastCheckedAt = parseInstantOrNull(status.lastCheckedAt)
)
```

## Step 8: Add Android Tests

- [ ] Update `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt`.
- [ ] Extend existing bootstrap test to assert:
  - `yuni.liveTitle == "Live title"`
  - `yuni.liveViewerCount == 1234`
  - `yuni.livePlatformUrl == "https://chzzk.naver.com/live/chzzk-channel-id"`
  - `yuni.liveSourceVerificationState == "verified"`
  - `yuni.liveLastCheckedAt` parses.
- [ ] Add a refresh test that starts with offline state, returns one `LiveStatusDto` from `liveStatus()`, and verifies the live page state updates.

## Step 9: Render Android Live Metadata

- [ ] Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`.
- [ ] In `renderLive`, trigger a server live-status refresh when the live tab is opened.
- [ ] Keep refresh backend-only: call app backend `GET /v1/live-status`, never CHZZK hostnames.
- [ ] In `memberTextBlock`, show:
  - current live/offline text,
  - live title when present,
  - viewer count when present,
  - last checked timestamp when present,
  - CHZZK link action only when `livePlatformUrl` is HTTPS.
- [ ] If `sourceVerificationState != "verified"`, show a muted verification message rather than pretending live status is authoritative.

## Step 10: Verify Android

- [ ] Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

Expected:
- Unit tests pass.
- `ChzzkBackendBoundaryTest` still proves app code does not call CHZZK hostnames directly.

## Step 11: Add iOS Live Status Domain Fields

- [ ] Modify `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`.
- [ ] Add nullable live metadata fields to `HubMember`:

```swift
var liveTitle: String? = nil
var liveViewerCount: Int? = nil
var livePlatformUrl: String? = nil
var liveSourceVerificationState: String? = nil
var liveLastCheckedAt: Date? = nil
```

- [ ] Keep defaults nil so existing mock data compiles with minimal changes.

## Step 12: Add iOS Network Method For Live Status Refresh

- [ ] Modify `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`.
- [ ] Add:

```swift
func liveStatus() async throws -> [LiveStatusResponse] {
    try await send(URLRequest(url: baseURL.appendingPathComponent("v1/live-status")),
                   responseType: [LiveStatusResponse].self)
}
```

## Step 13: Preserve iOS Live Metadata In Store

- [ ] Modify `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`.
- [ ] Update `applyBootstrap(_:)` to map all `LiveStatusResponse` fields into `HubMember`.
- [ ] Add an `applyLiveStatus(_:)` helper used by both bootstrap and refresh.
- [ ] For omitted CHZZK members, set `isLive=false`, clear `liveStartedAt`, and clear metadata.

Expected mapping:

```swift
member.isLive = status.isLive
member.liveStartedAt = parseInstant(status.startedAt)
member.liveTitle = status.title
member.liveViewerCount = status.viewerCount
member.livePlatformUrl = status.platformUrl
member.liveSourceVerificationState = status.sourceVerificationState
member.liveLastCheckedAt = parseInstant(status.lastCheckedAt)
```

## Step 14: Add iOS Refresh Flow

- [ ] Modify `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`.
- [ ] Add:

```swift
func refreshLiveStatus() async -> MockHubStore
```

- [ ] The method calls `api.liveStatus()`, applies rows to fallback store, and returns fallback.
- [ ] On failure, keep existing state and mark `liveStatusSourceLabel` as server refresh failed.

- [ ] Modify `ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift`.
- [ ] Trigger `refreshLiveStatus()` with `.task` or a refresh button owned by the parent store.
- [ ] Render live title, viewer count, last checked, verified/verify-required state, and CHZZK link when HTTPS.

## Step 15: Add iOS Tests

- [ ] Update `ios/StelliveHubiOS/StelliveHubiOSTests/ServerLiveStatusMappingTests.swift`.
- [ ] Extend bootstrap mapping test to assert:
  - `liveTitle == "Live title"`
  - `liveViewerCount == 1234`
  - `livePlatformUrl == "https://chzzk.naver.com/live/chzzk-channel-id"`
  - `liveSourceVerificationState == "verified"`
  - `liveLastCheckedAt` parses.
- [ ] Add refresh test for `GET /v1/live-status`.
- [ ] Keep `ChzzkBackendBoundaryTests.swift` passing so no app source calls CHZZK hostnames directly.

## Step 16: Verify iOS

- [ ] Run:

```bash
cd ios/StelliveHubiOS
rtk xcodebuild test -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

Expected:
- iOS tests pass.
- CHZZK backend boundary tests pass.

## Step 17: Remote Server Verification

- [ ] Copy backend source/test changes only to `minepacu@192.168.50.9:~/StelLiveNoti`.
- [ ] Rebuild remote API container:

```bash
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && docker compose up -d --build api'
```

- [ ] Confirm scheduler:

```bash
POST /v1/internal/schedulers/chzzk/live-status
```

Expected:
- HTTP `200`
- `checked=11`
- `verifyRequired=0`
- adapter health remains `enabled/chzzk_live_api_verified`

- [ ] Confirm public app endpoints:

```bash
GET /v1/live-status
GET /v1/bootstrap?deviceId=diagnostic-device&platform=android
GET /v1/bootstrap?deviceId=diagnostic-device&platform=ios
```

Expected:
- `/v1/live-status` returns cached CHZZK live rows.
- both bootstrap responses include `liveStatus`.
- responses do not include `CHZZK_CLIENT`, `CHZZK_ACCESS`, `CHZZK_REFRESH`, `clientSecret`, `accessToken`, `refreshToken`, `NID_AUT`, or `NID_SES`.

## Step 18: Documentation Update

- [ ] Update `docs/AI_HANDOFF.md`.
- [ ] Include:
  - backend polling remains scheduler/cache based,
  - mobile apps read normalized backend DTOs only,
  - bootstrap now always includes `liveStatus`,
  - Android/iOS live pages render title/viewer/link/check freshness when present.

- [ ] Update `docs/API_SETUP.md` and `docs/API_SETUP_KO.md`.
- [ ] Include:
  - `CHZZK_LIVE_POLLING_ENABLED=true` enables scheduler-backed cache refresh,
  - app live pages depend on `/v1/live-status` and bootstrap `liveStatus`,
  - mobile apps must not call CHZZK directly.

## Step 19: Final Verification

- [ ] Run backend verification:

```bash
cd backend/stellive-hub-api
rtk npm test -- mobileBootstrap liveStatus chzzkLiveApiWiring
rtk npm run build
```

- [ ] Run Android verification:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

- [ ] Run iOS verification:

```bash
cd ios/StelliveHubiOS
rtk xcodebuild test -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

Expected:
- All targeted tests pass.
- No direct CHZZK host access appears in Android or iOS app source.
- Backend public responses expose normalized DTOs only.

## Non-Goals

- Do not make mobile apps call `openapi.chzzk.naver.com` or `chzzk.naver.com` for API data.
- Do not add login-cookie scraping, private endpoints, `NID_AUT`, or `NID_SES`.
- Do not add push delivery changes in this plan.
- Do not add profile images, official logos, captured images, or copied CDN assets.
- Do not change member catalog policy, Former member exclusion, Gangzi category, or official YouTube live exclusion.
