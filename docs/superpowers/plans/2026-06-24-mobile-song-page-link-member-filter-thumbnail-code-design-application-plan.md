# Mobile Song Page Link Member Filter Thumbnail Implementation Plan

**For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for code changes and `superpowers:executing-plans` to implement task-by-task.

**Goal:** Fix Android song card YouTube navigation, add member filter selection pages with quick clear actions to Android/iOS song screens, and standardize song thumbnails to non-distorted 16:9 containers.

**Architecture:** Keep backend-mediated music data unchanged. Mobile UI state owns `selectedMemberId`, filters already fetched server song data client-side, resets client page to 1 when member selection changes, and renders thumbnails in a shared 16:9 policy. Android uses existing `MainActivity`/`MainUiPolicy`; iOS uses existing `SongsView`/`IOSSongPagePolicy`.

**Tech Stack:** Android Kotlin Views/JUnit, iOS SwiftUI/XCTest. No backend or YouTube Data API changes.

---

## Token-Minimized Work Rules

- Read only these files unless a compile error points elsewhere:
  - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
  - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
  - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainNavigationHistory.kt`
  - `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`
  - `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
  - `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`
- Use `rtk rg` for symbol lookup: `renderSongs`, `SongRow`, `SongThumbnailView`, `songMatchesGeneration`, `songPageItems`, `youtubeUrl`.
- Do not inspect backend files unless mobile API contract compilation fails.
- Do not add dependencies.
- Keep edits localized; avoid broad refactors of `MainActivity.kt`.
- Use `apply_patch` for edits.

## Minimal Test Policy

Run only tests tied to changed code:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Run broader Android/iOS build only if focused tests expose compile errors in shared UI/model code. No backend tests are required because the backend contract is unchanged.

## Task 1: Android song URL policy and card click

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`

- [ ] **Step 1: Add failing URL policy tests**

Add tests:

```kotlin
@Test
fun songExternalUrlAcceptsHttpAndHttpsOnly() {
    assertEquals("https://www.youtube.com/watch?v=abc", MainUiPolicy.songExternalUrl("https://www.youtube.com/watch?v=abc"))
    assertEquals("http://www.youtube.com/watch?v=abc", MainUiPolicy.songExternalUrl("http://www.youtube.com/watch?v=abc"))
    assertNull(MainUiPolicy.songExternalUrl(""))
    assertNull(MainUiPolicy.songExternalUrl("javascript:alert(1)"))
}
```

- [ ] **Step 2: Run RED**

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

Expected: `songExternalUrl` is missing.

- [ ] **Step 3: Implement URL helper**

Add to `MainUiPolicy`:

```kotlin
fun songExternalUrl(rawUrl: String?): String? {
    val trimmed = rawUrl?.trim().orEmpty()
    return trimmed.takeIf { it.startsWith("https://") || it.startsWith("http://") }
}
```

- [ ] **Step 4: Wire Android song card click**

In the Android song card builder, set the card clickable only when URL is valid:

```kotlin
val externalUrl = MainUiPolicy.songExternalUrl(song.youtubeUrl)
isClickable = externalUrl != null
isFocusable = externalUrl != null
setOnClickListener {
    openExternalUrl(externalUrl)
}
```

Keep existing `openExternalUrl()` as the only external-launch path.

- [ ] **Step 5: Run GREEN**

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

Expected: URL policy tests pass.

## Task 2: Shared member filter policy

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`

- [ ] **Step 1: Add failing Android member filter tests**

Add tests that assert:

```kotlin
val options = MainUiPolicy.songMemberFilters(members)
assertEquals("all", options.first().id)
assertFalse(options.any { it.id == "gangzi" || it.id == "stellive-official" })
assertTrue(MainUiPolicy.songMatchesMember(collabSong, "yuzuha-riko"))
assertTrue(MainUiPolicy.songMatchesMember(collabSong, "all"))
assertFalse(MainUiPolicy.songMatchesMember(collabSong, "akane-lize"))
assertEquals("전체", MainUiPolicy.songMemberFilterLabel(members, "all"))
assertEquals("네네코 마시로", MainUiPolicy.songMemberFilterLabel(members, "neneko-mashiro"))
assertFalse(MainUiPolicy.canClearSongMemberFilter("all"))
assertTrue(MainUiPolicy.canClearSongMemberFilter("neneko-mashiro"))
```

