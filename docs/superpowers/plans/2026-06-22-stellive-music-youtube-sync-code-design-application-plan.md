# Stellive Music YouTube Sync Code Design And Application Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Convert the Stellive music YouTube sync architecture into a concrete backend code design and staged application plan that collects cover/original music from curated YouTube playlists, persists normalized N:M music/member data, serves cached REST APIs, and keeps YouTube API calls server-only.

**Architecture:** The backend adds a new music domain beside the existing song skeleton. Public routes read only response cache and PostgreSQL-backed repositories; sync services call YouTube Data API v3 only from protected internal routes or scheduled workers. Existing Song routes remain temporarily compatible while the new MusicItem model becomes the authoritative storage for playlist-first music catalog data.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, ioredis with memory fallback, Zod env parsing, Vitest, shared TypeScript DTOs, OpenAPI, YouTube Data API v3 API-key access.

---

## Source Inputs

- docs/superpowers/plans/2026-06-22-stellive-music-youtube-sync-plan.md
- docs/PROJECT_RULES.md
- docs/NOTIFICATION_POLICY.md
- docs/REALTIME_DELIVERY.md
- docs/API_IMPLEMENTATION_PLAN.md
- docs/AI_HANDOFF.md
- backend/stellive-hub-api/prisma/schema.prisma
- backend/stellive-hub-api/src/app.ts
- backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts
- backend/stellive-hub-api/src/routes/internalRoutes.ts
- backend/stellive-hub-api/src/routes/routes.ts
- backend/stellive-hub-api/src/repositories/songRepository.ts
- shared/member-catalog/members.seed.json
- shared/schemas/domain.ts
- shared/schemas/mobileApi.ts
- shared/openapi/openapi.yaml

## Code Design Summary

Use a new music module instead of continuing to expand the current title-marker Song ingestion path.

Authoritative data flow:

    SourcePlaylist seeds/admin config
      -> MusicSyncService
      -> YoutubeDataApiClient playlistItems.list / videos.list
      -> MusicClassifier and MusicMemberMatcher
      -> MusicRepository
      -> PostgreSQL MusicItem / MusicItemMember / MusicSyncRun
      -> ResponseCache
      -> /v1/music and related public APIs

Public request flow:

    Client
      -> Fastify musicRoutes
      -> ResponseCache getOrSetStaleWhileRevalidate
      -> MusicRepository DB read
      -> DTO mapper
      -> Client

Public routes must not import or call YoutubeDataApiClient. Sync routes and workers may call YouTube only through MusicSyncService.

## Token Usage Minimization Plan

Use this section as execution discipline. It is part of the implementation plan, not optional guidance.

- Always prefix shell commands with rtk.
- Start each task by reading only the exact files listed in that task.
- Use CODEMAP.md before broad file traversal.
- Prefer rtk rg for symbol discovery and rtk read for individual files.
- Use focused test names rather than full suites until the final verification step.
- After changing shared contracts, run only the relevant shared/backend contract tests first.
- After changing routes, run only route tests plus TypeScript build.
- After changing Prisma schema, run prisma generate and repository tests before unrelated tests.
- Avoid large fixture payloads. Test YouTube responses with the minimum official wrapper fields needed: kind, etag, nextPageToken, items.
- Do not paste raw full YouTube API responses into docs or tests.
- Do not run Android/iOS tests for backend-only tasks.
- Do not run full backend test suite after each small task. Use full suite only before handoff or when a shared route/contract break is suspected.
- Review with rtk git diff -- changed paths only.
- Keep new modules small: one file per responsibility, no large multipurpose service files.
- Prefer extending existing YoutubeDataApiClient over creating a second generic YouTube client.
- Keep compatibility adapters thin so they can be deleted later without touching the sync core.

## File Structure

### Shared contracts

- Modify: shared/schemas/domain.ts
  - Add MusicItemType, MusicMemberRole, MusicMemberSummary, MusicCatalogItem, MusicListFilters, MusicListResponse, MusicDetailResponse, MusicMemberMusicResponse.
  - Keep existing Song types until clients are migrated.
- Modify: shared/schemas/mobileApi.ts
  - Export public music API response DTOs if mobile API remains the shared DTO location.
- Modify: shared/openapi/openapi.yaml
  - Document /v1/music, /v1/music/{id}, /v1/members, /v1/members/{id}/music, and internal music sync endpoints.

