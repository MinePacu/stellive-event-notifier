# Stellive Music YouTube Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-only YouTube Data API v3 music synchronization pipeline for 10 Stellive members' cover and original songs, cache normalized data on the backend, and expose it through backend REST APIs without client-side YouTube API access.

**Architecture:** Clients read only backend REST APIs. The backend serves Redis-or-memory cached responses from PostgreSQL-normalized music tables; scheduled/internal sync workers call YouTube Data API v3 using server-side API keys and update DB state. User requests never call YouTube directly and stale cached/DB data remains available during sync failures or quota exhaustion.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, ioredis/Redis with memory fallback, Zod env parsing, Vitest, YouTube Data API v3 with API Key, existing internal bearer-token admin routes.

---

## Scope And Current Project Analysis

The repository already has a Fastify backend in `backend/stellive-hub-api`, Prisma/PostgreSQL persistence, Redis dependency, internal scheduler routes, shared DTO schemas, OpenAPI docs, and a first-pass song page implementation.

Existing relevant files:

- `backend/stellive-hub-api/src/app.ts` wires backend services, repositories, YouTube WebSub, and current song backfill scheduler.
- `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts` already has a bounded client for `channels.list`, `playlistItems.list`, and `videos.list`.
- `backend/stellive-hub-api/src/songs/songBackfillService.ts` currently syncs channel upload playlists by member channel, not curated MUSIC category playlists.
- `backend/stellive-hub-api/src/songs/songIngestionService.ts` classifies from title markers and writes a single-member `Song`.
- `backend/stellive-hub-api/src/repositories/songRepository.ts` currently supports basic list/upsert and returns placeholder facets.
- `backend/stellive-hub-api/prisma/schema.prisma` already has `Song`, `YoutubeChannelState`, `WebhookSubscription`, `PlatformApiState`, and notification/job tables.
- `shared/member-catalog/members.seed.json` is the canonical member catalog source and already contains active/upcoming policy constraints.
- `shared/schemas/domain.ts`, `shared/schemas/mobileApi.ts`, and `shared/openapi/openapi.yaml` define cross-client contracts.

Important current gaps relative to this plan:

- Existing `Song` is single-member and cannot model duet/unit/group songs.
- Existing classification is title-marker based; requested behavior should prioritize source playlist type.
- Existing sync targets channel upload playlists; requested behavior should sync curated source playlists such as COVER, SINGLE, EP, and selected OTHERS.
- Existing public song API is `/v1/songs`; requested examples use `/api/music`. This project should keep `/v1` route style and may add compatibility aliases only if needed.
- Existing `facets()` implementation is still a 0-count fallback and must be replaced by DB aggregation.
- Redis is available as a dependency, but there is no dedicated response-cache service yet.

## Design Decision

Use a playlist-first design.

The MVP should sync administrator-defined public YouTube playlists rather than trying to infer official MUSIC categories from arbitrary channel uploads. Each playlist is stored in `SourcePlaylist` with an explicit type:

- `cover` for COVER playlists.
- `original` for SINGLE and EP playlists.
- `other` for OTHERS or verification playlists.

This gives deterministic classification, lower quota cost, and easy auditability. Title/description/alias matching becomes member-association assistance, not the primary category source.

Rejected alternatives:

1. Channel uploads + title classifier only: cheap, but misses category truth and creates false positives.
2. `search.list`: flexible, but quota-expensive and explicitly outside the default sync path.
3. Client-side YouTube calls: violates the server-mediated/API-first boundary and leaks quota/API-key concerns to clients.

## Target Members

The MVP member set is exactly these 10 active member IDs from the catalog. The implementation must resolve these from `shared/member-catalog/members.seed.json` and must not add Former members.

| Korean name | Expected catalog id |
| --- | --- |
| 아야츠노 유니 | `ayatsuno-yuni` |
| 사키하네 후야 | `sakihane-fuya` |
| 시라유키 히나 | `shirayuki-hina` |
| 네네코 마시로 | `neneko-mashiro` |
| 아카네 리제 | `akane-lize` |
| 아라하시 타비 | `arahashi-tabi` |
| 텐코 시부키 | `tenko-shibuki` |
| 아오쿠모 린 | `aokumo-rin` |
| 유즈하 리코 | `yuzuha-riko` |
| 하나코 나나 | `hanako-nana` |

If a catalog ID differs in the current seed, use the existing catalog ID and record the mapping in tests. Do not create duplicate member rows.

