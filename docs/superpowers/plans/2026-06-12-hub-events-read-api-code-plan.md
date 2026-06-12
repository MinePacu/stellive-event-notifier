Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock GitHub issue #18 and GitLab work item #12 into code by making the public HubEvent read APIs contract-tested, validation-backed, shared DTO-aligned, and OpenAPI-complete.

**Architecture:** Keep `HubEventService` as the read boundary so the current in-memory implementation can later swap to Prisma without changing mobile contracts. Extract HubEvent read route query parsing and validation into a small route helper, then register the same four public endpoints through Fastify with explicit error responses. Treat OpenAPI and shared schemas as the mobile contract, while route tests prove runtime behavior matches the contract.

**Tech Stack:** TypeScript, Fastify, Vitest, shared TypeScript DTOs, OpenAPI 3.1, Android/iOS generated or manually mirrored DTO consumers.

## Source Requirements

- Feature design: `docs/HUB_EVENTS_READ_API_DESIGN.md`
- GitHub issue #18: https://github.com/MinePacu/stellive-event-notifier/issues/18
- GitLab work item #12: https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/12
- Project rules: `docs/PROJECT_RULES.md`
- Notification policy: `docs/NOTIFICATION_POLICY.md`
- Realtime policy: `docs/REALTIME_DELIVERY.md`
- API implementation plan: `docs/API_IMPLEMENTATION_PLAN.md`
- Current handoff: `docs/AI_HANDOFF.md`

## Non-Negotiable Policy Constraints

- Do not add Former members to any catalog, fixture, filter, test, seed, or UI contract.
- Keep Gangzi only as `catalogRole=representative`, `generationId=gamja`, `roleLabel=스텔라이브 대표`.
- Keep `official` displayed as `기타` at UI boundaries and limited to official channel semantics.
- Do not create official YouTube live scheduled/started/ended events.
- Do not add profile image binaries, official logos, fan art, captured screenshots, or copied media assets.
- The read APIs must work when image fields are absent.
- Calendar and widget endpoints must not include livestream, upload, ordinary post, or fan-hosted event fixtures as HubEvents.

## Existing Code Context

- `backend/stellive-hub-api/src/routes/routes.ts` already registers:
  - `GET /v1/hub-events`
  - `GET /v1/hub-events/calendar`
  - `GET /v1/hub-events/widget-snapshot`
  - `GET /v1/hub-events/:id`
  - `GET /v1/hub-events/summary`
- `backend/stellive-hub-api/src/hub-events/hubEventService.ts` already defines `HubEventReadPort`, filtering, effective status, and cursor pagination behavior.
- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts` already builds calendar and widget DTOs.
- `shared/schemas/domain.ts` owns `HubEvent`, `HubEventCategory`, `HubEventParticipationMode`, `HubEventStatus`, and `HubEventSourceType`.
- `shared/schemas/mobileApi.ts` already exposes bootstrap-level mobile DTOs including optional `hubCalendarWidgetSnapshot`.
- `shared/openapi/openapi.yaml` already has partial public HubEvent path/schema definitions that must be completed and verified.

## Files

Create:

- `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`
- `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts`

Modify:

- `backend/stellive-hub-api/src/routes/routes.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventService.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`
- `shared/schemas/domain.ts`
- `shared/schemas/mobileApi.ts`
- `shared/openapi/openapi.yaml`
- `docs/AI_HANDOFF.md`

Verification commands:

- `cd backend/stellive-hub-api && rtk npm test -- hubEventReadRoutes`
- `cd backend/stellive-hub-api && rtk npm test -- hubEventCalendar`
- `cd backend/stellive-hub-api && rtk npm run build`
- `cd backend/stellive-hub-api && rtk npm test`

## API Contract To Implement

### List

`GET /v1/hub-events`

Query:

```ts
interface HubEventListQuery {
  category?: "online_goods" | "online_collab" | "offline_concert" | "offline_collab" | "offline_popup" | "ticketing";
  participationMode?: "online" | "offline" | "hybrid";
  status?: "announced" | "upcoming" | "open" | "closing_soon" | "ended" | "cancelled";
  generationId?: string;
  memberId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: string | number;
}
```

Response:

```ts
interface HubEventListResponse {
  items: HubEvent[];
  nextCursor?: string;
}
```

### Detail

`GET /v1/hub-events/:id`

Response:

```ts
type HubEventDetailResponse = HubEvent;
type HubEventNotFoundResponse = { error: "hub_event_not_found" };
```

### Calendar

`GET /v1/hub-events/calendar`

Query:

```ts
interface HubEventCalendarQuery {
  from?: string;
  to?: string;
  timezone?: string;
}
```

Response:

```ts
interface HubCalendarResponse {
  timezone: string;
  from: string;
  to: string;
  days: HubCalendarDay[];
}

