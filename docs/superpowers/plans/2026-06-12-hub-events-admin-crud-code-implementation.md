# Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement server-stored admin CRUD for `굿즈/행사` `HubEvent` schedules, including validation, publication state, audit logs, admin console controls, and notification job candidates.

**Architecture:** Keep the existing public `HubEvent` contract and policy rules, then add an admin write boundary around Prisma storage. Public mobile routes read only published, non-deleted `HubEvent` records through a read port; tests can still inject the current in-memory service while production can use Prisma-backed storage. Admin routes and console use existing `/admin` authentication and no-CORS privileged route policy, and notification candidates flow through the existing `PlatformEvent`/`NotificationJob` path instead of sending pushes directly.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Vitest, existing HTML admin console, shared OpenAPI YAML.

## Current Code Feasibility Analysis

The feature is implementable with the current codebase. The useful existing foundations are:

- `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts` already validates core `HubEvent` policy constraints and can be strengthened for admin writes.
- `backend/stellive-hub-api/src/hub-events/hubEventService.ts` already computes effective status, sorting, filtering, summary, and `PlatformEvent` conversion for `HubEvent`.
- `backend/stellive-hub-api/prisma/schema.prisma` already has a `HubEvent` model with public fields.
- `backend/stellive-hub-api/src/admin/adminAuth.ts` and `src/routes/adminRoutes.ts` already provide admin token/session behavior, no-store headers, and restricted `/admin` HTML serving.
- `backend/stellive-hub-api/src/routes/internalRoutes.ts` already protects `/v1/internal/*` with bearer authentication and no public CORS.
- `backend/stellive-hub-api/src/jobs/notificationJobRepository.ts` already provides queue diagnostic/enqueue behavior for database-backed jobs.
- `shared/openapi/openapi.yaml` already documents public `/v1/hub-events*` routes and admin overview schemas.

The main implementation gaps are:

- `HubEvent` lacks `publicationState`, `publishedAt`, `cancelledAt`, `deactivatedAt`, `deletedAt`, `revision`, `createdBy`, and `updatedBy`.
- There is no `HubEventAuditLog` table.
- Public hub event routes still use a process-wide in-memory `HubEventService` singleton.
- There is no `HubEventRepository` or admin write service.
- There are no `/v1/admin/hub-events*` CRUD routes.
- `/v1/admin/*` is not yet included in the privileged CORS path matcher.
- The admin console does not expose hub event list, form, validation, action, or audit views.
- OpenAPI has no admin hub event request/response schemas.
- Notification candidates from admin publish/update/cancel are not persisted through a platform event repository.

Fresh verification before writing this plan:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEvents.test.ts adminAuth.test.ts repositories.test.ts
```

Result observed on 2026-06-12: exit 0.

## Task 1: Add Admin Storage Fields And Audit Model

**Files:**

- Modify: `backend/stellive-hub-api/prisma/schema.prisma`
- Modify: `backend/stellive-hub-api/test/repositories.test.ts`

- [ ] **Step 1: Extend the Prisma `HubEvent` model**

Add these fields to `model HubEvent`:

```prisma
publicationState String   @default("draft")
publishedAt      DateTime?
cancelledAt      DateTime?
deactivatedAt    DateTime?
deletedAt        DateTime?
revision         Int      @default(1)
createdBy        String?
updatedBy        String?

@@index([publicationState, deletedAt])
```

Keep the existing public field indexes.

- [ ] **Step 2: Add `HubEventAuditLog` to Prisma**

Add:

```prisma
model HubEventAuditLog {
  id         String   @id @default(cuid(2))
  hubEventId String
  action     String
  actorId    String?
  reason     String?
  before     Json?
  after      Json?
  createdAt  DateTime @default(now())

  @@index([hubEventId, createdAt])
  @@index([action, createdAt])
}
```

- [ ] **Step 3: Generate Prisma client**

Run:

```bash
cd backend/stellive-hub-api
rtk npm run prisma:generate
```

Expected: PASS and generated client includes `hubEvent` and `hubEventAuditLog`.

- [ ] **Step 4: Add repository test assertions for audit log delegate compatibility**

In `backend/stellive-hub-api/test/repositories.test.ts`, add a small fake Prisma delegate test that verifies the future repository will call `hubEventAuditLog.create` with `hubEventId`, `action`, `actorId`, `reason`, `before`, and `after`.

- [ ] **Step 5: Run repository tests**

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- repositories.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add backend/stellive-hub-api/prisma/schema.prisma backend/stellive-hub-api/test/repositories.test.ts
rtk git commit -m "feat: add hub event admin storage fields"
```

