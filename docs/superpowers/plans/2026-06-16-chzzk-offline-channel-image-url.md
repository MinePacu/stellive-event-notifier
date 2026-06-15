# Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Make backend live-status polling populate `channelImageUrl` for CHZZK channels even when catalog members are currently offline, using official CHZZK Open API channel metadata only.

**Architecture:** Keep all CHZZK API access server-mediated in `backend/stellive-hub-api`. `ChzzkApiClient` should continue to use `GET /open/v1/lives` for live state, then use `GET /open/v1/channels?channelIds=...` as a metadata fallback when the live list does not include an offline channel or when a live-list item lacks `channelImageUrl`. `ChzzkOpenApiAdapter` should persist normalized runtime image URLs in the existing `liveStatus.thumbnailUrl` field and expose them through `/v1/live-status` as `channelImageUrl`, without storing image binaries, raw provider payloads, or scraped data.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Vitest, Docker Compose, CHZZK Open API.

**Policy Constraints:**

- Use official CHZZK Open API endpoints only.
- Do not add HTML crawling, login-cookie scraping, private endpoint access, or browser automation against CHZZK.
- Do not commit profile image binaries, copied CDN assets, screenshots, official logos, fan art, secrets, OAuth tokens, or raw provider payloads.
- Treat returned image values as runtime API URLs only; clients must still keep placeholder fallback behavior.
- Keep Gangzi as `generationId: "gamja"` and `catalogRole: "representative"`.
- Do not add Former members to catalog, seeds, UI filters, or notification targets.
- Do not change notification preference semantics. `realtime_best_effort` must not bypass user settings.

## Files

Modify:

- `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts`
- `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts`
- `backend/stellive-hub-api/src/repositories/liveStatusRepository.ts`
- `backend/stellive-hub-api/src/routes/routes.ts`
- `backend/stellive-hub-api/test/chzzkApiClient.test.ts`
- `backend/stellive-hub-api/test/chzzkClientAuthLiveList.test.ts`
- `backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts`
- `backend/stellive-hub-api/test/liveStatus.test.ts`
- `docs/CHZZK_LIVE_API_STATUS.md`
- `docs/AI_HANDOFF.md`

Do not modify unless tests prove it is required:

- `backend/stellive-hub-api/prisma/schema.prisma`
- `shared/schemas/domain.ts`
- Android or iOS model files

## Step 1: Capture Current Behavior With Failing Tests

- [ ] Add a `ChzzkApiClient` test for an offline channel absent from `GET /open/v1/lives`.

Test file: `backend/stellive-hub-api/test/chzzkClientAuthLiveList.test.ts`

Scenario:

- First mocked request: `GET https://openapi.chzzk.naver.com/open/v1/lives?size=20`
- Response body contains a valid empty live list: `content.data: []`
- Second mocked request: `GET https://openapi.chzzk.naver.com/open/v1/channels?channelIds=chzzk-channel-id`
- Response body contains one channel metadata row with `channelId: "chzzk-channel-id"` and `channelImageUrl: "https://img.example/offline-yuni.jpg"`
- Expected normalized result:

```ts
{
  channelId: "chzzk-channel-id",
  isLive: false,
  channelImageUrl: "https://img.example/offline-yuni.jpg",
  platformUrl: "https://chzzk.naver.com/live/chzzk-channel-id",
  sourceVerificationState: "verified"
}
```

- [ ] Add a `ChzzkApiClient` test for a live channel where live-list data lacks `channelImageUrl`, but channel metadata contains it.

Expected behavior:

- Live status remains `isLive: true`.
- `title`, `viewerCount`, and `openDate` still come from live-list data.
- `channelImageUrl` comes from channel metadata.
- Adapter health remains `enabled / chzzk_live_api_verified`.

- [ ] Add a `ChzzkApiClient` test for channel metadata response schema failure.

Expected behavior:

- If live-list was valid and merely showed the channel offline, the status remains verified offline.
- `channelImageUrl` is omitted.
- Adapter health reason should distinguish metadata failure from live-list failure, for example `chzzk_channel_api_response_invalid`.
- Do not downgrade the entire live-status row to `verify_required` solely because optional metadata lookup failed.

- [ ] Add a `ChzzkOpenApiAdapter` test that an offline poll writes `thumbnailUrl` from `channelImageUrl`.

Test file: `backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts`

Expected write input:

```ts
{
  memberId: "ayatsuno-yuni",
  generationId: "gen1",
  isLive: false,
  thumbnailUrl: "https://img.example/offline-yuni.jpg",
  sourceVerificationState: "verified"
}
```