interface HubCalendarDay {
  date: string;
  entries: HubCalendarEntry[];
}
```

### Widget Snapshot

`GET /v1/hub-events/widget-snapshot`

Query:

```ts
interface HubEventWidgetSnapshotQuery {
  timezone?: string;
  limit?: string | number;
}
```

Response:

```ts
interface HubCalendarWidgetSnapshot {
  generatedAt: string;
  timezone: string;
  entries: HubCalendarEntry[];
  staleAfter: string;
}
```

## Route Helper Design

Create `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts` to own only public read-route parsing and registration.

```ts
import type { FastifyInstance, FastifyReply } from "fastify";
import { buildHubCalendarResponse, buildHubCalendarWidgetSnapshot } from "../hub-events/hubEventCalendar.js";
import type { HubEventReadPort } from "../hub-events/hubEventService.js";
import type { HubEventCategory, HubEventParticipationMode, HubEventStatus } from "../types.js";

const hubEventCategories = new Set<HubEventCategory>([
  "online_goods",
  "online_collab",
  "offline_concert",
  "offline_collab",
  "offline_popup",
  "ticketing",
]);

const participationModes = new Set<HubEventParticipationMode>(["online", "offline", "hybrid"]);
const hubEventStatuses = new Set<HubEventStatus>(["announced", "upcoming", "open", "closing_soon", "ended", "cancelled"]);

