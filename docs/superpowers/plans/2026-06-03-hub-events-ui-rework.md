# Hub Events UI Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework iOS and Android so Home shows current live status, recent notifications, and urgent `굿즈/행사`, while settings-oriented policy/preference content moves into Settings and the `굿즈/행사` screen uses the approved status-first list direction.

**Architecture:** Keep the previously implemented hub event model and API surface unchanged. Add small store/UI policy selectors for home previews, then update existing SwiftUI and Android native-view screens in place without introducing image assets or a new bottom navigation tab.

**Tech Stack:** SwiftUI, XCTest, Android Kotlin views, Material components, JUnit, existing mock stores.

---

## File Structure

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
  - Adds home-specific selectors for live members, recent history preview, and closing-soon hub events.
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/HomeView.swift`
  - Replaces policy/catalog-oriented Home content with current-status sections.
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`
  - Tightens the approved status-first list UI and empty state.
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SettingsView.swift`
  - Adds/moves concise policy and preference explanation sections.
- Modify: `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift`
  - Covers home preview selectors and status-first ordering.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
  - Changes Home role copy and adds policy helpers for status dashboard labels.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MockHubRepository.kt`
  - Adds home preview selectors and ensures hub event ordering uses stable id fallback.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainNavigationHistory.kt`
  - Adds a non-bottom-tab hub event detail screen for Android.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
  - Reworks Home, Goods/Events, Settings, and adds Android hub event detail rendering.
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt`
  - Updates Home role expectations away from catalog/policy summary.
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsPolicyTest.kt`
  - Adds home preview and stable ordering coverage.
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainNavigationHistoryTest.kt`
  - Covers hub event detail navigation when added.

## Task 1: Shared Home Preview Selectors

**Files:**
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MockHubRepository.kt`
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt`
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsPolicyTest.kt`

- [ ] **Step 1: Add failing iOS selector tests**

Append these tests to `PreferenceStateTests.swift`:

```swift
func testHomePreviewSelectorsSurfaceCurrentStatus() {
    let store = MockHubStore()

    XCTAssertEqual(store.liveMembers.map(\.id), ["ayatsuno-yuni"])
    XCTAssertEqual(store.recentHistoryPreview.map(\.id), ["h3", "h1", "h2"])
    XCTAssertEqual(store.closingSoonHubEvents.map(\.id), ["closing-official-goods"])
}

func testHomePreviewKeepsPolicyContentOutOfHomeSelectors() {
    let store = MockHubStore()

    XCTAssertFalse(store.recentHistoryPreview.contains { $0.eventType.localizedCaseInsensitiveContains("youtube_live") })
    XCTAssertFalse(store.closingSoonHubEvents.contains { $0.memberId == "gangzi" })
    XCTAssertFalse(store.closingSoonHubEvents.contains { $0.generationId == "gamja" })
}
```

- [ ] **Step 2: Run iOS tests to verify the new selector tests fail**

Run with XcodeBuildMCP:

```text
test_sim(projectPath: "/Users/nohyunsoo/Desktop/projects/StelLiveNoti/ios/StelliveHubiOS/StelliveHubiOS.xcodeproj", scheme: "StelliveHubiOS", simulatorId: "E72EA93C-F672-4CF6-BBE6-14477717F64E")
```

Expected: FAIL because `liveMembers`, `recentHistoryPreview`, and `closingSoonHubEvents` are not defined, and history item `h3` is not seeded.

- [ ] **Step 3: Add iOS selectors and a hub-event history seed**

In `MockHubStore.swift`, replace the current `history` value with:

```swift
let history: [NotificationHistoryItem] = [
    .init(id: "h3", title: "마감 임박", body: "스텔라이브 공식 굿즈 예약 마감 임박", memberId: "hub-event:closing-official-goods", memberName: "굿즈/행사", eventType: "event_deadline_soon", deliveryMode: .standard, deliveryLatencyMs: nil),
    .init(id: "h1", title: "방송 시작", body: "아야츠노 유니 CHZZK 방송 시작", memberId: "ayatsuno-yuni", memberName: "아야츠노 유니", eventType: "chzzk_live_started", deliveryMode: .realtimeBestEffort, deliveryLatencyMs: 1800),
    .init(id: "h2", title: "공식 업로드", body: "스텔라이브 공식 YouTube 업로드", memberId: "stellive-official", memberName: "스텔라이브 공식", eventType: "official_youtube_upload", deliveryMode: .realtimeBestEffort, deliveryLatencyMs: 2400)
]
```

Add these computed properties below `filteredMembers`:

```swift
var liveMembers: [HubMember] {
    members
        .filter { $0.catalogRole != .officialChannel && $0.isLive }
        .sorted { $0.koreanName < $1.koreanName }
}

