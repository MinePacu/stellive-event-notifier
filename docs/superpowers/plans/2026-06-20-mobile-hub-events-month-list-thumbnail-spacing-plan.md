# Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iOS/Android `굿즈/행사` 페이지에서 캘린더 아래 선택일/범위 일정 블록을 제거하고, 현재 표시 월의 이벤트를 기존 날짜 섹션 feed에 표시하며, iOS 카드 썸네일과 Android 정책 안내 상단 여백을 개선한다.

**Architecture:** Calendar grid state remains responsible for month navigation and markers. The feed below the calendar becomes month-scoped rather than selected-day/range-scoped. iOS uses existing `HubEvent` image metadata through `HubEventImagePolicy.displayURL(for:)`; Android keeps existing card thumbnail support and adjusts feed/notice layout locally.

**Tech Stack:** SwiftUI, XCTest, Kotlin, Android Views, JUnit, existing mobile model/store code.

**Token Policy:** Use `rtk` for every shell command. Locate code with `rtk rg -n` first, then read only 80-180 line windows with `rtk proxy sed -n`. Do not inspect backend/admin/notification/adapter/Docker/CI files. Do not run install, emulator, simulator, Docker, Playwright, screenshot, or remote sync commands unless the user explicitly requests them.

## Token Cost Minimization Rules

- [ ] Do not re-read whole mobile source files.
- [ ] Read only these files unless a focused test failure points elsewhere:

```text
ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift
ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift
ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift
ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift
android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarViewModel.kt
android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarView.kt
android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt
android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsCalendarViewModelTest.kt
android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt
```

- [ ] Prefer ViewModel tests over UI screenshots.
- [ ] Run focused tests before broader platform tests.
- [ ] Report failures with only the failing test name and minimal error summary.
- [ ] Do not update docs beyond this plan unless implementation discovers a real behavior change not covered here.

## Files

Modify:

- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarViewModel.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarView.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsCalendarViewModelTest.kt`

Modify only if shared helper logic moves there:

- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt`

Do not modify:

- Backend API or DTO schemas.
- OpenAPI files.
- Admin console files.
- Notification/push/preference files.
- Image assets, copied media, logos, screenshots, or binary files.

## Step 1: Locate Current Month/List Logic

- [ ] Run:

```bash
rtk rg -n "visibleEntries|selectedMonth|selectMonth|goToNextMonth|goToPreviousMonth|eventList|선택한 범위|noticeCard|방송/라이브/업로드|HubEventRow|HubEventImagePolicy" ios/StelliveHubiOS/StelliveHubiOS/Views ios/StelliveHubiOS/StelliveHubiOSTests android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub
```

- [ ] Read short windows only around matches:

```bash
rtk proxy sed -n '1,220p' ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift
rtk proxy sed -n '1,260p' ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift
rtk proxy sed -n '1,220p' ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift
rtk proxy sed -n '240,290p' android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarViewModel.kt
rtk proxy sed -n '300,335p' android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarView.kt
rtk proxy sed -n '500,525p' android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt
```

Expected: Confirm selected day/range drives the calendar-local list, and page-level feed can be made month-scoped.

## Step 2: Add Failing iOS ViewModel Tests

- [ ] Modify `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`.
- [ ] Add a test proving selected date no longer controls the month feed:

```swift
func testVisibleMonthEntriesIncludeAllEntriesInSelectedMonth() {
    let viewModel = makeViewModel(days: [
        day("2026-06-13", entries: [entry(id: "june-a")]),
        day("2026-06-20", entries: [entry(id: "june-b")]),
        day("2026-07-07", entries: [entry(id: "july")])
    ])

    viewModel.selectDate(date("2026-06-13"))

    XCTAssertEqual(viewModel.visibleMonthEntries().map(\.id), ["june-a", "june-b"])
}
```

- [ ] Add a test proving month navigation changes the month feed:

```swift
func testVisibleMonthEntriesFollowSelectedMonth() {
    let viewModel = makeViewModel(days: [
        day("2026-06-20", entries: [entry(id: "june")]),
        day("2026-07-07", entries: [entry(id: "july")])
    ])

    viewModel.goToNextMonth()

    XCTAssertEqual(viewModel.visibleMonthEntries().map(\.id), ["july"])
}
```

## Step 3: Verify iOS Tests Fail

- [ ] Run the focused iOS test command if the local scheme is available:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected: FAIL because `visibleMonthEntries()` does not exist.

If local Xcode/simulator is unavailable, record the environment failure and continue with code changes.

## Step 4: Implement iOS Month-Scoped Entries

- [ ] Modify `HubEventsCalendarViewModel.swift`.
- [ ] Add:

```swift
func visibleMonthEntries() -> [HubCalendarEntry]
```

- [ ] It should:

```text
1. Filter `days` by `selectedMonth`.
2. Apply the existing `filterId` logic.
3. Flatten entries by day order.
4. Preserve the existing entry ordering inside each day.
```

- [ ] Keep `visibleEntries()` if other list-mode or date-selection behavior still uses it.
- [ ] Do not remove selection markers or range marker logic.

## Step 5: Remove iOS Calendar-Local Selected Schedule Block

- [ ] Modify `HubEventsCalendarView.swift`.
- [ ] Remove or stop rendering the `eventList` block that shows selected day/range entries and the text `선택한 범위에 표시할 일정이 없습니다.` under the calendar.
- [ ] Keep month grid, date taps, markers, filter controls, and accessibility labels.
- [ ] Expose the selected month to `HubEventsView` if needed through an initializer callback or binding:

```swift
init(days: [HubCalendarDay], onSelectedMonthChange: ((Date) -> Void)? = nil)
```

- [ ] Use the smallest API needed; do not create a new app-wide state model.

## Step 6: Render iOS Page Feed By Selected Month

- [ ] Modify `HubEventsView.swift`.
- [ ] Track selected calendar month for the feed:

```swift
@State private var selectedCalendarMonth = Date()
```

- [ ] Group `serverStore.hubEvents(for: selectedFilter)` by the selected calendar month and render them under existing `yyyy-MM-dd` date headers.
- [ ] Preserve current card composition for date sections.
- [ ] Render `HubEventRow(event:)` for matching `HubEvent` objects so `HubEventRemoteImage` thumbnail support is reused.
- [ ] For special day calendar entries without `HubEvent` objects, keep existing text-only row rendering only if already represented in the page feed; do not invent images.

## Step 7: Ensure iOS Thumbnail Cards Use Existing Policy

- [ ] Verify `HubEventRow` uses:

```swift
HubEventImagePolicy.displayURL(for: event.image)
```

- [ ] If the month feed currently uses `CalendarEntryRow`, switch HubEvent rows to `HubEventRow`.
- [ ] Do not add image assets.
- [ ] Do not display images when `displayURL` returns `nil`.

## Step 8: Add Failing Android ViewModel Tests

- [ ] Modify `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsCalendarViewModelTest.kt`.
- [ ] Add a test proving visible entries include all events in the selected month, not only selected date:

```kotlin
@Test
fun monthVisibleEntriesIncludeAllEventsInSelectedMonth() {
    val viewModel = HubEventsCalendarViewModel(sampleDays(), fixedClock())

    viewModel.selectDay(LocalDate.of(2026, 6, 15))

    assertEquals(
        listOf("goods-open", "ticket-deadline"),
        viewModel.uiState.visibleEntries.map { it.eventId },
    )
}
```

- [ ] Add or update a month-navigation test:

```kotlin
@Test
fun monthNavigationUpdatesVisibleEntriesToTargetMonth() {
    val viewModel = HubEventsCalendarViewModel(
        listOf(
            day("2026-06-20", entry("june", HubEventStatus.UPCOMING)),
            day("2026-07-07", entry("july", HubEventStatus.UPCOMING)),
        ),
        fixedClock(),
    )

    viewModel.goToNextMonth()

    assertEquals(listOf("july"), viewModel.uiState.visibleEntries.map { it.eventId })
}
```

## Step 9: Verify Android Tests Fail

- [ ] Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.HubEventsCalendarViewModelTest
```

Expected: FAIL because `visibleEntries` still follows selected date/range.

## Step 10: Implement Android Month-Scoped Entries

- [ ] Modify `HubEventsCalendarViewModel.kt`.
- [ ] Change `recalculate` so `uiState.visibleEntries` is derived from filtered days whose `LocalDate` is in `state.selectedMonth`.
- [ ] Preserve:

```text
selectedDay
scopeMode
rangeStart/rangeEnd
marker calculations
hasEntries(date)
filter behavior
```

- [ ] Do not remove date selection behavior; it remains useful for markers/accessibility.

## Step 11: Remove Android Calendar-Local Empty/Selected List

- [ ] Modify `HubEventsCalendarView.kt`.
- [ ] Stop adding `entryList(viewModel.uiState.visibleEntries)` directly under the calendar.
- [ ] Remove or leave unused the selected-list empty message path only if no longer referenced.
- [ ] Keep month grid, controls, date taps, and markers.

## Step 12: Keep Android Page Feed Month-Scoped

- [ ] Modify `MainActivity.kt`.
- [ ] Ensure `GOODS_EVENTS` feed below `HubEventsCalendarView` uses the selected month from the calendar or the ViewModel-exposed month entries rather than the old static all-range grouping.
- [ ] Preserve existing `hubEventCard(event)` behavior, including:

```kotlin
thumbnailUrl = event.image?.takeIf(HubEventImagePolicy::canDisplay)?.url
```

- [ ] Do not change event detail navigation.

## Step 13: Add Android Policy Notice Top Spacing

- [ ] Modify `MainActivity.kt` only around the `GOODS_EVENTS` notice placement or local `noticeCard` layout params.
- [ ] Add additional top margin before the yellow notice that starts with:

```text
방송/라이브/업로드와
```

- [ ] Keep existing bottom margin and warning style.
- [ ] Avoid global notice margin changes if they affect loading/error notices.

## Step 14: Verify Focused Tests Pass

- [ ] Run iOS focused tests:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

- [ ] Run Android focused tests:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.HubEventsCalendarViewModelTest
```

Expected: PASS. If iOS simulator is unavailable, report that specific environment limitation.

## Step 15: Run Platform Unit Tests

- [ ] Run iOS unit tests if local simulator is available:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

- [ ] Run Android unit tests:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

Expected: PASS.

## Step 16: Diff Hygiene

- [ ] Run:

```bash
rtk git diff --check
rtk git status --short --branch
```

Expected: Only planned mobile source/test files changed, plus any pre-existing unrelated local changes.

## Manual Verification

Skip unless the user explicitly requests it:

- Do not install the iOS app on iPhone 17 Simulator.
- Do not install Android app on an adb device.
- Do not run screenshot tooling.

When requested later, manually verify:

- iOS month change updates the feed below the calendar.
- iOS event cards show allowed thumbnails.
- Android month change updates the feed below the calendar.
- Android no longer shows the selected-range empty block under the calendar.
- Android yellow policy notice has more top spacing.
