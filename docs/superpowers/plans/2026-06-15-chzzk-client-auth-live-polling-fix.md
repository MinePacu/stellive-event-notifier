Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the incorrect CHZZK live polling call with the official Client-authenticated CHZZK Open API live-list flow, so verified catalog channels can update live-status cache without `chzzk_live_api_http_404`.

**Architecture:** Keep CHZZK API access backend-only. `ChzzkApiClient` should use `Client-Id` and `Client-Secret` headers for Client-authenticated Open API endpoints, call `GET /open/v1/lives`, page through live-list results as needed, and match response `channelId` values to catalog `chzzkChannelId`. `ChzzkOpenApiAdapter` remains responsible for catalog policy, live cache writes, transition event creation, and keeping unknown or unverified targets in `verify_required`; mobile apps continue to consume only normalized backend DTOs.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Vitest, Docker Compose, CHZZK Open API.

**Confirmed Evidence:**
- Official Live API docs: `GET https://openapi.chzzk.naver.com/open/v1/lives`
- Official Channel API docs: `GET https://openapi.chzzk.naver.com/open/v1/channels?channelIds=...`
- Official Client authentication headers: `Client-Id`, `Client-Secret`, `Content-Type: application/json`
- Server probe with real secret values hidden: `GET /open/v1/lives?size=1` returned `status=200`, `code=200`, `dataCount=1`, `hasPage=true`.
- Server probe with real secret values hidden: `GET /open/v1/channels?channelIds={catalogId}` returned `status=200`, `code=200`, `dataCount=1`.
- Current implementation is wrong: `GET /open/v1/lives/{channelId}` with Bearer token returns `404` and records `chzzk_live_api_http_404`.

**Files:**

Modify:
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts`
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts`
- `backend/stellive-hub-api/src/app.ts`
- `backend/stellive-hub-api/test/chzzkApiClient.test.ts`
- `backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts`
- `backend/stellive-hub-api/test/chzzkLiveApiWiring.test.ts`
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
- `docs/CHZZK_LIVE_API_STATUS.md`
- `docs/API_SETUP.md`
- `docs/API_SETUP_KO.md`
- `docs/AI_HANDOFF.md`

Do not modify:
- Mobile app direct networking to CHZZK.
- Catalog membership policy.
- `.env` files containing real credentials.
- Any path that uses unofficial CHZZK crawling, login cookies, private endpoints, private websocket/session bypasses, or direct CHZZK calls from Android/iOS.

## Step 1: Write Failing Client-Auth Live List Tests

- [x] Replace the existing `ChzzkApiClient` test that expects Bearer auth and `GET /open/v1/lives/{channelId}`.

  File:

  ```text
  backend/stellive-hub-api/test/chzzkApiClient.test.ts
  ```

  Add a test named:

  ```text
  uses client authentication and fetches the documented live list endpoint
  ```

  Test expectations:
  - Fake fetch receives URL `https://openapi.chzzk.naver.com/open/v1/lives?size=50`.
  - Headers include `Client-Id: client-id`.
  - Headers include `Client-Secret: client-secret`.
  - Headers include `Content-Type: application/json`.
  - Headers do not include `authorization`.
  - The normalized result can find a returned live row whose `channelId` matches the requested catalog channel ID.

- [x] Add a test named:

  ```text
  returns verify_required when the live list does not include the requested catalog channel
  ```

  Test response:

  ```json
  {
    "code": 200,
    "message": "success",
    "content": {
      "page": { "next": null },
      "data": []
    }
  }
  ```

  Expected normalized status:
  - `channelId` equals the requested catalog channel ID.
  - `isLive` is `false`.
  - `sourceVerificationState` is `verified`, not `verify_required`, because an empty live list is a valid verified offline result.

- [x] Add a test named:

  ```text
  pages through live list results until the catalog channel is found
  ```

  Test expectations:
  - First request uses `size=20`.
  - Second request includes `next=<cursor from first response>`.
  - Matching row on page 2 normalizes to `isLive: true`.

## Step 2: Run Failing Tests

- [x] Run focused tests and confirm they fail for the old implementation.

  ```bash
  cd backend/stellive-hub-api
  rtk npm test -- chzzkApiClient
  ```

  Expected before implementation:
  - Fails because current client sends Bearer authorization.
  - Fails because current client calls `/open/v1/lives/{channelId}`.

