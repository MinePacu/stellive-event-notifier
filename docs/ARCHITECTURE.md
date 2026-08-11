# Architecture

## Hub Event Admin CRUD

`굿즈/행사` admin CRUD writes normalized `HubEvent` rows through the backend admin boundary. Drafts may be incomplete, but publishing requires policy validation for source, catalog scope, allowed categories/statuses, date windows, HTTPS URLs, asset-field rejection, Gangzi/gamja exclusion, and official YouTube live exclusion.

Public APIs return only published, non-deleted hub events. `HUB_EVENTS_STORAGE_MODE=memory` preserves seed-backed reads for local/test use, while `HUB_EVENTS_STORAGE_MODE=prisma` switches public reads to Prisma-backed `HubEvent` storage after migration.

Admin actions never send push directly. Every Hub event create/update/publication/deactivation/deletion or schedule mutation runs the Hub row write, audit snapshot, and every candidate `PlatformEvent` plus `NotificationJob` write in one database transaction. Candidate persistence is conflict-safe: an existing normalized event is left unchanged, while a missing job is repaired without resetting an existing queued, locked, failed, or completed job. Publish/update/cancel candidates still reach devices only through the existing preference-resolving worker path.

The MVP uses an API-first lightweight control plane as the default operating model. The backend still mediates event ingestion, normalization, dedupe, preference resolution, and push dispatch, but it should not require a self-hosted PostgreSQL/Redis stack for initial operation. Docker Compose remains supported for local development and optional self-hosting. Mobile apps own settings UI, local history/cache, live-status display, foreground refresh, and deep-link handling. Managed services may own storage, scheduled jobs, and push infrastructure.

## Backend

Fastify or serverless functions provide HTTP APIs and webhook/scheduler entry points. The MVP should start with managed storage such as Supabase/Firebase, local Docker PostgreSQL, or an equivalent low-cost database for devices, server-visible preferences, normalized events, live status, dedupe keys, notification jobs, short-lived delivery attempts, and delivery state.

Redis/BullMQ is optional, not an MVP requirement. Initial queue behavior can be represented by a database-backed `notification_jobs` table with retry state and priority. A Redis/BullMQ worker can be added later behind the same job adapter if traffic grows.

`NotificationJob.eventId` is unique, so one normalized event has at most one job lifecycle. Migration recovery retains duplicate jobs in `completed`, `locked`, `queued`, then `failed` order, with attempts and timestamps as deterministic tie-breakers. It automatically queues only immediate events received within the previous 15 minutes and future Hub schedule candidates; older immediate orphans remain visible in admin health diagnostics for explicit operator review. The overview reports the orphan count and oldest orphan `receivedAt`.

`backend/stellive-hub-api/docker-compose.yml` provides a local PostgreSQL/Redis/API stack for reproducible development and self-hosting experiments. It is not the default low-cost deployment requirement.

Production public read traffic can run across two to four stateless API workers. Scheduler loops and external API polling remain singleton processes, while music synchronization uses Redis ownership locks across API workers. Docker/Host Nginx, PM2, and systemd layouts are documented in [Backend API Scaling](BACKEND_SCALING.md).

See [API-First Lightweight Plan](API_FIRST_LIGHTWEIGHT_PLAN.md) for the current operating model.

## Embedded Admin Console

OCI admin operations live inside the existing Fastify backend rather than in a separate management app. `/admin` serves a lightweight same-origin console, and `/v1/internal/*` exposes bounded diagnostics and controlled trigger endpoints for overview, adapter health, notification job diagnostics, notification drain placeholders, WebSub subscription state, CHZZK/YouTube scheduler actions, live status cache, and recent delivery attempts.

The auth topology is intentionally split. `ADMIN_CONSOLE_ENABLED` controls only whether `/admin`, `/admin/login`, and `/admin/logout` are mounted. `/v1/internal/*` does not depend on that flag and remains independently available whenever `INTERNAL_API_TOKEN` is configured. `/admin` accepts either a valid admin session cookie created by `/admin/login` or a Bearer token matching `ADMIN_CONSOLE_TOKEN`, while the embedded UI separately uses `INTERNAL_API_TOKEN` when it calls `/v1/internal/*`.

Blank values and placeholders are not treated as valid configuration. Empty strings, `replace_with_*`, and `verify_required` leave the related admin route protection effectively unconfigured, so they do not enable `/admin` or authenticated `/v1/internal/*` access.

