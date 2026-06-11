Implementation Plan
> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the CHZZK Open API adapter feature plan into a code-writing sequence that can be implemented safely with tests, without putting CHZZK credentials or direct API calls in Android or iOS.

**Architecture:** Build the backend integration first: configuration, OAuth state signing, token exchange, token refresh, API client, live-status adapter, repository updates, scheduler route, and mobile-facing `/v1/live-status` contract. Android and iOS remain backend consumers and only need DTO/UI boundary updates plus tests proving no CHZZK secrets or direct CHZZK hosts are present in app code. Each task starts with a failing test, adds minimal code, then runs the focused verification command before moving on.

**Tech Stack:** TypeScript, Fastify, Zod, Prisma, PostgreSQL, Vitest, Kotlin/JUnit, Swift/XCTest, existing Firebase/push policy code.

## Source Documents

- Feature plan: `docs/superpowers/plans/2026-06-11-chzzk-open-api-adapter.md`
- GitHub issue: `https://github.com/MinePacu/stellive-event-notifier/issues/13`
- GitLab work item: `https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/8`
- Project rules: `docs/PROJECT_RULES.md`
- API plan: `docs/API_IMPLEMENTATION_PLAN.md`

## Non-Negotiable Coding Rules

- Do not add CHZZK API calls, client IDs, client secrets, access tokens, refresh tokens, or CHZZK host constants to Android or iOS app code.
- Do not add login-cookie scraping, `NID_AUT`, `NID_SES`, private WebSocket bypasses, or HTML crawling.
- Do not store raw CHZZK provider payloads. Persist normalized live status, minimal token metadata, hashes, cursors, and diagnostics only.
- Do not allow adapters to send pushes directly. CHZZK events must pass through the same preference and notification pipeline as other events.
- Do not produce `chzzk_chat` push events in this implementation.
- Do not reintroduce Former members in catalog targets, seed data, tests, filters, or UI.
- Keep `CHZZK_LIVE_POLLING_ENABLED=false` by default until OAuth and allowed endpoint behavior are verified.

## Working Branch

- [ ] Create a dedicated branch before code changes.

```bash
rtk git switch -c feat/chzzk-open-api-adapter
```

Expected: new branch is active. If the branch already exists, switch to it with `rtk git switch feat/chzzk-open-api-adapter`.

## Task 1: Backend Env Contract

**Files**

Create: none

Modify:
- `backend/stellive-hub-api/test/foundation.test.ts`
- `backend/stellive-hub-api/src/config/env.ts`
- `backend/stellive-hub-api/.env.example`

- [ ] Write a failing test in `backend/stellive-hub-api/test/foundation.test.ts` that loads env overrides with:

```ts
{
  CHZZK_CLIENT_ID: "client-id",
  CHZZK_CLIENT_SECRET: "client-secret",
  CHZZK_REDIRECT_URI: "http://localhost:4000/v1/auth/chzzk/callback",
  CHZZK_AUTH_STATE_SECRET: "local-state-secret",
  CHZZK_OAUTH_ENABLED: "true",
  CHZZK_TOKEN_REFRESH_SKEW_SECONDS: "300",
  CHZZK_LIVE_POLLING_ENABLED: "false"
}
```

Assert parsed values are available on `AppEnv`, and placeholders such as `verify_required` and `replace_with_local_auth_state_secret` make OAuth effectively unavailable.

- [ ] Run the focused test.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test -- foundation
```

Expected: FAIL because the new env fields are not parsed.

- [ ] Implement the env parser changes in `backend/stellive-hub-api/src/config/env.ts`:
  - `CHZZK_REDIRECT_URI: z.string().url().optional()`
  - `CHZZK_AUTH_STATE_SECRET: z.string().optional()`
  - `CHZZK_OAUTH_ENABLED: booleanFlag(false)`
  - `CHZZK_TOKEN_REFRESH_SKEW_SECONDS: z.coerce.number().int().positive().default(300)`
  - helper function `isConfiguredSecret(value: string | undefined): boolean`
  - derived boolean `CHZZK_OAUTH_CONFIGURED` if the current env type pattern allows derived fields

- [ ] Add the new variables to `backend/stellive-hub-api/.env.example` with placeholder values only.

- [ ] Run the focused test again.

```bash
rtk npm test -- foundation
```

Expected: PASS.

- [ ] Commit this task.

```bash
rtk git add backend/stellive-hub-api/test/foundation.test.ts backend/stellive-hub-api/src/config/env.ts backend/stellive-hub-api/.env.example
rtk git commit -m "feat(api): add CHZZK env contract"
```

## Task 2: Platform API State Helpers

**Files**

Create: none

Modify:
- `backend/stellive-hub-api/src/repositories/platformApiStateRepository.ts`
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts` or new focused repository test if one exists

