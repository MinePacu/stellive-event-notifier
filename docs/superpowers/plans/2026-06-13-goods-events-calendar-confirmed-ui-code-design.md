Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the confirmed `굿즈/행사` calendar UI plan into concrete Android, iOS, API, and test code boundaries.

**Architecture:** Keep the calendar as a read-only mobile projection of server-normalized `HubEvent` records. Backend route code owns date-window projection and DTO contract; mobile repositories fetch/cache calendar days; mobile view models derive selected month, day/range state, visible entries, range markers, and empty/loading/error states; platform views only render state. No mobile code creates schedules, sends notifications, fetches provider APIs, or bypasses preference policy.

**Tech Stack:** TypeScript, Fastify, Zod/OpenAPI, Vitest, Kotlin, Retrofit, Android unit tests, Swift, SwiftUI, URLSession, XCTest.

## Source Documents

- Functional plan: `docs/superpowers/plans/2026-06-13-goods-events-calendar-confirmed-ui.md`
- Confirmed browser mockup: `mockups/issue-30-16-goods-events-calendar-menu-mockup.html`
- Existing full calendar/widget plan: `docs/superpowers/plans/2026-06-10-goods-events-calendar-code-implementation.md`
- Backend API plan: `docs/API_IMPLEMENTATION_PLAN.md`
- Handoff: `docs/AI_HANDOFF.md`
- GitHub issue: `#30`
- GitLab work item: `#16`

## Non-Negotiable Code Constraints

- The `굿즈/행사` calendar is read-only.
- Remove and keep removed any plus/add action from the calendar surface.
- Mobile apps must consume normalized backend DTOs only.
- Calendar refresh must not call CHZZK, YouTube, X, Naver, or any platform provider directly from mobile.
- Calendar surfaces must not send push notifications.
- Calendar/widget surfaces must not bypass global/platform/event-type/generation/member preferences.
- X notification ingestion/delivery remains disabled for this MVP scope.
- Official YouTube live scheduled/started/ended records must not appear.
- No Former members may be introduced in tests, mocks, filters, or UI.
- Gangzi remains only a `gamja` representative entry and is not a generation member.
- No official logos, profile images, fan art, copied posters, captured screenshots, raw provider payloads, or local image binaries are added.

## Target Code Topology

Backend and shared contract:

```text
shared/
  schemas/domain.ts
  openapi/openapi.yaml
backend/stellive-hub-api/src/
  hub-events/hubEventCalendar.ts
  routes/hubEventReadRoutes.ts
backend/stellive-hub-api/test/
  hubEventCalendar.test.ts
  hubEventReadRoutes.test.ts
```

Android:

```text
android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/
  core/model/Models.kt
  core/network/HubApi.kt
  core/network/HubApiModels.kt
  feature/calendar/CalendarUiPolicy.kt
  feature/calendar/HubEventsCalendarViewModel.kt
  feature/calendar/HubEventsCalendarView.kt
  feature/home/HubRepository.kt
  feature/home/MockHubRepository.kt
  feature/home/ServerHubRepository.kt
  feature/home/MainUiPolicy.kt
android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/
  CalendarUiPolicyTest.kt
  HubEventsCalendarViewModelTest.kt
  MainUiPolicyTest.kt
```

iOS:

```text
ios/StelliveHubiOS/StelliveHubiOS/
  Models/HubModels.swift
  Services/HubAPIClient.swift
  Services/MockHubStore.swift
  Services/ServerHubStore.swift
  Views/HubEventsView.swift
  Views/HubEventsCalendarView.swift
  Views/HubEventsCalendarViewModel.swift
ios/StelliveHubiOS/StelliveHubiOSTests/
  HubEventsCalendarViewModelTests.swift
```

## Shared Calendar Contract Design

The mobile UI uses this stable shape. Existing fields should be reused where present.

```ts
export interface HubCalendarResponse {
  timezone: string;
  from: string;
  to: string;
  days: HubCalendarDay[];
}

export interface HubCalendarDay {
  date: string;
  entries: HubCalendarEntry[];
}

export interface HubCalendarEntry {
  id: string;
  eventId: string;
  title: string;
  category: HubEventCategory;
  status: HubEventStatus;
  participationMode: HubEventParticipationMode;
  generationId: string;
  memberId?: string;
  startsAt?: string;
  endsAt?: string;
  displayDate: string;
  displayTimeText: string;
  sourceLabel: string;
  appDeepLink?: string;
  platformUrl?: string;
}
```