## Task 2: Add Admin Hub Event Types And Validation

**Files:**

- Create: `backend/stellive-hub-api/src/hub-events/hubEventAdminTypes.ts`
- Modify: `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`
- Modify: `backend/stellive-hub-api/test/hubEvents.test.ts`

- [ ] **Step 1: Add admin publication types**

Create `hubEventAdminTypes.ts`:

```ts
import type { HubEvent } from "../types.js";

export type HubEventPublicationState = "draft" | "published" | "inactive" | "deleted";

export type HubEventAdminAction =
  | "create"
  | "update"
  | "publish"
  | "cancel"
  | "deactivate"
  | "delete";

export interface AdminHubEvent extends HubEvent {
  publicationState: HubEventPublicationState;
  publishedAt?: string;
  cancelledAt?: string;
  deactivatedAt?: string;
  deletedAt?: string;
  revision: number;
  createdBy?: string;
  updatedBy?: string;
}

export type HubEventValidationReason =
  | "source_required"
  | "source_type_not_allowed"
  | "unsupported_category"
  | "unsupported_status"
  | "asset_fields_not_allowed"
  | "gangzi_representative_excluded"
  | "gamja_scope_excluded"
  | "member_not_allowed"
  | "date_window_required"
  | "date_window_invalid"
  | "url_not_https"
  | "official_youtube_live_excluded"
  | "routine_platform_activity_excluded";

export interface HubEventValidationError {
  field: string;
  reason: HubEventValidationReason;
  message: string;
}
```

- [ ] **Step 2: Add failing validation tests**

Append tests to `backend/stellive-hub-api/test/hubEvents.test.ts` for:

- `generationId: "gamja"` rejected.
- `memberId: "gangzi"` rejected.
- `imageUrl`, `logoUrl`, `posterUrl`, and `thumbnailUrl` rejected when present on the request object.
- `startsAt > endsAt` rejected.
- missing all of `announcedAt`, `startsAt`, and `endsAt` rejected on publish validation.
- non-HTTPS `sourceUrl`, `purchaseUrl`, or `ticketUrl` rejected outside the existing test fixture path.
- official YouTube live URL or live event type metadata rejected.

- [ ] **Step 3: Strengthen `validateHubEvent`**

Update `hubEventPolicy.ts` so it can return either the current single reason or a structured list of `HubEventValidationError`. Preserve existing callers by exporting:

```ts
export function validateHubEvent(event: HubEvent, catalog: CatalogService): HubEventValidationResult
export function validateHubEventForAdmin(input: unknown, catalog: CatalogService, mode: "draft" | "publish"): HubEventAdminValidationResult
```

Draft validation allows missing date windows but still rejects forbidden catalog scope, source type, unsupported category/status, forbidden asset fields, and official YouTube live. Publish validation requires at least one date field.

- [ ] **Step 4: Run hub event tests**

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEvents.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add backend/stellive-hub-api/src/hub-events/hubEventAdminTypes.ts backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts backend/stellive-hub-api/test/hubEvents.test.ts
rtk git commit -m "feat: validate admin hub event writes"
```

## Task 3: Add Prisma Hub Event Repository

**Files:**

- Create: `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`
- Modify: `backend/stellive-hub-api/test/repositories.test.ts`

- [ ] **Step 1: Write failing repository tests**

Add tests with fake Prisma delegates proving:

- `listPublished` adds `publicationState: "published"` and `deletedAt: null`.
- `getPublishedById` adds `publicationState: "published"` and `deletedAt: null`.
- `listAdmin` respects `publicationState`, `includeDeleted`, `limit`, and cursor arguments.
- `createDraft` writes `publicationState: "draft"` and `revision: 1`.
- `update` increments `revision`.
- `writeAuditLog` creates append-only audit records.

- [ ] **Step 2: Implement repository mapping**

Create `HubEventRepository` with:

```ts
listPublished(filters: HubEventFilters, now: Date): Promise<HubEventListResult>
getPublishedById(id: string): Promise<HubEvent | undefined>
listAdmin(filters: AdminHubEventFilters): Promise<AdminHubEventListResult>
getAdminById(id: string): Promise<AdminHubEvent | undefined>
createDraft(input: AdminHubEventWriteInput): Promise<AdminHubEvent>
update(id: string, input: AdminHubEventWriteInput): Promise<AdminHubEvent>
setPublicationState(input: SetHubEventPublicationStateInput): Promise<AdminHubEvent>
softDelete(input: SoftDeleteHubEventInput): Promise<AdminHubEvent>
writeAuditLog(input: HubEventAuditLogInput): Promise<void>
listAuditLog(hubEventId: string, limit: number): Promise<HubEventAuditLogEntry[]>
```

Convert Prisma `Date` values to ISO strings at repository boundaries. Do not return admin-only fields from `listPublished` or `getPublishedById`.

- [ ] **Step 3: Run repository tests**

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- repositories.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add backend/stellive-hub-api/src/hub-events/hubEventRepository.ts backend/stellive-hub-api/test/repositories.test.ts
rtk git commit -m "feat: add hub event repository"
```