### Prisma and repositories

- Modify: backend/stellive-hub-api/prisma/schema.prisma
  - Add MusicMember, SourcePlaylist, MusicItem, MusicItemMember, MusicSyncRun.
  - Keep Song and SongClassificationOverride for compatibility during migration.
- Create: backend/stellive-hub-api/src/repositories/musicRepository.ts
  - Own MusicMember, SourcePlaylist, MusicItem, MusicItemMember reads/writes.
- Create: backend/stellive-hub-api/src/repositories/musicSyncRunRepository.ts
  - Own sync run start, finish, fail, and diagnostics list operations.

### YouTube adapter

- Modify: backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts
  - Add fetchPlaylistItems and fetchVideos with page cap, ETag, 304, quota unit accounting, and 50-ID chunks.
  - Keep existing methods for current song backfill until replaced.

### Music domain

- Create: backend/stellive-hub-api/src/music/musicSourcePlaylists.ts
  - Define curated public playlist seeds and target member allowlist.
- Create: backend/stellive-hub-api/src/music/musicClassifier.ts
  - Source-playlist-first classification: COVER cover, SINGLE/EP original, OTHERS other unless override.
- Create: backend/stellive-hub-api/src/music/musicMemberMatcher.ts
  - Link playlist member first, then alias matches from title/description/channel metadata.
- Create: backend/stellive-hub-api/src/music/musicDto.ts
  - Map repository records to public REST DTOs.
- Create: backend/stellive-hub-api/src/music/musicSyncService.ts
  - Implement syncSourcePlaylist and syncAllMusic.
- Create: backend/stellive-hub-api/src/music/musicReconciliationService.ts
  - Produce daily diagnostics for category/member/source mismatches.
- Create: backend/stellive-hub-api/src/music/musicLocks.ts
  - Provide Redis or DB-backed per-source sync locks if not included in cache service.

### Cache

- Create: backend/stellive-hub-api/src/cache/responseCache.ts
  - Redis-backed stale-while-revalidate cache with memory fallback and lock support.

### Routes and app wiring

- Create: backend/stellive-hub-api/src/routes/musicRoutes.ts
  - Public music read APIs.
- Modify: backend/stellive-hub-api/src/routes/internalRoutes.ts
  - Add protected music sync, diagnostics, and quota estimate endpoints.
- Modify: backend/stellive-hub-api/src/routes/routes.ts
  - Register musicRoutes.
- Modify: backend/stellive-hub-api/src/app.ts
  - Wire repositories, cache, music sync service, and route dependencies.
- Modify: backend/stellive-hub-api/src/config/env.ts
  - Add music env variables.
- Modify: backend/stellive-hub-api/.env.example
  - Add non-secret music env names.

### Workers and docs

- Optional create: backend/stellive-hub-api/src/workers/musicLightSyncWorker.ts
- Optional create: backend/stellive-hub-api/src/workers/musicFullSyncWorker.ts
- Optional create: backend/stellive-hub-api/src/workers/musicDailyReconcileWorker.ts
- Modify: README.md
- Modify: docs/API_SETUP.md
- Modify: docs/AI_HANDOFF.md
- Modify: CODEMAP.md

## Data Contract

Music item type values:

    all
    cover
    original
    other
    unknown

Public list filters:

    type: all | cover | original | other
    memberId: catalog member id or omitted
    limit: integer 1..50
    cursor: opaque item cursor
    sort: publishedAt_desc

Public item DTO:

    id: string
    youtubeVideoId: string
    title: string
    type: cover | original | other | unknown
    publishedAt: ISO string or null
    thumbnailUrl: HTTPS string or null
    duration: ISO-8601 YouTube duration or null
    members: array of member summaries
    youtubeUrl: https://www.youtube.com/watch?v=...
    sourcePlaylistId: string or null

Member summary DTO:

    id: string
    nameKo: string
    nameEn: string
    role: main | collaboration | group | unknown

Do not include raw YouTube API response bodies, downloaded thumbnails, image bytes, secrets, or production tokens.

## Database Application Plan

Apply schema in one migration-sized task.

Important design choices:

- MusicMember.id reuses catalog member id, not a separate generated id.
- SourcePlaylist.youtubePlaylistId is unique.
- MusicItem.youtubeVideoId is unique because the same video may appear in multiple source categories; first implementation stores one authoritative type and tracks latest sourcePlaylistId.
- MusicItemMember primary key is musicItemId plus memberId.
- MusicSyncRun logs every source-level sync and aggregate/manual sync metadata.
- Existing Song remains in schema until mobile song route compatibility is resolved.

If a video appears in both cover and original source playlists, MusicClassifier should apply deterministic precedence:

    original > cover > other > unknown

Record the conflict in MusicSyncRun.metadata for daily review.

## Task 1: Shared Music Contract

**Files:**
- Modify: shared/schemas/domain.ts
- Modify: shared/schemas/mobileApi.ts
- Modify: shared/openapi/openapi.yaml
- Test: backend/stellive-hub-api/test/musicContract.test.ts

- [ ] Step 1: Write focused contract tests.
  - Assert music item type values are all, cover, original, other, unknown.
  - Assert public filter type values are all, cover, original, other.
  - Assert member roles are main, collaboration, group, unknown.
  - Assert DTOs do not contain apiKey, rawPayload, bytes, base64, or local file path fields.

- [ ] Step 2: Run RED test.
  - Run from backend/stellive-hub-api: rtk npm test -- musicContract.
  - Expected: FAIL because music contract exports do not exist.

- [ ] Step 3: Add minimal shared types.
  - Add exported const arrays and TypeScript types in shared/schemas/domain.ts.
  - Add response interfaces in shared/schemas/mobileApi.ts.
  - Keep names compact and reusable: MusicCatalogItem, MusicMemberSummary, MusicListResponse, MusicDetailResponse.

- [ ] Step 4: Update OpenAPI.
  - Add public schemas and routes for /v1/music and related member routes.
  - Add internal sync route schemas with protected route notes.

- [ ] Step 5: Run focused verification.
  - Run: rtk npm test -- musicContract.
  - Run: rtk npm run build.
  - Expected: PASS.

## Task 2: Prisma Models And Repository Ports

**Files:**
- Modify: backend/stellive-hub-api/prisma/schema.prisma
- Create: backend/stellive-hub-api/src/repositories/musicRepository.ts
- Create: backend/stellive-hub-api/src/repositories/musicSyncRunRepository.ts
- Test: backend/stellive-hub-api/test/musicRepository.test.ts

- [ ] Step 1: Write repository tests against a mocked Prisma delegate.
  - Upsert MusicMember from catalog ids.
  - Upsert SourcePlaylist by youtubePlaylistId.
  - Upsert MusicItem by youtubeVideoId.
  - Replace MusicItemMember links without duplicates.
  - List by type and memberId.
  - Return cursor pagination ordered by publishedAt desc then id asc.
  - Mark missing items conservatively by incrementing missingCount and not hard deleting.
  - Create, finish, and fail MusicSyncRun.

- [ ] Step 2: Run RED test.
  - Run from backend/stellive-hub-api: rtk npm test -- musicRepository.
  - Expected: FAIL because repository files and Prisma models are missing.

- [ ] Step 3: Add Prisma models.
  - Add MusicMember, SourcePlaylist, MusicItem, MusicItemMember, MusicSyncRun.
  - Keep Song untouched.
  - Add indexes for type, memberId, sourcePlaylistId, publishedAt, status.

- [ ] Step 4: Implement repositories.
  - Keep Prisma access isolated in repository files.
  - Return plain domain records, not Prisma objects.
  - Do not import Fastify or YouTube client from repositories.

- [ ] Step 5: Verify schema and repository.
  - Run: rtk npm run prisma:generate.
  - Run: rtk npm test -- musicRepository.
  - Run: rtk npm run build.
  - Expected: PASS.

## Task 3: Source Playlist Seeds And Member Allowlist

**Files:**
- Create: backend/stellive-hub-api/src/music/musicSourcePlaylists.ts
- Test: backend/stellive-hub-api/test/musicSourcePlaylists.test.ts

- [ ] Step 1: Write source seed tests.
  - Assert every source playlist has youtubePlaylistId, title, type, rawCategoryHint, isActive.
  - Assert type is cover, original, or other.
  - Assert rawCategoryHint SINGLE and EP map to original.
  - Assert target member ids are exactly the 10 requested active members.
  - Assert gamja, official, gen4-upcoming, and Former members are excluded.

