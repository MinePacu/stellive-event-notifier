# API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current mock-heavy Stellive Notification Hub backend with a server-mediated, official-API-first event ingestion, normalization, deduplication, preference enforcement, and push delivery pipeline.

**Architecture:** Mobile apps own settings UI, local notification history, local cache, deep links, and foreground display. The backend owns protected platform API access, event ingestion, dedupe, authoritative preference enforcement, database-backed notification jobs, and FCM/APNs push fan-out. The MVP should use a database-backed queue first; Redis/BullMQ can be introduced later behind the same job interface.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Firebase Admin SDK, Vitest, Docker Compose for local development.

---

## Design Constraints

- Do not include Former members in the MVP catalog, notification targets, filters, seed data, tests, or UI.
- Gangzi must remain a `representative` entry under the `gamja` category only.
- The `official` category is displayed as `기타` and includes Stellive official YouTube and X notification targets.
- Stellive official YouTube may produce `official_youtube_upload` only. Do not create official YouTube live scheduled, started, or ended notifications.
- Use official APIs or clearly allowed documented platform paths only.
- Do not implement login-cookie scraping, private Cafe collection, regular HTML scraping, access bypasses, or long-term storage of raw private platform payloads.
- User notification preferences are authoritative. `global=false` blocks every notification.
- `realtime_best_effort` changes delivery strategy only for already-allowed events. It never turns disabled notifications back on.
- `chzzk_chat` is off by default and must not produce push delivery without explicit user filters.

## Current Code Context

- Backend root: `backend/stellive-hub-api`
- App routes: `backend/stellive-hub-api/src/routes/routes.ts`
- Adapter interface: `backend/stellive-hub-api/src/adapters/eventAdapter.ts`
- Mock adapter: `backend/stellive-hub-api/src/adapters/mockAdapters.ts`
- Preference resolution: `backend/stellive-hub-api/src/preferences/preferenceResolution.ts`
- Realtime queue mock: `backend/stellive-hub-api/src/realtime/realtimeDeliveryService.ts`
- Event guards: `backend/stellive-hub-api/src/events/eventGuards.ts`
- Prisma schema: `backend/stellive-hub-api/prisma/schema.prisma`
- Shared domain types: `shared/schemas/domain.ts`
- OpenAPI draft: `shared/openapi/openapi.yaml`

The current route layer still relies on in-memory state and mock event paths. Before adding production platform adapters, split storage, ingestion, jobs, and push delivery so external adapters do not directly own preference resolution or push behavior.

## Target Backend Structure

```text
backend/stellive-hub-api/src/
  adapters/
    eventAdapter.ts
    youtube/
      youtubeWebSubAdapter.ts
      youtubeDataApiClient.ts
      youtubeAtomParser.ts
    x/
      xFilteredStreamAdapter.ts
      xPollingAdapter.ts
      xApiClient.ts
    chzzk/
      chzzkOpenApiAdapter.ts
      chzzkApiClient.ts
    naver/
      naverCafeSearchAdapter.ts
      naverSearchClient.ts
  config/
    env.ts
    featureFlags.ts
  events/
    eventGuards.ts
    ingestionService.ts
    platformEventFactory.ts
  jobs/
    notificationJobRepository.ts
    dbNotificationQueue.ts
    notificationWorker.ts
  push/
    fcmClient.ts
    pushPayloadFactory.ts
    pushSender.ts
  repositories/
    deviceRepository.ts
    eventRepository.ts
    liveStatusRepository.ts
    preferenceRepository.ts
    platformApiStateRepository.ts
  routes/
    appRoutes.ts
    webhookRoutes.ts
    internalRoutes.ts
    routes.ts
  storage/
    prisma.ts
```

## Responsibility Boundaries

