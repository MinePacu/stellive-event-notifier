# Official Stellive Music Playlist Sync Feature Design Plan

## Goal

스텔라이브 공식 YouTube 채널의 공식 재생목록 2개를 서버 스케줄러/관리자 명령으로 동기화하고, 서버 DB/캐시 기반으로 클라이언트에 멤버별 정제 곡 목록을 제공한다.

대상 공식 playlist:

- Cover: `PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy`
- Original: `PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX`

## Current Implementation Snapshot

이미 구현된 기반:

- 서버 전용 YouTube Data API client:
  - `fetchPlaylistItems()`
  - `fetchVideos()`
  - playlist pagination
  - 50개 단위 `videos.list` chunking
- Music domain Prisma 모델:
  - `MusicMember`
  - `SourcePlaylist`
  - `MusicItem`
  - `MusicItemMember`
  - `MusicSyncRun`
- Sync service:
  - `syncSourcePlaylist()`
  - `syncAllMusic()`
  - per-source lock
  - full sync missing 처리
- Public API:
  - `GET /v1/music`
  - `GET /v1/music/:id`
  - `GET /v1/members/:id/music`
- Internal sync API:
  - `POST /v1/internal/schedulers/music/sync`
- Response cache:
  - memory stale-while-revalidate
  - per-key coalescing
- 기본 10명 활동 멤버 allowlist와 alias 일부
- WebSub optional music hook 확장점
- YouTube API key는 서버 환경 변수로만 사용
- 클라이언트 요청 중 YouTube API 직접 호출 없음
- `search.list` 미사용

현재 구현과 이번 요구사항 사이의 주요 gap:

- 공식 playlist 2개가 코드/seed/admin 초기값으로 고정 반영되어 있지 않음.
- `playlistItems.list`가 현재 `part=snippet,contentDetails`만 호출하며 `status`를 수집하지 않음.
- `fetchPlaylistItems()` 결과에 `playlistItem.id`, `snippet.description`, `snippet.channelId`, `snippet.channelTitle`, `status.privacyStatus`가 없음.
- `fetchVideos()` 결과에 `dimension`, `definition`, `caption`, `embeddable`, `madeForKids`가 없음.
- `MusicItem`이 `duration` ISO 문자열은 저장하지만 `durationSeconds`, `normalizedTitle`, `isInstrumental`, `isExcluded`, `exclusionReason`, `classificationStatus`, `isAvailable`, `specialFlags`, `fetchedAt` 등을 갖고 있지 않음.
- 같은 `videoId`가 여러 source playlist에서 발견될 때 source mapping을 보존하는 별도 table이 없음.
- manual override table이 없음.
- graduated member 저장/노출 필터 구조가 없음.
- member matching confidence/source를 저장하지 않음.
- classifier가 instrumental, shorts/teaser, medley/mashup/OST/remix, duration 기반 review 후보를 판정하지 않음.
- public route query가 `includeGraduated`, `includeInstrumental`, `includeExcluded`, `playlistOrder` sort를 지원하지 않음.
- 관리자 review/override/sync-log/quota-estimate API가 없음.
- scheduler interval env `STELLIVE_MUSIC_SYNC_INTERVAL_MINUTES`가 없음. 현재는 `LIGHT_SYNC_INTERVAL_MINUTES`, `FULL_SYNC_INTERVAL_MINUTES`만 있음.

## Design Direction

기존 구현을 폐기하지 않고, 현재 `Music*` 모델과 `/v1/music` API를 확장한다. 요구사항의 예시 table 이름(`music_videos`, `music_video_members`)은 현재 Prisma 모델명과 1:1로 새로 만들기보다 기존 모델을 확장하는 방식이 안전하다.

### Existing Member Playlist Loop Replacement Policy

이번 기능의 authoritative sync source는 멤버별 playlist가 아니라 공식 Stellive YouTube playlist 2개다.