Run:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/chzzkClientAuthLiveList.test.ts test/chzzkApiClient.test.ts test/chzzkOpenApiAdapter.test.ts
```

Expected: FAIL because channel metadata fallback is not implemented.

## Step 2: Add Channel Metadata Parsing

- [ ] In `chzzkApiClient.ts`, add a Zod schema for `GET /open/v1/channels` responses.

Required response shape:

- Top-level object with optional `code` and `message`.
- `content.data[]` or compatible documented data array shape.
- Each row must allow passthrough fields but explicitly parse:

```ts
{
  channelId: z.string().optional(),
  channelImageUrl: z.string().url().optional()
}
```

- [ ] Add a normalized metadata type:

```ts
interface ChzzkChannelMetadata {
  channelId: string;
  channelImageUrl?: string;
  sourceVerificationState: "verified" | "verify_required";
}
```

- [ ] Add `getChannelMetadata(channelId: string): Promise<ChzzkChannelMetadata>`.

Behavior:

- Calls `GET /open/v1/channels?channelIds=<encoded channelId>`.
- Uses the same `Client-Id`, `Client-Secret`, and `Content-Type: application/json` headers as live-list polling.
- Finds a returned metadata row whose `channelId` equals the requested catalog `chzzkChannelId`.
- Returns `verified` if the endpoint response is valid and the requested row is present.
- Returns `verify_required` only for auth errors, rate limits, transport errors, schema failures that make the response untrustworthy, or missing requested row.

- [ ] Add explicit health reasons:

```ts
"chzzk_channel_api_verified"
"chzzk_channel_api_response_invalid"
"chzzk_channel_api_auth_required"
"chzzk_channel_api_rate_limited"
"chzzk_channel_api_http_<status>"
```

Do not overwrite a successful live-list health state with metadata success unless there is value in the admin diagnostics. If both endpoints are checked in one poll, prefer reporting the most severe state:

- `rate_limited`
- `verify_required`
- `enabled`
- `disabled`

## Step 3: Merge Metadata Into Live Status

- [ ] Refactor `getLiveStatus(channelId)` so it always starts with live-list lookup.

Flow:

1. Fetch and validate live-list pages.
2. If a matching live row is found, normalize live row.
3. If normalized live row has no `channelImageUrl`, call `getChannelMetadata(channelId)`.
4. If no live row is found, call `getChannelMetadata(channelId)` and return verified offline with metadata image when available.
5. If metadata lookup fails but live-list lookup was valid, return verified offline without image, not `verify_required`.

Expected offline result with metadata:

```ts
{
  channelId,
  isLive: false,
  channelImageUrl: metadata.channelImageUrl,
  platformUrl: `https://chzzk.naver.com/live/${channelId}`,
  sourceVerificationState: "verified"
}
```

- [ ] Keep `normalizeLiveStatus` responsible for live-list fields only.

Do not mix live title, viewer count, or open date with channel metadata fields.

- [ ] Ensure metadata lookup is bounded.

For one catalog channel, perform at most one channel metadata request per `getLiveStatus(channelId)` call. Do not add retries or backoff in this change.

## Step 4: Preserve Existing Image Cache Safely

- [ ] Audit `LiveStatusRepository.upsertLiveStatus`.

Current risk:

- If a poll returns no `thumbnailUrl`, an update may clear an already-known image URL depending on Prisma undefined/null behavior and future refactors.

- [ ] Add a repository test in `backend/stellive-hub-api/test/repositories.test.ts` or `backend/stellive-hub-api/test/liveStatus.test.ts`.

Scenario:

1. Existing row has `thumbnailUrl: "https://img.example/cached.jpg"`.
2. New offline verified status has no `thumbnailUrl`.
3. Updated row keeps existing `thumbnailUrl`.

Expected:

```ts
expect(updated.thumbnailUrl).toBe("https://img.example/cached.jpg");
```

- [ ] Implement cache preservation only for `thumbnailUrl`.

Rules:

- If incoming `thumbnailUrl` is a non-empty HTTPS URL, write it.
- If incoming `thumbnailUrl` is `undefined`, do not overwrite the existing DB value.
- If a future explicit clearing behavior is required, implement it with a distinct explicit null path and tests. Do not introduce that behavior here.

## Step 5: Verify Public DTO Exposure

- [ ] Ensure `/v1/live-status` includes `channelImageUrl` for repository-backed rows.

File: `backend/stellive-hub-api/src/routes/routes.ts`

Expected mapping:

```ts
channelImageUrl: status.channelImageUrl,
```

- [ ] Add or keep `backend/stellive-hub-api/test/liveStatus.test.ts` coverage.

Expected response includes:

```ts
{
  memberId: "ayatsuno-yuni",
  platform: "chzzk",
  isLive: false,
  channelImageUrl: "https://img.example/offline-yuni.jpg"
}
```

- [ ] Confirm no raw provider fields leak.

Assertions:

```ts
expect(response.body).not.toContain("rawPayload");
expect(response.body).not.toContain("clientSecret");
expect(response.body).not.toContain("accessToken");
expect(response.body).not.toContain("refreshToken");
```

## Step 6: Focused Verification

- [ ] Run focused tests:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/chzzkClientAuthLiveList.test.ts test/chzzkApiClient.test.ts test/chzzkOpenApiAdapter.test.ts test/liveStatus.test.ts
```

