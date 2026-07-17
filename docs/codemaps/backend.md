# Backend CODEMAP

Read this file only for backend/API/control-plane work or when changed files are under `backend/stellive-hub-api/**`.

Do not read this file for merge-only work unless a conflict or failed check directly references backend files.

## Recent Official Music Playlist Sync Additions

- `backend/stellive-hub-api/src/music/officialStelliveMusicSyncService.ts` - Official Stellive COVER/ORIGINAL playlist sync, videoId dedupe, source mapping, manual override handling.
- `backend/stellive-hub-api/test/musicOfficialPlaylistSyncService.test.ts` - Official playlist sync behavior tests.
- `backend/stellive-hub-api/src/adapters/youtube/youtubePremiereClassifier.ts` - Conservative assumed-premiere state classification for cover/original YouTube videos using official broadcast metadata.
- `backend/stellive-hub-api/test/youtubePremiereClassifier.test.ts` - Assumed-premiere scheduled/live/completed/unknown and non-music exclusion tests.

## Recent Mobile Song Page And Discovery Planning

- `backend/stellive-hub-api/src/music/musicChannelDiscoverySyncService.ts` - Official/member uploads discovery into the normalized music catalog with dedupe, review, and override preservation.
- `backend/stellive-hub-api/src/workers/musicChannelDiscoveryWorker.ts` - Calls the internal music discovery scheduler immediately and recalculates a boundary-aware delay after every attempt.
- `backend/stellive-hub-api/src/workers/musicChannelDiscoverySchedule.ts` - Pure IANA-time-zone peak-window policy for the music discovery worker.
- `backend/stellive-hub-api/test/musicChannelDiscoveryWorker.test.ts` - Verifies success/failure cycle delay recalculation without real waiting.
- `backend/stellive-hub-api/test/musicChannelDiscoverySchedule.test.ts` - Verifies KST peak/off-peak boundaries and time-zone-independent delay calculation.
- `backend/stellive-hub-api/test/musicChannelDiscoverySyncService.test.ts` - Focused discovery dedupe, source preservation, member-link, and review tests.

## Backend: `backend/stellive-hub-api`

### Backend Music Sync Additions
- `backend/stellive-hub-api/src/cache/responseCache.ts` - Response cache with memory fallback, stale-while-revalidate, and per-key load coalescing.
- `backend/stellive-hub-api/src/music/musicClassifier.ts` - Source-playlist-first music type classification helpers.
- `backend/stellive-hub-api/src/music/musicDto.ts` - Public music DTO mapper that avoids raw payload/secret/local file leakage.
- `backend/stellive-hub-api/src/music/musicLocks.ts` - Per-source music sync lock abstraction and in-memory implementation.
- `backend/stellive-hub-api/src/music/musicMemberMatcher.ts` - Alias-based N:M music item/member matcher.
- `backend/stellive-hub-api/src/music/musicReconciliationService.ts` - Daily reconciliation diagnostics for official-source comparison.
- `backend/stellive-hub-api/src/music/musicSourcePlaylists.ts` - 10-member allowlist and official MUSIC source playlist seed policy.
- `backend/stellive-hub-api/src/music/musicSyncService.ts` - Light/full playlist sync service using backend-only YouTube Data API ports.
- `backend/stellive-hub-api/src/repositories/musicRepository.ts` - Music member/source playlist/item repositories and sync run repository.
- `backend/stellive-hub-api/src/repositories/musicSyncRunRepository.ts` - Music sync run repository re-export boundary.
- `backend/stellive-hub-api/src/routes/musicRoutes.ts` - Public cached `/v1/music` and member music routes.
- `backend/stellive-hub-api/test/musicAppWiring.test.ts` - Focused env/app wiring tests for music sync.
- `backend/stellive-hub-api/test/musicClassifier.test.ts` - Music classification tests.
- `backend/stellive-hub-api/test/musicContract.test.ts` - Shared music DTO/contract leakage tests.
- `backend/stellive-hub-api/test/musicInternalRoutes.test.ts` - Protected manual music sync route tests.
- `backend/stellive-hub-api/test/musicMemberMatcher.test.ts` - Music member alias matching tests.
- `backend/stellive-hub-api/test/musicReconciliationService.test.ts` - Music reconciliation diagnostics tests.
- `backend/stellive-hub-api/test/musicRepository.test.ts` - Music repository tests.
- `backend/stellive-hub-api/test/musicRoutes.test.ts` - Public music route/cache tests.
- `backend/stellive-hub-api/test/musicSourcePlaylists.test.ts` - Music source seed policy tests.
- `backend/stellive-hub-api/test/musicSyncService.test.ts` - Light/full sync service and lock tests.
- `backend/stellive-hub-api/test/musicYoutubeDataApiClient.test.ts` - YouTube playlist/video client music sync tests.

