# Mobile Song Page Official Music API Application Plan

**For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Android and iOS song pages render the official Stellive music catalog served by the backend `/v1/music` APIs.

**Architecture:** Keep both mobile apps server-mediated. Mobile must not call YouTube directly and must not contain `YOUTUBE_API_KEY`. Replace the visible song page data path from legacy `/v1/songs` DTOs to official music DTOs that support collaboration rows through `members[]`.

**Tech Stack:** Kotlin Android Views + Retrofit/Moshi/JUnit, SwiftUI + URLSession/XCTest, existing Fastify REST backend.

---

## Current Findings

- Android song UI currently calls `GET /v1/songs` and `GET /v1/songs/facets` through:
  - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`
  - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiClient.kt`
  - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- iOS song UI currently calls `GET /v1/songs` and `GET /v1/songs/facets` through:
  - `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
  - `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- Existing mobile song models assume a single member:
  - `memberId`
  - `memberName`
  - `generationId`
  - `generationName`
- The official music backend response is N:M and includes:

```json
{
  "id": "youtube-video-id-or-row-id",
  "youtubeVideoId": "abc123",
  "title": "Song title",
  "type": "cover",
  "publishedAt": "2026-06-23T00:00:00.000Z",
  "thumbnailUrl": "https://...",
  "duration": "PT3M25S",
  "durationSeconds": 205,
  "isInstrumental": false,
  "specialFlags": ["OST"],
  "classificationStatus": "MANUAL_CONFIRMED",
  "members": [
    { "id": "yuzuha-riko", "nameKo": "유즈하 리코", "nameEn": "Yuzuha Riko", "role": "MAIN" },
    { "id": "neneko-mashiro", "nameKo": "네네코 마시로", "nameEn": "Neneko Mashiro", "role": "COLLAB" }
  ],
  "youtubeUrl": "https://www.youtube.com/watch?v=abc123",
  "sourcePlaylistId": "PLLjd981H8qSN..."
}
```

- Backend production route registration currently keeps the general catalog `GET /v1/members`; music route registration sets `registerMembersListRoute: false`. Therefore mobile should not depend on a music-specific `/v1/members` response in the first pass.
- Use bootstrap/catalog active member data for filter labels. Use `/v1/members/:id/music` only for member-specific music rows.
- Existing Android/iOS title bars, card styling, background colors, and navigation shell must remain unchanged.

## API Contract For Mobile

Use:

- `GET /v1/music?type=cover|original|all&limit=30&cursor=&sort=publishedAt_desc`
- `GET /v1/members/:id/music?type=cover|original|all&limit=30&cursor=&sort=publishedAt_desc`
- `GET /v1/music/:id` only when a detail screen needs one item.

Do not use in visible official song catalog after migration:

- `GET /v1/songs`
- `GET /v1/songs/facets`
- direct YouTube Data API endpoints

Do not expose these query controls in the first mobile pass:

- `includeGraduated`
- `includeInstrumental`
- `includeExcluded`

Backend defaults already hide excluded, instrumental, and graduated rows unless explicitly included.

## File Responsibility Map

### Android

- `core/network/HubApiModels.kt`: official music DTOs matching `/v1/music`.
- `core/network/HubApi.kt`: Retrofit routes for `/v1/music` and `/v1/members/{id}/music`.
- `core/network/HubApiClient.kt`: typed client functions for music list calls.
- `core/model/Models.kt`: app-level song model with `members[]`, `youtubeUrl`, `durationSeconds`, and flags.
- `feature/home/HubRepository.kt`: repository interface remains UI-facing; method parameters may remain compatible.
- `feature/home/ServerHubRepository.kt`: maps official music DTOs to UI models and calls the correct endpoint based on `memberId`.
- `feature/home/MockHubRepository.kt`: fallback fixtures updated to collaboration-capable song rows.
- `MainActivity.kt`: binds member display text from `members[]`; keeps existing Android UI chrome.
- Tests:
  - `HubApiClientTest.kt`
  - `ServerHubRepositoryTest.kt`
  - `SongUiPolicyTest.kt`

### iOS

- `Models/HubModels.swift`: official music Codable models and UI-facing song model updates.
- `Services/HubAPIClient.swift`: `/v1/music` and `/v1/members/:id/music` request builders.
- `Services/ServerHubStore.swift`: refreshes song rows from official music API and derives visible filters/counts.
- `Services/MockHubStore.swift`: fallback fixtures updated to collaboration-capable song rows.
- `Views/SongsView.swift`: renders member display text from `members[]`; keeps existing iOS navigation/title/card styling.
- Tests:
  - `HubAPIClientTests.swift`
  - `SongUiPolicyTests.swift`

