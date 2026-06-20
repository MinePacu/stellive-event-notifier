# Implementation Plan

Implementation Plan > REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Fix iOS/Android `굿즈/행사` month feed so server admin Hub Events appear reliably under the visible calendar month, then simplify the calendar controls because the feed is month-scoped.

**Architecture:** Treat `/v1/hub-events/calendar` entries as the authoritative month feed skeleton and use `/v1/hub-events` only to enrich matching `hub_event` entries with card/detail/image metadata. Mobile clients must request both calendar days and hub events for the same date window so event IDs remain joinable. The calendar UI keeps month navigation and markers, but removes `목록/캘린더` and `일별/기간별` controls from the goods/events page because selected day/range no longer drives the feed.

**Tech Stack:** SwiftUI, XCTest, Kotlin, Android Views, JUnit, Retrofit DTOs, existing Fastify read API query parameters.

## Token Cost Minimization

- Use `rtk` for every shell command.
- Locate symbols with `rtk rg -n` before reading files.
- Read only short `rtk proxy sed -n '<start>,<end>p'` windows around matches.
- Do not inspect backend admin, notification, Docker, CI, OpenAPI, generated files, assets, or unrelated mobile screens.
- Do not run emulator/simulator manual checks, screenshot tooling, Docker, remote sync, or installs unless explicitly requested after implementation.
- Prefer focused tests first; run broad platform tests only after focused tests pass.
- Keep handoffs compact if using subagents: one scout, one iOS worker, one Android worker is enough.

## Current Failure Model

- The summary cards count `HubEvent` list items.
- The month feed renders `HubCalendarDay.entries`.
- Android currently drops a feed card when `eventsById[entry.eventId]` is missing, leaving a date header with no event card.
- iOS currently filters calendar entries against `hubEvents(for:)`; if the calendar entry and event list are out of sync, the month feed can become empty while the summary still shows `예정 1`.
- The immediate fix is not a backend schema change. Existing APIs already support `from` and `to` on `/v1/hub-events`; mobile clients must pass the same window used for `/v1/hub-events/calendar`.

## Files

Modify:

```text
ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift
ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift
ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift
ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift
ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift
ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift
android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/network/HubApi.kt
android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/HubRepository.kt
android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MockHubRepository.kt
android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/ServerHubRepository.kt
android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarView.kt
android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarViewModel.kt
android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt
android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ServerHubRepositoryTest.kt
android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsCalendarViewModelTest.kt
```

Do not modify:

```text
backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts
backend/stellive-hub-api/src/admin/adminConsoleHtml.ts
shared/openapi/openapi.yaml
image assets, screenshots, logos, binary files
notification, preference, push, adapter, Docker, or CI files
```

## Step 1: Locate Existing Join Points

- [ ] Run:

```bash
rtk rg -n "refreshHubEvents|refreshCalendar|calendarDays\\(for|hubEvents\\(for|HubEventsCalendarView\\(|selectedMonthCalendarDays|renderServerGoodsEvents|goodsEventsSelectedMonth|hubCalendarDays|hubEvents\\(" ios/StelliveHubiOS/StelliveHubiOS android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub
```

- [ ] Read short windows around:

```bash
rtk proxy sed -n '45,120p' ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift
rtk proxy sed -n '250,282p' ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift
rtk proxy sed -n '55,135p' ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift
rtk proxy sed -n '48,90p' android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/ServerHubRepository.kt
rtk proxy sed -n '19,32p' android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/HubRepository.kt
rtk proxy sed -n '532,575p' android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt
```

Expected: Confirm mobile clients call calendar with `from/to`, but event list without matching `from/to`.

## Step 2: Add Android Repository Range Test

- [ ] Modify `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ServerHubRepositoryTest.kt`.
- [ ] Add a focused test proving `ServerHubRepository.hubEvents(...)` forwards `from` and `to` when provided.
- [ ] Expected assertion: the fake `RemoteDataSource.hubEvents(...)` receives ISO dates matching the calendar range.
- [ ] Keep the existing default `hubEvents(filterId)` call valid for other screens.

Run:

```bash
cd android/StelliveHubAndroid && rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.ServerHubRepositoryTest
```

Expected: FAIL before implementation because the repository interface does not expose range parameters.

## Step 3: Implement Android Range-Aware Hub Events Fetch

- [ ] Modify `HubRepository.kt` so `hubEvents` accepts optional `from: LocalDate? = null` and `to: LocalDate? = null`.
- [ ] Modify `ServerHubRepository.kt` to pass `from?.format(DateTimeFormatter.ISO_LOCAL_DATE)` and `to?.format(...)` into `remoteDataSource.hubEvents(...)`.
- [ ] Keep `limit = 100`.
- [ ] Modify `MockHubRepository.kt` to accept the new parameters and filter mock events by overlap when both dates are present.
- [ ] Do not change Retrofit DTO shape or backend API contracts; `HubApi.kt` already has nullable `from` and `to` query parameters.

Run:

```bash
cd android/StelliveHubAndroid && rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.ServerHubRepositoryTest
```

Expected: PASS.

## Step 4: Make Android Month Feed Calendar-Entry First

- [ ] Modify `MainActivity.kt`.
- [ ] In `loadServerGoodsEvents`, compute one date window and use it for both calls:

```text
val from = today.minusMonths(1)
val to = today.plusMonths(3)
serverRepository.hubCalendarDays(from, to, "Asia/Seoul")
serverRepository.hubEvents("all", from, to)
```

