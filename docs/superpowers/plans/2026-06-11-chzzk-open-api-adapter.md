Implementation Plan
> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement CHZZK Open API integration so the backend can authenticate with CHZZK, poll allowed live status data, normalize it into existing live-status and notification flows, and expose the result to the Android and iOS apps.

**Architecture:** Keep CHZZK credentials, OAuth token exchange, token refresh, polling, dedupe, and event ingestion entirely in the TypeScript backend. Mobile apps continue to call this project's backend only; Android and iOS must not call CHZZK directly or store CHZZK secrets. The backend adds a CHZZK API client, OAuth routes, live-status adapter, database-backed state updates, and admin diagnostics while preserving the existing preference, push, realtime, and policy guard boundaries.

**Tech Stack:** TypeScript, Fastify, Zod, Prisma, PostgreSQL, Vitest, Kotlin/JUnit, Swift/XCTest, Firebase Cloud Messaging through the existing backend push path.

## Policy Constraints

- Use CHZZK Developers/Open API or another documented allowed API only.
- Do not add login-cookie scraping, `NID_AUT`, `NID_SES`, private WebSocket/session bypasses, or HTML crawling.
- Do not store raw private provider payloads. Persist only normalized live status, minimal metadata, token state, hashes, cursors, and diagnostics.
- Do not put CHZZK client secrets, access tokens, refresh tokens, or production device tokens in Android or iOS code.
- `chzzk_chat` remains off by default and does not get push delivery without explicit user filters.
- User notification preferences remain authoritative. `global=false` blocks every CHZZK notification, and `realtime_best_effort` never bypasses disabled settings, quiet hours, keyword filters, OS policies, push-service policies, or rate limits.
- Former members must not be reintroduced in catalog targets, notification targets, filters, seed data, tests, or UI.

## Redirect URL Decision

Register this login redirect URL for the CHZZK app when the backend is deployed:

```text
https://<backend-public-origin>/v1/auth/chzzk/callback
```

Use this local value only for local OAuth development when CHZZK allows localhost redirect registration:

```text
http://localhost:4000/v1/auth/chzzk/callback
```

The implementation stores the production value in `CHZZK_REDIRECT_URI`. The authorization request must send the exact same redirect URI that is registered in CHZZK Developers.

## Files

