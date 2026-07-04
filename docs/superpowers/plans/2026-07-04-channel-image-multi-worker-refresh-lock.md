# Channel Image Multi-Worker Refresh Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deduplicate channel-image YouTube refreshes across Redis-connected backend workers while preserving read availability.

**Architecture:** Inject the existing lock port into the profile hydrator and acquire one deterministic lease per sorted refresh batch. Wire a dedicated Redis lock instance only for the default hydrator and close its connection with the Fastify app.

**Tech Stack:** TypeScript, Redis, Fastify, Vitest

---

### Task 1: Hydrator distributed lock behavior

**Files:**
- Modify: `backend/stellive-hub-api/test/memberProfileImageHydrator.test.ts`
- Modify: `backend/stellive-hub-api/src/catalog/memberProfileImageHydrator.ts`

- [ ] Add failing tests proving the lock owner refreshes and releases, a contender skips YouTube and rereads DB, and acquisition failure returns without YouTube.
- [ ] Run `rtk npm test -- memberProfileImageHydrator` and confirm failures are caused by the missing lock option.
- [ ] Add the optional lock port, deterministic batch key, 30-second lease, owner `finally` release, and failure-safe contention handling.
- [ ] Rerun the focused hydrator tests.

### Task 2: Default Redis wiring

**Files:**
- Modify: `backend/stellive-hub-api/src/app.ts`
- Test: `backend/stellive-hub-api/test/memberProfileImageHydrator.test.ts`

- [ ] Pass `registerClose` into the default hydrator factory.
- [ ] When `REDIS_URL` is set, create `RedisMusicSyncLock` with a channel-image prefix, inject it, and register `close()`.
- [ ] Preserve no-key and no-Redis behavior without adding configuration or Prisma changes.

### Task 3: Verification

**Files:**
- Verify all backend changes and documentation.

- [ ] Run `rtk npm test -- memberProfileImageHydrator memberRoutes foundation musicLocks`.
- [ ] Run `rtk npm run build`.
- [ ] Run `rtk npm test`.
- [ ] Run `rtk git diff --check` and inspect the scoped diff.
