Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicate multi-day event cards from Android/iOS Goods/Events feeds and make iOS feed thumbnails stable by rendering feed cards from canonical `HubEvent` data instead of raw date-expanded calendar entries.

**Architecture:** Keep backend `/v1/hub-events/calendar` date expansion unchanged because calendar markers and duration bars depend on per-date `HubCalendarEntry` records. Fix mobile feed projections: flatten selected-month calendar entries in visible order, dedupe globally by `eventId`, and resolve each hub-event entry to canonical `HubEvent` before rendering a card. Fix mobile filter queries so built-in UI filters (`goods`, `ticketing`, `offline`, `closing`) do not get sent as backend `generationId`, which can leave canonical event caches empty and force image-less calendar-row fallback.

**Tech Stack:** Android Kotlin `MainActivity`, `CalendarUiPolicy`, `ServerHubRepository`, JUnit/Gradle unit tests; iOS SwiftUI `HubEventsView`, `ServerHubStore`, XCTest; existing TypeScript backend only for verification, not implementation.

## Root Cause

Server canonical event list is not duplicated. `/v1/hub-events` returns one row per event and includes `HubEvent.image` metadata for the affected events.

Server calendar projection intentionally expands multi-day events into date-level `HubCalendarEntry` records. Live server checks showed the Pulsar event appears many times in June calendar data because it spans `2026-06-19` through `2026-07-02`; this is correct for calendar bars but wrong for a feed card list unless the client dedupes by `eventId`.

Previous dedupe fixed `HubEventsCalendarViewModel.visibleEntries()` and Android range-selection entries, but the actual Goods/Events feed uses a separate path:

- Android `MainActivity.renderServerGoodsEvents()` iterates `repository.calendarDaysForFilter("all").forEach { day.entries.forEach ... }`.
- iOS `HubEventsView.selectedMonthCalendarDays` iterates `ForEach(day.entries)` and falls back to `HubCalendarRow` when `serverStore.cachedHubEvent(id:)` is missing.

iOS thumbnail intermittency comes from that fallback: `HubCalendarEntry` has no `image` field, so if canonical `HubEvent` cache resolution misses or is not loaded yet, the row is rendered without a thumbnail. Built-in filter ids are also incorrectly passed as `generationId` in Android and iOS event-list fetches, which can make canonical event cache misses more likely for non-`all` filters.

## Files

Modify:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`
- `docs/AI_HANDOFF.md`

Do not modify:

- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`
- `shared/schemas/domain.ts`
- `shared/openapi/openapi.yaml`

## Token Usage Rules

- [ ] Prefix every shell command with `rtk`.
- [ ] Locate symbols with `rtk rg -n`, then read only exact line ranges with `rtk sed -n`.
- [ ] Prefer `rtk git diff --stat`, `rtk git diff --name-only`, and file-scoped diffs over broad full diffs.
- [ ] Keep RED/GREEN checks focused on the touched Android/iOS test classes before any broad build.
- [ ] For live server checks, summarize by `eventId` counts or selected fields only. Do not paste full JSON.
- [ ] Do not include generated folders in commits, especially `android/StelliveHubAndroid/.kotlin/`, `.gradle/`, `build/`, `DerivedData/`, or `node_modules/`.

## Step 1: Confirm Current Feed Paths

- [ ] Run:

```bash
rtk rg -n "renderServerGoodsEvents|calendarDaysForFilter|hubEventCard|selectedMonthCalendarDays|ForEach\\(day.entries|cachedHubEvent|HubCalendarRow|HubEventRow" android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift
```

- [ ] Expected finding:
  Android feed directly iterates date-expanded calendar entries in `MainActivity`.
  iOS feed directly iterates date-expanded calendar entries in `HubEventsView`.

## Step 2: Add Android Feed Projection Test

- [ ] In `CalendarUiPolicyTest.kt`, add a test for a new helper that preserves first visible occurrence and dedupes by `eventId`:

```kotlin
@Test
fun feedEntriesForMonthDeduplicatesByEventIdAndKeepsFirstVisibleDate() {
    val first = calendarEntry("goods-range").copy(
        id = "goods-range:2026-06-19",
        displayDate = "2026-06-19",
        startsAt = Instant.parse("2026-06-19T01:00:00Z"),
        endsAt = Instant.parse("2026-07-02T14:59:00Z"),
    )
    val second = first.copy(id = "goods-range:2026-06-20", displayDate = "2026-06-20")
    val other = calendarEntry("ticket").copy(id = "ticket:2026-06-20", displayDate = "2026-06-20")

    val rows = CalendarUiPolicy.feedEntriesForMonth(
        days = listOf(
            HubCalendarDay("2026-06-19", listOf(first)),
            HubCalendarDay("2026-06-20", listOf(second, other)),
        ),
        month = YearMonth.of(2026, 6),
    )

    assertEquals(listOf("goods-range", "ticket"), rows.map { it.entry.eventId })
    assertEquals("2026-06-19", rows.first().day.date)
}
```

- [ ] Run and expect RED:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.CalendarUiPolicyTest
```

Expected: compile failure because `feedEntriesForMonth` does not exist.

## Step 3: Implement Android Feed Projection Helper

- [ ] In `CalendarUiPolicy.kt`, add:

```kotlin
data class CalendarFeedEntry(
    val day: HubCalendarDay,
    val entry: HubCalendarEntry,
)
```

- [ ] Add helper inside `CalendarUiPolicy`:

```kotlin
fun feedEntriesForMonth(days: List<HubCalendarDay>, month: YearMonth): List<CalendarFeedEntry> {
    val seen = linkedSetOf<String>()
    return days
        .asSequence()
        .filter { YearMonth.from(LocalDate.parse(it.date)) == month }
        .flatMap { day -> day.entries.asSequence().map { entry -> CalendarFeedEntry(day, entry) } }
        .filter { row -> seen.add(row.entry.eventId) }
        .toList()
}
```

- [ ] Keep `entriesForRange()` unchanged; this helper is only for the Goods/Events feed.

## Step 4: Apply Android Feed Projection In UI

- [ ] In `MainActivity.renderServerGoodsEvents(days, events)`, build an event map:

```kotlin
val eventsById = events.associateBy { it.id }
val feedEntries = CalendarUiPolicy.feedEntriesForMonth(
    days = repository.calendarDaysForFilter("all"),
    month = goodsEventsSelectedMonth,
)
```

- [ ] Replace the direct `calendarDaysForFilter("all").forEach { day -> day.entries.forEach { entry -> ... } }` loop with `feedEntries.forEach`.
- [ ] Add a header only when the computed header changes from the previously rendered row:

```kotlin
var previousHeader: String? = null
for (row in feedEntries) {
    val header = calendarDayHeaderText(row.day)
    if (header != previousHeader) {
        binding.contentList.addView(calendarDayHeader(header))
        previousHeader = header
    }
    eventsById[row.entry.eventId]?.let { event ->
        binding.contentList.addView(hubEventCard(event))
    }
}
```

- [ ] Do not render image-less fallback cards for `hub_event` entries when the canonical event is missing. The canonical list request should be fixed in later steps; missing canonical events should not create duplicate or no-thumbnail feed rows.

## Step 5: Add Android Filter Query Regression Test

- [ ] In `ServerHubRepositoryTest.kt`, add a test that calls `repository.hubEvents("goods", from, to)` and asserts the remote `generationId` argument is `null`.
- [ ] Add similar assertions for `"ticketing"`, `"offline"`, and `"closing"` if the existing `RecordingRemoteDataSource` makes this cheap.
- [ ] Run and expect RED if the current implementation still sends `generationId = "goods"`:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest
```

## Step 6: Fix Android Filter Query

- [ ] In `ServerHubRepository.kt`, add:

```kotlin
private val builtInHubEventFilters = setOf("all", "goods", "ticketing", "offline", "closing")
```

- [ ] Change event-list fetch generation id:

```kotlin
generationId = filterId.takeUnless { it in builtInHubEventFilters }
```

- [ ] Keep local filtering through `fallback.hubEvents(filterId, from, to)` or repository filter logic unchanged.

## Step 7: Verify Android Focused Tests

- [ ] Run:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.CalendarUiPolicyTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest
```

Expected: PASS.

## Step 8: Add iOS Feed Projection Test

- [ ] In `HubEventsCalendarViewModelTests.swift` or a new `HubEventsViewFeedPolicyTests.swift` test file, add a Swift helper test for a new feed projection function.
- [ ] The test should create two `HubCalendarDay` values containing the same `eventId` on consecutive June dates and assert only the first visible row remains.
- [ ] Expected API:

```swift
let rows = HubEventsFeedPolicy.rowsForMonth(
    days: days,
    selectedMonth: date("2026-06-01"),
    calendar: calendar
)
XCTAssertEqual(rows.map(\.entry.eventId), ["goods-range", "ticket"])
XCTAssertEqual(rows.first?.day.date, "2026-06-19")
```

- [ ] Run and expect RED:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected: compile failure because `HubEventsFeedPolicy` does not exist.

## Step 9: Implement iOS Feed Projection

- [ ] In `HubEventsView.swift`, add private helper types near the view:

```swift
private struct HubEventsFeedRow: Identifiable {
    let day: HubCalendarDay
    let entry: HubCalendarEntry

    var id: String { entry.eventId }
}

enum HubEventsFeedPolicy {
    static func rowsForMonth(days: [HubCalendarDay], selectedMonth: Date, calendar: Calendar) -> [HubEventsFeedRow] {
        var seen = Set<String>()
        return days
            .sorted { $0.date < $1.date }
            .filter { day in
                guard let date = HubEventsView.calendarDayFormatter.date(from: day.date) else { return false }
                return calendar.isDate(date, equalTo: selectedMonth, toGranularity: .month)
            }
            .flatMap { day in day.entries.map { HubEventsFeedRow(day: day, entry: $0) } }
            .filter { row in seen.insert(row.entry.eventId).inserted }
    }
}
```

- [ ] If access control blocks `calendarDayFormatter`, keep the helper private and colocated in `HubEventsView.swift`, or pass a date parser closure in tests. Do not move shared models or backend schema.

## Step 10: Apply iOS Feed Projection And Canonical Card Rendering

- [ ] Replace `selectedMonthCalendarDays` usage in feed rendering with `selectedMonthFeedRows`.
- [ ] Group headers by `calendarDayHeaderTitle(for: row.day)`, emitting a header when it changes.
- [ ] For `row.entry.entryKind == .hubEvent`, render only if `serverStore.cachedHubEvent(id: row.entry.eventId)` exists:

```swift
if let event = serverStore.cachedHubEvent(id: row.entry.eventId) {
    if HubCalendarDeepLinkPolicy.canNavigateToDetail(row.entry) {
        HubEventNavigationRow(event: event)
    } else {
        HubEventRow(event: event)
    }
}
```

- [ ] Render `HubCalendarRow(entry:)` only for non-`hubEvent` entry kinds. This prevents image-less fallback rows for canonical events and removes thumbnail intermittency caused by cache miss fallback.
- [ ] Update the empty-state condition to use the projected feed rows.

## Step 11: Add iOS Filter Query Regression Test

- [ ] In `HubAPIClientTests.swift`, add `ServerHubStoreTests.testRefreshHubEventsDoesNotSendBuiltInFilterAsGenerationId`.
- [ ] Stub request handler should parse `URLComponents` and assert `generationId` is absent when calling:

```swift
await store.refreshHubEvents(filter: "goods")
```

- [ ] Run and expect RED if current implementation sends `generationId=goods`.

## Step 12: Fix iOS Filter Query

- [ ] In `ServerHubStore.swift`, add:

```swift
private let builtInHubEventFilters: Set<String> = ["all", "goods", "ticketing", "offline", "closing"]
```

- [ ] Change:

```swift
let generationId = filter == "all" ? nil : filter
```

to:

```swift
let generationId = builtInHubEventFilters.contains(filter) ? nil : filter
```

- [ ] Keep `filteredServerHubEvents(for:)` as the local filter authority.

## Step 13: Verify iOS Focused Tests

- [ ] Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests -only-testing:StelliveHubiOSTests/ServerHubStoreTests
```