## Token And Change-Minimization Rules

- Keep the existing `SongCatalogItem` UI model name where practical to avoid broad UI rewrites.
- Add only the fields needed by the current UI:
  - `members`
  - `youtubeUrl`
  - `thumbnailUrl`
  - `duration`
  - `durationSeconds`
  - `isInstrumental`
  - `specialFlags`
  - `classificationStatus`
  - `sourcePlaylistId`
- Do not create new screens, new design systems, or unrelated refactors.
- Do not run broad mobile test suites unless a focused failure points to shared setup damage.
- Prefer small model/helper functions that can be tested without emulator/simulator UI automation.

## Token Budget Enforcement During Implementation

- Read only the files listed in the current task before editing. Do not re-scan the whole Android/iOS tree unless a compile error points outside the listed files.
- Prefer `rtk rg`, `rtk read`, and focused `rtk proxy sed -n` ranges over full-file dumps.
- Keep changes in-place in existing model/client/store/UI files. Do not introduce new abstraction layers unless an existing file already has a matching pattern.
- Preserve existing public method names where possible and only add overloads/helpers needed to route song data through `/v1/music`.
- Do not rewrite unrelated song screen layout, navigation, typography, color, thumbnail, calendar, notification, or settings code.
- Do not update docs other than this implementation plan unless implementation reveals a concrete mismatch that affects setup or API usage.
- Do not paste full API fixtures repeatedly in multiple tests. Use one compact collaboration fixture per platform client/repository test, then derive assertions from it.
- Keep final implementation notes limited to changed files, focused test commands, and any blocker. Do not include broad repository summaries.

## Minimum Test Policy

- Run only tests for files changed by this plan.
- Android minimum set:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubApiClientTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

- iOS minimum set:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubAPIClientTests -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

- Do not run full Gradle, full XCTest, backend, Docker, or server sync tests for this mobile-only migration.
- Run a broader build/test only if one of these conditions is true:
  - a focused test fails because shared test infrastructure was changed;
  - a changed mobile model breaks compilation outside the focused test targets;
  - a user explicitly requests full verification.
- Optional server smoke checks are read-only and limited to `/v1/music?type=cover&limit=1` and `/v1/music?type=original&limit=1`; skip them if the internal backend is not already running.

## Task 1: Android network DTO and route migration

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiClient.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubApiClientTest.kt`

- [ ] **Step 1: Add failing Android client path test**

Add or update a test that proves the song screen client calls `/v1/music`, not `/v1/songs`.

```kotlin
@Test
fun musicListUsesOfficialMusicEndpoint() = runTest {
    server.enqueue(
        MockResponse()
            .setResponseCode(200)
            .setBody("""{"items":[],"nextCursor":null}""")
            .setHeader("content-type", "application/json")
    )

    client.music(type = "cover", limit = 30, sort = "publishedAt_desc")

    val request = server.takeRequest()
    assertEquals("/v1/music?type=cover&limit=30&sort=publishedAt_desc", request.path)
}
```

- [ ] **Step 2: Run focused Android client test and verify RED**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubApiClientTest
```

Expected before implementation: failure because `music(...)` or `/v1/music` route is missing.

- [ ] **Step 3: Add official music DTOs**

Use DTOs equivalent to:

```kotlin
data class MusicMemberSummaryDto(
    val id: String,
    val nameKo: String,
    val nameEn: String? = null,
    val role: String? = null,
)

data class MusicCatalogItemDto(
    val id: String,
    val youtubeVideoId: String,
    val title: String,
    val type: String,
    val publishedAt: String? = null,
    val thumbnailUrl: String? = null,
    val duration: String? = null,
    val durationSeconds: Int? = null,
    val isInstrumental: Boolean = false,
    val specialFlags: List<String> = emptyList(),
    val classificationStatus: String? = null,
    val members: List<MusicMemberSummaryDto> = emptyList(),
    val youtubeUrl: String,
    val sourcePlaylistId: String? = null,
)

data class MusicListResponseDto(
    val items: List<MusicCatalogItemDto> = emptyList(),
    val nextCursor: String? = null,
)
```

- [ ] **Step 4: Add Retrofit routes and client wrappers**

`HubApi.kt` route shape:

