# Admin Dashboard Overview Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce admin overview latency and CHZZK observability load while preserving existing API/UI contracts and preventing false live-ended transitions.

**Architecture:** Keep the existing endpoints and DTOs, but reduce work at every boundary: the browser polls less, `AdminHealthService` shares and caches expensive snapshots, PostgreSQL returns grouped rows, retention becomes configurable, and CHZZK pagination becomes bounded with explicit unverified semantics. All behavior changes are covered by red-green tests and committed in independent slices.

**Tech Stack:** TypeScript, Fastify, Prisma/PostgreSQL, Zod, Vitest, server-rendered HTML with inline JavaScript.

---

### Task 1: Admin refresh interval and overview cache

**Files:**
- Modify: `backend/stellive-hub-api/src/config/env.ts`
- Modify: `backend/stellive-hub-api/.env.example`
- Modify: `backend/stellive-hub-api/src/admin/adminHealthService.ts`
- Modify: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- Test: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
- Test: `backend/stellive-hub-api/test/foundation.test.ts`

- [ ] **Step 1: Add failing configuration and console tests**

Add assertions that `ADMIN_OVERVIEW_CACHE_TTL_SECONDS` defaults to 15, clamps values to 0–60, and that rendered admin HTML contains a 30-second interval with no `Every 5s` or `5000`. Assert that `refreshExternalApiResults()` is guarded by `source === "manual"`.

```ts
expect(loadEnv({ DATABASE_URL: "postgres://test" }).ADMIN_OVERVIEW_CACHE_TTL_SECONDS).toBe(15);
expect(loadEnv({ DATABASE_URL: "postgres://test", ADMIN_OVERVIEW_CACHE_TTL_SECONDS: "99" }).ADMIN_OVERVIEW_CACHE_TTL_SECONDS).toBe(60);
expect(html).toContain("const autoRefreshIntervalMs = 30000");
expect(html).not.toContain("Every 5s");
expect(html).toContain('if (source === "manual")');
```

- [ ] **Step 2: Add failing cache behavior tests**

Construct `AdminHealthService` with counting dependencies and a controllable clock. Verify two concurrent calls share one calculation, a cached call returns a different object, uptime advances with the clock, expiry recalculates, and TTL zero recalculates sequential calls.

```ts
const [first, second] = await Promise.all([service.overview(), service.overview()]);
expect(summarizeDaily).toHaveBeenCalledTimes(1);
expect(first).not.toBe(second);
nowMs += 5_000;
expect((await service.overview()).service.uptimeSeconds).toBe(first.service.uptimeSeconds + 5);
```

- [ ] **Step 3: Run the focused tests and confirm RED**

Run: `rtk npm test -- foundation adminInternalRoutes`

Expected: failures for missing env configuration, 5-second HTML, unconditional recent-result refresh, and absent cache behavior.

- [ ] **Step 4: Implement bounded configuration and cache**

Add a reusable bounded integer schema and the field/example value:

```ts
function boundedInteger(defaultValue: number, min: number, max: number) {
  return z.coerce.number().int().catch(defaultValue).default(defaultValue)
    .transform((value) => Math.min(max, Math.max(min, value)));
}

ADMIN_OVERVIEW_CACHE_TTL_SECONDS: boundedInteger(15, 0, 60),
```

Use `ShortTtlAsyncCache` with a cached snapshot carrying its capture time. Keep `overview()` as the public entry point and move the existing calculation into `calculateOverview()`.

```ts
private readonly now: () => number;
private readonly overviewCache: ShortTtlAsyncCache<{ value: AdminOverview; capturedAtMs: number }>;

async overview(): Promise<AdminOverview> {
  const snapshot = await this.overviewCache.getOrLoad(async () => ({
    value: await this.calculateOverview(),
    capturedAtMs: this.now()
  }));
  const value = structuredClone(snapshot.value);
  value.service.uptimeSeconds += Math.max(0, Math.floor((this.now() - snapshot.capturedAtMs) / 1000));
  return value;
}
```

