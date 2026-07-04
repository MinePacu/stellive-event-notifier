# Channel Image Cache Read API TTL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce public member read dependence on YouTube while preserving responses during channel-image DB failures.

**Architecture:** Reuse the existing DB batch repository and add a route-scoped full-member short TTL cache. Put graceful fallback at the hydrator boundary and wire two validated environment settings into the default hydrator.

**Tech Stack:** TypeScript, Fastify, Zod, Prisma, Vitest

---

### Task 1: Hydrator failure fallback

**Files:**
- Modify: `backend/stellive-hub-api/test/memberProfileImageHydrator.test.ts`
- Modify: `backend/stellive-hub-api/src/catalog/memberProfileImageHydrator.ts`

- [ ] Add a test whose batch cache read rejects and assert original members are returned and YouTube is not called.
- [ ] Run `rtk npm test -- memberProfileImageHydrator` and confirm the new test fails with the DB error.
- [ ] Catch the initial batch read failure and return cloned original members; use initial records when refresh or the post-refresh read fails.
- [ ] Rerun the focused test and confirm it passes.

### Task 2: Shared member route cache

**Files:**
- Create: `backend/stellive-hub-api/test/memberRoutes.test.ts`
- Modify: `backend/stellive-hub-api/src/routes/routes.ts`

- [ ] Add route tests proving repeated list reads hydrate once, detail reuses the list snapshot, and an unknown ID returns 404.
- [ ] Run `rtk npm test -- memberRoutes` and confirm hydration call counts fail before implementation.
- [ ] Add a 30-second `ShortTtlAsyncCache<Member[]>` inside `registerRoutes` and route both endpoints through it.
- [ ] Rerun the focused test and confirm it passes.

### Task 3: Environment configuration

**Files:**
- Modify: `backend/stellive-hub-api/test/foundation.test.ts`
- Modify: `backend/stellive-hub-api/src/config/env.ts`
- Modify: `backend/stellive-hub-api/src/app.ts`
- Modify: `backend/stellive-hub-api/.env.example`

- [ ] Extend the environment test with default, configured, and non-positive validation assertions.
- [ ] Run `rtk npm test -- foundation` and confirm the new assertions fail.
- [ ] Add both positive integer settings and pass converted values to `MemberProfileImageHydrator`.
- [ ] Add both defaults to `.env.example` and rerun the focused test.

### Task 4: Full verification

**Files:**
- Verify all modified backend files.

- [ ] Run `rtk npm test` from `backend/stellive-hub-api`.
- [ ] Run `rtk npm run build` from `backend/stellive-hub-api`.
- [ ] Run `rtk git diff --check` and inspect the final scoped diff.