export interface RegisterHubEventReadRouteOptions {
  hubEvents: HubEventReadPort;
}
```

Validation behavior:

- Unknown enum query value returns `400` with `{ "error": "invalid_hub_event_query", "field": "<field>" }`.
- Invalid `from`, `to`, or `timezone` returns `400` with `{ "error": "invalid_hub_event_query", "field": "<field>" }`.
- `from > to` returns `400` with `{ "error": "invalid_hub_event_query", "field": "date_range" }`.
- Invalid `limit` falls back to endpoint default only if the current route contract already does that; otherwise return `400`.
- `GET /v1/hub-events/:id` unknown id returns `404` with `{ "error": "hub_event_not_found" }`.

## Implementation Tasks

### Phase 1: Route Contract Tests

- [ ] Create `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts` with imports:

```ts
import { describe, expect, it } from "vitest";
import buildApp from "../src/app.js";
import type { HubEvent, HubEventStatus } from "../src/types.js";
```

- [ ] Add local fixture helper in `hubEventReadRoutes.test.ts`:

```ts
function hubEvent(overrides: Partial<HubEvent> = {}): HubEvent {
  return {
    id: "official-goods-1",
    category: "online_goods",
    participationMode: "online",
    status: "open",
    title: "공식 굿즈 판매",
    summary: "이미지 없이 표시 가능한 공식 굿즈 판매",
    generationId: "official",
    memberId: "stellive-official",
    sourceUrl: "https://example.com/hub-events/official-goods-1",
    sourceLabel: "공식 공지",
    sourceType: "official",
    announcedAt: "2026-06-10T00:00:00.000Z",
    startsAt: "2026-06-12T00:00:00.000Z",
    endsAt: "2026-06-19T14:59:59.000Z",
    notificationEligible: true,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    ...overrides,
  };
}
```

- [ ] Add fake `HubEventReadPort` in `hubEventReadRoutes.test.ts`:

```ts
function createHubEvents(events: HubEvent[]) {
  return {
    async list(filters = {}) {
      const filtered = events.filter((event) => {
        if (filters.category && event.category !== filters.category) return false;
        if (filters.participationMode && event.participationMode !== filters.participationMode) return false;
        if (filters.status && event.status !== filters.status) return false;
        if (filters.generationId && event.generationId !== filters.generationId) return false;
        if (filters.memberId && event.memberId !== filters.memberId) return false;
        return true;
      });
      return { items: filtered.slice(0, filters.limit ?? 25), nextCursor: filtered.length > (filters.limit ?? 25) ? "cursor-1" : undefined };
    },
    async getById(id: string) {
      return events.find((event) => event.id === id);
    },
    async summary() {
      return { openCount: 1, upcomingCount: 0, closingSoonCount: 0, preview: events.slice(0, 3) };
    },
  };
}
```

- [ ] Write test: list returns `items` and `nextCursor` shape.

```ts
it("returns public HubEvent list DTOs", async () => {
  const app = await buildApp({
    env: { NODE_ENV: "test", ADMIN_CONSOLE_TOKEN: "test-admin-token" },
    useProcessEnv: false,
    dependencies: { hubEvents: createHubEvents([hubEvent(), hubEvent({ id: "official-goods-2" })]) },
  });
  const response = await app.inject({ method: "GET", url: "/v1/hub-events?limit=1" });
  await app.close();
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    items: [expect.objectContaining({ id: "official-goods-1", generationId: "official", sourceType: "official" })],
    nextCursor: expect.any(String),
  });
});
```

- [ ] Write test: list forwards `category`, `status`, `generationId`, and `memberId` filters.

```ts
it("filters HubEvents by category, status, generationId, and memberId", async () => {
  const app = await buildApp({
    env: { NODE_ENV: "test", ADMIN_CONSOLE_TOKEN: "test-admin-token" },
    useProcessEnv: false,
    dependencies: {
      hubEvents: createHubEvents([
        hubEvent({ id: "official-goods-1", category: "online_goods", status: "open", generationId: "official", memberId: "stellive-official" }),
        hubEvent({ id: "gen3-popup-1", category: "offline_popup", status: "upcoming", generationId: "gen3", memberId: "member-gen3" }),
      ]),
    },
  });
  const response = await app.inject({
    method: "GET",
    url: "/v1/hub-events?category=offline_popup&status=upcoming&generationId=gen3&memberId=member-gen3",
  });
  await app.close();
  expect(response.statusCode).toBe(200);
  expect(response.json().items).toEqual([expect.objectContaining({ id: "gen3-popup-1" })]);
});
```

- [ ] Write test: detail returns the same `HubEvent` DTO for known id.

```ts
it("returns HubEvent detail by id", async () => {
  const app = await buildApp({
    env: { NODE_ENV: "test", ADMIN_CONSOLE_TOKEN: "test-admin-token" },
    useProcessEnv: false,
    dependencies: { hubEvents: createHubEvents([hubEvent({ id: "detail-event" })]) },
  });
  const response = await app.inject({ method: "GET", url: "/v1/hub-events/detail-event" });
  await app.close();
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ id: "detail-event", title: "공식 굿즈 판매" });
});
```

- [ ] Write test: detail returns `404` for unknown id.

```ts
it("returns 404 for unknown HubEvent detail ids", async () => {
  const app = await buildApp({
    env: { NODE_ENV: "test", ADMIN_CONSOLE_TOKEN: "test-admin-token" },
    useProcessEnv: false,
    dependencies: { hubEvents: createHubEvents([]) },
  });
  const response = await app.inject({ method: "GET", url: "/v1/hub-events/missing-event" });
  await app.close();
  expect(response.statusCode).toBe(404);
  expect(response.json()).toEqual({ error: "hub_event_not_found" });
});
```

- [ ] Write test: invalid enum query returns `400`.

```ts
it("rejects invalid HubEvent enum filters", async () => {
  const app = await buildApp({
    env: { NODE_ENV: "test", ADMIN_CONSOLE_TOKEN: "test-admin-token" },
    useProcessEnv: false,
    dependencies: { hubEvents: createHubEvents([hubEvent()]) },
  });
  const response = await app.inject({ method: "GET", url: "/v1/hub-events?category=livestream" });
  await app.close();
  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ error: "invalid_hub_event_query", field: "category" });
});
```

- [ ] Write test: invalid date range returns `400`.

```ts
it("rejects invalid HubEvent date ranges", async () => {
  const app = await buildApp({
    env: { NODE_ENV: "test", ADMIN_CONSOLE_TOKEN: "test-admin-token" },
    useProcessEnv: false,
    dependencies: { hubEvents: createHubEvents([hubEvent()]) },
  });
  const response = await app.inject({
    method: "GET",
    url: "/v1/hub-events?from=2026-06-20T00:00:00.000Z&to=2026-06-01T00:00:00.000Z",
  });
  await app.close();
  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({ error: "invalid_hub_event_query", field: "date_range" });
});
```

- [ ] Write test: calendar returns days grouped by timezone and includes deep link fields.

```ts
it("returns calendar entries grouped for the requested timezone", async () => {
  const app = await buildApp({
    env: { NODE_ENV: "test", ADMIN_CONSOLE_TOKEN: "test-admin-token" },
    useProcessEnv: false,
    dependencies: { hubEvents: createHubEvents([hubEvent({ id: "calendar-event" })]) },
  });
  const response = await app.inject({
    method: "GET",
    url: "/v1/hub-events/calendar?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&timezone=Asia/Seoul",
  });
  await app.close();
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    timezone: "Asia/Seoul",
    from: "2026-06-01",
    to: "2026-07-01",
    days: expect.arrayContaining([
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({
            eventId: "calendar-event",
            appDeepLink: "stellivehub://hub-events/calendar-event",
            platformUrl: "https://example.com/hub-events/official-goods-1",
          }),
        ]),
      }),
    ]),
  });
});
```

- [ ] Write test: widget snapshot returns compact fields and respects `limit`.

```ts
it("returns widget snapshot entries with freshness metadata", async () => {
  const app = await buildApp({
    env: { NODE_ENV: "test", ADMIN_CONSOLE_TOKEN: "test-admin-token" },
    useProcessEnv: false,
    dependencies: {
      hubEvents: createHubEvents([
        hubEvent({ id: "widget-1" }),
        hubEvent({ id: "widget-2", startsAt: "2026-06-13T00:00:00.000Z" }),
      ]),
    },
  });
  const response = await app.inject({ method: "GET", url: "/v1/hub-events/widget-snapshot?timezone=Asia/Seoul&limit=1" });
  await app.close();
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    generatedAt: expect.any(String),
    timezone: "Asia/Seoul",
    entries: [expect.objectContaining({ eventId: expect.any(String), appDeepLink: expect.stringContaining("stellivehub://hub-events/") })],
    staleAfter: expect.any(String),
  });
  expect(response.json().entries).toHaveLength(1);
});
```

- [ ] Run route test to verify it fails before implementation:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventReadRoutes
```