## Step 3: Refactor ChzzkApiClient To Client Auth

- [x] Change `ChzzkApiClientOptions` so it receives `clientId` and `clientSecret`, not `ChzzkAuthClient.refreshAccessToken`.

  Target shape:

  ```ts
  interface ChzzkApiClientOptions {
    clientId: string;
    clientSecret: string;
    stateRepository: Pick<PlatformApiStateRepository, "upsertAdapterHealth">;
    fetch?: typeof fetch;
    timeoutMs?: number;
    liveListPageSize?: number;
  }
  ```

- [x] Add constants for official endpoints.

  ```ts
  const liveListUrl = "https://openapi.chzzk.naver.com/open/v1/lives";
  const channelsUrl = "https://openapi.chzzk.naver.com/open/v1/channels";
  ```

- [x] Add `clientAuthHeaders()` that returns only:

  ```ts
  {
    "Client-Id": this.config.clientId,
    "Client-Secret": this.config.clientSecret,
    "Content-Type": "application/json"
  }
  ```

- [x] Remove live polling dependency on these methods:
  - `getAccessToken`
  - `refreshAccessToken`
  - `storeTokenResponse`
  - Bearer `authorization` header

  Keep OAuth code for `/v1/auth/chzzk/start` and `/callback`; it may still be useful for future user-authorized endpoints, but live polling must not depend on it.

## Step 4: Parse Official Live List Response

- [x] Replace `liveResponseSchema` with a response schema for `content.data[]`.

  Required fields to support:
  - `channelId`
  - title field, using whichever official response key is documented or observed in fixtures.
  - live status/open state field, using documented/observed key.
  - open/start date field if present.
  - concurrent viewer field if present.

  Keep `.passthrough()` so provider additions do not break parsing.

- [x] Add `getLiveStatus(channelId: string)` implementation that:
  - Calls `GET /open/v1/lives?size=<pageSize>`.
  - Iterates pages using `content.page.next` only while a next cursor exists.
  - Finds `content.data[]` item whose `channelId` equals the catalog ID.
  - Returns `verified` offline when the list is valid but the channel is absent.
  - Returns `verify_required` only for transport errors, schema failures, undocumented status, or provider responses that cannot be trusted.

- [x] Preserve health behavior:
  - `429` writes `rate_limited / chzzk_live_api_rate_limited`.
  - `401` or `403` writes `verify_required / chzzk_live_api_auth_required`.
  - `404` writes `verify_required / chzzk_live_api_http_404`.
  - Other non-OK responses write `verify_required / chzzk_live_api_http_<status>`.
  - Successful list response writes adapter health `enabled` with reason `chzzk_live_api_verified` after at least one page parses successfully.

## Step 5: Optionally Add Channel Metadata Validation

- [ ] Add `getChannelInfo(channelIds: string[])` only if tests or adapter flow need pre-validation.

  Endpoint:

  ```text
  GET https://openapi.chzzk.naver.com/open/v1/channels?channelIds=<comma-or-repeat-format-confirmed-by-test-fixture>
  ```

  Constraints:
  - Do not call this for every poll if live list matching is enough.
  - Use it for diagnostics or catalog verification, not as the primary live status mechanism.
  - Batch at most 20 IDs per official docs.

## Step 6: Update App Wiring

- [x] Update `backend/stellive-hub-api/src/app.ts` so `createDefaultChzzkLiveAdapter` constructs `ChzzkApiClient` with:

  ```ts
  new ChzzkApiClient({
    clientId: env.CHZZK_CLIENT_ID,
    clientSecret: env.CHZZK_CLIENT_SECRET,
    stateRepository,
    tokenRefreshSkewSeconds: env.CHZZK_TOKEN_REFRESH_SKEW_SECONDS,
    fetch: fetchImpl
  })
  ```

  Adjust the final shape to match the refactored constructor. Remove `ChzzkAuthClient` from live polling construction if it is no longer needed there.

- [x] Keep `registerChzzkAuthRoutes` unchanged unless TypeScript requires imports to move. OAuth routes should still use `ChzzkAuthClient`.

## Step 7: Update Adapter Tests

- [x] Update `backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts` only where assumptions changed.

  Required assertions:
  - Former members are still skipped.
  - Official channels are still skipped.
  - Gangzi representative remains pollable if it has `chzzkChannelId`.
  - A verified offline response updates cache with `isLive: false` and `sourceVerificationState: "verified"`.
  - A verified live response can still create `chzzk_live_started` when previous cache was offline.
  - `chzzk_chat` remains unsupported and does not create events.