| Area | Responsibility |
| --- | --- |
| `adapters/*` | External API calls, webhook/stream/poll raw event receipt, platform-specific DTO validation. |
| `events/ingestionService.ts` | Adapter result intake, catalog validation, unsupported event drop, dedupe, `PlatformEvent` persistence, notification job creation. |
| `repositories/*` | Prisma access encapsulation so routes and workers do not depend on database details. |
| `jobs/*` | Database-backed `notification_jobs` enqueue, claim, retry, expire, and complete behavior. |
| `preferences/*` | Keep `PreferenceResolutionService` independent from storage. |
| `push/*` | Firebase Admin initialization, Android/iOS payload creation, priority decisions, provider result capture. |
| `routes/appRoutes.ts` | Mobile-facing bootstrap, device registration, preferences, live status, hub events, and foreground stream. |
| `routes/webhookRoutes.ts` | YouTube WebSub verification/receipt and future external webhooks. |
| `routes/internalRoutes.ts` | Scheduler triggers, worker triggers, health, diagnostics. Protect with an internal token or platform IAM. |

## Platform API Plan

### YouTube

**Allowed path**

- Primary collection: YouTube WebSub callback.
- Fallback: YouTube Data API, only for limited metadata recovery.
- Stellive official YouTube supports upload notifications only.

**Rules**

- WebSub GET verification must return `hub.challenge` exactly.
- WebSub POST Atom feeds must parse only the necessary fields: `yt:videoId`, `yt:channelId`, title, published, updated, and link.
- Match `channelId` to catalog `youtubeChannelId`.
- If `memberId === "stellive-official"`, create only `official_youtube_upload`.
- Official channel live scheduled, started, and ended events must be dropped before storage.
- Use dedupe keys shaped as `youtube:<eventType>:<channelId>:<videoId>`.
- Do not store the full raw Atom payload long term. Store minimal parser status and identifiers when diagnostics are needed.

**Environment variables**

```env
YOUTUBE_API_KEY=
YOUTUBE_WEBSUB_CALLBACK_URL=
YOUTUBE_WEBSUB_VERIFY_TOKEN=
```

### X

**Allowed path**

- X integration is optional and must be designed as no-paid-API only.
- Use official X API paths only when the project can access them without paid API billing.
- If no free official API access is available, keep the adapter disabled and produce no X notifications.
- Do not design MVP notification delivery around paid X API plans, paid quota increases, or paid realtime stream access.
- If a no-cost official path is available, prefer the lowest-volume mechanism that respects rate limits. Realtime X delivery is allowed only when the free official path supports it.

**Rules**

- Build API rules or polling targets only from verified `xHandle` values in the member catalog.
- Keep queries account-scoped, for example `from:StelLive_kr -is:retweet`.
- Do not open a stream connection unless the official API access is confirmed to be free for this project.
- If free official access is unavailable, rate-limited beyond usefulness, unauthorized, or requires paid billing, report adapter health as `disabled` with reason `x_no_free_official_api` and stop producing events.
- Use dedupe keys shaped as `x:<eventType>:<authorId>:<tweetId>`.
- Treat media URLs as runtime display URLs only. Do not store image binaries.

**Environment variables**

```env
X_BEARER_TOKEN=
X_API_COST_POLICY=no_paid_api
X_FREE_API_ENABLED=false
X_FREE_STREAM_ENABLED=false
X_FREE_POLLING_ENABLED=false
```

### CHZZK

**Allowed path**

- Use CHZZK Developers/Open API or another documented allowed API only.
- Keep production live status collection in `verify_required` until the allowed scope and endpoint are confirmed.
- Do not implement unofficial private endpoints, login cookies, `NID_AUT`/`NID_SES`, or private WebSocket/session bypasses.
- Keep CHZZK credentials and OAuth token state backend-only. Android and iOS receive normalized live-status DTOs from the backend and must not store CHZZK credential names, token values, or direct CHZZK host calls in app source.

**Implemented files**