Expected: FAIL because `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts` is new and route validation/extraction is not yet implemented.

### Phase 2: Extract Public HubEvent Read Routes

- [ ] Create `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts`.

- [ ] Move the current public HubEvent route registration from `backend/stellive-hub-api/src/routes/routes.ts` into `registerHubEventReadRoutes`.

```ts
export default function registerHubEventReadRoutes(
  app: FastifyInstance,
  options: RegisterHubEventReadRouteOptions,
): void {
  const { hubEvents } = options;
  app.get("/v1/hub-events/summary", async () => hubEvents.summary());
  app.get("/v1/hub-events", async (request, reply) => {
    const query = parseHubEventListQuery(request.query, reply);
    if (!query.ok) return query.response;
    return hubEvents.list(query.value, new Date());
  });
  app.get("/v1/hub-events/calendar", async (request, reply) => {
    const query = parseHubCalendarQuery(request.query, reply);
    if (!query.ok) return query.response;
    const list = await hubEvents.list({}, query.value.now);
    return buildHubCalendarResponse(list.items, query.value);
  });
  app.get("/v1/hub-events/widget-snapshot", async (request, reply) => {
    const query = parseHubWidgetSnapshotQuery(request.query, reply);
    if (!query.ok) return query.response;
    const list = await hubEvents.list({}, query.value.now);
    return buildHubCalendarWidgetSnapshot(list.items, query.value);
  });
  app.get("/v1/hub-events/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await hubEvents.getById(id);
    if (!event) return reply.code(404).send({ error: "hub_event_not_found" });
    return event;
  });
}
```