- [ ] Write a failing repository-level test proving CHZZK token state can be stored and read by source/key:
  - source: `chzzk`
  - keys: `oauth.accessToken`, `oauth.refreshToken`, `oauth.expiresAt`, `oauth.scope`, `oauth.tokenType`, `oauth.lastRefreshedAt`
  - health key: `health`

- [ ] Run the focused test.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test -- adminInternalRoutes
```

Expected: FAIL because typed helpers do not exist.

- [ ] Add narrow helper methods to `PlatformApiStateRepository`:
  - `upsertState(source, key, value, status)`
  - `getState(source, key)`
  - `upsertAdapterHealth(source, health)`
  - `getLatestAdapterHealth(source)`

- [ ] Keep the existing `listAdapterHealth()` behavior stable for admin overview.

- [ ] Run the focused test again.

```bash
rtk npm test -- adminInternalRoutes
```

Expected: PASS.

- [ ] Commit this task.

```bash
rtk git add backend/stellive-hub-api/src/repositories/platformApiStateRepository.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
rtk git commit -m "feat(api): add platform API state helpers"
```

## Task 3: CHZZK OAuth State Signing

**Files**

Create:
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOAuthState.ts`
- `backend/stellive-hub-api/test/chzzkAuthRoutes.test.ts`

Modify: none

- [ ] Write failing tests for signed OAuth state:
  - `createChzzkOAuthState(secret, now)` returns a URL-safe state string.
  - `verifyChzzkOAuthState(secret, state, now)` accepts state younger than 10 minutes.
  - verification rejects tampered state.
  - verification rejects expired state.

- [ ] Run the focused test.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test -- chzzkAuthRoutes
```

Expected: FAIL because `chzzkOAuthState.ts` does not exist.

- [ ] Implement HMAC-SHA256 signing with Node `crypto`.

- [ ] Keep state payload minimal: timestamp and random nonce only. Do not embed tokens, client IDs, or user data.

- [ ] Run the focused test again.

```bash
rtk npm test -- chzzkAuthRoutes
```

Expected: PASS for state-signing tests.

- [ ] Commit this task.

```bash
rtk git add backend/stellive-hub-api/src/adapters/chzzk/chzzkOAuthState.ts backend/stellive-hub-api/test/chzzkAuthRoutes.test.ts
rtk git commit -m "feat(api): add CHZZK OAuth state signing"
```

## Task 4: CHZZK Auth Client

**Files**

Create:
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkAuthClient.ts`
- `backend/stellive-hub-api/test/chzzkApiClient.test.ts`

Modify: none

- [ ] Write failing tests with mocked `fetch` for:
  - `buildAuthorizeUrl()` includes `clientId`, `redirectUri`, `state`, and expected response type.
  - `exchangeCodeForToken()` posts `code`, `clientId`, `clientSecret`, and exact `redirectUri` server-side.
  - `refreshAccessToken()` posts refresh grant data server-side.
  - malformed token response throws a typed `chzzk_token_response_invalid` error.

