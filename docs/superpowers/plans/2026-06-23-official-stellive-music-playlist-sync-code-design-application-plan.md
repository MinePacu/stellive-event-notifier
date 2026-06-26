# Official Stellive Music Playlist Sync Code Design And Application Plan

> Source design: `docs/superpowers/plans/2026-06-23-official-stellive-music-playlist-sync-design-plan.md`

## Goal

현재 music sync MVP를 공식 Stellive YouTube playlist 2개 기반 구조로 확장한다.

- Cover playlist: `PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy`
- Original playlist: `PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX`

완료 후 서버는 관리자/internal 명령 또는 scheduler로 공식 playlist를 동기화하고, public client는 YouTube API를 직접 호출하지 않고 DB/cache 기반 `/v1/music` 계열 API만 조회한다.

## Non-Negotiable Design Rules

- YouTube API key는 서버 환경 변수로만 사용한다.
- 클라이언트 요청 처리 중 YouTube API를 호출하지 않는다.
- 기본 동기화 로직에서 `search.list`를 사용하지 않는다.
- 공식 음악 catalog sync의 authoritative source는 공식 playlist 2개다.
- 기존에 멤버별 playlist ID를 순회하는 music sync 구조가 있으면 official music catalog sync 경로에서는 대체/deprecate한다.
- 기존 song-page upload/WebSub/backfill 및 `/v1/songs` 호환 경로는 별도 기능이므로 불필요하게 제거하지 않는다.
- 같은 `videoId`는 한 개의 music video row로 upsert한다.
- 여러 source playlist에서 발견된 이력은 별도 mapping으로 보존한다.
- 멤버별 목록은 video row 복사가 아니라 video/member 관계 table로 표현한다.
- 자동 분류는 manual override보다 낮은 우선순위다.
- 제외 후보, unavailable, review 대상은 hard delete하지 않는다.

## Token-Minimized Work Rules

- 명령은 항상 `rtk` prefix를 사용한다.
- 검색은 `CODEMAP.md`와 `rg`/`rtk grep`로 시작하고, 필요한 파일만 `rtk read` 또는 좁은 `sed` 범위로 읽는다.
- 이미 구현된 파일 전체를 반복해서 읽지 않는다. 변경 전후 검증에 필요한 symbol 주변만 확인한다.
- YouTube fixture는 최소 wrapper fields만 둔다: `kind`, `etag`, `nextPageToken`, `items`.
- 실제 YouTube API raw response 전체를 test/doc에 붙이지 않는다.
- backend-only 변경에서는 Android/iOS 테스트를 실행하지 않는다.
- full backend test suite는 공유 contract나 route 등록이 넓게 깨졌다고 의심될 때만 실행한다.
- task별로 변경된 코드에 직접 관련된 focused test만 실행한다.
- 최종 검증도 이번 변경 파일과 영향받는 기존 tests만 실행한다.
- diff review는 `rtk git diff -- <changed paths>` 또는 `rtk git diff --check` 중심으로 한다.
- 문서만 변경한 task는 build/test 대신 `rtk git diff --check`만 수행한다.

## Current Code To Reuse

이미 구현된 기반은 재사용한다.

- `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts`
  - `fetchPlaylistItems()`
  - `fetchVideos()`
- `backend/stellive-hub-api/src/music/musicSyncService.ts`
  - `syncSourcePlaylist()`
  - `syncAllMusic()`