- [ ] Add helper result type:

```ts
type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: FastifyReply };
```

- [ ] Add `invalidQuery` helper:

```ts
function invalidQuery(reply: FastifyReply, field: string): ParseResult<never> {
  return {
    ok: false,
    response: reply.code(400).send({ error: "invalid_hub_event_query", field }),
  };
}
```

- [ ] Add `firstQueryValue` helper so repeated query parameters are deterministic:

```ts
function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}
```

- [ ] Add `parseDateQuery` helper:

```ts
function parseDateQuery(value: unknown, field: string, reply: FastifyReply): ParseResult<Date | undefined> {
  const raw = firstQueryValue(value);
  if (!raw) return { ok: true, value: undefined };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return invalidQuery(reply, field);
  return { ok: true, value: parsed };
}
```

- [ ] Add `parseLimitQuery` helper:

```ts
function parseLimitQuery(value: unknown, defaultLimit: number, maxLimit: number, reply: FastifyReply): ParseResult<number> {
  const raw = firstQueryValue(value);
  if (!raw) return { ok: true, value: defaultLimit };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return invalidQuery(reply, "limit");
  return { ok: true, value: Math.min(Math.trunc(parsed), maxLimit) };
}
```

- [ ] Add `parseTimezoneQuery` helper using the existing timezone support check from `routes.ts`; move `isSupportedTimezone` import or helper into `hubEventReadRoutes.ts`.

```ts
function parseTimezoneQuery(value: unknown, reply: FastifyReply): ParseResult<string> {
  const timezone = firstQueryValue(value) ?? "Asia/Seoul";
  if (!isSupportedTimezone(timezone)) return invalidQuery(reply, "timezone");
  return { ok: true, value: timezone };
}
```

- [ ] Add `parseHubEventListQuery`.

