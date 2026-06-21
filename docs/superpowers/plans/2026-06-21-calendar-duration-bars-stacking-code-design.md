Implementation Plan
> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Android and iOS `굿즈/행사` calendar duration bars so multi-day events draw continuously across the visible calendar grid, including adjacent-month cells, and stack without overlap when multiple periods intersect.

**Architecture:** Keep shared calendar DTOs unchanged and derive all visual duration-bar layout from existing `HubCalendarEntry.startsAt`, `endsAt`, and the displayed month grid. Add platform-local policy/view-model helpers that turn multi-day entries into week-clipped range bar segments with lane indexes; views render those segments as row-spanning bars behind or below date labels. For events without `endsAt`, remove mobile "unknown end" copy and let the backend's scheduled status reconciliation mark them `ended` after their start/display date rolls over in Korea time.

**Tech Stack:** Kotlin, Android View system, Android unit tests, Swift, SwiftUI, XCTest, TypeScript, Fastify, Prisma, Vitest.

## Scope

Modify:
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarView.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/hubevents/HubEventDetailFormatting.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventDetailFormattingTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`
- `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventStatus.ts`
- `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- `backend/stellive-hub-api/src/workers/hubEventStatusReconcileWorker.ts`
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
- `backend/stellive-hub-api/test/hubEventStatusReconcileWorker.test.ts`
- `backend/stellive-hub-api/test/hubEventStatusReconciler.test.ts`
- `backend/stellive-hub-api/test/hubEventStatusTransitions.test.ts`
- `docs/AI_HANDOFF.md`

Do not modify unless a contract check proves it is required:
- `shared/schemas/domain.ts`
- `shared/openapi/openapi.yaml`

Do not add:
- schedule create/edit/delete behavior outside status reconciliation
- notification behavior
- external API/crawling behavior
- logos, posters, profile images, screenshots, fan art, copied media, raw provider payloads, or secrets
- Former member catalog entries, filters, fixtures, or notification targets

## Display Rules

For each multi-day event:
- Convert `startsAt` and `endsAt` to local dates using the same calendar/timezone assumptions already used by the existing span-kind helpers.
- Ignore single-day events, missing endpoint ranges, and invalid ranges where `endDate < startDate` for duration-bar layout.
- Show the card header date line as a period label when `endsAt` exists, using the same local-date range logic as the duration bars.
- Keep single-day cards showing only the single event date.
- Clip the displayed range to the visible calendar grid, not only to the selected month:
  - `visibleGridStart = first date cell shown in the month grid`
  - `visibleGridEnd = last date cell shown in the month grid`
  - `visibleStart = max(eventStartDate, visibleGridStart)`
  - `visibleEnd = min(eventEndDate, visibleGridEnd)`
- If the selected month grid includes trailing dates from the next month, keep drawing the bar through those visible dates until the event end date or `visibleGridEnd`.
- If the selected month grid includes leading dates from the previous month, keep drawing the bar from those visible dates when the event already started before the selected month.
- The same cross-month event can be visible in both adjacent month grids when both grids show date cells that intersect the event range.
- Split each clipped range by calendar week row, because a bar cannot visually cross a row break.
- Within each week row, assign each segment a lane so overlapping ranges never draw on top of each other.
- Non-overlapping segments in the same week row may reuse the same lane.
- Preserve existing selected-day, user-selected range, today marker, event dot/count, and row status behavior.

## No-End-Date Event Rules

For events where `endsAt == null`:
- Android and iOS detail pages must not show `종료 미정`.
- Detail period text should show only the known start/display date and start time, such as `2026.06.17 (수) 19:00 시작`.
- Calendar range bars do not treat the event as multi-day unless `endsAt` exists.
- Backend status reconciliation treats the event as day-scoped in Korea time.
- When the KST date changes after the event's local start/display date, the event becomes `ended`.
- The status update runs once per day at `00:00 Asia/Seoul` through the existing internal scheduler/status reconciliation path.
- The reconciliation job updates database status only; it must not create push notification jobs or bypass user notification preferences.
- Cancelled events remain `cancelled`; do not rewrite cancelled rows to `ended`.
- Events without both `startsAt` and a display/date source are skipped and should be surfaced through existing validation/diagnostics rather than guessed.

## Segment Model

Add Android policy data:

```kotlin
data class CalendarDurationBarSegment(
    val eventId: String,
    val weekIndex: Int,
    val lane: Int,
    val startColumn: Int,
    val endColumn: Int,
    val startsAtVisibleBoundary: Boolean,
    val endsAtVisibleBoundary: Boolean,
    val emphasis: CalendarEventDotEmphasis,
)
```

Add iOS view-model data:

```swift
struct HubCalendarDurationBarSegment: Equatable, Identifiable {
    let id: String
    let eventId: String
    let weekIndex: Int
    let lane: Int
    let startColumn: Int
    let endColumn: Int
    let startsAtVisibleBoundary: Bool
    let endsAtVisibleBoundary: Bool
    let emphasis: HubCalendarEventDotEmphasis
}
```

Semantics:
- `weekIndex`: zero-based row in the currently displayed month grid.
- `startColumn` and `endColumn`: zero-based weekday columns, Sunday = 0, Saturday = 6, matching the existing month grid.
- `startsAtVisibleBoundary`: true when the segment begins at the event's real start date; false when clipped by visible grid start or week row start.
- `endsAtVisibleBoundary`: true when the segment ends at the event's real end date; false when clipped by visible grid end or week row end.
- `emphasis`: reuse existing dot emphasis rules so closing-soon ranges can draw stronger and ended/cancelled-only ranges can draw muted.

## Lane Algorithm

For each visible month grid:
- Build one unique multi-day event candidate per `eventId` from all visible `HubCalendarDay` values in the month grid; deduplicate because a projected multi-day event may appear in more than one `HubCalendarDay`.
- Sort candidates by `visibleStart`, then descending duration, then `title`, then `eventId`.
- Split each candidate into one segment per intersecting week row.
- For each week row, sort segments by `startColumn`, then descending `endColumn`, then `eventId`.
- Assign the smallest lane whose last occupied `endColumn` is less than the segment's `startColumn`.
- Treat ranges as overlapping when `segment.startColumn <= laneLastEndColumn`.
- Return both segments and per-week lane counts so the view can reserve enough vertical space.

Expected examples:
- Event `2026-06-26` to `2026-06-30` in June renders one week-row segment from Friday column 5 through Tuesday column 2 after the range is split across the week boundary:
  - week containing `2026-06-26`: Friday through Saturday
  - week containing `2026-06-28`: Sunday through Tuesday
- Event `2026-06-26` to `2026-07-02` in the June 2026 grid renders through the visible trailing July 2 cell when the June grid shows July 1-4.
- Event `2026-06-26` to `2026-07-02` in the July 2026 grid also renders through July 2 when the July grid includes those cells.
- Events `2026-06-10` to `2026-06-14` and `2026-06-12` to `2026-06-16` use different lanes on overlapping week rows.
- Events `2026-06-10` to `2026-06-11` and `2026-06-12` to `2026-06-13` may share lane 0 in the same week row.

## Token-Minimized Execution

Use these rules while implementing to minimize token usage:
- Prefix every shell command with `rtk`.
- Consult `CODEMAP.md` only with focused `rtk rg` queries instead of broad reads.
- Read only the files listed in Scope unless a test failure points elsewhere.
- Prefer symbol-specific searches such as `rtk rg -n "durationBar|monthGrid|CalendarDateCell|spanKind|dotStyle" <path>`.
- Use focused Gradle/Xcode test filters before broad test runs.
- Use `rtk test <cmd>` or command-specific `rtk` filtering for tests so passing logs stay compressed.
- Capture screenshots only after tests pass and only for one Android device and one iOS simulator viewport.
- Record verification summaries in `docs/AI_HANDOFF.md`; do not paste full logs.
- If a command fails, rerun only the smallest failing command with raw output or `rtk proxy` for debugging.

## Steps

- [ ] Confirm working tree scope.

Run:

```bash
rtk git status --short --branch
```

Expected:
- Existing calendar display changes may already be present.
- New work should remain limited to the Scope files and this plan's handoff update.

- [ ] Add Android failing tests for range-bar layout.

