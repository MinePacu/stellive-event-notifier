# Mobile Song Page Status, Recent Cover, And Discovery Sync Code Design Application Plan

**For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` when implementing this plan task-by-task. Use `superpowers:systematic-debugging` before changing the Android search crash path.

**Goal:** Android 노래 페이지 UI/검색 안정성, Android/iOS 홈 최근 커버곡, 서버 hourly channel discovery sync를 최소 변경으로 반영한다.

**Architecture:** 모바일은 기존 서버/API-first 구조를 유지하고 YouTube API를 직접 호출하지 않는다. Android UI는 `MainUiPolicy`에 표시 정책을 모으고 `MainActivity`에서 기존 view builder를 재사용한다. 서버는 공식 playlist sync를 유지한 채 uploads playlist 기반 보조 discovery sync를 별도 service로 추가한다.

**Tech Stack:** Kotlin Android Views, SwiftUI, TypeScript Fastify, Prisma, Vitest, YouTube Data API v3.

---

## Investigation And Token-Minimized Work Rules

- Serena MCP 도구가 제공되면 먼저 `initial_instructions` 이후 symbol/reference 검색으로 영향 범위를 확인한다.
- 현재 세션처럼 Serena 도구가 없으면 `CODEMAP.md`, `rtk rg`, `rtk fd`, 함수 주변 `rtk sed -n`만 사용한다.
- 전체 파일을 무작정 읽지 않는다. 우선순위는 다음 심볼이다.
  - Android: `renderSongs`, `songSearchCard`, `songMemberFilterCard`, `renderHome`, `renderLive`, `renderServerGoodsEvents`, `MainUiPolicy`.
  - iOS: `HomeView`, `SongsView`, `MockHubStore`, `ServerHubStore`, `IOSSongPagePolicy`.
  - Backend: `officialStelliveMusicSyncService`, `musicSourcePlaylists`, `youtubeDataApiClient`, `internalRoutes`, `env`, `musicRepository`.
- API 응답 원문, YouTube 응답 fixture, 로그를 길게 출력하지 않는다. 테스트는 실패 요약만 확인한다.
- 구현 중 출력 명령은 항상 `rtk` prefix를 사용한다.

## Minimal Test Policy

변경된 코드와 직접 연결된 테스트만 수행한다.

- Android UI policy/search/status/recent cover 변경:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.SongUiPolicyTest --tests dev.stellive.hub.MainUiPolicyTest --tests dev.stellive.hub.ServerHubRepositoryTest
```

- iOS home/recent cover policy 변경:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/SongUiPolicyTests -only-testing:StelliveHubiOSTests/HubAPIClientTests
```

- Backend discovery sync 변경:

```bash
cd backend/stellive-hub-api
rtk npm test -- musicYoutubeDataApiClient musicChannelDiscoverySyncService musicInternalRoutes musicRepository
```

- 공통 타입 또는 앱 컴파일 오류가 의심될 때만 각 플랫폼 build를 추가로 수행한다.
- 서버 route/env/app wiring이 바뀐 경우에만 `rtk npm run build`를 수행한다.
- Docker rebuild, 모바일 설치, 전체 테스트는 사용자가 별도로 요청할 때만 수행한다.

## File Change Map

### Android

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
  - 노래 페이지 중복 설명 카드 제거/축소.
  - iOS와 유사한 멤버 필터 selector card 표시.
  - 검색 입력 재렌더 debounce 또는 submit 방식 적용.
  - 홈/라이브/노래/굿즈·행사 server status strip 추가.
  - 홈 최근 커버곡 section 추가.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
  - member filter selector label/count 정책.
  - server status display text 정책.
  - search query normalization/debounce eligibility 정책.
  - home recent cover slicing 정책.
- Modify if needed: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/HubRepository.kt`
  - 홈 최근 커버곡이 repository contract로 필요할 경우 helper 추가.
- Modify if needed: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/ServerHubRepository.kt`
  - 기존 `songs()` 또는 `music()` 호출 결과에서 cover 최신곡 재사용.
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/SongUiPolicyTest.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt`
- Test if repository changes: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ServerHubRepositoryTest.kt`

### iOS

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/HomeView.swift`
  - 최근 커버곡 Section 추가.
- Modify if needed: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
  - `recentCoverSongs` computed property 추가.
