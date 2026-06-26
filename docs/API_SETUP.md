# API Setup

## Operating Model

Use an API-first lightweight control plane for the MVP default operating path. Managed storage, database-backed jobs, FCM, and optional scheduled workers are preferred until traffic justifies dedicated infrastructure.

Docker Compose is still supported for reproducible local development and optional self-hosting. It may run PostgreSQL, Redis, and the API together, but production planning should not depend on that path while the project is trying to minimize cost and load on the existing OCI server.

## OCI Admin Console

The backend can serve a lightweight embedded admin console at `/admin` for controlled OCI operations. `/admin` is disabled by default and should be enabled only for maintainer access on a private path such as SSH tunneling, a VPN, or another restricted network route. If it is exposed more broadly, keep HTTPS in front of it and still require admin authentication.

Required environment variables for this surface:

- `ADMIN_CONSOLE_ENABLED=true` to register `/admin`.
- `ADMIN_CONSOLE_TOKEN` for the HTML admin console route.
- `ADMIN_CONSOLE_COOKIE_SECURE=true` when the console is served behind HTTPS and browser login cookies must include the `Secure` attribute.
- `INTERNAL_API_TOKEN` for `/v1/internal/*` JSON routes.
- `DATABASE_URL` and the existing adapter/push variables still govern what the console can actually inspect.

Auth topology:

- `ADMIN_CONSOLE_ENABLED` affects only whether `/admin`, `/admin/login`, and `/admin/logout` are registered.
- `/v1/internal/*` remains independently available when `INTERNAL_API_TOKEN` is configured, even if `/admin` is disabled.
- `/admin` can be opened from a normal browser through `GET /admin/login`. Login validates `ADMIN_CONSOLE_TOKEN` and sets a short-lived HttpOnly, SameSite=Strict cookie scoped to `/admin`.
- Bearer authentication still works for direct clients: `Authorization: Bearer <ADMIN_CONSOLE_TOKEN>`.
- The `/admin` page loads after either an admin session cookie or `ADMIN_CONSOLE_TOKEN` Bearer authentication. Its browser-side UI separately calls `/v1/internal/*` with `INTERNAL_API_TOKEN`, which the maintainer enters into the page.

Keep `ADMIN_CONSOLE_TOKEN` and `INTERNAL_API_TOKEN` as separate secrets. The current implementation authenticates `/admin` against `ADMIN_CONSOLE_TOKEN` and authenticates `/v1/internal/*` against `INTERNAL_API_TOKEN`. That separation keeps the browser console surface distinct from direct internal API access.

Blank, placeholder, or verification-placeholder values are treated as not configured. In practice, empty strings, `replace_with_*` placeholders, and `verify_required` do not enable `/admin` or `/v1/internal/*`.

The `/admin` page and `/v1/internal/*` routes are same-origin, no-CORS routes intended for controlled access from the backend's own origin. They are not meant to be called by arbitrary third-party browser code. Privileged routes intentionally disable CORS, and `/admin` serves a restrictive CSP plus no-store headers.

### Local Browser Check

After setting real local-only values for `ADMIN_CONSOLE_TOKEN` and `INTERNAL_API_TOKEN`, start the backend and open:

```text
http://localhost:4000/admin/login
```

Enter `ADMIN_CONSOLE_TOKEN` in the login page. After the console opens, enter `INTERNAL_API_TOKEN` in the `Internal API bearer token` field and click Refresh.

Do not pass either token in the URL query string. Query strings can appear in browser history, proxy logs, and server logs.

## CHZZK

Use CHZZK Developers/Open API or another documented allowed endpoint only. Current live progress display derives elapsed time from the official Live API start timestamp, normalized by backend as `LiveStatus.startedAt`; mobile apps must not call CHZZK directly or store CHZZK credentials. Live polling uses the Client-authenticated Open API `GET /open/v1/lives` endpoint and matches response `channelId` values against the catalog. Do not use login cookies, private endpoints, private WebSockets, `NID_AUT`, or `NID_SES`.

Register these redirect URLs in the CHZZK developer app only when OAuth connection testing is needed:

```text
https://<backend-public-origin>/v1/auth/chzzk/callback
http://localhost:4000/v1/auth/chzzk/callback
```

Backend environment variables:

```env
CHZZK_CLIENT_ID=
CHZZK_CLIENT_SECRET=
CHZZK_REDIRECT_URI=http://localhost:4000/v1/auth/chzzk/callback
CHZZK_OAUTH_SCOPES=
CHZZK_AUTH_STATE_SECRET=
CHZZK_OAUTH_ENABLED=false
CHZZK_ACCESS_TOKEN=
CHZZK_REFRESH_TOKEN=
CHZZK_TOKEN_REFRESH_SKEW_SECONDS=300
CHZZK_LIVE_POLLING_ENABLED=false
```

`CHZZK_CLIENT_ID` and `CHZZK_CLIENT_SECRET` are required for Client-authenticated live polling. `CHZZK_OAUTH_SCOPES`, `CHZZK_ACCESS_TOKEN`, and `CHZZK_REFRESH_TOKEN` are not required for the live-list polling path; keep OAuth configured only for future user-authorized CHZZK endpoints and manual connection testing.

OCI server-app CHZZK test:

1. Prepare the instance on Oracle Linux. Run on `PORT=4000`; prefer a HTTPS reverse-proxied public origin.
2. Confirm the CHZZK Developers application ID matches the app that owns the client ID/secret. The backend does not consume the application ID as an environment variable.
3. On the backend, set server-only values: `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `INTERNAL_API_TOKEN`, and `PORT=4000`. Set OAuth values only if OAuth connection testing is needed.
4. Keep `CHZZK_LIVE_POLLING_ENABLED=false` for first verification. Do not leave secrets in shell history, Git, app config, or logs.
5. Confirm firewall, Security List/NSG, and reverse proxy allow the app-facing public origin. `/v1/internal/*` must require maintainer token access.
6. Build and restart the backend.
7. Run `POST /v1/internal/schedulers/chzzk/live-status` with `INTERNAL_API_TOKEN`; it should use `CHZZK_CLIENT_ID` and `CHZZK_CLIENT_SECRET`, not OAuth access tokens.
8. Confirm `/v1/live-status` and `/v1/bootstrap` expose fresh normalized live status without provider token state or raw provider payloads.
9. Enable `CHZZK_LIVE_POLLING_ENABLED=true` only after scheduler health is not `verify_required` and live-status cache freshness is verified.
10. Use a platform scheduler or cron to call the internal route at the approved polling interval.
11. Monitor adapter health, live-status cache freshness, dedupe counts, and notification job volume before enabling realtime fan-out broadly.

## X

Design X integration as no-paid-API only. Use official X API paths only when the project can access them without paid API billing. If free official access is unavailable, unauthorized, rate-limited beyond usefulness, or requires paid billing, keep X disabled behind feature flags and do not generate X notifications. Do not implement scraping or login-cookie alternatives.

## YouTube

Use WebSub for upload notifications and YouTube Data API for limited fallback and live status where allowed. Stellive official YouTube channel `UC2b4WRE5BZ6SIUWBeJU8rwg` / `@stellive_official` supports upload notifications only in this MVP. Do not collect official YouTube live scheduled/started/ended notifications.

## Naver

Naver Cafe automatic collection is deferred for the MVP. Do not collect private cafe posts, login-only posts, cookie-authenticated pages, or regular cafe HTML pages.

If Naver Cafe support returns, use only Naver Search API `cafearticle` public search results or another clearly allowed official path. Treat it as standard best-effort delivery, not realtime.

## YouTube Music Sync

Stellive music sync uses YouTube Data API v3 from the backend only. Mobile clients must call `/v1/music` and related backend routes; they must not receive or use `YOUTUBE_API_KEY`.

Default sync calls:

- `playlistItems.list` with `part=snippet,contentDetails,status`, `maxResults=50`, `nextPageToken` pagination.
- `videos.list` with `part=snippet,contentDetails,status` in 50-id chunks when details are needed.
- `search.list` is not part of the default sync path because its quota cost is high.
- Official music catalog sync uses only COVER `PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy` and ORIGINAL `PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX`.

Environment variables:

```env
YOUTUBE_API_KEY=
YOUTUBE_API_BASE_URL=https://www.googleapis.com/youtube/v3
MUSIC_SYNC_ENABLED=false
MUSIC_CACHE_TTL_SECONDS=600
MUSIC_CACHE_STALE_SECONDS=600
MUSIC_SYNC_LOCK_SECONDS=30
LIGHT_SYNC_INTERVAL_MINUTES=10
FULL_SYNC_INTERVAL_MINUTES=60
STELLIVE_MUSIC_SYNC_INTERVAL_MINUTES=60
STELLIVE_MUSIC_COVER_PLAYLIST_ID=PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy
STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID=PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX
DAILY_RECONCILE_CRON=0 4 * * *
MUSIC_LIGHT_SYNC_MAX_PAGES=2
```

Manual trigger:

```bash
curl -H "Authorization: Bearer <INTERNAL_API_TOKEN>" \
  -H "content-type: application/json" \
  -d '{"mode":"light"}' \
  http://localhost:4000/v1/internal/schedulers/music/sync-official-playlists
```

Quota estimate:

```text
daily quota ≈ source_playlist count × fetched page count × daily sync runs
```

Keep source playlist IDs in DB/admin seed configuration. Do not guess playlist IDs in code, and do not persist raw YouTube payloads.

## Firebase

Use FCM for Android and iOS push delivery. iOS APNs is connected through Firebase initially. Keep service account credentials in environment variables or secret stores only.

## Realtime Mode

Realtime mode still respects API rate limits, platform terms, user settings, quiet hours, keyword filters, and rate limits.

## Hub Events Admin Storage

`HUB_EVENTS_STORAGE_MODE=memory` is the default for local development and tests. It keeps public `GET /v1/hub-events*` reads on the existing seed-backed service.

Set `HUB_EVENTS_STORAGE_MODE=prisma` only after the Prisma schema migration has been applied. In Prisma mode, public hub event reads return published, non-deleted `HubEvent` rows, while `/v1/admin/hub-events*` performs authenticated CRUD, validation, publication state changes, soft delete, and audit logging.

Admin publish/update/cancel actions may create normalized `PlatformEvent` notification candidates and enqueue `NotificationJob` rows. They do not send push directly and must still flow through preference resolution, quiet hours, load reduction, and worker delivery.