var recentHistoryPreview: [NotificationHistoryItem] {
    Array(history.prefix(3))
}

var closingSoonHubEvents: [HubEvent] {
    orderedHubEvents(hubEvents.filter { $0.status == .closingSoon })
}
```

- [ ] **Step 4: Add failing Android policy/repository tests**

In `MainUiPolicyTest.kt`, change `topBarRolesMatchBottomNavigationScreens` to:

```kotlin
@Test
fun topBarRolesMatchBottomNavigationScreens() {
    assertEquals("라이브 현황과 최근 알림", MainUiPolicy.topBarRole("home"))
    assertEquals("방송 상태와 실시간 best-effort", MainUiPolicy.topBarRole("live"))
    assertEquals("허용된 알림과 차단된 이벤트", MainUiPolicy.topBarRole("history"))
    assertEquals("알림 대상과 전송 정책", MainUiPolicy.topBarRole("settings"))
}
```

Replace `homeStatusSummarySurfacesPolicyConstraintsBeforeFilters` with:

```kotlin
@Test
fun homeStatusSummarySurfacesCurrentStatus() {
    val summary = MainUiPolicy.homeStatusSummary(liveCount = 1, recentCount = 3, closingSoonCount = 1)

    assertEquals("1", summary[0].value)
    assertEquals("지금 라이브", summary[0].label)
    assertEquals("3", summary[1].value)
    assertEquals("최근 알림", summary[1].label)
    assertEquals("1", summary[2].value)
    assertEquals("마감 임박", summary[2].label)
}
```

In `HubEventsPolicyTest.kt`, add:

```kotlin
@Test
fun homePreviewSelectorsSurfaceCurrentStatus() {
    val repository = MockHubRepository()

    assertEquals(listOf("ayatsuno-yuni"), repository.liveMembers.map { it.id })
    assertEquals(listOf("h3", "h1", "h2"), repository.recentHistoryPreview.map { it.id })
    assertEquals(listOf("closing-official-goods"), repository.closingSoonHubEvents.map { it.id })
}

@Test
fun hubEventsForFilterUsesStatusFirstStableOrdering() {
    val repository = MockHubRepository()

    assertEquals(
        listOf("closing-official-goods", "open-gen3-goods", "upcoming-offline-popup"),
        repository.hubEventsForFilter("all").map { it.id }
    )
}
```

- [ ] **Step 5: Run Android focused tests to verify failure**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/android/StelliveHubAndroid
./gradlew testDebugUnitTest --tests dev.stellive.hub.MainUiPolicyTest --tests dev.stellive.hub.HubEventsPolicyTest
```

Expected: FAIL because `homeStatusSummary` still takes no arguments and repository preview selectors do not exist.

- [ ] **Step 6: Implement Android selectors and status summary**

In `MainUiPolicy.kt`, replace `topBarRole` and `homeStatusSummary` with:

```kotlin
fun topBarRole(screenId: String): String = when (screenId) {
    "live" -> "방송 상태와 실시간 best-effort"
    "history" -> "허용된 알림과 차단된 이벤트"
    "settings" -> "알림 대상과 전송 정책"
    "goods_events" -> "공식 출처의 기간성 굿즈와 행사"
    "goods_event_detail" -> "공식 출처와 일정 정보"
    else -> "라이브 현황과 최근 알림"
}

fun homeStatusSummary(liveCount: Int, recentCount: Int, closingSoonCount: Int): List<StatusSummaryItem> = listOf(
    StatusSummaryItem(liveCount.toString(), "지금 라이브"),
    StatusSummaryItem(recentCount.toString(), "최근 알림"),
    StatusSummaryItem(closingSoonCount.toString(), "마감 임박")
)
```

