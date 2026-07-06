# Android Shared UI Chrome, Card, And Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Android 루트 화면의 본문 헤더를 제거하고, 공용 상단 바·필터 스트립·카드 스타일과 별도 노래 검색 화면을 구현한다.

**Architecture:** 화면별 UI 결정을 `MainScreenChromePolicy`와 필터/카드 spec에 모으고, `MainActivity`는 해당 spec을 공용 view builder에 전달한다. 데이터 조회와 화면 상태는 기존 repository 및 `MainUiPolicy`를 유지하며, XML에는 상단 고정 필터 컨테이너와 노래 검색 액션만 추가한다.

**Tech Stack:** Kotlin, Android Views, Material Components, View Binding, JUnit, Gradle.

---

## Investigation And Token-Minimized Work Rules

- Serena MCP가 제공되면 작업 시작 시 `initial_instructions`를 호출한다.
- 다음 순서로 조사한다.
  1. `find_symbol`로 변경 대상 함수 본문 확인.
  2. `find_referencing_symbols`로 호출부와 영향 범위 확인.
  3. 필요한 XML/색상 리소스만 `rtk rg`와 범위 읽기로 확인.
- 전체 `MainActivity.kt`나 리소스 디렉터리를 통째로 읽지 않는다.
- 우선 조사할 심볼:
  - `startScreen`
  - `updateTopBarScrolled`
  - `updateNavigationChrome`
  - `renderHome`
  - `renderLive`
  - `renderSongs`
  - `renderGoodsEvents`
  - `renderServerGoodsEvents`
  - `baseCard`
  - `compactEventCard`
  - `songFilterChips`
  - `songFilterRow`
  - `liveStatusChips`
  - `staticChips`
- 공용 심볼 변경 전에는 반드시 참조 검색으로 소비자를 확인한다.
- 셸 명령은 항상 `rtk`를 사용한다.
- 테스트 출력은 실패 요약 위주로 제한한다.
- 기존 작업 트리의 다른 변경을 수정하거나 되돌리지 않는다.
- 제공 이미지의 그래프·운동 기록·Samsung 고유 UI는 구현 근거로 사용하지 않는다. 파란 표시 영역과 설명 문구만 요구사항으로 취급한다.

## Minimal Test Policy

변경한 코드와 직접 연결된 테스트만 실행한다.

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest \
  --tests dev.minepacu.stelliveeventnotifier.MainScreenChromePolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.TopBarTextPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.MainUiPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.HubEventsPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.AndroidColorTokenPolicyTest
```

- `MainActivity.kt` 또는 XML 컴파일 검증이 필요할 때만 `rtk ./gradlew :app:assembleDebug`를 추가한다.
- 백엔드와 iOS 코드는 변경하지 않으므로 해당 테스트를 실행하지 않는다.
- 전체 Android 테스트, 기기 설치, 스크린샷 검증은 사용자가 별도로 요청하거나 공용 컴포넌트 회귀가 의심될 때만 수행한다.

## File Change Map

### Create

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/chrome/MainScreenChromePolicy.kt`
  - 화면별 본문 헤더, 상단 제목, 액션 표시 정책.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/HubCardFactory.kt`
  - 공용 카드 스타일과 MaterialCardView 생성.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/TopFilterStripView.kt`
  - 균등 배치/가로 스크롤 필터 UI.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/SectionHeaderView.kt`
  - 카드 외부 섹션 제목.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainScreenChromePolicyTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/TopFilterStripPolicyTest.kt`

### Modify

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
  - 공용 chrome/card/filter 연결.
  - 루트 화면 본문 헤더 제거.
  - 노래 검색 화면 및 상단 검색 액션.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainNavigationHistory.kt`
  - `SONG_SEARCH` 화면 추가.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
  - 화면별 필터 spec과 검색/상단 액션 정책.
- `android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml`
  - 상단 검색 버튼과 고정 필터 컨테이너.
- `android/StelliveHubAndroid/app/src/main/res/values/colors.xml`
- `android/StelliveHubAndroid/app/src/main/res/values-night/colors.xml`
  - 카드 표면과 필터 선택/스크롤 표시 색상.
- `android/StelliveHubAndroid/app/src/main/res/values/strings.xml`
  - 검색 및 필터 접근성 문자열.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/TopBarTextPolicyTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainUiPolicyTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsPolicyTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/AndroidColorTokenPolicyTest.kt`