```ts
function parseHubEventListQuery(query: unknown, reply: FastifyReply): ParseResult<HubEventFilters> {
  const input = query as Record<string, unknown>;
  const category = firstQueryValue(input.category);
  if (category && !hubEventCategories.has(category as HubEventCategory)) return invalidQuery(reply, "category");
  const participationMode = firstQueryValue(input.participationMode);
  if (participationMode && !participationModes.has(participationMode as HubEventParticipationMode)) return invalidQuery(reply, "participationMode");
  const status = firstQueryValue(input.status);
  if (status && !hubEventStatuses.has(status as HubEventStatus)) return invalidQuery(reply, "status");
  const from = parseDateQuery(input.from, "from", reply);
  if (!from.ok) return from;
  const to = parseDateQuery(input.to, "to", reply);
  if (!to.ok) return to;
  if (from.value && to.value && from.value.getTime() > to.value.getTime()) return invalidQuery(reply, "date_range");
  const limit = parseLimitQuery(input.limit, 25, 100, reply);
  if (!limit.ok) return limit;
  return {
    ok: true,
    value: {
      category: category as HubEventCategory | undefined,
      participationMode: participationMode as HubEventParticipationMode | undefined,
      status: status as HubEventStatus | undefined,
      generationId: firstQueryValue(input.generationId),
      memberId: firstQueryValue(input.memberId),
      from: from.value,
      to: to.value,
      cursor: firstQueryValue(input.cursor),
      limit: limit.value,
    },
  };
}
```

- [ ] Add `parseHubCalendarQuery` with default month window matching current behavior.

- [ ] Add `parseHubWidgetSnapshotQuery` with `limit` default 5 and max 10.

- [ ] Modify `backend/stellive-hub-api/src/routes/routes.ts`:
  - Import `registerHubEventReadRoutes`.
  - Remove inline public HubEvent route handlers.
  - Call `registerHubEventReadRoutes(app, { hubEvents })` after `hubEvents` dependency is initialized.

- [ ] Run focused route test:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventReadRoutes
```

Expected: PASS.

### Phase 3: Service And Calendar Contract Tightening

- [ ] Add tests to `backend/stellive-hub-api/test/hubEventCalendar.test.ts` proving entries contain `eventId`, `appDeepLink`, `platformUrl`, `displayDate`, and `displayTimeText`.

```ts
it("keeps calendar entries sufficient for mobile deep links", () => {
  const response = buildHubCalendarResponse([hubEvent({ id: "deep-link-event" })], {
    from: new Date("2026-06-01T00:00:00.000Z"),
    to: new Date("2026-06-30T23:59:59.999Z"),
    timezone: "Asia/Seoul",
    now: new Date("2026-06-10T00:00:00.000Z"),
  });
  const entry = response.days.flatMap((day) => day.entries).find((item) => item.eventId === "deep-link-event");
  expect(entry).toMatchObject({
    eventId: "deep-link-event",
    appDeepLink: "stellivehub://hub-events/deep-link-event",
    platformUrl: "https://example.com/events/goods",
    displayDate: expect.any(String),
    displayTimeText: expect.any(String),
  });
});
```

- [ ] Run calendar test to verify current behavior:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventCalendar
```

Expected: PASS if current implementation already matches; otherwise FAIL showing the missing field.

- [ ] If the calendar test fails, modify `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts` `HubCalendarEntry` and `toEntry` so all required fields exist.

- [ ] Add tests to `backend/stellive-hub-api/test/hubEventCalendar.test.ts` proving widget snapshot prioritizes actionable entries and respects limit.

- [ ] If widget snapshot test fails, modify `buildHubCalendarWidgetSnapshot` to:
  - filter ended/cancelled entries after computing entry status,
  - fall back to all entries only when actionable entries are fewer than requested limit,
  - clamp `limit` to at least 1.

- [ ] Run focused calendar tests:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventCalendar
```

Expected: PASS.

### Phase 4: Shared DTO Alignment

- [ ] Modify `shared/schemas/domain.ts` to export calendar DTOs if they are still backend-local.

```ts
export interface HubCalendarEntry {
  id: string;
  eventId: string;
  title: string;
  category: HubEventCategory;
  status: HubEventStatus;
  participationMode: HubEventParticipationMode;
  generationId: string;
  memberId?: string;
  startsAt?: string;
  endsAt?: string;
  displayDate: string;
  displayTimeText: string;
  appDeepLink: string;
  platformUrl: string;
}

export interface HubCalendarDay {
  date: string;
  entries: HubCalendarEntry[];
}