- [ ] Step 2: Run RED test.
  - Run: rtk npm test -- musicSourcePlaylists.
  - Expected: FAIL because file does not exist.

- [ ] Step 3: Add seed module.
  - Export TARGET_MUSIC_MEMBER_IDS.
  - Export musicSourcePlaylistSeeds.
  - Leave playlist ID values empty only if they are supplied from environment/admin seed; otherwise require configured IDs in tests that create runtime SourcePlaylist rows.
  - Do not add guessed playlist IDs.

- [ ] Step 4: Run focused verification.
  - Run: rtk npm test -- musicSourcePlaylists.
  - Expected: PASS.

## Task 4: YouTube Playlist Client

**Files:**
- Modify: backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts
- Test: backend/stellive-hub-api/test/musicYoutubeDataApiClient.test.ts

- [ ] Step 1: Write client tests with minimal fixtures.
  - playlistItems.list uses part snippet,contentDetails.
  - maxResults is 50.
  - nextPageToken pagination continues until absent or maxPages reached.
  - If-None-Match is sent only on first page when etag exists.
  - 304 returns not_modified with zero items.
  - videos.list uses part snippet,contentDetails,status.
  - videos.list chunks ids by 50.
  - quotaUnits equals playlist pages plus video detail chunks.

- [ ] Step 2: Run RED test.
  - Run: rtk npm test -- musicYoutubeDataApiClient.
  - Expected: FAIL until new methods exist.

- [ ] Step 3: Implement fetchPlaylistItems and fetchVideos.
  - Reuse existing fetch injection style.
  - Normalize only required fields.
  - Treat HTTP 403 quota/forbidden as typed failure, not generic retryable failure.
  - Do not add search.list.

- [ ] Step 4: Run focused verification.
  - Run: rtk npm test -- musicYoutubeDataApiClient youtubeDataApiClient.
  - Run: rtk npm run build.
  - Expected: PASS.

## Task 5: Classification And Member Matching

**Files:**
- Create: backend/stellive-hub-api/src/music/musicClassifier.ts
- Create: backend/stellive-hub-api/src/music/musicMemberMatcher.ts
- Test: backend/stellive-hub-api/test/musicClassifier.test.ts
- Test: backend/stellive-hub-api/test/musicMemberMatcher.test.ts

- [ ] Step 1: Write classifier tests.
  - COVER source maps to cover.
  - SINGLE source maps to original.
  - EP source maps to original.
  - OTHERS source maps to other unless an override marks original.
  - Unknown source maps to unknown.
  - If the same video appears in multiple sources, precedence is original, cover, other, unknown.

- [ ] Step 2: Write member matcher tests.
  - Source playlist member links as main.
  - Title alias links as collaboration.
  - Description alias links as collaboration.
  - Duplicate alias matches do not create duplicate links.
  - Three or more target member matches can produce group role.
  - No match returns an empty link list plus diagnostic reason.

- [ ] Step 3: Run RED tests.
  - Run: rtk npm test -- musicClassifier musicMemberMatcher.
  - Expected: FAIL because files do not exist.

- [ ] Step 4: Implement classifier and matcher.
  - Keep both files dependency-light.
  - Import catalog-derived aliases through input data, not from global mutable state.
  - Do not infer category from title unless producing diagnostics.

- [ ] Step 5: Run focused verification.
  - Run: rtk npm test -- musicClassifier musicMemberMatcher.
  - Expected: PASS.

## Task 6: Music Sync Service

**Files:**
- Create: backend/stellive-hub-api/src/music/musicSyncService.ts
- Create: backend/stellive-hub-api/src/music/musicLocks.ts
- Modify: backend/stellive-hub-api/src/repositories/musicRepository.ts
- Modify: backend/stellive-hub-api/src/repositories/musicSyncRunRepository.ts
- Test: backend/stellive-hub-api/test/musicSyncService.test.ts

- [ ] Step 1: Write sync tests using fake YouTube and fake repositories.
  - Light sync fetches only MUSIC_LIGHT_SYNC_MAX_PAGES pages.
  - Full sync fetches all pages.
  - New video ids call fetchVideos.
  - Existing items with complete metadata do not always call fetchVideos.
  - Sync upserts item, members, lastSeenAt, sourcePlaylistId, playlistPosition.
  - Full sync marks unseen old rows missing without hard delete.
  - One failed source does not stop syncAllMusic.
  - 403 quota failure stops that source and records a non-retry status.
  - Per-playlist lock prevents duplicate concurrent sync.

