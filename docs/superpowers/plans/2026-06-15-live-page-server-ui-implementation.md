# Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
>
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the mobile Live page to server-mediated CHZZK live status data and implement the UI improvements proven in `docs/mockups/live-page-mobile-preview.html`.

**Architecture:** Keep the server-mediated/API-first boundary: Android and iOS consume backend DTOs from `/v1/bootstrap` and must not call CHZZK directly or store CHZZK credentials. The backend already exposes `BootstrapResponse.liveStatus: LiveStatus[]`; mobile models should preserve `title`, `viewerCount`, `startedAt`, `platformUrl`, and `lastCheckedAt`, then render those fields in platform-native live cards. UI should match the mockup structure: summary card, `방송 중 / 전체 / 오프라인` segments, live cards with title below generation text, right-side `LIVE` + elapsed time + viewer count, and no per-card verification timestamp.

**Tech Stack:** TypeScript/Fastify/Prisma/Zod backend, shared TypeScript schemas, Kotlin Android native views, SwiftUI iOS, JUnit/Kotlin tests, XCTest.

## Current Findings

- `shared/schemas/domain.ts` already defines `LiveStatus` with `memberId`, `generationId`, `platform`, `isLive`, `title`, `viewerCount`, `startedAt`, `platformUrl`, `lastCheckedAt`, and `sourceVerificationState`.
- `backend/stellive-hub-api/src/app.ts` builds `/v1/bootstrap` through `BootstrapService` and maps `LiveStatusRepository.listDiagnostics(50)` into mobile live status entries.
- `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts` persists and selects `title`, `viewerCount`, `startedAt`, `platformUrl`, `lastCheckedAt`, and `sourceVerificationState`.
- Android `ServerHubRepository.mergeLiveStatus` currently merges server live status into member state, but UI/model handling is centered on `isLive` and `liveStartedAt`.
- iOS `HubAPIClient.LiveStatusResponse` already decodes `title`, `viewerCount`, `startedAt`, `platformUrl`, and `lastCheckedAt`, but `MockHubStore.applyBootstrap` currently applies mainly `isLive` and `liveStartedAt`.
- `docs/mockups/live-page-mobile-preview.html` is the visual source for the target Live page layout.

## Files

Create:

- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/LivePageServerUiPolicyTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOSTests/LivePageServerModelTests.swift`

Modify:

- `shared/schemas/domain.ts`
- `shared/schemas/mobileApi.ts`
- `backend/stellive-hub-api/src/app.ts`
- `backend/stellive-hub-api/test/appRoutes.test.ts`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiClient.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift`
- `docs/mockups/live-page-mobile-preview.html` only if implementation feedback reveals the mockup needs another correction.

## Data Contract

Mobile Live page must use this normalized shape:

```ts
interface LiveStatus {
  memberId: string;
  generationId: string;
  platform: "chzzk";
  isLive: boolean;
  title?: string;
  viewerCount?: number;
  startedAt?: string;
  platformUrl?: string;
  lastCheckedAt: string;
  sourceVerificationState?: string;
}
```

Rules:

- `title` is shown only for live members and falls back to `방송 제목 확인 중` when missing.
- `startedAt` drives elapsed time. If missing while `isLive=true`, show `방송 중`.
- `viewerCount` is formatted with grouping separators. If missing while `isLive=true`, hide the viewer metric instead of showing `0`.
- `platformUrl` is used for `CHZZK 열기` / `CHZZK에서 보기`; if missing, hide the action.
- `lastCheckedAt` can be used for list-level source freshness, but not inside each live card.
- `sourceVerificationState` remains backend/admin diagnostic data and should not be shown on user live cards.

## UI Target

Based on `docs/mockups/live-page-mobile-preview.html`:

- Header title is hidden at the initial top position on Android and iOS. It appears only in scrolled/collapsed state.
- Summary card uses the same metric basis on both platforms:
  - `3` / `라이브`
  - `11` / `CHZZK 대상`
  - `8` / `오프라인`
- Segments use the same labels and meaning on both platforms:
  - `방송 중`
  - `전체`
  - `오프라인`
- Live card layout:
  - avatar left
  - member name and generation text beside avatar
  - broadcast title directly below generation text with a small gap
  - right-side status stack: `LIVE`, elapsed time icon + `1:23:00`, viewer icon + `1,234`
  - action chip below title: `CHZZK 열기` on Android, `CHZZK에서 보기` on iOS
