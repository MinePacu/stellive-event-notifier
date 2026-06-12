# Mobile Server Communication Design

GitHub issue: https://github.com/MinePacu/stellive-event-notifier/issues/15
GitLab issue: https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/10

## Summary

Android and iOS currently render the main experience from local mock stores:
Android uses `MockHubRepository`, iOS uses `MockHubStore`, and the existing
network pieces are only partial boundaries such as Android `HubApi` and
foreground stream clients. The backend already exposes early `/v1/*` routes,
but several routes are in-memory or dev/mock-oriented and are not yet the
authoritative mobile data source.

This design connects both mobile apps to the backend through a server-first,
cache-backed communication layer. Mobile apps should load bootstrap data,
register the installation, send push tokens, sync notification preferences,
fetch live status and hub event projections, and use local/mock data only as a
fallback when server data is unavailable.

## Goals

- Make `/v1/bootstrap` the first mobile-facing source of catalog, feature
  config, preferences, live status summary, hub event summary, and realtime
  capability state.
- Register each app installation with `/v1/devices/register`.
- Send Android FCM and iOS APNs/FCM token updates to `/v1/devices/token`.
- Keep server-side user notification preferences authoritative.
- Replace mock-first mobile repositories with server-first repositories that
  retain local cache and deterministic fallback behavior.
- Keep external platform credentials, raw provider payloads, and protected API
  calls out of mobile apps.
- Ensure foreground realtime refresh is optional and authenticated; background
  delivery remains push-based.

## Non-Goals

- Do not implement external platform adapters as part of this issue.
- Do not implement the full push worker or FCM/APNs fan-out pipeline here.
- Do not add direct CHZZK, YouTube, X, Naver, or private community calls from
  mobile apps.
- Do not store production push tokens, OAuth tokens, service accounts, or
  platform secrets in the repository.
- Do not replace all local persistence at once; Room/UserDefaults/App Group
  caches remain useful for offline display and widgets.
- Do not require realtime streams for MVP. Polling/manual refresh may be the
  initial foreground refresh mode.

## Current State

- Android:
  - `HubApi` declares `registerDevice()` and `updateFcmToken()` only.
  - `StelliveFirebaseMessagingService.onNewToken()` contains a TODO for
    `/v1/devices/token`.
  - `MainActivity` directly uses `MockHubRepository`.
  - `ForegroundRealtimeClient` can open a WebSocket, but no authenticated API
    contract or UI integration is defined.
- iOS:
  - `StelliveHubApp` injects `MockHubStore`.
  - `RealtimeStreamClient` can start a `URLSessionWebSocketTask`, but no data
    decoding, auth, reconnect, or UI integration is defined.
  - Widget data is generated from mock-derived snapshots.
- Backend:
  - `/v1/bootstrap`, `/v1/devices/register`, `/v1/devices/token`,
    `/v1/live-status`, `/v1/hub-events`, and related routes exist in early form.
  - Some state remains in-memory and needs repository-backed persistence before
    it can be treated as authoritative.

## Design Principles

- Server-mediated by default: mobile apps call only the Stellive Hub backend.
- Cache-backed, not cache-authoritative: local data improves availability but
  does not override server preferences.
- Preferences first: global off, platform, event type, generation/category,
  member, quiet hours, keyword, and rate-limit decisions stay server-side for
  delivery and are mirrored client-side only for UI.
- Minimal payloads: mobile APIs should return normalized DTOs, not raw provider
  payloads.
- No secrets on mobile: CHZZK OAuth state, X bearer tokens, YouTube API keys,
  Firebase service accounts, and internal tokens remain backend-only.
- Graceful degradation: offline, server error, stale cache, and mock fallback
  states must be explicit and non-crashing.

## Alternatives Considered

### Option A: Directly replace mocks with live API calls

The simplest path is to make each screen call the backend directly and delete
most mock code. This reduces duplicate data paths but makes offline behavior,
widgets, loading states, and tests brittle.

Rejected for MVP because the app already has local mock-derived calendar,
widget, and settings surfaces that can become structured fallback/cache layers.

### Option B: Server-first repository with local cache fallback

Mobile repositories call the backend, persist the last successful snapshot, and
fall back to cached or deterministic seed data when offline. UI consumes a
single repository/store interface and can show freshness state.

Chosen. This keeps implementation incremental while moving authority to the
backend.

### Option C: Realtime-first foreground session

The app opens SSE/WebSocket immediately and streams all updates while active.

Deferred. Realtime is useful later, but MVP should first establish bootstrap,
device registration, token sync, preferences, and read APIs. Foreground streams
can be introduced as an optional enhancement once authentication and reconnect
rules are stable.

## Proposed Architecture

