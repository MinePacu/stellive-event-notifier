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

## Current TODOs

- Verify latest official platform account IDs/handles from official sources.
- Replace mock adapters with official API integrations. X must remain disabled unless a no-cost official API path is confirmed.
- Connect Firebase projects for Android/iOS.
- Choose the first managed storage provider and database-backed job implementation.
- Keep Docker Compose working as a local development/self-hosting option.
- Add production authentication for preference sync and optional foreground refresh.
- Add admin tooling for avatar placeholder enforcement and catalog reloads.
