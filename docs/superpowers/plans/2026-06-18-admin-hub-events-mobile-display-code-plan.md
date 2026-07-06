Implementation Plan
> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서버 어드민 콘솔에서 게시한 `굿즈/행사`를 Android와 iOS 앱의 목록, 캘린더, 상세 화면에서 공개 HubEvent API로 조회하고 표시한다.

**Architecture:** 백엔드는 Prisma-backed `HubEventRepository`를 공개 읽기 source of truth로 사용하고, 모바일 앱은 `/v1/hub-events`, `/v1/hub-events/:id`, `/v1/hub-events/calendar`만 소비한다. Android/iOS는 서버 성공 데이터를 메모리 캐시에 반영하고, 실패 시 기존 목업/마지막 성공 캐시로 fallback한다. 모바일 앱은 행사 생성/수정/삭제, 외부 플랫폼 API 호출, 알림 preference 우회, provider raw payload 처리를 하지 않는다.

**Tech Stack:** TypeScript, Fastify, Prisma, Zod/OpenAPI, Vitest, Kotlin, Retrofit, Android unit tests, Swift, SwiftUI, URLSession, XCTest.

## Source Documents

- 기능 구성: `docs/ADMIN_HUB_EVENTS_MOBILE_DISPLAY_DESIGN.md`
- 공개 읽기 API 설계: `docs/HUB_EVENTS_READ_API_DESIGN.md`
- API 구현 원칙: `docs/API_IMPLEMENTATION_PLAN.md`
- 프로젝트 규칙: `docs/PROJECT_RULES.md`
- 알림 정책: `docs/NOTIFICATION_POLICY.md`
- 기존 모바일 캘린더 UI 계획: `docs/superpowers/plans/2026-06-13-goods-events-calendar-confirmed-ui-code-design.md`
- handoff: `docs/AI_HANDOFF.md`

## Current-Code Findings

- `backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts`는 어드민 CRUD와 publish/cancel/deactivate/delete 라우트를 제공한다.
- `backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts`는 publish/cancel 시 notification candidate를 만들지만, 모바일 표시는 공개 read API가 담당해야 한다.
- `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts`는 목록, 상세, 캘린더, 위젯 스냅샷 공개 경로를 등록한다.
- `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`는 `publicationState = "published"`와 `deletedAt = null` 공개 조회를 제공한다.
- `backend/stellive-hub-api/src/config/env.ts`의 `HUB_EVENTS_STORAGE_MODE` 기본값은 `memory`다. 어드민 DB 데이터 노출에는 `prisma` 모드가 필요하다.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`는 bootstrap/preferences/device API만 있고 공개 HubEvent 목록/상세/캘린더 호출이 없다.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/HubRepository.kt`는 `bootstrap()` 중심이라 HubEvent read contract가 부족하다.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`는 굿즈/행사 목록과 상세를 repository의 목업 `hubEvents`/`calendarDaysForFilter`에 의존한다.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`는 `hubEventsCalendar(from:to:timezone:)`를 이미 가진다.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`는 bootstrap만 적용하고 calendar/list/detail 공개 API 결과를 store state로 연결하지 않는다.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`와 `HubEventDetailView.swift`는 서버 상세 로딩 container가 필요하다.

## Files

Create:

- `docs/ADMIN_HUB_EVENTS_MOBILE_DISPLAY_DESIGN.md`
- `docs/superpowers/plans/2026-06-18-admin-hub-events-mobile-display-code-plan.md`

Modify:

- `backend/stellive-hub-api/src/app.ts`
- `backend/stellive-hub-api/src/routes/routes.ts`
- `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventService.ts`
- `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`
- `backend/stellive-hub-api/test/hubEventAdminRoutes.test.ts`
- `shared/openapi/openapi.yaml`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/HubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarView.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`

Test:

- `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`
- `backend/stellive-hub-api/test/hubEventAdminRoutes.test.ts`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubApiClientTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsCalendarViewModelTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubCalendarDeepLinkPolicyTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/ServerHubStoreTests.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`

## Token-Minimized Work Strategy