따라서 현재 코드나 DB seed에 다음 구조가 이미 있으면 music sync 경로에서는 대체한다.

- 멤버 10명의 개별 YouTube playlist ID를 순회하는 music source 구조.
- `memberId`가 붙은 `SourcePlaylist`를 기본 수집 단위로 삼는 music sync 구조.
- 멤버별 playlist seed를 자동 생성해 cover/original을 수집하는 구조.
- 멤버별 playlist sync 결과를 primary catalog로 사용하는 API/캐시 경로.

대체 후 기준:

- `syncOfficialStelliveMusicPlaylists()`는 공식 cover/original playlist 2개만 순회한다.
- `SourcePlaylist.memberId`는 이 공식 playlist 2개에서는 `null`로 둔다.
- 멤버 연결은 playlist 소유자가 아니라 `MusicItemMember` 관계로만 표현한다.
- 멤버별 곡 목록 API는 `MusicItemMember` join을 조회한다.
- 멤버별 playlist ID는 이번 기능의 동기화 source로 쓰지 않는다.

기존 멤버별 playlist 관련 코드가 다른 기능에서 사용 중이면 즉시 삭제하지 말고 다음 중 하나로 정리한다.

- music sync에서는 호출되지 않도록 분리/deprecate한다.
- 후속 보조 검증 기능용 adapter로 이동한다.
- tests에서 공식 playlist 2개가 primary source임을 검증한다.

중요: 기존 song-page upload/backfill/WebSub 흐름은 별도 기능이다. 이 대체 정책은 “공식 음악 catalog sync” 경로에만 적용한다. YouTube 채널 upload 알림이나 기존 `/v1/songs` 호환 경로를 불필요하게 제거하지 않는다.

Mapping:

- `members` → `MusicMember`
- `music_videos` → `MusicItem`
- `music_video_members` → `MusicItemMember`
- `music_video_overrides` → 신규 `MusicItemOverride`
- `source_playlist_ids 보존` → 신규 `MusicItemSourcePlaylist`

외부 API 경로는 현재 프로젝트 규칙에 맞춰 `/v1/music*`와 `/v1/internal/*`를 유지한다. 요구사항의 `/api/music/*`와 `/admin/music/*`는 문서/API alias로만 고려하고, 실제 MVP 구현은 기존 route prefix를 확장한다.

## Target Data Model Changes

### MusicMember 확장

기존:

- `id`
- `nameKo`
- `nameEn`
- `aliases`
- `youtubeChannelId`
- timestamps

추가:

- `generationOrGroup String?`
- `isGraduated Boolean @default(false)`

정책:

- 활동 멤버 10명은 `isGraduated=false`.
- 졸업생은 DB row 허용하되 seed는 별도 파일/구조로 분리한다.
- 클라이언트 기본 응답은 `includeGraduated=false`.

### SourcePlaylist seed 고정

기존 `SourcePlaylist` 유지.

Seed/upsert 대상:

- `youtubePlaylistId=PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy`
  - `title=Stellive Official Cover Playlist`
  - `type=cover`
  - `rawCategoryHint=COVER`
  - `isActive=true`
- `youtubePlaylistId=PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX`
  - `title=Stellive Official Original Playlist`
  - `type=original`
  - `rawCategoryHint=ORIGINAL`
  - `isActive=true`

기존 `rawCategoryHint` type은 현재 `COVER | SINGLE | EP | OTHERS` 기반이므로 `ORIGINAL`을 허용하거나, DB 저장값은 `SINGLE`/`EP`가 아닌 `ORIGINAL`까지 열어야 한다. 이번 요구사항은 공식 original playlist 단위라 `ORIGINAL` hint가 적절하다.

### MusicItem 확장

추가 필드:

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

기존 필드 유지:

- `youtubeVideoId`는 unique key 유지.
- `type`은 playlist 기준 `cover | original`으로 우선 저장.
- `duration` ISO 문자열은 backward compatibility로 유지 가능하나, public/filter용 canonical 값은 `durationSeconds`로 둔다.