## Environment Variables

Modify `backend/stellive-hub-api/src/config/env.ts` and `backend/stellive-hub-api/.env.example`.

Required/optional variables:

```env
YOUTUBE_API_KEY=
YOUTUBE_API_BASE_URL=https://www.googleapis.com/youtube/v3
MUSIC_CACHE_TTL_SECONDS=600
MUSIC_CACHE_STALE_SECONDS=1800
MUSIC_CACHE_REVALIDATE_LOCK_SECONDS=30
LIGHT_SYNC_INTERVAL_MINUTES=10
FULL_SYNC_INTERVAL_MINUTES=60
DAILY_RECONCILE_CRON=0 4 * * *
MUSIC_LIGHT_SYNC_MAX_PAGES=2
MUSIC_SYNC_ENABLED=false
REDIS_URL=
ADMIN_SYNC_TOKEN=
```

Notes:

- Keep `INTERNAL_API_TOKEN` as the main internal route bearer token, unless a separate `ADMIN_SYNC_TOKEN` is explicitly needed for a narrower manual sync endpoint.
- `YOUTUBE_API_KEY` must remain backend-only.
- `YOUTUBE_API_BASE_URL` allows test injection and future regional/base URL changes.
- Use existing `YOUTUBE_DATA_API_FALLBACK_ENABLED` only for the current song fallback until replaced; avoid overloading it with the new music playlist sync semantics.

## Data Model

Implement new normalized models rather than stretching the existing single-member `Song` table.

### Prisma models

Add or migrate to these models in `backend/stellive-hub-api/prisma/schema.prisma`:

```prisma
model MusicMember {
  id               String   @id
  nameKo           String
  nameEn           String
  aliases          Json
  youtubeChannelId String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  itemLinks        MusicItemMember[]

  @@index([youtubeChannelId])
}

model SourcePlaylist {
  id                String   @id @default(cuid(2))
  youtubePlaylistId String   @unique
  title             String
  type              String
  memberId          String?
  isActive          Boolean  @default(true)
  lastSyncedAt      DateTime?
  lastSuccessfulSyncAt DateTime?
  lastSyncError     String?
  etag              String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  items             MusicItem[]

  @@index([type, isActive])
  @@index([memberId])
}

model MusicItem {
  id               String   @id @default(cuid(2))
  youtubeVideoId   String   @unique
  title            String
  description      String?
  type             String
  sourcePlaylistId String?
  publishedAt      DateTime?
  thumbnailUrl     String?
  thumbnailWidth   Int?
  thumbnailHeight  Int?
  duration         String?
  channelId        String?
  channelTitle     String?
  isPublic         Boolean  @default(true)
  lastSeenAt       DateTime
  missingCount     Int      @default(0)
  playlistPosition Int?
  rawCategoryHint  String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  sourcePlaylist   SourcePlaylist? @relation(fields: [sourcePlaylistId], references: [id])
  members          MusicItemMember[]

  @@index([type])
  @@index([publishedAt])
  @@index([sourcePlaylistId])
  @@index([isPublic])
}

model MusicItemMember {
  musicItemId String
  memberId    String
  role        String   @default("unknown")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  musicItem   MusicItem   @relation(fields: [musicItemId], references: [id], onDelete: Cascade)
  member      MusicMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@id([musicItemId, memberId])
  @@index([memberId])
  @@index([role])
}

model MusicSyncRun {
  id            String   @id @default(cuid(2))
  syncType      String
  source        String
  sourcePlaylistId String?
  startedAt     DateTime
  finishedAt    DateTime?
  status        String   @default("running")
  quotaUnits    Int      @default(0)
  fetchedCount  Int      @default(0)
  insertedCount Int      @default(0)
  updatedCount  Int      @default(0)
  missingCount  Int      @default(0)
  errorMessage  String?
  metadata      Json?
  createdAt     DateTime @default(now())

  @@index([syncType, startedAt])
  @@index([sourcePlaylistId, startedAt])
  @@index([status])
}
```

### Existing `Song` migration strategy

Keep the existing `Song` table during migration to avoid breaking current mobile work. Implement the new API from `MusicItem`. After clients move to the new contract, either:

- retire `Song`, or
- maintain `/v1/songs` as a read adapter over `MusicItem`.

Do not duplicate sync writes to both tables unless compatibility requires it.

## Source Playlist Seed Strategy

Create an explicit backend seed/config file for source playlists:

- `backend/stellive-hub-api/src/music/musicSourcePlaylists.ts`

Responsibilities:

- Define known official/public source playlists by YouTube playlist ID.
- Map source type to `cover | original | other`.
- Represent SINGLE and EP as `original`.
- Represent OTHERS as `other` by default, with per-playlist or per-item override support for original-like songs.
- Allow nullable `memberId` for group/shared playlists.
- Avoid hardcoding expected item counts.

Example shape:

```ts
export interface MusicSourcePlaylistSeed {
  youtubePlaylistId: string;
  title: string;
  type: "cover" | "original" | "other";
  rawCategoryHint: "COVER" | "SINGLE" | "EP" | "OTHERS";
  memberId?: string;
  isActive: boolean;
}
```

The first implementation should require playlist IDs from config/admin seed, not scrape the official MUSIC page.

## YouTube API Client Design

Refactor or extend `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts`.

### Required functions

```ts
fetchPlaylistItems(input: {
  playlistId: string;
  maxPages?: number;
  pageToken?: string;
  etag?: string;
}): Promise<{
  status: "ok" | "not_modified";
  items: Array<{
    videoId: string;
    title?: string;
    publishedAt?: string;
    position?: number;
    thumbnailUrl?: string;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
  }>;
  pagesFetched: number;
  quotaUnits: number;
  etag?: string;
  nextPageToken?: string;
}>
```

Rules:

- Call `playlistItems.list`.
- Use `part=snippet,contentDetails`.
- Use `maxResults=50`.
- Follow `nextPageToken` until absent or `maxPages` reached.
- Send `If-None-Match` only on the first page when an ETag exists.
- Return `not_modified` for HTTP 304.
- Do not call `search.list`.

```ts
fetchVideos(videoIds: string[]): Promise<{
  items: Array<{
    videoId: string;
    title: string;
    description?: string;
    publishedAt?: string;
    thumbnailUrl?: string;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    duration?: string;
    channelId?: string;
    channelTitle?: string;
    privacyStatus?: string;
  }>;
  quotaUnits: number;
}>
```

Rules:

- Call `videos.list`.
- Use `part=snippet,contentDetails,status`.
- Chunk IDs by 50.
- Preserve only normalized fields.
- Treat missing videos as absent, not fatal.

## Sync Service Design

Create a new music sync module instead of expanding the current channel-upload song backfill too far.

Files:

- `backend/stellive-hub-api/src/music/musicSyncService.ts`
- `backend/stellive-hub-api/src/music/musicClassifier.ts`
- `backend/stellive-hub-api/src/music/musicMemberMatcher.ts`
- `backend/stellive-hub-api/src/repositories/musicRepository.ts`
- `backend/stellive-hub-api/src/repositories/musicSyncRunRepository.ts`

### Classification

Primary classification:

- `SourcePlaylist.type=cover` => `MusicItem.type=cover`
- `SourcePlaylist.type=original` => `MusicItem.type=original`
- `SourcePlaylist.rawCategoryHint=SINGLE | EP` => `original`
- `SourcePlaylist.rawCategoryHint=COVER` => `cover`
- `SourcePlaylist.rawCategoryHint=OTHERS` => `other` unless an admin override marks the item original
- unknown source => `unknown`

Title marker classification may be used only as a secondary diagnostic, not as the default category source.

### Member matching

Rules:

1. If the source playlist has `memberId`, link that member with role `main`.
2. If title/description/channel metadata contains known aliases, add matched members with role `collaboration` unless already linked.
3. If aliases match 3+ target members or a configured group marker, support role `group`.
4. If no member is found, store the item but link no members and flag it in sync diagnostics.

### syncSourcePlaylist

```ts
syncSourcePlaylist(input: {
  sourcePlaylistId: string;
  mode: "light" | "full" | "manual" | "websub";
  maxPages?: number;
  triggeredBy?: string;
}): Promise<MusicSyncResult>
```

Behavior:

- Acquire a per-playlist lock before calling YouTube.
- Light mode fetches only the first `MUSIC_LIGHT_SYNC_MAX_PAGES` pages.
- Full/manual mode fetches all pages until `nextPageToken` is absent.
- Use `videos.list` only for video IDs that are new, changed, missing required details, or need status verification.
- Upsert `MusicItem` by `youtubeVideoId`.
- Upsert `MusicItemMember` links.
- Update `lastSeenAt` for visible items.
- For full sync only, mark existing items under that source that were not seen:
  - increment `missingCount`
  - set `isPublic=false` only after a threshold such as 2 consecutive misses or when `videos.list` confirms non-public/missing
  - never hard-delete in automated sync