```kotlin
@GET("v1/music")
suspend fun music(
    @Query("type") type: String? = null,
    @Query("cursor") cursor: String? = null,
    @Query("limit") limit: Int? = null,
    @Query("sort") sort: String? = null,
): MusicListResponseDto

@GET("v1/members/{id}/music")
suspend fun memberMusic(
    @Path("id") memberId: String,
    @Query("type") type: String? = null,
    @Query("cursor") cursor: String? = null,
    @Query("limit") limit: Int? = null,
    @Query("sort") sort: String? = null,
): MusicListResponseDto
```

`HubApiClient.kt` wrapper shape:

```kotlin
suspend fun music(
    type: String? = null,
    cursor: String? = null,
    limit: Int? = null,
    sort: String? = "publishedAt_desc",
): HubNetworkResult<MusicListResponseDto> = runCatchingNetwork {
    api.music(type = type, cursor = cursor, limit = limit, sort = sort)
}

suspend fun memberMusic(
    memberId: String,
    type: String? = null,
    cursor: String? = null,
    limit: Int? = null,
    sort: String? = "publishedAt_desc",
): HubNetworkResult<MusicListResponseDto> = runCatchingNetwork {
    api.memberMusic(memberId = memberId, type = type, cursor = cursor, limit = limit, sort = sort)
}
```

- [ ] **Step 5: Run focused Android client test and verify GREEN**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubApiClientTest
```

Expected: `HubApiClientTest` passes.

## Task 2: Android domain and repository mapping

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/HubRepository.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt`

- [ ] **Step 1: Add failing Android repository mapping test**

```kotlin
@Test
fun songsMapCollaborationMembersFromOfficialMusicApi() = runTest {
    server.enqueue(
        MockResponse()
            .setResponseCode(200)
            .setHeader("content-type", "application/json")
            .setBody(
                """
                {
                  "items": [{
                    "id": "video-1",
                    "youtubeVideoId": "video-1",
                    "title": "Collab Cover",
                    "type": "cover",
                    "publishedAt": "2026-06-23T00:00:00.000Z",
                    "thumbnailUrl": "https://img.youtube.com/vi/video-1/hqdefault.jpg",
                    "duration": "PT3M",
                    "durationSeconds": 180,
                    "isInstrumental": false,
                    "specialFlags": [],
                    "classificationStatus": "AUTO_CLASSIFIED",
                    "members": [
                      { "id": "yuzuha-riko", "nameKo": "유즈하 리코", "nameEn": "Yuzuha Riko", "role": "MAIN" },
                      { "id": "neneko-mashiro", "nameKo": "네네코 마시로", "nameEn": "Neneko Mashiro", "role": "COLLAB" }
                    ],
                    "youtubeUrl": "https://www.youtube.com/watch?v=video-1",
                    "sourcePlaylistId": "playlist-cover"
                  }],
                  "nextCursor": null
                }
                """.trimIndent()
            )
    )

    val response = repository.songs(type = "cover")

    assertEquals(listOf("유즈하 리코", "네네코 마시로"), response.items.single().members.map { it.nameKo })
    assertEquals("https://www.youtube.com/watch?v=video-1", response.items.single().youtubeUrl)
}
```

- [ ] **Step 2: Run focused Android repository test and verify RED**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest
```

Expected before implementation: failure because repository still maps legacy single-member song DTO.

- [ ] **Step 3: Update app model while keeping UI-facing name stable**

Use this model shape in `Models.kt` or equivalent existing location:

```kotlin
data class SongMemberSummary(
    val id: String,
    val nameKo: String,
    val nameEn: String? = null,
    val role: String? = null,
)

data class SongCatalogItem(
    val id: String,
    val youtubeVideoId: String,
    val title: String,
    val type: SongType,
    val publishedAt: String? = null,
    val thumbnailUrl: String? = null,
    val duration: String? = null,
    val durationSeconds: Int? = null,
    val isInstrumental: Boolean = false,
    val specialFlags: List<String> = emptyList(),
    val classificationStatus: String? = null,
    val members: List<SongMemberSummary> = emptyList(),
    val youtubeUrl: String,
    val sourcePlaylistId: String? = null,
)
```

If existing UI code still reads `memberName`, replace those reads with a helper in Task 3 instead of keeping duplicated stale fields.

- [ ] **Step 4: Map `/v1/music` and member-specific music**

Repository behavior:

```kotlin
val result =
    if (!memberId.isNullOrBlank() && memberId != "all") {
        apiClient.memberMusic(memberId = memberId, type = normalizedType, limit = 30, sort = "publishedAt_desc")
    } else {
        apiClient.music(type = normalizedType, limit = 30, sort = "publishedAt_desc")
    }