## Task 4: Add Admin Hub Event Service

**Files:**

- Create: `backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts`
- Create: `backend/stellive-hub-api/test/hubEventAdminService.test.ts`

- [ ] **Step 1: Write service tests**

Create tests proving:

- `createDraft` validates and writes audit action `create`.
- `update` rejects edits to deleted events, increments revision, and writes action `update`.
- `publish` rejects invalid publish input, sets `publicationState: "published"`, sets `publishedAt`, and writes action `publish`.
- `cancel` sets `status: "cancelled"`, sets `cancelledAt`, keeps `publicationState: "published"`, and writes action `cancel`.
- `deactivate` sets `publicationState: "inactive"` and writes action `deactivate`.
- `delete` soft deletes by setting `publicationState: "deleted"` and `deletedAt`.
- Returned responses never include raw provider payloads or secrets.

- [ ] **Step 2: Implement `HubEventAdminService`**

Constructor dependencies:

```ts
new HubEventAdminService({
  catalog,
  repository,
  now: () => new Date()
})
```

Methods:

```ts
createDraft(input, actor): Promise<AdminHubEvent>
update(id, input, actor): Promise<AdminHubEvent>
publish(id, actor): Promise<AdminHubEvent>
cancel(id, actor): Promise<AdminHubEvent>
deactivate(id, actor): Promise<AdminHubEvent>
delete(id, actor): Promise<AdminHubEvent>
validate(input, mode): HubEventAdminValidationResult
list(filters): Promise<AdminHubEventListResult>
getById(id): Promise<AdminHubEvent | undefined>
listAuditLog(id, limit): Promise<HubEventAuditLogEntry[]>
```

The service owns revision and audit log decisions. The repository owns Prisma shapes only.

- [ ] **Step 3: Run service tests**

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventAdminService.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts backend/stellive-hub-api/test/hubEventAdminService.test.ts
rtk git commit -m "feat: add hub event admin service"
```

## Task 5: Add Admin CRUD Routes

**Files:**

- Create: `backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts`
- Modify: `backend/stellive-hub-api/src/app.ts`
- Create: `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`

- [ ] **Step 1: Add failing route tests**

Test:

- `GET /v1/admin/hub-events` without admin auth returns 401.
- valid admin session cookie can list events.
- valid `Authorization: Bearer <ADMIN_CONSOLE_TOKEN>` can list events.
- internal API token is rejected when it differs from admin token.
- public CORS headers are absent for `/v1/admin/hub-events`.
- create/update/publish/cancel/deactivate/delete call service methods.
- validation errors return 400 with `errors[]`.
- missing event returns 404.

- [ ] **Step 2: Update privileged route detection**

In `backend/stellive-hub-api/src/app.ts`, update `isPrivilegedRoutePath` so it treats `/v1/admin/` as privileged:

```ts
return (
  url === "/admin" ||
  url.startsWith("/admin?") ||
  url.startsWith("/admin/") ||
  url.startsWith("/v1/admin/") ||
  url.startsWith("/v1/internal/")
);
```

- [ ] **Step 3: Implement `registerAdminHubEventRoutes`**

Create routes:

```text
GET    /v1/admin/hub-events
POST   /v1/admin/hub-events
GET    /v1/admin/hub-events/:id
PUT    /v1/admin/hub-events/:id
POST   /v1/admin/hub-events/:id/publish
POST   /v1/admin/hub-events/:id/cancel
POST   /v1/admin/hub-events/:id/deactivate
DELETE /v1/admin/hub-events/:id
GET    /v1/admin/hub-events/:id/audit-log
POST   /v1/admin/hub-events/validate
```

Use a route-level `preHandler` that accepts either the signed admin session cookie or bearer `ADMIN_CONSOLE_TOKEN`. Return no-store headers for mutation responses.

- [ ] **Step 4: Register the routes**

In `app.ts`, import and register `registerAdminHubEventRoutes` after `registerAdminRoutes` and before public app routes. Add build option dependency injection for tests:

```ts
adminHubEventRoutes?: {
  dependencies?: Partial<AdminHubEventRouteDependencies>;
};
```

- [ ] **Step 5: Run admin route tests**

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- adminHubEventRoutes.test.ts adminInternalRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts backend/stellive-hub-api/src/app.ts backend/stellive-hub-api/test/adminHubEventRoutes.test.ts
rtk git commit -m "feat: add admin hub event routes"
```

