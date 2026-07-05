# Mobile Hub Events Month List, Thumbnail, And Spacing Design

## Problem

The `굿즈/행사` calendar experience currently mixes a selected day/range detail area directly under the calendar with a date-grouped event feed below it. This creates duplicate or misleading content:

- iOS shows a calendar card, then a selected day/range schedule area, then another dated list starting at sections such as `2026-05-21`.
- Android shows an empty selected-range message under the calendar while the month feed below still contains events.
- iOS calendar event cards do not show allowed event thumbnails, while Android event cards already can show thumbnails.
- Android's yellow policy notice card starting with `방송/라이브/업로드와...` sits too close to the preceding date section.

## Goal

Make iOS and Android `굿즈/행사` pages show the currently visible month's events in the existing date-section feed below the calendar, remove the selected day/range schedule block under the calendar, add allowed thumbnails to iOS event cards, and add clearer top spacing above the Android policy notice.

## Scope

In scope:

- iOS `굿즈/행사` calendar/list UI.
- Android `굿즈/행사` calendar/list UI.
- iOS thumbnail rendering for event cards when server-provided image metadata is displayable.
- Android spacing above the policy notice card in the `굿즈/행사` feed.
- ViewModel/policy tests for the new month-visible list behavior.

Out of scope:

- No backend API contract changes.
- No OpenAPI schema changes.
- No new image binaries, screenshots, copied assets, official logos, fan art, or poster files.
- No push notification, live status, preferences, admin console, Docker, or deployment changes.
- No redesign of bottom navigation or event detail screens beyond data needed for the list thumbnail.

## Behavior Requirements

### Month-Based Feed Below Calendar

The calendar component should no longer render the selected day/range schedule block immediately under the month grid.

Instead:

- When the user changes the visible calendar month, the date-section feed below the calendar should update to events inside that month.
- The feed should keep the current UI composition used by date headers such as `2026-05-21`, `2026-07-07`, and event cards below those headers.
- The date-section feed should include all events in the selected month after the current filter is applied.
- If a selected day/range is still used for highlighting or accessibility, it must not control the feed contents.
- Calendar date taps may keep highlighting dates, but the main feed remains month-scoped.
- Empty month behavior should show date headers only if existing code already does so; otherwise show the existing compact empty state in the feed area, not inside the calendar card.

### iOS Thumbnail Cards

iOS event cards in the `굿즈/행사` feed should display thumbnails like Android cards when:

- The event has `image`.
- `HubEventImagePolicy.displayURL(for:)` returns a valid display URL.
- The image URL is loaded at runtime through SwiftUI `AsyncImage`.

No local image assets are added. The card must degrade to the existing text-only layout when the URL is absent, invalid, denied by policy, or fails to load.

### Android Policy Notice Spacing

The yellow policy notice card that starts with `방송/라이브/업로드와...` should have more top spacing from the previous date/event section.

The change should be local to the `굿즈/행사` feed notice placement or reusable notice margin helper. It must not add broad spacing regressions to unrelated cards.

## Data Design

The backend calendar DTO `HubCalendarEntry` does not currently carry full `HubEvent.image` metadata. To avoid backend contract changes:

- iOS should build the month feed from `HubEvent` list data when thumbnail rendering is required.
- Calendar grid markers may continue using `HubCalendarDay`/`HubCalendarEntry`.
- The month feed should map calendar entry `eventId` to a matching `HubEvent` from the existing store, then render `HubEventRow`.
- Special day entries without a matching `HubEvent` may keep text-only calendar row rendering if they remain visible in the month feed.
- Android already maps `HubCalendarEntry.eventId` to repository `HubEvent` for cards in `MainActivity`; keep that pattern and shift list source to selected-month events.

## Platform Notes

### iOS

Expected touch points:

- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`

The current `HubEventsCalendarView` owns the selected day/range list through `eventList` and `visibleEntries()`. That selected-scope list should be removed from the calendar card. The page-level `HubEventsView` should use the selected month from the calendar state or a callback/binding to group matching `HubEvent` rows under date headers.

### Android

Expected touch points:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarViewModel.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarView.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsCalendarViewModelTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt` only if policy helpers move there.

The current Android ViewModel computes `visibleEntries` from selected day/range. It should expose month-filtered entries or month-filtered dates. `HubEventsCalendarView` should stop rendering the selected day/range empty message under the calendar. `MainActivity` should keep rendering date-section event cards and add notice top margin.

## Token Cost Minimization

- Use `rtk rg -n` to locate exact selectors/functions before reading code.
- Read only short `rtk proxy sed -n '<start>,<end>p'` windows around:
  - iOS calendar ViewModel and calendar view list rendering.
  - iOS page-level event grouping.
  - Android calendar ViewModel selected/month entry calculation.
  - Android `MainActivity` `GOODS_EVENTS` feed rendering and `noticeCard` placement.
- Do not inspect backend, admin, notification, adapter, Docker, CI, or unrelated mobile screens unless a focused test failure points there.
- Prefer ViewModel tests over snapshot or screenshot tests.
- Run focused platform tests first, then broader platform unit tests only after focused tests pass.
- Do not deploy, install apps, run emulators/simulators, run Docker, or run screenshot tooling unless explicitly requested.

## Acceptance Criteria

- iOS no longer shows the selected day/range schedule block directly below the calendar.
- Android no longer shows `선택한 범위에 표시할 일정이 없습니다.` directly under the calendar when the month feed below has events.
- Changing the calendar month updates the feed below the calendar to that month on both platforms.
- iOS event cards show allowed server image thumbnails and fall back cleanly without images.
- Android policy notice has visibly more top spacing.
- No new binary/media assets are added.
- Existing calendar markers and date selection accessibility are preserved.

## Verification

Automated:

- iOS focused tests for month-scoped calendar feed behavior.
- Android focused ViewModel tests for month-scoped visible entries.
- Existing iOS and Android unit tests.

Manual, only if explicitly requested:

- iPhone 17 Simulator visual check for month-scoped feed and iOS thumbnails.
- Android connected device visual check for month-scoped feed and policy notice spacing.