Contract exclusions:

```text
rawPayload
providerResponse
logoUrl
posterUrl
profileImageUrl
thumbnailUrl
bytes
base64
assetPath
filePath
localPath
```

## Backend Boundary Design

`hubEventCalendar.ts` remains the only code that turns `HubEvent[]` into calendar days.

Responsibilities:

- Accept normalized `HubEvent` records.
- Accept `from`, `to`, `timezone`, and `now`.
- Return date-keyed `HubCalendarDay[]`.
- Include each event on every local date it should appear for normal windows.
- Preserve long-event flood protection already established by the calendar plan.
- Sort entries with the existing status rank: `closing_soon`, `open`, `upcoming`, `announced`, `cancelled`, `ended`.
- Exclude disallowed records before projection if guards already provide that boundary.
- Never emit raw provider payloads or image asset fields.

`hubEventReadRoutes.ts` responsibilities:

- Parse `GET /v1/hub-events/calendar`.
- Validate `from`, `to`, `timezone`.
- Cap date-window size according to existing backend policy.
- Return `HubCalendarResponse`.
- Keep `GET /v1/hub-events/widget-snapshot` read-only and compact.

Backend tests:

- `hubEventCalendar.test.ts` covers date expansion, long event handling, cancelled visibility, sorting, and field exclusions.
- `hubEventReadRoutes.test.ts` covers query validation and response shape.

## Android Model Design

Use existing `HubCalendarEntry`, `HubCalendarDay`, and `HubCalendarWidgetSnapshot` where possible. Add only fields missing from the shared contract.

Additional UI-only models live beside the calendar feature:

```kotlin
enum class HubEventsViewMode {
    LIST,
    CALENDAR,
}

enum class HubCalendarScopeMode {
    DAY,
    RANGE,
}

enum class CalendarDateMarker {
    OUTSIDE,
    SELECTED_DAY,
    RANGE_START,
    RANGE_MIDDLE_WITH_EVENT,
    RANGE_MIDDLE_EMPTY,
    RANGE_END,
    TODAY,
}

data class HubEventsCalendarUiState(
    val viewMode: HubEventsViewMode,
    val scopeMode: HubCalendarScopeMode,
    val selectedMonth: YearMonth,
    val selectedDay: LocalDate,
    val rangeStart: LocalDate?,
    val rangeEnd: LocalDate?,
    val filterId: String,
    val days: List<HubCalendarDay>,
    val visibleEntries: List<HubCalendarEntry>,
    val isLoading: Boolean,
    val errorMessage: String?,
)
```

Keep date marker classification in policy or view model, not in the XML/View drawing code.

## Android ViewModel Design

`HubEventsCalendarViewModel` owns user interaction state and delegates pure calculations to `CalendarUiPolicy`.

Inputs:

- `HubRepository` for data.
- `Clock` or injectable `now` provider for tests.
- Initial filter from existing `굿즈/행사` filter state if available.

Public actions:

```kotlin
fun setViewMode(mode: HubEventsViewMode)
fun setScopeMode(mode: HubCalendarScopeMode)
fun selectMonth(month: YearMonth)
fun goToPreviousMonth()
fun goToNextMonth()
fun selectDay(date: LocalDate)
fun selectRangeBoundary(date: LocalDate)
fun setFilter(filterId: String)
fun refresh()
```

Derived behavior:

- Day mode sets `selectedDay` and clears incomplete range UX.
- Range mode uses first tap as start and second tap as end.
- If second range tap is before start, normalize the range.
- Visible entries are filtered by `filterId` and selected date/range.
- Entry sorting uses `CalendarUiPolicy.entryComparator`.
- `hasEntries(date)` reads from filtered calendar days.
- No action exposes add/create/edit.

## Android Policy Design

Extend `CalendarUiPolicy.kt` with pure functions:

```kotlin
fun normalizeRange(start: LocalDate?, end: LocalDate?): ClosedRange<LocalDate>?
fun entriesForDay(days: List<HubCalendarDay>, date: LocalDate): List<HubCalendarEntry>
fun entriesForRange(days: List<HubCalendarDay>, start: LocalDate, end: LocalDate): List<HubCalendarEntry>
fun markerForDate(
    date: LocalDate,
    today: LocalDate,
    scopeMode: HubCalendarScopeMode,
    selectedDay: LocalDate,
    rangeStart: LocalDate?,
    rangeEnd: LocalDate?,
    hasEntries: Boolean,
): CalendarDateMarker
fun accessibilityLabelForDate(date: LocalDate, marker: CalendarDateMarker, entryCount: Int): String
```

Marker mapping:

- `SELECTED_DAY`: strong capsule.
- `RANGE_START`: strong capsule with trailing connected bar.
- `RANGE_END`: strong capsule with leading connected bar.
- `RANGE_MIDDLE_WITH_EVENT`: soft connected bar plus dot marker.
- `RANGE_MIDDLE_EMPTY`: soft connected bar without dot.
- `TODAY`: today outline/tint when not selected/ranged.
- `OUTSIDE`: normal or muted cell.

## Android View Rendering Design

`HubEventsCalendarView.kt` should be split into small render functions:

```kotlin
renderViewModeSwitch(state)
renderScopeSwitch(state)
renderMonthControl(state)
renderMonthGrid(state)
renderCalendarDateCell(date, marker, entryCount)
renderEventList(state.visibleEntries)
renderEmptyState(state)
renderLoadingState()
renderErrorState(message)
```

Layout requirements:

- `목록 / 캘린더` and `일별 / 기간별` controls are separate rows.
- Month controls are in a separate full-width row.
- No floating plus button exists.
- Event dots are independent of selected/range background.
- Text must fit at 360 px width.
- Date cells keep stable size across all marker states.
- Entry rows use title, status badge, source/category metadata, and time text.
- Entry taps call existing hub event deep link/detail behavior.

## Android Repository/API Design

`HubApi.kt` adds:

```kotlin
@GET("v1/hub-events/calendar")
suspend fun hubEventsCalendar(
    @Query("from") from: String,
    @Query("to") to: String,
    @Query("timezone") timezone: String,
): HubCalendarResponseDto
```

`HubApiModels.kt` adds DTOs only if current DTO coverage is missing:

```kotlin
data class HubCalendarResponseDto(
    val timezone: String,
    val from: String,
    val to: String,
    val days: List<HubCalendarDayDto>,
)
```

`ServerHubRepository` responsibilities:

- Request the selected month window from `/v1/hub-events/calendar`.
- Use device timezone or `Asia/Seoul` fallback.
- Return cached calendar days on network failure if available.
- Keep widget snapshot refresh separate from calendar display if existing code already does so.
- Do not synthesize user-created entries.

`MockHubRepository` responsibilities:

- Derive mock calendar days from existing allowed `hubEvents`.
- Do not add Former members, Gangzi generation records, or unauthorized images.

## iOS Model Design

Reuse existing `HubCalendarEntry`, `HubCalendarDay`, `HubCalendarWidgetSnapshot`, and `HubCalendarPolicy` where available.

Add UI-only enums in `HubEventsCalendarViewModel.swift`:

```swift
enum HubEventsViewMode: String, CaseIterable, Identifiable {
    case list
    case calendar
}

enum HubCalendarScopeMode: String, CaseIterable, Identifiable {
    case day
    case range
}

enum HubCalendarDateMarker: Equatable {
    case outside
    case selectedDay
    case rangeStart
    case rangeMiddleWithEvent
    case rangeMiddleEmpty
    case rangeEnd
    case today
}
```

Do not persist these UI-only marker enums to the API or widget snapshot.

## iOS ViewModel Design

`HubEventsCalendarViewModel` is `@MainActor` and owns presentation state.

State:

```swift
@Published var viewMode: HubEventsViewMode
@Published var scopeMode: HubCalendarScopeMode
@Published var selectedMonth: Date
@Published var selectedDay: Date
@Published var rangeStart: Date?
@Published var rangeEnd: Date?
@Published var filterId: String
@Published var days: [HubCalendarDay]
@Published var isLoading: Bool
@Published var errorMessage: String?
```

Public actions:

```swift
func setViewMode(_ mode: HubEventsViewMode)
func setScopeMode(_ mode: HubCalendarScopeMode)
func goToPreviousMonth()
func goToNextMonth()
func selectDate(_ date: Date)
func setFilter(_ filterId: String)
func refresh() async
```

Derived methods:

```swift
func visibleEntries() -> [HubCalendarEntry]
func marker(for date: Date) -> HubCalendarDateMarker
func entryCount(on date: Date) -> Int
func accessibilityLabel(for date: Date) -> String
```

Range behavior:

- First date tap in range mode sets `rangeStart`.
- Second date tap sets `rangeEnd`.
- If end precedes start, swap before deriving visible entries.
- Re-tapping a start date begins a new range.
- Middle dates never use selected endpoint styling.

## iOS View Rendering Design

`HubEventsCalendarView.swift` splits UI into small SwiftUI components:

```swift
struct HubEventsCalendarView
struct CalendarModeSwitch
struct CalendarScopeSwitch
struct CalendarMonthControl
struct CalendarMonthGrid
struct CalendarDateCell
struct CalendarEventList
struct CalendarEventRow
```

Rendering rules:

- Use `Picker` or app-local segmented control for `목록 / 캘린더`.
- Use a second segmented control for `일별 / 기간별`.
- Month controls are below both segmented controls.
- Draw range with a background capsule/rounded rectangle behind middle cells.
- Draw start/end as stronger endpoint circles/capsules.
- Draw event dots as a separate marker under the date number.
- Do not place a toolbar plus button, FAB, create sheet, or edit action.
- Use grouped row styling consistent with existing `HubEventsView`.

## iOS API/Store Design

`HubAPIClient.swift` adds:

```swift
func hubEventsCalendar(from: String, to: String, timezone: String) async throws -> HubCalendarResponse
```

`ServerHubStore.swift` responsibilities:

- Fetch selected month calendar days from `/v1/hub-events/calendar`.
- Cache last successful calendar response.
- Continue writing `HubCalendarWidgetSnapshot` through `HubCalendarWidgetStore` when bootstrap/refresh provides a snapshot.
- Fall back to cached or mock data without creating local schedule records.

`MockHubStore.swift` responsibilities:

- Build calendar days from existing `hubEvents`.
- Keep mock data policy-safe.
- Preserve preview stability.

## Cross-Platform Date Algorithm

Use one conceptual algorithm on both platforms:

```text
normalizeRange(start, end):
  if start == null or end == null: return null
  if start <= end: return start...end
  return end...start

marker(date):
  if scope == day and date == selectedDay: selectedDay
  if scope == range and date == range.start: rangeStart
  if scope == range and date == range.end: rangeEnd
  if scope == range and range contains date:
    if entryCount(date) > 0: rangeMiddleWithEvent
    return rangeMiddleEmpty
  if date == today: today
  return outside
```

Visible entries:

```text
day mode:
  entries for selectedDay

range mode with complete range:
  entries for dates start...end inclusive

range mode with only start:
  entries for rangeStart only
```

Deduplication:

- If one event spans multiple dates, it may appear on each date group provided by the backend projection.
- The flat selected range list may show date-grouped duplicates because each date is a calendar occurrence.
- Do not collapse occurrences unless the backend contract introduces occurrence IDs.

## Accessibility Design

Date cell accessible labels use the same marker classification:

```text
6월 15일, 기간 시작, 일정 2개
6월 16일, 기간 포함, 일정 1개
6월 17일, 기간 종료, 일정 2개
6월 18일, 기간 포함, 일정 없음
```

Controls:

- `목록 / 캘린더` announces selected view.
- `일별 / 기간별` announces selected scope.
- Previous/next month buttons announce target month where platform APIs allow it.
- Event rows announce title, status, time, source label.

## Test Design

Backend focused tests:

- Calendar route accepts valid `from`, `to`, and `timezone`.
- Calendar route rejects invalid date strings.
- Calendar response includes only public DTO fields.
- Multi-day event projection covers each local date in the selected window.
- Long event projection follows existing flood-control policy.

Android focused tests:

- `CalendarUiPolicy.normalizeRange()` sorts reversed ranges.
- `CalendarUiPolicy.markerForDate()` returns `RANGE_MIDDLE_WITH_EVENT` for middle range dates with entries.
- `CalendarUiPolicy.markerForDate()` returns `RANGE_MIDDLE_EMPTY` for middle range dates without entries.
- `HubEventsCalendarViewModel.selectDay()` updates day mode visible entries.
- `HubEventsCalendarViewModel.selectRangeBoundary()` updates range state and visible entries.
- `MainUiPolicy` exposes no calendar add action.

