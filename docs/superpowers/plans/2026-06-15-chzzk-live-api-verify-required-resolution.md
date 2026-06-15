Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the remaining CHZZK live API `verify_required` state by proving the correct Open API endpoint, identifier type, authorization requirements, and code changes before enabling production polling.

**Architecture:** Keep CHZZK credentials, OAuth token state, live polling, adapter health, and normalized live-status cache backend-only. Use the existing server-mediated `ChzzkApiClient`, `ChzzkOpenApiAdapter`, `PlatformApiStateRepository`, and internal scheduler endpoint; mobile apps continue to consume only normalized `/v1/bootstrap` and `/v1/live-status` DTOs. Treat every unconfirmed CHZZK API behavior as `verify_required` and never add unofficial crawling, private endpoints, login cookies, or direct mobile CHZZK calls.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Vitest, Docker Compose, CHZZK Developers/Open API.

**Files:**

Create:
- `docs/superpowers/plans/2026-06-15-chzzk-live-api-verify-required-resolution.md`

Likely modify after evidence is collected:
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts`
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts`
- `backend/stellive-hub-api/src/catalog/catalog.ts` or the catalog source file that owns `platforms.chzzkChannelId`
- `backend/stellive-hub-api/test/chzzkApiClient.test.ts`
- `backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts`
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
- `docs/CHZZK_LIVE_API_STATUS.md`
- `docs/API_SETUP.md`
- `docs/API_SETUP_KO.md`

Do not modify:
- Mobile app code, unless backend response contract changes.
- Any `.env` file with real credentials.
- Any code path that introduces unofficial CHZZK scraping, login-cookie access, private websocket/session access, or direct CHZZK calls from mobile apps.

## Phase 1: Confirm The Current Failure Shape

- [x] Reconfirm the running API container has `CHZZK_OAUTH_SCOPES` without printing values.

  Run:

  ```bash
  rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && docker exec stellive-hub-api-api-1 sh -lc '\''v=$(printenv CHZZK_OAUTH_SCOPES); if [ -n "$v" ]; then set -- $v; echo "container_scope_tokens=$#"; else echo "container_scope_tokens=0"; fi'\'''
  ```

  Expected: `container_scope_tokens` is nonzero and matches the configured scope count.

  Evidence, 2026-06-15: `container_scope_tokens=3`.

- [x] Reconfirm OAuth token metadata exists without printing token values.

  Run:

  ```bash
  rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && npx tsx -e "import { PlatformApiStateRepository } from '\''./src/repositories/platformApiStateRepository.ts'\''; (async()=>{ const repo=new PlatformApiStateRepository(); for (const key of ['\''oauth.accessToken'\'','\''oauth.refreshToken'\'','\''oauth.expiresAt'\'','\''oauth.scope'\'']) { const row=await repo.getState('\''chzzk'\'', key); console.log(key + '\'' exists='\'' + Boolean(row) + '\'' status='\'' + (row?.status ?? '\''missing'\'')); } })();"'
  ```

  Expected: access token, refresh token, expiration, and scope rows exist with `enabled` status.

  Evidence, 2026-06-15: `oauth.accessToken`, `oauth.refreshToken`, `oauth.expiresAt`, and `oauth.scope` all existed with `status=enabled`.

- [x] Reproduce the current scheduler outcome and capture only status/counts.

  Run:

  ```bash
  rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && node - <<'\''NODE'\''
  const fs = require("fs");
  const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((line)=>line.trim() && !line.trim().startsWith("#")).map((line)=>{ const idx=line.indexOf("="); return [line.slice(0,idx), line.slice(idx+1)]; }));
  (async () => {
    const res = await fetch("http://127.0.0.1:4000/v1/internal/schedulers/chzzk/live-status", { method: "POST", headers: { Authorization: `Bearer ${env.INTERNAL_API_TOKEN}` } });
    console.log("scheduler_status=" + res.status);
    console.log(await res.text());
  })();
  NODE'
  ```

  Expected before the fix: `scheduler_status=200`, `verifyRequired` equals the checked count, and `eventsCreated=0`.

  Evidence, 2026-06-15: `scheduler_status=200`, `checked=11`, `updated=11`, `eventsCreated=0`, `skipped=2`, `verifyRequired=11`.