### 신규 MusicItemSourcePlaylist

같은 `videoId`가 여러 playlist에서 발견될 때 source를 보존한다.

필드:

- `musicItemId`
- `sourcePlaylistId`
- `youtubePlaylistItemId`
- `sourcePlaylistTitle`
- `sourcePlaylistPosition`
- `sourcePlaylistType`
- `seenAt`
- timestamps

unique:

- `[musicItemId, sourcePlaylistId]`

이 table이 생기면 `MusicItem.sourcePlaylistId`와 `playlistPosition`은 primary display fallback으로 유지하되, 다중 source의 canonical 기록은 이 table을 사용한다.

### MusicItemMember 확장

기존:

- `musicItemId`
- `memberId`
- `role`

추가:

- `confidence Float @default(0)`
- `source String @default("UNKNOWN")`

source enum values:

- `CHANNEL_ID`
- `TITLE`
- `DESCRIPTION`
- `CHANNEL_TITLE`
- `GROUP_ALIAS`
- `MANUAL`
- `UNKNOWN`

role values:

- 기존 lowercase 값을 유지할지, 요구사항의 uppercase `MAIN | COLLAB | GROUP | UNKNOWN`으로 migration할지 결정 필요.
- 프로젝트 shared contract는 현재 lowercase `main | collaboration | group | unknown`이므로 DB도 lowercase 유지하고 API에서 그대로 반환하는 편이 기존 코드와 충돌이 적다.

### 신규 MusicItemOverride

필드:

- `musicItemId` 또는 `youtubeVideoId` unique
- `forcedType String?`
- `forcedMemberIds Json?`
- `forceExcluded Boolean @default(false)`
- `exclusionReason String?`
- `note String?`
- timestamps

정책:

- 자동 sync는 override가 있는 필드를 덮어쓰지 않는다.
- `forcedMemberIds`가 있으면 `MusicItemMember`를 `source=MANUAL`로 재구성한다.
- `forceExcluded=true`면 public 기본 응답에서 숨긴다.
- override 적용 후 `classificationStatus=MANUAL_CONFIRMED` 또는 `MANUAL_EXCLUDED`.

## YouTube API Client Changes

### fetchPlaylistItems()

현재 변경 필요:

- `part=snippet,contentDetails,status`로 변경.
- 반환 DTO에 다음 추가:
  - `playlistItemId`
  - `title`
  - `description`
  - `channelId`
  - `channelTitle`
  - `publishedAt`
  - `position`
  - `videoId`
  - `privacyStatus`

주의:

- API key는 log에 출력하지 않는다.
- 403/quota는 typed failure로 유지.
- retry/backoff는 `retryableFetch` helper를 두고 5xx/네트워크 오류에만 exponential backoff 적용한다.
- quotaExceeded/forbidden 403은 즉시 반복 재시도하지 않는다.

### fetchVideos()

현재 변경 필요:

- 반환 DTO에 다음 추가:
  - `description`
  - `channelTitle`
  - `tags`
  - `dimension`
  - `definition`
  - `caption`
  - `embeddable`
  - `madeForKids`
  - `privacyStatus`
- `videos.list` 결과에 없는 videoId는 sync service에서 unavailable로 저장한다.

## Classifier Changes

현재 `musicClassifier.ts`는 source type mapping만 수행한다. 다음 helper를 추가한다.

- `normalizeTitle(title)`
  - trim
  - repeated whitespace collapse
  - case-insensitive compare용 lower normalized variant
- `parseDurationToSeconds(isoDuration)`
  - ISO-8601 `PT3M21S`, `PT1H2M3S`, `PT45S` 처리
- `detectInstrumental(title)`
  - `Inst.`
  - `Instrumental`
  - `Off Vocal`
  - `MR`
