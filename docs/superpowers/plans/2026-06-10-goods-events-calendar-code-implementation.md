Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `굿즈/행사` calendar and mobile calendar widgets from `docs/superpowers/plans/2026-06-10-goods-events-calendar-widgets.md` as concrete backend, Android, iOS, contract, and verification changes.

**Architecture:** Build from shared contracts outward: backend calendar read models are pure projections of existing `HubEvent` data, routes expose calendar and widget snapshots, Android/iOS app code consumes the same shape, and OS widgets read only cached compact snapshots. X notification delivery remains disabled for MVP and must not be reintroduced by any implementation step.

**Tech Stack:** TypeScript, Fastify, Vitest, OpenAPI, Kotlin, Jetpack Compose, WorkManager, DataStore or Room, Android Glance/AppWidget, Swift, SwiftUI, WidgetKit, App Groups, XCTest.

## Ground Rules

- [ ] Treat `docs/superpowers/plans/2026-06-10-goods-events-calendar-widgets.md` as the product/source plan.
- [ ] Do not implement X polling, streams, notification jobs, push payloads, foreground X updates, or paid API assumptions.
- [ ] Keep X enum values only for compatibility unless every backend/mobile/OpenAPI call site is migrated in the same branch.
- [ ] Keep `hub_event` as the single platform/source key for `굿즈/행사` notifications and calendar display.
- [ ] Calendar and widgets are read-only schedule surfaces; they do not send pushes and do not bypass preferences.
- [ ] Do not add image, logo, poster, profile image, screenshot, copied CDN asset, or raw provider payload fields.
- [ ] Do not introduce Former members, Gangzi/`gamja` hub events, fan-hosted events, private cafe/community content, login-cookie scraping, or unauthorized crawling.

## Implementation Order

1. Backend/shared DTOs and pure calendar projection.
2. Backend routes and OpenAPI contract.
3. Android app calendar model, policy, screen, and mock data.
4. Android cached widget snapshot and Glance/AppWidget surface.
5. iOS app calendar model, policy, screen, and mock data.
6. iOS WidgetKit target and App Group-backed cached snapshot.
7. Docs cleanup and full verification.

## Task 1: Backend Shared Calendar DTOs

**Files:**

- Modify: `backend/stellive-hub-api/src/types.ts`
- Modify: `shared/schemas/domain.ts`

- [ ] Add calendar DTOs beside existing `HubEvent` types.

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

- [ ] Keep DTOs minimal.

  The DTOs must not include:

  ```txt
  rawPayload
  imageUrl
  logoUrl
  posterUrl
  profileImageUrl
  thumbnailUrl
  providerResponse
  ```

- [ ] Run typecheck/build after backend route work, not immediately.

  These DTOs will be imported by the next tasks.

## Task 2: Backend Calendar Projection Tests

**Files:**

- Create: `backend/stellive-hub-api/test/hubEventCalendar.test.ts`

- [ ] Add test helpers that construct valid `HubEvent` records.

  Use only active/upcoming members, `official`, or existing valid categories. Do not use Gangzi or `gamja` as a valid case.

  ```ts
  function hubEvent(overrides: Partial<HubEvent> = {}): HubEvent {
    return {
      id: "calendar-event-1",
      category: "online_goods",
      participationMode: "online",
      status: "open",
      title: "공식 굿즈 판매",
      generationId: "official",
      sourceUrl: "https://example.com/events/goods",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      notificationEligible: true,
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
      startsAt: "2026-06-12T01:00:00.000Z",
      endsAt: "2026-06-14T14:59:00.000Z",
      ...overrides
    };
  }
  ```

- [ ] Test short sale windows expand across days.

  ```ts
  it("places short sale windows on each calendar date in the window", () => {
    const response = buildHubCalendarResponse([hubEvent()], {
      from: new Date("2026-06-12T00:00:00.000Z"),
      to: new Date("2026-06-14T23:59:59.999Z"),
      timezone: "Asia/Seoul",
      now: new Date("2026-06-12T03:00:00.000Z")
    });

    expect(response.days.map((day) => day.date)).toEqual([
      "2026-06-12",
      "2026-06-13",
      "2026-06-14"
    ]);
  });
  ```