```

Mapping behavior:

```kotlin
private fun MusicCatalogItemDto.toModel(): SongCatalogItem =
    SongCatalogItem(
        id = id,
        youtubeVideoId = youtubeVideoId,
        title = title,
        type = SongType.fromApiValue(type) ?: SongType.COVER,
        publishedAt = publishedAt,
        thumbnailUrl = thumbnailUrl,
        duration = duration,
        durationSeconds = durationSeconds,
        isInstrumental = isInstrumental,
        specialFlags = specialFlags,
        classificationStatus = classificationStatus,
        members = members.map {
            SongMemberSummary(id = it.id, nameKo = it.nameKo, nameEn = it.nameEn, role = it.role)
        },
        youtubeUrl = youtubeUrl,
        sourcePlaylistId = sourcePlaylistId,
    )
```

- [ ] **Step 5: Update mock fallback songs**

Mock rows must include active/current members only and at least one collaboration:

```kotlin
SongCatalogItem(
    id = "mock-cover-riko-mashiro",
    youtubeVideoId = "mock-cover-riko-mashiro",
    title = "Mock Collaboration Cover",
    type = SongType.COVER,
    members = listOf(
        SongMemberSummary(id = "yuzuha-riko", nameKo = "유즈하 리코", nameEn = "Yuzuha Riko", role = "MAIN"),
        SongMemberSummary(id = "neneko-mashiro", nameKo = "네네코 마시로", nameEn = "Neneko Mashiro", role = "COLLAB"),
    ),
    youtubeUrl = "https://www.youtube.com/watch?v=mock-cover-riko-mashiro",
)
```

- [ ] **Step 6: Run focused Android repository test and verify GREEN**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest
```

Expected: `ServerHubRepositoryTest` passes.

## Task 3: Android song UI binding

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`

- [ ] **Step 1: Add failing Android UI policy test for member display**

```kotlin
@Test
fun songMemberDisplayJoinsCollaborationMembers() {
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

    assertEquals("유즈하 리코 · 네네코 마시로", SongUiPolicy.memberDisplayText(song))
}
```

Also add zero-member fallback:

```kotlin
assertEquals("스텔라이브", SongUiPolicy.memberDisplayText(song.copy(members = emptyList())))
```

- [ ] **Step 2: Run focused Android UI policy test and verify RED**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

Expected before implementation: failure because UI still depends on `memberName` or helper is missing.

- [ ] **Step 3: Add display helper**

Add to existing song UI policy location:

```kotlin
object SongUiPolicy {
    fun memberDisplayText(song: SongCatalogItem): String =
        song.members
            .map { it.nameKo.ifBlank { it.nameEn.orEmpty() } }
            .filter { it.isNotBlank() }
            .distinct()
            .takeIf { it.isNotEmpty() }
            ?.joinToString(" · ")
            ?: "스텔라이브"
}
```

If `SongUiPolicy` already exists, add only the helper function and keep existing filter helpers.

- [ ] **Step 4: Bind Android row subtitle/link to official music model**

In `MainActivity.kt`:

- Replace `song.memberName` with `SongUiPolicy.memberDisplayText(song)`.
- Replace legacy `song.sourceUrl` with `song.youtubeUrl`.
- Keep current title bar, existing card helper, current background colors, and bottom navigation.
- Keep search local for title/member text:

```kotlin
private fun SongCatalogItem.matchesSongQuery(query: String): Boolean {
    if (query.isBlank()) return true
    return title.contains(query, ignoreCase = true) ||
        SongUiPolicy.memberDisplayText(this).contains(query, ignoreCase = true)
}
```

- [ ] **Step 5: Run focused Android UI policy test and verify GREEN**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

Expected: `SongUiPolicyTest` passes.

## Task 4: iOS network DTO and route migration

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`

- [ ] **Step 1: Add failing iOS client path test**

```swift
func testMusicListUsesOfficialMusicEndpoint() async throws {
    urlProtocol.stub = StubResponse(
        statusCode: 200,
        body: #"{"items":[],"nextCursor":null}"#.data(using: .utf8)!
    )

    _ = try await client.music(type: "cover", limit: 30, sort: "publishedAt_desc")

    XCTAssertEqual(urlProtocol.requests.last?.url?.path, "/v1/music")
    XCTAssertEqual(urlProtocol.requests.last?.url?.query?.contains("type=cover"), true)
    XCTAssertEqual(urlProtocol.requests.last?.url?.query?.contains("limit=30"), true)
    XCTAssertEqual(urlProtocol.requests.last?.url?.query?.contains("sort=publishedAt_desc"), true)
}
```

