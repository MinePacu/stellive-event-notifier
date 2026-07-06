# Mobile Server Communication Code Design

Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement GitHub issue #15 and GitLab work item #10 by replacing mock-first Android/iOS runtime data flow with a server-first, cache-backed mobile communication layer.

**Architecture:** The backend owns durable device registration, push token metadata, preference snapshots, bootstrap assembly, and mobile read APIs. Android and iOS use thin API clients plus repository/store adapters that prefer server snapshots and fall back to local cache or deterministic mock data. Foreground realtime remains optional and deferred until authenticated device sessions are stable.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Vitest, OpenAPI, Kotlin, Retrofit, Moshi, OkHttp, Coroutines, DataStore or SharedPreferences, JUnit, Swift, SwiftUI, URLSession, XCTest, WidgetKit/App Groups.

## Source Documents

- Feature design: `docs/superpowers/specs/2026-06-11-mobile-server-communication-design.md`
- GitHub issue: https://github.com/MinePacu/stellive-event-notifier/issues/15
- GitLab work item: https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/10
- Project rules: `docs/PROJECT_RULES.md`
- Notification policy: `docs/NOTIFICATION_POLICY.md`
- Realtime policy: `docs/REALTIME_DELIVERY.md`
- API implementation plan: `docs/API_IMPLEMENTATION_PLAN.md`
- Handoff: `docs/AI_HANDOFF.md`

## Non-Negotiable Constraints

- Do not introduce Former members into bootstrap catalog, filters, seed data, tests, or UI.
- Keep Gangzi only as `catalogRole: "representative"` under `generationId: "gamja"`.
- Keep `official` displayed as `기타`.
- Do not create or expose official YouTube live scheduled/started/ended events.
- Do not add direct CHZZK, YouTube, X, Naver, Cafe, or private community API calls from Android or iOS.
- Do not commit real push tokens, API secrets, OAuth tokens, service accounts, raw provider payloads, profile image binaries, official logos, fan art, screenshots, or copied media.
- Server-side preferences remain authoritative. Mobile mirrors them for UI only.
- `realtime_best_effort` must never bypass disabled preferences, quiet hours, rate limits, OS policies, or push provider rules.

## High-Level Code Shape

```text
shared/
  schemas/
    domain.ts
    mobileApi.ts
  openapi/
    openapi.yaml

backend/stellive-hub-api/src/
  repositories/
    deviceRepository.ts
    preferenceRepository.ts
  routes/
    appRoutes.ts
    routes.ts
  mobile/
    bootstrapService.ts
    mobileError.ts

android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/
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

ios/StelliveHubiOS/StelliveHubiOS/
  Services/
    HubAPIClient.swift
    DeviceIDStore.swift
    PushTokenSyncer.swift
    ServerHubStore.swift
    MockHubStore.swift
```

`routes.ts` may continue to register routes during migration, but the code design should extract mobile-facing route logic into `routes/appRoutes.ts` once the contracts are stable. Existing route behavior should remain compatible during the transition.

## Shared Contract

Create a shared contract file for mobile API DTOs. Keep it type-only unless the repo already uses runtime schema validation for shared files.

**Create:** `shared/schemas/mobileApi.ts`

```ts
import type {
  Generation,
  HubCalendarWidgetSnapshot,
  HubEventsSummary,
  LiveStatus,
  Member,
  UserNotificationPreference,
} from "./domain.js";

export type MobilePlatform = "android" | "ios";
export type PushTokenProvider = "fcm" | "apns_via_fcm";
export type DeviceTokenStatus = "missing" | "active" | "invalid" | "expired";

export interface MobileConfig {
  unofficialProject: true;
  catalogVersion: string;
  officialYoutubeLiveExcluded: true;
  xNotificationsEnabled: boolean;
  xDisabledReason?: string;
  hubCalendarEnabled: boolean;
  foregroundRealtimeEnabled: boolean;
}

export interface BootstrapResponse {
  config: MobileConfig;
  device?: {
    deviceId: string;
    registered: boolean;
    tokenStatus?: DeviceTokenStatus;
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

export interface RegisterDeviceRequest {
  deviceId?: string;
  platform: MobilePlatform;
  appVersion?: string;
  locale?: string;
  timezone?: string;
  installationId?: string;
}

export interface RegisterDeviceResponse {
  deviceId: string;
  registered: true;
  serverTime: string;
}

export interface UpdateDeviceTokenRequest {
  deviceId: string;
  platform: MobilePlatform;
  provider: PushTokenProvider;
  token: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
}

export interface UpdateDeviceTokenResponse {
  updated: true;
  tokenStatus: "active";
  serverTime: string;
}

export interface PreferencesResponse {
  deviceId: string;
  preferences: UserNotificationPreference[];
  updatedAt: string;
}

export interface UpdatePreferencesRequest {
  deviceId: string;
  preferences: UserNotificationPreference[];
  clientUpdatedAt: string;
}

export interface UpdatePreferencesResponse {
  deviceId: string;
  preferences: UserNotificationPreference[];
  updatedAt: string;
  conflict?: "server_newer" | "client_applied";
}
```