- `backend/stellive-hub-api/src/music/musicLocks.ts`
- `backend/stellive-hub-api/src/music/musicClassifier.ts`
- `backend/stellive-hub-api/src/music/musicMemberMatcher.ts`
- `backend/stellive-hub-api/src/cache/responseCache.ts`
- `backend/stellive-hub-api/src/routes/musicRoutes.ts`
- `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- `backend/stellive-hub-api/src/repositories/musicRepository.ts`
- `backend/stellive-hub-api/prisma/schema.prisma`

## Required Code Design

### Data Model

Modify `backend/stellive-hub-api/prisma/schema.prisma`.

Extend `MusicMember`:

- `generationOrGroup String?`
- `isGraduated Boolean @default(false)`

Extend `SourcePlaylist`:

- allow `rawCategoryHint` value `ORIGINAL` at repository/domain level.
- keep `memberId` nullable; official playlist rows must use `memberId=null`.

Extend `MusicItem`:

- `normalizedTitle String?`
- `durationSeconds Int?`
- `privacyStatus String?`
- `embeddable Boolean?`
- `madeForKids Boolean?`
- `dimension String?`
- `definition String?`
- `caption String?`
- `tags Json?`
- `isAvailable Boolean @default(true)`
- `isExcluded Boolean @default(false)`
- `exclusionReason String?`
- `classificationStatus String @default("AUTO_CLASSIFIED")`
- `isInstrumental Boolean @default(false)`
- `specialFlags Json?`
- `fetchedAt DateTime?`

Extend `MusicItemMember`:

- `confidence Float @default(0)`
- `source String @default("UNKNOWN")`

Add `MusicItemSourcePlaylist`:

- `musicItemId`
- `sourcePlaylistId`
- `youtubePlaylistItemId`
- `sourcePlaylistTitle`
- `sourcePlaylistPosition`
- `sourcePlaylistType`
- `seenAt`
- timestamps
- unique `[musicItemId, sourcePlaylistId]`

Add `MusicItemOverride`:

- `musicItemId @unique` or `youtubeVideoId @unique`
- `forcedType String?`
- `forcedMemberIds Json?`
- `forceExcluded Boolean @default(false)`
- `exclusionReason String?`
- `note String?`
- timestamps

### Official Source Playlist Seed

Modify `backend/stellive-hub-api/src/music/musicSourcePlaylists.ts`.

Add constants:

- `OFFICIAL_STELLIVE_MUSIC_COVER_PLAYLIST_ID`
- `OFFICIAL_STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID`
- `officialStelliveMusicSourcePlaylistSeeds`

Rows:

- cover playlist:
  - `youtubePlaylistId=PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy`
  - `type=cover`
  - `rawCategoryHint=ORIGINAL` is not used.
  - `memberId=null`
  - `isActive=true`
- original playlist:
  - `youtubePlaylistId=PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX`
  - `type=original`
  - `rawCategoryHint=ORIGINAL`
  - `memberId=null`
  - `isActive=true`

If previous member-specific playlist seeds exist for music catalog sync, do not use them in `syncOfficialStelliveMusicPlaylists()`.

### YouTube Client

Modify `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts`.

`fetchPlaylistItems()`:

- call `part=snippet,contentDetails,status`.
- return:
  - `playlistItemId`
  - `videoId`
  - `title`
  - `description`
  - `channelId`
  - `channelTitle`
  - `publishedAt`
  - `position`
  - `privacyStatus`
  - `pagesFetched`
  - `quotaUnits`

`fetchVideos()`:

- return:
  - `videoId`
  - `title`
  - `description`
  - `publishedAt`
  - `thumbnailUrl`
  - `thumbnailWidth`
  - `thumbnailHeight`
  - `tags`
  - `duration`
  - `dimension`
  - `definition`
  - `caption`
  - `channelId`
  - `channelTitle`
  - `privacyStatus`
  - `embeddable`
  - `madeForKids`

Add retry/backoff helper only for network/5xx failures. Do not retry quota/403 loops.

### Classifier

Modify `backend/stellive-hub-api/src/music/musicClassifier.ts`.

Add:

- `normalizeTitle(title)`
- `parseDurationToSeconds(isoDuration)`
- `detectInstrumental(title)`
- `detectExcludeCandidate(title, description)`
- `detectSpecialFlags(title, description, durationSeconds)`
- `classifyVideo(input)`
- `applyManualOverride(autoClassification, override)`

Classifier output:

- `type`
- `normalizedTitle`
- `durationSeconds`
- `isInstrumental`
- `isAvailable`
- `isExcluded`
- `exclusionReason`
- `classificationStatus`
- `specialFlags`

Classification status:

- `AUTO_CLASSIFIED`
- `NEEDS_REVIEW`
- `MANUAL_CONFIRMED`
- `MANUAL_EXCLUDED`

### Member Matcher

Modify `backend/stellive-hub-api/src/music/musicMemberMatcher.ts`.

Add priority and metadata:

1. manual override
2. `channelId`
3. title alias
4. description alias
5. channelTitle alias
6. group alias
7. no match

Return link rows with:

- `memberId`
- `role`
- `confidence`
- `source`

Use current lowercase public role values unless shared contract is deliberately migrated:

- `main`
- `collaboration`
- `group`
- `unknown`

Add group alias support:

- `STELLIVE`
- `StelLive`
- `Universe`
- `Cliche`
- `Cliché`
- `Mystic`
- `Everys`

### Repository

Modify `backend/stellive-hub-api/src/repositories/musicRepository.ts`.

Add repository methods:

- `upsertOfficialSourcePlaylists(seeds)`
- `upsertMusicItemSourcePlaylist(input)`
- `getMusicItemByVideoId(videoId)`
- `getOverrideByVideoId(videoId)`
- `upsertMusicItemOverride(input)`
- `listReviewCandidates(filters)`
- `listMusicSyncRuns(limit)`
- `estimateMusicQuota()`

Update existing methods:

- `upsertMusicItem()` must return whether item was inserted or updated if practical.
- `replaceMusicItemMembers()` must persist `confidence` and `source`.
- `listMusicItems()` must support:
  - `includeGraduated`
  - `includeInstrumental`
  - `includeExcluded`
  - `sort=publishedAtDesc|playlistOrder`

### Official Sync Service

Create `backend/stellive-hub-api/src/music/officialStelliveMusicSyncService.ts`.

Main function:

- `syncOfficialStelliveMusicPlaylists(mode?: "full" | "light" | "manual")`

Flow:

1. Acquire global official music sync lock.
2. Upsert official source playlist seed rows.
3. Fetch both official playlists.
4. Preserve every playlist item mapping.
5. Deduplicate by `videoId`.
6. Fetch unique video details in 50-id chunks.
7. Mark videoIds missing from `videos.list` as unavailable.
8. Classify each video.
9. Apply manual override.
10. Match members.
11. Upsert `MusicItem`.
12. Upsert `MusicItemSourcePlaylist`.
13. Replace member links.
14. Record `MusicSyncRun`.
15. Return summary:
    - `totalPlaylistItems`
    - `uniqueVideos`
    - `inserted`
    - `updated`
    - `unavailable`
    - `needsReview`
    - `excludedCandidates`
    - `apiCallsEstimated`

Important replacement behavior:

- This service must not iterate over member-specific playlists.
- Existing `syncAllMusic()` may remain for compatibility, but official music catalog sync route must use this official service.

### Routes

Modify `backend/stellive-hub-api/src/routes/musicRoutes.ts`.

Add query support:

- `includeGraduated=false`
- `includeInstrumental=false`
- `includeExcluded=false`
- `sort=publishedAtDesc|playlistOrder`

Modify `backend/stellive-hub-api/src/routes/internalRoutes.ts`.

Add:

- `POST /v1/internal/schedulers/music/sync-official-playlists`
- `GET /v1/internal/music/review`
- `PATCH /v1/internal/music/videos/:videoId/override`
- `GET /v1/internal/music/sync-log`
- `GET /v1/internal/music/quota-estimate`

All internal routes:

- use existing bearer auth hook.
- never return `YOUTUBE_API_KEY`.
- validate request body strictly.

### App Wiring / Env

Modify:

- `backend/stellive-hub-api/src/app.ts`
- `backend/stellive-hub-api/src/config/env.ts`
- `backend/stellive-hub-api/.env.example`

Add env:

- `STELLIVE_MUSIC_SYNC_INTERVAL_MINUTES=60`
- `STELLIVE_MUSIC_COVER_PLAYLIST_ID=PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy`
- `STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID=PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX`
- `STELLIVE_MUSIC_INCLUDE_GRADUATED_DEFAULT=false`
- `STELLIVE_MUSIC_INCLUDE_INSTRUMENTAL_DEFAULT=false`

Wire official sync service only when:

- `MUSIC_SYNC_ENABLED=true`
- `YOUTUBE_API_KEY` is configured

Public music routes must work without YouTube API key.

## Task Plan

### Task 1: Schema And Repository Extensions

Files:

- `backend/stellive-hub-api/prisma/schema.prisma`
- `backend/stellive-hub-api/src/repositories/musicRepository.ts`
- `backend/stellive-hub-api/test/musicRepository.test.ts`

Steps:

- [ ] Write focused repository tests for new fields/tables/override/source mapping.
- [ ] RED: `rtk npm test -- musicRepository`
- [ ] Extend Prisma schema.
- [ ] Extend repository delegate ports and methods.
- [ ] Verify:
  - `rtk npm run prisma:generate`
  - `rtk npm test -- musicRepository`
  - `rtk npm run build`

### Task 2: Official Playlist Seed And Member/Group Seed

Files:

- `backend/stellive-hub-api/src/music/musicSourcePlaylists.ts`
- `backend/stellive-hub-api/test/musicSourcePlaylists.test.ts`

Steps:

- [ ] Add tests that official playlist IDs are exactly the two required IDs.
- [ ] Add tests that official playlist seeds have `memberId=null`.
- [ ] Add tests that member playlist seeds are not used by official sync source selection.
- [ ] Add group alias seed tests.
- [ ] RED: `rtk npm test -- musicSourcePlaylists`
- [ ] Implement seeds.
- [ ] Verify: `rtk npm test -- musicSourcePlaylists`

### Task 3: YouTube Client Metadata Expansion

Files:

- `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts`
- `backend/stellive-hub-api/test/musicYoutubeDataApiClient.test.ts`
- `backend/stellive-hub-api/test/youtubeDataApiClient.test.ts`

Steps:

- [ ] Add tests for `part=snippet,contentDetails,status`.
- [ ] Add playlist item metadata normalization tests.
- [ ] Add videos metadata normalization tests.
- [ ] Add retry/backoff tests only for network/5xx.
- [ ] Add quota/403 no-retry test.
- [ ] RED: `rtk npm test -- musicYoutubeDataApiClient`
- [ ] Implement metadata expansion.
- [ ] Verify:
  - `rtk npm test -- musicYoutubeDataApiClient youtubeDataApiClient`
  - `rtk npm run build`

### Task 4: Classifier Helpers

Files:

- `backend/stellive-hub-api/src/music/musicClassifier.ts`
- `backend/stellive-hub-api/test/musicClassifier.test.ts`

Steps:

- [ ] Add tests for duration ISO parsing.
- [ ] Add tests for title normalization.
- [ ] Add tests for instrumental detection.
- [ ] Add tests for shorts/teaser exclusion candidate detection.
- [ ] Add tests for medley/mashup/OST/remix flags.
- [ ] Add tests for duration threshold flags.
- [ ] Add tests for manual override precedence.
- [ ] RED: `rtk npm test -- musicClassifier`
- [ ] Implement helpers.
- [ ] Verify: `rtk npm test -- musicClassifier`

### Task 5: Member Matcher Expansion

Files:

- `backend/stellive-hub-api/src/music/musicMemberMatcher.ts`
- `backend/stellive-hub-api/test/musicMemberMatcher.test.ts`

Steps:

- [ ] Add tests for channelId match.
- [ ] Add tests for title/description/channelTitle alias match.
- [ ] Add tests for collab separators `x`, `X`, `&`.
- [ ] Add tests for group alias low-confidence group links.
- [ ] Add tests for no-match `NEEDS_REVIEW` signal.
- [ ] Add tests for manual source link priority if matcher owns this logic.
- [ ] RED: `rtk npm test -- musicMemberMatcher`
- [ ] Implement matcher metadata.
- [ ] Verify: `rtk npm test -- musicMemberMatcher`

### Task 6: Official Playlist Sync Service

Files:

- `backend/stellive-hub-api/src/music/officialStelliveMusicSyncService.ts`
- `backend/stellive-hub-api/src/music/musicSyncService.ts` if shared ports need extension
- `backend/stellive-hub-api/test/musicOfficialPlaylistSyncService.test.ts`
- `backend/stellive-hub-api/test/musicSyncService.test.ts` only if existing behavior changes

Steps:

- [ ] Add tests that official sync uses only the two official playlist IDs.
- [ ] Add tests that existing member playlist sources are ignored.
- [ ] Add duplicate videoId dedupe test.
- [ ] Add source mapping preservation test.
- [ ] Add cover/original conflict `NEEDS_REVIEW` test.
- [ ] Add unavailable video test.
- [ ] Add manual override not overwritten test.
- [ ] Add summary count test.
- [ ] RED: `rtk npm test -- musicOfficialPlaylistSyncService`
- [ ] Implement official sync service.
- [ ] Verify:
  - `rtk npm test -- musicOfficialPlaylistSyncService musicSyncService musicRepository`
  - `rtk npm run build`

### Task 7: Public Music API Filters And Sort

Files:

- `backend/stellive-hub-api/src/routes/musicRoutes.ts`
- `backend/stellive-hub-api/src/music/musicDto.ts`
- `backend/stellive-hub-api/src/repositories/musicRepository.ts`
- `backend/stellive-hub-api/test/musicRoutes.test.ts`
- `shared/schemas/domain.ts` only if response contract changes
- `shared/schemas/mobileApi.ts` only if response contract changes
- `shared/openapi/openapi.yaml`

Steps:

- [ ] Add tests for default filters:
  - `includeGraduated=false`
  - `includeInstrumental=false`
  - `includeExcluded=false`
- [ ] Add tests for `sort=publishedAtDesc`.
- [ ] Add tests for `sort=playlistOrder`.
- [ ] Add tests that public response does not leak raw payloads, secrets, local paths, or review-only fields unless intentionally exposed.
- [ ] RED: `rtk npm test -- musicRoutes`
- [ ] Implement route/repository filter support.
- [ ] Verify:
  - `rtk npm test -- musicRoutes musicRepository`
  - `rtk npm run build`

### Task 8: Internal Review, Override, Official Sync Routes

Files:

- `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- `backend/stellive-hub-api/test/musicInternalRoutes.test.ts`