- Live cards must not show `검증됨`, `마지막 확인`, raw checked timestamps, or source verification labels.
- Offline member cards can keep a short offline note, but should not show live title/viewer metrics.

## Step 1: Lock Backend Bootstrap Contract

- [ ] Add or update a backend route test in `backend/stellive-hub-api/test/appRoutes.test.ts` that builds a bootstrap response containing one live CHZZK member with:
  - `title: "유니랑 밤 산책 게임하고 노래 조금"`
  - `viewerCount: 1234`
  - `startedAt: "2026-06-15T02:40:00.000Z"`
  - `platformUrl: "https://chzzk.naver.com/live/example"`
  - `lastCheckedAt: "2026-06-15T11:03:21.000Z"`
- [ ] Assert `/v1/bootstrap` includes these fields under `liveStatus[]`.
- [ ] Run `rtk npm test -- appRoutes` from `backend/stellive-hub-api`.
- [ ] If the test fails because bootstrap mapping drops a field, update `backend/stellive-hub-api/src/app.ts` or `BootstrapService` mapping without changing CHZZK adapter boundaries.
- [ ] Re-run `rtk npm test -- appRoutes`.

## Step 2: Preserve Live Fields In Android Models

- [ ] Extend `HubMember` in `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt` with:
  - `liveTitle: String? = null`
  - `liveViewerCount: Int? = null`
  - `livePlatformUrl: String? = null`
  - `liveLastCheckedAt: Instant? = null`
- [ ] Verify `LiveStatusDto` in Android network models decodes `title`, `viewerCount`, `startedAt`, `platformUrl`, and `lastCheckedAt`.
- [ ] Update `ServerHubRepository.mergeLiveStatus` so matched members copy all live fields into `HubMember`.
- [ ] Ensure unmatched CHZZK targets are marked offline and clear `liveTitle`, `liveViewerCount`, `liveStartedAt`, `livePlatformUrl`, and `liveLastCheckedAt`.
- [ ] Add `LivePageServerUiPolicyTest.kt` coverage for merge behavior:
  - live server row populates title, viewer count, started time, and platform URL
  - missing server row clears live-specific fields
- [ ] Run `rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.LivePageServerUiPolicyTest` from `android/StelliveHubAndroid`.

## Step 3: Add Android UI Formatters

- [ ] In `MainUiPolicy.kt`, add pure formatters:
  - `liveElapsedClockText(startedAt: Instant?, now: Instant): String?`
  - `viewerCountText(viewerCount: Int?): String?`
  - `liveTitleText(title: String?): String`
- [ ] Format elapsed time as `H:MM:SS` when the stream has been live for one hour or more, and `0:MM:SS` when under one hour.
- [ ] Format viewer count using Korean locale grouping, e.g. `1,234`.
- [ ] Add unit tests in `LivePageServerUiPolicyTest.kt` for:
  - `1:23:00`
  - `0:18:00`
  - `1,234`
  - missing title fallback
  - missing viewer count hidden state
- [ ] Run `rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.LivePageServerUiPolicyTest`.

## Step 4: Implement Android Live Card UI

- [ ] Update `MainActivity.liveMemberRow` and `liveMemberTextBlock` so the card matches the mockup structure:
  - member name
  - generation/group line
  - broadcast title directly below generation line
  - right-side vertical status area with `LIVE`, elapsed icon/text, viewer icon/text
  - no `검증됨` or per-card checked timestamp
- [ ] Add `CHZZK 열기` action only when `member.livePlatformUrl` is non-null and valid.
- [ ] Update Android segment labels to `방송 중`, `전체`, `오프라인`.
- [ ] Hide the Android top bar title in the initial Live page state and show it only when the page is scrolled/collapsed.
- [ ] Run `rtk ./gradlew :app:testDebugUnitTest`.
- [ ] Run `rtk ./gradlew :app:assembleDebug` to catch resource and compile issues.

## Step 5: Preserve Live Fields In iOS Models

- [ ] Extend `HubMember` in `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift` with:
  - `liveTitle: String?`
  - `liveViewerCount: Int?`
  - `livePlatformURL: URL?`
  - `liveLastCheckedAt: Date?`