- `detectExcludeCandidate(title, description)`
  - `#shorts`
  - `shorts`
  - `teaser`
  - `티저`
  - `trailer`
  - `preview`
  - `live clip`
  - `3D Live`
  - `behind`
  - `making`
- `detectSpecialFlags(title, description)`
  - `medley`
  - `메들리`
  - `mashup`
  - `OST`
  - `remix`
  - `short_or_preview`
  - `live_or_long_form`
- `classifyVideo(input)`
  - playlist 기준 type 우선.
  - duplicate playlist type 충돌 시 `NEEDS_REVIEW`.
  - unavailable/private/deleted는 `isAvailable=false`.
  - instrumental은 저장하되 기본 API에서 제외 가능.
  - short/teaser/live clip 후보는 저장하되 `isExcluded=true` 또는 `NEEDS_REVIEW` 정책 적용.

Classification status values:

- `AUTO_CLASSIFIED`
- `NEEDS_REVIEW`
- `MANUAL_CONFIRMED`
- `MANUAL_EXCLUDED`

## Member Matching Changes

현재 matcher는 source member + title/description alias만 보고, confidence/source를 저장하지 않는다.

추가 우선순위:

1. manual override
2. `video.snippet.channelId` equals member `youtubeChannelId`
3. title alias
4. description alias
5. channelTitle alias
6. group alias
7. no match → `NEEDS_REVIEW`

Confidence guideline:

- `CHANNEL_ID`: `0.95`
- `TITLE`: `0.80`
- `DESCRIPTION`: `0.60`
- `CHANNEL_TITLE`: `0.55`
- `GROUP_ALIAS`: `0.40`
- `UNKNOWN`: `0.0`
- `MANUAL`: `1.0`

Group alias seed:

- `STELLIVE`
- `StelLive`
- `Universe`
- `Cliche`
- `Cliché`
- `Mystic`
- `Everys`

Group behavior:

- 개별 멤버 alias가 동시에 감지되면 개별 멤버 row를 우선 생성.
- group alias만 감지되면 가능한 소속 멤버 전체를 `role=group`, `source=GROUP_ALIAS`, 낮은 confidence로 연결하고 `NEEDS_REVIEW`.
- group membership은 seed helper로 분리해 후속 변경 가능하게 둔다.

## Sync Service Changes

현재 `syncAllMusic(mode)`는 활성 `SourcePlaylist`를 순회한다. 다음 전용 wrapper를 추가한다.

### syncOfficialStelliveMusicPlaylists()

역할:

- 공식 Cover/Original playlist seed를 DB에 upsert.
- active official source playlist 2개만 대상으로 full sync 실행.
- 기존에 멤버별 playlist source row가 있더라도 이 함수에서는 무시.
- playlistItems 전체 pagination.
- unique videoId dedupe.
- videos.list 상세 조회.
- DB upsert.
- manual override 적용.
- source mapping 보존.
- sync summary 반환.

반환:

- `totalPlaylistItems`
- `uniqueVideos`
- `inserted`
- `updated`
- `unavailable`
- `needsReview`
- `excludedCandidates`
- `apiCallsEstimated`

동기화 정책:

- 같은 `videoId`는 `MusicItem.youtubeVideoId` 기준 upsert.
- 여러 playlist에 같은 videoId가 있으면 `MusicItemSourcePlaylist`에 모두 기록.
- `cover`와 `original` 충돌 시 `classificationStatus=NEEDS_REVIEW`.
- `MusicItemOverride`가 있으면 forced fields는 자동 sync가 덮어쓰지 않음.
- `fetchedAt` 갱신.
- `videos.list` 누락 video는 `isAvailable=false`, `privacyStatus=UNKNOWN_OR_REMOVED`.

## Public API Changes

현재 `/v1/music` 계열 route를 확장한다.

Query params:

- `type=cover|original|all`
- `memberId`
- `includeGraduated=false`
- `includeInstrumental=false`
- `includeExcluded=false`
- `sort=publishedAtDesc|playlistOrder`
- `limit`
- `cursor`

