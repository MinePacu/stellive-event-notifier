Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MVP X notification work with a `굿즈/행사` calendar experience and Android/iOS calendar widgets backed by the existing HubEvent model.

**Architecture:** Keep X as a disabled, no-notification integration for MVP while preserving existing enum/contract compatibility where removal would cause churn. Extend the existing `hub_event` domain with calendar-specific read models derived from normalized `HubEvent` records, not a separate event source. Mobile apps render the full calendar in-app and keep a compact cached widget snapshot for OS widgets; server-side preference resolution remains authoritative for push notifications, while calendar widgets are read-only schedule surfaces.

**Tech Stack:** TypeScript, Fastify, Vitest, OpenAPI, Kotlin, Jetpack Compose, Room/DataStore, WorkManager, Android Glance/AppWidget, Swift, SwiftUI, WidgetKit, App Groups, XCTest.

## Constraints

- X notifications are out of scope for MVP. Do not create X notification jobs, realtime streams, polling jobs, push payloads, or foreground realtime updates.
- Keep `X_API_COST_POLICY=no_paid_api` and all X feature flags disabled by default. Adapter health should report `disabled` with reason `x_notifications_dropped_for_mvp`.
- Do not remove existing X enum values in the first change unless every backend, Android, iOS, and OpenAPI call site is migrated in the same branch.
- The `굿즈/행사` calendar includes only official-source, time-bound goods, ticketing, offline event, popup, concert, and official collaboration records.
- Do not include Former members, `gamja`, Gangzi representative events, fan-hosted events, private cafe/community content, unauthorized crawling, copied images, logos, posters, fan art, profile images, or screenshots.
- Stellive official YouTube remains upload-only. Official YouTube live scheduled/started/ended events remain dropped before storage.
- Calendar widgets must not bypass user preferences for notifications because they do not deliver push notifications. If a widget adds tap actions that schedule local reminders later, that work must go through a separate preference and OS-permission plan.
- Widgets must read from cached app data and tolerate stale/offline state. They must not call protected platform APIs directly.
- All displayed dates must be timezone-aware. Default display timezone is the device timezone; API filters accept ISO timestamps and optional IANA timezone.

## Files

Create:

- `docs/superpowers/plans/2026-06-10-goods-events-calendar-widgets.md`
- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`
- `backend/stellive-hub-api/test/hubEventCalendar.test.ts`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarView.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarViewModel.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/widget/HubCalendarWidget.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/widget/HubCalendarWidgetReceiver.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/widget/HubCalendarWidgetRepository.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubCalendarView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/ViewModels/HubCalendarViewModel.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubCalendarWidgetStore.swift`
- `ios/StelliveHubiOS/StelliveHubCalendarWidget/HubCalendarWidget.swift`
- `ios/StelliveHubiOS/StelliveHubCalendarWidget/HubCalendarWidgetBundle.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubCalendarPolicyTests.swift`

Modify:

- `backend/stellive-hub-api/src/types.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventService.ts`
- `backend/stellive-hub-api/src/routes/routes.ts`
- `backend/stellive-hub-api/test/hubEvents.test.ts`
- `shared/schemas/domain.ts`
- `shared/openapi/openapi.yaml`
- `docs/API_IMPLEMENTATION_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/AI_HANDOFF.md`
- `android/StelliveHubAndroid/app/build.gradle.kts`
- `android/StelliveHubAndroid/app/src/main/AndroidManifest.xml`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `ios/StelliveHubiOS/StelliveHubiOS.xcodeproj/project.pbxproj`
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/ContentView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`

## Task 1: Confirm X Notification De-Scoping

- [ ] Add backend tests proving X notification production is disabled.

  Modify `backend/stellive-hub-api/test/hubEvents.test.ts` or add a focused test file if X adapter tests already exist.

  ```ts
  it("reports X notifications disabled for the MVP", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/v1/bootstrap" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().config.xNotificationsEnabled).toBe(false);
  });
  ```

- [ ] Update backend config/bootstrap output.

  Modify `backend/stellive-hub-api/src/routes/routes.ts` so `/v1/bootstrap` exposes:

  ```ts
  config: {
    xNotificationsEnabled: false,
    xDisabledReason: "x_notifications_dropped_for_mvp",
    hubCalendarEnabled: true
  }
  ```

- [ ] Update docs to record the decision.

  Modify:

  - `docs/API_IMPLEMENTATION_PLAN.md`: replace Phase 6 implementation wording with "X notification ingestion is disabled for MVP; keep no-paid API flags false and report disabled health."
  - `docs/ARCHITECTURE.md`: state that CHZZK/YouTube remain platform activity surfaces, while X notification delivery is not part of MVP.
  - `docs/AI_HANDOFF.md`: change "optional no-paid-API X support" to "X notification support intentionally deferred/disabled for MVP."

- [ ] Validate X de-scope docs and bootstrap contract.

  Run:

  ```bash
  cd backend/stellive-hub-api
  npm test -- hubEvents
  ```

  Expected: PASS, and no test expects X notification delivery.

## Task 2: Add Calendar Read Models To Shared And Backend Types

- [ ] Add shared calendar DTO types.

  Modify `shared/schemas/domain.ts` and `backend/stellive-hub-api/src/types.ts`:

  ```ts
  export interface HubCalendarEntry {
    id: string;
    eventId: string;
    title: string;
    category: HubEventCategory;
    status: HubEventStatus;
    participationMode: HubEventParticipationMode;
    generationId: string;
    memberId?: string;
    startsAt?: string;
    endsAt?: string;
    displayDate: string;
    displayTimeText: string;
    sourceLabel: string;
    appDeepLink: string;
  }

  export interface HubCalendarDay {
    date: string;
    entries: HubCalendarEntry[];
  }

  export interface HubCalendarResponse {
    timezone: string;
    from: string;
    to: string;
    days: HubCalendarDay[];
  }

  export interface HubCalendarWidgetSnapshot {
    generatedAt: string;
    timezone: string;
    entries: HubCalendarEntry[];
    staleAfter: string;
  }
  ```

- [ ] Add calendar grouping service tests.

  Create `backend/stellive-hub-api/test/hubEventCalendar.test.ts` with cases for:

  - Open sale window appears on every date between `startsAt` and `endsAt` when the window is under 31 days.
  - Long events appear on `startsAt`, `endsAt`, and current/open date only to avoid flooding the calendar.
  - Events without `startsAt` use `announcedAt` or `updatedAt`.
  - Cancelled events remain visible with `cancelled` status.
  - Former member, `gamja`, Gangzi, and asset-field rejection stays covered by existing policy tests.

- [ ] Implement `hubEventCalendar.ts`.

  Create `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts` with pure functions:

  ```ts
  export function buildHubCalendarResponse(events: HubEvent[], options: {
    from: Date;
    to: Date;
    timezone: string;
    now: Date;
  }): HubCalendarResponse

  export function buildHubCalendarWidgetSnapshot(events: HubEvent[], options: {
    timezone: string;
    now: Date;
    limit: number;
  }): HubCalendarWidgetSnapshot
  ```

  Sorting order:

  1. `closing_soon`
  2. `open`
  3. `upcoming`
  4. `announced`
  5. `cancelled`
  6. `ended`

  Within the same status, sort by nearest actionable timestamp, then `updatedAt`, then `id`.

- [ ] Run the calendar unit tests.

  ```bash
  cd backend/stellive-hub-api
  npm test -- hubEventCalendar
  ```

  Expected: PASS.

## Task 3: Add Calendar And Widget Backend Endpoints

- [ ] Add route tests.

  Modify `backend/stellive-hub-api/test/hubEvents.test.ts`:

  ```ts
  it("returns hub events grouped for calendar display", async () => {
    const response = await injectHubEvents("/v1/hub-events/calendar?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&timezone=Asia/Seoul");
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.timezone).toBe("Asia/Seoul");
    expect(body.days.length).toBeGreaterThan(0);
    expect(body.days[0].entries[0]).toMatchObject({
      appDeepLink: expect.stringContaining("stellivehub://hub-events/")
    });
  });

  it("returns a compact widget snapshot without protected source payloads", async () => {
    const response = await injectHubEvents("/v1/hub-events/widget-snapshot?timezone=Asia/Seoul&limit=3");
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.entries.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(body)).not.toContain("rawPayload");
    expect(JSON.stringify(body)).not.toContain("posterUrl");
  });
  ```

- [ ] Register routes.

  Modify `backend/stellive-hub-api/src/routes/routes.ts`:

  ```txt
  GET /v1/hub-events/calendar
  GET /v1/hub-events/widget-snapshot
  ```

  Query parameters:

  ```txt
  from=<ISO datetime>
  to=<ISO datetime>
  timezone=<IANA timezone>
  category=online_goods|online_collab|offline_concert|offline_collab|offline_popup|ticketing
  generationId=gen1|gen2|gen3|official|gen4-upcoming
  memberId=<catalog member id>
  limit=<number, widget-snapshot only, default 5, max 10>
  ```

- [ ] Update OpenAPI.

  Modify `shared/openapi/openapi.yaml` with schemas:

  ```yaml
  HubCalendarEntry
  HubCalendarDay
  HubCalendarResponse
  HubCalendarWidgetSnapshot
  ```

  Add paths:

  ```yaml
  /v1/hub-events/calendar
  /v1/hub-events/widget-snapshot
  ```

- [ ] Run backend route tests and build.

  ```bash
  cd backend/stellive-hub-api
  npm test -- hubEvents
  npm run build
  ```

  Expected: PASS.

## Task 4: Add Android In-App Calendar

- [ ] Add Android model types.

  Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt` with Kotlin equivalents of:

  ```kotlin
  data class HubCalendarEntry(...)
  data class HubCalendarDay(...)
  data class HubCalendarWidgetSnapshot(...)
  ```

  Use `Instant` or ISO string consistently with the current app model style. Keep display labels in UI policy, not in the raw model.