- [ ] Run the focused test.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test -- chzzkApiClient
```

Expected: FAIL because `chzzkAuthClient.ts` does not exist.

- [ ] Implement `ChzzkAuthClient` with Zod validation for token responses:
  - `access_token`
  - `refresh_token`
  - `expires_in`
  - `token_type`
  - optional `scope`

- [ ] Add request timeout behavior using `AbortController`.

- [ ] Keep endpoint URLs isolated in this backend file only.

- [ ] Run the focused test again.

```bash
rtk npm test -- chzzkApiClient
```

Expected: PASS for auth client tests.

- [ ] Commit this task.

```bash
rtk git add backend/stellive-hub-api/src/adapters/chzzk/chzzkAuthClient.ts backend/stellive-hub-api/test/chzzkApiClient.test.ts
rtk git commit -m "feat(api): add CHZZK auth client"
```

## Task 5: CHZZK OAuth Routes

**Files**

Create:
- `backend/stellive-hub-api/src/routes/chzzkAuthRoutes.ts`

Modify:
- `backend/stellive-hub-api/src/app.ts`
- `backend/stellive-hub-api/test/chzzkAuthRoutes.test.ts`

- [ ] Extend `chzzkAuthRoutes.test.ts` with failing route tests:
  - `GET /v1/auth/chzzk/start` returns `503` when OAuth is disabled or not configured.
  - `GET /v1/auth/chzzk/start` redirects to the authorization URL when configured.
  - `GET /v1/auth/chzzk/callback` rejects missing `code`.
  - callback rejects invalid `state`.
  - callback exchanges code and stores token metadata when state is valid.

- [ ] Run the focused route test.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test -- chzzkAuthRoutes
```

Expected: FAIL because routes are not registered.

- [ ] Implement `registerChzzkAuthRoutes(app, dependencies)` with injectable auth client and platform state repository for tests.

- [ ] Register the route from `backend/stellive-hub-api/src/app.ts`.

- [ ] On successful callback, store token metadata under `PlatformApiState` and update adapter health to `enabled` or `verify_required` according to the current endpoint-confirmation state.

- [ ] Ensure neither route logs token values.

- [ ] Run the focused route test again.

```bash
rtk npm test -- chzzkAuthRoutes
```

Expected: PASS.

- [ ] Commit this task.

```bash
rtk git add backend/stellive-hub-api/src/routes/chzzkAuthRoutes.ts backend/stellive-hub-api/src/app.ts backend/stellive-hub-api/test/chzzkAuthRoutes.test.ts
rtk git commit -m "feat(api): add CHZZK OAuth routes"
```

## Task 6: CHZZK Live API Client

**Files**

Create:
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts`

Modify:
- `backend/stellive-hub-api/test/chzzkApiClient.test.ts`

- [ ] Add failing tests for `getLiveStatus(channelId)`:
  - reads access token from `PlatformApiStateRepository`.
  - sends `Authorization: Bearer <token>`.
  - maps official live response fields into normalized shape: `channelId`, `isLive`, `title`, `openDate`, `viewerCount`, `platformUrl`, `sourceVerificationState`.
  - refreshes token once after `401`.
  - writes health `rate_limited` after `429`.
  - returns `verify_required` for unknown response shape.

- [ ] Run the focused client test.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test -- chzzkApiClient
```

Expected: FAIL because the live API client is not implemented.

- [ ] Implement `ChzzkApiClient` with injected `fetch`, `ChzzkAuthClient`, env, and state repository.

- [ ] Keep official endpoint paths in this backend file and mark unknown/changed response shapes as `verify_required`.

- [ ] Do not expose raw provider JSON outside the client.

- [ ] Run the focused client test again.

```bash
rtk npm test -- chzzkApiClient
```

Expected: PASS.

- [ ] Commit this task.

```bash
rtk git add backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts backend/stellive-hub-api/test/chzzkApiClient.test.ts
rtk git commit -m "feat(api): add CHZZK live API client"
```

## Task 7: Live Status Repository Writes

**Files**

Create: none

Modify:
- `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts`
- `backend/stellive-hub-api/test/liveStatus.test.ts`

- [ ] Write failing tests for repository behavior:
  - `upsertLiveStatus()` persists `memberId`, `generationId`, `isLive`, `title`, `viewerCount`, `startedAt`, `platformUrl`, `sourceVerificationState`, and `lastTransitionAt`.
  - `getByMemberId()` returns the previous status for transition checks.
  - diagnostics output does not include raw provider payload.