iOS focused tests:

- `HubEventsCalendarViewModel` normalizes reversed ranges.
- `marker(for:)` distinguishes range start, middle with event, middle empty, and range end.
- `visibleEntries()` returns selected-day entries in day mode.
- `visibleEntries()` returns inclusive range entries in range mode.
- The model exposes no add/create action.

## Implementation Tasks

## Step 1: Shared Contract Audit

- [ ] Inspect `shared/schemas/domain.ts` for current `HubCalendarEntry`, `HubCalendarDay`, and `HubCalendarWidgetSnapshot`.
- [ ] Inspect `shared/openapi/openapi.yaml` for `/v1/hub-events/calendar`.
- [ ] Add missing calendar response fields only if Android/iOS need them.
- [ ] Confirm excluded fields remain absent from the calendar schemas.
- [ ] Run:

```bash
rtk rg -n "HubCalendarEntry|HubCalendarDay|HubCalendarWidgetSnapshot|/v1/hub-events/calendar" shared backend/stellive-hub-api/src backend/stellive-hub-api/test
```

Expected: shared schema, OpenAPI, route, and tests reference the same calendar DTO family.

## Step 2: Backend Route And Projection Verification

- [ ] Add or extend `backend/stellive-hub-api/test/hubEventCalendar.test.ts` for the range projection cases used by the confirmed UI.
- [ ] Add or extend `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts` for calendar query validation.
- [ ] Verify `hubEventCalendar.ts` does not emit image asset fields or raw provider fields.
- [ ] Run:

```bash
rtk npm --prefix backend/stellive-hub-api test -- hubEventCalendar hubEventReadRoutes
```

Expected: focused backend calendar tests pass.

## Step 3: Android Policy Layer

- [ ] Extend `CalendarUiPolicy.kt` with range normalization, date marker classification, selected day filtering, selected range filtering, and accessibility labels.
- [ ] Add `CalendarDateMarker` and `HubCalendarScopeMode` near the calendar feature package.
- [ ] Add `CalendarUiPolicyTest` cases for every marker state.
- [ ] Run:

```bash
rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.CalendarUiPolicyTest
```

Expected: Android policy tests pass.

## Step 4: Android ViewModel Layer

- [ ] Create `HubEventsCalendarViewModel.kt`.
- [ ] Inject `HubRepository` and a testable clock.
- [ ] Implement view mode, scope mode, selected month, selected day, range, filter, days, loading, and error state.
- [ ] Implement public actions listed in this design.
- [ ] Add `HubEventsCalendarViewModelTest.kt`.
- [ ] Run:

```bash
rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubEventsCalendarViewModelTest
```

Expected: Android view model tests pass without network calls.

## Step 5: Android API And Repository Layer

- [ ] Add `hubEventsCalendar()` to `HubApi.kt`.
- [ ] Add DTOs/mappers to `HubApiModels.kt` only if missing.
- [ ] Add a repository method for calendar month loading in `HubRepository`.
- [ ] Implement server-backed loading in `ServerHubRepository`.
- [ ] Implement mock fallback calendar loading in `MockHubRepository`.
- [ ] Ensure failure paths do not create local schedules.
- [ ] Run:

```bash
rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubApiClientTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest
```

Expected: Android API/repository tests pass or only existing missing-test classes are skipped by the runner.

## Step 6: Android View Layer

- [ ] Create `HubEventsCalendarView.kt`.
- [ ] Render `목록 / 캘린더` switch.
- [ ] Render `일별 / 기간별` switch.
- [ ] Render separated month controls.
- [ ] Render month grid with stable cell dimensions.
- [ ] Render marker states from `CalendarUiPolicy`.
- [ ] Render text-only event rows.
- [ ] Remove any plus/add calendar action from `MainUiPolicy.kt` and `activity_main.xml`.
- [ ] Update `MainUiPolicyTest.kt` to prove the add action is absent.
- [ ] Run:

```bash
rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest
```

Expected: Android unit tests pass.