```text
Android / iOS
  App startup
    -> Mobile repository/store
      -> Hub API client
        -> GET /v1/bootstrap
        -> POST /v1/devices/register
        -> PUT /v1/devices/token
        -> GET/PUT /v1/preferences
        -> GET /v1/live-status
        -> GET /v1/hub-events/*
      -> Local cache
      -> Deterministic fallback data

Backend
  routes/appRoutes or routes/routes.ts
    -> deviceRepository
    -> preferenceRepository
    -> liveStatusRepository
    -> hubEventRepository/service
    -> platformApiStateRepository
```

The mobile API client should be thin. It owns request construction, JSON
decoding, retry classification, and auth headers. It should not own business
rules such as catalog eligibility, notification preference resolution, event
dedupe, or push priority.

## Mobile API Contract

### `GET /v1/bootstrap`

Purpose: first app snapshot.

Query:

```text
deviceId=<stable installation id, optional before registration>
appVersion=<client version>
platform=android|ios
locale=<BCP-47 locale>
timezone=<IANA timezone>
```

Response:

```ts
interface BootstrapResponse {
  config: {
    unofficialProject: true;
    catalogVersion: string;
    officialYoutubeLiveExcluded: true;
    xNotificationsEnabled: boolean;
    xDisabledReason?: string;
    hubCalendarEnabled: boolean;
    foregroundRealtimeEnabled: boolean;
  };
  device?: {
    deviceId: string;
    registered: boolean;
    tokenStatus?: "missing" | "active" | "invalid" | "expired";
  };
  catalog: {
    generations: Generation[];
    members: Member[];
  };
  preferences: UserNotificationPreference[];
  liveStatus: LiveStatus[];
  hubEventsSummary: HubEventsSummary;
  hubCalendarWidgetSnapshot?: HubCalendarWidgetSnapshot;
  serverTime: string;
}
```

Notes:

- Bootstrap may include compact hub event preview data, but full lists remain
  on dedicated hub event APIs.
- `members` must not include Former members.
- Gangzi remains `representative` under `gamja`.
- `official` displays as `기타`.
- Official YouTube live scheduled/started/ended states must never appear.

### `POST /v1/devices/register`

Purpose: register or refresh a mobile installation.

Request:

```ts
interface RegisterDeviceRequest {
  deviceId?: string;
  platform: "android" | "ios";
  appVersion?: string;
  locale?: string;
  timezone?: string;
  installationId?: string;
}
```

Response:

```ts
interface RegisterDeviceResponse {
  deviceId: string;
  registered: true;
  serverTime: string;
}
```

Rules:

- The server may issue a new `deviceId` when the client has none.
- Mobile stores `deviceId` in platform-local private storage.
- Re-registering the same installation should be idempotent.
- No production device token should be logged in plaintext.

### `PUT /v1/devices/token`

Purpose: update push provider token after registration or refresh.

Request:

```ts
interface UpdateDeviceTokenRequest {
  deviceId: string;
  platform: "android" | "ios";
  provider: "fcm" | "apns_via_fcm";
  token: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
}
```

Response:

```ts
interface UpdateDeviceTokenResponse {
  updated: true;
  tokenStatus: "active";
  serverTime: string;
}
```

Rules:

- Android uses FCM.
- iOS may use FCM/APNs through Firebase first, matching the backend push plan.
- Token update is a backend-only persistence concern; the token must not be
  committed, printed into docs, or stored in test fixtures.

### `GET /v1/preferences`

Purpose: read server-side preferences for the device.

Query:

```text
deviceId=<device id>
```

Response:

```ts
interface PreferencesResponse {
  deviceId: string;
  preferences: UserNotificationPreference[];
  updatedAt: string;
}
```

### `PUT /v1/preferences`

Purpose: upsert the full preference snapshot after user changes.

Request:

```ts
interface UpdatePreferencesRequest {
  deviceId: string;
  preferences: UserNotificationPreference[];
  clientUpdatedAt: string;
}
```

Response:

```ts
interface UpdatePreferencesResponse {
  deviceId: string;
  preferences: UserNotificationPreference[];
  updatedAt: string;
  conflict?: "server_newer" | "client_applied";
}
```

Conflict rule:

- MVP can use last-write-wins with `updatedAt`.
- The client must refetch on `server_newer`.
- Future account sync can replace device-scoped preferences without changing
  screen-level UI contracts.

### Read APIs Used After Bootstrap

```text
GET /v1/live-status?deviceId=<device id>
GET /v1/hub-events?category=&status=&generationId=&memberId=&from=&to=&cursor=&limit=
GET /v1/hub-events/:id
GET /v1/hub-events/calendar?from=&to=&filter=&limit=
GET /v1/hub-events/widget-snapshot?limit=
```

