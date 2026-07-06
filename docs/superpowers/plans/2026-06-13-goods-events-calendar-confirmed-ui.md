Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the confirmed `굿즈/행사` calendar menu UI from `mockups/issue-30-16-goods-events-calendar-menu-mockup.html` in Android and iOS.

**Architecture:** The mobile apps render a read-only calendar projection backed by server-provided `HubEvent` calendar data. The UI offers list/calendar switching, day/range calendar scopes, date-range visualization, and date-grouped schedule rows without any local event creation flow. Backend APIs remain the source of truth for schedules, while mobile code owns presentation state, selected month, selected day/range, filters, deep links, and cached widget snapshots.

**Tech Stack:** Kotlin, Android XML/View or existing app UI layer, Android unit tests, Swift, SwiftUI, XCTest, TypeScript Fastify backend calendar endpoints, shared OpenAPI/DTO contracts.

## Fixed UI Decisions

- The confirmed browser mockup is `mockups/issue-30-16-goods-events-calendar-menu-mockup.html`.
- `굿즈/행사` keeps the existing main navigation entry.
- The screen has a primary `목록 / 캘린더` view switch.
- Calendar view has a secondary `일별 / 기간별` scope switch.
- Month movement is a separate full-width row below the switches, not inline with the scope buttons.
- The plus/add floating button is removed because schedules are loaded from the server.
- Calendar is read-only. Users cannot create, edit, or delete schedules from mobile apps.
- Day scope selects one date and shows only that date's entries.
- Range scope selects a start date and end date and shows all entries in the selected period.
- Range start/end dates use a strong selected capsule.
- Dates between start/end use a soft connected range bar.
- A date inside the range does not invert color just because it has an event.
- Event existence is indicated with dot markers. No dot means no schedule on that date.
- Event rows are text-first: title, status badge, source/category metadata, and time.
- No official logos, profile images, fan art, copied posters, captured screenshots, or image binaries are used.

## Files

Create:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarView.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarViewModel.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsCalendarViewModelTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`

Modify:

- `mockups/issue-30-16-goods-events-calendar-menu-mockup.html`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainUiPolicyTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/App.swift`
- `shared/openapi/openapi.yaml`

Do not modify:

- Member catalog seed data for Former members.
- Notification delivery behavior.
- Push preference resolution.
- Platform adapters.
- Admin event creation flows.

## Data Model Requirements

Use the existing calendar projection where available:

- `GET /v1/hub-events/calendar`
- `GET /v1/hub-events/widget-snapshot`
- `HubCalendarEntry`
- `HubCalendarDay`
- `HubCalendarWidgetSnapshot`

Add or verify these mobile-facing fields:

- `date: String` on each calendar day, formatted as `YYYY-MM-DD`.
- `entries: [HubCalendarEntry]` grouped by local date.
- `startsAt` and `endsAt` on entries when available.
- `displayTimeText` from the server or UI policy.
- `status`, `category`, `participationMode`, `sourceLabel`, `appDeepLink`, and `platformUrl`.

Do not add these fields to calendar DTOs:

- `rawPayload`
- `providerResponse`
- `logoUrl`
- `posterUrl`
- `profileImageUrl`
- `thumbnailUrl`
- local image paths
- binary image fields

## Step 1: Lock The Mockup As UI Source

- [ ] Confirm `mockups/issue-30-16-goods-events-calendar-menu-mockup.html` has no plus/add FAB.
- [ ] Confirm Android sample screen shows day scope.
- [ ] Confirm iPhone sample screen shows range scope.
- [ ] Confirm month navigation is visually separated from `일별 / 기간별`.
- [ ] Confirm range start/end dates use strong capsule states.
- [ ] Confirm range middle dates use soft connected bars.
- [ ] Confirm middle dates with entries keep range background and use dot markers only.
- [ ] Run:

```bash
rtk rg -n "fab|오늘로 이동|M12 5v14" mockups/issue-30-16-goods-events-calendar-menu-mockup.html
```

Expected: no matches.

## Step 2: Define Calendar UI State

- [ ] Add common UI concepts to Android and iOS view models.
- [ ] Represent primary view mode as `list` or `calendar`.
- [ ] Represent calendar scope as `day` or `range`.
- [ ] Represent selected month as year/month.
- [ ] Represent selected day as local date.
- [ ] Represent selected range as `startDate` and `endDate`.
- [ ] Represent filters as `all`, `goods`, `ticketing`, `offline`, and `closing`.
- [ ] Derive visible entries from server calendar days and current UI state.
- [ ] Preserve deterministic sorting through `CalendarUiPolicy` and `HubCalendarPolicy`.

Android target state:

```kotlin
enum class HubEventsViewMode { LIST, CALENDAR }
enum class CalendarScopeMode { DAY, RANGE }
data class HubEventsCalendarUiState(
    val viewMode: HubEventsViewMode = HubEventsViewMode.CALENDAR,
    val scopeMode: CalendarScopeMode = CalendarScopeMode.DAY,
    val selectedMonth: YearMonth,
    val selectedDay: LocalDate,
    val rangeStart: LocalDate?,
    val rangeEnd: LocalDate?,
    val filterId: String = "all",
    val days: List<HubCalendarDay> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)
```

iOS target state:

```swift
enum HubEventsViewMode: String, CaseIterable, Identifiable {
    case list
    case calendar
}

enum HubCalendarScopeMode: String, CaseIterable, Identifiable {
    case day
    case range
}
```

## Step 3: Android Policy Tests

- [ ] Extend `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt`.
- [ ] Test that day scope returns entries only for the selected date.
- [ ] Test that range scope returns entries from start through end inclusive.
- [ ] Test that reversed range selection normalizes to earliest date first.
- [ ] Test that range middle dates with entries are marked with event dots but not selected-capsule state.
- [ ] Test that empty middle dates keep the soft range bar with no dot.
- [ ] Test that cancelled events remain visible with `취소`.
- [ ] Test that no add action appears in the calendar navigation model.
- [ ] Run:

```bash
rtk proxy bash -lc 'cd android/StelliveHubAndroid && ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.CalendarUiPolicyTest'
```

Expected: tests fail before implementation and pass after policy implementation.

## Step 4: Android Calendar Screen

- [ ] Add `HubEventsCalendarViewModel.kt`.
- [ ] Add `HubEventsCalendarView.kt`.
- [ ] Wire `GET /v1/hub-events/calendar` into `HubApi.kt` and DTO mapping if missing.
- [ ] Reuse existing `HubCalendarEntry`, `HubCalendarDay`, and `HubCalendarWidgetSnapshot` models.
- [ ] Add a top-level `목록 / 캘린더` segmented control.
- [ ] Add a second `일별 / 기간별` segmented control in calendar mode.
- [ ] Add a separated month navigation row with previous/next controls.
- [ ] Add a month grid with weekday headers.
- [ ] Draw selected day as one strong capsule in day mode.
- [ ] Draw range start/end as strong capsules in range mode.
- [ ] Draw range middle dates as soft connected bars.
- [ ] Draw event dots for dates whose visible entries are not empty.
- [ ] Do not draw dots for empty dates.
- [ ] Remove any plus/add FAB from `굿즈/행사`.
- [ ] Keep search/filter actions only if they operate on server-provided data.
- [ ] Entry rows must use text, simple app-owned shapes, and no images.
- [ ] Entry tap opens existing hub event detail/deep link behavior.

## Step 5: Android Navigation And Empty States

- [ ] Update `MainUiPolicy.kt` so `굿즈/행사` has no add action.
- [ ] Update `activity_main.xml` only for navigation/container wiring required by the calendar screen.
- [ ] Keep settings as a top-bar action where existing policy allows it.
- [ ] Add empty day text: `선택한 날짜에 일정 없음`.
- [ ] Add empty range text: `선택한 기간에 일정 없음`.
- [ ] Add loading text: `일정을 불러오는 중`.
- [ ] Add error text: `일정을 불러오지 못했습니다`.
- [ ] Do not add local create/edit dialogs.
- [ ] Run:

```bash
rtk proxy bash -lc 'cd android/StelliveHubAndroid && ./gradlew :app:testDebugUnitTest'
```

Expected: all Android unit tests pass.

## Step 6: iOS Policy Tests

- [ ] Add `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`.
- [ ] Test day scope filtering.
- [ ] Test inclusive range filtering.
- [ ] Test reversed range normalization.
- [ ] Test range marker classification: `start`, `middleWithEvent`, `middleEmpty`, `end`, `outside`.
- [ ] Test that middle range dates with events are not rendered as selected endpoints.
- [ ] Test that the calendar model exposes no add action.
- [ ] Run:

```bash
rtk proxy bash -lc 'cd ios/StelliveHubiOS && xcodebuild test -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16"'
```

Expected: tests fail before implementation and pass after implementation.

## Step 7: iOS Calendar Screen

- [ ] Add `HubEventsCalendarViewModel.swift`.
- [ ] Add `HubEventsCalendarView.swift`.
- [ ] Extend `HubAPIClient.swift` with `GET /v1/hub-events/calendar` if missing.
- [ ] Update `HubModels.swift` only if the current `HubCalendarEntry`/`HubCalendarDay` models are missing fields needed by the confirmed UI.
- [ ] Update `MockHubStore.swift` to provide calendar days from existing `hubEvents`, not unrelated seed data.
- [ ] Update `ServerHubStore.swift` to load server calendar days.
- [ ] Update `HubEventsView.swift` to host the `목록 / 캘린더` switch and show `HubEventsCalendarView` in calendar mode.
- [ ] Use iOS grouped visual rhythm for event rows.
- [ ] Draw range start/end as strong endpoints.
- [ ] Draw middle range dates as soft connected bars.
- [ ] Draw dots only for dates with entries.
- [ ] Do not add a plus button, toolbar add item, sheet, or create form.
- [ ] Keep UI text-only and avoid official/copy-protected assets.