Create:
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkAuthClient.ts`
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts`
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts`
- `backend/stellive-hub-api/src/routes/chzzkAuthRoutes.ts`
- `backend/stellive-hub-api/test/chzzkAuthRoutes.test.ts`
- `backend/stellive-hub-api/test/chzzkApiClient.test.ts`
- `backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ChzzkBackendBoundaryTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOSTests/ChzzkBackendBoundaryTests.swift`

Modify:
- `backend/stellive-hub-api/.env.example`
- `backend/stellive-hub-api/prisma/schema.prisma`
- `backend/stellive-hub-api/src/app.ts`
- `backend/stellive-hub-api/src/config/env.ts`
- `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- `backend/stellive-hub-api/src/routes/routes.ts`
- `backend/stellive-hub-api/src/admin/adminHealthService.ts`
- `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts`
- `backend/stellive-hub-api/src/repositories/platformApiStateRepository.ts`
- `backend/stellive-hub-api/src/events/eventGuards.ts`
- `backend/stellive-hub-api/src/types.ts`
- `shared/schemas/domain.ts`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainUiPolicyTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift`
- `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift`
- `docs/API_SETUP.md`
- `docs/API_IMPLEMENTATION_PLAN.md`
- `docs/AI_HANDOFF.md`

## Environment Variables

Add these names without real values:

```env
CHZZK_CLIENT_ID=verify_required
CHZZK_CLIENT_SECRET=verify_required
CHZZK_REDIRECT_URI=http://localhost:4000/v1/auth/chzzk/callback
CHZZK_AUTH_STATE_SECRET=replace_with_local_auth_state_secret
CHZZK_ACCESS_TOKEN=verify_required
CHZZK_REFRESH_TOKEN=verify_required
CHZZK_LIVE_POLLING_ENABLED=false
CHZZK_OAUTH_ENABLED=false
CHZZK_TOKEN_REFRESH_SKEW_SECONDS=300
```

## Phase 1: Configuration And Database Shape

- [ ] Add a failing env validation test in `backend/stellive-hub-api/test/foundation.test.ts` proving `CHZZK_REDIRECT_URI`, `CHZZK_OAUTH_ENABLED`, `CHZZK_AUTH_STATE_SECRET`, and `CHZZK_TOKEN_REFRESH_SKEW_SECONDS` are parsed and placeholders do not enable OAuth.

Run:

```bash
cd backend/stellive-hub-api
npm test -- foundation
```

Expected: FAIL because the new env fields are not parsed yet.

- [ ] Modify `backend/stellive-hub-api/src/config/env.ts` to parse the new CHZZK env vars. Treat empty strings, `replace_with_*`, and `verify_required` as not configured for OAuth enablement.

- [ ] Update `backend/stellive-hub-api/.env.example` with the new env var names and no real secrets.

- [ ] Add a Prisma migration plan to `backend/stellive-hub-api/prisma/schema.prisma` by extending `PlatformApiState` usage for CHZZK token metadata and ensuring `LiveStatus.startedAt`, `LiveStatus.sourceVerificationState`, and `LiveStatus.lastTransitionAt` can represent official live status transitions. If `lastTransitionAt` is missing, add it as nullable `DateTime`.

- [ ] Run Prisma generation.

```bash
cd backend/stellive-hub-api
npm run prisma:generate
```

Expected: Prisma client generation succeeds.

- [ ] Run the focused env test again.

```bash
cd backend/stellive-hub-api
npm test -- foundation
```

Expected: PASS.

## Phase 2: CHZZK OAuth Routes

- [ ] Write failing route tests in `backend/stellive-hub-api/test/chzzkAuthRoutes.test.ts` for `GET /v1/auth/chzzk/start`. Assert the response redirects to CHZZK authorization, includes `clientId`, exact `redirectUri`, a generated `state`, and does not include client secret.

- [ ] Add a failing callback test for `GET /v1/auth/chzzk/callback?code=auth-code&state=valid-state`. Mock the auth client, assert the route exchanges the authorization code server-side, stores token metadata through `PlatformApiStateRepository`, and redirects to `/admin?chzzk=connected` or returns a small success response when admin console is disabled.

- [ ] Add a failing callback test for invalid `state`. Assert the route returns `400` with `invalid_oauth_state` and does not call token exchange.

Run:

```bash
cd backend/stellive-hub-api
npm test -- chzzkAuthRoutes
```

Expected: FAIL because the routes and auth client do not exist.

- [ ] Create `backend/stellive-hub-api/src/adapters/chzzk/chzzkAuthClient.ts` with:
  - `buildAuthorizeUrl({ state })`
  - `exchangeCodeForToken({ code, redirectUri })`
  - `refreshAccessToken({ refreshToken })`
  - timeout handling using the same fetch style as existing backend code
  - Zod schemas for token responses

- [ ] Create `backend/stellive-hub-api/src/routes/chzzkAuthRoutes.ts` and register it from `backend/stellive-hub-api/src/app.ts`. Keep the callback public because CHZZK must reach it, but validate `state` before token exchange.

- [ ] Store OAuth state as short-lived signed state using `CHZZK_AUTH_STATE_SECRET`. Use HMAC or an equivalent Node standard-library signing approach; do not store state in a client-visible cookie.

- [ ] Store token metadata in `PlatformApiStateRepository` under `source="chzzk"` keys:
  - `oauth.accessToken`
  - `oauth.refreshToken`
  - `oauth.expiresAt`
  - `oauth.scope`
  - `oauth.tokenType`
  - `oauth.lastRefreshedAt`

- [ ] Run the focused route tests again.

```bash
cd backend/stellive-hub-api
npm test -- chzzkAuthRoutes
```

Expected: PASS.

## Phase 3: CHZZK API Client

- [ ] Write failing client tests in `backend/stellive-hub-api/test/chzzkApiClient.test.ts` using mocked fetch. Cover:
  - authenticated live-status request includes bearer token
  - `401` triggers one refresh and retries once
  - `429` records a rate-limit diagnostic and does not retry immediately
  - malformed provider response returns `verify_required` without producing an event

Run:

```bash
cd backend/stellive-hub-api
npm test -- chzzkApiClient
```

Expected: FAIL because the client does not exist.

- [ ] Create `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts` with a minimal public method:

```ts
getLiveStatus(channelId: string): Promise<ChzzkLiveStatusResult>
```

The result shape must include only normalized fields needed by this app: `channelId`, `isLive`, `title`, `openDate`, `viewerCount`, `platformUrl`, and `sourceVerificationState`.

- [ ] Implement token loading and refresh through `PlatformApiStateRepository`. Prefer repository methods over direct Prisma access.

- [ ] Record adapter health into `PlatformApiStateRepository`:
  - `status="ok"` after successful calls
  - `status="degraded"` for rate limits or transient failures
  - `status="verify_required"` for unsupported or unconfirmed response shapes
  - `status="disabled"` when `CHZZK_LIVE_POLLING_ENABLED=false`

- [ ] Run the focused client tests again.

```bash
cd backend/stellive-hub-api
npm test -- chzzkApiClient
```

Expected: PASS.

## Phase 4: Live Status Adapter And Event Normalization

- [ ] Write failing adapter tests in `backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts`. Seed catalog members with verified `chzzkChannelId` values and assert:
  - active live response upserts `LiveStatus.isLive=true`
  - `openDate` becomes `LiveStatus.startedAt`
  - offline response after cached live state creates one `chzzk_live_ended` event
  - live transition from offline to live creates one `chzzk_live_started` event
  - repeated polling of the same live session does not create duplicate events
  - former members are ignored
  - missing or unverified channel id is skipped with `verify_required`

Run:

```bash
cd backend/stellive-hub-api
npm test -- chzzkOpenApiAdapter
```

Expected: FAIL because the adapter does not exist.

- [ ] Create `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts` with:
  - `pollLiveStatuses()`
  - catalog target selection from active/upcoming members only
  - transition detection using cached `LiveStatus`
  - dedupe keys shaped as `chzzk:<eventType>:<channelId>:<startedAt-or-observed-bucket>`
  - normalized `PlatformEvent` creation for `chzzk_live_started` and `chzzk_live_ended`

- [ ] Modify `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts` to support upsert by `memberId` and fetch current status for transition checks.

- [ ] Route new CHZZK events through the existing ingestion boundary. If `events/ingestionService.ts` still does not exist, create it in the same style described by `docs/API_IMPLEMENTATION_PLAN.md` and keep adapter code from directly sending pushes.

- [ ] Ensure `backend/stellive-hub-api/src/events/eventGuards.ts` still blocks unsupported event types and does not allow `chzzk_chat` from this live-status adapter.

- [ ] Run the focused adapter tests again.

```bash
cd backend/stellive-hub-api
npm test -- chzzkOpenApiAdapter
```

Expected: PASS.

## Phase 5: Scheduler And Admin Diagnostics

- [ ] Add failing tests to `backend/stellive-hub-api/test/adminInternalRoutes.test.ts` for `POST /v1/internal/schedulers/chzzk/live-status`:
  - returns disabled when `CHZZK_LIVE_POLLING_ENABLED=false`
  - returns `verify_required` when OAuth is not configured
  - calls the CHZZK adapter and returns poll counts when enabled and configured
  - requires `INTERNAL_API_TOKEN`

Run:

```bash
cd backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: FAIL until scheduler route delegates to the adapter.

