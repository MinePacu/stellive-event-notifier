# Mobile Song Page Thumbnail And Pagination Implementation Plan

**For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for behavior changes and `superpowers:executing-plans` when implementing this plan task-by-task.

**Goal:** iPhone/Android 노래 페이지에 서버 제공 썸네일을 표시하고, 필터링된 노래 목록을 클라이언트 page 단위로 렌더링한다.

**Architecture:** Backend와 shared schema는 변경하지 않는다. 각 모바일 앱은 이미 매핑된 `SongCatalogItem.thumbnailUrl`을 UI에 연결하고, policy helper에서 page 계산을 수행한 뒤 View/Activity가 해당 slice만 렌더링한다.

**Tech Stack:** Android Kotlin/XML-less View code, JUnit; iOS SwiftUI, XCTest.

---

## Token-Minimized Work Rules

- 먼저 아래 파일만 읽는다.
  - `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
  - `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
  - `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/SongUiPolicyTest.kt`
  - `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
  - `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
  - `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`
- 컴파일 오류가 다른 파일을 지목할 때만 추가 파일을 연다.
- `rtk rg`와 짧은 `rtk proxy sed -n` 범위 읽기를 사용한다.
- 전체 파일 dump, 전체 테스트, backend Docker rebuild, server sync는 수행하지 않는다.
- 새 dependency를 추가하지 않는다.
- generated file이나 project-wide formatting을 실행하지 않는다.

## Focused Test Policy

변경된 코드에 필요한 최소 테스트만 수행한다.

Android:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.SongUiPolicyTest
```

iOS:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Run broader tests only if focused tests fail because shared mobile model compilation breaks.

## Task 1: Android pagination policy

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/SongUiPolicyTest.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`

- [ ] **Step 1: Write failing tests**

Add tests:

```kotlin
@Test
fun songPaginationCalculatesPagesAndSlicesItems() {
    val songs = (1..45).map { index ->
        SongCatalogItem(
            id = "video-$index",
            youtubeVideoId = "video-$index",
            title = "Song $index",
            type = SongType.COVER,
            youtubeUrl = "https://www.youtube.com/watch?v=video-$index",
        )
    }

    assertEquals(3, MainUiPolicy.songPageCount(totalItems = songs.size, pageSize = 20))
    assertEquals((1..20).map { "video-$it" }, MainUiPolicy.songPageItems(songs, page = 1, pageSize = 20).map { it.id })
    assertEquals((21..40).map { "video-$it" }, MainUiPolicy.songPageItems(songs, page = 2, pageSize = 20).map { it.id })
    assertEquals((41..45).map { "video-$it" }, MainUiPolicy.songPageItems(songs, page = 3, pageSize = 20).map { it.id })
    assertEquals(3, MainUiPolicy.coerceSongPage(page = 99, totalItems = songs.size, pageSize = 20))
    assertEquals(1, MainUiPolicy.coerceSongPage(page = 0, totalItems = songs.size, pageSize = 20))
}
```

- [ ] **Step 2: Run RED**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.SongUiPolicyTest
```

Expected: fail because pagination helpers are missing.

- [ ] **Step 3: Implement minimal Android helpers**

Add to `MainUiPolicy`:

```kotlin
const val SONG_PAGE_SIZE = 20

fun songPageCount(totalItems: Int, pageSize: Int = SONG_PAGE_SIZE): Int {
    if (totalItems <= 0) return 1
    return ((totalItems - 1) / pageSize) + 1
}

fun coerceSongPage(page: Int, totalItems: Int, pageSize: Int = SONG_PAGE_SIZE): Int =
    page.coerceIn(1, songPageCount(totalItems, pageSize))

fun songPageItems(
    songs: List<SongCatalogItem>,
    page: Int,
    pageSize: Int = SONG_PAGE_SIZE,
): List<SongCatalogItem> {
    val safePage = coerceSongPage(page, songs.size, pageSize)
    val fromIndex = (safePage - 1) * pageSize
    val toIndex = minOf(fromIndex + pageSize, songs.size)
    return songs.subList(fromIndex, toIndex)
}
```

- [ ] **Step 4: Run GREEN**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.SongUiPolicyTest
```

Expected: pass.