This surface is for diagnostics and controlled operational nudges only. It must not bypass normal ingestion, event guards, preference resolution, load-reduction policy, quiet hours, keyword filters, rate limits, or push dispatch boundaries. Manual actions are limited to the same backend-owned services the application already uses.

The admin surface also must not expose secrets or production device tokens. The overview route returns secret readiness only as configured-or-missing state, and diagnostics are limited to operational metadata rather than raw provider credentials or user device-token material.

## CHZZK Credential Boundary

CHZZK OAuth credentials, token refresh state, and Open API calls are backend-only. `chzzkAuthRoutes.ts` owns `/v1/auth/chzzk/connect` and `/v1/auth/chzzk/callback`, `chzzkApiClient.ts` reads token metadata from `PlatformApiState`, and `chzzkOpenApiAdapter.ts` produces normalized live-status updates and `chzzk_live_started`/`chzzk_live_ended` events through repository and ingestion boundaries.

Android and iOS never store CHZZK client secrets, access tokens, refresh tokens, Naver login cookies, or direct CHZZK API hosts in app source. Mobile apps use backend responses such as `/v1/live-status`, settings, history, and foreground refresh only. Boundary tests in each mobile project scan app source for forbidden CHZZK credential and private-host strings.

## Adapter Model

Adapters implement:
- `start()`
- `stop()`
- `healthCheck()`
- `normalize(raw)`
- `getDedupeKey(raw)`
- `supportsRealtime()`
- `recommendedDeliveryMode(event)`

Production adapters should use official APIs. Mock adapters mark `verify_required` areas and must not scrape private content.

Naver Cafe automatic collection is deferred. If it is reintroduced, it must be limited to public Search API results or another clearly allowed official path and treated as standard, not realtime, delivery.

## Hub Events

The `굿즈/행사` feed is separate from normalized platform activity. It contains official-source, time-bound goods, ticketing, and offline event information only. Routine CHZZK live status and YouTube uploads remain in live status, platform events, and notification history.

The MVP uses repository-managed seed data or a maintainer-controlled workflow. Future official API adapters must submit candidate hub events through the same validation boundary, including source URL, source label, source type, catalog checks, Gangzi/gamja exclusion, and asset-field rejection.

## Official Channel Handling

`stellive-official` is an `official_channel` item under `official`/`기타`. It supports `official_youtube_upload`. Official YouTube live scheduled/started/ended events are dropped before storage by `shouldDropEventBeforeStorage`.

## Preference Resolution

Every push decision goes through `PreferenceResolutionService` before delivery. It resolves notification permission first, then delivery mode. Realtime mode cannot override disabled notifications. Mobile apps may cache and edit settings locally, but delivery-critical settings such as global off, quiet hours, keyword rules, `realtime_best_effort`, and device tokens must sync to the backend/managed storage before they can affect push delivery.

## Realtime Pipeline

Allowed realtime-eligible events are placed in priority order:
1. CHZZK live started
2. YouTube/official YouTube uploads
3. Other allowed events

The MVP should prefer webhooks, safe polling, and database-backed jobs before long-running self-hosted streams. Foreground SSE/WebSocket endpoints are optional and exist for active UI refresh only. They do not replace background push.

## Mobile Cache

Android has Room/DataStore skeletons and FCM service placeholders. iOS has SwiftUI state and service skeletons; SwiftData/CoreData/SQLite can be added behind the same app-facing model boundary. User-visible notification history is stored on device by default. The server stores only normalized events, jobs, and short-lived delivery attempts needed for dedupe, retries, diagnostics, and rate-limit enforcement. Local storage is not the source of truth for server-side push authorization.
## Goods/Events Calendar And Widgets

The `굿즈/행사` calendar is a read-only projection of normalized `HubEvent` records. The backend exposes `GET /v1/hub-events/calendar` for date-grouped app views and `GET /v1/hub-events/widget-snapshot` for compact mobile widget caches. These DTOs intentionally exclude raw provider payloads, image URLs, official logos, posters, profile images, thumbnails, and copied media.

Android and iOS calendar widgets must render only cached `HubCalendarWidgetSnapshot` data produced by the app/backend flow. Widgets do not call platform APIs directly, do not send push notifications, and do not bypass user notification preferences.
