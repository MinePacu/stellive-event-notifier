# Code Design Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this design task-by-task.

**Source Plan:** `docs/superpowers/plans/2026-06-16-chzzk-offline-channel-image-url.md`

**Goal:** Extend the CHZZK backend polling path so offline catalog targets can receive `channelImageUrl` from official CHZZK channel metadata, while preserving live-state correctness, cached image URLs, and existing policy boundaries.

**Design Summary:** `ChzzkApiClient` remains the only module that knows CHZZK Open API response shapes. Live state continues to come from `GET /open/v1/lives`; channel image fallback comes from `GET /open/v1/channels?channelIds=...`. `ChzzkOpenApiAdapter` receives one normalized `ChzzkNormalizedLiveStatus` per catalog target and persists `channelImageUrl` into the existing `liveStatus.thumbnailUrl` field, which route DTOs expose as `channelImageUrl`.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Vitest, Docker Compose, CHZZK Open API.

## Non-Negotiable Boundaries

- Use official CHZZK Open API endpoints only.
- Do not scrape CHZZK HTML, use login cookies, call private endpoints, bypass access controls, or run browser automation against provider pages.
- Do not store image binaries, copied CDN assets, screenshots, official logos, fan art, secrets, OAuth tokens, or raw provider payloads.
- Treat `channelImageUrl` as an ephemeral runtime URL returned by an official API. Clients must keep placeholder fallback behavior.
- Do not alter catalog membership rules. Former members remain excluded. Gangzi remains `generationId: "gamja"` and `catalogRole: "representative"`.
- Do not create notifications, push jobs, or history rows from channel metadata changes alone.
- Do not change preference resolution or `realtime_best_effort` semantics.

## Current State

Current polling flow:

1. `ChzzkOpenApiAdapter.pollLiveStatuses()` iterates supported catalog targets.
2. `ChzzkApiClient.getLiveStatus(channelId)` calls `GET /open/v1/lives`.
3. If the requested channel is present in the live list, the client normalizes live data and may include `channelImageUrl`.
4. If the requested channel is absent, the client returns verified offline status without image metadata.
5. Adapter persists normalized status through `LiveStatusRepository.upsertLiveStatus`.
6. `/v1/live-status` reads diagnostics and exposes `channelImageUrl` if present.

Observed problem:

- Offline members are absent from `GET /open/v1/lives`, so the backend has no opportunity to receive `channelImageUrl` for them.
- Current `channelsUrl` exists in `chzzkApiClient.ts`, but channel metadata fallback is not implemented.
- A verified offline row with no `thumbnailUrl` may clear or fail to preserve an existing image URL unless repository update semantics are made explicit.

## Target Data Flow

For each pollable CHZZK catalog target:

1. Adapter calls `ChzzkApiClient.getLiveStatus(chzzkChannelId)`.
2. Client pages through `GET /open/v1/lives?size=<pageSize>`.
3. Client normalizes matching live row if found.
4. Client calls `GET /open/v1/channels?channelIds=<channelId>` when either condition is true:
   - No matching live row exists, meaning the target is offline.
   - Matching live row exists but lacks `channelImageUrl`.
5. Client merges metadata image URL into the normalized status.
6. Adapter maps `channelImageUrl` to `thumbnailUrl`.
7. Repository writes a new HTTPS image URL or preserves the existing DB image URL when no new URL is available.
8. Public `/v1/live-status` exposes `channelImageUrl` from diagnostics.

No metadata-only path should generate `PlatformEvent`, `NotificationJob`, push payloads, or user-visible history.

## Module Responsibilities

### `ChzzkApiClient`

Owns:

- CHZZK Open API URLs.
- Client-auth headers.
- Fetch timeout handling.
- Zod parsing for live-list and channel metadata responses.
- Normalizing provider DTOs into internal CHZZK client DTOs.
- Adapter health writes for CHZZK API failures.

Does not own:

- Catalog policy.
- Database writes.
- Notification event creation.
- Preference resolution.
- Push delivery.