## Task 2: Android thumbnail UI and page controls

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/SongUiPolicyTest.kt`

- [ ] **Step 1: Add state**

Add:

```kotlin
private var selectedSongPage = 1
```

When generation filter, type filter, or search query changes, set `selectedSongPage = 1` before `renderSongs()`.

- [ ] **Step 2: Apply pagination after filtering**

In `renderSongs()`:

```kotlin
val safePage = MainUiPolicy.coerceSongPage(selectedSongPage, visibleSongs.size)
selectedSongPage = safePage
val pagedSongs = MainUiPolicy.songPageItems(visibleSongs, safePage)
```

Render `pagedSongs` instead of `visibleSongs`.

- [ ] **Step 3: Add Android song thumbnail view**

Add helper:

```kotlin
private fun songThumbnail(song: SongCatalogItem): View =
    FrameLayout(this).apply {
        val size = dp(72)
        layoutParams = LinearLayout.LayoutParams(size, size).apply {
            rightMargin = dp(12)
        }
        background = rounded(fill = color(R.color.hub_chip_background), radius = dp(12))
        val url = song.thumbnailUrl?.takeIf { it.startsWith("https://") }
        if (url != null) {
            addView(ImageView(context).apply {
                scaleType = ImageView.ScaleType.CENTER_CROP
                clipToOutline = true
                background = rounded(fill = color(R.color.hub_chip_background), radius = dp(12))
                thread {
                    runCatching {
                        URL(url).openStream().use { BitmapFactory.decodeStream(it) }
                    }.getOrNull()?.let { bitmap ->
                        runOnUiThread { setImageBitmap(bitmap) }
                    }
                }
            }, FrameLayout.LayoutParams(size, size))
        } else {
            addView(TextView(context).apply {
                text = "♪"
                gravity = Gravity.CENTER
                setTextColor(color(R.color.hub_text_muted))
                textSize = 20f
            }, FrameLayout.LayoutParams(size, size))
        }
    }
```

Use existing imports already present in `MainActivity.kt`; add imports only if compiler asks.

- [ ] **Step 4: Put thumbnail into `songCard(song)`**

Make the card content horizontal:

```kotlin
val row = LinearLayout(context).apply {
    orientation = LinearLayout.HORIZONTAL
    setPadding(dp(15), dp(14), dp(15), dp(14))
}
row.addView(songThumbnail(song))
row.addView(textColumn)
addView(row)
```

Keep existing title, member/type, and published date text behavior.

- [ ] **Step 5: Add page control**

Render after song rows only when page count is greater than 1:

```kotlin
if (MainUiPolicy.songPageCount(visibleSongs.size) > 1) {
    binding.contentList.addView(songPageControl(visibleSongs.size))
}
```

The control must show previous, `selectedSongPage / pageCount`, next. Previous is disabled on page 1, next is disabled on last page.

- [ ] **Step 6: Run Android focused test**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.SongUiPolicyTest
```

Expected: pass and compile `MainActivity.kt`.

## Task 3: iOS pagination policy

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`

- [ ] **Step 1: Write failing tests**

Add tests:

```swift
func testSongPaginationCalculatesPagesAndSlicesItems() {
    let songs = (1...45).map { index in
        SongCatalogItem(
            id: "video-\(index)",
            youtubeVideoId: "video-\(index)",
            title: "Song \(index)",
            type: .cover,
            youtubeUrl: "https://www.youtube.com/watch?v=video-\(index)"
        )
    }

    XCTAssertEqual(IOSSongPagePolicy.pageCount(totalItems: songs.count, pageSize: 20), 3)
    XCTAssertEqual(IOSSongPagePolicy.pageItems(songs, page: 1, pageSize: 20).map(\.id), (1...20).map { "video-\($0)" })
    XCTAssertEqual(IOSSongPagePolicy.pageItems(songs, page: 2, pageSize: 20).map(\.id), (21...40).map { "video-\($0)" })
    XCTAssertEqual(IOSSongPagePolicy.pageItems(songs, page: 3, pageSize: 20).map(\.id), (41...45).map { "video-\($0)" })
    XCTAssertEqual(IOSSongPagePolicy.clampedPage(99, totalItems: songs.count, pageSize: 20), 3)
    XCTAssertEqual(IOSSongPagePolicy.clampedPage(0, totalItems: songs.count, pageSize: 20), 1)
}
```

- [ ] **Step 2: Run RED**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected: fail because pagination helpers are missing.

- [ ] **Step 3: Implement iOS helpers**

Add to `IOSSongPagePolicy`:

```swift
static let pageSize = 20

