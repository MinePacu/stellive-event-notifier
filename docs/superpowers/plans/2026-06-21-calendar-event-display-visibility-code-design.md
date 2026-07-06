Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Android and iOS `굿즈/행사` calendar readability by making multi-day/ranged events distinct from single-day events and by increasing event-dot visibility on small screens.

**Architecture:** Keep the calendar as a read-only projection of server-normalized `HubCalendarEntry` data. Derive range/dot/status display metadata in platform-local calendar policy/view-model code, then keep Android View and SwiftUI date-cell rendering thin. Do not add new ingestion, notification, external API, image, logo, or schedule-creation behavior.

**Tech Stack:** Kotlin, Android View system, Android unit tests, Swift, SwiftUI, XCTest, TypeScript/Fastify contract verification only if DTO assumptions need to be rechecked.

## Linked Issues

GitHub:

- `#46` `(안드로이드, 아이폰) 굿즈/행사 캘린더의 기간제 행사 표시 개선`
  - 기간이 있는 행사와 단일 일정을 더 잘 구분되도록 캘린더 표시를 개선한다.
  - 날짜 셀, 범위 표시, 상태 문구의 시인성을 높인다.
  - URL: https://github.com/MinePacu/stellive-event-notifier/issues/46
- `#47` `(안드로이드, 아이폰) 굿즈/행사 캘린더 일정 점 시인성 개선`
  - 일정이 있는 날짜 아래 점의 크기와 가시성을 개선한다.
  - 작은 화면에서도 일정 존재 여부를 쉽게 확인할 수 있게 한다.
  - URL: https://github.com/MinePacu/stellive-event-notifier/issues/47

GitLab:

- `#24` `(안드로이드, 아이폰) 굿즈/행사 캘린더의 기간제 행사 표시 개선`
  - 기간이 있는 행사와 단일 일정을 더 잘 구분되도록 캘린더 표시를 개선한다.
  - 날짜 셀, 범위 표시, 상태 문구의 시인성을 높인다.
  - URL: https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/24
- `#25` `(안드로이드, 아이폰) 굿즈/행사 캘린더 일정 점 시인성 개선`
  - 일정이 있는 날짜 아래 점의 크기와 가시성을 개선한다.
  - 작은 화면에서도 일정 존재 여부를 쉽게 확인할 수 있게 한다.
  - URL: https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/25

## Current Code Context

Android:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarUiPolicy.kt`
  - Owns `HubCalendarScopeMode`, `CalendarDateMarker`, entry ordering, day/range entry selection, date marker classification, accessibility labels, and widget text policy.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarViewModel.kt`
  - Owns selected day/month/range/filter state and computes `visibleEntries`.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarView.kt`
  - Renders mode/scope controls, month control, month grid, date cells, event list, and entry rows.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt`
  - Already covers range markers, accessibility labels, entry sorting, special-day labels, and widget text.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsCalendarViewModelTest.kt`
  - Already covers selected month/date/range behavior.

iOS:

- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift`
  - Owns selected day/month/range/filter state, marker classification, entry counts, accessibility labels, and visible entries.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift`
  - Renders month controls, month grid, `CalendarDateCell`, picker sheets, and calendar entry rows.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`
  - Already covers selected day, range start/end, middle-with-event, middle-empty, and reversed range behavior.

Shared/backend:

- `shared/schemas/domain.ts`, `shared/openapi/openapi.yaml`, and `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts` already expose calendar entries with `startsAt`, `endsAt`, `displayDate`, and `displayTimeText`.
- This issue set should not require a backend DTO change. Backend verification is limited to confirming calendar entries still provide enough date-range data.

## Non-Negotiable Constraints

- Do not introduce Former members, former-member fixtures, or former-member filters.
- Gangzi remains only a `gamja` representative entry.
- Official category remains `기타`; official YouTube live scheduled/started/ended notifications remain forbidden.
- Do not add profile image binaries, logos, posters, screenshots, fan art, copied images, raw provider payloads, or unauthorized media URLs.
- Do not add crawling, private Cafe collection, login-cookie scraping, CHZZK private endpoint usage, or external platform bypasses.
- Do not create push notification behavior from this UI work.
- Do not add create/edit/delete schedule actions; the calendar remains read-only.
- `realtime_best_effort` and notification preferences are not affected by this display-only work.

## Display Design

### Multi-Day Event Classification

Add policy-level display classification derived from existing `HubCalendarEntry` fields:

```kotlin
enum class CalendarEntrySpanKind {
    SINGLE_DAY,
    MULTI_DAY_START,
    MULTI_DAY_MIDDLE,
    MULTI_DAY_END,
    MULTI_DAY_ALL_DAY
}
```

```swift
enum HubCalendarEntrySpanKind: Equatable {
    case singleDay
    case multiDayStart
    case multiDayMiddle
    case multiDayEnd
    case multiDayAllDay
}
```

Rules:

- If `startsAt` and `endsAt` are both absent, classify as `SINGLE_DAY`.
- Convert `startsAt` and `endsAt` to local calendar dates using the app calendar/timezone already used by the feature.
- If start date and end date are the same, classify as `SINGLE_DAY`.
- If current cell date equals start date, classify as `MULTI_DAY_START`.
- If current cell date equals end date, classify as `MULTI_DAY_END`.
- If current cell date is between start and end, classify as `MULTI_DAY_MIDDLE`.
- If an event spans all visible dates without clear endpoint in the loaded month window, render as a connected middle segment but keep the status phrase explicit.

### Status Phrase Improvements

Add short display phrases that are independent of backend status enum labels:

- Single-day event: keep the existing `displayTimeText` and status badge, for example `10:00 시작`, `마감 임박`.
- Multi-day start: `기간 시작`.
- Multi-day middle: `진행 기간`.
- Multi-day end: `기간 종료`.
- Closing-soon multi-day item: combine state and range phrase in entry rows, for example `마감 임박 · 기간 종료`.
- Cancelled multi-day item: keep cancellation visually dominant, for example `취소 · 기간 행사`.

Do not mutate `HubCalendarEntry.displayTimeText`; expose this as UI-derived text:

- Android: `CalendarUiPolicy.entryRangeLabel(entry, cellDate)` and `CalendarUiPolicy.entryRowStatusText(entry, cellDate)`.
- iOS: `HubEventsCalendarViewModel.rangeLabel(for:date:)` or static helpers near `HubCalendarPolicy`.

### Date Cell Range Rendering

Date cells should visually distinguish:

- Selected single day.
- User-selected range start/middle/end.
- Event-duration range start/middle/end.
- Event dots for one or more entries.

Priority:

1. User-selected day/range marker remains the strongest background.
2. Event-duration range marker is secondary and should not hide the date number.
3. Event dot remains visible even inside selected/ranged backgrounds.
4. Today outline remains visible only when not selected/ranged.

Android rendering:

- Keep cell dimensions stable.
- Add a secondary horizontal range bar behind the dot/date number for dates containing multi-day entries.
- Use endpoint rounding for start/end days and a full-width soft bar for middle days.
- Render the event dot as a separate view under the date number, not as part of the selected/range background.

iOS rendering:

- Keep `CalendarDateCell` responsible for drawing the date number, selected/user range marker, event-duration marker, and dot.
- Add a secondary rounded rectangle/capsule for event-duration ranges.
- Render dot with sufficient contrast against both default and selected backgrounds.

### Event Dot Visibility

Use a policy-derived dot style based on count and importance:

```kotlin
data class CalendarEventDotStyle(
    val visible: Boolean,
    val sizeDp: Int,
    val emphasis: CalendarEventDotEmphasis,
    val countText: String?
)
```

```swift
struct HubCalendarEventDotStyle: Equatable {
    let visible: Bool
    let size: CGFloat
    let emphasis: HubCalendarEventDotEmphasis
    let countText: String?
}
```

Rules:

- `0` entries: no dot.
- `1` entry: show a clearly visible dot, at least 5dp/5pt.
- `2` entries: show a larger dot or two-dot cluster, at least 6dp/6pt effective visual size.
- `3+` entries: show the strongest dot or compact count marker such as `3`.
- If any entry is `CLOSING_SOON`, use high emphasis.
- If all entries are cancelled/ended, use muted emphasis.
- Dot color must maintain contrast on default, selected, range, and today states.

Accessibility:

- Android `CalendarUiPolicy.accessibilityLabelForDate()` and iOS `accessibilityLabel(for:)` must keep entry counts.
- Add a range-specific phrase when a date has multi-day entries, for example `기간 행사 포함`.

## Files

