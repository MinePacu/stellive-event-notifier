# Architecture

The MVP uses an API-first lightweight control plane as the default operating model. The backend still mediates event ingestion, normalization, dedupe, preference resolution, and push dispatch, but it should not require a self-hosted PostgreSQL/Redis stack for initial operation. Docker Compose remains supported for local development and optional self-hosting. Mobile apps own settings UI, local history/cache, live-status display, foreground refresh, and deep-link handling. Managed services may own storage, scheduled jobs, and push infrastructure.

## Backend

Fastify or serverless functions provide HTTP APIs and webhook/scheduler entry points. The MVP should start with managed storage such as Supabase/Firebase, local Docker PostgreSQL, or an equivalent low-cost database for devices, server-visible preferences, normalized events, live status, dedupe keys, notification jobs, short-lived delivery attempts, and delivery state.

Redis/BullMQ is optional, not an MVP requirement. Initial queue behavior can be represented by a database-backed `notification_jobs` table with retry state and priority. A Redis/BullMQ worker can be added later behind the same job adapter if traffic grows.

`backend/stellive-hub-api/docker-compose.yml` provides a local PostgreSQL/Redis/API stack for reproducible development and self-hosting experiments. It is not the default low-cost deployment requirement.

See [API-First Lightweight Plan](API_FIRST_LIGHTWEIGHT_PLAN.md) for the current operating model.

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

## Official Channel Handling

`stellive-official` is an `official_channel` item under `official`/`기타`. It supports `official_x_post` and `official_youtube_upload`. Official YouTube live scheduled/started/ended events are dropped before storage by `shouldDropEventBeforeStorage`.

## Preference Resolution

Every push decision goes through `PreferenceResolutionService` before delivery. It resolves notification permission first, then delivery mode. Realtime mode cannot override disabled notifications. Mobile apps may cache and edit settings locally, but delivery-critical settings such as global off, quiet hours, keyword rules, `realtime_best_effort`, and device tokens must sync to the backend/managed storage before they can affect push delivery.

## Realtime Pipeline

Allowed realtime-eligible events are placed in priority order:
1. CHZZK live started
2. X/official X posts
3. YouTube/official YouTube uploads
4. Other allowed events

The MVP should prefer webhooks, safe polling, and database-backed jobs before long-running self-hosted streams. Foreground SSE/WebSocket endpoints are optional and exist for active UI refresh only. They do not replace background push.

## Mobile Cache

Android has Room/DataStore skeletons and FCM service placeholders. iOS has SwiftUI state and service skeletons; SwiftData/CoreData/SQLite can be added behind the same app-facing model boundary. User-visible notification history is stored on device by default. The server stores only normalized events, jobs, and short-lived delivery attempts needed for dedupe, retries, diagnostics, and rate-limit enforcement. Local storage is not the source of truth for server-side push authorization.