export interface HubCalendarResponse {
  timezone: string;
  from: string;
  to: string;
  days: HubCalendarDay[];
}

export interface HubCalendarWidgetSnapshot {
  generatedAt: string;
  timezone: string;
  entries: HubCalendarEntry[];
  staleAfter: string;
}
```

- [ ] Modify `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts` to import these shared types instead of owning duplicate interfaces.

- [ ] Modify `shared/schemas/mobileApi.ts` import list to use the shared `HubCalendarWidgetSnapshot` type from `domain.ts`.

- [ ] Run TypeScript build:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Expected: PASS.

### Phase 5: OpenAPI Completion

- [ ] Modify `shared/openapi/openapi.yaml` path `/v1/hub-events`:
  - document `category`, `participationMode`, `status`, `generationId`, `memberId`, `from`, `to`, `cursor`, `limit`,
  - set `200` response schema to `HubEventListResponse`,
  - add `400` response for invalid query.

- [ ] Modify `shared/openapi/openapi.yaml` path `/v1/hub-events/{id}`:
  - document `id` path parameter,
  - set `200` response schema to `HubEvent`,
  - set `404` response example `{ "error": "hub_event_not_found" }`.

- [ ] Modify `shared/openapi/openapi.yaml` path `/v1/hub-events/calendar`:
  - document `from`, `to`, `timezone`,
  - set `200` response schema to `HubCalendarResponse`,
  - add `400` response for invalid query/date range/timezone.

- [ ] Modify `shared/openapi/openapi.yaml` path `/v1/hub-events/widget-snapshot`:
  - document `timezone` and `limit`,
  - set `200` response schema to `HubCalendarWidgetSnapshot`,
  - add `400` response for invalid query.

- [ ] Add or complete OpenAPI component schemas:

```yaml
HubEventListResponse:
  type: object
  required: [items]
  properties:
    items:
      type: array
      items:
        $ref: "#/components/schemas/HubEvent"
    nextCursor:
      type: string

HubEventQueryError:
  type: object
  required: [error, field]
  properties:
    error:
      type: string
      enum: [invalid_hub_event_query]
    field:
      type: string
```

- [ ] Ensure `HubEvent`, `HubCalendarEntry`, `HubCalendarDay`, `HubCalendarResponse`, and `HubCalendarWidgetSnapshot` schemas contain the exact fields listed in `docs/HUB_EVENTS_READ_API_DESIGN.md`.

- [ ] Run backend build after OpenAPI edits:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Expected: PASS.

### Phase 6: Mobile Boundary Checks

- [ ] Inspect Android DTOs under `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub` for HubEvent calendar/widget models.

```bash
rtk grep "HubCalendar\\|HubEvent" android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub
```

- [ ] If Android has explicit models, update them to include:
  - `HubEventListResponse.items`
  - `HubEventListResponse.nextCursor`
  - `HubCalendarEntry.eventId`
  - `HubCalendarEntry.displayTimeText`
  - `HubCalendarEntry.appDeepLink`
  - `HubCalendarEntry.platformUrl`
  - nullable image fields remain absent or optional.

- [ ] Inspect iOS DTOs under `ios/StelliveHubiOS/StelliveHubiOS`.

```bash
rtk grep "HubCalendar\\|HubEvent" ios/StelliveHubiOS/StelliveHubiOS
```

- [ ] If iOS has explicit models, update them to include the same fields as Android.

- [ ] Do not add image asset references, logos, screenshots, or CDN-copied media to either mobile app.

### Phase 7: Policy Regression Tests

- [ ] Add route-level test proving unsupported event-like content is not synthesized as HubEvents.

```ts
it("does not synthesize livestream, upload, ordinary post, or fan-hosted events in HubEvent reads", async () => {
  const app = await buildApp({
    env: { NODE_ENV: "test", ADMIN_CONSOLE_TOKEN: "test-admin-token" },
    useProcessEnv: false,
    dependencies: { hubEvents: createHubEvents([hubEvent({ id: "official-goods-1" })]) },
  });
  const response = await app.inject({ method: "GET", url: "/v1/hub-events" });
  await app.close();
  const ids = response.json().items.map((event: HubEvent) => event.id).join(" ");
  expect(ids).not.toContain("livestream");
  expect(ids).not.toContain("upload");
  expect(ids).not.toContain("fan-hosted");
});
```

- [ ] Add fixture-level assertion that every returned fixture uses allowed `generationId`.

```ts
const allowedGenerationIds = new Set(["gen1", "gen2", "gen3", "gamja", "official", "gen4-upcoming"]);
expect(response.json().items.every((event: HubEvent) => allowedGenerationIds.has(event.generationId))).toBe(true);
```

- [ ] Add missing-image assertion:

```ts
expect(response.json().items[0]).not.toHaveProperty("imageUrl");
expect(response.json().items[0]).toMatchObject({ title: expect.any(String), sourceUrl: expect.any(String) });
```

- [ ] Run focused route tests:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventReadRoutes
```

