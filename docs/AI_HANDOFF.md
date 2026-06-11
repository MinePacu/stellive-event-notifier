# AI Handoff

Copy this prompt into another Codex, ChatGPT, Copilot, or AI coding session before continuing work.

## Project Summary

Build an unofficial open-source Stellive notification hub with Android, iOS, and a lightweight TypeScript backend/control plane. The backend mediates external platform events, normalizes/deduplicates them, resolves user notification preferences, and sends pushes. Managed services or local Docker PostgreSQL may provide storage, scheduled jobs, and push infrastructure. Mobile apps provide settings, user-visible notification history, live status, foreground refresh, deep links, and local cache.

## Non-negotiable Rules

Former members are excluded from the MVP. No unauthorized images, official logos, fan art, captured images, secrets, private cafe scraping, login-cookie scraping, or platform terms bypasses. Prefer official APIs. Use placeholders and official API image URLs only with fallback behavior.

## Architecture Summary

API-first lightweight control plane with adapters for CHZZK, optional no-paid-API X support, and YouTube. Naver Cafe automatic collection is deferred. The MVP default path should not require self-hosted PostgreSQL/Redis, but Docker Compose is supported for local development and optional self-hosting. Use managed storage or local Docker PostgreSQL for devices, server-visible preferences, normalized events, dedupe keys, notification jobs, short-lived delivery attempts, live status, and delivery state. User-visible notification history is stored on device by default. Start the managed-first path with database-backed jobs; add Redis/BullMQ only if traffic requires it. Mobile foreground refresh is for UI updates, not background push replacement.

The `굿즈/행사` feed is planned as a separate hub event model for official-source, time-bound goods, ticketing, and offline event information. It excludes routine livestreams, uploads, ordinary posts, fan-hosted events, Gangzi/representative events, and unauthorized images/logos/posters.

For backend/API implementation work, use `docs/API_IMPLEMENTATION_PLAN.md` as the primary structure and sequencing reference before changing adapters, ingestion, database jobs, push delivery, or mobile-facing API contracts.

## Member Catalog Policy

Catalog entries are only `active` or `upcoming`. Former entries are not seeded. Unknown external handles stay `verify_required`.

## Gamja Category Policy

Gangzi is included as `catalogRole=representative`, `generationId=gamja`, `generationName=감자`, `roleLabel=스텔라이브 대표`. Do not place Gangzi in member generations.

## Official Channel Policy

The `official` category displays as `기타` and includes the Stellive official YouTube channel and X account. The official item is not a person.

## Asset/Image Policy

Repository assets must not include member/profile images, official logos, fan art, captured images, or copied CDN URLs. Use app-owned placeholder avatars and runtime API image URLs only when policy allows.

## Notification Policy

Support global, generation/category, individual item, platform, event type, generation-platform, generation-event-type, member-platform, and member-event-type preferences. Global off always wins. Individual explicit overrides can override generation/category settings. Quiet hours, keyword block, and rate limit always apply.

Notification load reduction is documented in `docs/NOTIFICATION_LOAD_REDUCTION_POLICY.md`. Future backend, Android, and iOS notification work must preserve the three delivery levels, spike downgrade controls, Android channel/group/update behavior, iOS thread/collapse/cleanup behavior, and the future 10-minute push cap consideration.

## Realtime Delivery Policy

`realtime_best_effort` is best-effort and never guaranteed. It applies only to allowed and realtime-eligible events such as CHZZK live started, X posts, YouTube uploads, official X posts, and official YouTube uploads. Naver Cafe is deferred; if reintroduced, it falls back to standard.

## Preference Resolution Policy

Resolve notification permission first, then resolve delivery mode. Realtime mode does not enable disabled notifications. Official YouTube live events are excluded before notification resolution.

## API/Secrets Policy

Secrets live only in environment variables. `.env.example` may name keys but must not include real values.

## CHZZK Open API Status

Backend OAuth, token metadata storage, live-status polling, live started/ended transition generation, repository-backed `/v1/live-status`, and the internal scheduler trigger are implemented on `codex/chzzk-open-api-code-implementation`. Main files are `chzzkAuthClient.ts`, `chzzkOAuthState.ts`, `chzzkApiClient.ts`, `chzzkOpenApiAdapter.ts`, `chzzkAuthRoutes.ts`, `internalRoutes.ts`, and `liveStatusRepository.ts` under `backend/stellive-hub-api/src`.

Android and iOS boundary tests enforce that CHZZK credentials and direct CHZZK hosts stay out of app source. Mobile apps consume normalized backend DTOs only.

Rollout tracking should update GitHub issue `#13` and GitLab work item `#8` with verification output, OAuth setup status, scheduler enablement status, and platform review notes before production enablement.

Remaining operational checks: register `https://<backend-public-origin>/v1/auth/chzzk/callback` and `http://localhost:4000/v1/auth/chzzk/callback`, set backend-only CHZZK OAuth environment variables, connect OAuth through `/v1/auth/chzzk/connect`, confirm token metadata exists in `PlatformApiState`, run `POST /v1/internal/schedulers/chzzk/live-status` with `INTERNAL_API_TOKEN`, then enable `CHZZK_LIVE_POLLING_ENABLED=true` only after adapter health and live-status cache freshness are verified.

## Current TODOs

- Verify latest official platform account IDs/handles from official sources.
- Replace mock adapters with official API integrations. X must remain disabled unless a no-cost official API path is confirmed.
- Connect Firebase projects for Android/iOS.
- Choose the first managed storage provider and database-backed job implementation.
- Keep Docker Compose working as a local development/self-hosting option.
- Add production authentication for preference sync and optional foreground refresh.
- Add admin tooling for avatar placeholder enforcement and catalog reloads.
`굿즈/행사` calendar implementation has started. Backend now exposes `GET /v1/hub-events/calendar` and `GET /v1/hub-events/widget-snapshot` as read-only projections of normalized `HubEvent` records, and bootstrap config exposes `hubCalendarEnabled: true` with X notifications disabled for MVP via `x_notifications_dropped_for_mvp`. Android and iOS now have shared calendar/widget DTOs and policy helpers for status ordering, date headers, and stale/empty widget text. Continue UI wiring from the existing Goods Events surfaces; do not add logos, posters, profile images, thumbnails, copied media, raw provider payloads, or direct widget platform API calls.

Follow-up implementation update: Android `MockHubRepository` now derives `HubCalendarDay` and `HubCalendarWidgetSnapshot` from existing `HubEvent` seed data, the Goods Events tab renders date-grouped calendar sections, and a standard `AppWidgetProvider` + RemoteViews widget is registered. iOS `MockHubStore` now derives calendar days and widget snapshots, `HubEventsView` renders date-grouped sections, and `HubCalendarWidgetStore` persists compact snapshots through the `group.dev.stellive.hub` app group. `StelliveHubCalendarWidget` is now wired as a WidgetKit extension target, embedded in the app target, and verified with simulator tests plus a widget scheme build.