### Backend Project Files

- `backend/stellive-hub-api/.env.example` - Non-secret environment variable template for backend configuration.
- `backend/stellive-hub-api/Dockerfile` - Container image definition for the Fastify API service.
- `backend/stellive-hub-api/docker-compose.yml` - Local Docker Compose stack for the API and supporting services.
- `backend/stellive-hub-api/package.json` - Node package metadata, scripts, runtime dependencies, and dev dependencies.
- `backend/stellive-hub-api/package-lock.json` - Locked npm dependency graph for reproducible installs.
- `backend/stellive-hub-api/tsconfig.json` - TypeScript compiler configuration for the backend.
- `backend/stellive-hub-api/prisma/schema.prisma` - Prisma database schema for persisted backend models.

### Backend App Composition

- `backend/stellive-hub-api/src/app.ts` - Fastify app factory that wires env, CORS, Swagger, repositories, services, workers, and route modules.
- `backend/stellive-hub-api/src/index.ts` - API process entry point used by dev and production start scripts.
- `backend/stellive-hub-api/src/config/env.ts` - Zod-backed environment variable parsing, defaults, and feature flag validation.
- `backend/stellive-hub-api/src/storage/prisma.ts` - Prisma client singleton and database access bootstrap.
- `backend/stellive-hub-api/src/types.ts` - Shared backend utility types.

### Backend Adapters And Catalog

- `backend/stellive-hub-api/src/adapters/eventAdapter.ts` - Common adapter contract for normalized external platform events.
- `backend/stellive-hub-api/src/adapters/mockAdapters.ts` - Safe mock adapter data used for local development and tests.
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts` - CHZZK Open API client for backend-owned live-list and live-status calls.
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkAuthClient.ts` - CHZZK OAuth authorization URL and token exchange client.
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOAuthState.ts` - Signed OAuth state generation and verification for CHZZK auth flows.
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts` - CHZZK live-status adapter that compares API responses with catalog targets and emits allowed events.
- `backend/stellive-hub-api/src/adapters/youtube/youtubeAtomParser.ts` - Minimal YouTube WebSub Atom parser for upload candidate fields.
- `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts` - Bounded official YouTube Data API client for upload playlist backfill, ETag-aware reconciliation, and explicit video metadata reads.
- `backend/stellive-hub-api/src/adapters/youtube/youtubeWebSubSubscriptionService.ts` - YouTube WebSub subscribe renewal service for supported song-channel topics.
- `backend/stellive-hub-api/src/catalog/catalog.ts` - Catalog service for loading and validating shared generation/member seed data.

### Backend Event, Hub Event, And Calendar Logic

- `backend/stellive-hub-api/src/announcements/serviceAnnouncementRepository.ts` - Prisma persistence, public visibility/version filtering, audit logs, and push attempts for app service announcements.
- `backend/stellive-hub-api/src/announcements/serviceAnnouncementReadService.ts` - Public list/detail and 30-second summary cache.
- `backend/stellive-hub-api/src/announcements/serviceAnnouncementAdminService.ts` - Draft, publish, resolve, archive, attention revision, and resend workflow.