- `backend/stellive-hub-api/src/adapters/chzzk/chzzkAuthClient.ts` builds the authorization URL and exchanges OAuth codes for tokens.
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOAuthState.ts` signs and verifies OAuth state.
- `backend/stellive-hub-api/src/routes/chzzkAuthRoutes.ts` exposes `/v1/auth/chzzk/connect` and `/v1/auth/chzzk/callback`.
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts` reads token metadata from `PlatformApiState`, refreshes tokens when needed, and normalizes allowed live-status responses.
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts` polls catalog CHZZK channel IDs, updates live-status cache, and emits started/ended platform events.
- `backend/stellive-hub-api/src/routes/internalRoutes.ts` exposes `POST /v1/internal/schedulers/chzzk/live-status`.
- `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts` stores normalized cache rows used by `/v1/live-status`.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ChzzkBackendBoundaryTest.kt` and `ios/StelliveHubiOS/StelliveHubiOSTests/ChzzkBackendBoundaryTests.swift` enforce the mobile backend boundary.

**Rules**

- Query live status by catalog `chzzkChannelId` only for active/upcoming `member` and `representative` catalog entries.
- Skip former entries, official channels, and catalog entries without CHZZK channel IDs.
- Create `chzzk_live_started` when a live transition is detected.
- Fill `LiveStatus.startedAt` only when the official API provides a broadcast start timestamp.
- Create `chzzk_live_ended` by comparing cached `live_status.isLive=true` with the latest allowed API response.
- Do not collect `chzzk_chat` for MVP push delivery. If official chat APIs are added later, push still requires explicit user filters.
- Use dedupe keys shaped as `chzzk:<eventType>:<channelId>:<startedAt-or-observed-bucket>`.

**Environment variables**

```env
CHZZK_CLIENT_ID=
CHZZK_CLIENT_SECRET=
CHZZK_REDIRECT_URI=http://localhost:4000/v1/auth/chzzk/callback
CHZZK_AUTH_STATE_SECRET=
CHZZK_OAUTH_ENABLED=false
CHZZK_ACCESS_TOKEN=
CHZZK_REFRESH_TOKEN=
CHZZK_TOKEN_REFRESH_SKEW_SECONDS=300
CHZZK_LIVE_POLLING_ENABLED=false
```

### Naver Cafe

**MVP decision**

- Do not implement automatic Cafe collection in the MVP.
- If Cafe support returns later, use only Naver Search API `cafearticle` or another clearly allowed official path.
- Cafe events are not realtime eligible and must use `standard` delivery only.

**Rules**

- Do not collect private Cafe posts, member-only posts, login-cookie pages, or regular Cafe HTML pages.
- Search-result based events have lower confidence. Store a verification state and prefer in-app candidates over push for low-confidence results.
- Use dedupe keys shaped as `naver_cafe:cafe_post:<linkHash>`.

**Environment variables**

```env
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NAVER_CAFE_SEARCH_ENABLED=false
```

### Firebase Cloud Messaging

**Allowed path**

- Use Firebase Admin SDK from the trusted backend.
- Send iOS pushes through FCM/APNs first.

**Rules**

- Store production device tokens only in the database or secret-managed backend storage. Never commit them.
- Use Android high priority only when `realtime_best_effort` applies and a user-visible push is actually sent.
- Set iOS APNs priority through APNs headers. Do not use high-priority silent data-only messages.
- Keep push payloads minimal: `eventId`, `source`, `eventType`, `memberId`, `generationId`, `tapAction`, `appDeepLink`, `platformUrl`.
- Generate title/body from normalized events. Do not forward raw provider payloads into push messages.

**Environment variables**

```env
FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=
```

## Database Model Plan

Add the following Prisma models or equivalent fields.

### `PlatformApiState`

Stores stream cursors, polling cursors, WebSub subscription state, and rate-limit state.

```prisma
model PlatformApiState {
  id        String   @id @default(cuid(2))
  source    String
  key       String
  value     Json
  status    String
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  @@unique([source, key])
  @@index([source, status])
}
```

### `NotificationJob`

Database-backed notification queue. Redis/BullMQ can replace the internals later without changing the worker contract.

```prisma
model NotificationJob {
  id        String   @id @default(cuid(2))
  eventId   String
  priority  Int
  status    String
  runAfter  DateTime @default(now())
  lockedAt  DateTime?
  lockedBy  String?
  attempts  Int      @default(0)
  lastError String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, runAfter, priority])
  @@index([eventId])
}
```

### `WebhookSubscription`

Tracks YouTube WebSub renewal and diagnostics.