Update `shared/schemas/domain.ts` only if current exported types do not include the fields needed by bootstrap. Do not add image, logo, poster, raw provider payload, or direct platform credential fields.

## Backend Code Design

### Repository Boundaries

**Create:** `backend/stellive-hub-api/src/repositories/deviceRepository.ts`

Responsibilities:

- Upsert anonymous mobile installations.
- Persist platform, locale, timezone, app version, last seen timestamp.
- Store push token metadata safely.
- Return `tokenStatus` without exposing raw token values.

Preferred public interface:

```ts
export interface DeviceRegistrationInput {
  deviceId?: string;
  platform: "android" | "ios";
  appVersion?: string;
  locale?: string;
  timezone?: string;
  installationId?: string;
}

export interface DeviceTokenInput {
  deviceId: string;
  platform: "android" | "ios";
  provider: "fcm" | "apns_via_fcm";
  token: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
}

export default class DeviceRepository {
  register(input: DeviceRegistrationInput): Promise<{ deviceId: string; registered: true }>;
  updateToken(input: DeviceTokenInput): Promise<{ updated: true; tokenStatus: "active" }>;
  getDevice(deviceId: string): Promise<{ deviceId: string; tokenStatus: string } | undefined>;
}
```

Implementation notes:

- Use existing Prisma `Device` model first.
- Store token in `deviceToken` only if that is the current schema field. Do not log it.
- If hashing/encryption is added later, keep `DeviceRepository` as the only caller-facing boundary so route/mobile code does not change.
- `lastSeenAt` should update on registration and token update.

**Create:** `backend/stellive-hub-api/src/repositories/preferenceRepository.ts`

Responsibilities:

- Return server-side preferences for a device.
- Upsert full preference snapshots.
- Keep `PreferenceResolutionService` independent from database details.

Preferred public interface:

```ts
import type { UserNotificationPreference } from "../types.js";

export default class PreferenceRepository {
  listForDevice(deviceId: string): Promise<UserNotificationPreference[]>;
  replaceForDevice(input: {
    deviceId: string;
    preferences: UserNotificationPreference[];
    clientUpdatedAt: string;
  }): Promise<{ preferences: UserNotificationPreference[]; updatedAt: string }>;
}
```

Implementation notes:

- Use existing Prisma `NotificationPreference` model.
- Preserve the exact `UserNotificationPreference` shape expected by `PreferenceResolutionService`.
- Do not infer enabled defaults in the repository. Defaults belong in catalog/bootstrap policy or shared preference setup helpers.

### Bootstrap Service

**Create:** `backend/stellive-hub-api/src/mobile/bootstrapService.ts`

Responsibilities:

- Assemble `BootstrapResponse`.
- Keep catalog filtering and feature flags centralized.
- Prefer repository-backed live status and hub events.
- Never include raw provider payloads or secret state.

Preferred public interface:

```ts
export interface BootstrapServiceDependencies {
  catalog: CatalogService;
  devices: DeviceRepository;
  preferences: PreferenceRepository;
  liveStatus: LiveStatusRepository;
  hubEvents: HubEventService;
  clock?: () => Date;
}

export default class BootstrapService {
  getBootstrap(input: {
    deviceId?: string;
    platform?: "android" | "ios";
    appVersion?: string;
    locale?: string;
    timezone?: string;
  }): Promise<BootstrapResponse>;
}
```

Rules:

- `config.officialYoutubeLiveExcluded` is always `true`.
- `config.xNotificationsEnabled` remains `false` for MVP unless the no-paid official API decision changes in a separate issue.
- `catalog.members` must contain only `active` or `upcoming` entries.
- `liveStatus` returns normalized `LiveStatus[]` only.
- `hubCalendarWidgetSnapshot` is optional and uses existing `HubEventService`/calendar projection.

### Mobile Error Helpers

**Create:** `backend/stellive-hub-api/src/mobile/mobileError.ts`

```ts
export type MobileErrorCode =
  | "device_not_registered"
  | "device_token_invalid"
  | "preference_conflict"
  | "catalog_version_unsupported"
  | "feature_disabled"
  | "rate_limited"
  | "server_unavailable"
  | "unauthorized";

export function mobileError(code: MobileErrorCode, statusCode: number) {
  return { statusCode, payload: { error: code } };
}
```

Use this only for mobile-facing routes. Do not leak internal route/admin errors to mobile.

### Routes

**Create:** `backend/stellive-hub-api/src/routes/appRoutes.ts`

Route list:

```text
GET /v1/bootstrap
POST /v1/devices/register
PUT /v1/devices/token
GET /v1/preferences
PUT /v1/preferences
```

Implementation rules:

- All request bodies are validated with Zod or narrow manual validators.
- `/v1/devices/token` rejects missing `deviceId`, missing `token`, or unsupported `provider`.
- `/v1/preferences` rejects missing `deviceId`.
- Keep dev/mock endpoints under `/v1/dev/*` separate from production mobile routes.
- `routes.ts` should either delegate these routes to `registerAppRoutes()` or be split so mobile routes are no longer mixed with dev-only logic.

Modify `backend/stellive-hub-api/src/app.ts`:

- Add app route dependency injection for `DeviceRepository`, `PreferenceRepository`, and `BootstrapService`.
- Keep tests able to inject fakes without database access.

Modify `backend/stellive-hub-api/src/routes/routes.ts`:

- Remove or delegate mobile route bodies that currently use module-level maps.
- Keep `/v1/hub-events/*`, `/v1/live-status`, and `/v1/dev/*` behavior stable while migrating.

## Android Code Design

### Network DTOs

**Create:** `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`

Define Moshi DTOs matching `shared/schemas/mobileApi.ts`. Use serial names where JSON keys differ from Kotlin names.

Core DTOs:

```kotlin
data class BootstrapResponseDto(
    val config: MobileConfigDto,
    val device: BootstrapDeviceDto?,
    val catalog: BootstrapCatalogDto,
    val preferences: List<PreferenceDto>,
    val liveStatus: List<LiveStatusDto>,
    val hubEventsSummary: HubEventsSummaryDto,
    val hubCalendarWidgetSnapshot: HubCalendarWidgetSnapshotDto?,
    val serverTime: String
)

data class MobileConfigDto(
    val unofficialProject: Boolean,
    val catalogVersion: String,
    val officialYoutubeLiveExcluded: Boolean,
    val xNotificationsEnabled: Boolean,
    val xDisabledReason: String?,
    val hubCalendarEnabled: Boolean,
    val foregroundRealtimeEnabled: Boolean
)

data class RegisterDeviceRequestDto(
    val deviceId: String?,
    val platform: String = "android",
    val appVersion: String?,
    val locale: String?,
    val timezone: String?,
    val installationId: String?
)

data class RegisterDeviceResponseDto(
    val deviceId: String,
    val registered: Boolean,
    val serverTime: String
)

data class UpdateDeviceTokenRequestDto(
    val deviceId: String,
    val platform: String = "android",
    val provider: String = "fcm",
    val token: String,
    val appVersion: String?,
    val locale: String?,
    val timezone: String?
)

data class UpdateDeviceTokenResponseDto(
    val updated: Boolean,
    val tokenStatus: String,
    val serverTime: String
)

data class PreferencesResponseDto(
    val deviceId: String,
    val preferences: List<PreferenceDto>,
    val updatedAt: String
)

data class UpdatePreferencesRequestDto(
    val deviceId: String,
    val preferences: List<PreferenceDto>,
    val clientUpdatedAt: String
)

data class UpdatePreferencesResponseDto(
    val deviceId: String,
    val preferences: List<PreferenceDto>,
    val updatedAt: String,
    val conflict: String?
)
```

Mapping rules:

- Convert DTOs into existing `GenerationFilter`, `HubMember`, `NotificationSettingsState`, `HubEvent`, `HubCalendarWidgetSnapshot`, and `LiveStatus` models where possible.
- Unknown enum values map to a safe disabled/unsupported state rather than crashing.
- Do not add direct platform host constants to mobile DTOs.

### Retrofit API

**Modify:** `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`

Replace the placeholder interface with Retrofit definitions:

```kotlin
interface HubApi {
    @GET("v1/bootstrap")
    suspend fun bootstrap(
        @Query("deviceId") deviceId: String?,
        @Query("platform") platform: String = "android",
        @Query("appVersion") appVersion: String?,
        @Query("locale") locale: String?,
        @Query("timezone") timezone: String?
    ): BootstrapResponseDto

    @POST("v1/devices/register")
    suspend fun registerDevice(@Body request: RegisterDeviceRequestDto): RegisterDeviceResponseDto

    @PUT("v1/devices/token")
    suspend fun updateDeviceToken(@Body request: UpdateDeviceTokenRequestDto): UpdateDeviceTokenResponseDto

    @GET("v1/preferences")
    suspend fun preferences(@Query("deviceId") deviceId: String): PreferencesResponseDto

    @PUT("v1/preferences")
    suspend fun updatePreferences(@Body request: UpdatePreferencesRequestDto): UpdatePreferencesResponseDto
}
```

**Create:** `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiClient.kt`

Responsibilities:

- Build Retrofit with base URL from build config or resource config.
- Add JSON converter.
- Convert exceptions into `HubNetworkResult`.
- Do not log request bodies for token routes.

**Create:** `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubNetworkResult.kt`

```kotlin
sealed interface HubNetworkResult<out T> {
    data class Success<T>(val value: T) : HubNetworkResult<T>
    data class Failure(val code: String?, val throwable: Throwable? = null) : HubNetworkResult<Nothing>
}
```

### Device Registration

**Create:** `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/device/DeviceIdStore.kt`

Use DataStore if already configured; otherwise use private `SharedPreferences` for MVP.

Public API:

```kotlin
class DeviceIdStore(private val context: Context) {
    fun getDeviceId(): String?
    fun saveDeviceId(deviceId: String)
}
```

**Create:** `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/device/PushTokenSyncer.kt`

Responsibilities:

- Persist a pending FCM token when no `deviceId` exists yet.
- Send token once registration succeeds.
- Retry boundedly when network fails.
- Never print token in logs.

Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/notification/StelliveFirebaseMessagingService.kt`:

- Replace the current placeholder comment with delegation to `PushTokenSyncer`.

### Repository Adapter

**Create:** `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/HubRepository.kt`

```kotlin
interface HubRepository {
    suspend fun bootstrap(): HubDataState
    suspend fun refresh(): HubDataState
    suspend fun updatePreferences(settings: NotificationSettingsState): HubDataState
}
```

**Create:** `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`

Responsibilities:

- Load local `deviceId`.
- Call bootstrap.
- Register device if needed.
- Persist cache on success.
- Return fallback from cache or `MockHubRepository`.

Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`:

- Keep deterministic fallback data.
- Do not remain the default runtime repository once `ServerHubRepository` is wired.

Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`:

- Depend on `HubRepository`.
- Show server data when available.
- Preserve existing UI rendering while data source changes.

## iOS Code Design

### API Client

**Create:** `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`

Responsibilities:

- Own base URL, `URLSession`, JSON encoder/decoder, request construction.
- Decode ISO-8601 dates.
- Convert HTTP and decoding failures into typed errors.
- Never log push tokens.

Public API:

```swift
final class HubAPIClient {
    func bootstrap(deviceId: String?) async throws -> BootstrapResponse
    func registerDevice(_ request: RegisterDeviceRequest) async throws -> RegisterDeviceResponse
    func updateDeviceToken(_ request: UpdateDeviceTokenRequest) async throws -> UpdateDeviceTokenResponse
    func preferences(deviceId: String) async throws -> PreferencesResponse
    func updatePreferences(_ request: UpdatePreferencesRequest) async throws -> UpdatePreferencesResponse
}
```

DTOs can live in `HubAPIClient.swift` initially or a new `HubAPIModels.swift` if the file becomes large.

### Device Registration

**Create:** `ios/StelliveHubiOS/StelliveHubiOS/Services/DeviceIDStore.swift`

MVP storage:

- Prefer Keychain if a helper already exists.
- Otherwise use app-private `UserDefaults` with a stable key.
- Do not use the App Group store for device tokens.

Public API:

```swift
final class DeviceIDStore {
    func loadDeviceID() -> String?
    func saveDeviceID(_ value: String)
}
```

**Create:** `ios/StelliveHubiOS/StelliveHubiOS/Services/PushTokenSyncer.swift`

Responsibilities:

- Accept APNs/FCM token strings from app delegate integration.
- Queue pending token until `deviceId` exists.
- Send `/v1/devices/token`.
- Never print token values.

If iOS push registration is not fully wired yet, add this service and tests without forcing app delegate changes in the same task.

### Store Adapter

**Create:** `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`

Responsibilities:

- Conform to the same UI-facing shape that `MockHubStore` currently provides.
- Load bootstrap data from backend.
- Persist last successful snapshot.
- Save widget snapshot to `HubCalendarWidgetStore`.
- Fall back to `MockHubStore` only when no cache exists.

Modify `ios/StelliveHubiOS/StelliveHubiOS/App.swift`:

- Inject a server-backed store abstraction instead of concrete `MockHubStore`.
- Keep SwiftUI previews and tests able to inject `MockHubStore`.

Modify `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`:

- Keep as preview/test/fallback.
- Do not add platform secrets or direct provider calls.

## Test Strategy

Follow TDD. Each code task starts by writing a failing test, then implements the minimum code needed.

Backend tests:

- `backend/stellive-hub-api/test/mobileDeviceRoutes.test.ts`
- `backend/stellive-hub-api/test/mobileBootstrap.test.ts`
- `backend/stellive-hub-api/test/mobilePreferences.test.ts`
- Existing `liveStatus.test.ts`, `adminInternalRoutes.test.ts`, and route tests should stay green.

Android tests:

- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubApiClientTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/DeviceRegistrationTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/PushTokenSyncerTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt`
- Existing CHZZK backend boundary tests stay green.

iOS tests:

- `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/DeviceRegistrationTests.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/ServerHubStoreTests.swift`
- Existing `ChzzkBackendBoundaryTests.swift` stays green.

Policy grep checks:

```bash
rtk rg -n "CHZZK_CLIENT_SECRET|CHZZK_ACCESS_TOKEN|CHZZK_REFRESH_TOKEN|NID_AUT|NID_SES|login-cookie|rawPayload|providerResponse" android ios backend shared docs
```

Expected: matches are either policy prohibitions, placeholder env names, or backend-only secret handling. No mobile secret or scraping implementation exists.

## Task 1: Shared Mobile API Contract

**Files**

Create:

- `shared/schemas/mobileApi.ts`

Modify:

- `shared/openapi/openapi.yaml`
- `shared/schemas/domain.ts` only if a required exported field is missing

Test:

- `backend/stellive-hub-api/test/mobileBootstrap.test.ts`

Steps:

- [ ] Write a failing test in `backend/stellive-hub-api/test/mobileBootstrap.test.ts` that imports `BootstrapResponse` from `shared/schemas/mobileApi.ts` and asserts a bootstrap fixture contains `config`, `catalog`, `preferences`, `liveStatus`, `hubEventsSummary`, and `serverTime`.
- [ ] Run `rtk npm test -- mobileBootstrap` from `backend/stellive-hub-api`.
- [ ] Expected: FAIL because `shared/schemas/mobileApi.ts` does not exist.
- [ ] Create `shared/schemas/mobileApi.ts` with the interfaces from the Shared Contract section.
- [ ] Update `shared/openapi/openapi.yaml` with `BootstrapResponse`, `RegisterDeviceRequest`, `RegisterDeviceResponse`, `UpdateDeviceTokenRequest`, `UpdateDeviceTokenResponse`, `PreferencesResponse`, and `UpdatePreferencesRequest`.
- [ ] Run `rtk npm test -- mobileBootstrap`.
- [ ] Expected: PASS.
- [ ] Commit:

```bash
rtk git add shared/schemas/mobileApi.ts shared/openapi/openapi.yaml backend/stellive-hub-api/test/mobileBootstrap.test.ts
rtk git commit -m "feat(api): add mobile API contract"
```

## Task 2: Device Repository

**Files**

Create:

- `backend/stellive-hub-api/src/repositories/deviceRepository.ts`
- `backend/stellive-hub-api/test/mobileDeviceRoutes.test.ts`

Modify:

- none in this task

Steps:

- [ ] Write failing repository tests in `mobileDeviceRoutes.test.ts` with an injected fake Prisma client shape proving `register()` creates or refreshes a device and updates `lastSeenAt`.
- [ ] Add a failing test proving `updateToken()` persists `platform`, `provider`, `tokenStatus: "active"`, locale/timezone/appVersion, and does not return the raw token.
- [ ] Run `rtk npm test -- mobileDeviceRoutes`.
- [ ] Expected: FAIL because `DeviceRepository` does not exist.
- [ ] Implement `DeviceRepository` using the existing Prisma `Device` model.
- [ ] Keep raw token access inside the repository only.
- [ ] Run `rtk npm test -- mobileDeviceRoutes`.
- [ ] Expected: PASS.
- [ ] Commit:

```bash
rtk git add backend/stellive-hub-api/src/repositories/deviceRepository.ts backend/stellive-hub-api/test/mobileDeviceRoutes.test.ts
rtk git commit -m "feat(api): add device repository"
```

## Task 3: Preference Repository

**Files**

Create:

- `backend/stellive-hub-api/src/repositories/preferenceRepository.ts`
- `backend/stellive-hub-api/test/mobilePreferences.test.ts`

Modify:

- none in this task

Steps:

- [ ] Write failing tests for `listForDevice(deviceId)` returning `UserNotificationPreference[]`.
- [ ] Write failing tests for `replaceForDevice()` replacing a full snapshot and returning `updatedAt`.
- [ ] Include cases for global, platform, event_type, generation, and member scopes.
- [ ] Include a regression assertion that `chzzk_chat` remains disabled unless explicitly enabled.
- [ ] Run `rtk npm test -- mobilePreferences`.
- [ ] Expected: FAIL because `PreferenceRepository` does not exist.
- [ ] Implement `PreferenceRepository` against Prisma `NotificationPreference`.
- [ ] Preserve the shape expected by `PreferenceResolutionService`.
- [ ] Run `rtk npm test -- mobilePreferences`.
- [ ] Expected: PASS.
- [ ] Commit:

```bash
rtk git add backend/stellive-hub-api/src/repositories/preferenceRepository.ts backend/stellive-hub-api/test/mobilePreferences.test.ts
rtk git commit -m "feat(api): add mobile preference repository"
```

## Task 4: Bootstrap Service

**Files**

Create:

- `backend/stellive-hub-api/src/mobile/bootstrapService.ts`

Modify:

- `backend/stellive-hub-api/test/mobileBootstrap.test.ts`

Steps:

- [ ] Add failing tests proving bootstrap config returns `officialYoutubeLiveExcluded: true`, `xNotificationsEnabled: false`, `xDisabledReason: "x_notifications_dropped_for_mvp"`, and `hubCalendarEnabled: true`.
- [ ] Add failing tests proving bootstrap catalog excludes Former members and includes Gangzi only under `gamja`.
- [ ] Add failing tests proving bootstrap includes repository preferences, live status diagnostics, hub event summary, optional widget snapshot, and ISO `serverTime`.
- [ ] Run `rtk npm test -- mobileBootstrap`.
- [ ] Expected: FAIL because `BootstrapService` does not exist.
- [ ] Implement `BootstrapService` with injected catalog, device, preference, live status, and hub event dependencies.
- [ ] Ensure it never returns raw provider payloads, device tokens, admin/internal tokens, or platform secrets.
- [ ] Run `rtk npm test -- mobileBootstrap`.
- [ ] Expected: PASS.
- [ ] Commit:

```bash
rtk git add backend/stellive-hub-api/src/mobile/bootstrapService.ts backend/stellive-hub-api/test/mobileBootstrap.test.ts
rtk git commit -m "feat(api): add mobile bootstrap service"
```

## Task 5: Mobile Route Registration

**Files**

Create:

- `backend/stellive-hub-api/src/mobile/mobileError.ts`
- `backend/stellive-hub-api/src/routes/appRoutes.ts`