- [ ] Run the focused test.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test -- liveStatus
```

Expected: FAIL because write helpers do not exist.

- [ ] Add `upsertLiveStatus()` and `getByMemberId()` to `LiveStatusRepository`.

- [ ] Preserve the existing `listDiagnostics()` return shape used by admin routes.

- [ ] Run the focused test again.

```bash
rtk npm test -- liveStatus
```

Expected: PASS for repository tests.

- [ ] Commit this task.

```bash
rtk git add backend/stellive-hub-api/src/repositories/liveStatusRepository.ts backend/stellive-hub-api/test/liveStatus.test.ts
rtk git commit -m "feat(api): add live status write helpers"
```

## Task 8: CHZZK Live Adapter

**Files**

Create:
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts`
- `backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts`

Modify:
- `backend/stellive-hub-api/src/events/eventGuards.ts`
- `backend/stellive-hub-api/src/types.ts`

- [ ] Write failing adapter tests:
  - polls only catalog entries with `catalogRole` allowed for MVP and `chzzkChannelId` present.
  - skips Former members if any fixture attempts to include one.
  - active response upserts live status with `startedAt` from official `openDate`.
  - offline-to-live creates one `chzzk_live_started` event.
  - live-to-offline creates one `chzzk_live_ended` event.
  - repeated poll for same session produces no duplicate event.
  - adapter never emits `chzzk_chat`.

- [ ] Run the focused adapter test.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test -- chzzkOpenApiAdapter
```

Expected: FAIL because the adapter does not exist.

- [ ] Implement `pollLiveStatuses()` with injected catalog service, API client, live status repository, event ingestion function, and clock.

- [ ] Generate dedupe keys as `chzzk:<eventType>:<channelId>:<startedAt-or-observed-bucket>`.

- [ ] Use existing event guard helpers before storing or enqueueing any event.

- [ ] Keep adapter output as counts: `checked`, `updated`, `eventsCreated`, `skipped`, `verifyRequired`.

- [ ] Run the focused adapter test again.

```bash
rtk npm test -- chzzkOpenApiAdapter
```

Expected: PASS.

- [ ] Commit this task.

```bash
rtk git add backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts backend/stellive-hub-api/src/events/eventGuards.ts backend/stellive-hub-api/src/types.ts
rtk git commit -m "feat(api): add CHZZK live adapter"
```

## Task 9: Scheduler Route Integration

**Files**

Create: none

Modify:
- `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
- `backend/stellive-hub-api/src/admin/adminHealthService.ts`

- [ ] Add failing tests for `POST /v1/internal/schedulers/chzzk/live-status`:
  - `401` without `INTERNAL_API_TOKEN`.
  - disabled response when `CHZZK_LIVE_POLLING_ENABLED=false`.
  - `verify_required` when OAuth token state is missing.
  - successful response includes adapter counts when enabled and configured.

- [ ] Run the focused test.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test -- adminInternalRoutes
```

Expected: FAIL because scheduler route still returns static `verify_required`.

- [ ] Add an injectable `chzzkLiveAdapter` dependency to internal routes.

- [ ] Update route implementation to call `pollLiveStatuses()` only when feature flags and token state allow it.

- [ ] Update admin health to show CHZZK health from `PlatformApiState` without exposing tokens.

- [ ] Run the focused test again.

```bash
rtk npm test -- adminInternalRoutes
```

Expected: PASS.

- [ ] Commit this task.

```bash
rtk git add backend/stellive-hub-api/src/routes/internalRoutes.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts backend/stellive-hub-api/src/admin/adminHealthService.ts
rtk git commit -m "feat(api): wire CHZZK scheduler"
```

## Task 10: Mobile-Facing Live Status Contract

**Files**

Create: none

Modify:
- `backend/stellive-hub-api/src/routes/routes.ts`
- `backend/stellive-hub-api/test/liveStatus.test.ts`
- `shared/schemas/domain.ts`

- [ ] Add failing route tests for `GET /v1/live-status`:
  - returns persisted `LiveStatus` rows when repository data exists.
  - includes `startedAt`, `platformUrl`, `sourceVerificationState`, and `lastCheckedAt`.
  - does not include raw provider payload fields.
  - still returns deterministic dev/test fallback when no repository is injected.

- [ ] Run the focused test.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test -- liveStatus
```

Expected: FAIL because route still uses in-memory/mock shape only.

- [ ] Update shared `LiveStatus` type in `shared/schemas/domain.ts` if the backend response needs explicit fields.

- [ ] Update `routes.ts` to prefer repository-backed live status and keep a controlled fallback for tests/dev.