```prisma
model WebhookSubscription {
  id             String   @id @default(cuid(2))
  source         String
  targetId       String
  callbackUrl    String
  topicUrl       String
  status         String
  leaseExpiresAt DateTime?
  lastVerifiedAt DateTime?
  lastError      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([source, targetId, topicUrl])
  @@index([source, status])
}
```

### Existing model additions

- `Device`: add `tokenStatus`, `lastSeenAt`, `appVersion`.
- `PlatformEvent`: replace long-term raw payload storage with `rawPayloadHash`, `sourceVerificationState`, and `metadata Json?`.
- `DeliveryAttempt`: use `providerMessageId`, `providerErrorCode`, and `expiresAt`.
- `LiveStatus`: add `sourceVerificationState` and `lastTransitionAt`.

## Internal Event Flow

1. External API webhook, stream, polling job, or scheduler produces a raw event.
2. The adapter validates it into a platform-specific DTO.
3. `ingestionService` validates catalog target and event type.
4. `shouldDropEventBeforeStorage` drops forbidden events, including official YouTube live events.
5. `eventRepository` checks the dedupe key.
6. New events are stored as normalized `PlatformEvent` records.
7. `notificationJobRepository` creates a job for the event.
8. A worker claims the job.
9. The worker loads eligible devices and preferences.
10. `PreferenceResolutionService` applies global off, generation/member/platform/event-type rules, quiet hours, keyword rules, and rate limits.
11. `resolveNotificationDelivery` decides `immediate_push`, `summary_push`, or `in_app_history_only`.
12. `pushSender` creates and sends the FCM payload.
13. `DeliveryAttempt` records `sent`, `skipped`, or `failed` status.
14. Foreground SSE sends active-UI summaries only. It does not replace background push.

## Mobile-Facing API Plan

### Existing endpoints to keep and harden

- `GET /v1/bootstrap`: return catalog, config, preferences, realtime status, and hub events summary.
- `POST /v1/devices/register`: create or refresh anonymous device registration.
- `PUT /v1/devices/token`: update FCM token with platform, app version, locale, and timezone.
- `GET /v1/preferences`: return server-side device preferences.
- `PUT /v1/preferences`: upsert a full preference snapshot. Validate scope combinations with Zod.
- `GET /v1/preferences/resolved`: keep as dev/test only or move under `/v1/dev/*`.
- `GET /v1/live-status`: return CHZZK live status cache. Mobile apps must not call CHZZK directly.
- `GET /v1/events/stream`: foreground SSE. Add authentication and device validation.
- `GET /v1/notifications/delivery-attempts`: protect as dev diagnostics only.

Current mobile API backend status:
- Shared mobile DTOs live in `shared/schemas/mobileApi.ts` and OpenAPI includes bootstrap, device, token, and preference schemas.
- `backend/stellive-hub-api/src/routes/appRoutes.ts` owns `GET /v1/bootstrap`, `POST /v1/devices/register`, `PUT /v1/devices/token`, `GET /v1/preferences`, and `PUT /v1/preferences`.
- `DeviceRepository`, `PreferenceRepository`, and `BootstrapService` provide the server-side boundaries for mobile registration, preference snapshots, and bootstrap assembly.
- Verified with `rtk npm run build` and `rtk npm test` in `backend/stellive-hub-api`.

### New endpoints

- `GET /v1/webhooks/youtube`: verify WebSub challenge.
- `POST /v1/webhooks/youtube`: receive WebSub Atom feed.
- `POST /v1/internal/schedulers/youtube/renew-subscriptions`: renew WebSub leases.
- `POST /v1/internal/schedulers/chzzk/live-status`: trigger CHZZK live status polling.
- `POST /v1/internal/schedulers/x/poll`: trigger X fallback polling.
- `POST /v1/internal/jobs/notifications/drain`: trigger database-backed job worker drain.
- `GET /v1/internal/adapters/health`: report adapter health as `enabled`, `disabled`, `verify_required`, or `rate_limited`.

Internal endpoints require `INTERNAL_API_TOKEN` or deployment-platform IAM protection.