- [ ] Add Android calendar UI policy tests.

  Create `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt`:

  ```kotlin
  @Test
  fun calendarGroupsClosingSoonBeforeOpenAndUpcoming() {
      val entries = listOf(
          entry(id = "upcoming", status = HubEventStatus.UPCOMING),
          entry(id = "closing", status = HubEventStatus.CLOSING_SOON),
          entry(id = "open", status = HubEventStatus.OPEN)
      )

      assertEquals(
          listOf("closing", "open", "upcoming"),
          entries.sortedWith(CalendarUiPolicy.entryComparator()).map { it.id }
      )
  }
  ```

- [ ] Implement Android calendar UI policy.

  Create `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarUiPolicy.kt` with:

  - `entryComparator()`
  - `statusLabel(status: HubEventStatus): String`
  - `dateHeaderText(date: LocalDate): String`
  - `timeWindowText(entry: HubCalendarEntry): String`

- [ ] Add Android calendar screen.

  Create `CalendarView.kt` and `CalendarViewModel.kt`.

  UI behavior:

  - Month strip or week strip at top.
  - Filter chips: 전체, 굿즈, 티켓, 오프라인, 마감 임박.
  - Date-grouped list below.
  - Entry rows show title, status, source label, category, and time window.
  - No images, official logos, profile avatars, copied posters, or captured media.
  - Tap opens `stellivehub://hub-events/{id}` inside the app.

