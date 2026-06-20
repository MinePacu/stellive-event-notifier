# Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매년 1월 1일 `Asia/Seoul` 기준으로 그 해의 생일/기념일 occurrence를 DB에 idempotent하게 materialize하고, calendar/widget 응답이 materialized occurrence를 사용할 수 있게 한다.

**Architecture:** `HubCalendarSpecialDayOccurrence` Prisma model과 repository를 추가한다. Internal scheduler endpoint가 catalog special day를 해당 연도 occurrence로 upsert하고, calendar read path는 DB occurrence를 기존 `HubCalendarEntry` DTO로 변환해 HubEvent calendar entries와 병합한다. 기존 projection은 migration/feature flag fallback으로 유지한다.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Vitest.

**Token Policy:** 모든 shell command는 `rtk` prefix를 사용한다. 탐색은 `CODEMAP.md`, `backend/stellive-hub-api/src/hub-events`, `backend/stellive-hub-api/src/routes/internalRoutes.ts`, `backend/stellive-hub-api/prisma/schema.prisma`, 관련 test 파일로 제한한다. 모바일, generated `dist`, unrelated adapter, push, Docker, CI 파일은 실패가 직접 가리키지 않는 한 읽지 않는다. focused test를 먼저 돌리고 full backend test는 마지막에 한 번만 실행한다. 큰 파일은 `rtk rg`로 symbol 위치를 찾은 뒤 필요한 라인만 읽는다.

## Files

Create:
- `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDayOccurrenceRepository.ts`
- `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDayMaterializer.ts`
- `backend/stellive-hub-api/test/hubCalendarSpecialDayMaterializer.test.ts`

Modify:
- `backend/stellive-hub-api/prisma/schema.prisma`
- `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDays.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`
- `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- `backend/stellive-hub-api/src/app.ts` only if internal route dependency injection needs a new optional dependency
- `backend/stellive-hub-api/test/hubCalendarSpecialDays.test.ts`
- `backend/stellive-hub-api/test/hubEventCalendar.test.ts`
- `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`
- `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`
- `docs/AI_HANDOFF.md`

Do not modify:
- Android files
- iOS files
- `shared/openapi/openapi.yaml`, unless endpoint documentation is explicitly requested in a later task
- push notification code
- notification preference code

## Step 1: Inspect Existing Boundaries

- [ ] Run:

```bash
rtk rg -n "HubCalendarSpecialDay|buildSpecialDayEntries|buildHubCalendarResponse|widget-snapshot|internal/schedulers|model HubEvent" CODEMAP.md backend/stellive-hub-api/src/hub-events backend/stellive-hub-api/src/routes backend/stellive-hub-api/prisma backend/stellive-hub-api/test
```

- [ ] Read only:

```bash
rtk read backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDays.ts
rtk read backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts
rtk read backend/stellive-hub-api/src/routes/internalRoutes.ts
rtk read backend/stellive-hub-api/prisma/schema.prisma
rtk read backend/stellive-hub-api/test/hubCalendarSpecialDays.test.ts
rtk read backend/stellive-hub-api/test/hubEventCalendar.test.ts
rtk read backend/stellive-hub-api/test/adminInternalRoutes.test.ts
```

## Step 2: Add Failing Materializer Unit Tests

- [ ] Create `backend/stellive-hub-api/test/hubCalendarSpecialDayMaterializer.test.ts`.
- [ ] Add a test that materializes three catalog entries for `targetYear: 2026`:
  - member birthday `birthday:ayatsuno-yuni`, month `5`, day `21`
  - today-like member birthday with any date in the target year
  - generation anniversary `anniversary:gen3:debut`, month `5`, day `19`, `startYear: 2024`
- [ ] Assert generated occurrence fields:

```ts
expect(result.occurrences).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      id: "special-day-occurrence:birthday:ayatsuno-yuni:2026",
      specialDayId: "birthday:ayatsuno-yuni",
      kind: "member_birthday",
      displayYear: 2026,
      displayDate: "2026-05-21",
      startsAt: "2026-05-20T15:00:00.000Z",
      endsAt: "2026-05-21T15:00:00.000Z",
      specialDayLabel: "생일"
    }),
    expect.objectContaining({
      id: "special-day-occurrence:anniversary:gen3:debut:2026",
      specialDayLabel: "2주년",
      title: "스텔라이브 3기 2주년"
    })
  ])
);
```

- [ ] Add exclusion assertions for `verify_required`, `official`, missing `memberId`, missing `startYear`, and non-positive anniversary year.

## Step 3: Verify RED

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubCalendarSpecialDayMaterializer
```

