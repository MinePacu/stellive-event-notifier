# Mobile Song Page Full Fetch and iOS Thumbnail Fix Implementation Plan

**For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for code changes and `superpowers:executing-plans` to implement task-by-task.

**Goal:** Fix song catalog pagination so Android/iOS can use the full backend music catalog, and make iOS thumbnails resilient to single-URL image load failures.

**Architecture:** Backend cursor pagination must match the active sort order before mobile cursor walking can reliably reach all cover songs. Mobile repositories/stores fetch all server pages into memory, dedupe, then existing client-side page slicing renders 20 rows per page. iOS thumbnail rendering tries the backend URL first, then deterministic public YouTube thumbnail URLs derived from `youtubeVideoId`, without using YouTube Data API.

**Tech Stack:** TypeScript/Fastify/Prisma/Vitest backend; Android Kotlin/JUnit; iOS SwiftUI/XCTest.

---

## Token-Minimized Work Rules

- Read only these files first:
  - `backend/stellive-hub-api/src/repositories/musicRepository.ts`
  - `backend/stellive-hub-api/test/musicRepository.test.ts`
  - `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
  - `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt`
  - `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
  - `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
  - `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`
  - `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`
- Use `rtk rg` only for `nextCursor`, `limit = 30`, `SongThumbnailView`, `thumbnailUrl` if more context is required.
- Do not refactor song UI layout, filters, or unrelated repository methods.
- Do not add dependencies.
- Keep test output scoped to changed areas.

## Focused Test Rules

Run only tests connected to changed code:

```bash
rtk npm test -- musicRepository
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/HubAPIClientTests -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Run broader tests only if the focused command fails because shared models or compile boundaries changed.

## Task 1: Backend music cursor matches sort order

**Files:**

- Modify: `backend/stellive-hub-api/src/repositories/musicRepository.ts`
- Modify: `backend/stellive-hub-api/test/musicRepository.test.ts`

- [ ] **Step 1: Add failing repository test for `publishedAt_desc` cursor**

Add a test that calls `listMusicItems({ type: "cover", cursor: encodedCursor, limit: 100, sort: "publishedAt_desc" })` and expects `findMany` to receive an `OR` condition equivalent to:

```ts
{
  OR: [
    { publishedAt: { lt: new Date("2026-06-01T00:00:00.000Z") } },
    {
      publishedAt: new Date("2026-06-01T00:00:00.000Z"),
      id: { gt: "music-100" },
    },
  ],
}
```

Cursor fixture can be produced through the new helper once implemented, or by encoding:

```ts
Buffer.from(JSON.stringify({
  v: 1,
  sort: "publishedAt_desc",
  publishedAt: "2026-06-01T00:00:00.000Z",
  id: "music-100",
})).toString("base64url")
```

- [ ] **Step 2: Add failing repository test for `playlistOrder` cursor**

Expect the `where` clause to advance by playlist position first, then `publishedAt desc`, then id:

```ts
{
  OR: [
    { playlistPosition: { gt: 100 } },
    {
      playlistPosition: 100,
      publishedAt: { lt: new Date("2026-06-01T00:00:00.000Z") },
    },
    {
      playlistPosition: 100,
      publishedAt: new Date("2026-06-01T00:00:00.000Z"),
      id: { gt: "music-100" },
    },
  ],
}
```

- [ ] **Step 3: Run RED**

```bash
cd backend/stellive-hub-api
rtk npm test -- musicRepository
```

Expected: cursor tests fail because current implementation uses `where.id = { gt: cursor }`.

- [ ] **Step 4: Implement cursor helpers**

Add private helpers near `listMusicItems`:

```ts
type MusicCursorPayload = {
  v: 1;
  sort: MusicSort;
  id: string;
  publishedAt?: string | null;
  playlistPosition?: number | null;
};

function encodeMusicCursor(record: MusicItemRecord, sort: MusicSort): string {
  return Buffer.from(JSON.stringify({
    v: 1,
    sort,
    id: record.id,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    playlistPosition: record.playlistPosition ?? null,
  } satisfies MusicCursorPayload)).toString("base64url");
}

function decodeMusicCursor(cursor: string | undefined): MusicCursorPayload | { legacyId: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<MusicCursorPayload>;
    if (parsed.v === 1 && typeof parsed.id === "string") return parsed as MusicCursorPayload;
  } catch {
    return { legacyId: cursor };
  }
  return { legacyId: cursor };
}
```