### `ChzzkOpenApiAdapter`

Owns:

- Selecting pollable catalog members and representative entries.
- Excluding unsupported roles and official channels.
- Calling `ChzzkApiClient`.
- Comparing previous cache with current status.
- Creating live started/ended events only from live-state transitions.
- Writing normalized live status cache rows.

Does not own:

- Raw provider response parsing.
- Channel metadata API shape.
- Mobile DTO formatting.

### `LiveStatusRepository`

Owns:

- Prisma upsert behavior for `liveStatus`.
- Preserving existing `thumbnailUrl` when incoming normalized data has no image URL.
- Returning diagnostics with `channelImageUrl`.

Does not own:

- Provider API semantics.
- Image validation beyond simple write-preservation rules.
- Notification behavior.

### `routes.ts`

Owns:

- Public `/v1/live-status` DTO mapping.
- Including `channelImageUrl` for repository-backed rows.
- Avoiding raw provider payloads and secrets in responses.

## Type Design

### Existing Type To Keep

File: `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts`

Keep this type as the only status returned to the adapter:

```ts
interface ChzzkNormalizedLiveStatus {
  channelId: string;
  isLive: boolean;
  title?: string;
  channelImageUrl?: string;
  openDate?: string;
  viewerCount?: number;
  platformUrl?: string;
  sourceVerificationState: "verified" | "verify_required";
}
```

### New Internal Metadata Type

Add this private client type:

```ts
interface ChzzkChannelMetadata {
  channelId: string;
  channelImageUrl?: string;
  sourceVerificationState: "verified" | "verify_required";
}
```

The adapter should not import or depend on `ChzzkChannelMetadata`.

### Health Reason Type

If the code currently uses string health reasons directly, keep the same pattern and add constants near the client implementation:

```ts
const chzzkHealthReasons = {
  liveVerified: "chzzk_live_api_verified",
  liveInvalid: "chzzk_live_api_response_invalid",
  liveAuthRequired: "chzzk_live_api_auth_required",
  liveRateLimited: "chzzk_live_api_rate_limited",
  channelVerified: "chzzk_channel_api_verified",
  channelInvalid: "chzzk_channel_api_response_invalid",
  channelAuthRequired: "chzzk_channel_api_auth_required",
  channelRateLimited: "chzzk_channel_api_rate_limited"
} as const;
```

Do not widen public API DTO types just for health reasons.

## API Client Design

### Request Helpers

Add a shared helper for client-auth headers:

```ts
private clientAuthHeaders(): Record<string, string> {
  return {
    "Client-Id": this.options.clientId,
    "Client-Secret": this.options.clientSecret,
    "Content-Type": "application/json"
  };
}
```

Use this helper for both live-list and channel metadata requests.

### Channel Metadata URL

Build the metadata URL with `URL` and `URLSearchParams`, not string concatenation:

```ts
private buildChannelsUrl(channelId: string): string {
  const url = new URL(channelsUrl);
  url.searchParams.set("channelIds", channelId);
  return url.toString();
}
```

This keeps encoding correct for future non-hex identifiers.

### Zod Schema

Add a channel item schema:

```ts
const channelItemSchema = z
  .object({
    channelId: z.string().optional(),
    channelImageUrl: z.string().url().optional()
  })
  .passthrough();
```

Add a channel response schema that accepts the documented envelope:

```ts
const channelResponseSchema = z
  .object({
    code: z.union([z.string(), z.number()]).optional(),
    message: z.string().nullable().optional(),
    content: z
      .object({
        data: z.array(channelItemSchema).default([])
      })
      .passthrough()
  })
  .passthrough();
```

If existing live-list parsing already supports alternate envelope names, mirror that compatibility only if tests demonstrate the channel endpoint returns the alternate shape.

### `getChannelMetadata`

Add a private method:

```ts
private async getChannelMetadata(channelId: string): Promise<ChzzkChannelMetadata> {
  const response = await this.fetchWithTimeout(this.buildChannelsUrl(channelId), {
    method: "GET",
    headers: this.clientAuthHeaders()
  });

  if (!response.ok) {
    return this.handleChannelMetadataError(channelId, response);
  }

  const parsed = channelResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    this.writeHealth("verify_required", "chzzk_channel_api_response_invalid");
    return unverifiedChannelMetadata(channelId);
  }

  const match = parsed.data.content.data.find((item) => item.channelId === channelId);
  if (!match) {
    this.writeHealth("verify_required", "chzzk_channel_api_channel_missing");
    return unverifiedChannelMetadata(channelId);
  }

  return {
    channelId,
    channelImageUrl: match.channelImageUrl,
    sourceVerificationState: "verified"
  };
}
```

### Metadata Error Handling

Add a dedicated handler:

```ts
private async handleChannelMetadataError(
  channelId: string,
  response: Response
): Promise<ChzzkChannelMetadata> {
  if (response.status === 429) {
    this.writeHealth("rate_limited", "chzzk_channel_api_rate_limited");
    return unverifiedChannelMetadata(channelId);
  }

  if (response.status === 401 || response.status === 403) {
    this.writeHealth("verify_required", "chzzk_channel_api_auth_required");
    return unverifiedChannelMetadata(channelId);
  }

  this.writeHealth("verify_required", `chzzk_channel_api_http_${response.status}`);
  return unverifiedChannelMetadata(channelId);
}
```

### Offline Merge Logic

Keep live-list lookup as the source of truth for `isLive`.

Proposed high-level shape:

```ts
async getLiveStatus(channelId: string): Promise<ChzzkNormalizedLiveStatus> {
  const liveListResult = await this.findLiveListStatus(channelId);
  if (liveListResult.sourceVerificationState === "verify_required") {
    return liveListResult;
  }

  if (liveListResult.channelImageUrl) {
    return liveListResult;
  }

  const metadata = await this.getChannelMetadata(channelId);
  if (metadata.sourceVerificationState !== "verified") {
    return liveListResult;
  }

  return {
    ...liveListResult,
    channelImageUrl: metadata.channelImageUrl
  };
}
```

Implementation detail:

- Existing `getLiveStatus` can be split into `findLiveListStatus(channelId)`.
- `findLiveListStatus` returns verified offline when live-list parsing succeeds and no match is found.
- Metadata failure must not downgrade a verified live-list result to `verify_required`.
- Live-list failure must still return `verify_required` and must not be masked by metadata success.

## Repository Design

### Preserve Existing `thumbnailUrl`

Update `toWriteData` and `upsertLiveStatus` semantics so `thumbnailUrl` is not cleared when incoming input omits it.

Preferred approach:

- Keep `LiveStatusWriteInput.thumbnailUrl?: string`.
- Build create data normally.
- Build update data with conditional spread:

```ts
const update = {
  generationId: data.generationId,
  isLive: data.isLive,
  title: data.title,
  viewerCount: data.viewerCount,
  startedAt: data.startedAt,
  platformUrl: data.platformUrl,
  sourceVerificationState: data.sourceVerificationState,
  lastCheckedAt: data.lastCheckedAt,
  lastTransitionAt: data.lastTransitionAt,
  ...(data.thumbnailUrl ? { thumbnailUrl: data.thumbnailUrl } : {})
};
```

This keeps the first successful image URL until a later successful image URL replaces it.

### HTTPS Runtime URL Guard

Do not implement heavy URL policy in the repository. Add a small helper before writes:

```ts
function normalizeRuntimeImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith("https://") ? url : undefined;
}
```

Apply it when mapping `channelImageUrl` to repository `thumbnailUrl`.

Rationale:

- CHZZK official API currently returns HTTPS URLs.
- Non-HTTPS URLs should not be persisted as runtime display URLs.
- This is not asset validation and does not download images.

## Adapter Design

`ChzzkOpenApiAdapter` should need minimal changes if `ChzzkApiClient.getLiveStatus` continues to return `ChzzkNormalizedLiveStatus`.