Modify:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarView.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarViewModel.kt` only if the view needs derived per-date range/dot state cached in `uiState`.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsCalendarViewModelTest.kt` only if `uiState` changes.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`
- `docs/AI_HANDOFF.md` after implementation to record status and test output.

Inspect, but do not modify unless tests prove a contract gap:

- `shared/schemas/domain.ts`
- `shared/openapi/openapi.yaml`
- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`
- `backend/stellive-hub-api/test/hubEventCalendar.test.ts`

Do not modify:

- Member catalog seed data.
- Notification worker, push payload, preference resolution, CHZZK/X/YouTube adapters.
- Image/asset directories.

## Token Usage Minimization Plan

Use targeted repository inspection:

- Start from `CODEMAP.md` and direct `rg` queries; do not recursively read broad directories.
- Prefer `rtk rg -n "CalendarDateCell|CalendarDateMarker|HubEventsCalendarViewModel|HubCalendarEntry"` over opening unrelated UI files.
- Read focused line ranges with `rtk sed -n` after `rg` identifies exact files.
- Avoid reading generated/build folders and dependency folders: `.gradle`, `build`, `dist`, `node_modules`, `.git`.
- Use existing tests as executable specifications before reading implementation-heavy files.
- Keep the plan and implementation scoped to calendar display; do not inspect ingestion, push, auth, or server deployment code unless a calendar DTO test fails.

Use compact verification:

- Run focused unit tests first:
  - `rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.CalendarUiPolicyTest`
  - `rtk xcodebuild test ... -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests`
- Run broad Android/iOS test suites only after focused tests pass.
- Use `rtk test <cmd>` or RTK-filtered package commands for failure-only output when a command is noisy.
- When a command fails, rerun only the failing test class or test method with unfiltered output if needed for debugging.

Use concise editing:

- Add pure policy helpers and tests first; avoid large view rewrites.
- Reuse existing enum/test structure instead of introducing new model layers.
- Keep visual constants local to the calendar feature and name them explicitly.
- Update docs only once after verification, with command names and pass/fail status rather than full logs.

## Implementation Steps

- [ ] Confirm current branch and clean scope.

```bash
rtk git status --short --branch
```

Expected: branch is `calendar-event-display-46-47-24-25-plan` or the implementation branch derived from it; only intentional files are modified.

- [ ] Add Android span-kind and dot-style policy tests.

File: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt`

Test cases:

- A same-day entry returns `SINGLE_DAY`.
- A three-day entry returns start/middle/end for each projected date.
- A reversed or missing endpoint does not crash and falls back to single-day display.
- `0`, `1`, `2`, and `3+` entries produce expected dot visibility/size/emphasis.
- A date containing `CLOSING_SOON` entry produces high-emphasis dot style.
- A date containing only `CANCELLED` or `ENDED` entries produces muted dot style.
- Accessibility text includes `기간 행사 포함` when the date has multi-day entries.

Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.CalendarUiPolicyTest
```

Expected: tests fail before implementation for missing helpers.

- [ ] Implement Android policy helpers.

File: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarUiPolicy.kt`

Add:

- `CalendarEntrySpanKind`.
- `CalendarEventDotEmphasis`.
- `CalendarEventDotStyle`.
- `spanKindForEntry(entry: HubCalendarEntry, cellDate: LocalDate): CalendarEntrySpanKind`.
- `hasMultiDayEntry(entries: List<HubCalendarEntry>, cellDate: LocalDate): Boolean`.
- `dotStyleForEntries(entries: List<HubCalendarEntry>): CalendarEventDotStyle`.
- `entryRangeLabel(entry: HubCalendarEntry, cellDate: LocalDate): String?`.
- `entryRowStatusText(entry: HubCalendarEntry, cellDate: LocalDate): String`.

Run the same Android focused test command.

Expected: `CalendarUiPolicyTest` passes.

- [ ] Update Android date-cell rendering.

File: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarView.kt`

Change:

- Compute `entries` for the cell once.
- Pass `entries`, `entryCount`, `dotStyle`, and multi-day span state into `dateCell`.
- Draw a secondary event-duration range bar behind the date number/dot when `hasMultiDayEntry()` is true.
- Increase dot size according to `dotStyleForEntries()`.
- Keep the dot separate from selected/user-range backgrounds.
- Keep date cell size stable at narrow widths.
- Use `CalendarUiPolicy.entryRowStatusText(entry, selectedDateOrCellDate)` in entry rows where a cell date is available.

Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.CalendarUiPolicyTest
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubEventsCalendarViewModelTest
```

Expected: focused Android tests pass.

- [ ] Add iOS span-kind and dot-style tests.

File: `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`

Test cases:

- Same-day entry is `.singleDay`.
- Multi-day entry returns `.multiDayStart`, `.multiDayMiddle`, and `.multiDayEnd`.
- Dot style for `0`, `1`, `2`, and `3+` entries increases visual weight.
- Closing-soon entries use high emphasis.
- Ended/cancelled-only entries use muted emphasis.
- Accessibility label includes an entry count and multi-day phrase.

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected: tests fail before implementation for missing helpers.

- [ ] Implement iOS policy/view-model helpers.

File: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift`