- [ ] Expected: FAIL because `hubCalendarSpecialDayMaterializer.ts` does not exist.

## Step 4: Implement Pure Materializer

- [ ] Create `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDayMaterializer.ts`.
- [ ] Export:

```ts
export interface SpecialDayOccurrence {
  id: string;
  specialDayId: string;
  kind: "member_birthday" | "generation_anniversary";
  displayYear: number;
  displayDate: string;
  title: string;
  specialDayLabel: string;
  generationId: string;
  memberId?: string;
  startsAt: Date;
  endsAt: Date;
  sourceLabel: string;
  policyState: "catalog_verified";
}

export function buildSpecialDayOccurrences(
  specialDays: HubCalendarSpecialDay[],
  options: { targetYear: number; timezone: "Asia/Seoul"; includeVerifyRequired?: boolean }
): SpecialDayOccurrence[];
```

- [ ] Reuse or move existing helper behavior from `hubCalendarSpecialDays.ts`:
  - `anniversaryYearFor`
  - special day allow-list policy
  - local date formatting
- [ ] Keep this file pure. It must not import Prisma or Fastify.

## Step 5: Verify Materializer GREEN

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubCalendarSpecialDayMaterializer
```

- [ ] Expected: PASS.

## Step 6: Add Prisma Model

- [ ] Modify `backend/stellive-hub-api/prisma/schema.prisma`:

```prisma
model HubCalendarSpecialDayOccurrence {
  id              String   @id
  specialDayId    String
  kind            String
  displayYear     Int
  displayDate     String
  title           String
  specialDayLabel String
  generationId    String
  memberId        String?
  startsAt        DateTime
  endsAt          DateTime
  sourceLabel     String
  policyState     String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([specialDayId, displayYear])
  @@index([displayDate])
  @@index([startsAt])
  @@index([endsAt])
  @@index([generationId])
  @@index([memberId])
  @@index([kind])
}
```

- [ ] Generate Prisma migration only if the repository’s current migration workflow is present. If no migration folder is active in this repo, update schema and document that deployment must run Prisma migration before enabling DB occurrence mode.

## Step 7: Add Repository Tests

- [ ] In `backend/stellive-hub-api/test/hubCalendarSpecialDayMaterializer.test.ts`, add a fake delegate test for repository upsert behavior.
- [ ] Test expected behavior:
  - first run returns `{ created: 2, updated: 0, skipped: 0 }`
  - second run with same year returns no duplicate rows and uses upsert/update semantics
- [ ] Do not require a live PostgreSQL connection in unit tests.

## Step 8: Implement Repository

- [ ] Create `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDayOccurrenceRepository.ts`.
- [ ] Repository API:

```ts
export interface MaterializeSpecialDayYearResult {
  targetYear: number;
  timezone: "Asia/Seoul";
  created: number;
  updated: number;
  skipped: number;
  dryRun: boolean;
}

export class HubCalendarSpecialDayOccurrenceRepository {
  async upsertYear(occurrences: SpecialDayOccurrence[], options: { dryRun?: boolean }): Promise<MaterializeSpecialDayYearResult>;
  async listRange(filters: { from: Date; to: Date; generationId?: string; memberId?: string; kind?: string }): Promise<SpecialDayOccurrence[]>;
}
```

- [ ] Use deterministic `id`.
- [ ] Use Prisma `upsert` with `where: { specialDayId_displayYear: { specialDayId, displayYear } }`.
- [ ] In `dryRun`, do not write; return counts based on what would be attempted if practical. If precise created/updated needs DB reads, keep dryRun counts as `skipped` and document that behavior in test.

## Step 9: Add Internal Endpoint Failing Tests

- [ ] In `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`, add tests for:
  - unauthenticated `POST /v1/internal/schedulers/hub-events/special-days/materialize-year` returns 401
  - authenticated request with `{ "targetYear": 2027 }` calls injected materializer
  - empty body uses current KST year from injected `now`
  - invalid `targetYear` returns 400

## Step 10: Verify RED For Endpoint

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- adminInternalRoutes
```

