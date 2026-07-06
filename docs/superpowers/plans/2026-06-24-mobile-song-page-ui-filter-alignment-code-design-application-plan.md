# Mobile Song Page UI And Filter Alignment Implementation Plan

**For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Android song page를 iPhone song page 구성과 맞추고, Android 중복 `전체` 필터와 Android/iOS generation filtering 미동작 문제를 수정한다.

**Architecture:** Keep backend API unchanged. Apply generation filtering on mobile using bootstrap/catalog `memberId -> generationId` mapping and official music `members[]`. Keep existing platform title bars, card colors, background colors, and bottom navigation.

**Tech Stack:** Kotlin Android Views + JUnit, SwiftUI + XCTest.

---

## Scope

Implement only mobile song page behavior/UI alignment.

- No backend route/schema changes.
- No Docker/server sync work.
- No new media assets.
- No YouTube API calls from mobile.
- No `YOUTUBE_API_KEY` in Android/iOS code, plist, resources, tests, or logs.

## Token Budget Rules

- Read only these files unless a compiler error identifies another file:
  - Android:
    - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
    - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
    - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
    - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
    - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
    - `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`
    - `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt`
  - iOS:
    - `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
    - `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
    - `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
    - `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
    - `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`
    - `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`
- Use `rtk rg` and short `rtk proxy sed -n` ranges instead of full file dumps.
- Do not refactor unrelated navigation, settings, calendar, live, history, notification, backend, or shared schema code.
- Do not rerun full Android/iOS/backend test suites.
- Keep implementation in existing policy helpers rather than adding new architecture layers.

## Minimum Test Policy

Run only tests for changed mobile code.

Android:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest
```

iOS:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests -only-testing:StelliveHubiOSTests/HubAPIClientTests
```

Run broader tests only if:

- a focused test fails because a shared mobile model no longer compiles;
- a changed helper is referenced outside the focused test targets and breaks compilation;
- the user explicitly requests full verification.

## Task 1: Android policy tests for visible filters

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`

- [ ] **Step 1: Add failing tests**

Add tests for:

```kotlin
@Test
fun songFiltersUseSeparateGenerationAndTypeRows() {
    assertEquals(listOf("all", "gen1", "gen2", "gen3"), MainUiPolicy.songGenerationFilters().map { it.id })
    assertEquals(listOf("all", "original", "cover"), MainUiPolicy.songTypeFilters().map { it.id })
    assertEquals(1, MainUiPolicy.songGenerationFilters().count { it.id == "all" })
    assertEquals(1, MainUiPolicy.songTypeFilters().count { it.id == "all" })
}
```

Add generation filtering test:

```kotlin
@Test
fun songMatchesSelectedGenerationByMemberIds() {
    val song = SongCatalogItem(
        id = "video-1",
        youtubeVideoId = "video-1",
        title = "Collab",
        type = SongType.COVER,
        members = listOf(
            SongMemberSummary(id = "yuzuha-riko", nameKo = "유즈하 리코"),
            SongMemberSummary(id = "neneko-mashiro", nameKo = "네네코 마시로"),
        ),
        youtubeUrl = "https://www.youtube.com/watch?v=video-1",
    )
    val memberGenerations = mapOf(
        "yuzuha-riko" to "gen3",
        "neneko-mashiro" to "gen2",
    )

    assertTrue(MainUiPolicy.songMatchesGeneration(song, "all", memberGenerations))
    assertTrue(MainUiPolicy.songMatchesGeneration(song, "gen2", memberGenerations))
    assertTrue(MainUiPolicy.songMatchesGeneration(song, "gen3", memberGenerations))
    assertFalse(MainUiPolicy.songMatchesGeneration(song, "gen1", memberGenerations))
}
```

- [ ] **Step 2: Run RED**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

Expected: fail because `songMatchesGeneration` or row policy helper is missing.

- [ ] **Step 3: Implement Android policy helpers**

Add to `MainUiPolicy`:

```kotlin
fun songMatchesGeneration(
    song: SongCatalogItem,
    selectedGenerationId: String,
    memberGenerationById: Map<String, String>,
): Boolean {
    if (selectedGenerationId == "all") return true
    return song.members.any { memberGenerationById[it.id] == selectedGenerationId }
}

fun songMatchesQuery(song: SongCatalogItem, query: String): Boolean {
    if (query.isBlank()) return true
    return song.title.contains(query, ignoreCase = true) ||
        songMemberDisplayText(song).contains(query, ignoreCase = true)
}
```

- [ ] **Step 4: Run GREEN**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

Expected: pass.

## Task 2: Android UI alignment with iPhone page

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`

- [ ] **Step 1: Keep UI order identical to iPhone**

Update `renderSongs()` composition order:

```text
Header card
Search section
Filter section
Song list section
```

The Android header card must show:

```text
노래
YouTube 기반 오리지널/커버 곡 목록
전체 / 오리지널 / 커버 count metrics
```

- [ ] **Step 2: Replace Android single chip row with grouped filter card**

`songFilterChips()` should render one card with two segmented rows:

```text
전체 | 1기생 | 2기생 | 3기생
전체 | 오리지널 | 커버
```

Do not render both rows as one continuous chip list. This resolves the Android duplicate `전체` visual issue.

- [ ] **Step 3: Hide URL text inside song cards**

Update `songCard(song)`:

- keep title;
- show `MainUiPolicy.songMemberDisplayText(song) · song.type.displayName`;
- show `publishedAt` date if available;
- use `song.youtubeUrl` only for click action or future link handling;
- do not render `song.youtubeUrl` as visible body text.