Confirm mapping:

```ts
thumbnailUrl: normalizeRuntimeImageUrl(status.channelImageUrl)
```

Transition logic must remain based on `isLive` and previous cache only:

- Offline to offline with new image URL: write cache only, no event.
- Offline to live: write cache and create `chzzk_live_started` if supported.
- Live to offline: write cache and create `chzzk_live_ended` only if that event remains supported by existing policy.
- Verify-required: write diagnostic state according to existing adapter behavior, no event.

## Public DTO Design

`/v1/live-status` should expose:

```ts
{
  memberId: string;
  generationId: string;
  platform: "chzzk";
  isLive: boolean;
  title?: string;
  viewerCount?: number;
  startedAt?: string;
  channelImageUrl?: string;
  platformUrl?: string;
  lastCheckedAt: string;
  sourceVerificationState: string;
}
```

No public route should expose:

- `Client-Id`
- `Client-Secret`
- OAuth access tokens
- OAuth refresh tokens
- raw CHZZK response bodies
- private adapter error bodies

## Health Design

Do not let optional channel metadata success hide live-list failure.

Rules:

- Live-list auth failure: `verify_required / chzzk_live_api_auth_required`
- Live-list invalid response: `verify_required / chzzk_live_api_response_invalid`
- Live-list success, metadata success: `enabled / chzzk_live_api_verified` or `enabled / chzzk_channel_api_verified`
- Live-list success, metadata invalid: keep status result verified; diagnostics can record `verify_required / chzzk_channel_api_response_invalid`
- Live-list success, metadata missing requested channel: keep status result verified offline without image; diagnostics can record `verify_required / chzzk_channel_api_channel_missing`
- Rate limiting on either endpoint should be visible as `rate_limited`.

If a single `PlatformApiStateRepository.upsertAdapterHealth("chzzk", ...)` row cannot represent both endpoint states cleanly, prefer live-list state for the adapter health row and log metadata limitations in tests/docs. Do not add a new table for this change.

## Test Design

### `chzzkClientAuthLiveList.test.ts`

Add tests:

- Offline channel absent from live list receives `channelImageUrl` from channel metadata.
- Live channel missing `channelImageUrl` receives it from channel metadata while preserving live fields.
- Valid live-list plus metadata schema failure returns verified offline without image.
- Metadata `401` or `403` does not produce raw secret/token output and does not downgrade valid live-list offline status.

Assertions:

```ts
expect(fetchMock).toHaveBeenNthCalledWith(
  2,
  "https://openapi.chzzk.naver.com/open/v1/channels?channelIds=chzzk-channel-id",
  expect.objectContaining({
    method: "GET",
    headers: expect.objectContaining({
      "Client-Id": "client-id",
      "Client-Secret": "client-secret",
      "Content-Type": "application/json"
    })
  })
);
```

### `chzzkApiClient.test.ts`

Add lower-level failure tests if this file owns client error branches:

- Channel metadata `429` writes `rate_limited / chzzk_channel_api_rate_limited`.
- Channel metadata missing requested row writes `verify_required / chzzk_channel_api_channel_missing`.
- Non-HTTPS `channelImageUrl` from metadata is ignored before persistence or before returning normalized status, depending on chosen layer.

### `chzzkOpenApiAdapter.test.ts`

Add adapter tests:

- Offline verified status with `channelImageUrl` writes `thumbnailUrl`.
- Offline image metadata update does not create `PlatformEvent`.
- Official channel catalog entries remain skipped.
- Gangzi representative remains pollable if it has `chzzkChannelId`.

### `liveStatus.test.ts`

Add route tests:

- Repository-backed offline row includes `channelImageUrl`.
- Response body does not contain raw provider or secret fields.

### Repository Test

Add one test to the repository test suite:

- Existing `thumbnailUrl` survives an update where `thumbnailUrl` is omitted.

Use the existing in-memory Prisma delegate pattern from current tests where possible.

## Implementation Sequence