Add:

- `HubCalendarEntrySpanKind`.
- `HubCalendarEventDotEmphasis`.
- `HubCalendarEventDotStyle`.
- `spanKind(for entry: HubCalendarEntry, on date: Date)`.
- `hasMultiDayEntry(on date: Date)`.
- `dotStyle(on date: Date)`.
- `rangeLabel(for entry: HubCalendarEntry, on date: Date)`.
- `rowStatusText(for entry: HubCalendarEntry, on date: Date)`.

Run the same iOS focused test command.

Expected: `HubEventsCalendarViewModelTests` passes.

- [ ] Update iOS date-cell rendering.

File: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift`

Change:

- Pass dot style and multi-day span state into `CalendarDateCell`.
- Draw a secondary event-duration range background separately from selected/user-range markers.
- Increase dot size or show compact count for `3+` entries.
- Preserve date-number contrast on selected/range/today states.
- Use row status/range text in `CalendarEntryRow` without mutating API models.

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected: focused iOS tests pass.

- [ ] Verify backend/shared DTO assumptions without changing server behavior.

Run:

```bash
rtk rg -n "startsAt|endsAt|displayDate|displayTimeText|HubCalendarEntry" shared/schemas/domain.ts shared/openapi/openapi.yaml backend/stellive-hub-api/src/hub-events backend/stellive-hub-api/test
```

Expected: calendar entries expose the fields needed for local span display. If a field is missing from OpenAPI but present in runtime DTOs, add a contract-only test/update in the backend route test.

- [ ] Run Android broad unit tests.

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

Expected: Android unit tests pass.

- [ ] Run iOS broad tests.

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16"
```

Expected: iOS tests pass. If the simulator/device is unavailable, record the exact environment failure in `docs/AI_HANDOFF.md`.

- [ ] Run policy grep.

```bash
rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|profileImageUrl|posterUrl|logoUrl|rawPayload|providerResponse|NID_AUT|NID_SES|login-cookie|cookie scraping" android ios docs/superpowers/plans/2026-06-21-calendar-event-display-visibility-code-design.md
```

Expected: matches are existing policy docs, explicit exclusions, or unrelated legacy references; no new implementation introduces prohibited behavior or assets.

- [ ] Update handoff after implementation.

File: `docs/AI_HANDOFF.md`

Record:

- GitHub issues `#46`, `#47`.
- GitLab work items `#24`, `#25`.
- Android files changed.
- iOS files changed.
- Focused and broad test results.
- Any skipped visual/manual verification with a concrete reason.

- [ ] Final status check.

```bash
rtk git status --short
rtk git diff --stat
```

Expected: changes are limited to calendar display policy/view/tests and handoff docs.

## Verification Matrix

Android focused:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.CalendarUiPolicyTest
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubEventsCalendarViewModelTest
```

iOS focused:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Android broad:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

iOS broad:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16"
```

Contract check:

```bash
rtk rg -n "HubCalendarEntry|startsAt|endsAt|displayDate|displayTimeText" shared backend/stellive-hub-api android/StelliveHubAndroid/app/src/main/java ios/StelliveHubiOS/StelliveHubiOS
```

## Commit Boundaries

Suggested implementation commits:

```bash
rtk git add android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsCalendarViewModelTest.kt
rtk git commit -m "feat(android): improve calendar range and dot visibility"
```

```bash
rtk git add ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift
rtk git commit -m "feat(ios): improve calendar range and dot visibility"
```

```bash
rtk git add docs/AI_HANDOFF.md docs/superpowers/plans/2026-06-21-calendar-event-display-visibility-code-design.md
rtk git commit -m "docs: plan calendar event display visibility improvements"
```

For a multi-line body, use the repository message-file convention from `AGENTS.md` so bullet lines stay consecutive.