In `MockHubRepository.kt`, replace `history` with:

```kotlin
val history = listOf(
    NotificationHistoryItem("h3", "마감 임박", "스텔라이브 공식 굿즈 예약 마감 임박", "hub-event:closing-official-goods", "굿즈/행사", "event_deadline_soon", DeliveryMode.STANDARD, null),
    NotificationHistoryItem("h1", "방송 시작", "아야츠노 유니 CHZZK 방송 시작", "ayatsuno-yuni", "아야츠노 유니", "chzzk_live_started", DeliveryMode.REALTIME_BEST_EFFORT, 1800),
    NotificationHistoryItem("h2", "공식 업로드", "스텔라이브 공식 YouTube 업로드", "stellive-official", "스텔라이브 공식", "official_youtube_upload", DeliveryMode.REALTIME_BEST_EFFORT, 2400)
)
```

Add these properties below `history`:

```kotlin
val liveMembers: List<HubMember> =
    members
        .filter { it.catalogRole != CatalogRole.OFFICIAL_CHANNEL && it.isLive }
        .sortedBy { it.koreanName }

val recentHistoryPreview: List<NotificationHistoryItem> = history.take(3)

val closingSoonHubEvents: List<HubEvent> =
    hubEvents
        .filter { it.status == HubEventStatus.CLOSING_SOON }
        .sortedWith(hubEventComparator)
```

Move the hub event comparator into a private property in `MockHubRepository`:

```kotlin
private val hubEventComparator = compareBy<HubEvent>(
    { MainUiPolicy.hubEventStatusRank(it.status) },
    { it.endsAt ?: it.startsAt ?: it.updatedAt },
    { it.id }
)
```

Use it in both `hubEventsSummary.preview` and `hubEventsForFilter`:

```kotlin
preview = hubEvents.sortedWith(hubEventComparator).take(3)
```

```kotlin
fun hubEventsForFilter(filter: String): List<HubEvent> {
    val filtered = when (filter.lowercase()) {
        "goods" -> hubEvents.filter {
            it.category == HubEventCategory.ONLINE_GOODS || it.category == HubEventCategory.ONLINE_COLLAB
        }
        "ticketing" -> hubEvents.filter { it.category == HubEventCategory.TICKETING }
        "offline" -> hubEvents.filter { it.participationMode.isOffline }
        "closing" -> hubEvents.filter { it.status == HubEventStatus.CLOSING_SOON }
        else -> hubEvents
    }
    return filtered.sortedWith(hubEventComparator)
}
```

- [ ] **Step 7: Run selector tests**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/android/StelliveHubAndroid
./gradlew testDebugUnitTest --tests dev.stellive.hub.MainUiPolicyTest --tests dev.stellive.hub.HubEventsPolicyTest
```

Expected: PASS.

Run iOS tests again with XcodeBuildMCP.

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MockHubRepository.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsPolicyTest.kt
git commit -m "feat: add status dashboard selectors"
```

## Task 2: iOS Home and Settings Rework

**Files:**
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/HomeView.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SettingsView.swift`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift`

- [ ] **Step 1: Add iOS home behavior test**

Add this test to `PreferenceStateTests.swift`:

```swift
func testHomeDashboardPreviewCountsAreCurrentStatusOnly() {
    let store = MockHubStore()

    XCTAssertEqual(store.liveMembers.count, store.liveMemberCount)
    XCTAssertEqual(store.recentHistoryPreview.count, min(3, store.history.count))
    XCTAssertEqual(store.closingSoonHubEvents.count, store.hubEventsSummary.closingSoonCount)
    XCTAssertFalse(store.deliveryModeSummary.isEmpty)
}
```

- [ ] **Step 2: Run iOS tests**

Run with XcodeBuildMCP.

Expected: PASS after Task 1. This test locks the selectors before changing views.

- [ ] **Step 3: Replace the Home list body**

In `HomeView.swift`, replace the current `List` contents inside `NavigationStack` with:

```swift
List {
    Section("지금 라이브") {
        if store.liveMembers.isEmpty {
            Text("현재 라이브 없음")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        } else {
            ForEach(store.liveMembers) { member in
                NavigationLink(value: member) {
                    MemberRow(member: member)
                }
            }
        }
    }

    Section("최근 알림") {
        if store.recentHistoryPreview.isEmpty {
            Text("최근 알림 없음")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        } else {
            ForEach(store.recentHistoryPreview) { item in
                HomeHistoryRow(item: item)
            }
        }
    }

    Section("마감 임박 굿즈/행사") {
        if store.closingSoonHubEvents.isEmpty {
            NavigationLink {
                HubEventsView()
            } label: {
                Text("마감 임박 항목 없음")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        } else {
            ForEach(store.closingSoonHubEvents) { event in
                NavigationLink {
                    HubEventDetailView(event: event)
                } label: {
                    HubEventPreviewBadge(event: event)
                }
            }

            NavigationLink {
                HubEventsView()
            } label: {
                Text("굿즈/행사 전체 보기")
            }
        }
    }
}
.listStyle(.insetGrouped)
.navigationTitle("홈")
.navigationDestination(for: HubMember.self) { member in
    MemberDetailView(member: member)
}
```

Add this private row below `FilterChip`:

```swift
private struct HomeHistoryRow: View {
    let item: NotificationHistoryItem

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(item.title)
                .font(.headline)
                .lineLimit(2)
                .minimumScaleFactor(0.86)
            Text(item.body)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .minimumScaleFactor(0.84)
            Text([item.eventType, item.deliveryMode.displayName].joined(separator: " · "))
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .accessibilityElement(children: .combine)
    }
}
```

- [ ] **Step 4: Update iOS Settings with policy/preference sections**

In `SettingsView.swift`, add this section after `Section("공식 채널")`:

```swift
Section("굿즈/행사") {
    Toggle(NotificationPlatform.hubEvent.displayName, isOn: platformBinding(.hubEvent))
    Toggle(NotificationEventType.eventAnnounced.displayName, isOn: eventTypeBinding(.eventAnnounced))
    Toggle(NotificationEventType.eventSalesOpen.displayName, isOn: eventTypeBinding(.eventSalesOpen))
    Toggle(NotificationEventType.eventDeadlineSoon.displayName, isOn: eventTypeBinding(.eventDeadlineSoon))
    Text("공식/멤버/공식 콜라보 출처가 있는 기간성 굿즈, 티켓, 오프라인 행사만 포함합니다. 방송, 라이브, 업로드, 팬 주최 이벤트, 대표/강지 이벤트는 MVP 굿즈/행사에 포함하지 않습니다.")
        .font(.footnote)
        .foregroundStyle(.secondary)
}
```

Add this section after `Section("채팅 알림")`:

```swift
Section("표시 정책") {
    LabeledContent("Former 멤버", value: "MVP 제외")
    LabeledContent("강지", value: "감자 대표 항목")
    LabeledContent("공식 이미지/로고/포스터", value: "저장/재사용 안 함")
    Text("홈은 현재 라이브, 최근 알림, 마감 임박 굿즈/행사를 우선 표시하고, 알림 대상과 전송 정책은 설정에서 관리합니다.")
        .font(.footnote)
        .foregroundStyle(.secondary)
}
```

- [ ] **Step 5: Run iOS tests**

Run with XcodeBuildMCP.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ios/StelliveHubiOS/StelliveHubiOS/Views/HomeView.swift ios/StelliveHubiOS/StelliveHubiOS/Views/SettingsView.swift ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift
git commit -m "feat: rework iOS home dashboard"
```

## Task 3: Android Home and Settings Rework

**Files:**
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsPolicyTest.kt`

- [ ] **Step 1: Update `renderHome`**

Replace `renderHome()` in `MainActivity.kt` with:

```kotlin
private fun renderHome() {
    startScreen(
        screenId = "home",
        title = getString(R.string.home_title),
        role = "지금 라이브, 최근 알림, 마감 임박 굿즈/행사를 확인합니다."
    )
    binding.contentList.addView(
        summaryGrid(
            MainUiPolicy.homeStatusSummary(
                liveCount = repository.liveMembers.size,
                recentCount = repository.recentHistoryPreview.size,
                closingSoonCount = repository.closingSoonHubEvents.size
            )
        )
    )
    binding.contentList.addView(sectionLabel("지금 라이브"))
    if (repository.liveMembers.isEmpty()) {
        binding.contentList.addView(compactEventCard("현재 라이브 없음", "서버 갱신 기준으로 표시합니다.", listOf("대기")))
    } else {
        repository.liveMembers.forEach { member ->
            binding.contentList.addView(liveMemberRow(member))
        }
    }
    binding.contentList.addView(sectionLabel("최근 알림"))
    if (repository.recentHistoryPreview.isEmpty()) {
        binding.contentList.addView(compactEventCard("최근 알림 없음", "허용된 알림이 도착하면 여기에 표시됩니다.", listOf("기록")))
    } else {
        repository.recentHistoryPreview.forEach { item ->
            binding.contentList.addView(historyEventCard(item, repository.memberForHistory(item)))
        }
    }
    binding.contentList.addView(sectionLabel("마감 임박 굿즈/행사"))
    if (repository.closingSoonHubEvents.isEmpty()) {
        binding.contentList.addView(
            compactEventCard("마감 임박 항목 없음", "전체 굿즈/행사에서 예정과 진행 중 항목을 볼 수 있습니다.", listOf("굿즈/행사")).apply {
                isClickable = true
                isFocusable = true
                setOnClickListener { navigateTo(HubScreen.GOODS_EVENTS, addToBackStack = true) }
            }
        )
    } else {
        repository.closingSoonHubEvents.forEach { event ->
            binding.contentList.addView(hubEventCard(event))
        }
    }
}
```

Add this helper near `screenCopy`:

```kotlin
private fun sectionLabel(text: String): TextView = TextView(this).apply {
    this.text = text
    setTextColor(color(R.color.hub_text_muted))
    textSize = 13f
    typeface = Typeface.DEFAULT_BOLD
    setPadding(0, dp(4), 0, dp(8))
}
```

- [ ] **Step 2: Add Android hub event card helper**

Add this helper near `compactEventCard`:

```kotlin
private fun hubEventCard(event: dev.stellive.hub.core.model.HubEvent): MaterialCardView =
    compactEventCard(
        title = event.title,
        body = listOfNotNull(event.status.displayName, event.sourceLabel, event.venueName).joinToString(" · "),
        pills = listOf(event.category.displayName, event.participationMode.displayName)
    ).apply {
        isClickable = true
        isFocusable = true
        setOnClickListener {
            selectedHubEventId = event.id
            navigateTo(HubScreen.GOODS_EVENT_DETAIL, addToBackStack = true)
        }
    }
```

Add this property near `selectedFilter`:

```kotlin
private var selectedHubEventId: String? = null
```

- [ ] **Step 3: Move Android policy explanations into Settings**

In `renderSettings()`, after the official-channel `compactEventCard`, add:

```kotlin
binding.contentList.addView(
    settingsPanel(
        title = "굿즈/행사",
        rows = listOf(
            SettingRow("굿즈/행사 알림", "공식 출처가 있는 기간성 굿즈, 티켓, 오프라인 행사만 포함합니다.", settings.platformEnabled[NotificationPlatform.HUB_EVENT] == true),
            SettingRow("마감 임박", "예약/판매 종료가 가까운 항목을 홈과 알림에 우선 표시합니다.", settings.eventTypeEnabled[NotificationEventType.EVENT_DEADLINE_SOON] == true),
            SettingRow("제외 대상", "방송, 라이브, 업로드, 팬 주최 이벤트, 대표/강지 이벤트는 MVP 굿즈/행사에 포함하지 않습니다.", null, "정책")
        )
    )
)
binding.contentList.addView(
    settingsPanel(
        title = "표시 정책",
        rows = listOf(
            SettingRow("Former 멤버", "MVP 카탈로그, 알림 대상, 필터, seed data에 포함하지 않습니다.", null, "제외"),
            SettingRow("강지", "감자 카테고리의 대표 항목으로 유지하되 굿즈/행사 MVP에는 표시하지 않습니다.", null, "대표"),
            SettingRow("이미지/로고/포스터", "공식 이미지, 로고, 포스터, 캡처, 팬아트는 저장하거나 재사용하지 않습니다.", null, "텍스트")
        )
    )
)
```