- `CODEMAP.md`
- `docs/AI_HANDOFF.md`

## Task 1: Screen Chrome Policy

**Files:**

- Create: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/chrome/MainScreenChromePolicy.kt`
- Create: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainScreenChromePolicyTest.kt`
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/TopBarTextPolicyTest.kt`

- [ ] **Step 1: Add failing root/detail chrome tests**

```kotlin
@Test
fun rootScreensHideExpandedHeaderAndCollapseTitleAfterScroll() {
    listOf("home", "live", "songs", "goods_events").forEach { screenId ->
        val spec = MainScreenChromePolicy.spec(screenId)
        assertFalse(spec.showExpandedBodyHeader)
        assertTrue(spec.showTopBarTitleAtRest)
        assertFalse(spec.keepTopBarTitleWhenScrolled)
    }
}

@Test
fun detailAndSearchScreensKeepTitleVisible() {
    listOf("goods_event_detail", "song_search", "settings").forEach { screenId ->
        assertTrue(MainScreenChromePolicy.spec(screenId).keepTopBarTitleWhenScrolled)
    }
}
```

- [ ] **Step 2: Run the new tests and confirm RED**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.MainScreenChromePolicyTest
```

Expected: unresolved `MainScreenChromePolicy`.

- [ ] **Step 3: Add minimal chrome types and policy**

```kotlin
data class MainScreenChromeSpec(
    val showExpandedBodyHeader: Boolean,
    val showTopBarTitleAtRest: Boolean,
    val keepTopBarTitleWhenScrolled: Boolean,
    val showSettingsAction: Boolean,
    val showSongSearchAction: Boolean,
)

object MainScreenChromePolicy {
    fun spec(screenId: String, canGoBack: Boolean = false): MainScreenChromeSpec {
        val root = screenId in setOf("home", "live", "songs", "goods_events")
        return MainScreenChromeSpec(
            showExpandedBodyHeader = !root,
            showTopBarTitleAtRest = true,
            keepTopBarTitleWhenScrolled = !root,
            showSettingsAction = root && !canGoBack,
            showSongSearchAction = screenId == "songs" && !canGoBack,
        )
    }
}
```

- [ ] **Step 4: Run focused chrome tests and confirm GREEN**

```bash
rtk ./gradlew :app:testDebugUnitTest \
  --tests dev.minepacu.stelliveeventnotifier.MainScreenChromePolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.TopBarTextPolicyTest
```

## Task 2: Top Bar And Fixed Filter Container

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml`
- Modify: `android/StelliveHubAndroid/app/src/main/res/values/strings.xml`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`

- [ ] **Step 1: Add XML search action and filter container**

Add `topBarSongSearch` before `topBarSettings`:

```xml
<ImageButton
    android:id="@+id/topBarSongSearch"
    android:layout_width="44dp"
    android:layout_height="44dp"
    android:background="@android:color/transparent"
    android:contentDescription="@string/action_song_search"
    android:padding="10dp"
    android:src="@drawable/ic_search"
    android:visibility="gone"
    app:tint="@color/hub_text" />
```

Add a container between `topBar` and `topBarFadeSpace`:

```xml
<FrameLayout
    android:id="@+id/topFilterContainer"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:visibility="gone" />
```

- [ ] **Step 2: Bind action visibility through chrome spec**

```kotlin
private fun updateNavigationChrome() {
    val canGoBack = navigationHistory.canGoBack
    val spec = MainScreenChromePolicy.spec(navigationHistory.currentScreen.id, canGoBack)
    binding.topBarBack.isVisible = canGoBack
    binding.topBarTitleGroup.isVisible = spec.showTopBarTitleAtRest
    binding.topBarSettings.isVisible = spec.showSettingsAction
    binding.topBarSongSearch.isVisible = spec.showSongSearchAction
}
```

- [ ] **Step 3: Make scroll behavior policy-driven**