## Task 6: Switch Public Hub Event Reads To A Read Port

**Files:**

- Modify: `backend/stellive-hub-api/src/hub-events/hubEventService.ts`
- Modify: `backend/stellive-hub-api/src/routes/routes.ts`
- Modify: `backend/stellive-hub-api/test/hubEvents.test.ts`
- Modify: `backend/stellive-hub-api/test/hubEventCalendarRoutes.test.ts`

- [ ] **Step 1: Define a public read interface**

Add an exported interface:

```ts
export interface HubEventReadPort {
  list(filters?: HubEventFilters, now?: Date): Promise<HubEventListResult> | HubEventListResult;
  getById(id: string): Promise<HubEvent | undefined> | HubEvent | undefined;
  summary(now?: Date): Promise<HubEventsSummary> | HubEventsSummary;
}
```

Make existing `HubEventService` implement this interface without changing its in-memory behavior.

- [ ] **Step 2: Update public routes to await read port calls**

In `routes.ts`, replace direct singleton calls with dependency-injected `hubEvents`:

```ts
const hubEvents = options.dependencies?.hubEvents ?? new HubEventService(catalog);
```

Then `await hubEvents.list(...)`, `await hubEvents.getById(...)`, and `await hubEvents.summary(...)`.

- [ ] **Step 3: Add tests for dependency injection**

Add tests proving `/v1/hub-events`, `/v1/hub-events/:id`, `/v1/hub-events/calendar`, and `/v1/hub-events/widget-snapshot` use the injected read port and still hide missing events with 404.

- [ ] **Step 4: Run public hub event route tests**

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEvents.test.ts hubEventCalendarRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add backend/stellive-hub-api/src/hub-events/hubEventService.ts backend/stellive-hub-api/src/routes/routes.ts backend/stellive-hub-api/test/hubEvents.test.ts backend/stellive-hub-api/test/hubEventCalendarRoutes.test.ts
rtk git commit -m "refactor: inject hub event read service"
```

## Task 7: Add Prisma Public Read Adapter

**Files:**

- Modify: `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`
- Modify: `backend/stellive-hub-api/src/app.ts`
- Modify: `backend/stellive-hub-api/src/config/env.ts`
- Modify: `backend/stellive-hub-api/test/hubEvents.test.ts`

- [ ] **Step 1: Add storage mode env var**

In `config/env.ts`, add:

```ts
HUB_EVENTS_STORAGE_MODE: z.enum(["memory", "prisma"]).default("memory")
```

Defaulting to `memory` preserves the current test/dev behavior. Production deploys can set `HUB_EVENTS_STORAGE_MODE=prisma` once the database migration is applied.

- [ ] **Step 2: Make repository implement `HubEventReadPort`**

Implement `list`, `getById`, and `summary` on `HubEventRepository` by delegating to `listPublished` and `getPublishedById`. Reuse `HubEventService` static helpers or shared functions for `effectiveStatus` and summary computation so DB-backed reads match existing in-memory ordering.

- [ ] **Step 3: Wire storage mode in `app.ts`**

If `HUB_EVENTS_STORAGE_MODE === "prisma"`, pass a `HubEventRepository` into public routes and admin service defaults. If mode is `memory`, keep the current in-memory seed service.

- [ ] **Step 4: Add tests**

Use fake dependencies to prove:

- memory mode keeps current public seed behavior.
- prisma mode passes a repository-backed read port into public routes.

- [ ] **Step 5: Run tests**

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEvents.test.ts adminAuth.test.ts
rtk npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add backend/stellive-hub-api/src/hub-events/hubEventRepository.ts backend/stellive-hub-api/src/app.ts backend/stellive-hub-api/src/config/env.ts backend/stellive-hub-api/test/hubEvents.test.ts
rtk git commit -m "feat: support prisma hub event reads"
```