Expected: PASS.

### Phase 8: Docs And Handoff

- [ ] Update `docs/AI_HANDOFF.md` with:
  - public HubEvent read API contract is route-tested,
  - shared calendar/widget DTOs are the contract source,
  - OpenAPI paths are complete,
  - mobile clients should keep placeholder rendering for missing images.

- [ ] Add a short implementation note to `docs/HUB_EVENTS_READ_API_DESIGN.md` only if actual code behavior differs from the current design.

- [ ] Run docs diff review:

```bash
rtk git diff -- docs/HUB_EVENTS_READ_API_DESIGN.md docs/AI_HANDOFF.md docs/superpowers/plans/2026-06-12-hub-events-read-api-code-plan.md shared/openapi/openapi.yaml
```

Expected: Diff only contains the intended design/contract updates.

### Phase 9: Final Verification

- [ ] Run focused backend tests:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventReadRoutes
rtk npm test -- hubEventCalendar
```

Expected: PASS.

- [ ] Run backend build:

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

Expected: PASS.

- [ ] Confirm git diff contains no forbidden assets or secrets:

```bash
rtk git diff --stat
rtk git diff --name-only
rtk grep "NID_AUT\\|NID_SES\\|FCM_PRIVATE_KEY\\|CHZZK_CLIENT_SECRET\\|X_BEARER_TOKEN" .
```

Expected:
- Only source, tests, OpenAPI, and docs changed.
- No real secrets.
- No image binaries, logos, screenshots, fan art, or copied media assets.

## Commit Plan

- [ ] Commit 1: route tests and route extraction.

```bash
rtk git add backend/stellive-hub-api/test/hubEventReadRoutes.test.ts backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts backend/stellive-hub-api/src/routes/routes.ts
rtk git commit -m "test: lock hub event read API routes"
```

- [ ] Commit 2: shared DTO and OpenAPI contract updates.

```bash
rtk git add shared/schemas/domain.ts shared/schemas/mobileApi.ts shared/openapi/openapi.yaml backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts backend/stellive-hub-api/test/hubEventCalendar.test.ts
rtk git commit -m "feat: align hub event read API contracts"
```

- [ ] Commit 3: docs and handoff.

```bash
rtk git add docs/HUB_EVENTS_READ_API_DESIGN.md docs/AI_HANDOFF.md docs/superpowers/plans/2026-06-12-hub-events-read-api-code-plan.md
rtk git commit -m "docs: add hub event read API implementation plan"
```

## Stop Conditions

- Stop and ask for direction if existing mobile DTOs intentionally diverge from OpenAPI.
- Stop and ask for direction if Prisma-backed HubEvent reads must be implemented as part of this issue rather than contract-locking the existing read boundary.
- Stop and ask for direction if route validation behavior conflicts with existing mobile client expectations.
