# CODEMAP

This file maps the repository files that are not excluded by `.gitignore`. Ignored generated outputs, local secrets, dependency folders, IDE files, build artifacts, screenshots, and platform-specific private config such as `google-services.json`, `GoogleService-Info.plist`, `.env`, `node_modules/`, `dist/`, and `build/` are intentionally omitted.

## Root And Project Metadata

- `.dockerignore` - Docker build context exclusion rules for the backend container.
- `.gitignore` - Repository ignore rules used to keep dependencies, build outputs, local config, secrets, and screenshots out of source control.
- `.gitlab-ci.yml` - GitLab CI pipeline definition for project validation.
- `.serena/.gitignore` - Serena tool ignore rules for its local project metadata.
- `.serena/project.yml` - Serena project metadata for this workspace.
- `AGENTS.md` - Repository-wide agent rules, project constraints, command conventions, and internal test-server notes.
- `CODEMAP.md` - Human-maintained map of non-ignored repository files and their roles.
- `README.md` - Project overview, goals, architecture summary, setup notes, and current development status.
- `.github/copilot-instructions.md` - GitHub Copilot guidance mirroring project policies for generated code.
- `.github/workflows/ci.yml` - GitHub Actions workflow for CI checks.

## Shared Contracts And Seeds

- `shared/member-catalog/generations.seed.json` - Seed generation/category catalog including active, upcoming, representative, and official groupings.
- `shared/member-catalog/members.seed.json` - Seed member, Gangzi, and official-channel catalog data used by backend and clients.
- `shared/openapi/openapi.yaml` - OpenAPI contract for public, mobile, admin, and internal backend routes.
- `shared/schemas/domain.ts` - Shared TypeScript domain types and schema helpers for catalog entries, events, live status, preferences, and hub events.
- `shared/schemas/mobileApi.ts` - Shared mobile API DTO definitions for app bootstrap and client-facing backend responses.

## Documentation