## Task 8: Add Hub Event Notification Candidate Flow

**Files:**

- Create: `backend/stellive-hub-api/src/hub-events/hubEventNotificationFactory.ts`
- Create: `backend/stellive-hub-api/src/repositories/platformEventRepository.ts`
- Modify: `backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts`
- Create: `backend/stellive-hub-api/test/hubEventNotifications.test.ts`

- [ ] **Step 1: Write notification tests**

Test:

- draft creation creates no candidate.
- publish creates `event_announced` only when `notificationEligible = true`.
- publish with past `startsAt` creates a deduped `event_sales_open` candidate.
- cancel creates `event_cancelled`.
- material update creates `event_updated`.
- all candidates use `source = "hub_event"`, `deliveryMode = "standard"`, and `realtimeEligible = false`.
- `notificationEligible = false` suppresses candidates.

- [ ] **Step 2: Implement `hubEventNotificationFactory.ts`**

Export:

```ts
buildHubEventNotificationCandidates(input: {
  before?: AdminHubEvent;
  after: AdminHubEvent;
  action: HubEventAdminAction;
  now: Date;
}): PlatformEvent[]
```

Use dedupe keys:

```text
hub_event:<hubEventId>:event_announced:<revision>
hub_event:<hubEventId>:event_sales_open:<startsAt>
hub_event:<hubEventId>:event_deadline_soon:<endsAt>:24h
hub_event:<hubEventId>:event_cancelled:<cancelledAt>
hub_event:<hubEventId>:event_updated:<revision>
```

- [ ] **Step 3: Add `PlatformEventRepository`**

Implement `createIfNotExists(event: PlatformEvent): Promise<{ created: boolean }>` using Prisma `dedupeKey` uniqueness. Do not store raw provider payloads; for hub events, store only `metadata` such as `hubEventId`, `revision`, and `adminAction`.

- [ ] **Step 4: Enqueue notification jobs**

After a candidate platform event is created, call `NotificationJobRepository.enqueue` with a normal priority. Do not send push directly from admin service.

- [ ] **Step 5: Run notification tests**

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventNotifications.test.ts notificationLoadReduction.test.ts preferenceResolution.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add backend/stellive-hub-api/src/hub-events/hubEventNotificationFactory.ts backend/stellive-hub-api/src/repositories/platformEventRepository.ts backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts backend/stellive-hub-api/test/hubEventNotifications.test.ts
rtk git commit -m "feat: enqueue hub event notification candidates"
```

## Task 9: Add Admin Console UI

**Files:**

- Modify: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- Modify: `backend/stellive-hub-api/src/admin/adminTypes.ts`
- Modify: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- [ ] **Step 1: Add HTML smoke tests**

Extend admin console tests to assert the HTML contains:

```html
data-admin-section="hub-events"
data-hub-event-action="save-draft"
data-hub-event-action="publish"
data-hub-event-action="cancel"
data-hub-event-action="deactivate"
data-hub-event-action="delete"
```

Also assert it does not contain image upload inputs:

```html
type="file"
name="imageUrl"
name="logoUrl"
name="posterUrl"
```

- [ ] **Step 2: Add a hub event management section**

Add a console section with:

- list filters for publication state, public status, category, generation, member, and search query.
- form fields for title, summary, category, participation mode, status, generation, member, source URL, source label, source type, announced/start/end dates, purchase URL, ticket URL, venue name, venue address, and notification eligibility.
- validation panel rendering server returned `errors[]`.
- audit log panel for the selected event.

- [ ] **Step 3: Add console JavaScript**

Use `fetch` with same-origin credentials:

```js
fetch("/v1/admin/hub-events", { credentials: "same-origin" })
```

Call the admin API routes for save draft, validate, publish, cancel, deactivate, delete, and audit log. Do not put tokens in URLs.

- [ ] **Step 4: Run admin console tests**

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- adminInternalRoutes.test.ts adminAuth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add backend/stellive-hub-api/src/admin/adminConsoleHtml.ts backend/stellive-hub-api/src/admin/adminTypes.ts backend/stellive-hub-api/test/adminInternalRoutes.test.ts
rtk git commit -m "feat: add hub event admin console"
```