- [ ] **Step 2: Run focused iOS client test and verify RED**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubAPIClientTests
```

Expected before implementation: failure because `music(...)` or official DTOs are missing.

- [ ] **Step 3: Add official music Codable models**

Add model shape equivalent to:

```swift
struct MusicMemberSummary: Codable, Equatable, Hashable, Identifiable {
    let id: String
    let nameKo: String
    let nameEn: String?
    let role: String?
}

struct SongCatalogItem: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let youtubeVideoId: String
    let title: String
    let type: SongType
    let publishedAt: Date?
    let thumbnailUrl: String?
    let duration: String?
    let durationSeconds: Int?
    let isInstrumental: Bool
    let specialFlags: [String]
    let classificationStatus: String?
    let members: [MusicMemberSummary]
    let youtubeUrl: String
    let sourcePlaylistId: String?
}

struct MusicListResponse: Codable, Equatable {
    let items: [SongCatalogItem]
    let nextCursor: String?
}
```

Keep `SongCatalogItem` only if it limits changes. If decoding `Date` already uses ISO8601 globally, reuse the existing decoder behavior.

- [ ] **Step 4: Add iOS client methods**

```swift
func music(
    type: String? = nil,
    cursor: String? = nil,
    limit: Int? = nil,
    sort: String? = "publishedAt_desc"
) async throws -> MusicListResponse {
    try await get(
        path: "/v1/music",
        queryItems: [
            URLQueryItem(name: "type", value: type),
            URLQueryItem(name: "cursor", value: cursor),
            URLQueryItem(name: "limit", value: limit.map(String.init)),
            URLQueryItem(name: "sort", value: sort)
        ]
    )
}

func memberMusic(
    memberId: String,
    type: String? = nil,
    cursor: String? = nil,
    limit: Int? = nil,
    sort: String? = "publishedAt_desc"
) async throws -> MusicListResponse {
    try await get(
        path: "/v1/members/\(memberId)/music",
        queryItems: [
            URLQueryItem(name: "type", value: type),
            URLQueryItem(name: "cursor", value: cursor),
            URLQueryItem(name: "limit", value: limit.map(String.init)),
            URLQueryItem(name: "sort", value: sort)
        ]
    )
}
```

- [ ] **Step 5: Run focused iOS client test and verify GREEN**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubAPIClientTests
```

Expected: `HubAPIClientTests` passes.