- Modify if needed: `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
  - 서버 song cache에서 최신 cover subset 계산.
- Modify if needed: `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
  - `SongRow` 재사용 가능하도록 작은 row component 접근성 정리.
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`
- Test if API mapping changes: `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`

### Backend

- Modify: `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts`
  - `fetchChannelUploadPlaylistIds(channelIds)` 또는 `channels.list(part=contentDetails)` helper 추가.
- Create: `backend/stellive-hub-api/src/music/musicChannelDiscoverySyncService.ts`
  - 공식/멤버 channel uploads playlist 최근 페이지 조회.
  - unique `videoId` 추출.
  - `videos.list` 상세 보강.
  - classifier/member matcher/manual override 우선순위 적용.
  - `videoId` 기준 upsert.
- Modify: `backend/stellive-hub-api/src/music/musicSourcePlaylists.ts`
  - official channel/member upload discovery source seed helper 또는 source title builder 추가.
- Modify: `backend/stellive-hub-api/src/config/env.ts`
  - `MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED`
  - `MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES`
  - `MUSIC_CHANNEL_DISCOVERY_RECENT_PAGES`
- Modify: `backend/stellive-hub-api/.env.example`
  - 위 env 이름만 추가하고 값은 non-secret default로 둔다.
- Modify: `backend/stellive-hub-api/src/routes/internalRoutes.ts`
  - `POST /v1/internal/schedulers/music/discover-channel-uploads` 추가 또는 기존 music sync endpoint에 explicit mode 추가.
- Modify: `backend/stellive-hub-api/src/app.ts`
  - service wiring.
- Test: `backend/stellive-hub-api/test/musicYoutubeDataApiClient.test.ts`
- Create: `backend/stellive-hub-api/test/musicChannelDiscoverySyncService.test.ts`
- Test: `backend/stellive-hub-api/test/musicInternalRoutes.test.ts`

## Task 1: Android song member filter selector alignment

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/SongUiPolicyTest.kt`

- [ ] Add policy tests for selected member label, count text, clear availability, and member-only options.
- [ ] Replace the current large `compactEventCard("멤버", ...)` member selector with a smaller selector row/card using the existing Android colors/card shapes.
- [ ] Show selected value as `전체` or member Korean display name and show `N곡`.
- [ ] Keep navigation to `HubScreen.SONG_MEMBER_FILTER`.
- [ ] Run focused Android song policy test.

Expected test focus:

```kotlin
assertEquals("전체", MainUiPolicy.songMemberFilterLabel(members, "all"))
assertEquals("네네코 마시로", MainUiPolicy.songMemberFilterLabel(members, "neneko-mashiro"))
assertEquals("네네코 마시로 · 12곡", MainUiPolicy.songMemberFilterSummary(members, "neneko-mashiro", 12))
assertTrue(MainUiPolicy.canClearSongMemberFilter("neneko-mashiro"))
assertFalse(MainUiPolicy.canClearSongMemberFilter("all"))
```

## Task 2: Android song page duplicated header cleanup

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt`

- [ ] Remove the large body card that repeats the page title `노래`.
- [ ] Add a compact source/status strip if explanatory text is still needed.
- [ ] Keep existing title bar and screen title unchanged.
- [ ] Add policy test for compact source/status text if a helper is introduced.

Suggested text policy:

```kotlin
assertEquals("서버 캐시 기반 · YouTube 직접 호출 없음", MainUiPolicy.songSourceStatusText())
```

## Task 3: Android compact server status strip

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt`

- [ ] Add a small reusable `serverStatusStrip()` builder in `MainActivity`.
- [ ] Add it to Home, Live, Songs, Goods/Events render paths.
- [ ] Use existing server repository/bootstrap state; do not introduce a new polling loop for the strip.
- [ ] Keep debug logs behind existing debug mode only.
- [ ] Add policy tests for status text:

```kotlin
assertEquals("서버 연결됨", MainUiPolicy.serverConnectionLabel(isUsingFallback = false, hasRecentSuccess = true))
assertEquals("캐시 표시 중", MainUiPolicy.serverConnectionLabel(isUsingFallback = true, hasRecentSuccess = true))
assertEquals("오프라인", MainUiPolicy.serverConnectionLabel(isUsingFallback = true, hasRecentSuccess = false))
```

## Task 4: Android song search focus-loss crash fix

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/SongUiPolicyTest.kt`

- [ ] Before changing code, reproduce or inspect the crash path around `songSearchCard()` and callbacks.
- [ ] Stop calling `renderSongs()` synchronously from every text-change callback.
- [ ] Update `selectedSongQuery` in text callback, reset page to 1, then schedule a single debounced render while the current screen is still `SONGS`.
- [ ] Cancel pending search render when leaving the song screen.
- [ ] Avoid re-setting text in a way that fires duplicate callbacks after focus loss.
- [ ] Add policy tests for query normalization:

```kotlin
assertEquals("", MainUiPolicy.normalizedSongQuery("   "))
assertEquals("stella", MainUiPolicy.normalizedSongQuery("  stella  "))
```

- [ ] Run focused Android song policy test.
- [ ] If a device is available, manually verify: type in search, tap outside/press back to hide keyboard, app remains running.

## Task 5: Android home recent cover songs

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
- Modify if needed: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/ServerHubRepository.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt`
- Test if repository changes: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ServerHubRepositoryTest.kt`

- [ ] Add `recentCoverSongs(songs, limit)` policy helper.
- [ ] Render up to 5 recent cover songs on Home.
- [ ] Reuse existing song thumbnail/card/link policy.
- [ ] Add “노래 전체 보기” action to Songs tab.
- [ ] Do not call YouTube directly.

Expected policy test:

```kotlin
val recent = MainUiPolicy.recentCoverSongs(songs, limit = 3)
assertEquals(3, recent.size)
assertTrue(recent.all { it.type == "cover" })
```

## Task 6: iOS home recent cover songs

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/HomeView.swift`
- Modify if needed: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- Modify if needed: `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`

