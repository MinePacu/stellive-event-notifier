# Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Android and iOS goods/events detail screens that match `mockups/goods-events-detail-mobile-mockup.html` closely.

**Architecture:** Keep the existing server-mediated `HubEvent` contract. Mobile apps render a native detail surface from the existing event model, with a large policy-gated remote thumbnail area, sticky/collapsing title bar, unified event information rows, and a shared caution note. Do not add image binaries, logos, posters, fan art, crawling, or client-side platform API calls.

**Tech Stack:** Android Kotlin Views/MaterialCardView, iOS SwiftUI, existing `HubEvent` models, existing image policy helpers, Android unit tests, iOS XCTest where applicable.

## Design Source

- Mockup: `mockups/goods-events-detail-mobile-mockup.html`
- Required visual match:
  - Top thumbnail/placeholder occupies about one third of the phone height.
  - Event title appears in the thumbnail hero, not duplicated in the summary card.
  - After vertical scroll, the title appears in a sticky top title bar.
  - Summary card starts with status and D-day/status timing, then `핵심 안내`.
  - Event information rows use the same order on Android and iOS: `장소`, `시작`, `기간`, `참여 방식`, `분류`, `출처`.
  - Bottom notice text is identical on both platforms: `일정, 장소, 판매/입장 조건은 공식 공지 변경에 따라 달라질 수 있습니다. 앱은 확인용 요약만 제공하므로 참여 전 반드시 출처 링크에서 최신 공지를 확인하세요.`
  - Secondary CTA text must remain high contrast. Do not use dark teal background with dark teal text.

## Token-Efficient Execution Rules

- Always prefix shell commands with `rtk`.
- Read only these files first unless a compiler/test failure points elsewhere:
  - `mockups/goods-events-detail-mobile-mockup.html`
  - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
  - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
  - `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`
  - `ios/StelliveHubiOS/StelliveHubiOS/Models.swift`
- Prefer targeted search:
  - `rtk rg -n "selectedHubEventId|HubEventDetail|venueName|startsAt|endsAt|ticketUrl" android/StelliveHubAndroid ios/StelliveHubiOS`
- Avoid broad repository scans after the first failure-free orientation pass.
- Prefer small helper functions over large rewrites to reduce diff and review cost.
- Verify with focused tests first, then broader platform tests only if touched code requires it.
- Do not regenerate screenshots or run simulator builds until static/unit verification passes.

## Files

Modify:
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`

Likely test additions or updates:
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsPolicyTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`

Optional if formatting helpers are extracted:
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/hubevents/HubEventDetailFormatting.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventDetailFormattingTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailFormatting.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventDetailFormattingTests.swift`

## Implementation Steps

- [ ] Read the mockup and note exact visible copy, row order, CTA labels, and hero/title behavior.

Run:

```bash
rtk read mockups/goods-events-detail-mobile-mockup.html
```

- [ ] Add or identify pure formatting helpers for detail rows.

Required helper outputs:
- Venue: `event.venueName` if present, otherwise omit row.
- Start: localized `startsAt`, otherwise `미정`.
- Period: `startsAt - endsAt` when both exist, `startsAt부터 종료 공지까지` when only start exists, `미정` when both are missing.
- Participation: `event.participationMode.displayName`.
- Category: `event.category.displayName`.
- Source: `event.sourceLabel`.

- [ ] Write Android failing tests for row order and notice copy.

Add tests that assert:
- `장소`, `시작`, `기간`, `참여 방식`, `분류`, `출처` are produced in that order.
- The shared notice copy exactly matches the design source.
- The summary section does not repeat `event.title`.

Run:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests '*HubEventDetail*'
```

Expected before implementation: fail because helpers or assertions are not implemented.

- [ ] Implement Android detail UI to match the mockup.

In `MainActivity.kt`:
- Replace compact event detail card layout with a detail-first layout when `selectedHubEventId` is active.
- Add a large hero thumbnail/placeholder at the top.
- Keep remote image rendering behind the existing `HubEventImagePolicy`; fallback to an abstract gradient/shape placeholder.
- Render `event.title` in the hero only.
- Add a scroll-aware top title bar that fades in after the hero begins to collapse.
- Use summary card copy with `핵심 안내`, event summary text, and primary/secondary CTAs.
- Render the unified event information rows in the required order.
- Add the shared notice text below the info card.

Design values to preserve:
- Hero height: about `280dp` on a 390x844 phone.
- Card radius: about `20-24dp`.
- Main accent: teal.
- Secondary CTA: light background, dark readable text, visible border.
- Avoid official logos, saved images, or poster assets.

- [ ] Run Android focused tests.

```bash
rtk ./gradlew :app:testDebugUnitTest --tests '*HubEventDetail*'
```

Expected: pass.

- [ ] Run Android existing relevant tests.

```bash
rtk ./gradlew :app:testDebugUnitTest --tests '*HubEventImagePolicyTest'
rtk ./gradlew :app:testDebugUnitTest --tests '*HubEventsPolicyTest'
```

Expected: pass.

- [ ] Write iOS failing tests for formatting helpers if helpers are extracted.

Assert:
- Row order is `장소`, `시작`, `기간`, `참여 방식`, `분류`, `출처`.
- Shared notice copy exactly matches Android.
- Summary label is `핵심 안내`.

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected before implementation: fail if helper tests were added first.

- [ ] Implement iOS detail UI to match the mockup.

In `HubEventDetailView.swift`:
- Use a `ScrollView` with top hero image/placeholder.
- Use `GeometryReader` or scroll offset preference to fade in a sticky/collapsing navigation title.
- Keep title in the hero and collapsed title bar only.
- Remove duplicate title from the lower summary card.
- Render `핵심 안내`, summary, status badge, D-day/status timing, CTAs, unified info rows, and shared notice.
- Use `AsyncImage` only for policy-allowed display URLs and fallback to an abstract gradient placeholder.

Design values to preserve:
- Hero height: about `286pt` on iPhone-sized preview.
- iOS surface background: grouped light gray.
- Cards: white, `20pt` radius.
- Secondary CTA: white or very light background with dark teal text.

- [ ] Run iOS focused tests.

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected: pass for touched tests.

- [ ] Run visual smoke checks against the mockup.

Check manually or by simulator screenshot:
- Hero occupies about one third of the screen.
- Title is not duplicated below the hero.
- Collapsed title appears after scroll.
- Android and iOS info row labels match exactly.
- Bottom notice is identical on both platforms.
- `티켓 링크` and other secondary CTAs meet readable contrast.

- [ ] Confirm project rules.

Verify:
- No Former members added.
- No official logos, posters, fan art, screenshots, image binaries, or copied CDN assets added.
- No client-side CHZZK/YouTube/X/Naver platform API calls added.
- Calendar/widget surfaces remain read-only projections and are not changed into push sources.

Run:

```bash
rtk rg -n "<img|base64|logo|poster|fan art|NID_AUT|NID_SES" android/StelliveHubAndroid ios/StelliveHubiOS
```

Expected: no new prohibited references from this change.

## Acceptance Criteria

- Android detail screen visually follows the browser mockup.
- iOS detail screen visually follows the browser mockup.
- Event title is shown in hero and collapsed title bar only.
- Info rows are unified across both platforms.
- Shared notice copy is identical across both platforms.
- Thumbnail handling remains policy-gated and fallback-safe.
- Focused tests pass.
- No prohibited assets, secrets, or platform-bypass code are introduced.