- [ ] Test long windows do not flood the calendar.

  A 60-day collaboration should produce entries for the start date, end date, and current/open date if it falls in the requested range.

- [ ] Test fallback dates.

  If `startsAt` is missing, use `announcedAt`; if both are missing, use `updatedAt`.

- [ ] Test status sorting.

  Expected order:

  ```txt
  closing_soon
  open
  upcoming
  announced
  cancelled
  ended
  ```

- [ ] Test widget snapshot limits and staleness.

  `buildHubCalendarWidgetSnapshot(..., { limit: 3 })` returns at most 3 entries and sets `staleAfter` after `generatedAt`.

- [ ] Run red test.

  ```bash
  cd backend/stellive-hub-api
  npm test -- hubEventCalendar
  ```

  Expected: FAIL because `hubEventCalendar.ts` does not exist yet.

## Task 3: Backend Calendar Projection Implementation

**Files:**

- Create: `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`

- [ ] Implement public functions.

  ```ts
  export function buildHubCalendarResponse(
    events: HubEvent[],
    options: {
      from: Date;
      to: Date;
      timezone: string;
      now: Date;
    }
  ): HubCalendarResponse

  export function buildHubCalendarWidgetSnapshot(
    events: HubEvent[],
    options: {
      timezone: string;
      now: Date;
      limit: number;
    }
  ): HubCalendarWidgetSnapshot
  ```

- [ ] Implement private helpers.

  ```ts
  function effectiveStatus(event: HubEvent, now: Date): HubEventStatus
  function primaryStart(event: HubEvent): Date
  function primaryEnd(event: HubEvent): Date
  function calendarDatesFor(event: HubEvent, options: DateWindow): string[]
  function toEntry(event: HubEvent, date: string, status: HubEventStatus): HubCalendarEntry
  function compareCalendarEntries(left: HubCalendarEntry, right: HubCalendarEntry): number
  ```

- [ ] Date window behavior.

  - Window length `<= 31` days: include every local date from start to end.
  - Window length `> 31` days: include start date, end date, and current local date if the event is open during the request.
  - Date grouping uses `timezone`, but timestamps remain ISO strings.

- [ ] Display text behavior.

  Keep backend display text compact and deterministic:

  ```txt
  displayDate: YYYY-MM-DD
  displayTimeText: "종일", "HH:mm 시작", "HH:mm 마감", or "HH:mm-HH:mm"
  ```

  Mobile apps may localize or refine labels later, but tests need a stable first version.

- [ ] Widget snapshot behavior.

  - Use only non-ended entries unless fewer than `limit` entries exist.
  - Sort by status rank and nearest actionable time.
  - `staleAfter` is `generatedAt + 6 hours` for MVP.

- [ ] Run green test.

  ```bash
  cd backend/stellive-hub-api
  npm test -- hubEventCalendar
  ```

  Expected: PASS.

## Task 4: Backend Routes And Bootstrap Flags

**Files:**

- Modify: `backend/stellive-hub-api/src/routes/routes.ts`
- Modify: `backend/stellive-hub-api/test/hubEvents.test.ts`

- [ ] Add route tests for calendar output.

  ```ts
  it("returns hub events grouped for calendar display", async () => {
    const response = await injectHubEvents(
      "/v1/hub-events/calendar?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&timezone=Asia/Seoul"
    );

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.timezone).toBe("Asia/Seoul");
    expect(body.days.length).toBeGreaterThan(0);
    expect(body.days[0].entries[0].appDeepLink).toContain("stellivehub://hub-events/");
  });
  ```

- [ ] Add route tests for widget snapshot output.

  ```ts
  it("returns a compact widget snapshot without raw provider or asset fields", async () => {
    const response = await injectHubEvents(
      "/v1/hub-events/widget-snapshot?timezone=Asia/Seoul&limit=3"
    );

    expect(response.statusCode).toBe(200);
    const json = JSON.stringify(response.json());
    expect(response.json().entries.length).toBeLessThanOrEqual(3);
    expect(json).not.toContain("rawPayload");
    expect(json).not.toContain("posterUrl");
    expect(json).not.toContain("logoUrl");
    expect(json).not.toContain("profileImage");
  });
  ```