- [ ] Add recent cover computed data from existing server song cache or fallback songs.
- [ ] Add `최근 커버곡` Section to `HomeView`.
- [ ] Reuse existing `SongRow`/thumbnail/link behavior where possible.
- [ ] Keep grouped iOS style unchanged.
- [ ] Add focused policy test:

```swift
let recent = IOSSongPagePolicy.recentCoverSongs(songs, limit: 3)
XCTAssertEqual(recent.count, 3)
XCTAssertTrue(recent.allSatisfy { $0.type == .cover })
```

## Task 7: Backend YouTube channel uploads client support

**Files:**

- Modify: `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts`
- Test: `backend/stellive-hub-api/test/musicYoutubeDataApiClient.test.ts`

- [ ] Add a method that calls `channels.list` with `part=contentDetails`.
- [ ] Return only `{ channelId, uploadsPlaylistId }`.
- [ ] Never log API key or full request URL with key.
- [ ] Add tests for successful uploads playlist extraction and missing uploads playlist handling.
- [ ] Run focused YouTube client test.

Expected method shape:

```ts
fetchChannelUploadPlaylists(channelIds: string[]): Promise<Array<{ channelId: string; uploadsPlaylistId: string }>>
```

## Task 8: Backend hourly channel discovery sync service

**Files:**

- Create: `backend/stellive-hub-api/src/music/musicChannelDiscoverySyncService.ts`
- Modify: `backend/stellive-hub-api/src/music/musicSourcePlaylists.ts`
- Test: `backend/stellive-hub-api/test/musicChannelDiscoverySyncService.test.ts`

- [ ] Build target channel list from official channel plus active/upcoming members with verified `youtubeChannelId`.
- [ ] Exclude Former members and unknown/unverified channel IDs.
- [ ] Fetch uploads playlist first page by default.
- [ ] Deduplicate `videoId` before `videos.list`.
- [ ] Reuse existing classifier/member matcher/manual override behavior.
- [ ] Upsert only missing or changed videos by `videoId`.
- [ ] Mark ambiguous items `NEEDS_REVIEW`; do not hard delete.
- [ ] Preserve official playlist source if same video already exists from official playlist.
- [ ] Return summary counts: `channelsChecked`, `playlistItemsChecked`, `uniqueVideos`, `inserted`, `updated`, `needsReview`, `excludedCandidates`, `apiCallsEstimated`.

Core tests:

```ts
it("dedupes channel upload video ids before videos.list", async () => {})
it("does not overwrite official playlist source with discovery source", async () => {})
it("marks ambiguous discovery candidates as needs review", async () => {})
it("excludes former or unverified member channels from targets", async () => {})
```

## Task 9: Backend env, route, and app wiring

**Files:**

- Modify: `backend/stellive-hub-api/src/config/env.ts`
- Modify: `backend/stellive-hub-api/.env.example`
- Modify: `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- Modify: `backend/stellive-hub-api/src/app.ts`
- Test: `backend/stellive-hub-api/test/musicInternalRoutes.test.ts`

- [ ] Add non-secret env defaults:

```env
MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED=false
MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES=60
MUSIC_CHANNEL_DISCOVERY_RECENT_PAGES=1
```

- [ ] Add protected internal route:

```text
POST /v1/internal/schedulers/music/discover-channel-uploads
```

- [ ] Keep route protected by existing internal/admin token hook.
- [ ] Return service summary without raw YouTube responses.
- [ ] Wire service in `app.ts` only when YouTube API client and music repository are configured.
- [ ] Run backend focused route/service tests and backend build if env/app wiring changed.

## Task 10: Documentation and handoff

**Files:**

- Modify if needed: `docs/API_SETUP.md`
- Modify if needed: `docs/AI_HANDOFF.md`
- Modify if needed: `CODEMAP.md`

- [ ] Document discovery env vars and `search.list` non-use.
- [ ] Document that official playlist sync remains authoritative.
- [ ] Document mobile home recent cover behavior as server/API-backed.
- [ ] Update `CODEMAP.md` only for new source/test files.

## Verification Checklist

- [ ] Android focused tests pass for changed policy/repository files.
- [ ] iOS focused tests pass for changed song/home policy files.
- [ ] Backend focused tests pass for YouTube client/discovery/internal route.
- [ ] Backend build passes if env/app route wiring changes.
- [ ] No mobile code calls YouTube API directly.
- [ ] No `search.list` is used in discovery sync.
- [ ] Former members are not added to target channel discovery, seed, filters, or UI.
- [ ] No secrets, profile images, official logos, fan art, screenshots, or raw private payloads are committed.