- [ ] **Step 4: Run Android tests**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/android/StelliveHubAndroid
./gradlew testDebugUnitTest --tests dev.stellive.hub.MainUiPolicyTest --tests dev.stellive.hub.HubEventsPolicyTest
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsPolicyTest.kt
git commit -m "feat: rework Android home dashboard"
```

## Task 4: Android Goods/Event Detail and Status-First List

**Files:**
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainNavigationHistory.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainNavigationHistoryTest.kt`

- [ ] **Step 1: Add failing navigation test**

In `MainNavigationHistoryTest.kt`, add:

```kotlin
@Test
fun goodsEventDetailReturnsToGoodsEvents() {
    val history = MainNavigationHistory()

    history.select(HubScreen.GOODS_EVENTS)
    history.select(HubScreen.GOODS_EVENT_DETAIL)

    assertEquals(HubScreen.GOODS_EVENT_DETAIL, history.currentScreen)
    assertEquals(HubScreen.GOODS_EVENTS, history.goBack())
    assertEquals(HubScreen.GOODS_EVENTS, history.currentScreen)
}
```

- [ ] **Step 2: Run the focused navigation test**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/android/StelliveHubAndroid
./gradlew testDebugUnitTest --tests dev.stellive.hub.MainNavigationHistoryTest
```

Expected: FAIL because `GOODS_EVENT_DETAIL` is not defined.

- [ ] **Step 3: Add detail screen enum and navigation mapping**

In `MainNavigationHistory.kt`, change the enum to:

```kotlin
enum class HubScreen(val id: String) {
    HOME("home"),
    GOODS_EVENTS("goods_events"),
    GOODS_EVENT_DETAIL("goods_event_detail"),
    LIVE("live"),
    HISTORY("history"),
    SETTINGS("settings");
}
```

In `MainActivity.kt`, update `renderScreen`:

```kotlin
private fun renderScreen(screen: HubScreen) {
    when (screen) {
        HubScreen.HOME -> renderHome()
        HubScreen.GOODS_EVENTS -> renderGoodsEvents()
        HubScreen.GOODS_EVENT_DETAIL -> renderHubEventDetail()
        HubScreen.LIVE -> renderLive()
        HubScreen.HISTORY -> renderHistory()
        HubScreen.SETTINGS -> renderSettings()
    }
}
```

Update `itemForScreen`:

```kotlin
private fun itemForScreen(screen: HubScreen): Int = when (screen) {
    HubScreen.HOME -> R.id.tab_home
    HubScreen.GOODS_EVENTS -> R.id.tab_home
    HubScreen.GOODS_EVENT_DETAIL -> R.id.tab_home
    HubScreen.LIVE -> R.id.tab_live
    HubScreen.HISTORY -> R.id.tab_history
    HubScreen.SETTINGS -> R.id.tab_settings
}
```

- [ ] **Step 4: Update Android Goods/Events list to use the approved A direction**

Replace the loop in `renderGoodsEvents()` with:

```kotlin
repository.hubEventsForFilter("all").forEach { event ->
    binding.contentList.addView(hubEventCard(event))
}
```

Keep the summary counts and filters above the list.

- [ ] **Step 5: Add Android detail renderer**

Add this function near `renderGoodsEvents()`:

```kotlin
private fun renderHubEventDetail() {
    val event = repository.hubEvents.firstOrNull { it.id == selectedHubEventId }
    if (event == null) {
        startScreen(
            screenId = "goods_event_detail",
            title = "상세",
            role = "선택한 굿즈/행사를 찾을 수 없습니다."
        )
        binding.contentList.addView(compactEventCard("항목 없음", "목록에서 다시 선택해 주세요.", listOf("굿즈/행사")))
        return
    }

    startScreen(
        screenId = "goods_event_detail",
        title = "상세",
        role = "공식 출처와 일정 정보를 확인합니다."
    )
    binding.contentList.addView(
        compactEventCard(
            title = event.title,
            body = event.summary ?: "공식 출처 기반 굿즈/행사 정보입니다.",
            pills = listOf(event.status.displayName, event.category.displayName, event.participationMode.displayName)
        )
    )
    binding.contentList.addView(
        settingsPanel(
            title = "정보",
            rows = listOfNotNull(
                SettingRow("분류", event.category.displayName, null, event.category.displayName),
                SettingRow("참여 방식", event.participationMode.displayName, null, event.participationMode.displayName),
                SettingRow("출처", event.sourceLabel, null, "공식"),
                event.venueName?.let { SettingRow("장소", it, null, "오프라인") },
                event.endsAt?.let { SettingRow("종료", it.toString(), null, "일정") }
            )
        )
    )
    binding.contentList.addView(
        settingsPanel(
            title = "링크",
            rows = listOfNotNull(
                httpsLinkRow("출처", event.sourceUrl),
                httpsLinkRow("구매", event.purchaseUrl),
                httpsLinkRow("티켓", event.ticketUrl)
            )
        )
    )
    binding.contentList.addView(
        noticeCard("공식 이미지, 로고, 포스터는 앱에 저장하거나 재사용하지 않습니다.")
    )
}
```

Add this helper near `eventTypePolicy`:

```kotlin
private fun httpsLinkRow(title: String, url: String?): SettingRow? {
    val value = url ?: return null
    return if (value.startsWith("https://")) SettingRow(title, value, null, "열기") else null
}
```

- [ ] **Step 6: Run Android tests**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/android/StelliveHubAndroid
./gradlew testDebugUnitTest --tests dev.stellive.hub.MainNavigationHistoryTest --tests dev.stellive.hub.HubEventsPolicyTest
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainNavigationHistory.kt android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainNavigationHistoryTest.kt
git commit -m "feat: add Android hub event detail"
```