- Write a `MusicSyncRun` row with quota and counts.

### syncAllMusic

```ts
syncAllMusic(input: {
  mode: "light" | "full" | "daily" | "manual";
  sourcePlaylistIds?: string[];
  triggeredBy?: string;
}): Promise<MusicSyncAllResult>
```

Behavior:

- Load active `SourcePlaylist` rows.
- Continue when one source fails.
- Record each source failure in `MusicSyncRun`.
- Return aggregate counts.
- Use exponential backoff for transient HTTP/network failures.
- Do not retry quota 403 in a tight loop; mark run as `quota_exhausted` or `youtube_forbidden` and stop that source.

## Cache Layer

Create `backend/stellive-hub-api/src/cache/responseCache.ts`.

Responsibilities:

- Provide Redis-backed cache when `REDIS_URL` is configured.
- Provide process memory fallback for local/test mode.
- Store serialized API responses by normalized request key.
- TTL default: `MUSIC_CACHE_TTL_SECONDS=600`.
- Stale window default: `MUSIC_CACHE_STALE_SECONDS=1800`.
- Lock default: `MUSIC_CACHE_REVALIDATE_LOCK_SECONDS=30`.

API shape:

```ts
getOrSetStaleWhileRevalidate<T>(input: {
  key: string;
  ttlSeconds: number;
  staleSeconds: number;
  lockSeconds: number;
  loadFresh: () => Promise<T>;
}): Promise<{
  value: T;
  cacheStatus: "hit" | "stale" | "miss";
}>
```

Important point: public API cache refresh must read DB only. It must not call YouTube. Sync workers are the only YouTube callers.

Stampede prevention:

- If fresh entry exists, return it.
- If stale entry exists and lock is acquired, return stale immediately and refresh DB response in background.
- If stale entry exists and lock is not acquired, return stale.
- If no entry exists, one request acquires lock and reads DB; concurrent requests wait briefly or return a small empty/fallback DB response.
- Cache keys must include path, normalized query params, and API version.

## Public API Routes

Follow the existing `/v1` route convention. Add new music routes and keep `/v1/songs` compatibility only if mobile code still needs it.

Create:

- `backend/stellive-hub-api/src/routes/musicRoutes.ts`
- `backend/stellive-hub-api/src/music/musicDto.ts`

Routes:

```text
GET /v1/music
query:
- type=cover|original|other|all
- memberId=
- limit=1..50
- cursor=
- sort=publishedAt_desc

GET /v1/members
GET /v1/members/:id/music
GET /v1/music/:id
```

Response item minimum:

```json
{
  "id": "music-item-id",
  "youtubeVideoId": "abc123",
  "title": "Song title",
  "type": "cover",
  "publishedAt": "2026-06-22T00:00:00.000Z",
  "thumbnailUrl": "https://i.ytimg.com/...",
  "duration": "PT3M21S",
  "members": [
    { "id": "akane-lize", "nameKo": "아카네 리제", "role": "main" }
  ],
  "youtubeUrl": "https://www.youtube.com/watch?v=abc123"
}
```

Rules:

- API handlers read from cache/DB only.
- Never call YouTube in route handlers.
- Apply `Cache-Control: private, max-age=300, stale-while-revalidate=600` or equivalent.
- Return stale data on DB/cache refresh errors when available.
- Expose `cacheStatus` only in debug/admin metadata, not necessarily in public DTO.

## Admin And Internal Routes

Modify `backend/stellive-hub-api/src/routes/internalRoutes.ts`.

Add protected routes:

```text
POST /v1/internal/schedulers/music/light-sync
POST /v1/internal/schedulers/music/full-sync
POST /v1/internal/schedulers/music/daily-reconcile
POST /v1/internal/music/sync
GET /v1/internal/music/sync-runs
GET /v1/internal/music/quota-estimate
```

Manual sync request:

```json
{
  "mode": "light",
  "sourcePlaylistIds": ["playlist-row-id"],
  "reason": "manual verification"
}
```

Security:

- Use existing `INTERNAL_API_TOKEN` bearer authentication.
- If `ADMIN_SYNC_TOKEN` is added, support it only for sync endpoints and keep it backend/operator-only.
- Do not accept YouTube API keys, playlist secrets, or raw provider responses from clients.