- [ ] **Step 5: Apply sort-specific cursor where**

In `listMusicItems`, replace `where.id = { gt: filters.cursor }` with helper-applied conditions:

```ts
const cursor = decodeMusicCursor(filters.cursor);
if (cursor && "legacyId" in cursor) {
  where.id = { gt: cursor.legacyId };
} else if (cursor?.sort === "playlistOrder") {
  where.OR = [
    { playlistPosition: { gt: cursor.playlistPosition ?? -1 } },
    {
      playlistPosition: cursor.playlistPosition ?? null,
      publishedAt: { lt: cursor.publishedAt ? new Date(cursor.publishedAt) : new Date(0) },
    },
    {
      playlistPosition: cursor.playlistPosition ?? null,
      publishedAt: cursor.publishedAt ? new Date(cursor.publishedAt) : null,
      id: { gt: cursor.id },
    },
  ];
} else if (cursor) {
  where.OR = [
    { publishedAt: { lt: cursor.publishedAt ? new Date(cursor.publishedAt) : new Date(0) } },
    {
      publishedAt: cursor.publishedAt ? new Date(cursor.publishedAt) : null,
      id: { gt: cursor.id },
    },
  ];
}
```

Set `nextCursor` from the last returned page item, not the extra row:

```ts
const page = rows.slice(0, limit);
const last = page.at(-1);
return {
  items: page.map(toMusicCatalogItem),
  nextCursor: rows.length > limit && last ? encodeMusicCursor(last, normalizedSort) : null,
};
```

- [ ] **Step 6: Run GREEN**

```bash
cd backend/stellive-hub-api
rtk npm test -- musicRepository
```

Expected: repository cursor tests pass.

## Task 2: Android fetches all music pages before client pagination

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt`

- [ ] **Step 1: Add failing Android test**

Add a test where fake remote data source returns:

```kotlin
MusicListResponseDto(
    items = listOf(songDto("video-1")),
    nextCursor = "cursor-2",
)
```

then second call returns:

```kotlin
MusicListResponseDto(
    items = listOf(songDto("video-2")),
    nextCursor = null,
)
```

Assert:

```kotlin
assertEquals(listOf("video-1", "video-2"), result.items.map { it.youtubeVideoId })
assertEquals(null, result.nextCursor)
assertEquals(listOf(null, "cursor-2"), fakeMusicCursors)
assertEquals(listOf(100, 100), fakeMusicLimits)
```

- [ ] **Step 2: Run RED**

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest
```

Expected: only one page is fetched with limit 30.

- [ ] **Step 3: Implement all-page fetch helper**

In `ServerHubRepository`, add constants and helper:

```kotlin
private companion object {
    const val MUSIC_PAGE_LIMIT = 100
    const val MUSIC_MAX_PAGES = 10
    const val MUSIC_MAX_ITEMS = 1000
}

private suspend fun fetchAllMusicPages(
    memberId: String?,
    type: String?,
): SongListResult? {
    val items = mutableListOf<SongCatalogItem>()
    val seen = linkedSetOf<String>()
    var nextCursor: String? = null
    repeat(MUSIC_MAX_PAGES) {
        val response = if (!memberId.isNullOrBlank() && memberId != "all") {
            remoteDataSource.memberMusic(memberId, type, nextCursor, MUSIC_PAGE_LIMIT, "publishedAt_desc")
        } else {
            remoteDataSource.music(type, nextCursor, MUSIC_PAGE_LIMIT, "publishedAt_desc")
        }
        if (response !is HubNetworkResult.Success) return if (items.isNotEmpty()) SongListResult(items) else null
        val page = response.value.toSongListResult()
        page.items.forEach { song ->
            val key = song.youtubeVideoId.ifBlank { song.id }
            if (seen.add(key)) items += song
        }
        if (page.nextCursor.isNullOrBlank() || items.size >= MUSIC_MAX_ITEMS) return SongListResult(items.take(MUSIC_MAX_ITEMS))
        nextCursor = page.nextCursor
    }
    return SongListResult(items.take(MUSIC_MAX_ITEMS))
}
```