- [ ] Expected: FAIL because the route does not exist.

## Step 11: Implement Internal Endpoint

- [ ] Modify `backend/stellive-hub-api/src/routes/internalRoutes.ts`.
- [ ] Add dependency:

```ts
specialDayYearMaterializer: {
  materializeYear(input: { targetYear?: number; dryRun?: boolean; now?: Date }): Promise<MaterializeSpecialDayYearResult>;
}
```

- [ ] Default implementation:
  - reads `productionHubCalendarSpecialDays`
  - calls `buildSpecialDayOccurrences`
  - calls `HubCalendarSpecialDayOccurrenceRepository.upsertYear`
- [ ] Add route:

```text
POST /v1/internal/schedulers/hub-events/special-days/materialize-year
```

- [ ] Body validation:
  - `targetYear` optional integer between `2020` and `2100`
  - `dryRun` optional boolean
  - unknown payload keys ignored or rejected consistently with existing internal route style

## Step 12: Verify Endpoint GREEN

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- adminInternalRoutes hubCalendarSpecialDayMaterializer
```

- [ ] Expected: PASS.

## Step 13: Add Calendar Read Failing Tests

- [ ] In `backend/stellive-hub-api/test/hubEventCalendar.test.ts`, add a test that passes materialized occurrence rows and expects them to appear as `HubCalendarEntry`.
- [ ] Assert:
  - `entryKind: "member_birthday"`
  - `specialDayKind: "member_birthday"`
  - `displayDate`
  - `displayTimeText: "종일"`
  - `status` from `startsAt/endsAt` and `now`
- [ ] Add a duplicate prevention assertion: if projection fallback and DB row produce the same `entryKind + eventId + displayDate`, only one entry is returned.

## Step 14: Implement Calendar Merge

- [ ] Modify `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`.
- [ ] Add optional `specialDayOccurrences?: SpecialDayOccurrence[]` to calendar/widget builders.
- [ ] Convert occurrence rows into `HubCalendarEntry` using the existing app deep link shape:

```ts
stellivehub://calendar/special-days/${specialDayId}?date=${displayDate}
```

- [ ] Use occurrence `startsAt` and `endsAt` for status:
  - `now < startsAt`: `upcoming`
  - `startsAt <= now < endsAt`: `open`
  - `now >= endsAt`: `ended`
- [ ] Keep HubEvent behavior unchanged.

## Step 15: Wire Public Read Route

- [ ] Modify `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts` only if existing read route is the place that owns calendar/widget dependencies.
- [ ] Query materialized occurrences for requested `from/to/generationId/memberId/entryKind`.
- [ ] If occurrence repository is unavailable or feature flag is off, keep existing projection fallback.
- [ ] Do not change response DTO shape.

## Step 16: Verify Public Read Tests

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventCalendar hubEventReadRoutes
```

- [ ] Expected: PASS.

## Step 17: Add Operational Docs

- [ ] Update `docs/AI_HANDOFF.md` with:
  - internal endpoint path
  - recommended Jan 1 KST scheduler time
  - Prisma migration requirement
  - verification commands
- [ ] Do not add secrets or real tokens.

## Step 18: Focused Build

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

- [ ] Expected: PASS.

## Step 19: Full Backend Verification

- [ ] Run:

```bash
cd backend/stellive-hub-api
rtk npm test
```

- [ ] Expected: PASS.

## Step 20: Diff Hygiene

- [ ] Run:

```bash
rtk git diff --check
rtk git status --short --branch
```

- [ ] Confirm only planned backend/docs files changed.

## Rollout Notes

- DB occurrence mode must not be enabled before Prisma migration is applied.
- The deployment scheduler should call the internal endpoint at `January 1 00:05 Asia/Seoul` each year.
- The endpoint is idempotent; repeated calls are acceptable.
- For initial rollout, manually call the endpoint once for the current KST year after migration.
- Keep existing projection fallback until production confirms materialized rows exist for the target year.