## Step 8: Run Focused Tests

- [x] Run:

  ```bash
  cd backend/stellive-hub-api
  rtk npm test -- chzzkApiClient chzzkOpenApiAdapter chzzkLiveApiWiring adminInternalRoutes
  ```

  Expected:
  - All focused tests pass.
  - No test expects `/open/v1/lives/{channelId}`.
  - No live polling test expects Bearer access token.

## Step 9: Run Build

- [x] Run:

  ```bash
  cd backend/stellive-hub-api
  rtk npm run build
  ```

  Expected: TypeScript build passes.

## Step 10: Remote Server Deployment Verification

- [x] Copy only verified source changes to `minepacu@192.168.50.9:~/StelLiveNoti`.

  Do not transfer:
  - `.env` values from local machines
  - `node_modules`
  - build outputs
  - profile images, official logos, screenshots, fan art
  - production device tokens or OAuth secrets

- [x] Rebuild and restart the API container.

  ```bash
  rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && docker compose up -d --build api'
  ```

- [x] Confirm `/health`.

  ```bash
  rtk ssh minepacu@192.168.50.9 'curl -fsS http://127.0.0.1:4000/health'
  ```

  Expected: `{"ok":true,"service":"stellive-hub-api"}`.

- [x] Run scheduler.

  ```bash
  rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && node <masked internal-token scheduler probe>'
  ```

  Expected:
  - HTTP `200`.
  - `checked=11`.
  - `updated=11`.
  - `verifyRequired` is not `11` unless the official live list response is unavailable or the app loses Client API access.
  - Adapter health is not `chzzk_live_api_http_404`.

  Result on 2026-06-15:
  - Initial remote probe found `size=50` returns CHZZK HTTP `400`; implementation now uses `size=20`.
  - Initial remote scheduler then found `message: null` success responses; schema now accepts nullable `message`.
  - Remote scheduler returned `checked=11`, `updated=11`, `eventsCreated=0`, `skipped=2`, `verifyRequired=0`.
  - Remote adapter health returned `status=enabled`, `reason=chzzk_live_api_verified`.
  - Remote public secret-pattern checks passed for `/health`, `/v1/bootstrap`, and `/v1/live-status`.
  - Remote focused tests passed with 5 files and 52 tests.
  - Remote TypeScript build passed.

- [x] Confirm public endpoints do not expose secrets.

  Check:
  - `/health`
  - `/v1/bootstrap`
  - `/v1/live-status`

  Expected:
  - All return `200`.
  - No response contains `CHZZK_CLIENT`, `CHZZK_ACCESS`, `CHZZK_REFRESH`, `clientSecret`, `accessToken`, `refreshToken`, `NID_AUT`, or `NID_SES`.

## Step 11: Update Documentation

- [x] Update `docs/CHZZK_LIVE_API_STATUS.md`.

  Include:
  - Client-authenticated live polling now uses `GET /open/v1/lives`.
  - Catalog matching uses response `channelId`.
  - `GET /open/v1/channels?channelIds=...` is available for channel metadata verification.
  - OAuth remains separate from live polling unless a future official endpoint requires user authorization.

- [x] Update `docs/API_SETUP.md` and `docs/API_SETUP_KO.md`.

  Include:
  - `CHZZK_CLIENT_ID` and `CHZZK_CLIENT_SECRET` are required for live polling.
  - `CHZZK_OAUTH_SCOPES` is not required for Client-authenticated live list polling.
  - `CHZZK_LIVE_POLLING_ENABLED=true` should be enabled only after remote scheduler health confirms non-`verify_required`.

- [x] Update `docs/AI_HANDOFF.md`.

  Include:
  - The old `/open/v1/lives/{channelId}` Bearer-token implementation was replaced.
  - Latest test/build/remote scheduler verification output.

## Step 12: Do Not Overreach

- [x] Do not add a new database model.
- [x] Do not add Redis/BullMQ changes.
- [x] Do not change mobile DTOs unless response contract tests fail.
- [x] Do not delete OAuth routes; keep them isolated from live polling.
- [x] Do not mark production-ready until focused tests, build, and remote scheduler verification all pass.