- [ ] Modify `backend/stellive-hub-api/src/routes/internalRoutes.ts` so the CHZZK scheduler route delegates to `chzzkOpenApiAdapter.pollLiveStatuses()` only when enabled and configured.

- [ ] Modify `backend/stellive-hub-api/src/admin/adminHealthService.ts` so admin health shows CHZZK status from `PlatformApiState`, including `lastCheckedAt`, `reason`, and enabled/disabled flags without exposing token values.

- [ ] Run the admin/internal tests again.

```bash
cd backend/stellive-hub-api
npm test -- adminInternalRoutes
```

Expected: PASS.

## Phase 6: Backend API Contract For Mobile Apps

- [ ] Add failing tests in `backend/stellive-hub-api/test/liveStatus.test.ts` proving `GET /v1/live-status` returns persisted CHZZK live status from the repository, including `startedAt`, `platformUrl`, `sourceVerificationState`, and no raw provider payload.

Run:

```bash
cd backend/stellive-hub-api
npm test -- liveStatus
```

Expected: FAIL until the route reads repository data.

- [ ] Modify `backend/stellive-hub-api/src/routes/routes.ts` so `/v1/live-status` uses `LiveStatusRepository` when database access is available and falls back to deterministic mock data only in test/dev modes where no database is configured.