These APIs are read-only from mobile. Calendar and widget surfaces must not
send push notifications and must not bypass preference resolution.

### Foreground Realtime Endpoint

Deferred, but reserve the shape:

```text
GET /v1/realtime/foreground?deviceId=<device id>
```

Transport may be SSE before WebSocket because SSE is simpler for server push
summaries. If WebSocket remains preferred, it must use the same auth/session
model as other mobile APIs.

Foreground stream payloads must be normalized summaries:

```ts
interface ForegroundEventEnvelope {
  id: string;
  type:
    | "live_status_updated"
    | "hub_event_updated"
    | "preferences_updated"
    | "notification_history_updated";
  occurredAt: string;
  data: unknown;
}
```

The stream is for active UI refresh only. Background delivery remains FCM/APNs.

## Backend Persistence

The mobile communication layer needs durable repositories before the API can be
authoritative:

- `Device`
  - `id`
  - `platform`
  - `tokenStatus`
  - `lastSeenAt`
  - `appVersion`
  - `locale`
  - `timezone`
  - hashed or encrypted provider token reference
- `Preference`
  - `deviceId`
  - scope and target fields matching `UserNotificationPreference`
  - `enabled`
  - `updatedAt`
- Existing or planned `LiveStatus`, `HubEvent`, `PlatformEvent`,
  `NotificationJob`, and `DeliveryAttempt` repositories remain separate.

The route layer should not directly hold mobile state in module-level maps once
repository-backed implementations exist.

## Android Design

Add or evolve these boundaries:

```text
core/network/
  HubApi.kt
  HubApiClient.kt
  HubApiModels.kt
  HubNetworkResult.kt

core/device/
  DeviceIdStore.kt
  PushTokenSyncer.kt

feature/home/
  HubRepository.kt
  ServerHubRepository.kt
  MockHubRepository.kt
```

Flow:

1. `StelliveHubApplication` or first activity startup loads `deviceId`.
2. `ServerHubRepository.bootstrap()` calls `/v1/bootstrap`.
3. If no `deviceId`, call `/v1/devices/register`, persist returned id, then
   call bootstrap again or merge returned data.
4. `StelliveFirebaseMessagingService.onNewToken()` delegates to
   `PushTokenSyncer`, which sends `/v1/devices/token` once a `deviceId` exists.
5. Screens observe repository state, not `MockHubRepository` directly.
6. `MockHubRepository` remains test/dev fallback only.

State model:

```kotlin
sealed interface HubDataState {
    data object Loading : HubDataState
    data class Ready(
        val bootstrap: BootstrapSnapshot,
        val freshness: DataFreshness
    ) : HubDataState
    data class Fallback(
        val snapshot: BootstrapSnapshot,
        val reason: FallbackReason
    ) : HubDataState
    data class Unavailable(val reason: FallbackReason) : HubDataState
}
```

## iOS Design

Add or evolve these boundaries:

```text
Services/
  HubAPIClient.swift
  DeviceIDStore.swift
  PushTokenSyncer.swift
  ServerHubStore.swift
  MockHubStore.swift
```

Flow:

1. `StelliveHubApp` owns a store protocol rather than concrete `MockHubStore`.
2. `ServerHubStore.bootstrap()` calls `/v1/bootstrap`.
3. If the device is unregistered, call `/v1/devices/register` and persist the
   returned `deviceId` in Keychain or app-private storage.
4. Push token update calls `/v1/devices/token` when APNs/FCM token changes.
5. Widget snapshot is written from the last successful server-backed snapshot.
6. `MockHubStore` remains preview/test/fallback data, not the default runtime
   source.

State model:

```swift
enum HubDataState: Equatable {
    case loading
    case ready(BootstrapSnapshot, freshness: DataFreshness)
    case fallback(BootstrapSnapshot, reason: FallbackReason)
    case unavailable(reason: FallbackReason)
}
```

## Cache And Fallback Behavior

Cache the last successful bootstrap snapshot and hub event/widget snapshots.

Freshness states:

```text
fresh       server response within expected interval
stale       local cache shown after network failure
fallback    deterministic seed/mock data shown because no cache exists
unavailable no server response, no cache, and no safe fallback for the surface
```

UI rules:

- Home/live/settings may show stale cached data without blocking the app.
- Settings changes require a server write; if offline, either disable save or
  queue a clearly marked pending write. MVP should prefer disabling save while
  offline to avoid preference authority confusion.
- Widget may show last successful snapshot and existing stale text.
- Notification history can show local history, but server delivery settings
  remain authoritative.

## Authentication And Transport

MVP can start with anonymous device-scoped registration, but every request that
mutates device state should include:

```text
Authorization: Bearer <device session token>
```

If device session tokens are not ready in the first implementation, the design
must still keep token auth as the target contract and avoid exposing internal
admin tokens to mobile clients.

Transport rules:

- HTTPS required outside local development.
- Request timeout: short UI reads, longer bootstrap only if needed.
- Retry only idempotent reads automatically.
- Token updates and preference writes should use bounded retry with no
  plaintext token logging.
- Responses must include JSON error codes that mobile can map to fallback
  behavior.

## Error Codes

```text
device_not_registered
device_token_invalid
preference_conflict
catalog_version_unsupported
feature_disabled
rate_limited
server_unavailable
unauthorized
```

Mobile maps these to UI behavior:

- `device_not_registered`: run registration then retry once.
- `preference_conflict`: refetch preferences and ask user to retry change.
- `feature_disabled`: hide or disable the affected surface.
- `rate_limited`: keep cached state and retry later.
- `server_unavailable`: use stale cache/fallback.
- `unauthorized`: clear device session and re-register.

## Migration Plan

### Phase 1: Contracts And Repositories

- Define shared DTOs for bootstrap, device registration, token update, and
  preferences.
- Update `shared/openapi/openapi.yaml`.
- Add or finalize backend repositories for devices and preferences.
- Keep route tests network-free.

### Phase 2: Backend Mobile Routes

- Make `/v1/devices/register` durable and idempotent.
- Make `/v1/devices/token` persist token metadata safely.
- Make `/v1/bootstrap` assemble catalog, config, preferences, live status, and
  hub event summaries from repositories/services.
- Add `GET/PUT /v1/preferences`.

### Phase 3: Android Integration

- Add `HubApiClient` implementation.
- Add `DeviceIdStore` and `PushTokenSyncer`.
- Replace direct `MockHubRepository` usage with a repository interface.
- Use server data first and mock/cache fallback second.
- Add unit tests for registration, token sync, bootstrap fallback, and no direct
  platform secret/host access.

### Phase 4: iOS Integration

- Add `HubAPIClient`, `DeviceIDStore`, and `PushTokenSyncer`.
- Replace concrete `MockHubStore` app injection with a runtime server-backed
  store.
- Persist widget snapshot from server-backed data.
- Add XCTest coverage for registration, token sync, bootstrap fallback, widget
  snapshot cache, and no direct platform secret/host access.

### Phase 5: Foreground Refresh

- Add manual refresh and polling first.
- Add authenticated SSE/WebSocket only after device session auth and reconnect
  behavior are stable.

## Test Plan

Backend:

```bash
cd backend/stellive-hub-api
npm test -- routes preferences device bootstrap
npm run build
```

Android:

```bash
cd android/StelliveHubAndroid
./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.*Network*
./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.*Device*
```

iOS:

```bash
xcodebuild test \
  -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj \
  -scheme StelliveHubiOS \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:StelliveHubiOSTests/HubAPIClientTests \
  -only-testing:StelliveHubiOSTests/DeviceRegistrationTests
```

Cross-cutting assertions:

- Former members never appear in bootstrap catalog.
- Gangzi remains under `gamja` as representative.
- Official category displays as `기타`.
- Official YouTube live scheduled/started/ended events do not appear.
- Mobile apps contain no CHZZK, YouTube, X, Naver, Firebase service account, or
  internal admin secrets.
- Global off and preference settings remain authoritative on the server.
- Offline startup does not crash.

## Acceptance Criteria

- New installs register with the backend and persist a returned `deviceId`.
- Android FCM token refresh calls `/v1/devices/token` after registration.
- iOS push token refresh has an equivalent token sync path.
- App startup uses `/v1/bootstrap` before mock data.
- Server-provided catalog, preferences, live status, and hub event summary are
  reflected in the mobile repository/store.
- Server failure uses stale cache or deterministic fallback without crashing.
- Preference writes go to the backend and refresh local UI from the accepted
  server snapshot.
- No secrets, production device tokens, raw provider payloads, image binaries,
  official logos, fan art, or captured images are committed.

## Open Questions

- Should the first implementation use anonymous device session tokens, or wait
  until account support exists?
- Should iOS send APNs tokens directly to the backend or use FCM registration
  tokens only for the MVP?
- Should settings writes be queued offline or blocked until the backend is
  reachable?
- Should foreground refresh start as polling or SSE?

Recommended MVP answers:

- Use anonymous device session tokens.
- Use FCM for both Android and iOS first, with APNs priority controlled through
  FCM/APNs headers on the backend.
- Block settings writes while offline and show cached read-only state.
- Start with manual refresh plus polling; add SSE/WebSocket later.