Steps:

- [ ] Add tests for protected `sync-official-playlists`.
- [ ] Add tests for review candidates route.
- [ ] Add tests for override patch validation.
- [ ] Add tests that override route never returns API key.
- [ ] Add tests for sync log route.
- [ ] Add tests for quota estimate route.
- [ ] RED: `rtk npm test -- musicInternalRoutes`
- [ ] Implement routes using existing auth hook.
- [ ] Verify:
  - `rtk npm test -- musicInternalRoutes adminInternalRoutes`
  - `rtk npm run build`

### Task 9: Env And App Wiring

Files:

- `backend/stellive-hub-api/src/app.ts`
- `backend/stellive-hub-api/src/config/env.ts`
- `backend/stellive-hub-api/.env.example`
- `backend/stellive-hub-api/test/musicAppWiring.test.ts`

Steps:

- [ ] Add env parsing tests for official playlist IDs and defaults.
- [ ] Add tests that official sync service is disabled without key or disabled flag.
- [ ] Add tests that public music routes work without YouTube key.
- [ ] Add tests that internal official sync route delegates to official service when enabled.
- [ ] RED: `rtk npm test -- musicAppWiring`
- [ ] Implement env/app wiring.
- [ ] Verify:
  - `rtk npm test -- musicAppWiring musicInternalRoutes musicRoutes`
  - `rtk npm run build`