## Task 5: iOS store and SwiftUI binding

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`

- [ ] **Step 1: Add failing iOS member display policy test**

```swift
func testSongMemberDisplayJoinsCollaborationMembers() {
    let song = SongCatalogItem(
        id: "video-1",
        youtubeVideoId: "video-1",
        title: "Collab",
        type: .cover,
        publishedAt: nil,
        thumbnailUrl: nil,
        duration: nil,
        durationSeconds: nil,
        isInstrumental: false,
        specialFlags: [],
        classificationStatus: nil,
        members: [
            MusicMemberSummary(id: "yuzuha-riko", nameKo: "유즈하 리코", nameEn: "Yuzuha Riko", role: "MAIN"),
            MusicMemberSummary(id: "neneko-mashiro", nameKo: "네네코 마시로", nameEn: "Neneko Mashiro", role: "COLLAB")
        ],
        youtubeUrl: "https://www.youtube.com/watch?v=video-1",
        sourcePlaylistId: nil
    )

    XCTAssertEqual(SongUiPolicy.memberDisplayText(song), "유즈하 리코 · 네네코 마시로")
}
```

Also assert empty member fallback:

```swift
XCTAssertEqual(SongUiPolicy.memberDisplayText(song.withMembers([])), "스텔라이브")
```

If no copy helper exists, construct a second `SongCatalogItem` with `members: []`.

- [ ] **Step 2: Run focused iOS UI policy test and verify RED**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected before implementation: failure because UI policy still expects `memberName` or helper is missing.

- [ ] **Step 3: Update `ServerHubStore.refreshSongs`**

Use official music endpoint selection:

```swift
func refreshSongs(
    generationId: String? = nil,
    memberId: String? = nil,
    type: String? = nil,
    query: String? = nil,
    cursor: String? = nil
) async {
    do {
        let normalizedType = type == "all" ? nil : type
        let response: MusicListResponse
        if let memberId, !memberId.isEmpty, memberId != "all" {
            response = try await api.memberMusic(memberId: memberId, type: normalizedType, cursor: cursor, limit: 30)
        } else {
            response = try await api.music(type: normalizedType, cursor: cursor, limit: 30)
        }
        serverSongs = response.items
    } catch {
        if serverSongs.isEmpty {
            serverSongs = fallback.songs(generationId: generationId, memberId: memberId, type: type, query: query).items
        }
    }
}
```

Do not call `api.songFacets(...)` for the official song page after this migration.

- [ ] **Step 4: Add display helper and bind SwiftUI rows**

Helper shape:

```swift
enum SongUiPolicy {
    static func memberDisplayText(_ song: SongCatalogItem) -> String {
        let names = song.members
            .map { $0.nameKo.isEmpty ? ($0.nameEn ?? "") : $0.nameKo }
            .filter { !$0.isEmpty }
        let uniqueNames = Array(NSOrderedSet(array: names)) as? [String] ?? names
        return uniqueNames.isEmpty ? "스텔라이브" : uniqueNames.joined(separator: " · ")
    }
}
```

In `SongsView.swift`:

- Replace `song.memberName` with `SongUiPolicy.memberDisplayText(song)`.
- Replace legacy `song.sourceUrl` with `song.youtubeUrl`.
- Keep existing iPhone navigation/title behavior, grouped background, card colors, and list layout.
- Keep search local over title/member display text.

- [ ] **Step 5: Update iOS mock fallback**

Mock song rows must include active/current members only and at least one collaboration row:

```swift
SongCatalogItem(
    id: "mock-cover-riko-mashiro",
    youtubeVideoId: "mock-cover-riko-mashiro",
    title: "Mock Collaboration Cover",
    type: .cover,
    publishedAt: nil,
    thumbnailUrl: nil,
    duration: nil,
    durationSeconds: nil,
    isInstrumental: false,
    specialFlags: [],
    classificationStatus: nil,
    members: [
        MusicMemberSummary(id: "yuzuha-riko", nameKo: "유즈하 리코", nameEn: "Yuzuha Riko", role: "MAIN"),
        MusicMemberSummary(id: "neneko-mashiro", nameKo: "네네코 마시로", nameEn: "Neneko Mashiro", role: "COLLAB")
    ],
    youtubeUrl: "https://www.youtube.com/watch?v=mock-cover-riko-mashiro",
    sourcePlaylistId: nil
)
```

- [ ] **Step 6: Run focused iOS UI policy test and verify GREEN**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected: `SongUiPolicyTests` passes.

## Task 6: Focused integrated verification

**Files:**

- No source changes unless the focused tests identify a mobile-only defect.

- [ ] **Step 1: Run Android changed-code tests only**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubApiClientTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

Expected: all selected Android tests pass.

- [ ] **Step 2: Run iOS changed-code tests only**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubAPIClientTests -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected: all selected iOS tests pass.

- [ ] **Step 3: Optional server smoke check**

Only if the backend container is running on the internal server:

```bash
rtk curl -s "http://192.168.50.9:4000/v1/music?type=cover&limit=1"
rtk curl -s "http://192.168.50.9:4000/v1/music?type=original&limit=1"
```

Expected: each response includes an `items` array and does not include excluded or graduated rows by default.

## Out Of Scope

- No mobile YouTube Data API calls.
- No `YOUTUBE_API_KEY` in Android/iOS source, resources, plist, build config, tests, or logs.
- No Former member filters, seeds, fixtures, or visible catalog rows.
- No new Android/iOS visual design system.
- No profile image binaries, official logos, thumbnails committed to repo, fan art, screenshots, or copied media assets.
- No backend scraper or official MUSIC webpage integration.
- No broad Android/iOS test suites unless focused tests fail in shared infrastructure.

## Acceptance Criteria

- Android visible song tab uses official `/v1/music` or `/v1/members/:id/music`.
- iOS visible song tab uses official `/v1/music` or `/v1/members/:id/music`.
- Neither app uses `/v1/songs` or `/v1/songs/facets` for the official song catalog UI.
- Collaboration songs display multiple member names.
- Cover/original filters work from server music data.
- Member-specific filtering calls the member music endpoint or filters already-loaded official rows without reverting to legacy `/v1/songs`.
- Default mobile UI does not expose graduated, excluded, or instrumental toggles.
- Existing title bars, card colors, background colors, and navigation chrome remain unchanged.
- Focused Android and iOS tests listed in Task 6 pass.
