Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Android and iOS Hub Events screens from rendering duplicate event cards when a multi-day calendar entry appears on multiple dates.

**Architecture:** Keep the backend `/v1/hub-events/calendar` DTO unchanged because date-expanded entries are required for calendar markers and duration bars. Add client-side list projection dedupe by `eventId` only for card/list views that aggregate multiple dates. Preserve per-date entries for day cells, duration bar layout, markers, and single-day selection.

**Tech Stack:** Kotlin Android view model/policy tests, Swift iOS view model tests, existing mobile calendar models, Gradle unit tests, Xcode XCTest.

## Root Cause

The admin console lists canonical `HubEvent` rows, so one event appears once. The mobile apps consume `/v1/hub-events/calendar`, where the server intentionally expands a multi-day event into multiple `HubCalendarEntry` records with ids like `<eventId>:<date>`. Android `CalendarUiPolicy.entriesForRange()` and iOS `HubEventsCalendarViewModel.entries(in:)` flatten date entries directly into visible card lists, so the same `eventId` can appear multiple times.

Do not fix this by changing server calendar expansion. Calendar cells and duration bars need date-level entries.

## Files

Modify:

- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsCalendarViewModelTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`
- `docs/AI_HANDOFF.md`

Do not modify:

- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`
- `shared/schemas/domain.ts`
- `shared/openapi/openapi.yaml`

## Token-Minimal Context Commands

- [ ] Confirm current relevant code only:

```bash
rtk rg -n "entriesForRange|entriesForDay|entryComparator|visibleEntries|selectedMonthEntries|entries\\(in range" android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar ios/StelliveHubiOS/StelliveHubiOS/Views
```

- [ ] Read only exact function ranges found by `rg`:

```bash
rtk sed -n '360,390p' android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt
rtk sed -n '248,282p' ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift
rtk sed -n '572,586p' ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift
```

Avoid broad `git diff` and broad test output until the focused tests are green. Use `rtk git diff --stat` and focused test commands first.

## Token Usage Minimization Rules

- [ ] Prefix every shell command with `rtk`. If a command must run unfiltered for debugging, use `rtk proxy <command>` and keep the command scoped to one file, one test class, or one API response.
- [ ] Prefer `rtk rg -n` to locate exact symbols, then read only the returned line ranges with `rtk sed -n`. Do not read full Android/iOS view files unless a focused range is insufficient.
- [ ] Use `rtk git diff --stat`, `rtk git diff --name-only`, and `rtk git diff --check` before using full `rtk git diff`. If full diff is needed, limit it to the touched files.
- [ ] Keep RED/GREEN verification focused:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest --tests dev.stellive.hub.HubEventsCalendarViewModelTest
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

- [ ] Run broad Android/iOS build or app install only after focused tests pass or when validating final device behavior. Do not repeat full builds after doc-only edits.
- [ ] For live-server confirmation, query only the public calendar window needed to reproduce the duplicate and summarize by `eventId`; do not paste full JSON responses into notes or chat.
- [ ] Keep `docs/AI_HANDOFF.md` updates to one compact paragraph with root cause, files changed, and verification results. Avoid copying test logs; record command names and pass/fail counts only.
- [ ] Ignore generated or cache paths during investigation and commits, especially `android/StelliveHubAndroid/.kotlin/`, `.gradle/`, `build/`, `DerivedData/`, and `node_modules/`.

## Step 1: Add Android Failing Policy Test

- [ ] In `CalendarUiPolicyTest.kt`, add a test near existing `entriesForRange` coverage:

```kotlin
@Test
fun entriesForRangeDeduplicatesMultiDayCalendarEntriesByEventId() {
    val first = calendarEntry("goods-range").copy(
        id = "goods-range:2026-06-19",
        displayDate = "2026-06-19",
        startsAt = "2026-06-19T01:00:00.000Z",
        endsAt = "2026-07-02T14:59:00.000Z"
    )
    val second = first.copy(
        id = "goods-range:2026-06-20",
        displayDate = "2026-06-20"
    )
    val days = listOf(
        HubCalendarDay("2026-06-19", listOf(first)),
        HubCalendarDay("2026-06-20", listOf(second))
    )

    val entries = CalendarUiPolicy.entriesForRange(
        days,
        LocalDate.of(2026, 6, 19),
        LocalDate.of(2026, 6, 20)
    )

    assertEquals(listOf("goods-range"), entries.map { it.eventId })
    assertEquals("goods-range:2026-06-19", entries.single().id)
}
```

- [ ] Run and expect RED:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
```

Expected failure: duplicate `goods-range` entries are returned.

## Step 2: Implement Android List Dedupe

- [ ] In `CalendarUiPolicy.kt`, add a private helper inside `CalendarUiPolicy`:

```kotlin
private fun List<HubCalendarEntry>.distinctByEventIdInDisplayOrder(): List<HubCalendarEntry> {
    val seen = linkedSetOf<String>()
    return filter { entry -> seen.add(entry.eventId) }
}
```

- [ ] Update `entriesForRange()` only:

```kotlin
return days
    .asSequence()
    .filter { LocalDate.parse(it.date) in range }
    .flatMap { it.entries.asSequence() }
    .sortedWith(entryComparator)
    .toList()
    .distinctByEventIdInDisplayOrder()
```

Keep `entriesForDay()` unchanged so same-day admin duplicates, if intentionally distinct by id but same eventId is impossible under normal server output, are not changed more broadly than needed.

## Step 3: Add Android ViewModel Regression Test

- [ ] In `HubEventsCalendarViewModelTest.kt`, add a range selection test that uses two `HubCalendarDay` records containing the same `eventId` with date-suffixed ids.
- [ ] Assert `viewModel.uiState.visibleEntries.map { it.eventId } == listOf("goods-range")` after selecting a range covering both dates.
- [ ] Run focused Android tests:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest --tests dev.stellive.hub.HubEventsCalendarViewModelTest
```

