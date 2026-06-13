Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the iPhone date/range navigation mockup to the iOS goods/events list UI, and align the Android home titlebar left padding to the current right settings-icon padding.

**Architecture:** Keep the work in view-layer components and existing view-model actions. The iOS date navigation redesign should reuse the existing list/calendar scope state and picker presentation, while the Android titlebar fix should centralize horizontal inset calculation so the title group and settings affordance share the same outer margin. Do not change backend ingestion, notification policy, member catalog data, image handling, or push delivery behavior.

**Tech Stack:** SwiftUI, XCTest, Android Kotlin Views, JUnit, existing static browser mockup in `mockups/ios-date-navigation-redesign-mockup.html`.

**Files:**

Create:
- None expected.

Modify:
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift` only if the existing actions cannot fully support the mockup states.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift` only if state/action behavior changes.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt` only if a reusable topbar spacing policy helper is needed.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt` only if a policy helper is added.

Reference:
- `mockups/ios-date-navigation-redesign-mockup.html`
- `docs/HUB_EVENTS_LIST_DATE_NAVIGATION_DESIGN.md`
- User-provided screenshot from 2026-06-14 for Android titlebar spacing. Do not commit the screenshot.

## Token-Minimized Execution Rules

- [ ] Start with `rtk git status` and do not inspect unrelated modified files.
- [ ] Use targeted searches only: `rtk grep "listDateNavigationHeader" ios/StelliveHubiOS`, `rtk grep "topBar" android/StelliveHubAndroid/app/src/main`, and `rtk grep "settings" android/StelliveHubAndroid/app/src/main`.
- [ ] Read only the relevant line ranges after locating symbols. Prefer `rtk proxy sed -n 'START,ENDp' <file>` over reading whole large files.
- [ ] Keep the mockup as the visual source of truth instead of generating another concept image.
- [ ] Avoid broad filesystem scans, full project builds, or full test suites unless focused checks fail in a way that requires broader context.
- [ ] Run focused tests first:
  - iOS: `rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests`
  - Android: `rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest --tests dev.stellive.hub.MainUiPolicyTest`
- [ ] If UI screenshots are needed, capture one focused screen per platform and delete temporary screenshots before final handoff unless the user explicitly asks to keep them.
- [ ] Summarize verification output instead of pasting full build logs.

## Step 1: Confirm Current UI Entry Points

- [ ] Run `rtk grep "굿즈/행사 캘린더" ios/StelliveHubiOS android/StelliveHubAndroid/app/src/main`.
- [ ] Run `rtk grep "라이브 현황과 최근 알림" android/StelliveHubAndroid/app/src/main`.
- [ ] Expected result: iOS calendar screen resolves to `HubEventsCalendarView.swift`; Android home titlebar resolves to `MainActivity.kt` and home policy text in `MainUiPolicy.kt`.

## Step 2: Inspect Existing iOS List Navigation

- [ ] Read the `HubEventsCalendarView.swift` ranges containing `listDateNavigationHeader`, picker sheet presentation, and the current list empty state.
- [ ] Confirm whether `goToPreviousDay`, `goToNextDay`, `goToToday`, `goToPreviousRange`, `goToNextRange`, `goToCurrentWeek`, and picker apply actions already exist in `HubEventsCalendarViewModel.swift`.
- [ ] Expected result: the redesign can be implemented mostly as SwiftUI layout changes without changing calendar API contracts.

## Step 3: Apply iOS Day Navigation Mockup

- [ ] Replace the current compact day navigation header with a three-column structure:
  - 44pt minimum previous-day icon button.
  - Center date card showing `M월 d일 EEEE` and a secondary line such as `오늘 · 일정 N개` or `일정 N개`.
  - 44pt minimum next-day icon button.
- [ ] Move `오늘` and `날짜 선택` into a second quick-action row below the date card.
- [ ] Make the center date card open the existing day picker sheet.
- [ ] Keep Korean text fitting within the card at iPhone width by allowing the secondary line to truncate or wrap without overlapping controls.
- [ ] Expected result: the UI matches the mockup structure while preserving existing day navigation behavior.

## Step 4: Apply iOS Range Navigation Mockup

- [ ] Replace the current compact range header with a three-column structure:
  - 44pt minimum previous-range icon button.
  - Center range card showing start and end dates as separate labels with a directional icon between them.
  - 44pt minimum next-range icon button.
- [ ] Move `이번 주` and `기간 선택` into a second quick-action row below the range card.
- [ ] Make the center range card open the existing range picker sheet.
- [ ] Preserve range normalization when the selected end date is earlier than the start date.
- [ ] Expected result: the range selector is readable on iPhone and consistent with the day selector.

## Step 5: Verify iOS Accessibility

- [ ] Add or update accessibility labels for previous/next day, previous/next range, date card, range card, today, current week, and picker buttons.
- [ ] Use labels that include the target date or range when available.
- [ ] Expected examples:
  - `이전 날짜, 2026년 6월 12일로 이동`
  - `다음 날짜, 2026년 6월 14일로 이동`
  - `기간 선택, 2026년 6월 13일부터 2026년 6월 20일까지`

## Step 6: Add Focused iOS Tests Only If Behavior Changes

- [ ] If the view-model API changes, update `HubEventsCalendarViewModelTests.swift` for day movement, current week selection, range movement, and reversed range normalization.
- [ ] If only SwiftUI layout changes, skip view-model tests and document that behavior was unchanged.
- [ ] Run the focused iOS test command from the token-minimized execution rules.

## Step 7: Inspect Android Titlebar Layout

- [ ] Read only the `MainActivity.kt` ranges that create the home topbar/titlebar and settings icon.
- [ ] Identify the effective right outer padding of the settings icon container in the screenshot layout.
- [ ] Expected result: the left title group outer padding is larger than or not visually aligned with the settings side, and the fix should use the right side as the source of truth.

## Step 8: Align Android Titlebar Padding

- [ ] Set the titlebar container horizontal padding so left title text and right settings icon use the same outer margin.
- [ ] If the right settings icon already has its own internal touch padding, align the title group to the settings icon container edge, not to the icon glyph edge.
- [ ] Preserve a minimum 48dp touch target for the settings icon.
- [ ] Keep title/subtitle typography unchanged unless the spacing change exposes clipping.
- [ ] Expected result: the left edge of `홈` aligns to the same visual outer inset used by the right settings control.

## Step 9: Add Android Policy Test Only If Needed

- [ ] If the titlebar inset becomes a pure policy value, add a `MainUiPolicyTest` assertion for the shared horizontal inset.
- [ ] If the change is purely view padding in `MainActivity.kt`, skip policy tests and rely on screenshot/manual UI verification.
- [ ] Run the focused Android test command from the token-minimized execution rules.

## Step 10: Manual Visual Verification

- [ ] iOS: verify list/day and list/range states at iPhone width. Check that date/range cards, icon buttons, and quick-action buttons do not overlap.
- [ ] Android: verify the home titlebar on the SM-F707N-like width shown in the screenshot, checking that left title padding matches the right settings-side padding.
- [ ] Confirm no profile images, official logos, fan art, captured images, or copied media assets were added.
- [ ] Confirm no Former members, official YouTube live notifications, X notification delivery, backend ingestion, or push behavior changed.

## Step 11: Final Handoff

- [ ] Report changed files.
- [ ] Report focused test commands and pass/fail result.
- [ ] Report whether any screenshot/manual verification was performed.
- [ ] Call out any skipped tests with the reason, especially if the work stayed layout-only.