- [ ] Update `shared/schemas/domain.ts` to keep the shared `LiveStatus` contract explicit:
  - `memberId`
  - `generationId`
  - `platform: "chzzk"`
  - `isLive`
  - `title`
  - `viewerCount`
  - `startedAt`
  - `platformUrl`
  - `sourceVerificationState`
  - `lastCheckedAt`

- [ ] Run the live status tests again.

```bash
cd backend/stellive-hub-api
npm test -- liveStatus
```

Expected: PASS.

## Phase 7: Android App Boundary And UI Consumption

- [ ] Add `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ChzzkBackendBoundaryTest.kt` proving Android has no CHZZK client id, client secret, access token, refresh token, or direct CHZZK host constant in app code.

Run:

```bash
cd android/StelliveHubAndroid
./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ChzzkBackendBoundaryTest
```

Expected: FAIL until the test helper scans the intended source paths and app code satisfies the boundary.

- [ ] Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt` only if its live-status DTO does not include backend fields needed by the UI. Add `startedAt`, `platformUrl`, and `sourceVerificationState` parsing if missing.

- [ ] Keep `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt` as local fallback data only. Do not add CHZZK secrets or direct Open API calls.

- [ ] Modify `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt` and `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainUiPolicyTest.kt` only if CHZZK live status display needs new states such as `verify_required`, stale data, or rate-limit degraded status.

- [ ] Run Android focused tests.

```bash
cd android/StelliveHubAndroid
./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.ChzzkBackendBoundaryTest --tests dev.minepacu.stelliveeventnotifier.MainUiPolicyTest
```

Expected: PASS.

## Phase 8: iOS App Boundary And UI Consumption

- [ ] Add `ios/StelliveHubiOS/StelliveHubiOSTests/ChzzkBackendBoundaryTests.swift` proving iOS has no CHZZK client id, client secret, access token, refresh token, or direct CHZZK host constant in app code.

Run:

```bash
xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:StelliveHubiOSTests/ChzzkBackendBoundaryTests
```

Expected: FAIL until the test helper scans the intended source paths and app code satisfies the boundary.

- [ ] Modify `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift` only as local fallback data. Do not add CHZZK secrets or direct Open API calls.

- [ ] Modify `ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift` only if CHZZK live status display needs new states such as `verify_required`, stale data, or rate-limit degraded status.

- [ ] Add or update assertions in `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift` to keep `chzzk_chat` off by default and ensure live-start notifications still follow preferences.

- [ ] Run iOS focused tests.

```bash
xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:StelliveHubiOSTests/ChzzkBackendBoundaryTests -only-testing:StelliveHubiOSTests/PreferenceStateTests
```

Expected: PASS.

## Phase 9: Notification And Realtime Delivery Verification

- [ ] Add failing tests to `backend/stellive-hub-api/test/preferenceResolution.test.ts` proving `chzzk_live_started` obeys global off, platform off, event-type off, generation/member off, quiet hours, keyword rules, and rate limits.

- [ ] Add failing tests to `backend/stellive-hub-api/test/notificationLoadReduction.test.ts` proving `chzzk_live_started` can use immediate push when allowed and realtime eligible, while `chzzk_live_ended` remains standard unless the policy explicitly allows realtime.

Run:

```bash
cd backend/stellive-hub-api
npm test -- preferenceResolution notificationLoadReduction
```

Expected: FAIL until policy coverage matches the new CHZZK event path.

- [ ] Modify preference or load-reduction code only where tests prove a gap. Do not special-case CHZZK in a way that bypasses existing preference resolution.

- [ ] Run focused notification tests again.

```bash
cd backend/stellive-hub-api
npm test -- preferenceResolution notificationLoadReduction
```

Expected: PASS.

## Phase 10: Documentation And Operator Runbook

- [ ] Update `docs/API_SETUP.md` with:
  - CHZZK app registration redirect URL
  - required env vars
  - local OAuth test flow
  - production secret storage guidance
  - admin scheduler trigger behavior

- [ ] Update `docs/API_IMPLEMENTATION_PLAN.md` to replace the current CHZZK `verify_required` placeholder with this adapter path while keeping the rule that unconfirmed endpoints must remain disabled.

- [ ] Update `docs/AI_HANDOFF.md` with current implementation status and remaining operational decisions.

- [ ] Add a short operator checklist:
  - register CHZZK app with `https://<backend-public-origin>/v1/auth/chzzk/callback`
  - set `CHZZK_CLIENT_ID`
  - set `CHZZK_CLIENT_SECRET`
  - set `CHZZK_REDIRECT_URI`
  - set `CHZZK_AUTH_STATE_SECRET`
  - run OAuth connection once from admin
  - keep `CHZZK_LIVE_POLLING_ENABLED=false` until a successful token connection and allowed live endpoint are verified
  - enable polling only after admin health shows CHZZK `ok`