- [x] Reconfirm adapter health reason.

  Run:

  ```bash
  rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && node - <<'\''NODE'\''
  const fs = require("fs");
  const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((line)=>line.trim() && !line.trim().startsWith("#")).map((line)=>{ const idx=line.indexOf("="); return [line.slice(0,idx), line.slice(idx+1)]; }));
  (async () => {
    const res = await fetch("http://127.0.0.1:4000/v1/internal/adapters/health", { headers: { Authorization: `Bearer ${env.INTERNAL_API_TOKEN}` } });
    const chzzk = (await res.json()).find((item) => item.source === "chzzk");
    console.log(JSON.stringify({ status: chzzk.status, reason: chzzk.reason }));
  })();
  NODE'
  ```

  Expected before the fix: `{"status":"verify_required","reason":"chzzk_live_api_http_404"}`.

  Evidence, 2026-06-15: `{"status":"verify_required","reason":"chzzk_live_api_http_404"}`.

## Phase 2: Verify The Official Endpoint

- [x] Open CHZZK Developers documentation or the developer console page for the live status/read API tied to the configured app.

  Evidence to record in `docs/CHZZK_LIVE_API_STATUS.md`:
  - Exact endpoint path.
  - HTTP method.
  - Whether channel identifier is a path parameter, query parameter, or request body field.
  - Required authorization header format.
  - Required scope names or scope group.
  - Expected success response shape.
  - Expected `401`, `403`, and `404` meanings.

  Evidence, 2026-06-15: the public CHZZK Developers page is a JavaScript SPA. Its HTML referenced `https://ssl.pstatic.net/static/nng/glive-open/resource/p/static/js/main.16e89f8a.js`. Searching that official bundle found developer-portal routes (`/application`, `/service`) and scope UI terms (`scopeGroups`, `scopeList`, `LIVE_SERVICE`, `LIVE_MANAGE`, `LIVE_COMMERCIAL`), but did not expose a confirmable Open API live-status endpoint path or response schema. An authenticated developer-console API or official document page is still required to confirm the endpoint contract.

- [x] Compare the documented endpoint against current `ChzzkApiClient`.

  Inspect:

  ```bash
  rtk grep -n "liveStatusUrl\\|fetchLiveStatus\\|handleLiveResponse" backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts
  ```

  Decision:
  - If the documented endpoint is not `GET /open/v1/lives/{channelId}`, update the client only after adding tests in Phase 5.
  - If the endpoint matches, continue to Phase 3 before changing code.

  Evidence, 2026-06-15: current `ChzzkApiClient` uses `GET https://openapi.chzzk.naver.com/open/v1/lives/{channelId}`. The official public SPA bundle did not confirm or deny that endpoint, so no code change is justified from Phase 2 evidence alone.

  Additional evidence, 2026-06-15: the official CHZZK GitBook Live API page confirms `GET /open/v1/lives` as the live list endpoint and says it uses Client authentication after application registration. It does not document `GET /open/v1/lives/{channelId}`. The official Channel page confirms `GET /open/v1/channels` with a `channelIds` query parameter for channel information lookup. The official tips page confirms the Open API domain and Client authentication headers. Server probes using `Client-Id` and `Client-Secret` without printing secrets returned `status=200`, `code=200` for both `GET /open/v1/lives?size=1` and `GET /open/v1/channels?channelIds={catalogId}`. This supersedes the earlier uncertainty and justifies Phase 5 code changes.

- [x] Use a single representative channel and the current access token to test the documented endpoint from the server.

  Constraints:
  - Do not print access token or refresh token.
  - Do not print raw private provider responses.
  - Print only HTTP status and a small allowlisted field summary from a successful response.

  Expected:
  - A valid endpoint plus valid identifier returns `200`.
  - A documented permission problem returns `401` or `403`, not an unexplained `404`.
  - If the documented API intentionally returns `404` for unlinked channels, record that as an app/channel authorization requirement.

  Evidence, 2026-06-15: because no documented endpoint was confirmed from the public bundle, the current implemented endpoint shape was probed once from `minepacu@192.168.50.9` using one representative catalog channel and the stored access token, without printing token, channel ID, or raw provider body. Result: `GET /open/v1/lives/{channelId}` returned `404` with JSON content type. This matches the adapter health reason `chzzk_live_api_http_404` and keeps the integration in `verify_required`.

