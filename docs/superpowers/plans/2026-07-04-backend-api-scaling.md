# Backend API Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe two-to-four-process public API deployment options while keeping schedulers singleton.

**Architecture:** Static Compose API services support Docker Nginx and existing Host Nginx deployments. Redis coordinates music synchronization, while process shutdown closes Fastify, Prisma, and Redis resources.

**Tech Stack:** TypeScript, Fastify, Vitest, Prisma, ioredis, Docker Compose, Nginx, PM2, systemd

---

### Task 1: Health and process lifecycle

**Files:**
- Modify: `backend/stellive-hub-api/src/routes/routes.ts`
- Modify: `backend/stellive-hub-api/src/storage/prisma.ts`
- Modify: `backend/stellive-hub-api/src/index.ts`
- Create: `backend/stellive-hub-api/src/process/gracefulShutdown.ts`
- Test: `backend/stellive-hub-api/test/foundation.test.ts`
- Test: `backend/stellive-hub-api/test/routes.test.ts`
- Test: `backend/stellive-hub-api/test/gracefulShutdown.test.ts`

- [ ] Add failing tests for health worker metadata, disconnecting only an initialized Prisma client, and duplicate shutdown signal suppression.
- [ ] Run the focused tests and confirm they fail for missing behavior.
- [ ] Implement the health payload, Prisma helper, and injected graceful-shutdown coordinator.
- [ ] Register SIGTERM and SIGINT handlers in the process entrypoint.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Redis music synchronization lock

**Files:**
- Modify: `backend/stellive-hub-api/src/music/musicLocks.ts`
- Modify: `backend/stellive-hub-api/src/music/musicSyncService.ts`
- Modify: `backend/stellive-hub-api/src/music/officialStelliveMusicSyncService.ts`
- Modify: `backend/stellive-hub-api/src/music/musicChannelDiscoverySyncService.ts`
- Modify: `backend/stellive-hub-api/src/app.ts`
- Test: `backend/stellive-hub-api/test/musicLocks.test.ts`
- Test: existing music service tests

- [ ] Add failing tests for Redis `NX/PX`, lock contention, owner-checked release, and asynchronous lock consumers.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the asynchronous lock contract and Redis lock with injectable Redis commands.
- [ ] Select Redis when configured, log a production warning for in-memory fallback, and close Redis with the app.
- [ ] Run all music-focused tests.

### Task 3: Deployment configuration

**Files:**
- Create: `backend/stellive-hub-api/docker-compose.scale.yml`
- Create: `backend/stellive-hub-api/docker-compose.host-nginx.yml`
- Create: `backend/stellive-hub-api/nginx.conf`
- Create: `backend/stellive-hub-api/ecosystem.config.cjs`
- Modify: `backend/stellive-hub-api/docker-compose.yml`
- Modify: `backend/stellive-hub-api/package.json`

- [ ] Define reusable static API worker services without public ports.
- [ ] Add Docker Nginx balancing for the selected API services.
- [ ] Add loopback-only host mappings for Host Nginx mode.
- [ ] Keep scheduler services singleton and point internal calls at `api-1` in scaled deployments.
- [ ] Add PM2 cluster start/reload scripts and graceful timeout settings.
- [ ] Validate merged Compose configurations when Docker Compose is available.

### Task 4: Operations documentation

**Files:**
- Create: `docs/BACKEND_SCALING.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `README.md`

- [ ] Document Docker Nginx and Host Nginx two/four-worker commands.
- [ ] Document PM2 and systemd multi-instance operation.
- [ ] Explain stateful route exclusions, singleton schedulers, Redis requirements, and remaining risks.
- [ ] Add load-test commands and measurement criteria without promising a fixed speedup.
- [ ] Link the scaling guide from the architecture and README backend sections.

### Task 5: Final verification

- [ ] Run `rtk npm run build` in the backend directory.
- [ ] Run `rtk npm test` in the backend directory.
- [ ] Run `rtk git diff --check` and inspect only the changed-file summary and focused diffs.
- [ ] Confirm no secrets, production credentials, prohibited assets, Former members, or unsupported official YouTube live behavior were introduced.