Expected: PASS.

- [ ] Run build:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Expected: PASS.

- [ ] Run full backend test suite:

```bash
cd backend/stellive-hub-api
rtk npm test
```

Expected: PASS, or document unrelated pre-existing failures with exact test names and reasons.

## Step 7: Server Deployment Verification

- [ ] Sync current workspace to the internal backend test server.

Constraints:

- Preserve server `.env`.
- Exclude `.git`, `node_modules`, `dist`, build folders, Google/Firebase config files, screenshots, profile image binaries, official logos, fan art, production credentials, production device tokens, and raw provider payloads.

Example:

```bash
rtk rsync -az --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude '*/node_modules' \
  --exclude backend/stellive-hub-api/dist \
  --exclude .env \
  --exclude '*/.env' \
  --exclude .env.local \
  --exclude '*/.env.local' \
  --exclude google-services.json \
  --exclude '*/GoogleService-Info.plist' \
  --exclude local.properties \
  --exclude .gradle \
  --exclude build \
  --exclude '*/build' \
  --exclude DerivedData \
  --exclude '*/DerivedData' \
  --exclude qa-screenshots \
  --exclude .superpowers \
  ./ minepacu@192.168.50.9:~/StelLiveNoti/
```

- [ ] Recreate containers:

```bash
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && docker compose up -d --build --force-recreate'
```

- [ ] Trigger CHZZK scheduler without printing secrets:

```bash
rtk proxy ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && docker compose exec -T api node -e '\''fetch("http://127.0.0.1:4000/v1/internal/schedulers/chzzk/live-status",{method:"POST",headers:{Authorization:`Bearer ${process.env.INTERNAL_API_TOKEN}`}}).then(async r=>{console.log(r.status); console.log(await r.text());}).catch(e=>{console.error(e); process.exit(1);})'\'''
```

Expected:

- HTTP status `200`.
- `checked` equals pollable CHZZK targets.
- `updated` equals pollable rows written.
- `verifyRequired` should no longer equal nearly every offline member solely because they are offline.

- [ ] Confirm public live-status image coverage:

```bash
rtk proxy ssh minepacu@192.168.50.9 'curl -sS http://127.0.0.1:4000/v1/live-status | node -e '\''let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const rows=JSON.parse(s); const withImage=rows.filter(r=>r.channelImageUrl); console.log(`total=${rows.length} withChannelImageUrl=${withImage.length}`); for (const row of rows.slice(0,5)) console.log(`${row.memberId}\tisLive=${row.isLive}\tchannelImageUrl=${row.channelImageUrl ?? "NULL"}`);});'\'''
```

Expected:

- At least 5 active or representative CHZZK targets show HTTPS `channelImageUrl` values when CHZZK Channel API returns metadata for those targets.
- Offline rows may have `isLive=false` and still include `channelImageUrl`.
- Official channel rows remain excluded from CHZZK live-status polling.

## Step 8: Documentation Updates

- [ ] Update `docs/CHZZK_LIVE_API_STATUS.md`.

Include:

- Live state comes from `GET /open/v1/lives`.
- Offline channel image metadata comes from `GET /open/v1/channels?channelIds=...`.
- `channelImageUrl` is a runtime URL from official API metadata, not a committed asset.
- Optional metadata lookup failure must not create live events or push notifications.

- [ ] Update `docs/AI_HANDOFF.md`.

Include:

- New fallback behavior.
- Test commands and latest pass/fail status.
- Remote server verification summary.
- Remaining provider limitations, if CHZZK Channel API omits image URLs for any target.

## Step 9: Acceptance Criteria

- [ ] Offline CHZZK catalog targets can receive `channelImageUrl` through official Channel API metadata.
- [ ] `/v1/live-status` exposes `channelImageUrl` for both live and offline rows when available.
- [ ] Existing cached `thumbnailUrl` is not cleared by a later verified offline poll with missing metadata.
- [ ] No raw provider payloads, secrets, image binaries, profile assets, official logos, screenshots, or copied media are committed.
- [ ] No unauthorized scraping, login-cookie use, private endpoint calls, or terms bypasses are introduced.
- [ ] Focused CHZZK tests pass.
- [ ] Backend build passes.
- [ ] Server Docker stack is recreated and `/health` returns `200`.
- [ ] Remote scheduler verification shows at least 5 member or representative rows with HTTPS `channelImageUrl`, unless CHZZK Channel API itself omits metadata; if omitted, document the exact official API limitation without adding scraping.

## Step 10: Out Of Scope

- [ ] Do not add a new avatar asset pipeline.
- [ ] Do not download or cache image binaries.
- [ ] Do not add mobile-side direct CHZZK API calls.
- [ ] Do not change member catalog membership.
- [ ] Do not implement X, YouTube, Naver Cafe, or push notification changes.
- [ ] Do not change notification event generation behavior for offline image metadata updates.