## Step 7: iOS Policy/ViewModel Layer

- [ ] Create `HubEventsCalendarViewModel.swift`.
- [ ] Add `HubEventsViewMode`, `HubCalendarScopeMode`, and `HubCalendarDateMarker`.
- [ ] Implement range normalization and marker classification.
- [ ] Implement visible entry derivation.
- [ ] Add `HubEventsCalendarViewModelTests.swift`.
- [ ] Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected: iOS view model tests pass.

## Step 8: iOS API And Store Layer

- [ ] Add `hubEventsCalendar(from:to:timezone:)` to `HubAPIClient.swift`.
- [ ] Add model fields to `HubModels.swift` only if existing calendar models are incomplete.
- [ ] Add calendar month loading to `ServerHubStore.swift`.
- [ ] Keep `MockHubStore.swift` deriving calendar data from existing `hubEvents`.
- [ ] Preserve widget snapshot cache behavior through `HubCalendarWidgetStore`.
- [ ] Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16" -only-testing:StelliveHubiOSTests/HubAPIClientTests -only-testing:StelliveHubiOSTests/ServerHubStoreTests
```

Expected: iOS API/store tests pass or existing missing-test classes are handled by adding the required tests before implementation.

## Step 9: iOS View Layer

- [ ] Create `HubEventsCalendarView.swift`.
- [ ] Update `HubEventsView.swift` to host the list/calendar switch and calendar view.
- [ ] Render scope switch, month controls, grid, date cells, and event rows.
- [ ] Do not add toolbar plus, floating add, create sheet, or edit form.
- [ ] Verify SwiftUI previews use `MockHubStore`.
- [ ] Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16"
```

Expected: iOS tests pass.

## Step 10: Mockup And Visual Regression Check

- [ ] Keep the browser mockup unchanged as the UI source unless the user approves a new visual change.
- [ ] Open the mockup:

```bash
rtk proxy open mockups/issue-30-16-goods-events-calendar-menu-mockup.html
```

- [ ] Compare Android and iOS implementation screens to the mockup.
- [ ] Confirm no overlap between switches and month controls at narrow width.
- [ ] Confirm plus/add button is absent.
- [ ] Confirm middle range dates with events use dot markers, not inverted color.

## Step 11: Policy Grep

- [ ] Run:

```bash
rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|profileImageUrl|posterUrl|logoUrl|rawPayload|providerResponse|NID_AUT|NID_SES|login-cookie|cookie scraping" android ios backend shared docs/superpowers/plans/2026-06-13-goods-events-calendar-confirmed-ui-code-design.md
```

Expected: matches are policy docs, existing enum definitions, or explicit exclusions; no new calendar UI data or implementation introduces forbidden content.

## Step 12: Full Verification

- [ ] Run backend:

```bash
rtk npm --prefix backend/stellive-hub-api test
rtk npm --prefix backend/stellive-hub-api run build
```

- [ ] Run Android:

```bash
rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest
```

- [ ] Run iOS:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16"
```

- [ ] Run final status:

```bash
rtk git status --short
rtk git diff --stat
```

Expected: changes are scoped to calendar UI, calendar API consumption, tests, mockup, and docs.

## Commit Boundaries

Suggested commits after implementation:

```bash
rtk git add shared/openapi/openapi.yaml shared/schemas/domain.ts backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts backend/stellive-hub-api/test/hubEventCalendar.test.ts backend/stellive-hub-api/test/hubEventReadRoutes.test.ts
rtk git commit -m "feat(api): verify hub event calendar projection"
```

```bash
rtk git add android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier
rtk git commit -m "feat(android): add hub event calendar UI"
```

```bash
rtk git add ios/StelliveHubiOS/StelliveHubiOS ios/StelliveHubiOS/StelliveHubiOSTests
rtk git commit -m "feat(ios): add hub event calendar UI"
```

```bash
rtk git add docs/superpowers/plans/2026-06-13-goods-events-calendar-confirmed-ui.md docs/superpowers/plans/2026-06-13-goods-events-calendar-confirmed-ui-code-design.md mockups/issue-30-16-goods-events-calendar-menu-mockup.html
rtk git commit -m "docs: document confirmed hub event calendar UI design"
```

Do not commit unrelated staged work with these commits unless it is part of the same implementation scope.