- [ ] Start every shell command with `rtk`.
- [ ] Use `CODEMAP.md` first to identify candidate files.
- [ ] Use `rtk rg -n "HubEvent|HubCalendar|hub-events|ServerHubRepository|HubAPIClient|HubEventDetail"` before reading files.
- [ ] Read narrow line windows with `rtk proxy sed -n 'start,endp' <file>` after locating symbols.
- [ ] Prefer focused tests before full suites.
- [ ] Keep backend, Android, and iOS edits in separate patches and commits so diffs stay small.
- [ ] Reuse existing `HubEvent`, `HubCalendarEntry`, and image policy models instead of introducing duplicate DTO families.
- [ ] Do not paste large API responses into logs or docs; keep examples minimal and schema-shaped.

## Step 1: Verify Backend Public Read Path

- [ ] Inspect route registration:

```bash
rtk rg -n "registerHubEventReadRoutes|HUB_EVENTS_STORAGE_MODE|HubEventRepository|HubEventService" backend/stellive-hub-api/src
```

Expected: public routes are registered and storage mode selects memory or Prisma repository.

- [ ] Add or extend backend tests proving a Prisma-backed published admin event is readable through public list/detail/calendar routes.

Test behavior:

- create or fake repository event with `publicationState = "published"` and `deletedAt = null`
- `GET /v1/hub-events` returns the event
- `GET /v1/hub-events/:id` returns the event
- `GET /v1/hub-events/calendar` includes an entry with matching `eventId`
- draft events are absent
- soft-deleted events are absent

- [ ] Run focused backend tests:

```bash
rtk npm --prefix backend/stellive-hub-api test -- hubEventReadRoutes hubEventAdmin
```

Expected: public read tests pass without network access.

## Step 2: Lock OpenAPI Contract

- [ ] Inspect current HubEvent path schemas:

```bash
rtk rg -n "/v1/hub-events|HubEventListResponse|HubCalendarResponse|HubCalendarEntry" shared/openapi/openapi.yaml shared/schemas/domain.ts
```

- [ ] Ensure OpenAPI includes:

```text
GET /v1/hub-events
GET /v1/hub-events/{id}
GET /v1/hub-events/calendar
HubEvent.image optional metadata
HubCalendarEntry.eventId
HubCalendarEntry.entryKind
HubCalendarEntry.appDeepLink
HubCalendarEntry.platformUrl
404 hub_event_not_found for detail
```

- [ ] Confirm excluded fields are absent from public schemas:

```text
rawPayload
providerResponse
bytes
base64
assetPath
filePath
localPath
logoUrl
posterUrl
profileImageUrl
```

- [ ] Run backend build:

```bash
rtk npm --prefix backend/stellive-hub-api run build
```

Expected: TypeScript build passes.

## Step 3: Android API DTOs

- [ ] Add public API methods to `HubApi.kt`:

```kotlin
@GET("v1/hub-events")
suspend fun hubEvents(
    @Query("category") category: String? = null,
    @Query("participationMode") participationMode: String? = null,
    @Query("status") status: String? = null,
    @Query("generationId") generationId: String? = null,
    @Query("memberId") memberId: String? = null,
    @Query("from") from: String? = null,
    @Query("to") to: String? = null,
    @Query("limit") limit: Int? = null,
): HubEventsListResponseDto

@GET("v1/hub-events/{id}")
suspend fun hubEvent(@Path("id") id: String): HubEventDto

@GET("v1/hub-events/calendar")
suspend fun hubEventsCalendar(
    @Query("from") from: String,
    @Query("to") to: String,
    @Query("timezone") timezone: String,
): HubCalendarResponseDto
```

- [ ] Add DTOs/mappers in `HubApiModels.kt` only for missing fields.

Required mapper behavior:

- unknown enum values fall back to a safe display default or fail the network result cleanly
- optional `image` is accepted
- calendar special-day entries do not become HubEvent detail objects
- `platformUrl` and `appDeepLink` remain nullable-safe where the API allows them

- [ ] Add `HubApiClientTest` coverage for list, detail, calendar URL paths and JSON mapping.

- [ ] Run focused Android API tests:

```bash
rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubApiClientTest
```

Expected: API URL and DTO mapping tests pass.

## Step 4: Android Repository State

- [ ] Extend `HubRepository` with read methods:

```kotlin
suspend fun hubEvents(filterId: String = "all"): List<HubEvent>
suspend fun hubEventDetail(id: String): HubEvent?
suspend fun hubCalendarDays(from: LocalDate, to: LocalDate, timezone: String): List<HubCalendarDay>
```

- [ ] Implement `ServerHubRepository`:

```text
hubEvents() calls GET /v1/hub-events and caches returned events by id
hubEventDetail(id) returns cache immediately when available, then refreshes from GET /v1/hub-events/:id
hubCalendarDays(from,to,timezone) calls GET /v1/hub-events/calendar
network failure returns fallback data only when there is no last-success cache
404 detail returns null and does not synthesize a fake event
```

- [ ] Keep `MockHubRepository` as fallback implementation of the same contract.

- [ ] Add repository tests for server success, detail 404, network fallback, and no special-day-to-detail conversion.

- [ ] Run focused Android repository/view-model tests:

```bash
rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubEventsCalendarViewModelTest --tests dev.minepacu.stelliveeventnotifier.HubCalendarDeepLinkPolicyTest
```

Expected: repository-driven calendar/detail behavior passes.

## Step 5: Android Screen Wiring

- [ ] Update `MainActivity.renderGoodsEvents()` to render server/fallback `HubEvent` and `HubCalendarDay` state from `HubRepository`.

- [ ] Update calendar row click behavior:

```text
if entry.entryKind == HUB_EVENT and appDeepLink matches eventId:
  selectedHubEventId = entry.eventId
  navigateTo(GOODS_EVENT_DETAIL)
else:
  do not navigate to event detail
```

- [ ] Update `renderHubEventDetail()`:

```text
show cached event immediately when available
load GET /v1/hub-events/:id through repository
200 updates the view
404 shows not-found state
network failure with cache shows stale cached detail
network failure without cache shows retry state
```

- [ ] Keep image loading behind `HubEventImagePolicy.canDisplay`.

- [ ] Run Android full unit tests:

```bash
rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest
```

Expected: Android unit tests pass.

## Step 6: iOS API Client

- [ ] Add missing methods to `HubAPIClient.swift`:

```swift
func hubEvents(
    category: String? = nil,
    participationMode: String? = nil,
    status: String? = nil,
    generationId: String? = nil,
    memberId: String? = nil,
    from: String? = nil,
    to: String? = nil,
    limit: Int? = nil
) async throws -> HubEventsListResponse

func hubEvent(id: String) async throws -> HubEvent
```

- [ ] Preserve existing `hubEventsCalendar(from:to:timezone:)`.

- [ ] Add or extend `HubAPIClientTests.swift`:

```text
GET /v1/hub-events encodes query items
GET /v1/hub-events/{id} decodes HubEvent
GET /v1/hub-events/calendar decodes HubCalendarResponse
404 detail maps to HubAPIError.httpStatus(404)
```

- [ ] Run focused iOS API tests:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16" -only-testing:StelliveHubiOSTests/HubAPIClientTests
```

Expected: API client tests pass.

## Step 7: iOS Store State

- [ ] Extend `ServerHubStore` with server-backed state:

```swift
@Published private(set) var serverHubEvents: [HubEvent]
@Published private(set) var serverCalendarDays: [HubCalendarDay]
@Published private(set) var hubEventDetailCache: [String: HubEvent]
@Published private(set) var hubEventLoadState: HubEventLoadState
```

- [ ] Implement store actions:

```swift
func refreshHubEvents(filter: String) async
func refreshCalendar(from: Date, to: Date, timezone: TimeZone) async
func loadHubEventDetail(id: String) async -> HubEventDetailLoadResult
```

- [ ] Make `MockHubStore` expose the same derived behavior for previews and fallback.

- [ ] Cache rules:

```text
list success replaces serverHubEvents and detail cache entries
calendar success replaces serverCalendarDays
detail success updates detail cache
detail 404 returns notFound
network failure returns cached detail when present
```

- [ ] Add `ServerHubStoreTests.swift` for success, detail 404, cached fallback, and calendar refresh.

- [ ] Run focused store tests:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16" -only-testing:StelliveHubiOSTests/ServerHubStoreTests
```

Expected: iOS store tests pass.

## Step 8: iOS View Wiring

- [ ] Update `HubEventsView.swift` to use server-backed list/calendar state when available and mock/fallback state only when needed.

- [ ] Wire row taps:

```text
HubCalendarEntry.entryKind == hubEvent -> NavigationLink/event detail route with eventId
special day entry -> no HubEventDetailView navigation
```

- [ ] Add a detail container around `HubEventDetailView`:

```text
cached event visible immediately
async detail refresh on appear
notFound state for 404
retry/error state for network failure without cache
stale label for network failure with cache
```

- [ ] Keep `HubEventImagePolicy.displayURL(for:)` as the only image display gate.

- [ ] Run focused calendar/detail tests:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected: calendar view model tests still pass.

## Step 9: Backend/Admin Integration Verification

- [ ] Start backend in Prisma mode locally or on the internal server when Docker-backed API testing is needed.

Internal server flow:

```bash
rtk rsync -az --delete --exclude '.git/' --exclude '.gradle/' --exclude 'node_modules/' --exclude 'dist/' --exclude 'build/' --exclude 'qa-screenshots/' --exclude '.DS_Store' --exclude '.env' --exclude '.env.*' ./ minepacu@192.168.50.9:~/StelLiveNoti/
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti && docker compose -f backend/stellive-hub-api/docker-compose.yml up -d --build --force-recreate'
rtk ssh minepacu@192.168.50.9 'docker ps --format "table {{.Names}}\t{{.Status}}" | grep stellive-hub-api'
```

- [ ] Create and publish a policy-safe test event through the admin console or admin route.

Test event constraints:

```text
generationId = official or active/upcoming member generation
memberId = stellive-official or verified active/upcoming member
sourceUrl = HTTPS official/test-safe URL
no binary image data
no Former member
no official YouTube live event type
```

- [ ] Verify public API:

```bash
rtk curl -sS http://192.168.50.9:4000/v1/hub-events
rtk curl -sS http://192.168.50.9:4000/v1/hub-events/<event-id>
rtk curl -sS 'http://192.168.50.9:4000/v1/hub-events/calendar?from=2026-06-01&to=2026-06-30&timezone=Asia/Seoul'
```

Expected: created event appears in list, detail, and calendar.

## Step 10: Policy Grep

- [ ] Run policy grep:

```bash
rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|profileImageUrl|posterUrl|logoUrl|rawPayload|providerResponse|NID_AUT|NID_SES|login-cookie|cookie scraping" android ios backend shared docs/ADMIN_HUB_EVENTS_MOBILE_DISPLAY_DESIGN.md docs/superpowers/plans/2026-06-18-admin-hub-events-mobile-display-code-plan.md
```

Expected: matches are policy text, existing enum definitions, or explicit exclusions. No new mobile data path introduces forbidden content.

## Step 11: Full Verification

- [ ] Backend:

```bash
rtk npm --prefix backend/stellive-hub-api test
rtk npm --prefix backend/stellive-hub-api run build
```

- [ ] Android:

```bash
rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest
```

- [ ] iOS:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16"
```

- [ ] Final diff review:

```bash
rtk git status --short
rtk git diff --stat
rtk git diff -- docs/ADMIN_HUB_EVENTS_MOBILE_DISPLAY_DESIGN.md docs/superpowers/plans/2026-06-18-admin-hub-events-mobile-display-code-plan.md
```

Expected: changes are scoped to HubEvent public reads, mobile data wiring, tests, docs, and OpenAPI contract.

## Commit Boundaries

Commit 1:

```bash
rtk git add backend/stellive-hub-api/src shared/openapi/openapi.yaml backend/stellive-hub-api/test
rtk git commit -m "feat(api): expose published hub events to mobile"
```

Commit 2:

```bash
rtk git add android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier
rtk git commit -m "feat(android): load hub events from server"
```

Commit 3:

```bash
rtk git add ios/StelliveHubiOS/StelliveHubiOS ios/StelliveHubiOS/StelliveHubiOSTests
rtk git commit -m "feat(ios): load hub events from server"
```

Commit 4:

```bash
rtk git add docs/ADMIN_HUB_EVENTS_MOBILE_DISPLAY_DESIGN.md docs/superpowers/plans/2026-06-18-admin-hub-events-mobile-display-code-plan.md
rtk git commit -m "docs: plan admin hub events mobile display"
```

Do not include untracked Xcode workspace user data or unrelated generated files in these commits.