Use existing active member fixtures in the test file. If no fixture exists, create minimal `HubMember` values for active members plus `gamja`/`official` exclusions.

- [ ] **Step 2: Add failing iOS member filter tests**

Add tests that assert:

```swift
let filters = IOSSongPagePolicy.memberFilters(from: members)
XCTAssertEqual(filters.first?.id, "all")
XCTAssertFalse(filters.contains { $0.id == "gangzi" || $0.id == "stellive-official" })
XCTAssertTrue(IOSSongPagePolicy.matchesMember(collabSong, selectedMemberId: "yuzuha-riko"))
XCTAssertTrue(IOSSongPagePolicy.matchesMember(collabSong, selectedMemberId: "all"))
XCTAssertFalse(IOSSongPagePolicy.matchesMember(collabSong, selectedMemberId: "akane-lize"))
XCTAssertEqual(IOSSongPagePolicy.memberFilterLabel(from: members, selectedMemberId: "all"), "전체")
XCTAssertEqual(IOSSongPagePolicy.memberFilterLabel(from: members, selectedMemberId: "neneko-mashiro"), "네네코 마시로")
XCTAssertFalse(IOSSongPagePolicy.canClearMemberFilter("all"))
XCTAssertTrue(IOSSongPagePolicy.canClearMemberFilter("neneko-mashiro"))
```

- [ ] **Step 3: Run RED focused tests**

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected: member filter helpers are missing.

- [ ] **Step 4: Implement Android helpers**

Add helpers:

```kotlin
fun songMemberFilters(members: List<HubMember>): List<SongFilterOption> =
    listOf(SongFilterOption("all", "전체")) + members
        .filter { it.catalogRole == CatalogRole.MEMBER }
        .filter { it.generationId in setOf("gen1", "gen2", "gen3") }
        .map { SongFilterOption(it.id, it.nameKo.ifBlank { it.nameEn.orEmpty() }) }

fun songMatchesMember(song: SongCatalogItem, selectedMemberId: String): Boolean {
    if (selectedMemberId == "all") return true
    return song.members.any { it.id == selectedMemberId }
}

fun songMemberFilterLabel(members: List<HubMember>, selectedMemberId: String): String =
    if (selectedMemberId == "all") {
        "전체"
    } else {
        members.firstOrNull { it.id == selectedMemberId }?.nameKo?.takeIf { it.isNotBlank() } ?: selectedMemberId
    }

fun canClearSongMemberFilter(selectedMemberId: String): Boolean = selectedMemberId != "all"
```

Use existing enum/property names in the file; if names differ, adapt only at this helper boundary.

- [ ] **Step 5: Implement iOS helpers**

Add to `IOSSongPagePolicy`:

```swift
static func memberFilters(from members: [HubMember]) -> [SongFilter] {
    [SongFilter(id: "all", label: "전체")] + members
        .filter { $0.catalogRole == .member && ["gen1", "gen2", "gen3"].contains($0.generationId) }
        .map { SongFilter(id: $0.id, label: $0.nameKo.isEmpty ? ($0.nameEn ?? $0.id) : $0.nameKo) }
}

static func matchesMember(_ song: SongCatalogItem, selectedMemberId: String) -> Bool {
    selectedMemberId == "all" || song.members.contains { $0.id == selectedMemberId }
}

static func memberFilterLabel(from members: [HubMember], selectedMemberId: String) -> String {
    guard selectedMemberId != "all" else { return "전체" }
    return members.first { $0.id == selectedMemberId }?.nameKo.nonEmpty ?? selectedMemberId
}

static func canClearMemberFilter(_ selectedMemberId: String) -> Bool {
    selectedMemberId != "all"
}
```

If `String.nonEmpty` does not exist, use:

```swift
let name = members.first { $0.id == selectedMemberId }?.nameKo ?? ""
return name.isEmpty ? selectedMemberId : name
```

- [ ] **Step 6: Run GREEN focused tests**

Run the same Android/iOS focused commands. Expected: member policy tests pass.