Modify:

- `backend/stellive-hub-api/src/app.ts`
- `backend/stellive-hub-api/src/routes/routes.ts`
- `backend/stellive-hub-api/test/mobileDeviceRoutes.test.ts`
- `backend/stellive-hub-api/test/mobileBootstrap.test.ts`
- `backend/stellive-hub-api/test/mobilePreferences.test.ts`

Steps:

- [ ] Write failing route tests for `POST /v1/devices/register` returning a durable `deviceId`, `registered: true`, and `serverTime`.
- [ ] Write failing route tests for idempotent registration with an existing `deviceId`.
- [ ] Write failing route tests for `PUT /v1/devices/token` rejecting missing token and accepting valid FCM token metadata without echoing token.
- [ ] Write failing route tests for `GET /v1/preferences?deviceId=<deviceId>` and `PUT /v1/preferences`.
- [ ] Write failing route tests for `GET /v1/bootstrap` using `BootstrapService`.
- [ ] Run `rtk npm test -- mobileDeviceRoutes mobileBootstrap mobilePreferences`.
- [ ] Expected: FAIL because routes are not registered through `appRoutes.ts`.
- [ ] Implement `mobileError.ts`.
- [ ] Implement `registerAppRoutes(app, dependencies)` in `appRoutes.ts`.
- [ ] Register app routes from `app.ts`.
- [ ] Make existing `routes.ts` delegate overlapping mobile routes or remove duplicate handlers after tests are green.
- [ ] Run `rtk npm test -- mobileDeviceRoutes mobileBootstrap mobilePreferences`.
- [ ] Expected: PASS.
- [ ] Commit:

```bash
rtk git add backend/stellive-hub-api/src/mobile/mobileError.ts backend/stellive-hub-api/src/routes/appRoutes.ts backend/stellive-hub-api/src/app.ts backend/stellive-hub-api/src/routes/routes.ts backend/stellive-hub-api/test/mobileDeviceRoutes.test.ts backend/stellive-hub-api/test/mobileBootstrap.test.ts backend/stellive-hub-api/test/mobilePreferences.test.ts
rtk git commit -m "feat(api): add mobile app routes"
```

## Task 6: Backend Build And Contract Verification

**Files**

Modify:

- `backend/stellive-hub-api/src/types.ts` if mobile DTOs need re-export
- `docs/API_IMPLEMENTATION_PLAN.md`
- `docs/AI_HANDOFF.md`

Steps:

- [ ] Run `rtk npm run build` from `backend/stellive-hub-api`.
- [ ] Expected: PASS.
- [ ] Run `rtk npm test` from `backend/stellive-hub-api`.
- [ ] Expected: PASS.
- [ ] Run policy grep from repository root:

```bash
rtk rg -n "deviceToken|CHZZK_CLIENT_SECRET|CHZZK_ACCESS_TOKEN|CHZZK_REFRESH_TOKEN|NID_AUT|NID_SES|rawPayload|providerResponse" backend shared docs
```

- [ ] Expected: no real secrets, no raw provider payload exposure, no forbidden scraping implementation.
- [ ] Update `docs/API_IMPLEMENTATION_PLAN.md` and `docs/AI_HANDOFF.md` with the mobile API route status.
- [ ] Commit:

```bash
rtk git add backend/stellive-hub-api/src/types.ts docs/API_IMPLEMENTATION_PLAN.md docs/AI_HANDOFF.md
rtk git commit -m "docs(api): document mobile API route status"
```

## Task 7: Android Network DTO And Client

**Files**

Create:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiClient.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubNetworkResult.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubApiClientTest.kt`

Modify:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`
- `android/StelliveHubAndroid/app/build.gradle.kts` only if Moshi adapters or test dependencies are missing

Steps:

- [ ] Write failing `HubApiClientTest` with a fake `HubApi` proving `bootstrap()` returns `HubNetworkResult.Success`.
- [ ] Add failing test proving HTTP/network exceptions become `HubNetworkResult.Failure`.
- [ ] Add failing test proving token update failures do not include token text in failure messages.
- [ ] Run `rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.HubApiClientTest` from `android/StelliveHubAndroid`.
- [ ] Expected: FAIL because DTO/client files do not exist.
- [ ] Implement `HubApiModels.kt`, Retrofit `HubApi.kt`, `HubNetworkResult.kt`, and `HubApiClient.kt`.
- [ ] Use existing Retrofit/Moshi/OkHttp dependencies.
- [ ] Run focused test again.
- [ ] Expected: PASS.
- [ ] Commit:

```bash
rtk git add android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiClient.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubNetworkResult.kt android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubApiClientTest.kt android/StelliveHubAndroid/app/build.gradle.kts
rtk git commit -m "feat(android): add hub API client"
```

## Task 8: Android Device Registration And Token Sync

**Files**

Create:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/device/DeviceIdStore.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/device/PushTokenSyncer.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/DeviceRegistrationTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/PushTokenSyncerTest.kt`

Modify:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/notification/StelliveFirebaseMessagingService.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/StelliveHubApplication.kt` only if startup sync is needed