## Step 8: Backend And Contract Verification

- [ ] Verify `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts` supports inclusive date ranges for events that span multiple days.
- [ ] Verify long-running events do not flood month calendars beyond the existing calendar projection policy.
- [ ] Verify `/v1/hub-events/calendar` accepts `from`, `to`, and `timezone`.
- [ ] Verify `/v1/hub-events/calendar` returns only normalized public DTO fields.
- [ ] Verify `/v1/hub-events/widget-snapshot` remains read-only and compact.
- [ ] Verify `shared/openapi/openapi.yaml` documents all fields used by Android/iOS.
- [ ] Run:

```bash
rtk proxy bash -lc 'cd backend/stellive-hub-api && npm test -- hubEventCalendar && npm run build'
```

Expected: backend calendar tests and build pass.

## Step 9: Widget Snapshot Compatibility

- [ ] Keep Android and iOS widgets backed by cached `HubCalendarWidgetSnapshot`.
- [ ] Widgets must not fetch platform APIs directly.
- [ ] Widgets must not send notifications.
- [ ] Widgets must not expose add/create actions.
- [ ] If app calendar refresh succeeds, update the widget snapshot cache.
- [ ] If refresh fails, preserve the last valid snapshot and show stale state when applicable.
- [ ] Verify existing widget texts remain:

```txt
최근 동기화 필요
예정된 일정 없음
```

## Step 10: Accessibility And Small-Screen Checks

- [ ] Ensure `목록 / 캘린더`, `일별 / 기간별`, and month controls do not overlap at 360 px width.
- [ ] Ensure date cells keep stable dimensions across selected/unselected/range states.
- [ ] Ensure Korean labels do not clip in buttons.
- [ ] Ensure range dot markers are visible in light mode.
- [ ] Ensure status badges fit `판매 중`, `마감`, `예정`, `취소`, and `진행`.
- [ ] Ensure tap targets for date cells and month buttons are at least 44 dp/pt where the platform allows.
- [ ] Ensure VoiceOver/TalkBack labels distinguish:

```txt
6월 15일, 기간 시작, 일정 2개
6월 16일, 기간 포함, 일정 1개
6월 17일, 기간 종료, 일정 2개
```

## Step 11: Policy Safety Checks

- [ ] Confirm no Former members are introduced in mock or test data.
- [ ] Confirm Gangzi is not added to a generation member list.
- [ ] Confirm `official` remains displayed as `기타` where category filters are shown.
- [ ] Confirm official YouTube live scheduled/started/ended events are not generated or shown.
- [ ] Confirm the calendar remains a read-only projection.
- [ ] Confirm `realtime_best_effort` is not mentioned as a calendar freshness guarantee.
- [ ] Confirm X notification ingestion/delivery stays disabled for the `굿즈/행사` MVP scope.
- [ ] Run:

```bash
rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|profileImageUrl|posterUrl|logoUrl|rawPayload|providerResponse" android ios backend shared docs/superpowers/plans/2026-06-13-goods-events-calendar-confirmed-ui.md
```

Expected: matches are either policy documentation or existing enum definitions, not new calendar UI data or assets.

## Step 12: Full Verification

- [ ] Run Android tests:

```bash
rtk proxy bash -lc 'cd android/StelliveHubAndroid && ./gradlew :app:testDebugUnitTest'
```

- [ ] Run backend tests/build:

```bash
rtk proxy bash -lc 'cd backend/stellive-hub-api && npm test && npm run build'
```

- [ ] Run iOS tests:

```bash
rtk proxy bash -lc 'cd ios/StelliveHubiOS && xcodebuild test -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16"'
```

- [ ] Open the browser mockup after any UI implementation changes:

```bash
rtk proxy open mockups/issue-30-16-goods-events-calendar-menu-mockup.html
```

- [ ] Compare Android and iOS implementations against the confirmed browser mockup.
- [ ] Verify no plus/add button exists on `굿즈/행사`.
- [ ] Verify list/calendar switching works.
- [ ] Verify day/range switching works.
- [ ] Verify range middle dates keep soft background and use dots only for event existence.
- [ ] Verify event row taps open detail/deep links.

## Out Of Scope

- In-app schedule creation.
- Admin schedule creation or editing.
- Push notification delivery changes.
- Platform adapter changes.
- External platform crawling.
- Image, logo, poster, profile, or captured-media display work.
- X notification delivery.
- Official YouTube live notifications.

## Rollout Notes

- Track this UI implementation against GitHub issue `#30` and GitLab work item `#16`.
- The UI can be implemented against mock calendar data first, but the app-facing state must match `/v1/hub-events/calendar`.
- The plus/add button must stay removed even in mock mode.
- Server calendar data is authoritative; mobile apps should not synthesize user-created schedules.