- [ ] **Step 4: Wire `songs()` to helper**

Replace the single `remoteDataSource.music/memberMusic` call with:

```kotlin
val result = fetchAllMusicPages(memberId = memberId, type = normalizedType)
if (result != null) {
    songCache = result
    return result
}
return songCache ?: fallback.songs(generationId, memberId, type, query, cursor)
```

Keep the method signature unchanged. Ignore incoming `cursor` for UI refresh path because local pagination uses the full fetched catalog.

- [ ] **Step 5: Run GREEN**

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

Expected: Android focused tests pass.

## Task 3: iOS fetches all music pages before client pagination

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`

- [ ] **Step 1: Add test seam if needed**

If `ServerHubStore` is hard to unit test directly, extract only page collection into a small internal helper that accepts a page fetch closure:

```swift
struct MusicPageCollector {
    static let pageLimit = 100
    static let maxPages = 10
    static let maxItems = 1000

    static func collect(fetch: (String?, Int) async throws -> MusicListResponse) async throws -> [SongCatalogItem] {
        var cursor: String?
        var output: [SongCatalogItem] = []
        var seen = Set<String>()
        for _ in 0..<maxPages {
            let page = try await fetch(cursor, pageLimit)
            for item in page.items {
                let key = item.youtubeVideoId.isEmpty ? item.id : item.youtubeVideoId
                if seen.insert(key).inserted {
                    output.append(item)
                }
            }
            guard let next = page.nextCursor, !next.isEmpty, output.count < maxItems else {
                return Array(output.prefix(maxItems))
            }
            cursor = next
        }
        return Array(output.prefix(maxItems))
    }
}
```

- [ ] **Step 2: Add failing iOS collector test**

In `HubAPIClientTests.swift` or a focused store test, assert:

```swift
func testMusicPageCollectorFetchesAllPagesAndDedupes() async throws {
    var cursors: [String?] = []
    let items = try await MusicPageCollector.collect { cursor, limit in
        cursors.append(cursor)
        XCTAssertEqual(limit, 100)
        if cursor == nil {
            return MusicListResponse(items: [song("video-1")], nextCursor: "cursor-2")
        }
        return MusicListResponse(items: [song("video-1"), song("video-2")], nextCursor: nil)
    }
    XCTAssertEqual(cursors, [nil, "cursor-2"])
    XCTAssertEqual(items.map(\.youtubeVideoId), ["video-1", "video-2"])
}
```

- [ ] **Step 3: Run RED**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/HubAPIClientTests
```

Expected: collector is missing.

- [ ] **Step 4: Implement collector and wire `refreshSongs()`**

In `ServerHubStore.refreshSongs`, replace the single API request with:

```swift
let normalizedType = type == "all" ? nil : type
let items = try await MusicPageCollector.collect { pageCursor, pageLimit in
    if let memberId, !memberId.isEmpty, memberId != "all" {
        return try await api.memberMusic(memberId: memberId, type: normalizedType, cursor: pageCursor, limit: pageLimit)
    }
    return try await api.music(type: normalizedType, cursor: pageCursor, limit: pageLimit)
}
serverSongs = items
```

Keep fallback behavior unchanged when collection throws before any items are stored.

- [ ] **Step 5: Run GREEN**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/HubAPIClientTests
```

Expected: collector test passes.

## Task 4: iOS thumbnail fallback URL candidates

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`

- [ ] **Step 1: Add pure helper test**

Add test:

```swift
func testThumbnailUrlCandidatesUseBackendUrlThenYoutubeFallbacks() {
    let song = SongCatalogItem(
        id: "id-1",
        youtubeVideoId: "abc123",
        title: "Song",
        type: .cover,
        thumbnailUrl: "https://example.test/thumb.jpg",
        youtubeUrl: "https://www.youtube.com/watch?v=abc123"
    )
    XCTAssertEqual(
        IOSSongPagePolicy.thumbnailUrlCandidates(for: song),
        [
            URL(string: "https://example.test/thumb.jpg")!,
            URL(string: "https://i.ytimg.com/vi/abc123/hqdefault.jpg")!,
            URL(string: "https://i.ytimg.com/vi/abc123/mqdefault.jpg")!,
            URL(string: "https://i.ytimg.com/vi/abc123/default.jpg")!,
        ]
    )
}
```

- [ ] **Step 2: Run RED**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected: `thumbnailUrlCandidates` missing.

- [ ] **Step 3: Implement URL candidate helper**

Add to `IOSSongPagePolicy`:

```swift
static func thumbnailUrlCandidates(for song: SongCatalogItem) -> [URL] {
    var urls: [URL] = []
    if let raw = song.thumbnailUrl, let url = URL(string: raw), url.scheme == "https" {
        urls.append(url)
    }
    let videoId = song.youtubeVideoId.trimmingCharacters(in: .whitespacesAndNewlines)
    if !videoId.isEmpty {
        ["hqdefault", "mqdefault", "default"].forEach { name in
            if let url = URL(string: "https://i.ytimg.com/vi/\(videoId)/\(name).jpg") {
                urls.append(url)
            }
        }
    }
    return Array(NSOrderedSet(array: urls).compactMap { $0 as? URL })
}
```

- [ ] **Step 4: Replace `SongThumbnailView` single URL input**

Change usage:

```swift
SongThumbnailView(urls: IOSSongPagePolicy.thumbnailUrlCandidates(for: song))
```

Change view:

```swift
private struct SongThumbnailView: View {
    let urls: [URL]
    @State private var index = 0

    var body: some View {
        Group {
            if urls.indices.contains(index) {
                AsyncImage(url: urls[index]) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .failure:
                        fallbackTrigger
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

    private var fallbackTrigger: some View {
        placeholder.task {
            if index + 1 < urls.count {
                index += 1
            }
        }
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

- [ ] **Step 5: Run GREEN**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Expected: helper test passes and `SongsView.swift` compiles.

## Task 5: Final focused verification and policy check

**Files:** no source edits unless verification exposes a defect.

- [ ] **Step 1: Backend focused test**

```bash
cd backend/stellive-hub-api
rtk npm test -- musicRepository
```

- [ ] **Step 2: Android focused tests**

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ServerHubRepositoryTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest
```

- [ ] **Step 3: iOS focused tests**

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/HubAPIClientTests -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

- [ ] **Step 4: Mobile backend-boundary grep**

```bash
rtk rg -n "YOUTUBE_API_KEY|youtube.googleapis.com|/youtube/v3" android/StelliveHubAndroid/app/src/main ios/StelliveHubiOS/StelliveHubiOS
```

Expected: no mobile YouTube Data API usage.

- [ ] **Step 5: Manual API sanity after server deploy**

After backend rebuild/recreate on the internal server:

```bash
rtk curl -s "http://192.168.50.9:4000/v1/music?type=cover&limit=100" > /private/tmp/cover-page-1.json
```

Then follow `nextCursor` until null. Expected default public cover count is at least 242 because two DB cover rows currently have no active member match; internal/all-inclusive checks may show the full 244.

## Acceptance Criteria

- Backend music cursor does not stop at 200 when more rows exist.
- Android `ServerHubRepository.songs()` fetches all available server pages with `limit=100`, dedupes, and returns a local full list for existing UI pagination.
- iOS `ServerHubStore.refreshSongs()` fetches all available server pages with `limit=100`, dedupes, and stores a local full list for existing UI pagination.
- iOS thumbnails try backend URL first and public YouTube thumbnail fallbacks next.
- Focused tests for changed backend, Android, and iOS areas pass.
- No mobile code calls YouTube Data API directly or exposes `YOUTUBE_API_KEY`.