Steps:

- [ ] Write failing tests proving `DeviceIdStore` saves and loads a `deviceId`.
- [ ] Write failing tests proving `PushTokenSyncer` stores a pending token when no `deviceId` exists.
- [ ] Write failing tests proving pending token is sent after registration.
- [ ] Write failing test proving token value is not present in logs or returned error messages.
- [ ] Run focused Android tests for `DeviceRegistrationTest` and `PushTokenSyncerTest`.
- [ ] Expected: FAIL because device classes do not exist.
- [ ] Implement `DeviceIdStore` and `PushTokenSyncer`.
- [ ] Replace the current placeholder comment in `StelliveFirebaseMessagingService.onNewToken()` with syncer delegation.
- [ ] Run focused tests again.
- [ ] Expected: PASS.
- [ ] Commit:

```bash
rtk git add android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/device/DeviceIdStore.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/device/PushTokenSyncer.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/notification/StelliveFirebaseMessagingService.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/StelliveHubApplication.kt android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/DeviceRegistrationTest.kt android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/PushTokenSyncerTest.kt
rtk git commit -m "feat(android): add device registration sync"
```

## Task 9: Android Server Repository

**Files**

Create:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/HubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt`

Modify:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`

Steps:

- [ ] Write failing `ServerHubRepositoryTest` proving repository calls bootstrap before using mock fallback.
- [ ] Add failing test proving it registers a device if bootstrap has no registered device.
- [ ] Add failing test proving it returns stale cache or mock fallback on network failure.
- [ ] Add failing test proving server preferences override local mock defaults.
- [ ] Run focused test.
- [ ] Expected: FAIL because repository abstraction does not exist.
- [ ] Implement `HubRepository` and `ServerHubRepository`.
- [ ] Adapt `MockHubRepository` to implement or feed the fallback side of `HubRepository`.
- [ ] Modify `MainActivity` to depend on `HubRepository` state instead of direct `MockHubRepository` fields where feasible.
- [ ] Preserve current UI screens and navigation.
- [ ] Run focused repository test and existing UI policy tests.
- [ ] Expected: PASS.
- [ ] Commit:

```bash
rtk git add android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/HubRepository.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt
rtk git commit -m "feat(android): use server-backed hub repository"
```

## Task 10: Android Verification

**Files**

Modify:

- none unless tests reveal required fixes

Steps:

- [ ] Run `rtk ./gradlew :app:testDebugUnitTest` from `android/StelliveHubAndroid`.
- [ ] Expected: PASS.
- [ ] Run Android policy grep from repository root:

```bash
rtk rg -n "CHZZK_CLIENT_ID|CHZZK_CLIENT_SECRET|CHZZK_ACCESS_TOKEN|CHZZK_REFRESH_TOKEN|NID_AUT|NID_SES|api.chzzk|chzzk.naver|rawPayload|providerResponse" android/StelliveHubAndroid/app/src/main
```

- [ ] Expected: no mobile CHZZK secrets, direct provider hosts, cookie scraping markers, or raw provider payload fields.
- [ ] Commit any test-driven fixes:

```bash
rtk git add android/StelliveHubAndroid
rtk git commit -m "test(android): verify mobile server communication"
```

## Task 11: iOS API Client

**Files**

Create:

- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`

Modify:

- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift` only if API DTOs need explicit Codable support

Steps:

- [ ] Write failing `HubAPIClientTests` with a custom `URLProtocol` proving `bootstrap(deviceId:)` sends the correct path and decodes `BootstrapResponse`.
- [ ] Add failing tests for `registerDevice`, `updateDeviceToken`, `preferences`, and `updatePreferences`.
- [ ] Add failing test proving token update error descriptions do not contain the token value.
- [ ] Run focused iOS API client tests with `xcodebuild`.
- [ ] Expected: FAIL because `HubAPIClient` does not exist.
- [ ] Implement `HubAPIClient` with injected `URLSession` and base URL.
- [ ] Add Codable DTOs in `HubAPIClient.swift` or `HubAPIModels.swift`.
- [ ] Use ISO-8601 date decoding.
- [ ] Run focused iOS API client tests again.
- [ ] Expected: PASS.
- [ ] Commit:

```bash
rtk git add ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift
rtk git commit -m "feat(ios): add hub API client"
```

## Task 12: iOS Device Registration And Token Sync

**Files**

Create:

- `ios/StelliveHubiOS/StelliveHubiOS/Services/DeviceIDStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/PushTokenSyncer.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/DeviceRegistrationTests.swift`

Modify:

- none unless existing app delegate or notification service integration is present

Steps:

- [ ] Write failing tests proving `DeviceIDStore` saves and loads a `deviceId`.
- [ ] Write failing tests proving `PushTokenSyncer` stores pending token state when no device id exists.
- [ ] Write failing tests proving token sync calls `/v1/devices/token` after registration.
- [ ] Run focused iOS registration tests.
- [ ] Expected: FAIL because services do not exist.
- [ ] Implement `DeviceIDStore`.
- [ ] Implement `PushTokenSyncer`.
- [ ] Keep actual APNs/FCM app delegate wiring behind a small integration point if current iOS app does not yet register for push.
- [ ] Run focused tests again.
- [ ] Expected: PASS.
- [ ] Commit:

```bash
rtk git add ios/StelliveHubiOS/StelliveHubiOS/Services/DeviceIDStore.swift ios/StelliveHubiOS/StelliveHubiOS/Services/PushTokenSyncer.swift ios/StelliveHubiOS/StelliveHubiOSTests/DeviceRegistrationTests.swift
rtk git commit -m "feat(ios): add device registration sync"
```

## Task 13: iOS Server Store

**Files**

Create:

- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/ServerHubStoreTests.swift`

Modify:

- `ios/StelliveHubiOS/StelliveHubiOS/App.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubCalendarWidgetStore.swift`

Steps:

- [ ] Write failing tests proving `ServerHubStore` calls bootstrap first and populates members, settings, live status, hub event summary, and widget snapshot.
- [ ] Add failing test proving it registers when no `deviceId` exists.
- [ ] Add failing test proving it uses last successful cache or `MockHubStore` fallback on network failure.
- [ ] Add failing test proving widget snapshot is saved after successful bootstrap.
- [ ] Run focused `ServerHubStoreTests`.
- [ ] Expected: FAIL because `ServerHubStore` does not exist.
- [ ] Implement `ServerHubStore`.
- [ ] Modify `App.swift` to use server-backed store at runtime.
- [ ] Keep `MockHubStore` available for previews, tests, and fallback.
- [ ] Run focused tests again.
- [ ] Expected: PASS.
- [ ] Commit:

```bash
rtk git add ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift ios/StelliveHubiOS/StelliveHubiOS/Services/HubCalendarWidgetStore.swift ios/StelliveHubiOS/StelliveHubiOS/App.swift ios/StelliveHubiOS/StelliveHubiOSTests/ServerHubStoreTests.swift
rtk git commit -m "feat(ios): use server-backed hub store"
```

## Task 14: iOS Verification

**Files**

Modify:

- none unless tests reveal required fixes

Steps:

- [ ] Run focused iOS tests:

```bash
rtk proxy xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:StelliveHubiOSTests/HubAPIClientTests -only-testing:StelliveHubiOSTests/DeviceRegistrationTests -only-testing:StelliveHubiOSTests/ServerHubStoreTests -only-testing:StelliveHubiOSTests/ChzzkBackendBoundaryTests
```

- [ ] Expected: PASS.
- [ ] Run iOS policy grep:

```bash
rtk rg -n "CHZZK_CLIENT_ID|CHZZK_CLIENT_SECRET|CHZZK_ACCESS_TOKEN|CHZZK_REFRESH_TOKEN|NID_AUT|NID_SES|api.chzzk|chzzk.naver|rawPayload|providerResponse" ios/StelliveHubiOS/StelliveHubiOS
```

- [ ] Expected: no mobile secrets, direct provider hosts, cookie scraping markers, or raw provider payload fields.
- [ ] Commit any test-driven fixes:

```bash
rtk git add ios/StelliveHubiOS
rtk git commit -m "test(ios): verify mobile server communication"
```

## Task 15: Final Cross-Platform Verification

Steps:

- [ ] Run backend build:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

- [ ] Expected: PASS.
- [ ] Run backend tests:

```bash
cd backend/stellive-hub-api
rtk npm test
```

- [ ] Expected: PASS.
- [ ] Run Android unit tests:

```bash
cd android/StelliveHubAndroid
rtk proxy ./gradlew :app:testDebugUnitTest
```

- [ ] Expected: PASS.
- [ ] Run iOS tests:

```bash
rtk proxy xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

- [ ] Expected: PASS.
- [ ] Run final policy grep:

```bash
rtk rg -n "Former|NID_AUT|NID_SES|login-cookie|cookie scraping|CHZZK_CLIENT_SECRET=.*[^=]|CHZZK_ACCESS_TOKEN=.*[^=]|CHZZK_REFRESH_TOKEN=.*[^=]|rawPayload|providerResponse|official_youtube_live" backend android ios shared docs
```

- [ ] Expected: matches are either explicit policy prohibitions, placeholder env names, backend-only secret handling, or existing official YouTube live exclusion tests/docs.
- [ ] Review changed files:

```bash
rtk git status --short
rtk git diff --stat
```

- [ ] Expected: changes are scoped to shared contract, backend mobile routes/repositories, Android/iOS mobile communication layers, tests, and docs.
- [ ] Final commit:

```bash
rtk git add shared backend/stellive-hub-api android/StelliveHubAndroid ios/StelliveHubiOS docs/API_IMPLEMENTATION_PLAN.md docs/AI_HANDOFF.md
rtk git commit -m "feat: connect mobile apps to backend"
```

## Rollout Notes

- Start with local backend URL in debug builds only.
- Production builds must use HTTPS.
- Keep foreground realtime disabled until device session authentication is stable.
- Enable Android and iOS token sync in development Firebase projects before production credentials are configured.
- Do not close GitHub #15 or GitLab #10 until backend, Android, and iOS verification all pass and the issue comments include final verification commands.