## Phase 3: Verify CHZZK Identifier Type

- [x] List the catalog CHZZK identifiers without adding former members or assets.

  Run:

  ```bash
  rtk grep -n "chzzkChannelId" backend/stellive-hub-api/src shared android ios
  ```

  Expected: only `active` or `upcoming` members and Gangzi representative entries are poll targets; official channels are not CHZZK live targets.

  Evidence, 2026-06-15: `shared/member-catalog/members.seed.json` contains 13 members, 11 entries with `chzzkChannelId`, and 11 pollable CHZZK targets. Pollable roles are `member` and `representative`; pollable statuses are `active`; `official_channel` and `former` entries are not included. Gangzi is included as `representative` under `gamja`.

- [x] For one known active member, compare the stored `chzzkChannelId` with the identifier required by the official endpoint.

  Record:
  - Stored catalog value type.
  - Official API required value type.
  - How the value was verified from an allowed official source.

  Stop condition:
  - If the official API requires a different ID type, do not patch around it with scraping.
  - Add or rename a catalog field only after deciding the exact source of truth.

  Evidence, 2026-06-15: all 11 stored CHZZK IDs are 32-character hex strings. A representative stored ID returned HTTP `200` for the public `https://chzzk.naver.com/live/{id}` URL via `HEAD`, without reading or storing page body. This verifies the stored value is a public CHZZK live URL slug. Additional GitBook verification confirmed `GET /open/v1/channels?channelIds={catalogId}` returns `status=200`, `code=200`, and `dataCount=1` for a representative stored catalog ID using Client authentication, so the catalog ID type is accepted by the official channel information endpoint.

- [ ] If the ID type is wrong, write a failing test that proves the client sends the documented identifier format.

  Test file:

  ```bash
  backend/stellive-hub-api/test/chzzkApiClient.test.ts
  ```

  Expected failure before implementation: the captured request URL does not match the documented identifier shape.

- [ ] Update catalog data or mapping code with verified identifiers only.

  Requirements:
  - Keep unknown or unverified IDs in `verify_required`.
  - Do not introduce former members.
  - Do not add profile images, official logos, screenshots, or copied assets.

## Phase 4: Verify App Authorization, Scope, And Review State

- [ ] Confirm in CHZZK Developers that the configured app is allowed to call the live status endpoint.

  Record:
  - Whether the endpoint requires app review, channel linkage, streamer authorization, or a specific scope group.
  - Whether the current OAuth account/channel is authorized for the target channels.
  - Whether the app is in development, review, or production mode.

  Evidence, 2026-06-15: the public CHZZK Developers SPA bundle exposes developer-portal API route strings including `/clients`, `/clients?`, `/clients/check-duplicate?`, `/scopes`, and `/user/getUserStatus`, plus `approvedScope` and scope group UI terms. Unauthenticated probes to likely scope endpoints returned `404` or connection reset/timeout, and no authenticated developer-console state is available in this workspace. App review state, endpoint entitlement, channel linkage, and OAuth account/channel authorization remain unverified and require a logged-in CHZZK Developers console check by the maintainer.

- [x] Confirm the exact scope strings selected during `/v1/auth/chzzk/start`.

  Constraints:
  - Do not invent scopes.
  - Do not add guessed scopes such as `user:read` or `channel:read` unless they are visible in the official UI/API for this app.
  - Store only the final confirmed space-separated string in server `.env`.

  Evidence, 2026-06-15: server `.env` and the `/v1/auth/chzzk/start` redirect both contained 3 scope tokens with matching normalized fingerprints, so the authorize URL is using the configured scope set. Stored `oauth.scope` from the token response contained 8 tokens with a different normalized fingerprint; the configured 3-token set was not a subset of the stored token-response scope set, and the stored token-response scope set was not a subset of the configured set. Scope values were not printed. This mismatch must be interpreted through official CHZZK scope documentation or the authenticated console before changing scopes.

- [x] If scopes or app permissions change, recreate only the API container after updating `.env`.

  Run:

  ```bash
  rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && docker compose up -d --no-deps --force-recreate api'
  ```

  Expected: `/health` returns `200` after restart.

  Evidence, 2026-06-15: no scope or app permission change was made during Phase 4, so container recreation was not required.