- [ ] Confirm `LiveStatusResponse` in `HubAPIClient.swift` already decodes `title`, `viewerCount`, `startedAt`, `platformUrl`, and `lastCheckedAt`.
- [ ] Update `MockHubStore.applyBootstrap` to copy decoded title, viewer count, platform URL, and checked time into matched `HubMember` values.
- [ ] Clear those live-only fields for unmatched CHZZK target members.
- [ ] Add `LivePageServerModelTests.swift` for:
  - live bootstrap row populates all live display fields
  - offline/missing bootstrap row clears stale display fields
- [ ] Run iOS tests through XcodeBuildMCP or `xcodebuild test` using the existing iOS project scheme.

## Step 6: Add iOS UI Formatters

- [ ] In `HubModels.swift` or a small view-local formatter type, add:
  - `LiveStatusFormatter.elapsedClockText(startedAt:now:)`
  - `LiveStatusFormatter.viewerCountText(_:)`
  - `LiveStatusFormatter.liveTitleText(_:)`
- [ ] Match Android formatting exactly:
  - elapsed: `1:23:00`, `0:18:00`
  - viewers: `1,234`
  - missing title: `방송 제목 확인 중`
- [ ] Add XCTest coverage for the same formatter cases as Android.
- [ ] Run the iOS test target.

## Step 7: Implement iOS Live Card UI

- [ ] Update `ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift`:
  - summary card labels and values match Android
  - segmented filter labels are `방송 중`, `전체`, `오프라인`
  - live card places title below generation text
  - right-side status stack shows `LIVE`, elapsed icon/text, viewer icon/text
  - no `검증됨`, `마지막 확인`, raw checked timestamp, or source verification label appears in each live card
- [ ] Use `Link` or button action for `CHZZK에서 보기` only when `livePlatformURL` exists.
- [ ] Hide the navigation title in the initial top state and show it in scrolled/collapsed state.
- [ ] Run iOS tests.
- [ ] Build the iOS app with the configured scheme.

## Step 8: Refresh Mock And Contract Documentation

- [ ] Update `docs/mockups/live-page-mobile-preview.html` only if implementation reveals a mismatch that should become the source of truth.
- [ ] Update `docs/CHZZK_LIVE_API_STATUS.md` with a short note that mobile Live pages consume `/v1/bootstrap.liveStatus` and render `title`, `startedAt`, `viewerCount`, and `platformUrl`.
- [ ] If OpenAPI currently omits the mobile live fields, update `shared/openapi/openapi.yaml` to document them.
- [ ] Run `rtk grep -n "검증됨\\|마지막 확인" android/StelliveHubAndroid/app/src/main ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift docs/mockups/live-page-mobile-preview.html` and confirm matches are not inside live cards.

## Step 9: End-To-End Validation

- [ ] Start or deploy the backend test server using the project’s internal backend server process when server-backed validation is needed.
- [ ] Call `POST /v1/internal/schedulers/chzzk/live-status` with `INTERNAL_API_TOKEN` on the test server to refresh stored live status.
- [ ] Call `GET /v1/bootstrap?platform=android` and confirm at least one live entry includes `title`, `viewerCount`, `startedAt`, and `platformUrl`.
- [ ] Call `GET /v1/bootstrap?platform=ios` and confirm the same live fields.
- [ ] Launch Android against the backend base URL and verify the Live page shows broadcast title, elapsed time, viewer count, and CHZZK action.
- [ ] Launch iOS against the backend base URL and verify the same display.
- [ ] Confirm neither app calls CHZZK directly by running the existing backend-boundary tests:
  - Android: `rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ChzzkBackendBoundaryTest`
  - iOS: run `ChzzkBackendBoundaryTests` in the iOS test target.

## Acceptance Criteria

- `/v1/bootstrap.liveStatus[]` exposes the live display fields required by both apps.
- Android and iOS render the same Live page information:
  - broadcast title
  - elapsed live time
  - viewer count
  - platform action
  - summary counts
  - `방송 중 / 전체 / 오프라인` filter semantics
- Live cards do not expose diagnostic verification text or raw checked timestamps.
- Android and iOS do not call CHZZK directly.
- Former members are not introduced into seeds, filters, tests, or UI.
- No secrets, profile image binaries, official logos, fan art, screenshots, or copied media assets are committed.