```kotlin
private fun updateTopBarScrolled(scrolled: Boolean) {
    val spec = MainScreenChromePolicy.spec(
        navigationHistory.currentScreen.id,
        navigationHistory.canGoBack,
    )
    val showTitle = !scrolled || spec.keepTopBarTitleWhenScrolled
    binding.collapsedTitle.alpha = if (showTitle) 1f else 0f
    binding.collapsedRole.alpha = if (showTitle) 1f else 0f
    updateTopBarGlass(scrolled)
}
```

- [ ] **Step 4: Compile only the Android app**

```bash
rtk ./gradlew :app:assembleDebug
```

Expected: build succeeds; no backend/iOS commands.

## Task 3: Remove Root Body Headers

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainScreenChromePolicyTest.kt`

- [ ] **Step 1: Change `startScreen` to accept chrome policy**

```kotlin
private fun startScreen(screenId: String, title: String, role: String) {
    val spec = MainScreenChromePolicy.spec(screenId, navigationHistory.canGoBack)
    // existing reset work
    if (spec.showExpandedBodyHeader) {
        binding.contentList.addView(screenTitle(title))
        binding.contentList.addView(screenCopy(role))
    }
}
```

- [ ] **Step 2: Preserve detailed screen behavior**

Verify `goods_event_detail`, settings, history, member filter, and song search still receive their intended title treatment. If a child screen should use only the top title, pass an explicit chrome override rather than adding title views manually.

- [ ] **Step 3: Run focused chrome tests**

```bash
rtk ./gradlew :app:testDebugUnitTest \
  --tests dev.minepacu.stelliveeventnotifier.MainScreenChromePolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.TopBarTextPolicyTest
```

## Task 4: Shared Card Factory And Color Tokens

**Files:**

- Create: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/HubCardFactory.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/res/values/colors.xml`
- Modify: `android/StelliveHubAndroid/app/src/main/res/values-night/colors.xml`
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/AndroidColorTokenPolicyTest.kt`

- [ ] **Step 1: Add failing color token assertions**

```kotlin
assertTrue(lightColors.containsKey("hub_card_surface"))
assertTrue(darkColors.containsKey("hub_card_surface"))
assertNotEquals(darkColors["hub_background"], darkColors["hub_card_surface"])
```

- [ ] **Step 2: Add semantic card tokens**

```xml
<color name="hub_card_surface">#FFFFFF</color>
<color name="hub_card_surface_compact">#F0F3F3</color>
```

Night resources use dark gray surfaces distinct from black background.

- [ ] **Step 3: Add the factory**

```kotlin
enum class HubCardStyle { STANDARD, COMPACT, INTERACTIVE }

class HubCardFactory(private val context: Context) {
    fun create(style: HubCardStyle): MaterialCardView =
        MaterialCardView(context).apply {
            radius = context.dp(if (style == HubCardStyle.COMPACT) 14 else 18).toFloat()
            cardElevation = 0f
            setCardBackgroundColor(context.color(R.color.hub_card_surface))
            strokeWidth = if (style == HubCardStyle.INTERACTIVE) context.dp(1) else 0
            strokeColor = context.color(R.color.hub_line)
        }
}
```

- [ ] **Step 4: Keep a compatibility wrapper**

```kotlin
private fun baseCard(style: HubCardStyle = HubCardStyle.STANDARD): MaterialCardView =
    cardFactory.create(style)
```

Convert only card builders touched by this feature: status strip, live row, song card, member selector, summary/notice/event cards. Avoid unrelated settings-card rewrites unless the factory wrapper already covers them.

- [ ] **Step 5: Run color and policy tests**

```bash
rtk ./gradlew :app:testDebugUnitTest \
  --tests dev.minepacu.stelliveeventnotifier.AndroidColorTokenPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.MainUiPolicyTest
```

## Task 5: External Section Header

**Files:**

- Create: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/SectionHeaderView.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`

- [ ] **Step 1: Implement a reusable header**

```kotlin
class SectionHeaderView(context: Context) : LinearLayout(context) {
    fun bind(title: String, trailingText: String? = null) {
        removeAllViews()
        // left title and optional right metadata
    }
}
```

- [ ] **Step 2: Replace feature-local labels**