## Task 3: Android member filter page with quick clear

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainNavigationHistory.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`

- [ ] **Step 1: Add screen id**

Add enum value:

```kotlin
SONG_MEMBER_FILTER("song_member_filter")
```

Route it in `renderScreen()`:

```kotlin
HubScreen.SONG_MEMBER_FILTER -> renderSongMemberFilter()
```

- [ ] **Step 2: Add state and clear helper**

Add:

```kotlin
private var selectedSongMemberId = "all"

private fun setSelectedSongMember(memberId: String) {
    selectedSongMemberId = memberId
    selectedSongPage = 1
}
```

- [ ] **Step 3: Add song page entry row**

On `renderSongs()`, add compact selection row near existing filters:

```kotlin
val currentMembers = serverMembers ?: repository.members
binding.contentList.addView(
    compactEventCard(
        title = "멤버",
        body = MainUiPolicy.songMemberFilterLabel(currentMembers, selectedSongMemberId),
        pills = if (MainUiPolicy.canClearSongMemberFilter(selectedSongMemberId)) {
            listOf("전체로 보기", "선택")
        } else {
            listOf("선택")
        },
    ).apply {
        isClickable = true
        isFocusable = true
        setOnClickListener { navigateTo(HubScreen.SONG_MEMBER_FILTER, addToBackStack = true) }
    },
)
```

If `compactEventCard` cannot expose a separate trailing clear button, implement quick clear as a small adjacent text button directly under the member row:

```kotlin
if (MainUiPolicy.canClearSongMemberFilter(selectedSongMemberId)) {
    binding.contentList.addView(detailActionButton("전체로 보기", primary = false) {
        setSelectedSongMember("all")
        renderSongs()
    })
}
```

- [ ] **Step 4: Apply member filter**

When building filtered songs, include:

```kotlin
.filter { MainUiPolicy.songMatchesMember(it, selectedSongMemberId) }
```

Use this after generation/type and before query/page slicing.

- [ ] **Step 5: Render member filter page**

Implement `renderSongMemberFilter()` with existing title bar/back behavior:

```kotlin
startScreen(
    screenId = "song_member_filter",
    title = "노래 멤버 선택",
    role = "노래 목록을 멤버별로 좁혀 봅니다.",
)
MainUiPolicy.songMemberFilters(currentMembers).forEach { option ->
    binding.contentList.addView(
        compactEventCard(
            title = option.label,
            body = if (option.id == selectedSongMemberId) "선택됨" else "탭해서 선택",
            pills = if (option.id == selectedSongMemberId) listOf("선택됨") else emptyList(),
        ).apply {
            isClickable = true
            isFocusable = true
            setOnClickListener {
                setSelectedSongMember(option.id)
                navigationHistory.goBack()
                renderSongs()
                updateNavigationChrome()
            }
        },
    )
}
```

- [ ] **Step 6: Run focused Android test**

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

Expected: focused policy tests pass; UI compile errors, if any, are local to `MainActivity.kt`.

## Task 4: iOS member filter page with quick clear

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`

- [ ] **Step 1: Add state**

Add:

```swift
@State private var selectedMemberId = "all"
```

- [ ] **Step 2: Apply member filter**

In `songs`, add:

```swift
IOSSongPagePolicy.matchesMember($0, selectedMemberId: selectedMemberId)
```

between generation and query filters.

- [ ] **Step 3: Add navigation entry and quick clear**

Add a `NavigationLink` section near existing filters:

```swift
NavigationLink {
    SongMemberFilterView(
        filters: IOSSongPagePolicy.memberFilters(from: store.members),
        selectedMemberId: $selectedMemberId,
        selectedPage: $selectedPage
    )
} label: {
    HStack {
        Text("멤버")
        Spacer()
        Text(IOSSongPagePolicy.memberFilterLabel(from: store.members, selectedMemberId: selectedMemberId))
            .foregroundStyle(.secondary)
    }
}
```

Directly below the row, show quick clear only when a member is selected:

```swift
if IOSSongPagePolicy.canClearMemberFilter(selectedMemberId) {
    Button("전체로 보기") {
        selectedMemberId = "all"
        selectedPage = 1
    }
}
```

- [ ] **Step 4: Add selection view**

Add private view in `SongsView.swift`:

```swift
private struct SongMemberFilterView: View {
    let filters: [SongFilter]
    @Binding var selectedMemberId: String
    @Binding var selectedPage: Int
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List(filters, id: \.id) { filter in
            Button {
                selectedMemberId = filter.id
                selectedPage = 1
                dismiss()
            } label: {
                HStack {
                    Text(filter.label)
                    Spacer()
                    if selectedMemberId == filter.id {
                        Image(systemName: "checkmark")
                    }
                }
            }
        }
        .navigationTitle("노래 멤버 선택")
    }
}
```

- [ ] **Step 5: Run focused iOS test**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected: focused policy tests pass.

## Task 5: 16:9 thumbnail policy and rendering

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`

- [ ] **Step 1: Add failing aspect tests**

Android:

```kotlin
@Test
fun songThumbnailUsesSixteenByNineAspectRatio() {
    assertEquals(16f / 9f, MainUiPolicy.SONG_THUMBNAIL_ASPECT_RATIO)
    assertEquals(63, MainUiPolicy.songThumbnailHeightDp(widthDp = 112))
}
```

iOS:

```swift
func testSongThumbnailUsesSixteenByNineAspectRatio() {
    XCTAssertEqual(IOSSongPagePolicy.thumbnailAspectRatio, 16.0 / 9.0, accuracy: 0.001)
    XCTAssertEqual(IOSSongPagePolicy.thumbnailSize.width / IOSSongPagePolicy.thumbnailSize.height, 16.0 / 9.0, accuracy: 0.001)
}
```

- [ ] **Step 2: Implement policy constants**

Android:

```kotlin
const val SONG_THUMBNAIL_ASPECT_RATIO = 16f / 9f
fun songThumbnailHeightDp(widthDp: Int): Int = (widthDp / SONG_THUMBNAIL_ASPECT_RATIO).roundToInt()
```

iOS:

```swift
static let thumbnailAspectRatio: CGFloat = 16.0 / 9.0
static let thumbnailSize = CGSize(width: 96, height: 54)
```

- [ ] **Step 3: Update Android thumbnail view**

Use a fixed 16:9 layout and center-crop:

```kotlin
ImageView(context).apply {
    scaleType = ImageView.ScaleType.CENTER_CROP
    adjustViewBounds = false
    background = rounded(fill = color(R.color.hub_surface), radius = dp(10))
}
```

Set layout params:

```kotlin
LinearLayout.LayoutParams(dp(112), dp(MainUiPolicy.songThumbnailHeightDp(112)))
```

Fallback/placeholder uses the same params.

- [ ] **Step 4: Update iOS thumbnail view**

Use:

```swift
image
    .resizable()
    .scaledToFill()
    .frame(width: IOSSongPagePolicy.thumbnailSize.width, height: IOSSongPagePolicy.thumbnailSize.height)
    .clipped()
```

Apply the same frame to placeholder/fallback.

- [ ] **Step 5: Run focused tests**

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected: aspect policy tests pass and song UI files compile.

## Task 6: Final focused verification

**Files:** no source edits unless verification exposes a local defect.

- [ ] **Step 1: Android focused test**

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

- [ ] **Step 2: iOS focused test**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

- [ ] **Step 3: Mobile YouTube boundary grep**

```bash
rtk rg -n "YOUTUBE_API_KEY|youtube.googleapis.com|/youtube/v3" android/StelliveHubAndroid/app/src/main ios/StelliveHubiOS/StelliveHubiOS
```

Expected: no mobile YouTube Data API usage or API key reference.

## Acceptance Criteria

- Android song cards open valid server-provided `youtubeUrl`.
- iOS song card link behavior remains working.
- Android/iOS both provide a member filter selection page from the song page.
- Member filtering uses `song.members` and supports collab rows.
- Member filter excludes `gamja` and `official`.
- Selecting a member immediately dismisses/returns to the song page and resets page to 1.
- When a member is selected, the song page provides one-tap `전체로 보기` quick clear and resets page to 1.
- Android/iOS song thumbnails render in 16:9 containers.
- Non-16:9 thumbnail sources are not stretched; they are center-cropped inside the 16:9 area.
- Only changed mobile policy/UI tests are required unless compile errors force a narrow build follow-up.