- `backend/stellive-hub-api/src/events/chzzkEventIngestor.ts` - Ingests CHZZK live transitions into normalized platform events.
- `backend/stellive-hub-api/src/events/eventGuards.ts` - Policy guards that drop unsupported or forbidden platform events before storage or notification.
- `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDayCatalog.ts` - Verified special-day catalog source for birthdays and generation anniversaries.
- `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDays.ts` - Projects special-day catalog entries into read-only calendar entries.
- `backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts` - Admin-side hub event create, update, publish, cancel, and validation service.
- `backend/stellive-hub-api/src/hub-events/hubEventAdminTypes.ts` - Admin hub event request and service types.
- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts` - Calendar projection helpers for dated hub event entries.
- `backend/stellive-hub-api/src/hub-events/hubEventNotificationFactory.ts` - Creates normalized notification candidates from hub event lifecycle changes.
- `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts` - Hub event validation and public display policy.
- `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts` - Hub event persistence and query repository.
- `backend/stellive-hub-api/src/hub-events/hubEventService.ts` - Public hub event read, list, summary, and projection service.

### Backend Mobile, Preferences, And Delivery Policy

- `backend/stellive-hub-api/src/mobile/bootstrapService.ts` - Builds mobile bootstrap payloads from catalog, device, preferences, live status, and hub event summary data.
- `backend/stellive-hub-api/src/mobile/mobileError.ts` - Mobile route error helpers and typed failure responses.
- `backend/stellive-hub-api/src/notification/loadReductionPolicy.ts` - Notification load-reduction policy for summary, downgrade, and spike behavior.
- `backend/stellive-hub-api/src/notification/pushCapPolicy.ts` - Push cap policy helpers that limit notification volume.
- `backend/stellive-hub-api/src/notification/spikeDowngrade.ts` - Spike detection and downgrade helpers for bursty notification periods.
- `backend/stellive-hub-api/src/preferences/preferenceResolution.ts` - Resolves global, platform, event type, generation, member, quiet-hours, and realtime preferences.
- `backend/stellive-hub-api/src/realtime/realtimeDeliveryService.ts` - Foreground realtime delivery service for authenticated app sessions.
- `backend/stellive-hub-api/src/songs/songClassifier.ts` - Low-load YouTube upload classifier for original, cover, and unknown song type detection.
- `backend/stellive-hub-api/src/songs/songBackfillService.ts` - Caps YouTube song backfill/reconciliation by channel and page count before delegating normalized uploads to song ingestion.
- `backend/stellive-hub-api/src/songs/songIngestionService.ts` - Normalizes classified YouTube upload candidates into song repository upserts with catalog policy checks.

### Backend Jobs, Push, And Repositories

- `backend/stellive-hub-api/src/jobs/notificationJobRepository.ts` - Database-backed notification job enqueue, claim, retry, complete, and fail operations.
- `backend/stellive-hub-api/src/jobs/notificationWorker.ts` - Drains notification jobs, resolves preferences, sends push payloads, and records delivery attempts.
- `backend/stellive-hub-api/src/push/fcmClient.ts` - Disabled-safe Firebase Admin/FCM client factory.
- `backend/stellive-hub-api/src/push/pushPayloadFactory.ts` - Creates minimal Android/iOS push payloads from normalized events and delivery decisions.
- `backend/stellive-hub-api/src/push/pushSender.ts` - Push sender abstraction and FCM-backed implementation.
- `backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts` - Persists device-level push delivery attempt results.
- `backend/stellive-hub-api/src/repositories/deviceRepository.ts` - Stores anonymous device registrations and push token metadata.
- `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts` - Stores and reads normalized live-status cache rows.
- `backend/stellive-hub-api/src/repositories/platformApiStateRepository.ts` - Stores adapter health, cursors, OAuth token metadata, and platform API state.
- `backend/stellive-hub-api/src/repositories/platformEventRepository.ts` - Persists normalized platform events and dedupe records.
- `backend/stellive-hub-api/src/repositories/preferenceRepository.ts` - Stores and reads server-side notification preference snapshots.
- `backend/stellive-hub-api/src/repositories/songRepository.ts` - Song read repository port and empty fallback for the mobile song API skeleton.
- `backend/stellive-hub-api/src/repositories/webhookSubscriptionRepository.ts` - Stores webhook subscription state and renewal metadata.

### Backend Routes And Workers

- `backend/stellive-hub-api/src/admin/adminAuth.ts` - Admin session and internal bearer-token authentication helpers.
- `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts` - Server-rendered admin console HTML.
- `backend/stellive-hub-api/src/admin/adminHealthService.ts` - Admin health summary service for adapters and backend state.
- `backend/stellive-hub-api/src/admin/adminThemeHtml.ts` - Shared admin console styling and theme HTML.
- `backend/stellive-hub-api/src/admin/adminTypes.ts` - Admin route and console data types.
- `backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts` - Admin routes for hub event management.
- `backend/stellive-hub-api/src/routes/adminServiceAnnouncementRoutes.ts` - Authenticated service announcement management and history routes.
- `backend/stellive-hub-api/src/routes/serviceAnnouncementRoutes.ts` - Public announcement list, detail, and summary routes.
- `backend/stellive-hub-api/src/routes/adminRoutes.ts` - Admin console and admin health routes.
- `backend/stellive-hub-api/src/routes/appRoutes.ts` - Mobile app routes for bootstrap, devices, preferences, live status, and foreground data.
- `backend/stellive-hub-api/src/routes/chzzkAuthRoutes.ts` - CHZZK OAuth connect and callback routes.
- `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts` - Public hub event list, detail, calendar, widget, and summary routes.
- `backend/stellive-hub-api/src/routes/internalRoutes.ts` - Protected internal scheduler, worker, and diagnostic routes.
- `backend/stellive-hub-api/src/routes/routes.ts` - Route registration aggregator for the Fastify app.
- `backend/stellive-hub-api/src/routes/songRoutes.ts` - Mobile song list and facet routes with supported filter validation and cache headers.
- `backend/stellive-hub-api/src/routes/webhookRoutes.ts` - Public YouTube WebSub verification and Atom receipt routes for song ingestion.
- `backend/stellive-hub-api/src/workers/chzzkLivePollWorker.ts` - Standalone worker entry point for CHZZK live polling.

### Backend Tests

- `backend/stellive-hub-api/test/adminAuth.test.ts` - Tests admin auth/session behavior.
- `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts` - Tests admin hub event route validation and behavior.
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts` - Tests protected internal admin and worker routes.
- `backend/stellive-hub-api/test/catalog.test.ts` - Tests catalog loading and project catalog policy invariants.
- `backend/stellive-hub-api/test/chzzkApiClient.test.ts` - Tests CHZZK API client parsing and error handling.
- `backend/stellive-hub-api/test/chzzkAuthRoutes.test.ts` - Tests CHZZK OAuth route behavior.
- `backend/stellive-hub-api/test/chzzkClientAuthLiveList.test.ts` - Tests client-authenticated CHZZK live-list integration behavior.
- `backend/stellive-hub-api/test/chzzkLiveApiWiring.test.ts` - Tests CHZZK live API wiring through app dependencies.
- `backend/stellive-hub-api/test/chzzkObservedStartedAt.test.ts` - Tests observed live start timestamp handling.
- `backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts` - Tests CHZZK Open API adapter transition and catalog matching behavior.
- `backend/stellive-hub-api/test/fcmClient.test.ts` - Tests disabled-safe and configured FCM client behavior.
- `backend/stellive-hub-api/test/foundation.test.ts` - Baseline backend app and test foundation checks.
- `backend/stellive-hub-api/test/hubCalendarSpecialDays.test.ts` - Tests special-day calendar projection.
- `backend/stellive-hub-api/test/hubEventAdminService.test.ts` - Tests admin hub event service validation and state changes.
- `backend/stellive-hub-api/test/hubEventCalendar.test.ts` - Tests hub event calendar projection logic.
- `backend/stellive-hub-api/test/hubEventCalendarRoutes.test.ts` - Tests calendar route responses and query behavior.
- `backend/stellive-hub-api/test/hubEventImagePolicy.test.ts` - Tests allowed image metadata and rejected local/binary fields.
- `backend/stellive-hub-api/test/hubEventNotifications.test.ts` - Tests hub event notification candidate generation.
- `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts` - Tests public hub event list/detail/calendar/widget/summary routes.
- `backend/stellive-hub-api/test/hubEvents.test.ts` - Tests hub event domain behavior.
- `backend/stellive-hub-api/test/liveStatus.test.ts` - Tests live-status API and repository behavior.
- `backend/stellive-hub-api/test/mobileAppRoutes.test.ts` - Tests mobile-facing app routes.
- `backend/stellive-hub-api/test/mobileBootstrap.test.ts` - Tests mobile bootstrap response composition.
- `backend/stellive-hub-api/test/mobileBootstrapFallbackLiveStatus.test.ts` - Tests bootstrap fallback live-status behavior.
- `backend/stellive-hub-api/test/mobileDeviceRoutes.test.ts` - Tests mobile device registration and token routes.
- `backend/stellive-hub-api/test/mobilePreferences.test.ts` - Tests mobile preference read/write behavior.
- `backend/stellive-hub-api/test/mobileSongsContract.test.ts` - Tests shared mobile song API contract values and DTO safety.
- `backend/stellive-hub-api/test/notificationLoadReduction.test.ts` - Tests notification load-reduction and push-cap policy.
- `backend/stellive-hub-api/test/notificationWorker.test.ts` - Tests notification worker delivery, skip, retry, and attempt recording behavior.
- `backend/stellive-hub-api/test/platformApiStateRepository.test.ts` - Tests platform API state repository behavior.
- `backend/stellive-hub-api/test/preferenceResolution.test.ts` - Tests notification preference resolution.
- `backend/stellive-hub-api/test/pushPayloadFactory.test.ts` - Tests Android/iOS push payload construction.
- `backend/stellive-hub-api/test/repositories.test.ts` - Tests repository integration behavior.
- `backend/stellive-hub-api/test/songClassifier.test.ts` - Tests marker-based YouTube upload song classification.
- `backend/stellive-hub-api/test/songBackfillService.test.ts` - Tests capped YouTube song backfill/reconciliation delegation and not-modified skips.
- `backend/stellive-hub-api/test/songIngestionService.test.ts` - Tests YouTube upload normalization, catalog skips, and unknown song type skips.
- `backend/stellive-hub-api/test/songRepository.test.ts` - Tests song Prisma schema expectations and repository mapping/query behavior.
- `backend/stellive-hub-api/test/songRoutes.test.ts` - Tests mobile song route filters, cache headers, and empty cached-list responses.
- `backend/stellive-hub-api/test/youtubeAtomParser.test.ts` - Tests minimal YouTube Atom upload parsing and typed parse errors.
- `backend/stellive-hub-api/test/youtubeDataApiClient.test.ts` - Tests YouTube Data API response normalization, ETag handling, page caps, and video detail batching.
- `backend/stellive-hub-api/test/youtubeSongBackfillInternalRoutes.test.ts` - Tests internal YouTube song backfill scheduler delegation and feature-flag disable behavior.
- `backend/stellive-hub-api/test/youtubeWebSubInternalRoutes.test.ts` - Tests internal YouTube subscription renewal scheduler delegation.
- `backend/stellive-hub-api/test/youtubeWebSubRoutes.test.ts` - Tests public YouTube WebSub verification and Atom ingestion route behavior.
- `backend/stellive-hub-api/test/youtubeWebSubSubscriptionService.test.ts` - Tests YouTube WebSub subscription renewal request and error handling.