File: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt`

Add tests:
- `durationBarSegmentsClipAtVisibleGridBoundaries()`
- `durationBarSegmentsIncludeTrailingNextMonthCellsWhenVisible()`
- `durationBarSegmentsIncludeLeadingPreviousMonthCellsWhenVisible()`
- `durationBarSegmentsSplitAtWeekBoundaries()`
- `durationBarSegmentsStackOverlappingRanges()`
- `durationBarSegmentsReuseLaneForNonOverlappingRanges()`
- `durationBarSegmentsDeduplicateProjectedMultiDayEntries()`
- `durationBarSegmentsIgnoreSingleDayMissingEndAndInvalidRanges()`

Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
```

Expected:
- Tests fail because duration-bar segment helpers do not exist yet.

- [ ] Implement Android policy segment helpers.

File: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt`

Add:
- `CalendarDurationBarSegment`
- `CalendarDurationBarLayout`
- `durationBarLayoutForMonth(days: List<HubCalendarDay>, month: YearMonth, zoneId: ZoneId = ZoneId.systemDefault()): CalendarDurationBarLayout`
- private helpers for visible-grid clipping, week splitting, deduplication, and lane assignment

Expected behavior:
- Helper output is deterministic.
- Same `eventId` appears once per week row, not once per projected day.
- Segment columns never exceed `0..6`.
- Segments never include dates outside the visible month grid.
- Segments may include previous-month or next-month dates when those dates are visible cells in the current month grid.

Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
```

Expected:
- Focused Android policy tests pass.

- [ ] Render Android week-row duration bars.

File: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarView.kt`

Change:
- Replace the current date-cell-only duration indication with month-level duration-bar layout.
- Update the event card header/date line so multi-day cards display a period label instead of a single date string when `endsAt` is present.
- Keep date cells and dots, but render week-row bars using the computed `CalendarDurationBarSegment` list.
- Use a week row container that can draw bars spanning multiple weekday columns.
- Reserve vertical space from each week row's lane count.
- Draw bars below the date number and above or near the existing dot/count marker without overlapping text.
- Use square-ish clipped ends when the segment continues beyond a week or month boundary, and rounded ends when the real event boundary is visible.
- Keep selected-day/range/today backgrounds readable above or below the range bars.

Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
```

Expected:
- Policy tests still pass after View changes.

- [ ] Add iOS failing tests for range-bar layout.

File: `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`

Add tests:
- `testDurationBarSegmentsClipAtVisibleGridBoundaries()`
- `testDurationBarSegmentsIncludeTrailingNextMonthCellsWhenVisible()`
- `testDurationBarSegmentsIncludeLeadingPreviousMonthCellsWhenVisible()`
- `testDurationBarSegmentsSplitAtWeekBoundaries()`
- `testDurationBarSegmentsStackOverlappingRanges()`
- `testDurationBarSegmentsReuseLaneForNonOverlappingRanges()`
- `testDurationBarSegmentsDeduplicateProjectedMultiDayEntries()`
- `testDurationBarSegmentsIgnoreSingleDayMissingEndAndInvalidRanges()`

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected:
- Tests fail because duration-bar segment helpers do not exist yet.

- [ ] Implement iOS view-model segment helpers.

File: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift`

Add:
- `HubCalendarDurationBarSegment`
- `HubCalendarDurationBarLayout`
- `durationBarLayoutForSelectedMonth() -> HubCalendarDurationBarLayout`
- private helpers for visible-grid clipping, week splitting, deduplication, and lane assignment

Expected behavior:
- iOS segment output matches Android semantics.
- Weekday column mapping stays aligned with the existing Sunday-first calendar grid.
- Visible-grid boundary behavior matches the Android tests.

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected:
- Focused iOS view-model tests pass.

- [ ] Render iOS week-row duration bars.

File: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift`

Change:
- Replace the single `LazyVGrid` month grid with a week-row composition that can place bars across columns.
- Update the event card header/date line so multi-day cards display a period label instead of a single date string when `endsAt` is present.
- Each week row should use a `ZStack` or equivalent layout with seven `CalendarDateCell` views plus a bar layer.
- Draw each `HubCalendarDurationBarSegment` using `GeometryReader` so `x`, `width`, and `y` derive from column width and lane index.
- Reserve row height from the week row's lane count.
- Keep date labels, dots/counts, selected/range/today states, and accessibility labels intact.
- Use clipped or squared ends for continuation edges and rounded ends for visible real event boundaries.

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected:
- Focused iOS tests still pass after View changes.

