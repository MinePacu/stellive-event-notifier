# Bootstrap Partial Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache only shared `/v1/bootstrap` data for short, configurable TTLs while keeping device, preferences, and server time request-specific.

**Architecture:** Add an instance-owned generic async TTL cache that deduplicates concurrent misses. `BootstrapService` composes three caches for hydrated catalog, live status, and hub-event summary, using its injected clock for deterministic expiry. Environment parsing supplies production TTL values without changing the public response schema.

**Tech Stack:** TypeScript, Fastify, Zod, Vitest

---

### Task 1: Async TTL cache utility

**Files:**
- Create: `backend/stellive-hub-api/src/utils/shortTtlAsyncCache.ts`
- Create: `backend/stellive-hub-api/test/shortTtlAsyncCache.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests using a mutable millisecond clock to verify value reuse before expiry, refresh at expiry, concurrent miss deduplication, and retry after a rejected loader.

- [ ] **Step 2: Run tests and verify RED**

Run: `rtk npm test -- shortTtlAsyncCache`

Expected: FAIL because `shortTtlAsyncCache.ts` does not exist.

- [ ] **Step 3: Implement the minimal cache**

Implement `ShortTtlAsyncCache<T>` with constructor options `{ ttlMs, now }` and `getOrLoad(loader)`. Return a fresh cached value only when `now() < expiresAt`; share one `inFlight` promise; cache successful results; clear `inFlight` in `finally`; never cache failures.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `rtk npm test -- shortTtlAsyncCache`

Expected: all cache utility tests pass.

### Task 2: Bootstrap shared-data caches

**Files:**
- Modify: `backend/stellive-hub-api/src/mobile/bootstrapService.ts`
- Modify: `backend/stellive-hub-api/test/mobileBootstrap.test.ts`

- [ ] **Step 1: Write failing service tests**

Add focused tests proving that, inside configured TTLs, catalog reads/profile hydration, live diagnostics, and hub summary run once while device/preferences run on every request and `serverTime` follows the current clock. Add expiry tests that advance mutable time past each TTL and a concurrent-call test that holds async loaders unresolved until all calls have begun.

- [ ] **Step 2: Run tests and verify RED**

Run: `rtk npm test -- mobileBootstrap`

Expected: new call-count and concurrency assertions fail because shared dependencies are currently invoked for every request.

- [ ] **Step 3: Implement minimal service integration**

Extend dependencies with optional `cacheTtlSeconds` containing `catalog`, `liveStatus`, and `hubEventsSummary`. Construct three `ShortTtlAsyncCache` instances per service with defaults `30`, `10`, and `30`, and with `now: () => this.clock().getTime()`. Cache `{ generations, members }` only after visibility filtering and optional hydration; cache live diagnostics and hub summary independently. Keep device, preferences, static config, and `this.clock().toISOString()` outside every cache.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `rtk npm test -- mobileBootstrap shortTtlAsyncCache`

Expected: focused service and cache tests pass with the existing response-shape assertions unchanged.

### Task 3: Environment configuration and app wiring

**Files:**
- Modify: `backend/stellive-hub-api/src/config/env.ts`
- Modify: `backend/stellive-hub-api/src/app.ts`
- Modify: `backend/stellive-hub-api/test/foundation.test.ts`
- Modify: `backend/stellive-hub-api/.env.example`

- [ ] **Step 1: Write failing environment tests**

Assert defaults of `30`, `10`, and `30`; assert custom positive values parse; assert `BOOTSTRAP_LIVE_STATUS_CACHE_TTL_SECONDS=11` throws a Zod validation error.

- [ ] **Step 2: Run tests and verify RED**

Run: `rtk npm test -- foundation`

Expected: new properties are absent and the upper-bound validation does not exist.

- [ ] **Step 3: Add schema, wiring, and examples**

Add three integer TTL fields to `envSchema`, with `.max(10)` only for live status. Pass them under `cacheTtlSeconds` when `buildApp()` constructs its default `BootstrapService`. Add all three documented defaults to `.env.example`.

- [ ] **Step 4: Run focused tests and build**

Run: `rtk npm test -- foundation mobileBootstrap shortTtlAsyncCache`

Run: `rtk npm run build`

Expected: tests and TypeScript build pass.

### Task 4: Final verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Run the full backend suite**

Run: `rtk npm test`

Expected: all backend tests pass.

- [ ] **Step 2: Verify response and repository hygiene**

Run: `rtk git diff --check`

Run a targeted search confirming no shared mobile schema was modified and inspect `rtk git diff --stat` plus the focused diff. Confirm unrelated untracked user files remain untouched.
