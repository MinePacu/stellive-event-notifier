# API Setup

## Operating Model

Use an API-first lightweight control plane for the MVP default operating path. Managed storage, database-backed jobs, FCM, and optional scheduled workers are preferred until traffic justifies dedicated infrastructure.

Docker Compose is still supported for reproducible local development and optional self-hosting. It may run PostgreSQL, Redis, and the API together, but production planning should not depend on that path while the project is trying to minimize cost and load on the existing OCI server.

## CHZZK

Use official or documented allowed endpoints for live status and session events. Current live progress display should derive elapsed time from the official Live API `openDate` value, normalized by the backend as `LiveStatus.startedAt`; mobile apps must not call CHZZK directly or store CHZZK secrets. Do not use login cookies or bypass private endpoints. `CHZZK_API_KEY=verify_required` remains a placeholder until the allowed production method is confirmed.

## X

Use X API v2 Filtered Stream when available. Rules should be based on verified handles such as `from:StelLive_kr`. If streaming is unavailable, fallback polling must respect rate limits.

## YouTube

Use WebSub for upload notifications and YouTube Data API for limited fallback and live status where allowed. Stellive official YouTube channel `UC2b4WRE5BZ6SIUWBeJU8rwg` / `@stellive_official` supports upload notifications only in this MVP. Do not collect official YouTube live scheduled/started/ended notifications.

## Naver

Naver Cafe automatic collection is deferred for the MVP. Do not collect private cafe posts, login-only posts, cookie-authenticated pages, or regular cafe HTML pages.

If Naver Cafe support returns, use only Naver Search API `cafearticle` public search results or another clearly allowed official path. Treat it as standard best-effort delivery, not realtime.

## Firebase

Use FCM for Android and iOS push delivery. iOS APNs is connected through Firebase initially. Keep service account credentials in environment variables or secret stores only.

## Realtime Mode

Realtime mode still respects API rate limits, platform terms, user settings, quiet hours, keyword filters, and rate limits.