- [ ] Add Android detail formatting failing test for no-end-date events.

File: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventDetailFormattingTest.kt`

Add test:
- `periodTextForStartOnlyEventDoesNotShowUnknownEnd()`

Expected assertion:
- A `HubEvent` with `startsAt != null` and `endsAt == null` returns period text like `2026.06.17 (수) 19:00 시작`.
- The period text does not contain `종료 미정`.

Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.HubEventDetailFormattingTest
```

Expected:
- Test fails before implementation if current formatter still emits `종료 미정`.

- [ ] Implement Android detail formatting for no-end-date events.

File: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/hubevents/HubEventDetailFormatting.kt`

Change:
- When `startsAt != null` and `endsAt == null`, return start-only text without `종료 미정`.
- Keep existing start/end range text unchanged when both dates exist.
- Keep date-only or announcement-only fallbacks unchanged.

Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.HubEventDetailFormattingTest
```

Expected:
- Focused Android detail formatting tests pass.

- [ ] Add iOS detail formatting failing test for no-end-date events.

File: `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`

Add test:
- `testHubEventDetailPeriodTextForStartOnlyEventDoesNotShowUnknownEnd()`

Expected assertion:
- A `HubEvent` with `startsAt != nil` and `endsAt == nil` returns period text like `2026.06.17 (수) 19:00 시작`.
- The period text does not contain `종료 미정`.

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected:
- Test fails before implementation if current formatter still emits `종료 미정`.

- [ ] Implement iOS detail formatting for no-end-date events.

File: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`

Change:
- In `HubEventDetailFormatting`, when `startsAt != nil` and `endsAt == nil`, return start-only text without `종료 미정`.
- Keep existing start/end range text unchanged when both dates exist.
- Keep date-only or announcement-only fallbacks unchanged.

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected:
- Focused iOS detail formatting tests pass.

- [ ] Add backend status reconciliation failing tests for no-end-date events.

Files:
- `backend/stellive-hub-api/test/hubEventStatusTransitions.test.ts`
- `backend/stellive-hub-api/test/hubEventStatusReconciler.test.ts`
- `backend/stellive-hub-api/test/hubEventStatusReconcileWorker.test.ts`
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

Add tests:
- `returns ended for start-only event after KST date rolls over`
- `keeps start-only event open during its KST start date`
- `reconcileDueStatuses marks start-only active events ended after KST midnight`
- `reconcileDueStatuses does not rewrite cancelled start-only events`
- `status reconcile worker uses Asia/Seoul day boundary for start-only events`
- `internal scheduler route exposes startOnlyEnded count`

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventStatus
rtk npm test -- adminInternalRoutes
```

Expected:
- Tests fail before implementation for missing start-only KST rollover behavior or missing result count.

- [ ] Implement backend KST rollover status reconciliation.

Files:
- `backend/stellive-hub-api/src/hub-events/hubEventStatus.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`
- `backend/stellive-hub-api/src/workers/hubEventStatusReconcileWorker.ts`
- `backend/stellive-hub-api/src/routes/internalRoutes.ts`

Change:
- Add a shared helper that computes the current Korea date and an event's Korea start/display date.
- Treat `endsAt == null` events as active only through their Korea start/display date.
- When `now` is on the next Korea date, derived status becomes `ended`.
- Extend `reconcileDueStatuses(now)` so persisted active rows with `endsAt == null` become `ended` after KST rollover.
- Skip rows already `cancelled`.
- Keep existing `endsAt`-based transition behavior unchanged.
- Surface a count such as `startOnlyEnded` in worker/internal route results if the existing result type can be extended without breaking callers.
- Configure deployment scheduling outside code to call the existing internal status reconciliation route once daily at `00:00 Asia/Seoul`.

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventStatus
rtk npm test -- adminInternalRoutes
```

Expected:
- Focused backend status reconciliation tests pass.

- [ ] Verify shared/backend DTO assumptions.

Run:

```bash
rtk rg -n "HubCalendarEntry|startsAt|endsAt|displayDate|displayTimeText" shared/schemas/domain.ts shared/openapi/openapi.yaml backend/stellive-hub-api/src/hub-events backend/stellive-hub-api/test
```

Expected:
- Existing DTOs expose the fields needed for local duration-bar layout.
- No shared/mobile DTO shape change is needed.
- Backend behavior changes are limited to status reconciliation for `endsAt == null` hub events.

- [ ] Run focused Android, iOS, and backend verification.

Android:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.HubEventDetailFormattingTest
```