- [ ] Wire Android navigation.

  Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt` to add a `굿즈/행사` calendar destination or tab. If the current app has no router abstraction, add a local enum destination and keep the change scoped.

- [ ] Seed mock calendar data.

  Modify `MockHubRepository.kt` so the existing mock `hubEvents` can also produce a `HubCalendarWidgetSnapshot`.

- [ ] Run Android unit tests.

  ```bash
  cd android/StelliveHubAndroid
  ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.CalendarUiPolicyTest
  ```

  Expected: PASS.

## Task 5: Add Android Calendar Widget

- [ ] Add widget dependency.

  Modify `android/StelliveHubAndroid/app/build.gradle.kts` to include AndroidX Glance if the project does not already use it:

  ```kotlin
  implementation("androidx.glance:glance-appwidget:<current-stable-version>")
  ```

  Use the same version catalog pattern as the project if one exists.

- [ ] Add widget repository.

  Create `HubCalendarWidgetRepository.kt`.

  Responsibilities:

  - Read cached `HubCalendarWidgetSnapshot` from DataStore or Room.
  - Return a fallback empty snapshot when the app has never synced.
  - Hide stale data after `staleAfter`, showing "최근 일정 없음" plus last updated time.
  - Never call protected platform APIs.

- [ ] Add Glance widget.

  Create `HubCalendarWidget.kt`:

  - Small size: next one actionable entry.
  - Medium size: up to three entries.
  - Large size: up to five entries grouped by date.
  - Tap app title opens calendar screen.
  - Tap entry opens event detail deep link.
  - Use text-only rows and app-owned simple shapes. Do not include logos or images.

- [ ] Register widget receiver.

  Create `HubCalendarWidgetReceiver.kt` and modify `AndroidManifest.xml` with the AppWidget receiver metadata.

- [ ] Add periodic refresh.

  Add a WorkManager job or reuse the existing sync path:

  - On app foreground sync, update widget snapshot.
  - On boot/package update, refresh from cached data.
  - Periodic network refresh should be conservative and respect OS background limits.

- [ ] Run Android widget build validation.

  ```bash
  cd android/StelliveHubAndroid
  ./gradlew :app:assembleDebug
  ```

  Expected: PASS.

## Task 6: Add iOS In-App Calendar

- [ ] Add Swift calendar models.

  Modify `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`:

  ```swift
  struct HubCalendarEntry: Identifiable, Codable, Equatable { ... }
  struct HubCalendarDay: Identifiable, Codable, Equatable { ... }
  struct HubCalendarWidgetSnapshot: Codable, Equatable { ... }
  ```

- [ ] Add calendar policy tests.

  Create `ios/StelliveHubiOS/StelliveHubiOSTests/HubCalendarPolicyTests.swift`:

  ```swift
  func testCalendarSortsClosingSoonBeforeOpenAndUpcoming() {
      let sorted = HubCalendarPolicy.sortedEntries([
          entry(id: "upcoming", status: .upcoming),
          entry(id: "closing", status: .closingSoon),
          entry(id: "open", status: .open)
      ])

      XCTAssertEqual(sorted.map(\.id), ["closing", "open", "upcoming"])
  }
  ```

- [ ] Add iOS calendar view model.

  Create `HubCalendarViewModel.swift`.

  Responsibilities:

  - Load from `MockHubStore` in MVP.
  - Later swap to API client response from `/v1/hub-events/calendar`.
  - Write compact widget snapshot through `HubCalendarWidgetStore`.
  - Keep filters deterministic and testable.

- [ ] Add iOS calendar view.

  Create `HubCalendarView.swift`.

  UI behavior:

  - Top segmented filter: 전체, 굿즈, 티켓, 오프라인, 마감.
  - Date-grouped event list.
  - Compact status badges and category labels.
  - No images, logos, copied posters, profile avatars, or screenshots.
  - Tap row opens `HubEventDetailView`.

- [ ] Wire iOS navigation.

  Modify `ContentView.swift` and/or `HubEventsView.swift` to expose the calendar as the primary `굿즈/행사` schedule view, while preserving the existing list/detail path.

- [ ] Run iOS tests.

  ```bash
  xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
  ```

  Expected: PASS.

## Task 7: Add iOS Calendar Widget

- [ ] Add WidgetKit target.

  Modify `ios/StelliveHubiOS/StelliveHubiOS.xcodeproj/project.pbxproj` to add `StelliveHubCalendarWidget`.

  Required capabilities:

  - WidgetKit extension.
  - App Group shared container, for example `group.dev.minepacu.stelliveeventnotifier`.

- [ ] Add shared widget store.

  Create `HubCalendarWidgetStore.swift`.

  Responsibilities:

  - Encode `HubCalendarWidgetSnapshot` to App Group `UserDefaults` or a small JSON file.
  - Decode snapshot in app and widget extension.
  - Return empty fallback when no snapshot exists.
  - Avoid secrets, production device tokens, raw provider payloads, image URLs, logos, or copied media.

- [ ] Implement WidgetKit timeline provider.

  Create `StelliveHubCalendarWidget/HubCalendarWidget.swift`:

  - Small family: next event.
  - Medium family: next three events.
  - Large family: date-grouped list up to five entries.
  - Timeline reload after `staleAfter` or at the next event boundary.
  - Deep link entries to `stellivehub://hub-events/{id}`.

- [ ] Add widget bundle.

  Create `HubCalendarWidgetBundle.swift` and register the widget extension target.

- [ ] Update app sync path.

  Modify `MockHubStore.swift` or the future API-backed store so each hub event refresh writes `HubCalendarWidgetSnapshot` to the App Group store and calls `WidgetCenter.shared.reloadTimelines(ofKind:)`.

- [ ] Run iOS widget build.

  ```bash
  xcodebuild build -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
  ```

  Expected: PASS and the widget extension compiles.

## Task 8: Update Notification Preferences For Calendar Scope