## Implementation Phases

### Phase 1: Split Foundation Layers

- [ ] Add `config/env.ts` and validate all environment variables with Zod.
- [ ] Add a Prisma client singleton in `storage/prisma.ts`.
- [ ] Add `repositories/*` and replace in-memory route state with repository calls.
- [ ] Add Prisma models for `NotificationJob`, `PlatformApiState`, and `WebhookSubscription`.
- [ ] Generate Prisma client and keep the current test suite passing.

Validation:

```bash
cd backend/stellive-hub-api
npm run prisma:generate
npm test
```

### Phase 2: Add the Ingestion Pipeline

- [ ] Add source-specific `PlatformEvent` builders in `events/platformEventFactory.ts`.
- [ ] Add `events/ingestionService.ts` as the single catalog validation, guard, dedupe, storage, and job enqueue entry point.
- [ ] Route mock adapters through `ingestionService`.
- [ ] Add tests for official YouTube live drop, unsupported member event drop, and dedupe skip.

Validation:

```bash
cd backend/stellive-hub-api
npm test -- event
```

### Phase 3: Add DB Jobs and Push Sender

- [ ] Implement enqueue, claim, complete, and fail-with-retry behavior in `jobs/dbNotificationQueue.ts`.
- [ ] Implement preference resolution, load reduction, FCM send, and delivery attempt recording in `jobs/notificationWorker.ts`.
- [ ] Add Android/iOS payload construction in `push/pushPayloadFactory.ts`.
- [ ] Add Firebase Admin initialization and fake sender injection in `push/fcmClient.ts`.
- [ ] Add tests for global off, quiet hours, realtime priority, summary downgrade, and failed retry.

Validation:

```bash
cd backend/stellive-hub-api
npm test -- notification
```

### Phase 4: Implement YouTube WebSub

- [ ] Parse Atom feeds in `youtubeAtomParser.ts` and extract only required fields.
- [ ] Implement callback GET/POST behavior in `youtubeWebSubAdapter.ts`.
- [ ] Add `/v1/webhooks/youtube` routes in `webhookRoutes.ts`.
- [ ] Normalize official channel uploads to `official_youtube_upload` and member uploads to `youtube_upload`.
- [ ] Add tests proving official channel live events are not stored.

Validation:

```bash
cd backend/stellive-hub-api
npm test -- youtube
```

### Phase 5: Implement CHZZK Live Status

- [ ] Keep `chzzkApiClient.ts` limited to official Open API authentication and live status calls.
- [ ] If a production-allowed endpoint is not confirmed, return `verify_required` and produce no events.
- [ ] Compute live started and live ended transitions in `chzzkOpenApiAdapter.ts`.
- [ ] Switch `/v1/live-status` to database-backed cache.
- [ ] Preserve tests that require `startedAt` only when an official start timestamp exists.

Validation:

```bash
cd backend/stellive-hub-api
npm test -- liveStatus
```

### Phase 6: Implement No-Paid-API X Integration

- [ ] Add `X_API_COST_POLICY=no_paid_api` validation in `config/env.ts`.
- [ ] Add `xApiClient.ts` with bearer token handling, timeout, 429 backoff, and rate-limit header tracking, but only allow calls when `X_FREE_API_ENABLED=true`.
- [ ] Start `xFilteredStreamAdapter.ts` only when `X_FREE_STREAM_ENABLED=true` and the configured access is confirmed to be free.
- [ ] Add limited no-cost polling in `xPollingAdapter.ts` only when `X_FREE_POLLING_ENABLED=true`; otherwise return disabled health with `x_no_free_official_api`.
- [ ] Store `since_id`, rate-limit reset time, stream health, and `costPolicy` in `PlatformApiState`.
- [ ] Add tests proving paid-required access disables the adapter, no X notifications are produced, and only verified handles become targets when free access is enabled.

Validation:

```bash
cd backend/stellive-hub-api
npm test -- x
```

### Phase 7: Add Deferred Naver Cafe Adapter

