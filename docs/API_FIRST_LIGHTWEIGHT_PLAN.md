# API-First Lightweight Plan

## Decision

The MVP should use an API-first, lightweight backend control plane as the default operating model. Docker Compose remains supported for local development and optional self-hosting, but the project should not require a self-hosted all-in-one server that owns PostgreSQL, Redis, queues, and long-running realtime streams by default.

The backend still mediates notification delivery. Mobile apps must not call protected platform APIs directly, store long-lived platform credentials, or try to replace server-side push fan-out with background polling. The lightweight backend keeps the policy-critical responsibilities while delegating storage, push delivery, and optional scheduling to low-cost managed services where possible.

## Goals

- Keep initial operating cost close to zero.
- Avoid adding meaningful load to the existing OCI instance that already runs a Minecraft server.
- Use official or allowed platform APIs only.
- Preserve server-side enforcement for user notification preferences before push delivery.
- Keep the architecture able to grow into dedicated workers, Redis, and managed PostgreSQL later.

## Non-Goals

- Do not require `docker compose up` with local PostgreSQL and Redis for the MVP default path.
- Do support Docker Compose as a reproducible local development and self-hosting option.
- Do not implement app-only background polling for production notifications.
- Do not store protected API keys, OAuth tokens, Firebase service account credentials, or production device tokens in the repository.
- Do not use unauthorized crawling, login-cookie scraping, private cafe collection, or platform access bypasses.

## Recommended MVP Stack

- **Mobile apps:** Android and iOS store local settings, user-visible notification history, live status cache, and UI state.
- **Thin API/control plane:** A small TypeScript service or serverless functions receive app sync requests, webhook events, and scheduled checks.
- **Managed storage:** Supabase Free, Firebase, local Docker PostgreSQL, or another database stores device registrations, server-visible preferences, dedupe keys, normalized events, notification jobs, short-lived delivery attempts, and delivery state.
- **Push delivery:** Firebase Cloud Messaging sends Android pushes and bridges to APNs for iOS initially.
- **Queue substitute:** Start the managed-first path with a database-backed `notification_jobs` table instead of Redis/BullMQ.
- **Docker option:** Keep `backend/stellive-hub-api/docker-compose.yml` available for developers who want local PostgreSQL/Redis and a full local API stack.
- **Optional scheduler:** Cloudflare Workers Cron, Firebase scheduled functions, GitHub Actions cron, or a very small OCI worker triggers safe polling where webhooks/streams are unavailable.

## Responsibility Split

| Area | Mobile app | Lightweight backend / managed services |
| --- | --- | --- |
| Settings UI | Owns display and editing | Stores synced authoritative copy for delivery decisions |
| Global off | Cached locally | Enforced before every push |
| `realtime_best_effort` | User-facing setting | Selects delivery strategy and priority where allowed |
| Quiet hours | Display and local cache | Enforced before every push |
| Keyword rules | Display and local cache | Enforced before every push |
| Device tokens | Temporarily receives token from OS | Stores token for FCM/APNs targeting |
| Event dedupe | May dedupe local history | Owns cross-user and cross-device dedupe |
| Notification history | Owns user-visible history by default | Does not store long-term user history in the MVP |
| Delivery state | Shows status when available | Owns queued/sent/failed/retried state |

## Event Collection Strategy

- **YouTube:** Prefer WebSub for uploads. Use YouTube Data API fallback sparingly. Stellive official YouTube supports upload notifications only; official YouTube live scheduled/started/ended events are excluded.
- **CHZZK:** Use official or documented allowed APIs only. For live progress display, normalize official Live API `openDate` to `LiveStatus.startedAt` on the backend and let mobile apps calculate elapsed time locally. Unknown or unverified endpoints remain `verify_required`.
- **Naver Cafe:** Defer automatic collection for now. If it returns later, limit it to public Search API results or another clearly allowed official path. Do not scrape cafe pages, use login cookies, or monitor member-only/private posts.

## Data Model Direction

The initial managed database should support these logical tables or collections:

- `devices`: app instance id, platform, push token, user/session id, token status, last seen time.
- `notification_preferences`: scoped user preferences for global, generation/category, member/item, platform, event type, and specific combinations.
- `events`: normalized platform events with dedupe key, platform, event type, target item, title/body/url, timestamps, and source verification state.
- `notification_jobs`: pending fan-out jobs with priority, allowed delivery mode, retry count, and state.
- `delivery_attempts`: short-lived technical records for push attempts, retry diagnostics, and abuse/rate-limit auditing.
- `live_status`: current live/upload/status summary used by app bootstrap and foreground refresh.

Redis/BullMQ can be added later by replacing the database-backed job adapter, not by rewriting event adapters or preference resolution.

User-visible notification history is stored on device by default. Android should use Room; iOS should use SwiftData, Core Data, or SQLite behind the app-facing history model. Server-side history sync is not part of the MVP.

## Delivery Flow

1. Platform webhook, stream, or scheduler produces a raw event.
2. Adapter normalizes the event and computes a dedupe key.
3. Guard rules drop unsupported events before storage, including official YouTube live events.
4. The event is stored only as normalized/minimized data.
5. A notification job is created.
6. The worker resolves user preferences in batches.
7. Global off, platform rules, event type rules, generation/member rules, quiet hours, keyword rules, rate limits, and realtime eligibility are applied.
8. Allowed pushes are sent through FCM.
9. Delivery status and short-lived delivery attempts are recorded with retention limits.
10. The mobile app writes received/opened notification records to local history.

## Growth Path

- **Stage 1:** Managed database + FCM + DB-backed jobs + optional scheduler, with Docker Compose available for local development.
- **Stage 2:** Split polling/webhook handling from push fan-out workers.
- **Stage 3:** Add Upstash Redis, QStash, or Redis/BullMQ if DB-backed jobs become a bottleneck.
- **Stage 4:** Move to managed PostgreSQL/Redis or a dedicated self-hosted stack if traffic outgrows free tiers.

## Testing Plan

- Unit-test preference resolution independently from storage.
- Unit-test event guards, especially official YouTube live exclusion.
- Unit-test dedupe key generation per adapter.
- Integration-test the database-backed job adapter with fake FCM sender.
- Add contract tests for mobile preference sync payloads.

## Open Decisions

- Choose the first managed database provider for MVP.
- Choose whether the first thin backend runs on the existing OCI instance, serverless functions, or Docker self-hosting.
- Decide retention windows for normalized event records and short-lived delivery attempts.
- Confirm the allowed production CHZZK API method.
- Decide whether Naver Cafe should remain deferred permanently or return as public Search API-only support.