- [x] Revisit `/v1/auth/chzzk/start`, complete OAuth, and re-run Phase 1 scheduler and health checks.

  Success criteria:
  - Scheduler returns `200`.
  - Adapter health becomes `enabled` or another documented non-`verify_required` state.
  - `verifyRequired` count decreases for verified targets.

  Evidence, 2026-06-15: `/v1/auth/chzzk/start` returned `302` and selected the configured 3-token scope set. Scheduler returned `200` with `checked=11`, `updated=11`, `eventsCreated=0`, `skipped=2`, `verifyRequired=11`. Adapter health remained `verify_required` with reason `chzzk_live_api_http_404`; `verifyRequired` did not decrease.

## Phase 5: Patch Code Only After Evidence

- [ ] Add focused tests for the confirmed endpoint behavior.

  Minimum tests:
  - `ChzzkApiClient` uses Client authentication headers for Client-auth endpoints and does not use Bearer Access Token for live list polling.
  - `ChzzkApiClient` calls `GET /open/v1/lives` with `size` and optional `next` query parameters, not `GET /open/v1/lives/{channelId}`.
  - `ChzzkApiClient` normalizes the documented live list success response and filters/matches returned `channelId` values against catalog `chzzkChannelId`.
  - `ChzzkApiClient` can call or validate `GET /open/v1/channels?channelIds=...` for catalog channel metadata when needed.
  - `ChzzkApiClient` records `verify_required` for documented unverified states.
  - `ChzzkOpenApiAdapter` updates live cache without creating events for verify-required rows.

  Run:

  ```bash
  cd backend/stellive-hub-api
  rtk npm test -- chzzkApiClient chzzkOpenApiAdapter
  ```

  Expected before implementation: at least one new test fails for the documented behavior.

- [ ] Implement the minimal endpoint, response, or ID mapping change.

  Constraints:
  - Keep token refresh backend-only.
  - Keep raw provider payloads out of push payloads and public responses.
  - Keep 404/403/401 handling explicit and documented.
  - Keep `verify_required` for unconfirmed channels instead of pretending they are offline.

- [ ] Re-run focused tests.

  Run:

  ```bash
  cd backend/stellive-hub-api
  rtk npm test -- chzzkApiClient chzzkOpenApiAdapter adminInternalRoutes
  ```

  Expected after implementation: focused tests pass.

- [ ] Re-run build.

  Run:

  ```bash
  cd backend/stellive-hub-api
  rtk npm run build
  ```

  Expected: TypeScript build passes.

- [ ] Deploy or copy the verified backend changes to `minepacu@192.168.50.9:~/StelLiveNoti` without transferring secrets or dependency-heavy folders.

  Exclude:
  - `node_modules`
  - build outputs
  - `.env` values from local machines
  - profile images, logos, screenshots, fan art, production device tokens, OAuth credentials

- [ ] Rebuild and restart the remote API container.

  Run:

  ```bash
  rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && docker compose up -d --build api'
  ```

  Expected: API container starts and `/health` returns `200`.

- [ ] Run the remote scheduler verification.

  Success criteria:
  - `POST /v1/internal/schedulers/chzzk/live-status` returns `200`.
  - `counts.checked` covers expected pollable targets.
  - `counts.verifyRequired` is `0` for verified targets or limited to explicitly unverified targets.
  - Adapter health is not `chzzk_live_api_http_404`.
  - Public `/v1/bootstrap` and `/v1/live-status` contain no CHZZK secrets or raw provider payloads.

- [ ] Update docs with the final verified CHZZK behavior.

  Modify:
  - `docs/CHZZK_LIVE_API_STATUS.md`
  - `docs/API_SETUP.md`
  - `docs/API_SETUP_KO.md`
  - `docs/AI_HANDOFF.md`

  Include:
  - Confirmed endpoint.
  - Confirmed identifier type.
  - Confirmed scope names or scope group.
  - Current adapter health expectations.
  - Whether `CHZZK_LIVE_POLLING_ENABLED=true` is allowed for this server.

- [ ] Do not mark CHZZK live polling production-ready until all success criteria are met.

  Required final evidence:
  - Focused backend tests pass.
  - Build passes.
  - Remote scheduler returns non-error status.
  - Adapter health no longer reports undocumented `chzzk_live_api_http_404`.
  - Live-status cache rows for verified targets are not all `verify_required`.
  - Public endpoints do not expose secrets.