The cache receives `ttlMs: env.ADMIN_OVERVIEW_CACHE_TTL_SECONDS * 1000`; the existing cache implementation already shares in-flight promises and zero TTL prevents sequential reuse.

- [ ] **Step 5: Implement the 30-second refresh separation**

```js
const autoRefreshIntervalMs = 30000;
const autoRefreshLabel = "Every " + (autoRefreshIntervalMs / 1000) + "s";
```

Replace fixed status text with `autoRefreshLabel`, and call `await refreshExternalApiResults()` only for manual refreshes. Automatic refresh continues to request overview only.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `rtk npm test -- foundation adminInternalRoutes`

Expected: selected suites pass.

- [ ] **Step 7: Commit the admin slice**

```bash
rtk git add backend/stellive-hub-api/.env.example backend/stellive-hub-api/src/config/env.ts backend/stellive-hub-api/src/admin/adminHealthService.ts backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/test/foundation.test.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
rtk git commit -m "perf: cache admin overview refreshes"
```

### Task 2: PostgreSQL daily aggregation

**Files:**
- Modify: `backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts`
- Modify: `backend/stellive-hub-api/src/repositories/externalApiCallLogRepository.ts`
- Test: `backend/stellive-hub-api/test/repositories.test.ts`

- [ ] **Step 1: Replace repository test doubles with aggregate rows**

Add `$queryRaw` mocks and fail if daily summary code invokes `findMany`. Return representative PostgreSQL values as bigint and strings.

```ts
const queryRaw = vi.fn().mockResolvedValue([
  { date: "2026-07-03", sent: 2n, queued: "1", skipped: 0n, failed: 1n, total: 4n }
]);
const findMany = vi.fn(() => { throw new Error("findMany must not be used"); });
```

For external API calls, return two source rows on one date and assert merged `bySource`, status totals, quota units, and zero-filled adjacent dates.

- [ ] **Step 2: Run repository tests and confirm RED**

Run: `rtk npm test -- repositories`

Expected: daily summary tests fail because repositories still call `findMany` and do not accept grouped rows.

- [ ] **Step 3: Add safe aggregate conversion and Prisma client contracts**

```ts
function aggregateNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

interface AggregateQueryClient {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}
```

Repository constructors accept the full query client cast from `getPrismaClient()` while retaining delegates used by other methods.

- [ ] **Step 4: Implement delivery aggregation SQL**

Use a tagged `$queryRaw<DeliveryDailyAggregateRow[]>` query with `startAt` and `now` parameters, KST `to_char`, filtered counts, and grouping by date. Merge returned rows into the existing zero-filled `dateKeys` map and preserve the existing response object.

```sql
SELECT to_char(timezone('Asia/Seoul', "attemptedAt"), 'YYYY-MM-DD') AS date,
       count(*) FILTER (WHERE status = 'sent') AS sent,
       count(*) FILTER (WHERE status = 'queued') AS queued,
       count(*) FILTER (WHERE status = 'skipped') AS skipped,
       count(*) FILTER (WHERE status = 'failed') AS failed,
       count(*) AS total
FROM "DeliveryAttempt"
WHERE "attemptedAt" >= ${startAt} AND "attemptedAt" <= ${now}
  AND status IN ('sent', 'queued', 'skipped', 'failed')
GROUP BY date ORDER BY date ASC
```

- [ ] **Step 5: Implement external API aggregation SQL**

Query by KST date and source, convert aggregate values, then add each source row into its date bucket. Keep the current totals reduction unchanged.

```sql
SELECT to_char(timezone('Asia/Seoul', "requestedAt"), 'YYYY-MM-DD') AS date,
       source, count(*) AS total,
       count(*) FILTER (WHERE "resultStatus" IN ('ok', 'not_modified')) AS ok,
       count(*) FILTER (WHERE "resultStatus" NOT IN ('ok', 'not_modified')) AS failed,
       count(*) FILTER (WHERE "resultStatus" = 'rate_limited' OR "rateLimited" = true) AS "rateLimited",
       count(*) FILTER (WHERE "resultStatus" = 'quota_exceeded') AS "quotaExceeded",
       coalesce(sum("quotaUnits"), 0) AS "quotaUnits"
FROM "ExternalApiCallLog"
WHERE "requestedAt" >= ${startAt} AND "requestedAt" <= ${now}
GROUP BY date, source ORDER BY date ASC, source ASC
```

