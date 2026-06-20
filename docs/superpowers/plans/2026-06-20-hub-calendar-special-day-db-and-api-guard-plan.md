# Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore `/v1/hub-events/calendar` so mobile goods/events month feeds show published Hub Events even when the special-day occurrence table is missing, then make the server DB schema match the current Prisma schema.

**Architecture:** Apply the existing Prisma `HubCalendarSpecialDayOccurrence` model to the server PostgreSQL database first, because the deployed API already tries to read that table. Then add a route-level guard around optional special-day occurrence reads so a missing or unavailable occurrence table disables only special-day enrichment, not the whole Hub Event calendar/widget response. Keep Hub Event reads, admin routes, DTO schemas, and mobile API contracts unchanged.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Vitest, Docker Compose.

**Token Policy:** Use `rtk` for every shell command. Start with `rtk rg -n` and read only short `rtk proxy sed -n` windows around matched code. Do not inspect mobile code, admin console HTML, notification workers, adapters, generated `dist`, Docker internals, or OpenAPI unless a focused failure points there. Prefer one focused test file and one route file change. Do not paste long logs; summarize only failing test names and the minimal error.

## Current Root Cause

The internal server currently returns Hub Event list and summary data, but `/v1/hub-events/calendar` fails with Prisma `P2021` because `public.HubCalendarSpecialDayOccurrence` does not exist in the server database. Adding `includeSpecialDays=false` makes the same calendar request return the July 11 Hub Event, proving regular Hub Event calendar projection works and only optional special-day occurrence lookup is blocking the response.

## Files

Modify:

```text
backend/stellive-hub-api/package.json
backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts
backend/stellive-hub-api/test/hubEventReadRoutes.test.ts
```

Do not modify:

```text
android/
ios/
shared/openapi/openapi.yaml
backend/stellive-hub-api/src/admin/adminConsoleHtml.ts
backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts
backend/stellive-hub-api/src/jobs/
backend/stellive-hub-api/src/adapters/
backend/stellive-hub-api/docker-compose.yml
```

Operational command only:

```text
backend/stellive-hub-api/prisma/schema.prisma
```

The schema already contains `model HubCalendarSpecialDayOccurrence`; do not change it unless verification proves the model is missing or malformed.

## Step 1: Confirm The Failure Shape

- [ ] Run the server calendar request with special days enabled:

```bash
rtk curl -s 'http://192.168.50.9:4000/v1/hub-events/calendar?from=2026-07-01&to=2026-07-31&timezone=Asia%2FSeoul'
```

Expected: `500` with Prisma `P2021` and `HubCalendarSpecialDayOccurrence` table missing.

- [ ] Run the same request with special days disabled:

```bash
rtk curl -s 'http://192.168.50.9:4000/v1/hub-events/calendar?from=2026-07-01&to=2026-07-31&timezone=Asia%2FSeoul&includeSpecialDays=false'
```

Expected: `200` with a `2026-07-11` `hub_event` entry.

## Step 2: Add A Stable Prisma Schema Apply Script

- [ ] Modify `backend/stellive-hub-api/package.json`.

Add scripts:

```json
"prisma:push": "prisma db push",
"prisma:push:deploy": "prisma db push --skip-generate"
```

Reasoning: this repo currently has no `prisma/migrations` directory, so the immediate server-compatible schema apply path is Prisma DB push. Keep the existing `prisma:generate` and `prisma:migrate` scripts unchanged.

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Expected: PASS.

## Step 3: Apply The Existing Prisma Schema On The Server

- [ ] Sync the workspace to the internal server using the standard project rsync command from `AGENTS.md`.

- [ ] Run Prisma DB push against the server PostgreSQL database from the API container image or compose service:

```bash
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti && docker compose -f backend/stellive-hub-api/docker-compose.yml run --rm api npm run prisma:push:deploy'
```

Expected: Prisma reports the database is in sync or creates `HubCalendarSpecialDayOccurrence`.

- [ ] Recreate containers:

```bash
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti && docker compose -f backend/stellive-hub-api/docker-compose.yml up -d --build --force-recreate'
```

Expected: `api`, `chzzk-live-worker`, `postgres`, and `redis` are `Up`.

- [ ] Verify the default calendar endpoint now works:

```bash
rtk curl -s 'http://192.168.50.9:4000/v1/hub-events/calendar?from=2026-07-01&to=2026-07-31&timezone=Asia%2FSeoul'
```

Expected: `200`, with the July 11 Hub Event present. Special-day entries may be empty until materialization runs.

## Step 4: Add Failing Tests For Optional Special-Day Occurrence Failure

- [ ] Modify `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`.

Add tests using `buildRouteApp(...)` with `hubCalendarSpecialDayOccurrences.listRange` throwing an object shaped like:

```ts
Object.assign(new Error("missing table"), { code: "P2021" })
```

Test cases:

```text
GET /v1/hub-events/calendar returns 200 and includes normal hub_event entries when occurrence listRange throws P2021.
GET /v1/hub-events/widget-snapshot returns 200 and includes normal hub_event data when occurrence listRange throws P2021.
GET /v1/hub-events/calendar still propagates non-P2021 occurrence errors as 500.
```

Keep assertions narrow:

```text
response.statusCode === 200
response.json().days contains the expected hub_event entry
```

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventReadRoutes
```

Expected: FAIL on the new P2021 guard tests because the route currently awaits `listRange(...)` directly.

## Step 5: Implement Route-Level Guard

- [ ] Modify `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts`.

Add a small helper near the route registration code:

```ts
function isMissingOptionalSpecialDayOccurrenceStore(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "P2021";
}
```

Add a second helper:

```ts
async function listOptionalSpecialDayOccurrences(
  store: RegisterHubEventReadRouteOptions["hubCalendarSpecialDayOccurrences"] | undefined,
  filters: { from: Date; to: Date; generationId?: string; memberId?: string; kind?: string },
  includeSpecialDays?: boolean
): Promise<SpecialDayOccurrence[]> {
  if (includeSpecialDays === false || !store) return [];
  try {
    return await store.listRange(filters);
  } catch (error) {
    if (isMissingOptionalSpecialDayOccurrenceStore(error)) {
      app.log.warn({ err: error }, "Special-day occurrence table is unavailable; continuing without special-day entries");
      return [];
    }
    throw error;
  }
}
```

If the helper needs `app.log`, either define it inside `registerHubEventReadRoutes` or pass a `FastifyBaseLogger`. Prefer the smallest local helper that avoids broad logging abstraction.

- [ ] Replace both direct occurrence reads in:

```text
GET /v1/hub-events/calendar
GET /v1/hub-events/widget-snapshot
```

Use the helper so `P2021` returns `[]` and non-P2021 errors still throw.

## Step 6: Verify Focused Tests

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventReadRoutes
```

Expected: PASS.

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubCalendarSpecialDayMaterializer
```

Expected: PASS, confirming the occurrence model/materializer path still works.

## Step 7: Verify Backend Build And Full Backend Tests

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Expected: PASS.

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test
```

Expected: PASS. If unrelated tests fail, report the failing test name and do not inspect unrelated files unless the failure points to the changed route.

- [ ] Run:

```bash
rtk git diff --check
rtk git status --short --branch
```

Expected: no whitespace errors. Changed files should be limited to the files listed in this plan unless a focused failure justifies a narrow test-only addition.

## Step 8: Deploy The Guard And Re-Verify Server

- [ ] Sync current workspace to `minepacu@192.168.50.9:~/StelLiveNoti` with the standard rsync exclusions from `AGENTS.md`.

- [ ] Run DB push again. It must be idempotent:

```bash
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti && docker compose -f backend/stellive-hub-api/docker-compose.yml run --rm api npm run prisma:push:deploy'
```

Expected: database already in sync or no destructive change.

- [ ] Rebuild and recreate containers:

```bash
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti && docker compose -f backend/stellive-hub-api/docker-compose.yml up -d --build --force-recreate'
```

- [ ] Verify the server:

```bash
rtk curl -s 'http://192.168.50.9:4000/v1/hub-events/calendar?from=2026-07-01&to=2026-07-31&timezone=Asia%2FSeoul'
rtk curl -s 'http://192.168.50.9:4000/v1/hub-events?from=2026-07-01&to=2026-07-31&limit=100'
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti && docker compose -f backend/stellive-hub-api/docker-compose.yml logs --no-color --tail=40 api'
```

Expected:

```text
/v1/hub-events/calendar returns 200.
The July 11 Hub Event is present in calendar days.
/v1/hub-events returns the same event metadata.
API logs show normal startup and no repeated P2021 errors.
```

## Acceptance Criteria

- `HubCalendarSpecialDayOccurrence` exists in the server PostgreSQL database after schema apply.
- `/v1/hub-events/calendar` returns normal Hub Event entries with default `includeSpecialDays`.
- If the optional special-day occurrence table is missing in another environment, `/v1/hub-events/calendar` and `/v1/hub-events/widget-snapshot` still return normal Hub Event data.
- Non-P2021 occurrence repository errors are not swallowed.
- No mobile, OpenAPI, admin console, notification, adapter, Docker, or asset changes are included.

## Rollback Notes

The API guard is code-only and can be reverted normally. The DB schema apply creates a table for existing Prisma schema; do not drop it during rollback unless explicitly requested. If a production-like environment needs strict migration history later, create a proper Prisma migration in a separate task rather than mixing migration-history repair with this incident fix.