- [ ] Add route tests for X de-scope flag.

  ```ts
  it("exposes X notifications as disabled for MVP", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/v1/bootstrap" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().config).toMatchObject({
      xNotificationsEnabled: false,
      xDisabledReason: "x_notifications_dropped_for_mvp",
      hubCalendarEnabled: true
    });
  });
  ```

- [ ] Implement routes.

  Add:

  ```txt
  GET /v1/hub-events/calendar
  GET /v1/hub-events/widget-snapshot
  ```

  Parse invalid `from`, `to`, `timezone`, and `limit` defensively. MVP fallback:

  - `timezone`: `Asia/Seoul`
  - `from`: start of current month
  - `to`: end of current month
  - `limit`: default `5`, max `10`

- [ ] Update `/v1/bootstrap`.

  Add:

  ```ts
  config: {
    xNotificationsEnabled: false,
    xDisabledReason: "x_notifications_dropped_for_mvp",
    hubCalendarEnabled: true
  }
  ```

- [ ] Run route tests.

  ```bash
  cd backend/stellive-hub-api
  npm test -- hubEvents
  ```

  Expected: PASS.

## Task 5: OpenAPI Contract

**Files:**

- Modify: `shared/openapi/openapi.yaml`

- [ ] Add schemas.

  ```yaml
  HubCalendarEntry:
    type: object
    required:
      - id
      - eventId
      - title
      - category
      - status
      - participationMode
      - generationId
      - displayDate
      - displayTimeText
      - sourceLabel
      - appDeepLink

  HubCalendarDay:
    type: object
    required:
      - date
      - entries

  HubCalendarResponse:
    type: object
    required:
      - timezone
      - from
      - to
      - days

  HubCalendarWidgetSnapshot:
    type: object
    required:
      - generatedAt
      - timezone
      - entries
      - staleAfter
  ```

- [ ] Add paths.

  ```yaml
  /v1/hub-events/calendar:
    get:
      summary: List HubEvents grouped for calendar display

  /v1/hub-events/widget-snapshot:
    get:
      summary: Return compact HubEvent calendar entries for mobile widgets
  ```

- [ ] Validate contract references by search.

  ```bash
  rg -n "HubCalendarEntry|HubCalendarWidgetSnapshot|/v1/hub-events/calendar|/v1/hub-events/widget-snapshot" shared/openapi/openapi.yaml
  ```

  Expected: all four names/paths appear.

## Task 6: Android Calendar Models And Policy

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- Create: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarUiPolicy.kt`
- Create: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt`

- [ ] Add Kotlin DTOs matching backend shape.

  ```kotlin
  data class HubCalendarEntry(
      val id: String,
      val eventId: String,
      val title: String,
      val category: HubEventCategory,
      val status: HubEventStatus,
      val participationMode: HubEventParticipationMode,
      val generationId: String,
      val memberId: String? = null,
      val startsAt: String? = null,
      val endsAt: String? = null,
      val displayDate: String,
      val displayTimeText: String,
      val sourceLabel: String,
      val appDeepLink: String
  )

  data class HubCalendarDay(
      val date: String,
      val entries: List<HubCalendarEntry>
  )

  data class HubCalendarWidgetSnapshot(
      val generatedAt: String,
      val timezone: String,
      val entries: List<HubCalendarEntry>,
      val staleAfter: String
  )
  ```

- [ ] Write Android policy tests.

  Cover:

  - Status sort order.
  - Date header label for today/tomorrow/normal dates.
  - Empty widget snapshot fallback text.
  - Stale widget snapshot detection.

- [ ] Implement `CalendarUiPolicy`.

  Public API:

  ```kotlin
  object CalendarUiPolicy {
      fun entryComparator(): Comparator<HubCalendarEntry>
      fun statusLabel(status: HubEventStatus): String
      fun dateHeaderText(date: LocalDate, now: LocalDate = LocalDate.now()): String
      fun timeWindowText(entry: HubCalendarEntry): String
      fun isWidgetSnapshotStale(snapshot: HubCalendarWidgetSnapshot, now: Instant): Boolean
  }
  ```