## Task 5: Full Verification and Policy Scan

**Files:**
- No source edits expected unless verification finds a defect.

- [ ] **Step 1: Run backend tests and build**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/backend/stellive-hub-api
npm test
npm run build
```

Expected: all tests pass and TypeScript build succeeds.

- [ ] **Step 2: Run Android full unit tests**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti/android/StelliveHubAndroid
./gradlew testDebugUnitTest
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Run iOS full tests**

Run with XcodeBuildMCP:

```text
test_sim(projectPath: "/Users/nohyunsoo/Desktop/projects/StelLiveNoti/ios/StelliveHubiOS/StelliveHubiOS.xcodeproj", scheme: "StelliveHubiOS", simulatorId: "E72EA93C-F672-4CF6-BBE6-14477717F64E")
```

Expected: all iOS tests pass.

- [ ] **Step 4: Run policy scan**

Run:

```bash
cd /Users/nohyunsoo/Desktop/projects/StelLiveNoti
rg -n "former|Former|gangzi|gamja|youtube_live|logoUrl|posterUrl|imageUrl|fan-hosted|fan hosted" shared backend android ios docs
```

Expected:

- `gangzi` and `gamja` only appear in catalog/settings/policy/test contexts, not in hub event seeds.
- `youtube_live` only appears in unsupported/default-off policy contexts.
- image asset fields do not appear in `HubEvent` UI models or seeds.
- fan-hosted text only appears in exclusion policy contexts.

- [ ] **Step 5: Commit verification fixes if needed**

If a defect is found, make the smallest fix, rerun the failing command, and commit with the exact files changed. For example, if the Android home rework introduced the defect:

```bash
git add android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt
git commit -m "fix: polish hub events UI rework"
```

If no defect is found, do not create an empty commit.

## Self-Review

- Spec coverage: Home current-status dashboard is covered by Tasks 1-3. Approved `굿즈/행사` status-first direction is covered by Tasks 1, 2, and 4. Settings migration is covered by Tasks 2 and 3. Detail links and no-image policy are covered by Tasks 2, 4, and 5.
- Placeholder scan: The plan contains no unresolved markers, no open-ended implementation placeholders, and no unspecified test commands.
- Type consistency: Android uses existing `HubEvent`, `HubEventStatus`, `NotificationHistoryItem`, `SettingRow`, and `HubScreen` names. iOS uses existing `HubEvent`, `HubMember`, `NotificationHistoryItem`, and `NotificationPlatform` names.