## Scheduler / Worker Integration

Initial implementation can use internal endpoints called by cron/systemd/external scheduler, matching the existing backend pattern. Dedicated always-on worker files can be added after the API path is stable.

Create optional worker entrypoints:

- `backend/stellive-hub-api/src/workers/musicLightSyncWorker.ts`
- `backend/stellive-hub-api/src/workers/musicFullSyncWorker.ts`
- `backend/stellive-hub-api/src/workers/musicDailyReconcileWorker.ts`

Docker Compose can later run them as separate services. MVP can run scheduler externally against protected internal routes.

## Daily Reconciliation Extension

Create:

- `backend/stellive-hub-api/src/music/musicReconciliationService.ts`

MVP behavior:

- Compare configured `SourcePlaylist` rows and DB `MusicItem` rows.
- Report category mismatches, member-link gaps, missing playlist IDs, duplicate video IDs, and OTHERS items needing review.
- Store result summary in `MusicSyncRun.metadata`.

Future extension:

- Add an official MUSIC page verification adapter only if it is allowed by policy and does not require unauthorized crawling.
- The adapter should output normalized references, not raw page snapshots.

## WebSub Extension Point

Keep current WebSub route but route events into the music sync model.

Flow for future implementation:

1. Receive YouTube upload WebSub event.
2. Parse `videoId` and `channelId`.
3. Call `videos.list` for that video ID.
4. Identify candidate source playlists by member/channel or configured mapping.
5. Enqueue or trigger light sync for related cover/original playlists.
6. Upsert only after the video appears in a configured source playlist, unless policy later allows upload-only pending items.

This avoids classifying every channel upload as a song.

## Quota Accounting

Add quota tracking to every YouTube client result and every `MusicSyncRun`.

Formula:

```text
daily quota ~= source_playlist_count × playlist_pages_per_source × sync_count_per_day
            + ceil(video_ids_needing_detail / 50) × sync_count_per_day
```

Current expected scale if source playlists are shared by category:

- COVER about 228 items => about 5 `playlistItems.list` pages.
- SINGLE + EP about 22 items => about 1 page.
- `videos.list` details for about 257 items => about 6 chunks if all refreshed.
- Full sync about 12 units.
- Hourly full sync about 288 units/day.
- 10-minute light sync should stay around 1,000 units/day or lower depending on source count and detail refresh policy.

Do not hardcode these item counts. Log actual pages fetched, video detail chunks, and quota units.

## File Change List

### Backend schema and config

- Modify: `backend/stellive-hub-api/prisma/schema.prisma`
  - Add `MusicMember`, `SourcePlaylist`, `MusicItem`, `MusicItemMember`, `MusicSyncRun`.
  - Keep existing `Song` temporarily for compatibility.
- Modify: `backend/stellive-hub-api/src/config/env.ts`
  - Add music cache, sync interval, API base URL, and sync feature flags.
- Modify: `backend/stellive-hub-api/.env.example`
  - Document empty/non-secret music sync variables.

### Backend YouTube and music domain

- Modify: `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts`
  - Add playlist-first `fetchPlaylistItems` and `fetchVideos` APIs.
- Create: `backend/stellive-hub-api/src/music/musicSourcePlaylists.ts`
  - Seed/config definitions for COVER, SINGLE, EP, OTHERS source playlists.
- Create: `backend/stellive-hub-api/src/music/musicClassifier.ts`
  - Source-playlist-first category mapping.
- Create: `backend/stellive-hub-api/src/music/musicMemberMatcher.ts`
  - Alias/member matching and N:M link role selection.
- Create: `backend/stellive-hub-api/src/music/musicSyncService.ts`
  - `syncSourcePlaylist` and `syncAllMusic`.
- Create: `backend/stellive-hub-api/src/music/musicReconciliationService.ts`
  - Daily mismatch diagnostics.
- Create: `backend/stellive-hub-api/src/music/musicDto.ts`
  - Public response mapping.

### Backend repositories and cache

- Create: `backend/stellive-hub-api/src/repositories/musicRepository.ts`
  - Music item/member/source playlist read/write queries.
- Create: `backend/stellive-hub-api/src/repositories/musicSyncRunRepository.ts`
  - Sync run lifecycle logging.
- Create: `backend/stellive-hub-api/src/cache/responseCache.ts`
  - Redis/memory stale-while-revalidate response cache and lock helper.