- [ ] Run Android policy tests.

  ```bash
  cd android/StelliveHubAndroid
  ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.CalendarUiPolicyTest
  ```

  Expected: PASS.

## Task 7: Android In-App Calendar Screen

**Files:**

- Create: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarViewModel.kt`
- Create: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarView.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`

- [ ] Add `CalendarViewModel`.

  State:

  ```kotlin
  data class CalendarUiState(
      val selectedFilter: CalendarFilter = CalendarFilter.ALL,
      val days: List<HubCalendarDay> = emptyList(),
      val isLoading: Boolean = false
  )
  ```

  Filters:

  ```kotlin
  enum class CalendarFilter {
      ALL,
      GOODS,
      TICKETING,
      OFFLINE,
      CLOSING_SOON
  }
  ```

- [ ] Add mock calendar data mapper.

  In `MockHubRepository.kt`, derive calendar days from existing `hubEvents` rather than duplicating unrelated seed records.

- [ ] Build `CalendarView`.

  Required UI:

  - Compact top filter chips: 전체, 굿즈, 티켓, 오프라인, 마감.
  - Date-grouped list.
  - Each row shows title, status label, source label, category label, and time window.
  - Text-only surface. No official logos, product images, profile images, fan art, or posters.
  - Empty state: "예정된 굿즈/행사가 없습니다."

- [ ] Wire navigation in `MainActivity.kt`.

  If existing navigation is local state in `MainActivity.kt`, add a `Calendar` destination there. Keep the first screen usable and avoid a landing page.

- [ ] Run Android build after widget task, unless the screen introduces compile errors earlier.

## Task 8: Android Cached Calendar Widget

**Files:**

- Modify: `android/StelliveHubAndroid/app/build.gradle.kts`
- Modify: `android/StelliveHubAndroid/app/src/main/AndroidManifest.xml`
- Create: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/widget/HubCalendarWidgetRepository.kt`
- Create: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/widget/HubCalendarWidget.kt`
- Create: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/widget/HubCalendarWidgetReceiver.kt`

- [ ] Add Glance dependency.

  Use the project's existing dependency version style. If there is no catalog, add the direct dependency:

  ```kotlin
  implementation("androidx.glance:glance-appwidget:<current-stable-version>")
  ```

- [ ] Add widget repository.

  Public API:

  ```kotlin
  class HubCalendarWidgetRepository(
      private val context: Context
  ) {
      suspend fun loadSnapshot(): HubCalendarWidgetSnapshot
      suspend fun saveSnapshot(snapshot: HubCalendarWidgetSnapshot)
  }
  ```

  Storage:

  - Prefer existing DataStore if configured.
  - Otherwise use a private JSON file under app storage.
  - Never store secrets, device tokens, raw provider payloads, image URLs, logos, or copied media.

- [ ] Implement Glance widget content.

  Families:

  - Small: one next actionable entry.
  - Medium: up to three entries.
  - Large: up to five entries grouped by date.

  UI:

  - Header: `굿즈/행사`
  - Entry row: title, status, date/time.
  - Stale state: "최근 동기화 필요"
  - Empty state: "예정된 일정 없음"

- [ ] Register receiver.

  Add manifest receiver and AppWidget metadata XML if required by the chosen Glance setup.

- [ ] Add refresh hooks.

  - On app foreground calendar refresh: save snapshot and update widgets.
  - On boot/package update: render cached snapshot.
  - Use conservative periodic refresh if WorkManager is added.

- [ ] Run Android verification.

  ```bash
  cd android/StelliveHubAndroid
  ./gradlew :app:testDebugUnitTest
  ./gradlew :app:assembleDebug
  ```

  Expected: PASS.

## Task 9: iOS Calendar Models And Policy

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- Create: `ios/StelliveHubiOS/StelliveHubiOSTests/HubCalendarPolicyTests.swift`

- [ ] Add Swift DTOs matching backend shape.

  ```swift
  struct HubCalendarEntry: Identifiable, Codable, Equatable {
      let id: String
      let eventId: String
      let title: String
      let category: HubEventCategory
      let status: HubEventStatus
      let participationMode: HubEventParticipationMode
      let generationId: String
      let memberId: String?
      let startsAt: Date?
      let endsAt: Date?
      let displayDate: String
      let displayTimeText: String
      let sourceLabel: String
      let appDeepLink: String
  }

  struct HubCalendarDay: Identifiable, Codable, Equatable {
      var id: String { date }
      let date: String
      let entries: [HubCalendarEntry]
  }

  struct HubCalendarWidgetSnapshot: Codable, Equatable {
      let generatedAt: Date
      let timezone: String
      let entries: [HubCalendarEntry]
      let staleAfter: Date
  }
  ```

- [ ] Add `HubCalendarPolicy`.

  Public API:

  ```swift
  enum HubCalendarPolicy {
      static func sortedEntries(_ entries: [HubCalendarEntry]) -> [HubCalendarEntry]
      static func statusLabel(_ status: HubEventStatus) -> String
      static func dateHeaderText(_ date: String, now: Date = Date()) -> String
      static func isWidgetSnapshotStale(_ snapshot: HubCalendarWidgetSnapshot, now: Date = Date()) -> Bool
  }
  ```

- [ ] Add XCTest coverage.

  Cover:

  - Status sort order.
  - Stale snapshot detection.
  - Empty snapshot fallback behavior.

- [ ] Run iOS tests after view/widget wiring if target membership requires project edits first.

## Task 10: iOS In-App Calendar Screen

**Files:**

- Create: `ios/StelliveHubiOS/StelliveHubiOS/ViewModels/HubCalendarViewModel.swift`
- Create: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubCalendarView.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/ContentView.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`