- [ ] Step 2: Run RED test.
  - Run: rtk npm test -- musicSyncService.
  - Expected: FAIL because sync service does not exist.

- [ ] Step 3: Implement lock abstraction.
  - Use Redis lock when Redis is configured.
  - Use in-memory lock for tests/local.
  - Return lock_not_acquired without calling YouTube.

- [ ] Step 4: Implement syncSourcePlaylist.
  - Start MusicSyncRun before fetching.
  - Fetch playlist items.
  - Fetch video details only when needed.
  - Classify from SourcePlaylist.
  - Match members.
  - Persist through MusicRepository.
  - Finish or fail MusicSyncRun.

- [ ] Step 5: Implement syncAllMusic.
  - Load active source playlists.
  - Iterate sources with partial failure isolation.
  - Return aggregate counts and quota units.

- [ ] Step 6: Run focused verification.
  - Run: rtk npm test -- musicSyncService musicRepository.
  - Run: rtk npm run build.
  - Expected: PASS.

## Task 7: Response Cache

**Files:**
- Create: backend/stellive-hub-api/src/cache/responseCache.ts
- Test: backend/stellive-hub-api/test/responseCache.test.ts

- [ ] Step 1: Write cache tests.
  - Fresh hit returns cached value.
  - Stale hit returns stale value and starts one refresh.
  - Concurrent stale requests do not all refresh.
  - Miss loads fresh once under concurrent requests.
  - Redis unavailable falls back to memory cache when configured for fallback.
  - loadFresh errors return stale when stale exists.

- [ ] Step 2: Run RED test.
  - Run: rtk npm test -- responseCache.
  - Expected: FAIL because cache service does not exist.

- [ ] Step 3: Implement memory cache first.
  - Keep value envelope: value, freshUntil, staleUntil, createdAt.
  - Add per-key lock map.

- [ ] Step 4: Add Redis adapter.
  - Use ioredis only inside responseCache.ts.
  - Store JSON envelope.
  - Use SET NX EX for locks.
  - Do not log full cached payloads.

- [ ] Step 5: Run focused verification.
  - Run: rtk npm test -- responseCache.
  - Expected: PASS.

## Task 8: Public Music Routes

**Files:**
- Create: backend/stellive-hub-api/src/routes/musicRoutes.ts
- Create: backend/stellive-hub-api/src/music/musicDto.ts
- Modify: backend/stellive-hub-api/src/routes/routes.ts
- Test: backend/stellive-hub-api/test/musicRoutes.test.ts

- [ ] Step 1: Write route tests.
  - GET /v1/music validates type, limit, cursor, sort.
  - GET /v1/music never calls YouTube dependency.
  - GET /v1/music returns cache headers.
  - GET /v1/music/:id returns detail or 404.
  - GET /v1/members returns the 10 target music members.
  - GET /v1/members/:id/music filters by member.
  - Route uses cache key normalized by path and sorted query params.

- [ ] Step 2: Run RED test.
  - Run: rtk npm test -- musicRoutes.
  - Expected: FAIL because music routes are missing.

- [ ] Step 3: Implement DTO mapper.
  - Build youtubeUrl from youtubeVideoId.
  - Include normalized members.
  - Do not include raw response, secrets, local paths, or image bytes.

- [ ] Step 4: Implement routes.
  - Depend on MusicRepository and ResponseCache ports.
  - Read DB through repository only.
  - Set Cache-Control private, max-age=300, stale-while-revalidate=600.
  - Return stable error codes for invalid query values.

- [ ] Step 5: Register routes.
  - Add music route registration in backend/stellive-hub-api/src/routes/routes.ts.
  - Wire dependencies from app.ts later in Task 10 if needed.

- [ ] Step 6: Run focused verification.
  - Run: rtk npm test -- musicRoutes.
  - Run: rtk npm run build.
  - Expected: PASS.

## Task 9: Internal Sync Routes