- [ ] Keep `hub_event` as the platform key for `굿즈/행사`.

  Do not add a separate notification platform for calendar widgets. Calendar is a presentation layer over HubEvent data.

- [ ] Confirm event type defaults.

  `docs/NOTIFICATION_POLICY.md` already defines:

  ```txt
  event_announced
  event_sales_open
  event_deadline_soon
  event_updated
  event_cancelled
  ```

  Preserve those defaults. `event_updated` stays disabled by default.

- [ ] Add settings copy only if needed.

  If settings screens mention X as a notification source, update Android and iOS labels to show X as unavailable for MVP or remove the X toggle from the visible MVP notification list while keeping the enum for compatibility.

- [ ] Verify global off behavior.

  Backend notification tests must still prove `global=false` blocks every push, including `hub_event` notifications. Calendar widgets are unaffected because they do not send push notifications.

## Task 9: Documentation And Contracts

- [ ] Update architecture docs.

  Modify `docs/ARCHITECTURE.md`:

  - Add `굿즈/행사 Calendar` section.
  - Explain that calendar and widgets read from normalized `HubEvent`.
  - State widgets use cached snapshots and do not call platform APIs.
  - State X notification delivery is disabled for MVP.

- [ ] Update implementation docs.

  Modify `docs/API_IMPLEMENTATION_PLAN.md`:

  - Add calendar endpoints under mobile-facing routes.
  - Add widget snapshot endpoint.
  - Replace X implementation phase with disabled adapter health and docs cleanup.

- [ ] Update handoff.

  Modify `docs/AI_HANDOFF.md`:

  - Current priority is HubEvent calendar and widgets.
  - X notification ingestion/delivery is intentionally dropped for MVP.
  - Android uses Glance/AppWidget with cached snapshots.
  - iOS uses WidgetKit with App Group storage.

- [ ] Update OpenAPI scan.

  Run:

  ```bash
  rg -n "/v1/hub-events/calendar|HubCalendarWidgetSnapshot|x_notifications_dropped_for_mvp" docs shared backend
  ```

  Expected: new endpoints, schemas, and X de-scope reason appear in docs/contracts.

## Task 10: Full Verification

- [ ] Run backend tests.

  ```bash
  cd backend/stellive-hub-api
  npm test
  npm run build
  ```

  Expected: PASS.

- [ ] Run Android tests and debug build.

  ```bash
  cd android/StelliveHubAndroid
  ./gradlew :app:testDebugUnitTest
  ./gradlew :app:assembleDebug
  ```

  Expected: PASS.

- [ ] Run iOS tests and build.

  ```bash
  xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
  xcodebuild build -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
  ```

  Expected: PASS.

- [ ] Run policy-sensitive search.

  ```bash
  rg -n "Former|gangzi|gamja|posterUrl|logoUrl|profileImage|rawPayload|x_notifications_dropped_for_mvp|official_youtube_live" backend android ios shared docs
  ```

  Expected:

  - Former members are not introduced.
  - Gangzi and `gamja` remain rejected for hub events.
  - No poster/logo/profile image fields are added to HubEvent calendar/widget DTOs.
  - Raw provider payloads are not exposed to widgets.
  - X de-scope reason appears only in config/docs/health paths.
  - Official YouTube live events remain excluded.

- [ ] Inspect git diff.

  ```bash
  git diff --stat
  git diff -- docs/superpowers/plans/2026-06-10-goods-events-calendar-widgets.md docs/API_IMPLEMENTATION_PLAN.md docs/ARCHITECTURE.md docs/AI_HANDOFF.md shared/openapi/openapi.yaml shared/schemas/domain.ts backend/stellive-hub-api/src android/StelliveHubAndroid ios/StelliveHubiOS
  ```

  Expected: changes are limited to X notification de-scoping, HubEvent calendar read models/routes, Android calendar/widget, iOS calendar/widget, docs, contracts, and focused tests.

## Release Notes Draft

- X notification delivery is removed from the MVP scope and remains disabled by default.
- `굿즈/행사` gains calendar APIs derived from existing official-source HubEvent data.
- Android gains an in-app calendar and a cached `굿즈/행사` calendar widget.
- iOS gains an in-app calendar and a WidgetKit `굿즈/행사` calendar widget.
- Calendar widgets are read-only schedule surfaces and do not send push notifications or bypass notification preferences.