Expected: PASS. If simulator destination is ambiguous, use id `89B0B46A-8515-47E7-A122-681498F16C66`.

## Step 14: Server Contract Verification

- [ ] Confirm canonical events are unique and include image metadata:

```bash
rtk node -e "const r=await fetch('http://192.168.50.9:4000/v1/hub-events?limit=100'); const d=await r.json(); console.log(d.items.map(e=>({id:e.id,title:e.title,image:!!e.image})))"
```

- [ ] Confirm calendar remains date-expanded:

```bash
rtk node -e "const r=await fetch('http://192.168.50.9:4000/v1/hub-events/calendar?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&timezone=Asia/Seoul&includeSpecialDays=false'); const d=await r.json(); const c={}; for (const day of d.days) for (const e of day.entries) c[e.eventId]=(c[e.eventId]||0)+1; console.log(Object.entries(c).filter(([,n])=>n>1))"
```

Expected: `/v1/hub-events` unique; `/calendar` still date-expanded. No backend code change required.

## Step 15: Manual Install Verification

- [ ] Android:

```bash
rtk ./gradlew :app:assembleDebug
rtk adb devices
rtk adb -s <device-id> install -r android/StelliveHubAndroid/app/build/outputs/apk/debug/app-debug.apk
rtk adb -s <device-id> shell am start -n dev.minepacu.stelliveeventnotifier/.MainActivity
```

- [ ] iOS:

```bash
rtk xcodebuild -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,id=89B0B46A-8515-47E7-A122-681498F16C66" build
rtk xcrun simctl install 89B0B46A-8515-47E7-A122-681498F16C66 /Users/nohyunsoo/Library/Developer/Xcode/DerivedData/StelliveHubiOS-bqykihpjocagvibpaqxoikpqcsjv/Build/Products/Debug-iphonesimulator/StelliveHubiOS.app
```

- [ ] In both apps, open Goods/Events for June 2026.
- [ ] Confirm each multi-day event appears once in the feed.
- [ ] Confirm iOS feed hub-event cards use `HubEventRow` with thumbnails when canonical event image metadata is available.
- [ ] Confirm calendar duration bars still span each visible date range.

## Step 16: Policy And Diff Checks

- [ ] Run:

```bash
rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|profileImageUrl|posterUrl|logoUrl|rawPayload|providerResponse|NID_AUT|NID_SES|login-cookie|cookie scraping" android/StelliveHubAndroid/app ios/StelliveHubiOS docs/superpowers/plans/2026-06-21-calendar-feed-canonical-event-dedupe-code-design.md
rtk git diff --check
rtk git diff --stat
```

Expected: only existing policy/model/test references; no whitespace errors.

## Step 17: Handoff

- [ ] Update `docs/AI_HANDOFF.md` with one compact paragraph:
  Root cause, files changed, Android/iOS focused test results, server contract verification result, and device/simulator install result if performed.

## Step 18: Commit

- [ ] Commit only relevant source/test/docs files. Exclude generated paths and unrelated dirty files.

```bash
rtk git add android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarUiPolicy.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift docs/AI_HANDOFF.md docs/superpowers/plans/2026-06-21-calendar-feed-canonical-event-dedupe-code-design.md
rtk sh -lc "printf '%s\n' 'fix: render hub event feed from canonical events' '- Dedupe Goods/Events feed rows by canonical eventId' '- Use canonical HubEvent cards for feed thumbnails instead of image-less calendar fallbacks' '- Stop sending built-in UI filters as backend generationId values' > /private/tmp/commit_msg && rtk git commit -F /private/tmp/commit_msg"
```