Use it for:

- Home section labels.
- Calendar date/range headers.
- Song member/result grouping where a card title is currently repeated.

Do not move event title, song title, or member name out of their content cards.

- [ ] **Step 3: Compile**

```bash
rtk ./gradlew :app:assembleDebug
```

## Task 6: Shared Top Filter Strip

**Files:**

- Create: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/TopFilterStripView.kt`
- Create: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/TopFilterStripPolicyTest.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`

- [ ] **Step 1: Add failing layout policy tests**

```kotlin
@Test
fun threeOptionsUseEqualWidthWithoutScrolling() {
    assertEquals(FilterStripLayoutMode.EQUAL_WIDTH, filterStripLayoutMode(3))
}

@Test
fun fourOrMoreOptionsUseHorizontalScroll() {
    assertEquals(FilterStripLayoutMode.HORIZONTAL_SCROLL, filterStripLayoutMode(4))
}
```

- [ ] **Step 2: Add pure layout policy**

```kotlin
enum class FilterStripLayoutMode { EQUAL_WIDTH, HORIZONTAL_SCROLL }

fun filterStripLayoutMode(optionCount: Int): FilterStripLayoutMode =
    if (optionCount <= 3) FilterStripLayoutMode.EQUAL_WIDTH
    else FilterStripLayoutMode.HORIZONTAL_SCROLL
```

- [ ] **Step 3: Implement `TopFilterStripView`**

The component accepts `List<TopFilterGroup>` and a callback:

```kotlin
fun bind(
    groups: List<TopFilterGroup>,
    onSelected: (groupId: String, optionId: String) -> Unit,
)
```

For scrolling groups:

- Child option minimum width approximates one third of available width.
- Horizontal scrollbar remains hidden.
- A non-clickable end fade/chevron becomes visible when more content exists.
- Checked state and accessibility description are set on each option.

- [ ] **Step 4: Run filter policy tests**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.TopFilterStripPolicyTest
```

## Task 7: Live And Goods/Events Filter Migration

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainUiPolicyTest.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsPolicyTest.kt`

- [ ] **Step 1: Define screen filter groups**

```kotlin
fun liveTopFilterGroups(selectedId: String): List<TopFilterGroup>
fun goodsEventsTopFilterGroups(selectedId: String): List<TopFilterGroup>
```

The goods/events IDs remain:

```text
all, goods, ticketing, offline, closing
```

- [ ] **Step 2: Add policy tests for exact IDs and selected state**

Ensure no member catalog or notification policy values are introduced.

- [ ] **Step 3: Render filters in `topFilterContainer`**

Remove `liveStatusChips()` and `staticChips(...)` from content body. Bind the shared filter strip before rendering each screen.

- [ ] **Step 4: Connect selection**

- Live selection updates `selectedLiveStatusFilter` and rerenders live.
- Goods/events selection updates `selectedFilter`, calls the existing repository boundary, and rerenders the calendar/feed.

- [ ] **Step 5: Run focused tests**

```bash
rtk ./gradlew :app:testDebugUnitTest \
  --tests dev.minepacu.stelliveeventnotifier.MainUiPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.HubEventsPolicyTest
```