- [ ] Add `HubCalendarViewModel`.

  State:

  ```swift
  enum HubCalendarFilter: String, CaseIterable, Identifiable {
      case all
      case goods
      case ticketing
      case offline
      case closingSoon
  }

  final class HubCalendarViewModel: ObservableObject {
      @Published var selectedFilter: HubCalendarFilter = .all
      @Published private(set) var days: [HubCalendarDay] = []
  }
  ```

- [ ] Derive calendar days from `MockHubStore.hubEvents`.

  Do not add new policy-sensitive seed data unless it passes existing HubEvent eligibility.

- [ ] Add `HubCalendarView`.

  Required UI:

  - Segmented filter: 전체, 굿즈, 티켓, 오프라인, 마감.
  - Date-grouped list.
  - Entry row with title, status, source, category, and time.
  - Text-only rows. No official logos, product images, profile images, fan art, or posters.
  - Tap opens `HubEventDetailView`.

- [ ] Wire the calendar into existing navigation.

  Prefer making the calendar the main `굿즈/행사` surface while keeping existing detail/list behavior available.

## Task 11: iOS WidgetKit Cached Calendar Widget

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOS.xcodeproj/project.pbxproj`
- Create: `ios/StelliveHubiOS/StelliveHubiOS/Services/HubCalendarWidgetStore.swift`
- Create: `ios/StelliveHubiOS/StelliveHubCalendarWidget/HubCalendarWidget.swift`
- Create: `ios/StelliveHubiOS/StelliveHubCalendarWidget/HubCalendarWidgetBundle.swift`

- [ ] Add WidgetKit extension target.

  Target name:

  ```txt
  StelliveHubCalendarWidget
  ```

  Capability:

  ```txt
  App Group: group.dev.minepacu.stelliveeventnotifier
  ```

- [ ] Add shared widget store.

  Public API:

  ```swift
  struct HubCalendarWidgetStore {
      func loadSnapshot() -> HubCalendarWidgetSnapshot
      func saveSnapshot(_ snapshot: HubCalendarWidgetSnapshot)
  }
  ```

  Storage:

  - Use App Group `UserDefaults` or a small JSON file.
  - Decode failures return an empty fallback snapshot.
  - Do not store secrets, device tokens, raw provider payloads, image URLs, logos, or copied media.

- [ ] Implement timeline provider.

  Timeline behavior:

  - Read cached snapshot.
  - Render stale or empty fallback when needed.
  - Reload after `staleAfter` or the nearest event boundary.

- [ ] Implement widget view.

  Families:

  - `.systemSmall`: one next actionable entry.
  - `.systemMedium`: up to three entries.
  - `.systemLarge`: up to five entries grouped by date.

- [ ] Update app refresh path.

  When hub events refresh:

  ```swift
  HubCalendarWidgetStore().saveSnapshot(snapshot)
  WidgetCenter.shared.reloadTimelines(ofKind: "HubCalendarWidget")
  ```

- [ ] Run iOS verification.

  ```bash
  xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
  xcodebuild build -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
  ```

  Expected: PASS.

## Task 12: Documentation Cleanup

**Files:**

- Modify: `docs/API_IMPLEMENTATION_PLAN.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/AI_HANDOFF.md`
- Modify: `docs/NOTIFICATION_POLICY.md` only if settings/default wording changes.

- [ ] Update API implementation plan.

  Add:

  ```txt
  GET /v1/hub-events/calendar
  GET /v1/hub-events/widget-snapshot
  ```

  Replace X implementation wording with:

  ```txt
  X notification ingestion and delivery are disabled for MVP. Keep no-paid API flags false and expose disabled health/config state.
  ```

- [ ] Update architecture.

  Add a `굿즈/행사 Calendar And Widgets` section:

  - Backend calendar is a read projection of normalized `HubEvent`.
  - Android/iOS widgets read cached snapshots.
  - Widgets do not call platform APIs directly.
  - Widgets do not send push notifications.

- [ ] Update handoff.

  State that current priority is `굿즈/행사` calendar/widgets and X notifications are intentionally dropped for MVP.

## Task 13: Full Verification

- [ ] Run backend verification.

  ```bash
  cd backend/stellive-hub-api
  npm test
  npm run build
  ```

  Expected: PASS.

- [ ] Run Android verification.

  ```bash
  cd android/StelliveHubAndroid
  ./gradlew :app:testDebugUnitTest
  ./gradlew :app:assembleDebug
  ```

  Expected: PASS.

- [ ] Run iOS verification.

  ```bash
  xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
  xcodebuild build -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
  ```

  Expected: PASS.

- [ ] Run policy-sensitive search.

  ```bash
  rg -n "Former|gangzi|gamja|posterUrl|logoUrl|profileImage|thumbnailUrl|rawPayload|providerResponse|x_notifications_dropped_for_mvp|official_youtube_live" backend android ios shared docs
  ```

  Expected:

  - Former members are not added.
  - Gangzi and `gamja` remain rejected for HubEvent calendar data.
  - Calendar/widget DTOs do not include asset or raw provider fields.
  - X de-scope reason appears in config/docs/health only.
  - Official YouTube live events remain excluded.

- [ ] Inspect changed files.

  ```bash
  git diff --stat
  git diff -- backend/stellive-hub-api/src backend/stellive-hub-api/test shared android/StelliveHubAndroid ios/StelliveHubiOS docs
  ```

  Expected: diff is limited to calendar/widget implementation, X notification de-scope, contracts, docs, and tests.

## Commit Strategy

- [ ] Commit backend DTOs/projection/routes/contracts first.

  ```bash
  git add backend/stellive-hub-api/src backend/stellive-hub-api/test shared
  git commit -m "feat: add hub event calendar API"
  ```

- [ ] Commit Android app and widget work second.

  ```bash
  git add android/StelliveHubAndroid
  git commit -m "feat: add Android hub event calendar widget"
  ```

- [ ] Commit iOS app and widget work third.

  ```bash
  git add ios/StelliveHubiOS
  git commit -m "feat: add iOS hub event calendar widget"
  ```

- [ ] Commit docs cleanup last.

  ```bash
  git add docs shared/openapi/openapi.yaml
  git commit -m "docs: document hub event calendar widgets"
  ```

Do not commit unrelated existing worktree changes with these commits.