- [ ] Run the focused test again.

```bash
rtk npm test -- liveStatus
```

Expected: PASS.

- [ ] Commit this task.

```bash
rtk git add backend/stellive-hub-api/src/routes/routes.ts backend/stellive-hub-api/test/liveStatus.test.ts shared/schemas/domain.ts
rtk git commit -m "feat(api): expose repository-backed live status"
```

## Task 11: Notification Policy Coverage

**Files**

Create: none

Modify:
- `backend/stellive-hub-api/test/preferenceResolution.test.ts`
- `backend/stellive-hub-api/test/notificationLoadReduction.test.ts`
- `backend/stellive-hub-api/src/preferences/preferenceResolution.ts`
- `backend/stellive-hub-api/src/notification/loadReductionPolicy.ts`

- [ ] Add failing preference tests proving `chzzk_live_started` obeys:
  - global off
  - platform off
  - event-type off
  - generation/member off
  - quiet hours
  - keyword block rules
  - rate limits

- [ ] Add failing load-reduction tests proving:
  - allowed `chzzk_live_started` can use immediate push when realtime eligible.
  - `chzzk_live_ended` stays standard unless policy explicitly changes.
  - `chzzk_chat` remains blocked without explicit filters.

- [ ] Run focused tests.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test -- preferenceResolution notificationLoadReduction
```

Expected: FAIL only where policy coverage is missing.

- [ ] Make minimal policy changes needed to pass. Do not add CHZZK-specific bypasses around shared preference resolution.

- [ ] Run focused tests again.

```bash
rtk npm test -- preferenceResolution notificationLoadReduction
```

Expected: PASS.

- [ ] Commit this task.

```bash
rtk git add backend/stellive-hub-api/test/preferenceResolution.test.ts backend/stellive-hub-api/test/notificationLoadReduction.test.ts backend/stellive-hub-api/src/preferences/preferenceResolution.ts backend/stellive-hub-api/src/notification/loadReductionPolicy.ts
rtk git commit -m "test(api): cover CHZZK notification policy"
```

## Task 12: Android Backend Boundary

**Files**

Create:
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ChzzkBackendBoundaryTest.kt`

Modify:
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/network/HubApi.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt`

- [ ] Add `ChzzkBackendBoundaryTest.kt` that scans Android app source files and fails if it finds:
  - `CHZZK_CLIENT_ID`
  - `CHZZK_CLIENT_SECRET`
  - `CHZZK_ACCESS_TOKEN`
  - `CHZZK_REFRESH_TOKEN`
  - `api.chzzk`
  - `chzzk.naver`
  - `NID_AUT`
  - `NID_SES`

- [ ] Run focused Android test.

Working directory: `android/StelliveHubAndroid`

```bash
rtk proxy ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.ChzzkBackendBoundaryTest
```

Expected: PASS if app code already respects the boundary; FAIL if a direct CHZZK reference exists.

- [ ] Update `HubApi.kt` DTO parsing only if backend live-status fields are missing from the Android model.

- [ ] Update `MainUiPolicy.kt` only if the UI needs explicit stale/verify-required wording from backend `sourceVerificationState`.

- [ ] Run focused Android UI tests.

```bash
rtk proxy ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.ChzzkBackendBoundaryTest --tests dev.stellive.hub.MainUiPolicyTest
```

Expected: PASS.

- [ ] Commit this task.

```bash
rtk git add android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ChzzkBackendBoundaryTest.kt android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/network/HubApi.kt android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt
rtk git commit -m "test(android): enforce CHZZK backend boundary"
```

## Task 13: iOS Backend Boundary

**Files**

Create:
- `ios/StelliveHubiOS/StelliveHubiOSTests/ChzzkBackendBoundaryTests.swift`

Modify:
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift`

- [ ] Add `ChzzkBackendBoundaryTests.swift` that scans iOS app source files and fails if it finds:
  - `CHZZK_CLIENT_ID`
  - `CHZZK_CLIENT_SECRET`
  - `CHZZK_ACCESS_TOKEN`
  - `CHZZK_REFRESH_TOKEN`
  - `api.chzzk`
  - `chzzk.naver`
  - `NID_AUT`
  - `NID_SES`