- [ ] Implement `naverCafeSearchAdapter.ts` as disabled by default.
- [ ] When disabled, return adapter health with `disabled` and a clear reason.
- [ ] When enabled, process only Naver Search API public results.
- [ ] Force Cafe events to `realtimeEligible=false` and `deliveryMode=standard`.

Validation:

```bash
cd backend/stellive-hub-api
npm test -- naver
```

### Phase 8: Update Contracts and Docs

- [ ] Update `shared/openapi/openapi.yaml` with webhook, internal scheduler, and device token schemas.
- [ ] Update `docs/API_SETUP.md` with new environment variables and feature flags.
- [ ] Update `docs/ARCHITECTURE.md` with repository, job queue, and push sender boundaries.
- [ ] Add new variable names to `.env.example` without real secrets.

Validation:

```bash
cd backend/stellive-hub-api
npm run build
npm test
```

## Testing Strategy

- Adapter tests must run without network access by using fixture raw events.
- Repository tests should use a Prisma test database or transaction rollback.
- Worker tests should inject a fake FCM sender and verify delivery decisions without provider calls.
- Official YouTube live exclusion must be covered at adapter, ingestion guard, and catalog policy boundaries.
- CHZZK and X must have safe feature-flag-off behavior because access, cost, and allowed endpoints can change.
- X tests must prove the adapter remains disabled when the only available official path requires paid API billing.
- `chzzk_chat` must remain skipped without explicit filters.

## Runtime Feature Flags

```env
YOUTUBE_WEBSUB_ENABLED=true
YOUTUBE_DATA_API_FALLBACK_ENABLED=false
X_API_COST_POLICY=no_paid_api
X_FREE_API_ENABLED=false
X_FREE_STREAM_ENABLED=false
X_FREE_POLLING_ENABLED=false
CHZZK_LIVE_POLLING_ENABLED=false
NAVER_CAFE_SEARCH_ENABLED=false
DB_NOTIFICATION_QUEUE_ENABLED=true
FOREGROUND_SSE_ENABLED=false
```

Default MVP flags should minimize cost and platform-policy risk. X must remain disabled unless no-cost official API access is confirmed. Enable external integrations one at a time only after API access, rate limits, and billing constraints are confirmed.

## Security and Policy Checklist

- [ ] Do not commit real API secrets, OAuth tokens, Firebase service accounts, or production device tokens.
- [ ] Do not store raw private platform responses.
- [ ] Do not commit image binaries, official logos, fan art, or screenshots as app assets.
- [ ] Treat platform image URLs as runtime display URLs with fallback behavior.
- [ ] Drop official YouTube live events before storage.
- [ ] Ensure global off blocks every push.
- [ ] Ensure realtime mode does not bypass quiet hours, keyword rules, rate limits, or disabled preferences.
- [ ] Ensure X integration does not require, recommend, or assume paid API billing.
- [ ] Ensure no Naver Cafe private/login-only collection path exists.
- [ ] Ensure internal scheduler/worker endpoints are not publicly callable.

## Official References

- [YouTube Data API WebSub push notifications](https://developers.google.com/youtube/v3/guides/push_notifications)
- [X API rate limits](https://docs.x.com/x-api/fundamentals/rate-limits)
- [CHZZK Developers](https://developers.chzzk.naver.com/)
- [CHZZK Open API authorization](https://chzzk.gitbook.io/chzzk/chzzk-api/authorization)
- [CHZZK Open API tips](https://chzzk.gitbook.io/chzzk/chzzk-api/tips)
- [Firebase Cloud Messaging server environment](https://firebase.google.com/docs/cloud-messaging/server-environment)
- [Firebase Cloud Messaging message priority](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-priority)
Calendar update: `GET /v1/hub-events/calendar` and `GET /v1/hub-events/widget-snapshot` expose read-only `HubEvent` projections for the `굿즈/행사` app calendar and Android/iOS cached widgets. X notification ingestion and delivery remain disabled for MVP; keep no-paid API flags false unless a verified no-cost official path is confirmed. Calendar/widget DTOs must stay text-first and must not include raw payloads, provider responses, image URLs, logos, posters, profile images, thumbnails, or copied media.