- Modify: `backend/stellive-hub-api/src/app.ts`
  - Wire repositories, cache, music sync service, and routes.
- Modify: `backend/stellive-hub-api/src/routes/routes.ts`
  - Register public music routes.

### Backend routes and workers

- Create: `backend/stellive-hub-api/src/routes/musicRoutes.ts`
  - `GET /v1/music`, `GET /v1/music/:id`, `GET /v1/members`, `GET /v1/members/:id/music`.
- Modify: `backend/stellive-hub-api/src/routes/internalRoutes.ts`
  - Add protected manual/scheduled music sync routes and diagnostics.
- Optional create: `backend/stellive-hub-api/src/workers/musicLightSyncWorker.ts`
- Optional create: `backend/stellive-hub-api/src/workers/musicFullSyncWorker.ts`
- Optional create: `backend/stellive-hub-api/src/workers/musicDailyReconcileWorker.ts`

### Shared contracts and docs

- Modify: `shared/schemas/domain.ts`
  - Add `MusicItemType`, `MusicMemberRole`, and public music DTO support if shared typing remains centralized.
- Modify: `shared/schemas/mobileApi.ts`
  - Add music list/detail/member response DTOs or replace current song DTOs.
- Modify: `shared/openapi/openapi.yaml`
  - Document public music routes and internal sync routes.
- Modify: `README.md`
  - Add setup variables, sync policy, quota assumptions, and manual sync examples.
- Modify: `CODEMAP.md`
  - Add new files after implementation.

### Tests

- Create: `backend/stellive-hub-api/test/musicYoutubeDataApiClient.test.ts`
- Create: `backend/stellive-hub-api/test/musicClassifier.test.ts`
- Create: `backend/stellive-hub-api/test/musicMemberMatcher.test.ts`
- Create: `backend/stellive-hub-api/test/musicRepository.test.ts`
- Create: `backend/stellive-hub-api/test/musicSyncService.test.ts`
- Create: `backend/stellive-hub-api/test/responseCache.test.ts`
- Create: `backend/stellive-hub-api/test/musicRoutes.test.ts`
- Create: `backend/stellive-hub-api/test/musicInternalRoutes.test.ts`
- Create: `backend/stellive-hub-api/test/musicReconciliationService.test.ts`

## Implementation Tasks

### Task 1: Contract and schema baseline

- [ ] Add failing tests for shared music DTOs and allowed type values.
- [ ] Add Prisma models for music sync.
- [ ] Run `rtk npm run prisma:generate`.
- [ ] Update shared DTOs and OpenAPI.
- [ ] Run `rtk npm test -- mobileSongsContract` or a new `musicContracts` focused test.
- [ ] Run `rtk npm run build`.

### Task 2: Source playlist config and member seed mapping

- [ ] Add `musicSourcePlaylists.ts` with active source playlist definitions.
- [ ] Add tests proving only the 10 target members are used.
- [ ] Add tests proving Former, `gamja`, `official`, and `gen4-upcoming` are excluded.
- [ ] Add a repository method to upsert configured source playlists.

### Task 3: YouTube playlist client

- [ ] Add failing tests for `playlistItems.list` pagination, ETag, 304, and page cap.
- [ ] Add failing tests for `videos.list` 50-ID chunking and normalized metadata.
- [ ] Implement `fetchPlaylistItems` and `fetchVideos`.
- [ ] Verify no test or source path calls `search.list`.
- [ ] Run `rtk npm test -- musicYoutubeDataApiClient youtubeDataApiClient`.

### Task 4: Music classifier and member matcher

- [ ] Add tests for COVER => cover, SINGLE/EP => original, OTHERS => other unless override.
- [ ] Add tests for source member priority, alias collaboration matching, and multi-member links.
- [ ] Implement `musicClassifier.ts` and `musicMemberMatcher.ts`.
- [ ] Run `rtk npm test -- musicClassifier musicMemberMatcher`.

### Task 5: Music repository

- [ ] Add tests for upsert by `youtubeVideoId`.
- [ ] Add tests for N:M member links and roles.
- [ ] Add tests for list filters: type, memberId, cursor, publishedAt sort.
- [ ] Add tests for full-sync missing handling without hard delete.
- [ ] Implement `musicRepository.ts`.
- [ ] Run `rtk npm test -- musicRepository`.

### Task 6: Sync service and sync run logging