- [ ] **Step 6: Run repository tests and confirm GREEN**

Run: `rtk npm test -- repositories`

Expected: repository tests pass, including KST boundaries, zero dates, numeric conversion, and `bySource`.

- [ ] **Step 7: Commit the SQL aggregation slice**

```bash
rtk git add backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts backend/stellive-hub-api/src/repositories/externalApiCallLogRepository.ts backend/stellive-hub-api/test/repositories.test.ts
rtk git commit -m "perf: aggregate dashboard trends in postgres"
```

### Task 3: Configurable external API log retention

**Files:**
- Modify: `backend/stellive-hub-api/src/config/env.ts`
- Modify: `backend/stellive-hub-api/.env.example`
- Modify: `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- Test: `backend/stellive-hub-api/test/foundation.test.ts`
- Test: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- [ ] **Step 1: Add failing retention tests**

Assert default 31, lower clamp 14, upper clamp 365, and verify the prune dependency receives the configured value.

```ts
expect(loadEnv({ DATABASE_URL: "postgres://test", EXTERNAL_API_LOG_RETENTION_DAYS: "1" }).EXTERNAL_API_LOG_RETENTION_DAYS).toBe(14);
expect(pruneOlderThan).toHaveBeenCalledWith({ days: 45, now: expect.any(Date) });
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `rtk npm test -- foundation adminInternalRoutes`

Expected: missing env field and hardcoded 31-day route failures.

- [ ] **Step 3: Implement configured retention**

```ts
EXTERNAL_API_LOG_RETENTION_DAYS: boundedInteger(31, 14, 365),
```

Set `.env.example` to 31 and change the route to:

```ts
dependencies.externalApiCallLogs.pruneOlderThan({
  days: options.env.EXTERNAL_API_LOG_RETENTION_DAYS,
  now: dependencies.now?.() ?? new Date()
});
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `rtk npm test -- foundation adminInternalRoutes`

Expected: selected suites pass.

- [ ] **Step 5: Commit the retention slice**

```bash
rtk git add backend/stellive-hub-api/.env.example backend/stellive-hub-api/src/config/env.ts backend/stellive-hub-api/src/routes/internalRoutes.ts backend/stellive-hub-api/test/foundation.test.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
rtk git commit -m "feat: configure external API log retention"
```

### Task 4: Bound CHZZK pagination and protect transitions

**Files:**
- Modify: `backend/stellive-hub-api/src/config/env.ts`
- Modify: `backend/stellive-hub-api/.env.example`
- Modify: `backend/stellive-hub-api/src/app.ts`
- Modify: `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts`
- Modify: `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts`
- Test: `backend/stellive-hub-api/test/foundation.test.ts`
- Test: `backend/stellive-hub-api/test/chzzkApiClient.test.ts`
- Test: `backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts`

- [ ] **Step 1: Add failing page-limit tests**

Configure a client with `liveListMaxPages: 2`, return a second page with another cursor, and assert exactly two live-list calls. Found channels remain verified; pending channels become `verify_required`; diagnostics report `{ pagesFetched: 2, limited: true, pendingUnverified: 1 }`. Add a natural-last-page case that leaves pending channels verified offline.

- [ ] **Step 2: Add failing transition-safety test**

Set the repository previous state to live and return an unverified false status. Assert no `chzzk_live_ended` event, and assert persisted input preserves `isLive: true`, `startedAt`, and `lastTransitionAt` while recording `sourceVerificationState: "verify_required"`.

- [ ] **Step 3: Run CHZZK tests and confirm RED**

Run: `rtk npm test -- chzzkApiClient chzzkOpenApiAdapter foundation`

Expected: failures for absent configuration, unlimited pagination, missing diagnostics, and false-ended protection.

- [ ] **Step 4: Add configuration and wiring**

```ts
CHZZK_LIVE_LIST_MAX_PAGES: boundedInteger(5, 1, 100),
```

Pass `liveListMaxPages: env.CHZZK_LIVE_LIST_MAX_PAGES` from `app.ts` to `ChzzkApiClient`; malformed input falls back to 5, while numeric values are clamped to 1–100. The client constructor also falls back to 5 for direct invalid/non-positive options used outside env wiring.

- [ ] **Step 5: Add backward-compatible batch diagnostics**

```ts
export interface ChzzkLiveStatusBatchDiagnostics {
  pagesFetched: number;
  limited: boolean;
  pendingUnverified: number;
}
export type ChzzkLiveStatusBatch = Map<string, ChzzkNormalizedLiveStatus> & {
  diagnostics?: ChzzkLiveStatusBatchDiagnostics;
};
```

Track pages in `getLiveStatuses()`. If the limit is reached and `next` exists, rewrite only pending entries with `unverifiedStatus`; otherwise retain verified offline defaults. Attach diagnostics to the returned map.

- [ ] **Step 6: Guard adapter persistence and ended events**

Read batch diagnostics into optional `pagesFetched`, `limited`, and `pendingUnverified` count fields. For `verify_required` with a previous record, create an effective status preserving the previous `isLive` value before calling `toLiveStatusInput`. Generate `chzzk_live_ended` only when `status.sourceVerificationState === "verified" && status.isLive === false`.

```ts
const effectiveStatus = status.sourceVerificationState === "verify_required" && previous
  ? { ...status, isLive: previous.isLive }
  : status;