Default filter:

- `isAvailable=true`
- `isExcluded=false`
- `includeGraduated=false`
- `includeInstrumental=false`

Sort:

- `publishedAtDesc`: latest list default.
- `playlistOrder`: official playlist position order.

Response additions:

- `durationSeconds`
- `isInstrumental`
- `specialFlags`
- `classificationStatus` only if needed by admin/debug; public default may omit review internals.

## Admin/Internal API Changes

기존 internal route:

- `POST /v1/internal/schedulers/music/sync`

추가:

- `POST /v1/internal/schedulers/music/sync-official-playlists`
  - `syncOfficialStelliveMusicPlaylists()` 호출.
- `GET /v1/internal/music/review`
  - `NEEDS_REVIEW`, excluded candidate, conflict rows 조회.
- `PATCH /v1/internal/music/videos/:videoId/override`
  - manual override 저장.
- `GET /v1/internal/music/sync-log`
  - `MusicSyncRun` 최근 기록.
- `GET /v1/internal/music/quota-estimate`
  - source playlist count/page estimate 기반 계산.

관리자 UI route `/admin/music/*`는 후속 console 작업으로 분리 가능하다. MVP에서는 internal JSON API부터 구현한다.

## Environment Changes

기존:

- `YOUTUBE_API_KEY`
- `MUSIC_SYNC_ENABLED`
- `MUSIC_CACHE_TTL_SECONDS`
- `MUSIC_CACHE_STALE_SECONDS`
- `MUSIC_SYNC_LOCK_SECONDS`
- `MUSIC_LIGHT_SYNC_MAX_PAGES`

추가:

- `STELLIVE_MUSIC_SYNC_INTERVAL_MINUTES=60`
- `STELLIVE_MUSIC_COVER_PLAYLIST_ID=PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy`
- `STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID=PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX`
- `STELLIVE_MUSIC_INCLUDE_GRADUATED_DEFAULT=false`
- `STELLIVE_MUSIC_INCLUDE_INSTRUMENTAL_DEFAULT=false`

Playlist IDs는 요구사항에서 공식 대상이 명시되었으므로 환경 변수 default 또는 seed constant로 둘 수 있다. 운영 유연성을 위해 env override 가능하게 두는 것을 권장한다.

## Seed Data Plan

### Active member seed

활동 멤버 10명:

- 아야츠노 유니 / Ayatsuno Yuni / Yuni
- 사키하네 후야 / Sakihane Huya / Huya
- 시라유키 히나 / Shirayuki Hina / Hina
- 네네코 마시로 / Neneko Mashiro / Mashiro
- 아카네 리제 / Akane Lize / Lize
- 아라하시 타비 / Arahashi Tabi / Tabi
- 텐코 시부키 / Tenko Shibuki / Shibuki
- 아오쿠모 린 / Aokumo Rin / AoKumo Rin / Rin
- 유즈하 리코 / Yuzuha Riko / Riko
- 하나코 나나 / Hanako Nana / Nana

### Graduated seed structure

- `musicGraduatedMemberSeeds.ts` 또는 별도 JSON seed 파일만 생성.
- MVP 기본 seed 실행에는 포함하지 않음.
- DB model은 `isGraduated=true` row를 허용.

### Group alias seed

- `STELLIVE`
- `StelLive`
- `Universe`
- `Cliche`
- `Cliché`
- `Mystic`
- `Everys`

## Testing Plan

변경된 코드에 필요한 focused tests만 수행한다.

### Unit tests

- `musicClassifier.test.ts`
  - ISO-8601 duration parsing.
  - title normalization.
  - instrumental detection.
  - shorts/teaser exclusion candidate detection.
  - medley/mashup/OST/remix flags.
  - duration threshold flags:
    - `<60s` → needs review.
    - `<90s` → short/preview candidate.
    - `>15m` → live/long-form candidate.