- [ ] Run focused iOS boundary test.

Working directory: repository root.

```bash
rtk proxy xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:StelliveHubiOSTests/ChzzkBackendBoundaryTests
```

Expected: PASS if app code already respects the boundary; FAIL if a direct CHZZK reference exists.

- [ ] Update `MockHubStore.swift` only for fallback live-status sample shape if shared response fields changed.

- [ ] Update `LiveView.swift` only if the UI needs explicit stale/verify-required wording from backend `sourceVerificationState`.

- [ ] Add or update `PreferenceStateTests.swift` assertions that `chzzk_chat` remains off by default.

- [ ] Run focused iOS tests.

```bash
rtk proxy xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:StelliveHubiOSTests/ChzzkBackendBoundaryTests -only-testing:StelliveHubiOSTests/PreferenceStateTests
```

Expected: PASS.

- [ ] Commit this task.

```bash
rtk git add ios/StelliveHubiOS/StelliveHubiOSTests/ChzzkBackendBoundaryTests.swift ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift
rtk git commit -m "test(ios): enforce CHZZK backend boundary"
```

## Task 14: Documentation Update

**Files**

Create: none

Modify:
- `docs/API_SETUP.md`
- `docs/API_IMPLEMENTATION_PLAN.md`
- `docs/AI_HANDOFF.md`
- `docs/ARCHITECTURE.md`

- [ ] Update `docs/API_SETUP.md` with:
  - CHZZK app redirect URL: `https://<backend-public-origin>/v1/auth/chzzk/callback`
  - local redirect URL: `http://localhost:4000/v1/auth/chzzk/callback`
  - env var list
  - OAuth connect flow
  - scheduler enablement order

- [ ] Update `docs/API_IMPLEMENTATION_PLAN.md` so the CHZZK section references the concrete files introduced by this plan.

- [ ] Update `docs/AI_HANDOFF.md` with implementation status, issue links, and remaining operational checks.

- [ ] Update `docs/ARCHITECTURE.md` with the backend-only CHZZK credential boundary.

- [ ] Run documentation grep checks.

Working directory: repository root.

```bash
rtk rg -n "NID_AUT|NID_SES|CHZZK_ACCESS_TOKEN=.*[^=]|CHZZK_REFRESH_TOKEN=.*[^=]" docs backend android ios
```

Expected: no real secrets and no cookie-scraping implementation references except policy text that explicitly forbids them.

- [ ] Commit this task.

```bash
rtk git add docs/API_SETUP.md docs/API_IMPLEMENTATION_PLAN.md docs/AI_HANDOFF.md docs/ARCHITECTURE.md
rtk git commit -m "docs: document CHZZK Open API rollout"
```

## Full Verification

- [ ] Run backend typecheck/build.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm run build
```

Expected: PASS.

- [ ] Run backend tests.

Working directory: `backend/stellive-hub-api`

```bash
rtk npm test
```

Expected: PASS.

- [ ] Run Android unit tests.

Working directory: `android/StelliveHubAndroid`

```bash
rtk proxy ./gradlew :app:testDebugUnitTest
```

Expected: PASS.

- [ ] Run iOS tests.

Working directory: repository root.

```bash
rtk proxy xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

Expected: PASS.

- [ ] Run final policy grep.

Working directory: repository root.

```bash
rtk rg -n "Former|NID_AUT|NID_SES|login-cookie|cookie scraping|CHZZK_CLIENT_SECRET=.*[^=]|CHZZK_ACCESS_TOKEN=.*[^=]|CHZZK_REFRESH_TOKEN=.*[^=]" backend android ios shared docs
```

Expected: any matches are either explicit policy prohibitions or placeholder env names, not implementation of forbidden behavior or real secrets.

## Final Commit And Handoff

- [ ] Review changed files.

```bash
rtk git status --short
rtk git diff --stat
```

Expected: only CHZZK adapter, backend route/repository/test, mobile boundary test, and docs files are changed.

- [ ] Commit remaining verification/doc polish if needed.

```bash
rtk git add .
rtk git commit -m "feat: implement CHZZK Open API adapter"
```

- [ ] Update GitHub issue `#13` and GitLab work item `#8` with final verification results and rollout notes.