- `docs/AI_HANDOFF.md` - Current project handoff notes, implementation state, verification history, and next-step context.
- `docs/API_FIRST_LIGHTWEIGHT_PLAN.md` - Lightweight API-first architecture plan for server-mediated notification delivery.
- `docs/API_IMPLEMENTATION_PLAN.md` - Backend implementation plan for official API ingestion, normalization, dedupe, preferences, and push fan-out.
- `docs/API_SETUP.md` - Backend API setup, environment variables, and local operation notes.
- `docs/API_SETUP_KO.md` - Korean setup guide for backend API configuration.
- `docs/ARCHITECTURE.md` - High-level architecture boundaries for mobile apps, backend, storage, external APIs, and push delivery.
- `docs/CHZZK_LIVE_API_STATUS.md` - CHZZK live API verification state and current integration constraints.
- `docs/CHZZK_LIVE_STATUS_REFRESH_DESIGN.md` - Design for refreshing and caching CHZZK live status.
- `docs/FIREBASE_FCM_BOUNDARY_DESIGN.md` - Boundary design for Firebase Cloud Messaging ownership and safety rules.
- `docs/FIREBASE_FCM_CODE_DESIGN.md` - Implementation design for FCM client, payloads, push sender, and tests.
- `docs/HUB_EVENTS_LIST_DATE_NAVIGATION_DESIGN.md` - Design notes for hub event list date navigation.
- `docs/HUB_EVENTS_READ_API_DESIGN.md` - Public hub event read API design and DTO behavior.
- `docs/HUB_EVENT_ANNIVERSARY_CALENDAR_CODE_DESIGN.md` - Code design for projecting member birthdays and generation anniversaries into the calendar.
- `docs/HUB_EVENT_ANNIVERSARY_CALENDAR_DESIGN.md` - Product design for special-day calendar entries.
- `docs/NOTIFICATION_LOAD_REDUCTION_POLICY.md` - Notification throttling, spike downgrade, collapse, and delivery reduction policy.
- `docs/NOTIFICATION_POLICY.md` - Authoritative notification preference, delivery, and event-type policy.
- `docs/PRIVACY_AND_TERMS.md` - Privacy, platform terms, asset, and data handling constraints.
- `docs/PROJECT_RULES.md` - Non-negotiable catalog, API, asset, UI, and notification rules.
- `docs/REALTIME_DELIVERY.md` - Best-effort realtime delivery policy and user disclosure language.
- `docs/UI_GUIDELINES.md` - Original UI direction and platform design constraints.
- `docs/mockups/live-page-mobile-preview.html` - Static local preview mockup for the live page.
- `docs/mockups/song-page-mobile-preview.html` - Static local preview mockup for the song page proposed by GitLab #23 and GitHub #45.
- `docs/superpowers/plans/2026-06-02-chzzk-live-elapsed-time.md` - Implementation plan for CHZZK live elapsed-time display.
- `docs/superpowers/plans/2026-06-03-hub-events-ui-rework.md` - Implementation plan for hub events UI rework.
- `docs/superpowers/plans/2026-06-03-hub-events.md` - Implementation plan for hub events feature work.
- `docs/superpowers/plans/2026-06-04-settings-navigation.md` - Implementation plan for settings navigation changes.
- `docs/superpowers/plans/2026-06-07-admin-browser-login.md` - Implementation plan for admin browser login work.
- `docs/superpowers/plans/2026-06-07-oci-server-admin-console.md` - Implementation plan for OCI-hosted admin console work.
- `docs/superpowers/plans/2026-06-08-admin-console-dark-mode.md` - Implementation plan for admin console dark mode.
- `docs/superpowers/plans/2026-06-09-admin-console-auto-refresh.md` - Implementation plan for admin console auto refresh.
- `docs/superpowers/plans/2026-06-10-goods-events-calendar-code-implementation.md` - Implementation plan for goods/events calendar code.
- `docs/superpowers/plans/2026-06-10-goods-events-calendar-widgets.md` - Implementation plan for goods/events calendar widgets.
- `docs/superpowers/plans/2026-06-11-chzzk-open-api-adapter.md` - Implementation plan for CHZZK Open API adapter behavior.
- `docs/superpowers/plans/2026-06-11-chzzk-open-api-code-writing-plan.md` - Code-writing plan for CHZZK Open API integration.
- `docs/superpowers/plans/2026-06-11-mobile-server-communication-code-design.md` - Code design for mobile-to-server communication.
- `docs/superpowers/plans/2026-06-12-hub-event-image-policy-code-implementation.md` - Implementation plan for hub event image policy.
- `docs/superpowers/plans/2026-06-12-hub-event-image-policy.md` - Feature plan for hub event image policy.
- `docs/superpowers/plans/2026-06-12-hub-event-notification-code-design.md` - Code design for hub event notifications.
- `docs/superpowers/plans/2026-06-12-hub-event-notification-jobs.md` - Implementation plan for hub event notification jobs.
- `docs/superpowers/plans/2026-06-12-hub-events-admin-crud-code-implementation.md` - Implementation plan for admin hub event CRUD.
- `docs/superpowers/plans/2026-06-12-hub-events-read-api-code-plan.md` - Code plan for hub events read APIs.
- `docs/superpowers/plans/2026-06-13-goods-events-calendar-confirmed-ui-code-design.md` - Code design for confirmed goods/events calendar UI.
- `docs/superpowers/plans/2026-06-13-goods-events-calendar-confirmed-ui.md` - Feature plan for confirmed goods/events calendar UI.
- `docs/superpowers/plans/2026-06-14-bootstrap-contract-fix.md` - Plan for bootstrap API contract fixes.
- `docs/superpowers/plans/2026-06-14-chzzk-live-api-code-design.md` - Code design for CHZZK live API work.
- `docs/superpowers/plans/2026-06-14-ios-date-navigation-titlebar-alignment.md` - Plan for iOS date navigation and title bar alignment.
- `docs/superpowers/plans/2026-06-15-chzzk-client-auth-live-polling-fix.md` - Plan for CHZZK client-auth live polling fixes.
- `docs/superpowers/plans/2026-06-15-chzzk-live-api-verify-required-resolution.md` - Plan for resolving CHZZK live API verification-required state.
- `docs/superpowers/plans/2026-06-15-live-page-server-ui-implementation.md` - Plan for live page server-backed UI implementation.
- `docs/superpowers/plans/2026-06-15-mobile-live-status-end-to-end-fix.md` - Plan for mobile live-status end-to-end fixes.
- `docs/superpowers/plans/2026-06-16-android-live-topbar-fade-gradient-code-plan.md` - Code plan for Android live top bar fade gradient.
- `docs/superpowers/plans/2026-06-16-android-live-topbar-glass-guarded-code-plan.md` - Code plan for guarded Android live top bar glass behavior.
- `docs/superpowers/plans/2026-06-16-android-live-topbar-overlay-glass-code-plan.md` - Code plan for Android top bar overlay glass.
- `docs/superpowers/plans/2026-06-16-android-live-transparent-blur-top-bar-code-design.md` - Code design for Android transparent blur top bar.
- `docs/superpowers/plans/2026-06-16-android-live-transparent-blur-top-bar-feature-design.md` - Feature design for Android transparent blur top bar.
- `docs/superpowers/plans/2026-06-16-chzzk-offline-channel-image-code-design.md` - Code design for CHZZK offline channel image handling.
- `docs/superpowers/plans/2026-06-16-chzzk-offline-channel-image-url.md` - Plan for CHZZK offline channel image URL behavior.
- `docs/superpowers/plans/2026-06-16-live-member-drag-reorder-code-design.md` - Code design for live member drag reorder.
- `docs/superpowers/plans/2026-06-16-live-member-drag-reorder-feature-design.md` - Feature design for live member drag reorder.
- `docs/superpowers/plans/2026-06-17-admin-hub-event-image-form-code-design.md` - Code design for admin hub event image form.
- `docs/superpowers/plans/2026-06-17-admin-hub-event-validation-alignment-code-design.md` - Code design for admin hub event validation alignment.
- `docs/superpowers/plans/2026-06-17-admin-hub-event-validation-alignment-feature-design.md` - Feature design for admin hub event validation alignment.
- `docs/superpowers/plans/2026-06-17-admin-hub-events-console-redesign-code-plan.md` - Code plan for admin hub events console redesign.
- `docs/superpowers/plans/2026-06-17-admin-hub-events-field-layout-code-plan.md` - Untracked local implementation plan for admin hub event field layout work.
- `docs/superpowers/plans/2026-06-17-hub-event-thumbnail-code-design.md` - Code design for hub event thumbnail support.
- `docs/superpowers/plans/2026-06-17-hub-event-thumbnail-feature-design.md` - Feature design for hub event thumbnail support.
- `docs/superpowers/plans/2026-06-22-song-page-code-design-application-plan.md` - Code design and implementation plan for server-backed song page API communication, including token-minimized execution guidance.
- `docs/superpowers/plans/2026-06-22-song-page-ui-api-communication-plan.md` - Product/API communication plan connecting the song page mockup to backend song APIs and mobile client behavior.
- `docs/superpowers/plans/2026-06-22-youtube-song-page-ingestion-plan.md` - Implementation plan for low-load YouTube song ingestion, song mobile APIs, and unified Android/iOS song page UI.
- `docs/superpowers/specs/2026-06-03-hub-events-design.md` - Feature specification for hub events.
- `docs/superpowers/specs/2026-06-03-hub-events-ui-rework-design.md` - Feature specification for hub events UI rework.
- `docs/superpowers/specs/2026-06-04-settings-navigation-design.md` - Feature specification for settings navigation.
- `docs/superpowers/specs/2026-06-07-oci-server-admin-console-design.md` - Feature specification for OCI server admin console work.
- `docs/superpowers/specs/2026-06-08-admin-console-dark-mode-design.md` - Feature specification for admin console dark mode.
- `docs/superpowers/specs/2026-06-09-admin-console-auto-refresh-design.md` - Feature specification for admin console auto refresh.
- `docs/superpowers/specs/2026-06-11-hub-events-admin-crud-design.md` - Feature specification for admin hub event CRUD.
- `docs/superpowers/specs/2026-06-11-mobile-server-communication-design.md` - Feature specification for mobile-server communication.
- `docs/superpowers/specs/android-live-topbar-glass-browser-mockup.html` - Browser mockup for Android live top bar glass behavior.