## Task 8: Song Filters And Search Navigation

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainNavigationHistory.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`

- [ ] **Step 1: Add failing search navigation tests**

```kotlin
assertTrue(MainScreenChromePolicy.spec("songs").showSongSearchAction)
assertFalse(MainScreenChromePolicy.spec("song_search", canGoBack = true).showSongSearchAction)
assertTrue(MainScreenChromePolicy.spec("song_search", canGoBack = true).keepTopBarTitleWhenScrolled)
```

- [ ] **Step 2: Add `SONG_SEARCH` navigation entry**

```kotlin
SONG_SEARCH("song_search")
```

- [ ] **Step 3: Move song filter rows to the shared strip**

Bind two groups:

```kotlin
TopFilterGroup("generation", songGenerationFilters(), selectedSongGenerationId)
TopFilterGroup("type", songTypeFilters(), selectedSongType)
```

Remove `songFilterChips()` from the body.

- [ ] **Step 4: Remove `songSearchCard()` from `renderSongs()`**

The songs screen shows:

1. compact server status,
2. member selector,
3. song cards,
4. pagination.

- [ ] **Step 5: Add `renderSongSearch()`**

Reuse the existing EditText construction and debounce:

```kotlin
private fun renderSongSearch() {
    startScreen("song_search", "노래 검색", "제목 또는 멤버를 검색합니다.")
    binding.contentList.addView(songSearchInput())
    renderSongSearchResults()
}
```

`renderSongSearchResults()` applies current generation/type/member/query filters without fetching YouTube directly or changing repository contracts.

- [ ] **Step 6: Wire top search action**

```kotlin
binding.topBarSongSearch.setOnClickListener {
    navigateTo(HubScreen.SONG_SEARCH, addToBackStack = true)
}
```

- [ ] **Step 7: Preserve crash fix**

- Do not call `renderSongSearch()` synchronously inside focus-loss callback.
- Continue using `scheduleSongSearchRender()`.
- Cancel pending callbacks when leaving both `SONGS` and `SONG_SEARCH`.

- [ ] **Step 8: Run focused song tests**

```bash
rtk ./gradlew :app:testDebugUnitTest \
  --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.MainScreenChromePolicyTest
```

## Task 9: Remove Goods/Events Summary Rectangles

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsPolicyTest.kt`

- [ ] **Step 1: Add a policy assertion**

```kotlin
assertFalse(MainUiPolicy.goodsEventsSummaryCardsVisible())
```

- [ ] **Step 2: Add minimal policy**

```kotlin
fun goodsEventsSummaryCardsVisible(): Boolean = false
```

- [ ] **Step 3: Remove summary grid from both render paths**

Remove `summaryGrid(...)` from:

- `renderGoodsEvents()`
- `renderServerGoodsEvents()`

Do not delete summary data from models because it may still be used by home/status logic.

- [ ] **Step 4: Run focused event tests**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubEventsPolicyTest
```

## Task 10: Final Focused Verification And Documentation

**Files:**

- Modify: `CODEMAP.md`
- Modify: `docs/AI_HANDOFF.md`

- [ ] **Step 1: Run the complete changed-code test set**

```bash
rtk ./gradlew :app:testDebugUnitTest \
  --tests dev.minepacu.stelliveeventnotifier.MainScreenChromePolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.TopFilterStripPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.TopBarTextPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.MainUiPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.HubEventsPolicyTest \
  --tests dev.minepacu.stelliveeventnotifier.AndroidColorTokenPolicyTest
```

- [ ] **Step 2: Run Android compile verification**

```bash
rtk ./gradlew :app:assembleDebug
```

- [ ] **Step 3: Check diff hygiene**

```bash
rtk git diff --check
rtk git status --short
```

- [ ] **Step 4: Targeted policy scan**

```bash
rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|official logo|Samsung One UI|profile image binary" \
  android/StelliveHubAndroid/app/src/main \
  android/StelliveHubAndroid/app/src/test \
  docs/superpowers/plans/2026-06-25-android-shared-ui-chrome-card-filter-*.md
```

Expected: existing policy references or explicit exclusions only.

- [ ] **Step 5: Update documentation**

Document:

- shared root-screen chrome policy,
- fixed top filter strip,
- separate song search screen,
- shared card surface/section header,
- no backend/iOS changes,
- focused tests actually run.

## Verification Checklist

- [ ] Root screens no longer add `screenTitle()`/`screenCopy()` to the body.
- [ ] Goods/event detail title remains visible while scrolling.
- [ ] Songs page has a top search action and no body search card.
- [ ] Search focus-loss path remains debounced and stable.
- [ ] Live, Songs, and Goods/Events use the shared fixed filter strip.
- [ ] Three options use equal width; four or more scroll horizontally.
- [ ] Scroll affordance is decorative and accessible.
- [ ] Goods/Events summary rectangles are removed.
- [ ] Card surfaces differ from the background in light and dark themes.
- [ ] Existing repository/API calls and client pagination are unchanged.
- [ ] No iOS/backend tests are run because those files are not changed.
- [ ] No prohibited assets, secrets, Former members, or unsupported official YouTube live behavior are introduced.