## Task 10: Update OpenAPI And Docs

**Files:**

- Modify: `shared/openapi/openapi.yaml`
- Modify: `docs/API_SETUP.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/AI_HANDOFF.md`
- Modify: `backend/stellive-hub-api/.env.example` if present

- [ ] **Step 1: Add OpenAPI admin paths**

Add:

```text
/v1/admin/hub-events
/v1/admin/hub-events/{id}
/v1/admin/hub-events/{id}/publish
/v1/admin/hub-events/{id}/cancel
/v1/admin/hub-events/{id}/deactivate
/v1/admin/hub-events/{id}/audit-log
/v1/admin/hub-events/validate
```

- [ ] **Step 2: Add OpenAPI schemas**

Add:

```text
AdminHubEventCreateRequest
AdminHubEventUpdateRequest
AdminHubEventResponse
AdminHubEventListResponse
AdminHubEventValidationError
HubEventAuditLogEntry
HubEventPublicationState
```

Do not add admin-only fields to public `HubEvent` responses.

- [ ] **Step 3: Document environment variable**

Document:

```env
HUB_EVENTS_STORAGE_MODE=memory
```

In production notes, state that `prisma` requires the schema migration to be applied before enabling it.

- [ ] **Step 4: Update architecture and handoff**

Document that admin CRUD writes normalized `HubEvent` rows, public APIs return published non-deleted rows, and admin actions enqueue notification candidates only through the existing preference-resolving worker path.

- [ ] **Step 5: Run docs and build checks**

Run:

```bash
cd backend/stellive-hub-api
rtk npm run build
rtk npm test -- hubEvents.test.ts adminHubEventRoutes.test.ts hubEventAdminService.test.ts hubEventNotifications.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add shared/openapi/openapi.yaml docs/API_SETUP.md docs/ARCHITECTURE.md docs/AI_HANDOFF.md backend/stellive-hub-api/.env.example
rtk git commit -m "docs: document hub event admin crud"
```

## Task 11: Full Verification

**Files:** No edits unless verification exposes a defect.

- [ ] **Step 1: Run backend build**

Run:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Expected: PASS.

- [ ] **Step 2: Run backend test suite**

Run:

```bash
cd backend/stellive-hub-api
rtk npm test
```

Expected: PASS.

- [ ] **Step 3: Run policy grep**

Run:

```bash
rtk grep "former|Former|gangzi|gamja|official_youtube_live|youtube_live|imageUrl|logoUrl|posterUrl|thumbnailUrl|fan-hosted|fan hosted" shared backend docs
```

Expected:

- Former references appear only in policy/docs/tests that assert exclusion.
- Gangzi/gamja hub event references appear only in rejection tests or policy text.
- Official YouTube live references remain exclusion paths.
- Image/logo/poster fields do not appear in public `HubEvent` schema or admin form inputs.

- [ ] **Step 4: Verify CORS and auth tests**

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- adminAuth.test.ts adminInternalRoutes.test.ts adminHubEventRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Verify migration/generation**

Run:

```bash
cd backend/stellive-hub-api
rtk npm run prisma:generate
```

Expected: PASS.

- [ ] **Step 6: Final git review**

Run:

```bash
rtk git status --short
rtk git diff --check
```

Expected: no whitespace errors. Only files listed in this plan should be changed by this implementation branch, except user-owned pre-existing changes that must remain untouched.

## Implementation Notes

- Keep `HUB_EVENTS_STORAGE_MODE=memory` as the default until migrations and integration tests are stable. This avoids breaking existing unit tests that rely on seed hub events.
- The production path for this feature is `HUB_EVENTS_STORAGE_MODE=prisma`.
- Do not make `/v1/admin/*` public CORS routes.
- Do not add image upload or copied media URL fields.
- Do not generate push directly from admin routes.
- Do not create official YouTube live scheduled/started/ended records.
- Do not include Former members in fixtures, filters, seed data, admin options, or tests except explicit rejection tests.