const ended = previous?.isLive === true
  && status.sourceVerificationState === "verified"
  && status.isLive === false;
```

- [ ] **Step 7: Run CHZZK tests and confirm GREEN**

Run: `rtk npm test -- chzzkApiClient chzzkOpenApiAdapter foundation`

Expected: selected suites pass with bounded calls and no false ended event.

- [ ] **Step 8: Commit the CHZZK slice**

```bash
rtk git add backend/stellive-hub-api/.env.example backend/stellive-hub-api/src/config/env.ts backend/stellive-hub-api/src/app.ts backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts backend/stellive-hub-api/test/foundation.test.ts backend/stellive-hub-api/test/chzzkApiClient.test.ts backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts
rtk git commit -m "fix: bound CHZZK live list verification"
```

### Task 5: Final verification and requirement audit

**Files:**
- Verify all modified backend files and tests

- [ ] **Step 1: Run focused suites together**

Run: `rtk npm test -- repositories adminInternalRoutes chzzkApiClient chzzkOpenApiAdapter foundation`

Expected: all selected files pass.

- [ ] **Step 2: Run full backend tests**

Run: `rtk npm test`

Expected: 70 test files and 479 or more tests pass with zero failures.

- [ ] **Step 3: Run TypeScript build**

Run: `rtk npm run build`

Expected: TypeScript compiler exits successfully.

- [ ] **Step 4: Audit required source properties**

Run narrow searches only after Serena verification:

```bash
rtk rg -n "Every 5s|autoRefreshIntervalMs = 5000" backend/stellive-hub-api/src/admin/adminConsoleHtml.ts
rtk rg -n "ADMIN_OVERVIEW_CACHE_TTL_SECONDS|EXTERNAL_API_LOG_RETENTION_DAYS|CHZZK_LIVE_LIST_MAX_PAGES" backend/stellive-hub-api/src/config/env.ts backend/stellive-hub-api/.env.example
rtk git diff --check origin/main...HEAD
```

Expected: first search has no matches; new variables are present; diff check exits successfully.

- [ ] **Step 5: Review commit history and worktree status**

Run: `rtk git status --short && rtk git log --oneline origin/main..HEAD`

Expected: clean worktree and reviewable design/admin/SQL/retention/CHZZK commits.