iOS:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Backend:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventStatus
rtk npm test -- adminInternalRoutes
```

Expected:
- Focused tests pass on both platforms and backend status reconciliation.

- [ ] Run broad platform and backend tests.

Android:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

iOS:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro"
```

Backend:

```bash
cd backend/stellive-hub-api
rtk npm test
```

Expected:
- Broad platform and backend tests pass.
- If an iOS simulator name is unavailable, rerun with an installed simulator and record the exact device name in `docs/AI_HANDOFF.md`.

- [ ] Perform visual smoke verification.

Android:
- Install/run on the connected adb device or emulator.
- Open the `굿즈/행사 캘린더`.
- Check a month containing:
  - one range ending inside the month
  - one range crossing into next-month cells that are visible in the current month grid
  - one range starting in previous-month cells that are visible in the current month grid
  - two overlapping ranges
- Verify at least one multi-day event card shows a period label in the header date line instead of a single date.
- Open a start-only event detail page and verify the period text does not show `종료 미정`.

iOS:
- Run on one available simulator.
- Check the same three scenarios.
- Verify at least one multi-day event card shows a period label in the header date line instead of a single date.
- Open a start-only event detail page and verify the period text does not show `종료 미정`.

Expected:
- Range bars extend to the correct final visible date.
- Cross-month ranges continue into adjacent-month cells when those cells are visible in the current calendar grid.
- The same event also appears in the adjacent month grid when that grid's visible cells intersect the event range.
- Start-only event detail pages show known start timing only and do not imply an unknown end.
- Overlapping bars are stacked in separate lanes.
- Date numbers, event dots/counts, selected state, today state, and range selection remain legible.

- [ ] Run policy grep.

Run:

```bash
rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|profileImageUrl|posterUrl|logoUrl|rawPayload|providerResponse|NID_AUT|NID_SES|login-cookie|cookie scraping" android ios backend/stellive-hub-api/src backend/stellive-hub-api/test docs/superpowers/plans/2026-06-21-calendar-duration-bars-stacking-code-design.md
```

Expected:
- Matches are existing policy references, explicit exclusions, or unrelated legacy text.
- No new implementation introduces prohibited behavior or assets.
- No status reconciliation path creates push jobs or platform API calls.

- [ ] Update handoff.

File: `docs/AI_HANDOFF.md`

Record:
- Plan file path.
- Android files changed.
- iOS files changed.
- Backend files changed.
- Focused and broad test results.
- KST daily status reconciliation behavior and scheduler endpoint checked.
- Visual smoke verification device/simulator names.
- Any unavailable simulator/device or skipped check with concrete reason.

- [ ] Confirm final diff scope.

Run:

```bash
rtk git status --short
rtk git diff --stat
```

Expected:
- Diff is limited to calendar display policy/view/tests, mobile detail formatting, backend status reconciliation, this plan, and handoff notes.

## Commit Boundaries

Suggested commits:

```bash
rtk git add android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarView.kt android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/hubevents/HubEventDetailFormatting.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventDetailFormattingTest.kt
rtk git commit -m "feat(android): render stacked calendar duration bars"
```

```bash
rtk git add ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift
rtk git commit -m "feat(ios): render stacked calendar duration bars"
```

```bash
rtk git add backend/stellive-hub-api/src/hub-events/hubEventStatus.ts backend/stellive-hub-api/src/hub-events/hubEventRepository.ts backend/stellive-hub-api/src/workers/hubEventStatusReconcileWorker.ts backend/stellive-hub-api/src/routes/internalRoutes.ts backend/stellive-hub-api/test/hubEventStatusTransitions.test.ts backend/stellive-hub-api/test/hubEventStatusReconciler.test.ts backend/stellive-hub-api/test/hubEventStatusReconcileWorker.test.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
rtk git commit -m "feat(api): end start-only hub events after KST rollover"
```

```bash
rtk git add docs/superpowers/plans/2026-06-21-calendar-duration-bars-stacking-code-design.md docs/AI_HANDOFF.md
rtk git commit -m "docs: plan stacked calendar duration bars"
```