- [ ] In `renderServerGoodsEvents`, keep `monthDays = days.filter { it.date.take(7) == goodsEventsSelectedMonth.toString() }`.
- [ ] Render every `monthDays` entry.
- [ ] If `eventsById[entry.eventId]` exists, render `hubEventCard(event)` to preserve thumbnails/detail navigation.
- [ ] If the event is missing, render an existing calendar entry row or a small local text row from `entry.title`, `entry.displayDate`, and `entry.displayTimeText`; it must still navigate only when `HubCalendarDeepLinkPolicy.canNavigateToDetail(entry)` and a matching event/detail path is available.
- [ ] Do not leave a date header without at least one visible entry row.

## Step 5: Simplify Android Calendar Controls For Goods/Events

- [ ] Modify `HubEventsCalendarView.kt` with the smallest constructor flag needed, for example `showModeControls: Boolean = true`.
- [ ] From `MainActivity.kt`, pass `showModeControls = false` for goods/events.
- [ ] When `showModeControls` is false, do not render:

```text
목록/캘린더 segmented control
일별/기간별 segmented control
list date navigation header
selected day/range local entry list
```

- [ ] Keep month control, weekday header, month grid, markers, date taps, and accessibility labels.
- [ ] Preserve `HubEventsCalendarViewModel.visibleEntries` day/range semantics for tests and any future list navigation usage.

Run:

```bash
cd android/StelliveHubAndroid && rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.HubEventsCalendarViewModelTest
cd android/StelliveHubAndroid && rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.ListDateNavigationViewModelTest
```

Expected: PASS.

## Step 6: Add iOS Range Fetch Test Or Store-Level Assertion

- [ ] Prefer an existing `ServerHubStore` or API client test if present.
- [ ] If no store-level test exists, add a focused `HubEventsCalendarViewModelTests` case for month entries and document that network range forwarding is covered by Android repository tests in this change.
- [ ] Test the month-feed invariant: selecting a date does not change visible month entries.
- [ ] Test the missing event metadata invariant at view-model/helper level if a helper is introduced: calendar entry remains visible even when no `HubEvent` match exists.

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected: FAIL before helper/view-model change if the helper does not exist; otherwise PASS after test-only assertion wiring.

## Step 7: Implement iOS Range-Aware Refresh

- [ ] Modify `ServerHubStore.refreshHubEvents(filter:from:to:)` to accept optional `Date` range.
- [ ] Forward `from` and `to` into `HubAPIClient.hubEvents(...)`; the API client already supports nullable `from` and `to`.
- [ ] In `HubEventsView.refreshServerHubEvents()`, compute one Asia/Seoul-backed window and use it for both:

```text
serverStore.refreshHubEvents(filter: selectedFilter, from: from, to: to)
serverStore.refreshCalendar(from: from, to: to, timezone: Asia/Seoul)
```

- [ ] Keep existing fallback behavior when server calls fail.

## Step 8: Make iOS Month Feed Calendar-Entry First

- [ ] Modify `HubEventsView.swift`.
- [ ] Build the feed from `selectedMonthCalendarDays`, not from `hubEvents` alone.
- [ ] For each `HubCalendarEntry`:
  - If matching `HubEvent` exists, render `HubEventRow(event:)` so thumbnail policy remains `HubEventImagePolicy.displayURL(for:)`.
  - If matching `HubEvent` does not exist, render the existing `HubCalendarRow(entry:)` text row.
- [ ] Keep detail navigation only when a matching `HubEvent` exists.
- [ ] Keep the empty state only when the selected month has no calendar entries.

## Step 9: Simplify iOS Calendar Controls For Goods/Events

- [ ] Modify `HubEventsCalendarView.swift`.
- [ ] Remove or hide the `목록/캘린더` and `일별/기간별` controls for the goods/events usage.
- [ ] Keep month navigation, weekday header, month grid, markers, date taps, and accessibility labels.
- [ ] Preserve `HubEventsCalendarViewModel.visibleEntries()` and selected day/range methods unless they are proven unused outside this view.
- [ ] Ensure `selectedMonth` binding still updates when user moves between months.

## Step 10: Focused Validation

- [ ] Run Android focused repository and calendar tests:

```bash
cd android/StelliveHubAndroid && rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.ServerHubRepositoryTest
cd android/StelliveHubAndroid && rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.HubEventsCalendarViewModelTest
cd android/StelliveHubAndroid && rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.ListDateNavigationViewModelTest
```

- [ ] Run iOS focused tests:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected: all focused tests pass. If iOS simulator is unavailable, record the environment error and continue only after Android focused tests pass.

## Step 11: Broad Validation

- [ ] Run Android unit tests:

```bash
cd android/StelliveHubAndroid && rtk ./gradlew :app:testDebugUnitTest
```

- [ ] Run iOS unit tests when simulator is available:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

- [ ] Run formatting/diff checks:

```bash
rtk git diff --check
rtk git status --short --branch
```

Expected: tests pass, no whitespace errors, and changed files are limited to the files listed in this plan unless a focused failure justifies a narrow additional test/helper file.

## Acceptance Criteria

- iOS and Android show the 2026-07-11 Hub Event in the July month feed when the server admin DB contains that event.
- Summary counts and month feed no longer disagree because one response is range-scoped and the other is not.
- A calendar entry without matching event metadata still renders as a visible text row instead of disappearing.
- Event rows with matching `HubEvent` keep existing thumbnail behavior.
- `목록/캘린더` and `일별/기간별` controls are hidden or removed from the goods/events calendar UI.
- Date taps, selected day/range state, markers, highlighting, and accessibility can remain internally, but selected day/range does not control the goods/events main feed.
- No backend schema, OpenAPI, admin console, notification, asset, logo, screenshot, Docker, or CI changes are included.