**Files:**
- Modify: backend/stellive-hub-api/src/routes/internalRoutes.ts
- Test: backend/stellive-hub-api/test/musicInternalRoutes.test.ts

- [ ] Step 1: Write internal route tests.
  - Missing bearer token returns 401.
  - POST /v1/internal/schedulers/music/light-sync delegates mode light.
  - POST /v1/internal/schedulers/music/full-sync delegates mode full.
  - POST /v1/internal/schedulers/music/daily-reconcile delegates daily reconciliation.
  - POST /v1/internal/music/sync validates body mode and sourcePlaylistIds.
  - GET /v1/internal/music/sync-runs returns recent diagnostics.
  - GET /v1/internal/music/quota-estimate returns formula inputs and recent observed quota.

- [ ] Step 2: Run RED test.
  - Run: rtk npm test -- musicInternalRoutes.
  - Expected: FAIL until routes are added.

- [ ] Step 3: Extend InternalRouteDependencies.
  - Add musicSyncService, musicReconciliationService, and musicSyncRuns ports.
  - Keep default disabled response when dependencies are absent.

- [ ] Step 4: Implement routes.
  - Reuse existing internal auth hook.
  - Never accept or return YouTube API key values.
  - Return disabled/not_available when MUSIC_SYNC_ENABLED is false or dependencies are absent.

- [ ] Step 5: Run focused verification.
  - Run: rtk npm test -- musicInternalRoutes.
  - Run: rtk npm run build.
  - Expected: PASS.

## Task 10: App Wiring And Env

**Files:**
- Modify: backend/stellive-hub-api/src/app.ts
- Modify: backend/stellive-hub-api/src/config/env.ts
- Modify: backend/stellive-hub-api/.env.example
- Test: backend/stellive-hub-api/test/musicAppWiring.test.ts

- [ ] Step 1: Write app wiring tests.
  - loadEnv parses music cache defaults.
  - buildApp registers /v1/music route.
  - With MUSIC_SYNC_ENABLED=false, internal music scheduler returns disabled.
  - With YOUTUBE_API_KEY absent, sync dependencies are not created.
  - Public music routes still work from repository/cache without YouTube key.

- [ ] Step 2: Run RED test.
  - Run: rtk npm test -- musicAppWiring.
  - Expected: FAIL until env and app wiring exist.

- [ ] Step 3: Add env schema fields.
  - Add defaults for cache TTL, stale seconds, lock seconds, sync intervals, light max pages, sync enabled, YouTube base URL.
  - Treat blank strings as unset.

- [ ] Step 4: Wire default dependencies.
  - Create MusicRepository, MusicSyncRunRepository, ResponseCache.
  - Create YoutubeDataApiClient only when sync is enabled and API key is configured.
  - Create MusicSyncService only for internal/scheduler paths.
  - Register public music routes regardless of sync enabled status.

- [ ] Step 5: Update .env.example.
  - Add names only.
  - Do not add real tokens or playlist IDs.

- [ ] Step 6: Run focused verification.
  - Run: rtk npm test -- musicAppWiring musicRoutes musicInternalRoutes.
  - Run: rtk npm run build.
  - Expected: PASS.

## Task 11: Daily Reconciliation And WebSub Hook

**Files:**
- Create: backend/stellive-hub-api/src/music/musicReconciliationService.ts
- Modify: backend/stellive-hub-api/src/routes/webhookRoutes.ts
- Test: backend/stellive-hub-api/test/musicReconciliationService.test.ts
- Test: backend/stellive-hub-api/test/youtubeWebSubRoutes.test.ts

- [ ] Step 1: Write reconciliation tests.
  - Detect source category mismatch.
  - Detect missing member link.
  - Detect duplicate video id category conflict.
  - Detect OTHERS review candidates.
  - Store summary in sync run metadata.

- [ ] Step 2: Write WebSub hook tests.
  - WebSub videoId event can call a music event port.
  - Hook triggers related playlist light sync or queues a sync request.
  - Hook does not directly classify all channel uploads as songs.
  - Existing song WebSub behavior remains intact until migration is complete.

- [ ] Step 3: Run RED tests.
  - Run: rtk npm test -- musicReconciliationService youtubeWebSubRoutes.
  - Expected: FAIL until service/hook exists.

- [ ] Step 4: Implement reconciliation service.
  - Keep official MUSIC page verification as an adapter-shaped future input, not a crawler.
  - Report diagnostics without storing raw page or API payloads.