- [ ] Add failing `ChzzkApiClient` metadata fallback tests.
- [ ] Add failing adapter persistence test.
- [ ] Add failing repository cache-preservation test.
- [ ] Add failing public DTO route test if current route coverage does not already assert `channelImageUrl`.
- [ ] Implement channel metadata Zod schema and request helper.
- [ ] Refactor `getLiveStatus` into live-list lookup plus metadata merge.
- [ ] Add channel metadata error handling.
- [ ] Add HTTPS runtime URL guard.
- [ ] Update adapter mapping only if required.
- [ ] Update repository update semantics to preserve cached `thumbnailUrl`.
- [ ] Update docs with actual verification results.

## Verification Commands

Focused tests:

```bash
cd backend/stellive-hub-api
rtk npx vitest run test/chzzkClientAuthLiveList.test.ts test/chzzkApiClient.test.ts test/chzzkOpenApiAdapter.test.ts test/liveStatus.test.ts
```

Build:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Full backend tests:

```bash
cd backend/stellive-hub-api
rtk npm test
```

Remote deploy:

```bash
rtk rsync -az --delete --exclude .git --exclude node_modules --exclude '*/node_modules' --exclude backend/stellive-hub-api/dist --exclude .env --exclude '*/.env' --exclude .env.local --exclude '*/.env.local' --exclude google-services.json --exclude '*/GoogleService-Info.plist' --exclude local.properties --exclude .gradle --exclude build --exclude '*/build' --exclude DerivedData --exclude '*/DerivedData' --exclude qa-screenshots --exclude .superpowers ./ minepacu@192.168.50.9:~/StelLiveNoti/
```

Container recreation:

```bash
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && docker compose up -d --build --force-recreate'
```

Scheduler trigger:

```bash
rtk proxy ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti/backend/stellive-hub-api && docker compose exec -T api node -e '\''fetch("http://127.0.0.1:4000/v1/internal/schedulers/chzzk/live-status",{method:"POST",headers:{Authorization:`Bearer ${process.env.INTERNAL_API_TOKEN}`}}).then(async r=>{console.log(r.status); console.log(await r.text());}).catch(e=>{console.error(e); process.exit(1);})'\'''
```

Public API check:

```bash
rtk proxy ssh minepacu@192.168.50.9 'curl -sS http://127.0.0.1:4000/v1/live-status | node -e '\''let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const rows=JSON.parse(s); const withImage=rows.filter(r=>r.channelImageUrl); console.log(`total=${rows.length} withChannelImageUrl=${withImage.length}`); for (const row of rows.slice(0,5)) console.log(`${row.memberId}\tisLive=${row.isLive}\tstate=${row.sourceVerificationState}\tchannelImageUrl=${row.channelImageUrl ?? "NULL"}`);});'\'''
```

## Acceptance Criteria

- [ ] Offline CHZZK member or representative rows can include `channelImageUrl` when official Channel API metadata includes it.
- [ ] Live CHZZK rows still use live-list state as the source of truth for `isLive`, `title`, `viewerCount`, and `startedAt`.
- [ ] Metadata failure does not turn a verified offline live-list result into `verify_required`.
- [ ] Existing cached `thumbnailUrl` is not cleared when metadata is temporarily unavailable.
- [ ] `/v1/live-status` exposes `channelImageUrl` but never exposes raw provider payloads or secrets.
- [ ] Metadata-only changes do not create events, notification jobs, push payloads, or history rows.
- [ ] Focused tests pass.
- [ ] Backend build passes.
- [ ] Remote server verification shows at least 5 HTTPS `channelImageUrl` values if CHZZK Channel API returns metadata for those targets.

## Deliberately Out Of Scope

- New database tables for channel profiles.
- Image binary download, caching, resizing, or proxying.
- Client-side direct CHZZK API access.
- Catalog membership changes.
- Notification preference changes.
- Redis/BullMQ changes.
- X, YouTube, Naver Cafe, or hub event changes.
- Fallback scraping if official Channel API omits metadata.