Expected: PASS.

## Step 4: Add iOS Failing ViewModel Test

- [ ] In `HubEventsCalendarViewModelTests.swift`, add a test near existing range selection tests:

```swift
func testVisibleEntriesDeduplicatesMultiDayCalendarEntriesByEventId() {
    let first = entry(
        id: "goods-range:2026-06-19",
        eventId: "goods-range",
        startsAt: date("2026-06-19"),
        endsAt: date("2026-07-02")
    )
    let second = entry(
        id: "goods-range:2026-06-20",
        eventId: "goods-range",
        startsAt: date("2026-06-19"),
        endsAt: date("2026-07-02")
    )
    let viewModel = makeViewModel(
        selectedDay: date("2026-06-19"),
        days: [
            day("2026-06-19", entries: [first]),
            day("2026-06-20", entries: [second])
        ]
    )

    viewModel.applySelectedRange(start: date("2026-06-19"), end: date("2026-06-20"))

    XCTAssertEqual(viewModel.visibleEntries().map(\.eventId), ["goods-range"])
    XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["goods-range:2026-06-19"])
}
```

- [ ] If the local `entry(...)` helper does not accept `eventId`, extend only the helper signature:

```swift
private func entry(
    id: String,
    eventId: String? = nil,
    category: HubEventCategory = .onlineGoods,
    participationMode: HubEventParticipationMode = .online,
    status: HubEventStatus = .open,
    startsAt: Date? = nil,
    endsAt: Date? = nil
) -> HubCalendarEntry
```

Use `eventId: eventId ?? id` inside the helper.

- [ ] Run and expect RED:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected failure: duplicate `goods-range` entries are returned. If CoreSimulator is unavailable in sandbox, record the failure and use XcodeBuildMCP `build_run_sim` or the existing simulator workflow for the final app run.

## Step 5: Implement iOS List Dedupe

- [ ] In `HubEventsCalendarViewModel.swift`, add a private helper:

```swift
private func deduplicatedByEventId(_ entries: [HubCalendarEntry]) -> [HubCalendarEntry] {
    var seen = Set<String>()
    return entries.filter { entry in
        seen.insert(entry.eventId).inserted
    }
}
```

- [ ] Update `entries(in range:)`:

```swift
return deduplicatedByEventId(result.sorted(by: HubCalendarPolicy.areInDisplayOrder))
```

- [ ] Update `selectedMonthEntries()` the same way because list mode can aggregate the selected month:

```swift
return deduplicatedByEventId(
    days
        .sorted { $0.date < $1.date }
        .filter { day in
            guard let date = Self.dayKeyFormatter.date(from: day.date) else { return false }
            return calendar.isDate(date, equalTo: selectedMonth, toGranularity: .month)
        }
        .flatMap { filteredEntries(from: $0.entries) }
)
```

Keep `entries(on:)`, marker logic, and `durationBarLayout()` unchanged.

## Step 6: Verify iOS Focused Tests

- [ ] Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected: PASS. If sandbox blocks CoreSimulator, run the available XcodeBuildMCP simulator build/test path and record the exact simulator name/id used.

## Step 7: Manual App Verification

- [ ] Build and run iOS on `iPhone 17 Pro` using the existing simulator workflow.
- [ ] Build Android and install to the connected adb device with the simplified flow:

```bash
rtk ./gradlew :app:assembleDebug
rtk adb devices
rtk adb -s <device-id> install -r android/StelliveHubAndroid/app/build/outputs/apk/debug/app-debug.apk
rtk adb -s <device-id> shell am start -n dev.stellive.hub/.MainActivity
```

- [ ] Open Goods/Events.
- [ ] Confirm the Pulsar event appears once in the card list for the selected range/month.
- [ ] Confirm the duration bar still spans the visible date range in the calendar.

## Step 8: Policy And Regression Checks

- [ ] Run token-minimal policy grep:

```bash
rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|profileImageUrl|posterUrl|logoUrl|rawPayload|providerResponse|NID_AUT|NID_SES|login-cookie|cookie scraping" android/StelliveHubAndroid/app ios/StelliveHubiOS docs/superpowers/plans/2026-06-21-calendar-event-card-dedupe-code-design.md
```

Expected: no new prohibited implementation references beyond existing policy/test exclusions.

- [ ] Run whitespace check:

```bash
rtk git diff --check
```

Expected: no output.

## Step 9: Handoff

- [ ] Update `docs/AI_HANDOFF.md` with:
  - Root cause: backend calendar expands multi-day events per date, mobile list views did not dedupe by `eventId`.
  - Files changed.
  - Focused Android/iOS verification commands and results.
  - Manual build/run result for iPhone 17 Pro and adb device if performed.

## Step 10: Commit

- [ ] Commit only relevant code, tests, and handoff docs. Do not include generated folders such as `android/StelliveHubAndroid/.kotlin/`.

```bash
rtk git add android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsCalendarViewModelTest.kt ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift docs/AI_HANDOFF.md
rtk sh -lc "printf '%s\n' 'fix: dedupe hub event calendar cards' '- Dedupe range and month event card lists by canonical eventId' '- Preserve date-expanded calendar entries for markers and duration bars' '- Cover Android and iOS calendar list duplicate regressions' > /private/tmp/commit_msg && rtk git commit -F /private/tmp/commit_msg"
```