## Full Verification

- [ ] Run backend build.

```bash
cd backend/stellive-hub-api
npm run build
```

Expected: PASS.

- [ ] Run backend tests.

```bash
cd backend/stellive-hub-api
npm test
```

Expected: PASS.

- [ ] Run Android unit tests.

```bash
cd android/StelliveHubAndroid
./gradlew :app:testDebugUnitTest
```

Expected: PASS.

- [ ] Run iOS tests.

```bash
xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

Expected: PASS.

## Rollout Plan

- [ ] Deploy backend with `CHZZK_OAUTH_ENABLED=true` and `CHZZK_LIVE_POLLING_ENABLED=false`.
- [ ] Complete CHZZK OAuth connection from the backend admin flow.
- [ ] Trigger one internal dry-run poll and verify admin health without storing raw provider payloads.
- [ ] Enable `CHZZK_LIVE_POLLING_ENABLED=true` for a low-frequency scheduler.
- [ ] Watch adapter health, rate-limit diagnostics, live status transitions, notification job counts, and delivery attempts for one day.
- [ ] Increase polling frequency only if CHZZK terms, rate limits, and observed diagnostics remain healthy.

## References

- CHZZK authorization: `https://chzzk.gitbook.io/chzzk/chzzk-api/authorization`
- CHZZK API tips: `https://chzzk.gitbook.io/chzzk/chzzk-api/tips`
- Project API implementation plan: `docs/API_IMPLEMENTATION_PLAN.md`
- Project API setup guide: `docs/API_SETUP.md`
- Project rules: `docs/PROJECT_RULES.md`