- [ ] **Step 4: Apply generation filtering before rendering**

Build `memberGenerationById` from current catalog members:

```kotlin
val memberGenerationById = repository.members.associate { it.id to it.generationId }
```

Filter loaded songs:

```kotlin
val visibleSongs = songs.items.filter {
    MainUiPolicy.songMatchesGeneration(it, selectedSongGenerationId, memberGenerationById) &&
    MainUiPolicy.songMatchesQuery(it, currentSongQuery)
}
```

If Android currently has no song search state, add the minimal state needed for the visible search field and do not change unrelated screens.

- [ ] **Step 5: Run Android focused tests**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest
```

Expected: pass.

## Task 3: iOS policy tests and metric text fix

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`

- [ ] **Step 1: Add failing generation filter test**

```swift
func testSongMatchesSelectedGenerationByMemberIds() {
    let song = SongCatalogItem(
        id: "video-1",
        youtubeVideoId: "video-1",
        title: "Collab",
        type: .cover,
        members: [
            MusicMemberSummary(id: "yuzuha-riko", nameKo: "유즈하 리코", nameEn: "Yuzuha Riko", role: "MAIN"),
            MusicMemberSummary(id: "neneko-mashiro", nameKo: "네네코 마시로", nameEn: "Neneko Mashiro", role: "COLLAB")
        ],
        youtubeUrl: "https://www.youtube.com/watch?v=video-1"
    )
    let memberGenerations = [
        "yuzuha-riko": "gen3",
        "neneko-mashiro": "gen2"
    ]

    XCTAssertTrue(IOSSongPagePolicy.matchesGeneration(song, selectedGenerationId: "all", memberGenerationById: memberGenerations))
    XCTAssertTrue(IOSSongPagePolicy.matchesGeneration(song, selectedGenerationId: "gen2", memberGenerationById: memberGenerations))
    XCTAssertTrue(IOSSongPagePolicy.matchesGeneration(song, selectedGenerationId: "gen3", memberGenerationById: memberGenerations))
    XCTAssertFalse(IOSSongPagePolicy.matchesGeneration(song, selectedGenerationId: "gen1", memberGenerationById: memberGenerations))
}
```

- [ ] **Step 2: Run RED**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected: fail because `matchesGeneration` is missing.

- [ ] **Step 3: Implement iOS policy helpers**

Add to `IOSSongPagePolicy`:

```swift
static func matchesGeneration(
    _ song: SongCatalogItem,
    selectedGenerationId: String,
    memberGenerationById: [String: String]
) -> Bool {
    if selectedGenerationId == "all" { return true }
    return song.members.contains { memberGenerationById[$0.id] == selectedGenerationId }
}

static func matchesQuery(_ song: SongCatalogItem, query: String) -> Bool {
    if query.isEmpty { return true }
    return song.title.localizedCaseInsensitiveContains(query) ||
        memberDisplayText(song).localizedCaseInsensitiveContains(query)
}
```

- [ ] **Step 4: Fix header metric string interpolation**

In `SongsView`, metric values must use Swift interpolation:

```swift
.init(value: "\(facets.summary.total)", label: "전체")
.init(value: "\(facets.summary.original)", label: "오리지널")
.init(value: "\(facets.summary.cover)", label: "커버")
```

This fixes `(facets.sum...)` literal text.

- [ ] **Step 5: Apply generation filtering in `SongsView`**

Build member generation map from existing catalog members:

```swift
private var memberGenerationById: [String: String] {
    Dictionary(uniqueKeysWithValues: store.members.map { ($0.id, $0.generationId) })
}
```

Apply visible filtering:

```swift
private var songs: [SongCatalogItem] {
    serverStore.songs(type: selectedType).items.filter {
        IOSSongPagePolicy.matchesGeneration($0, selectedGenerationId: selectedGenerationId, memberGenerationById: memberGenerationById) &&
        IOSSongPagePolicy.matchesQuery($0, query: query)
    }
}
```

Do not pass `generationId` to `serverStore.songs` because official music rows do not have top-level generation fields.

- [ ] **Step 6: Run iOS focused tests**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests -only-testing:StelliveHubiOSTests/HubAPIClientTests
```

Expected: pass.

## Task 4: Final focused verification

**Files:** no source changes unless focused verification identifies a defect.

- [ ] **Step 1: Android focused verification**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest
```

- [ ] **Step 2: iOS focused verification**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests -only-testing:StelliveHubiOSTests/HubAPIClientTests
```

- [ ] **Step 3: Policy grep**

```bash
rtk rg -n "YOUTUBE_API_KEY|youtube.googleapis.com|/youtube/v3|Former|profileImageUrl|logoUrl|fan art" android/StelliveHubAndroid/app/src/main ios/StelliveHubiOS/StelliveHubiOS
```

Expected:

- no mobile YouTube API key or direct YouTube Data API usage;
- no new Former member/UI filter exposure;
- no committed protected media asset references.

## Acceptance Criteria

- Android visual song page structure matches iPhone song page structure.
- Android no longer shows duplicate `전체` in one mixed filter row.
- iPhone header metric values render numbers, not `(facets.sum...)` text.
- Android/iOS generation filtering works by official music `members[]` plus catalog member generation map.
- Android/iOS type filtering still works for `전체`, `오리지널`, `커버`.
- Only focused changed-code tests are run.