## Mockups

- `mockups/admin-hub-events-console-redesign-mockup.html` - Standalone admin hub events console redesign mockup.
- `mockups/android-policy-ui-mockup.html` - Standalone Android policy UI mockup.
- `mockups/goods-events-calendar-mobile-mockup.html` - Standalone mobile goods/events calendar mockup.
- `mockups/goods-events-list-date-navigation-mockup.html` - Standalone goods/events list date navigation mockup.
- `mockups/ios-date-navigation-redesign-mockup.html` - Standalone iOS date navigation redesign mockup.
- `mockups/issue-30-16-goods-events-calendar-menu-mockup.html` - Standalone goods/events calendar menu mockup for issue planning.

## Backend: `backend/stellive-hub-api`

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

## Android: `android/StelliveHubAndroid`

- `android/StelliveHubAndroid/build.gradle.kts` - Android root Gradle build configuration.
- `android/StelliveHubAndroid/settings.gradle.kts` - Android Gradle settings and module inclusion.
- `android/StelliveHubAndroid/gradle.properties` - Android Gradle and Kotlin build properties.
- `android/StelliveHubAndroid/gradle/wrapper/gradle-wrapper.properties` - Gradle wrapper distribution configuration.
- `android/StelliveHubAndroid/app/build.gradle.kts` - Android app module dependencies, build types, and generated config fields.
- `android/StelliveHubAndroid/app/src/main/AndroidManifest.xml` - Android app manifest, permissions, activities, services, and widget declarations.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt` - Main Android activity containing the current view rendering, navigation, settings, history, live, and hub event UI flows.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/StelliveHubApplication.kt` - Android application class and app-level initialization.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/database/NotificationHistoryEntity.kt` - Local notification history persistence entity.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/datastore/PreferenceKeys.kt` - DataStore preference key definitions.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/device/DeviceIdStore.kt` - Stable anonymous device ID storage.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/device/PushTokenSyncer.kt` - Push token registration and backend sync logic.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/model/Models.kt` - Android domain models for catalog, preferences, live status, history, and hub events.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/network/HubApi.kt` - Retrofit-style backend API contract.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/network/HubApiClient.kt` - Android backend API client factory.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/network/HubApiModels.kt` - Android DTOs for backend request and response payloads.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/network/HubNetworkResult.kt` - Network result wrapper for backend calls.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/notification/AndroidNotificationPresenterPolicy.kt` - Android notification presentation and foreground display policy.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/notification/NotificationChannelRegistrar.kt` - Android notification channel creation.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/notification/NotificationChannels.kt` - Notification channel identifiers and metadata.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/notification/NotificationPayload.kt` - Android push payload parser/model.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/notification/NotificationPermissionPromptPolicy.kt` - Android notification permission prompt timing policy.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/notification/NotificationTopicKey.kt` - Notification topic key model for preference and payload grouping.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/notification/StelliveFirebaseMessagingService.kt` - Firebase Messaging service that receives push notifications.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/realtime/ForegroundRealtimeClient.kt` - Foreground realtime stream client for live backend updates.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt` - Android calendar UI formatting and display policy.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarWidgetTextFormatter.kt` - Text formatter for Android calendar widget entries.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubCalendarDeepLinkPolicy.kt` - Deep-link parsing and creation policy for hub calendar event navigation.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubCalendarWidgetProvider.kt` - Android home-screen widget provider for hub calendar entries.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarView.kt` - Custom Android view for the hub events calendar.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarViewModel.kt` - Android calendar state and projection view model.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/HubRepository.kt` - Android repository contract for hub home, live, history, settings, and events state.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/LiveMemberOrderingPolicy.kt` - Android policy for live member ordering and manual reorder behavior.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainNavigationHistory.kt` - Android navigation stack helper for main screens.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt` - Android main screen display policy, labels, and formatting helpers.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MockHubRepository.kt` - Local Android mock repository used as fallback app data.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/ServerHubRepository.kt` - Android server-backed repository that maps backend bootstrap data into app state.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/hubevents/HubEventImagePolicy.kt` - Android policy for displaying or falling back from hub event image metadata.
- `android/StelliveHubAndroid/app/src/main/res/color/hub_bottom_nav_selector.xml` - Bottom navigation color state selector.
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_avatar_placeholder.xml` - Placeholder avatar drawable.
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_button_glass.xml` - Top bar button background drawable.
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_glass.xml` - Top bar background drawable.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_arrow_back.xml` - Back navigation icon.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_launcher_placeholder.xml` - Placeholder launcher icon.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_metric_clock.xml` - Clock metric icon for live elapsed time.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_metric_viewers.xml` - Viewer count metric icon.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_goods_events.xml` - Bottom tab icon for goods/events.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_history.xml` - Bottom tab icon for history.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_home.xml` - Bottom tab icon for home.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_live.xml` - Bottom tab icon for live.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_songs.xml` - Bottom tab icon for the song catalog screen.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_settings.xml` - Bottom tab icon for settings.
- `android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml` - Main Android activity layout shell.
- `android/StelliveHubAndroid/app/src/main/res/layout/item_member.xml` - Member row/item layout.
- `android/StelliveHubAndroid/app/src/main/res/layout/widget_hub_calendar.xml` - Android widget layout for hub calendar entries.
- `android/StelliveHubAndroid/app/src/main/res/menu/bottom_navigation.xml` - Bottom navigation menu items.
- `android/StelliveHubAndroid/app/src/main/res/navigation/nav_graph.xml` - Navigation graph resource.
- `android/StelliveHubAndroid/app/src/main/res/values/colors.xml` - Default Android color tokens.
- `android/StelliveHubAndroid/app/src/main/res/values/styles.xml` - Default Android style resources.
- `android/StelliveHubAndroid/app/src/main/res/values-night/colors.xml` - Night-mode Android color tokens.
- `android/StelliveHubAndroid/app/src/main/res/values-night/styles.xml` - Night-mode Android style resources.
- `android/StelliveHubAndroid/app/src/main/res/values/strings.xml` - Android string resources.
- `android/StelliveHubAndroid/app/src/main/res/xml/hub_calendar_widget.xml` - Android app widget provider metadata.
- `android/StelliveHubAndroid/gradle/wrapper/gradle-wrapper.jar` - Gradle wrapper executable jar.
- `android/StelliveHubAndroid/gradlew` - Unix Gradle wrapper script.
- `android/StelliveHubAndroid/gradlew.bat` - Windows Gradle wrapper script.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/AndroidColorTokenPolicyTest.kt` - Unit test for Android color-token policy constraints.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/BottomNavigationIconPolicyTest.kt` - Unit test for bottom navigation icon policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarProjectionTest.kt` - Unit test for calendar projection behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt` - Unit test for Android calendar UI policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarWidgetTextFormatterTest.kt` - Unit test for calendar widget text formatting.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ChzzkBackendBoundaryTest.kt` - Unit test enforcing Android CHZZK backend boundary rules.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/DeviceRegistrationTest.kt` - Unit test for Android device registration behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubApiClientTest.kt` - Unit test for Android backend API client behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubCalendarDeepLinkPolicyTest.kt` - Unit test for hub calendar deep-link policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventImagePolicyTest.kt` - Unit test for Android hub event image policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsCalendarViewModelTest.kt` - Unit test for Android calendar view model behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsPolicyTest.kt` - Unit test for hub events display and policy behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ListDateNavigationPolicyTest.kt` - Unit test for list date navigation policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ListDateNavigationViewModelTest.kt` - Unit test for list date navigation view model behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/LiveMemberOrderingPolicyTest.kt` - Unit test for live member ordering.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainNavigationHistoryTest.kt` - Unit test for Android main navigation history.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt` - Unit test for Android main UI policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/NotificationLoadReductionAndroidTest.kt` - Unit test for Android notification load-reduction behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/PreferenceResolutionStateTest.kt` - Unit test for Android preference resolution state.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ServerHubRepositoryTest.kt` - Unit test for server-backed Android repository mapping.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/SongUiPolicyTest.kt` - Unit test for Android song tab navigation, song filters, and history relocation policy.