static func pageCount(totalItems: Int, pageSize: Int = Self.pageSize) -> Int {
    guard totalItems > 0 else { return 1 }
    return ((totalItems - 1) / pageSize) + 1
}

static func clampedPage(_ page: Int, totalItems: Int, pageSize: Int = Self.pageSize) -> Int {
    min(max(page, 1), pageCount(totalItems: totalItems, pageSize: pageSize))
}

static func pageItems(_ songs: [SongCatalogItem], page: Int, pageSize: Int = Self.pageSize) -> [SongCatalogItem] {
    let safePage = clampedPage(page, totalItems: songs.count, pageSize: pageSize)
    let start = (safePage - 1) * pageSize
    let end = min(start + pageSize, songs.count)
    return Array(songs[start..<end])
}
```

- [ ] **Step 4: Run GREEN**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected: pass.

## Task 4: iOS thumbnail UI and page controls

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`

- [ ] **Step 1: Add page state**

Add:

```swift
@State private var selectedPage = 1
```

Add computed values:

```swift
private var currentPage: Int {
    IOSSongPagePolicy.clampedPage(selectedPage, totalItems: songs.count)
}

private var pagedSongs: [SongCatalogItem] {
    IOSSongPagePolicy.pageItems(songs, page: currentPage)
}
```

- [ ] **Step 2: Reset page on filters**

Use `onChange` for `selectedGenerationId`, `selectedType`, and `query`:

```swift
.onChange(of: selectedGenerationId) { _, _ in selectedPage = 1 }
.onChange(of: selectedType) { _, _ in selectedPage = 1 }
.onChange(of: query) { _, _ in selectedPage = 1 }
```

- [ ] **Step 3: Use `pagedSongs` in the list**

Replace `ForEach(songs)` with:

```swift
ForEach(pagedSongs) { song in
    SongRow(song: song)
}
```

- [ ] **Step 4: Render iOS thumbnail URL**

Change `SongThumbnailView`:

```swift
private struct SongThumbnailView: View {
    let thumbnailUrl: String?

    var body: some View {
        Group {
            if let thumbnailUrl, let url = URL(string: thumbnailUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: 64, height: 64)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color(.tertiarySystemGroupedBackground))
            .overlay {
                Image(systemName: "play.rectangle.fill")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
    }
}
```

Use `SongThumbnailView(thumbnailUrl: song.thumbnailUrl)` in `SongRow`.

- [ ] **Step 5: Add iOS page control**

At the end of the song list section:

```swift
if IOSSongPagePolicy.pageCount(totalItems: songs.count) > 1 {
    HStack {
        Button("이전") { selectedPage = max(1, currentPage - 1) }
            .disabled(currentPage == 1)
        Spacer()
        Text("\(currentPage) / \(IOSSongPagePolicy.pageCount(totalItems: songs.count))")
            .font(.caption)
            .foregroundStyle(.secondary)
        Spacer()
        Button("다음") { selectedPage = min(IOSSongPagePolicy.pageCount(totalItems: songs.count), currentPage + 1) }
            .disabled(currentPage == IOSSongPagePolicy.pageCount(totalItems: songs.count))
    }
}
```

- [ ] **Step 6: Run iOS focused test**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected: pass and compile `SongsView.swift`.

## Task 5: Final focused verification

**Files:** no source changes unless focused tests identify a defect.

- [ ] **Step 1: Android focused verification**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.SongUiPolicyTest
```

- [ ] **Step 2: iOS focused verification**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

- [ ] **Step 3: Mobile policy grep**

```bash
rtk rg -n "YOUTUBE_API_KEY|youtube.googleapis.com|/youtube/v3|Former|logoUrl|fan art" android/StelliveHubAndroid/app/src/main ios/StelliveHubiOS/StelliveHubiOS
```

Expected:

- no mobile YouTube API key usage;
- no direct YouTube Data API endpoint usage;
- no new Former member catalog/filter exposure;
- no committed protected media assets.

## Acceptance Criteria

- iOS song card displays server-provided thumbnail image when `thumbnailUrl` is valid.
- Android song card includes a thumbnail area and displays server-provided thumbnail image when `thumbnailUrl` is valid.
- Both platforms show placeholder on missing or failed thumbnail loads.
- Both platforms paginate filtered client-side song lists at 20 items per page.
- Filter or search changes reset current page to 1.
- Page controls are hidden when only one page exists.
- Focused tests for changed policy code pass.