- `musicMemberMatcher.test.ts`
  - channelId match.
  - title alias match.
  - description alias match.
  - channelTitle alias match.
  - collab title with `x`, `X`, `&`.
  - group alias low confidence/group role.
  - no match → unknown/review.
- `musicOverride.test.ts`
  - manual override wins over automatic sync.
  - forced excluded row hidden from public API default.
  - forced members create `source=MANUAL`.
- `musicYoutubeDataApiClient.test.ts`
  - `playlistItems.list` uses `snippet,contentDetails,status`.
  - playlist item metadata normalized.
  - `videos.list` extra status/content fields normalized.
  - quota/403 no immediate retry.
  - retry only for network/5xx.

### Service tests

- `musicOfficialPlaylistSyncService.test.ts`
  - official cover/original source playlists are upserted.
  - duplicate videoId dedupes into one `MusicItem`.
  - duplicate source mappings preserved.
  - cover/original conflict → `NEEDS_REVIEW`.
  - videos.list missing video → unavailable row.
  - manual override fields not overwritten.
  - summary counts returned.

### Route tests

- `musicRoutes.test.ts`
  - `includeGraduated=false` default.
  - `includeInstrumental=false` default.
  - `includeExcluded=false` default.
  - `sort=publishedAtDesc`.
  - `sort=playlistOrder`.
- `musicInternalRoutes.test.ts`
  - official playlist sync route protected.
  - invalid override body rejected.
  - override route does not leak API key.
  - review route returns review candidates.

## Implementation Order

1. Inventory existing music source playlist flow.
   - If it loops over every member playlist ID, mark that path deprecated for official music catalog sync.
   - Ensure no public music API depends on member playlist rows as primary source.
2. Extend Prisma schema and repository ports.
3. Add migration/db push verification for new music fields/tables.
4. Add official playlist seed/upsert helper.
5. Replace official music sync entrypoint to use only the 2 official playlist IDs.
6. Extend YouTube client DTOs and tests.
7. Add classifier helpers and tests.
8. Extend member matcher confidence/source/group alias behavior.
9. Add manual override model/repository and tests.
10. Add official playlist sync wrapper and source mapping handling.
11. Extend public music route filters/sort.
12. Add internal review/override/quota/sync-official endpoints.
13. Update env example, README, API_SETUP, CODEMAP, AI_HANDOFF.
14. Server rollout:
    - sync files.
    - rebuild containers.
    - `prisma db push` or migration.
    - verify env.
    - run official playlist full sync once.
    - check `/v1/music?type=cover` and member route.

## Completion Criteria

- 관리자/internal 명령으로 공식 cover/original playlist 2개를 동기화할 수 있다.
- DB에 `videoId` 기준으로 중복 없이 저장된다.
- 여러 source playlist 발견 이력이 mapping table에 보존된다.
- cover/original 타입은 playlist 기준으로 저장된다.
- type conflict는 `NEEDS_REVIEW`가 된다.
- 멤버별 조회 API가 동작한다.
- 콜라보 곡은 여러 멤버에게 동시에 연결된다.
- Inst., Shorts, Teaser, Live Clip, 메들리, Mashup, OST, Remix 후보가 flag/review/exclusion 상태로 남는다.
- manual override가 자동 sync보다 우선한다.
- 클라이언트 기본 응답은 `isAvailable=true`, `isExcluded=false`, `includeGraduated=false`, `includeInstrumental=false`.
- 변경 범위 focused tests와 backend build가 통과한다.

## Out of Scope

- 멤버별 개인 playlist 수집. 기존에 구현되어 있더라도 official music catalog sync에서는 사용하지 않고 공식 playlist 2개로 대체한다.
- 공식 MUSIC 웹페이지 scraping.
- 관리자 HTML console 구현.
- 모바일 UI 변경.
- YouTube OAuth.
- `search.list` 기반 탐색.