## iOS: `ios/StelliveHubiOS`

- `ios/StelliveHubiOS/Config/Default.xcconfig` - Default iOS build configuration values.
- `ios/StelliveHubiOS/StelliveHubiOS.xcodeproj/project.pbxproj` - Xcode project file.
- `ios/StelliveHubiOS/StelliveHubiOS.xcodeproj/xcshareddata/xcschemes/StelliveHubiOS.xcscheme` - Shared Xcode scheme for building and testing the iOS app.
- `ios/StelliveHubiOS/StelliveHubCalendarWidget/HubCalendarWidgetBundle.swift` - WidgetKit bundle entry point for the calendar widget.
- `ios/StelliveHubiOS/StelliveHubCalendarWidget/Info.plist` - Calendar widget extension property list.
- `ios/StelliveHubiOS/StelliveHubCalendarWidget/StelliveHubCalendarWidget.entitlements` - Calendar widget app group and capability entitlements.
- `ios/StelliveHubiOS/StelliveHubiOS/App.swift` - SwiftUI app entry point and root environment setup.
- `ios/StelliveHubiOS/StelliveHubiOS/Info.plist` - iOS app property list and runtime configuration keys.
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift` - Swift domain models for catalog, live status, preferences, notifications, and hub events.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/DeliveredNotificationCleanupService.swift` - Cleans delivered notifications according to retention/collapse rules.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/DeviceIDStore.swift` - Stores a stable anonymous iOS device ID.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift` - iOS backend API client.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubCalendarWidgetStore.swift` - Shared app-group storage for widget calendar snapshots.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift` - Local mock store for app state and previews.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/NotificationCollapsePolicy.swift` - Notification collapse/grouping policy.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/NotificationPayload.swift` - iOS push payload parser/model.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/NotificationPermissionService.swift` - Notification permission request and status service.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/NotificationSummaryTextPolicy.swift` - User-facing notification summary text policy.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/NotificationThreadPolicy.swift` - iOS notification thread/category grouping policy.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/PushTokenSyncer.swift` - APNs/FCM token sync logic with the backend.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/RealtimeStreamClient.swift` - Foreground realtime stream client.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift` - Server-backed store that maps backend DTOs into app state.
- `ios/StelliveHubiOS/StelliveHubiOS/StelliveHubiOS.entitlements` - Main iOS app entitlements.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/ContentView.swift` - Root SwiftUI view and tab/navigation composition.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HistoryView.swift` - Notification history screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HomeView.swift` - Home summary screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift` - Hub event detail screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift` - Calendar UI for hub events and special days.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift` - Calendar view model and date/filter state logic.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift` - Hub event list and navigation screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift` - Live status screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/MemberDetailView.swift` - Member detail screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/SettingsView.swift` - Notification settings and preference controls.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift` - Server-backed iOS song catalog screen that reuses existing grouped styling, toolbar behavior, and song filters.
- `ios/StelliveHubiOS/StelliveHubiOSTests/ChzzkBackendBoundaryTests.swift` - Tests iOS CHZZK backend-boundary assumptions.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift` - Tests iOS backend API client mapping.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubCalendarPolicyTests.swift` - Tests calendar display policy.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubCalendarStoreTests.swift` - Tests hub calendar store behavior.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubCalendarWidgetStoreTests.swift` - Tests widget snapshot storage.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift` - Tests calendar view model behavior.
- `ios/StelliveHubiOS/StelliveHubiOSTests/NotificationLoadReductionPolicyTests.swift` - Tests notification load-reduction policy on iOS.
- `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift` - Tests preference state modeling.
- `ios/StelliveHubiOS/StelliveHubiOSTests/ServerLiveStatusMappingTests.swift` - Tests backend live-status DTO mapping.
- `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift` - Tests iOS song tab navigation, song filters, and history relocation policy.