### Task 10: Documentation And Server Handoff

Files:

- `README.md`
- `docs/API_SETUP.md`
- `CODEMAP.md`
- `docs/AI_HANDOFF.md`
- optional OpenAPI updates if route/query contract changed

Steps:

- [ ] Document official playlist IDs.
- [ ] Document server-only API key policy.
- [ ] Document official sync route and default filters.
- [ ] Document migration/db push and first full sync steps.
- [ ] Document that member playlist loop is replaced for official catalog sync.
- [ ] Update CODEMAP for every new source/test file.
- [ ] Verify:
  - `rtk git diff --check`

## Final Focused Verification

Run only tests affected by this feature:

```bash
rtk npm test -- musicContract musicSourcePlaylists musicYoutubeDataApiClient youtubeDataApiClient musicClassifier musicMemberMatcher musicRepository musicOfficialPlaylistSyncService musicSyncService responseCache musicRoutes musicInternalRoutes musicAppWiring
rtk npm run build
rtk git diff --check
```

Do not run Android/iOS tests unless mobile code changes.

Do not run full backend test suite unless:

- shared contracts break unrelated route tests,
- app route registration failure suggests global Fastify issue,
- TypeScript build indicates broad impact.

## Server Application Plan

After code lands:

1. Push branch to remotes.
2. Sync workspace to server, excluding `.env`, secrets, dependencies, build artifacts.
3. Copy `.env.example` explicitly if rsync excludes `.env.*`.
4. Rebuild/recreate Docker services.
5. Run Prisma migration or `prisma db push`.
6. Confirm env without printing secret values:
   - `YOUTUBE_API_KEY=set`
   - `MUSIC_SYNC_ENABLED=true`
   - official playlist env IDs present.
7. Trigger:
   - `POST /v1/internal/schedulers/music/sync-official-playlists`
8. Verify:
   - DB counts.
   - sync summary.
   - `/v1/music?type=cover&limit=5`
   - `/v1/music?type=original&limit=5`
   - `/v1/members/:memberId/music?type=cover`

## Completion Criteria

- Official cover/original playlist sync route works.
- DB stores videos uniquely by `videoId`.
- Source playlist mapping preserves duplicate-source discoveries.
- cover/original type comes from official playlist source.
- conflicts go to `NEEDS_REVIEW`.
- unavailable/private/deleted candidates are stored but hidden by public defaults.
- instrumental/excluded/review flags are stored and filterable.
- member relation rows support collab songs.
- manual override wins over automatic sync.
- public default API returns available, non-excluded, non-graduated, non-instrumental items.
- focused tests and backend build pass.