- [ ] Step 5: Add WebSub extension port.
  - Keep route dependency optional.
  - If absent, current WebSub route behavior remains unchanged.
  - If present, pass videoId/channelId to music sync trigger port.

- [ ] Step 6: Run focused verification.
  - Run: rtk npm test -- musicReconciliationService youtubeWebSubRoutes.
  - Run: rtk npm run build.
  - Expected: PASS.

## Task 12: Documentation And Handoff

**Files:**
- Modify: README.md
- Modify: docs/API_SETUP.md
- Modify: CODEMAP.md
- Modify: docs/AI_HANDOFF.md

- [ ] Step 1: Update README.
  - Add YouTube music sync setup.
  - Add env var list.
  - Add cache policy.
  - Add sync schedule policy.
  - Add quota estimate formula.
  - Add manual sync examples using internal bearer token without showing a real token.

- [ ] Step 2: Update API setup docs.
  - Clarify API key is server-only.
  - Clarify search.list is not used by default.
  - Clarify public clients only call backend routes.

- [ ] Step 3: Update CODEMAP.
  - Add every new source/test/doc file.

- [ ] Step 4: Update AI handoff.
  - Record implementation status, changed files, verification commands, and unresolved playlist ID/admin seed follow-ups.

- [ ] Step 5: Run final focused verification.
  - Run backend tests for changed files only:
    rtk npm test -- musicContract musicSourcePlaylists musicYoutubeDataApiClient musicClassifier musicMemberMatcher musicRepository musicSyncService responseCache musicRoutes musicInternalRoutes musicReconciliationService musicAppWiring
  - Run build:
    rtk npm run build

- [ ] Step 6: Run policy scan.
  - From repository root, run:
    rtk rg -n "Former|NID_AUT|NID_SES|cookie scraping|login-cookie|search.list|YOUTUBE_API_KEY=.*[A-Za-z0-9_-]{20}|rawPayload|base64|assetPath|filePath|official logo|fan art" backend shared docs README.md
  - Expected: matches are policy references, safe env variable names, or tests asserting absence.

## Application Order

Use this exact order unless a test shows a blocking dependency:

1. Shared contracts.
2. Prisma models and repositories.
3. Source playlist seed/allowlist.
4. YouTube client methods.
5. Classification/member matching.
6. Sync service and locks.
7. Response cache.
8. Public music routes.
9. Internal sync routes.
10. App wiring/env.
11. Daily reconciliation and WebSub hook.
12. Documentation and handoff.

This order keeps each task testable without requiring YouTube network access and prevents client-facing APIs from depending on unfinished sync workers.

## Compatibility Notes

- Keep existing /v1/songs routes during implementation.
- Add /v1/music as the new authoritative playlist-first API.
- Later migration can map /v1/songs to MusicItem if mobile clients still need the older endpoint.
- Do not remove existing song tests until replacement route tests and mobile client changes are complete.
- Do not change Android/iOS code as part of this backend plan unless a later plan explicitly covers client migration.

## Self-Review

- Spec coverage: This plan maps every requirement from the music sync plan to concrete backend files, route surfaces, models, tests, and verification commands.
- Token minimization: The plan narrows reads, tests, fixtures, diffs, and verification scope by task and explicitly avoids broad suite runs during inner-loop work.
- Type consistency: MusicItemType, MusicMemberRole, MusicCatalogItem, SourcePlaylist, MusicSyncRun, fetchPlaylistItems, fetchVideos, syncSourcePlaylist, and syncAllMusic are used consistently across tasks.
- Policy check: The plan keeps YouTube API key backend-only, excludes client-side YouTube calls, avoids search.list, avoids hard deletes for missing videos, stores no image binaries/raw payloads, and excludes Former/gamja/official/upcoming from the 10-member music target set.
- Scope control: This plan is backend-only except shared contracts and docs. Mobile UI/client migration should be handled by a separate plan after /v1/music stabilizes.

## Execution Handoff

Plan complete and saved to docs/superpowers/plans/2026-06-22-stellive-music-youtube-sync-code-design-application-plan.md.

Recommended execution mode: subagent-driven task execution with review after each task, because the work spans schema, repositories, external API adapter, cache, routes, and docs.