- [ ] Add tests for light sync fetching only 1-2 pages.
- [ ] Add tests for full sync reading all pages until no `nextPageToken`.
- [ ] Add tests for `videos.list` detail enrichment only when needed.
- [ ] Add tests for partial source failure not stopping `syncAllMusic`.
- [ ] Add tests for quota/403 no tight retry behavior.
- [ ] Implement `musicSyncService.ts` and `musicSyncRunRepository.ts`.
- [ ] Run `rtk npm test -- musicSyncService`.

### Task 7: Cache service

- [ ] Add tests for fresh hit, stale hit, miss, and lock contention.
- [ ] Add tests proving `loadFresh` is called once under concurrent miss.
- [ ] Implement Redis-backed cache with memory fallback.
- [ ] Run `rtk npm test -- responseCache`.

### Task 8: Public music routes

- [ ] Add route tests for `GET /v1/music` filters and cache headers.
- [ ] Add route tests for `GET /v1/members`.
- [ ] Add route tests for `GET /v1/members/:id/music`.
- [ ] Add route tests for `GET /v1/music/:id`.
- [ ] Assert route handlers use repository/cache only and not YouTube client.
- [ ] Implement `musicRoutes.ts` and register it.
- [ ] Run `rtk npm test -- musicRoutes`.

### Task 9: Internal/manual sync routes

- [ ] Add tests for bearer auth.
- [ ] Add tests for manual sync body validation.
- [ ] Add tests for light/full/daily scheduler delegation.
- [ ] Add tests for sync run diagnostics and quota estimate.
- [ ] Implement internal routes.
- [ ] Run `rtk npm test -- musicInternalRoutes`.

### Task 10: Daily reconciliation and WebSub extension point

- [ ] Add tests for category mismatch diagnostics.
- [ ] Add tests for missing member links.
- [ ] Add tests for OTHERS review candidates.
- [ ] Add tests for WebSub event adapter triggering playlist light sync without classifying all uploads as songs.
- [ ] Implement reconciliation service and WebSub queue/trigger interface.
- [ ] Run `rtk npm test -- musicReconciliationService youtubeWebSubRoutes`.

### Task 11: Documentation and final verification

- [ ] Update `README.md` with env setup, sync policy, quota math, and manual sync commands.
- [ ] Update `docs/API_SETUP.md` YouTube section.
- [ ] Update `CODEMAP.md`.
- [ ] Run targeted backend tests for changed files only.
- [ ] Run `rtk npm run build`.
- [ ] Run policy grep for secrets, raw provider payloads, unofficial crawling, Former members, and prohibited media assets.
- [ ] Record final status in `docs/AI_HANDOFF.md`.

## Verification Commands

Use focused commands while developing each task:

```bash
rtk npm test -- musicYoutubeDataApiClient musicClassifier musicMemberMatcher
rtk npm test -- musicRepository musicSyncService responseCache
rtk npm test -- musicRoutes musicInternalRoutes musicReconciliationService
rtk npm run build
```

Run broader backend tests only after the focused tests pass or when shared contracts/routes change broadly:

```bash
rtk npm test
```

Policy grep before completion:

```bash
rtk rg -n "Former|NID_AUT|NID_SES|cookie scraping|login-cookie|search.list|YOUTUBE_API_KEY=.*[A-Za-z0-9_-]{20}|rawPayload|base64|official logo|fan art" backend shared docs README.md
```

Expected: matches are policy references, tests asserting absence, or safe env variable names without real secret values.

## Self-Review

- Spec coverage: The plan covers server-only YouTube access, API-key env handling, playlist pagination, no `search.list`, N:M music-member modeling, cache/stale policy, light/full/daily sync, manual sync, sync run logging, quota accounting, conservative missing handling, and WebSub extension points.
- Current-project fit: The plan reuses Fastify, Prisma, existing internal auth, Redis dependency, shared schemas, OpenAPI, and current YouTube adapter patterns. It does not require client-side YouTube calls.
- Policy check: The plan excludes Former members, avoids official YouTube live event generation, avoids unauthorized crawling for MVP, stores only normalized metadata/thumbnail URLs, and keeps secrets backend-only.
- Ambiguity resolved: Route style uses `/v1/*` to match the existing backend. `/api/*` examples are treated as product examples, not literal required paths.
- Implementation risk: The main migration risk is replacing single-member `Song` with N:M `MusicItem`. Keeping `Song` temporarily avoids breaking current mobile song work while the new API stabilizes.

