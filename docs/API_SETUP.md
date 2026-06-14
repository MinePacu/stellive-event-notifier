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

Use CHZZK Developers/Open API or another documented allowed endpoint only. Current live progress display derives elapsed time from the official Live API start timestamp, normalized by the backend as `LiveStatus.startedAt`; mobile apps must not call CHZZK directly or store CHZZK credentials. Do not use login cookies, private endpoints, private WebSockets, `NID_AUT`, or `NID_SES`.

Register these redirect URLs in the CHZZK developer app:

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

OCI server-app CHZZK test:

1. Prepare the OCI instance on Oracle Linux. Run the backend on `PORT=4000`; for app testing, prefer a HTTPS reverse-proxied public origin.
2. In CHZZK Developers, confirm the application ID matches the app that owns the client ID/secret. The backend does not consume application ID as an env var; keep it as console verification metadata only.
3. Register `https://<oci-public-origin>/v1/auth/chzzk/callback` in CHZZK Developers. Add `http://localhost:4000/v1/auth/chzzk/callback` only for SSH-tunnel tests.
4. On the OCI backend, set server-only env values: `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `CHZZK_REDIRECT_URI=https://<oci-public-origin>/v1/auth/chzzk/callback`, `CHZZK_OAUTH_SCOPES` with the official CHZZK scope string selected in Developers, `CHZZK_AUTH_STATE_SECRET`, `CHZZK_OAUTH_ENABLED=true`, `INTERNAL_API_TOKEN`, and `PORT=4000`.
5. Keep `CHZZK_LIVE_POLLING_ENABLED=false` for first verification. Do not leave secrets in shell history, Git, app config, or logs.
6. Confirm Oracle Linux firewall, OCI Security List/NSG, and reverse proxy allow the app-facing public origin. `/v1/internal/*` is not for public browser calls and must require maintainer token access.
7. Build and restart the deployed backend after syncing source: `npm install`, `npm run build`, then `npm start` or the equivalent systemd/Docker restart. The running process uses `dist/backend/stellive-hub-api/src/index.js`; syncing source alone is not enough.
8. Open `https://<oci-public-origin>/v1/auth/chzzk/start` in a maintainer-controlled browser and complete OAuth. Current code registers `/start`, not `/connect`.
9. Call `POST https://<oci-public-origin>/v1/internal/schedulers/chzzk/live-status` with `Authorization: Bearer <INTERNAL_API_TOKEN>`.
10. Confirm `GET https://<oci-public-origin>/v1/live-status` and `GET https://<oci-public-origin>/v1/bootstrap?platform=ios` or `?platform=android` return normalized `liveStatus` rows without CHZZK tokens, OAuth state, or raw provider payloads.
11. Put no CHZZK credentials in apps. Set Android `HUB_BASE_URL` and iOS `HUB_BASE_URL` to `https://<oci-public-origin>/` only.
12. Launch the app and check the live page. If bootstrap succeeds, app state comes from server `liveStatus`; if the API fails, fallback mock state remains.
13. Enable `CHZZK_LIVE_POLLING_ENABLED=true` only after OAuth metadata exists, scheduler health is not `verify_required`, and live-status cache freshness is verified.

OAuth connect flow:

1. Set `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `CHZZK_REDIRECT_URI`, `CHZZK_OAUTH_SCOPES`, and `CHZZK_AUTH_STATE_SECRET` on the backend. Re-run OAuth after changing scopes because existing tokens do not gain new permissions.
2. Set `CHZZK_OAUTH_ENABLED=true` only after the redirect URL is registered.
3. Open `/v1/auth/chzzk/start` from a maintainer-controlled browser session or the private admin console.
4. CHZZK redirects to `/v1/auth/chzzk/callback`; the backend exchanges the code and stores token metadata in `PlatformApiState`.
5. Confirm `/v1/internal/admin/overview` reports CHZZK credential readiness without exposing token values.

Scheduler enablement order:

1. Keep `CHZZK_LIVE_POLLING_ENABLED=false` until OAuth is connected and the live-status endpoint scope is verified.
2. Run `POST /v1/internal/schedulers/chzzk/live-status` with `INTERNAL_API_TOKEN`; it should return `verify_required` if token metadata is absent.
3. Confirm `/v1/live-status` and `/v1/bootstrap` expose fresh normalized live status without provider token state or raw provider payloads.
4. Enable `CHZZK_LIVE_POLLING_ENABLED=true` only after the scheduler can read stored OAuth state and the adapter health is not `verify_required`.
5. Use a platform scheduler or cron to call the internal route at the approved polling interval.
6. Monitor adapter health, live-status cache freshness, dedupe counts, and notification job volume before enabling realtime fan-out broadly.

## X

Design X integration as no-paid-API only. Use official X API paths only when the project can access them without paid API billing. If free official access is unavailable, unauthorized, rate-limited beyond usefulness, or requires paid billing, keep X disabled behind feature flags and do not generate X notifications. Do not implement scraping or login-cookie alternatives.

## YouTube

Use WebSub for upload notifications and YouTube Data API for limited fallback and live status where allowed. Stellive official YouTube channel `UC2b4WRE5BZ6SIUWBeJU8rwg` / `@stellive_official` supports upload notifications only in this MVP. Do not collect official YouTube live scheduled/started/ended notifications.

## Naver

Naver Cafe automatic collection is deferred for the MVP. Do not collect private cafe posts, login-only posts, cookie-authenticated pages, or regular cafe HTML pages.

If Naver Cafe support returns, use only Naver Search API `cafearticle` public search results or another clearly allowed official path. Treat it as standard best-effort delivery, not realtime.

## Firebase

Use FCM for Android and iOS push delivery. iOS APNs is connected through Firebase initially. Keep service account credentials in environment variables or secret stores only.

## Realtime Mode

Realtime mode still respects API rate limits, platform terms, user settings, quiet hours, keyword filters, and rate limits.

## Hub Events Admin Storage

`HUB_EVENTS_STORAGE_MODE=memory` is the default for local development and tests. It keeps public `GET /v1/hub-events*` reads on the existing seed-backed service.

Set `HUB_EVENTS_STORAGE_MODE=prisma` only after the Prisma schema migration has been applied. In Prisma mode, public hub event reads return published, non-deleted `HubEvent` rows, while `/v1/admin/hub-events*` performs authenticated CRUD, validation, publication state changes, soft delete, and audit logging.

Admin publish/update/cancel actions may create normalized `PlatformEvent` notification candidates and enqueue `NotificationJob` rows. They do not send push directly and must still flow through preference resolution, quiet hours, load reduction, and worker delivery.
