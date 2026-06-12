Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Provide a code-level implementation design for HubEvent notification job draining, preference-gated FCM/APNs delivery, delivery attempts, and retry handling.

**Architecture:** Keep the existing admin-to-`PlatformEvent` and `NotificationJob` enqueue path intact. Add repository methods, a dependency-injected `NotificationWorker`, Firebase sender boundary, and minimal payload factory so internal schedulers can drain jobs without admin or mobile clients bypassing preference resolution.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Firebase Admin SDK, Vitest, Zod.

## Related Planning Documents

- Feature plan: `docs/superpowers/plans/2026-06-12-hub-event-notification-jobs.md`
- API implementation plan: `docs/API_IMPLEMENTATION_PLAN.md`
- Notification policy: `docs/NOTIFICATION_POLICY.md`
- Realtime delivery policy: `docs/REALTIME_DELIVERY.md`
- Project rules: `docs/PROJECT_RULES.md`
- Source issues:
  - GitHub #17: https://github.com/MinePacu/stellive-event-notifier/issues/17
  - GitLab work item #11: https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/11

## Implementation Boundaries

- Existing `HubEventAdminService` remains the only admin write path that creates HubEvent notification candidates.
- Existing `PreferenceResolutionService` remains the only authority for global, platform, event type, generation, member, quiet-hours, keyword, rate-limit, and `realtime_best_effort` decisions.
- Mobile apps never receive Firebase server credentials, never send direct provider pushes, and never resolve authoritative preferences.
- Admin routes never accept caller-supplied push payloads or target-device filters.
- `push/*` code accepts normalized `PlatformEvent` plus resolved policy outputs only.
- The worker records a delivery attempt for every device-level decision so diagnostics can explain both sends and skips.

## Status Before Implementation

Existing:

- `backend/stellive-hub-api/src/hub-events/hubEventNotificationFactory.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts`
- `backend/stellive-hub-api/src/jobs/notificationJobRepository.ts`
- `backend/stellive-hub-api/src/repositories/platformEventRepository.ts`
- `backend/stellive-hub-api/src/repositories/deviceRepository.ts`
- `backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts`
- `backend/stellive-hub-api/src/preferences/preferenceResolution.ts`
- `backend/stellive-hub-api/src/notification/loadReductionPolicy.ts`
- `backend/stellive-hub-api/src/routes/internalRoutes.ts`

Missing:

- Atomic job claim/complete/retry/fail methods.
- PlatformEvent lookup by job `eventId`.
- Active push-target device listing.
- Delivery attempt create method used by workers.
- FCM/APNs sender boundary.
- Minimal push payload factory.
- `NotificationWorker`.
- Internal drain route wiring to the worker.

## Domain Types

Use the exported shared types from `backend/stellive-hub-api/src/types.ts`.

HubEvent notification event types:

```ts
type HubEventNotificationType =
  | "event_announced"
  | "event_sales_open"
  | "event_deadline_soon"
  | "event_updated"
  | "event_cancelled";
```

Worker-specific DTOs should live in `backend/stellive-hub-api/src/jobs/notificationWorker.ts` unless they are reused by admin diagnostics.

```ts
export interface NotificationWorkerDrainInput {
  limit?: number;
  lockedBy?: string;
  now?: Date;
}

export interface NotificationWorkerDrainResult {
  claimed: number;
  completed: number;
  failed: number;
  skipped: number;
  sent: number;
  queued: number;
  status: "ok" | "disabled" | "partial";
  reason?: string;
}
```

Push sender result types should live in `backend/stellive-hub-api/src/push/pushSender.ts`.

```ts
export type PushSendStatus =
  | "sent"
  | "disabled"
  | "transient_failure"
  | "permanent_token_failure";

export interface PushSendResult {
  status: PushSendStatus;
  providerMessageId?: string;
  providerErrorCode?: string;
  reason?: string;
}
```

Push target device projection should live in `DeviceRepository`.

```ts
export interface PushTargetDevice {
  deviceId: string;
  platform: "android" | "ios";
  pushProvider: "fcm" | "apns_via_fcm";
  pushToken: string;
  tokenStatus: "active" | "missing" | "invalid" | "disabled";
  timezone?: string;
  locale?: string;
  appVersion?: string;
}
```

Do not expose `pushToken` from diagnostics, admin responses, or logs.

## Repository Contracts

### `NotificationJobRepository`

File: `backend/stellive-hub-api/src/jobs/notificationJobRepository.ts`

Add public methods:

```ts
export interface ClaimedNotificationJob {
  id: string;
  eventId: string;
  priority: number;
  attempts: number;
  runAfter: Date;
  lockedAt: Date;
  lockedBy: string;
}

export interface ClaimNotificationJobsInput {
  limit: number;
  lockedBy: string;
  now: Date;
}

export interface FailNotificationJobInput {
  jobId: string;
  attempts: number;
  reason: string;
  retryAt?: Date;
  terminal: boolean;
}

async claimReady(input: ClaimNotificationJobsInput): Promise<ClaimedNotificationJob[]>;
async complete(jobId: string): Promise<void>;
async fail(input: FailNotificationJobInput): Promise<void>;
```

State transitions:

```text
queued -> locked -> completed
queued -> locked -> queued
queued -> locked -> failed
```

Claim query behavior:

- Select jobs where `status = "queued"` and `runAfter <= now`.
- Sort by `priority asc`, then `runAfter asc`, then `createdAt asc`.
- Clamp limit to `1..100`.
- Set `status = "locked"`, `lockedAt = now`, and `lockedBy`.
- Avoid non-atomic read-then-write loops in Prisma when possible. Use a transaction that selects candidate IDs and updates only those IDs still in `queued`.

Failure behavior:

- If `terminal = false`, set `status = "queued"`, clear lock fields, increment attempts, set `lastError`, and set `runAfter = retryAt`.
- If `terminal = true`, set `status = "failed"`, clear lock fields, increment attempts, and set `lastError`.
- Completion sets `status = "completed"` and clears lock fields.

### `PlatformEventRepository`

File: `backend/stellive-hub-api/src/repositories/platformEventRepository.ts`

Add:

```ts
async findById(eventId: string): Promise<PlatformEvent | undefined>;
```

Mapping rules:

- Convert Prisma `Date` fields back to ISO strings.
- Use `metadata` as normalized metadata only. Do not restore or expose raw provider payloads.
- Preserve `source`, `type`, `memberId`, `generationId`, `platformUrl`, `appDeepLink`, `realtimeEligible`, and `deliveryMode`.

### `DeviceRepository`

File: `backend/stellive-hub-api/src/repositories/deviceRepository.ts`

Add:

```ts
async listPushTargets(): Promise<PushTargetDevice[]>;
async markTokenInvalid(deviceId: string, reason: string): Promise<void>;
```

Selection rules:

- Include only devices with `tokenStatus = "active"`.
- Include only devices with a non-empty provider token.
- Include `timezone`, `locale`, and `appVersion` for policy and diagnostics.
- Do not include devices with `tokenStatus = "missing"`, `invalid`, or `disabled`.

If the current Prisma `Device` model lacks token/provider fields, add the minimal fields required by existing mobile token registration semantics:

```prisma
pushProvider String?
pushTokenHash String?
pushTokenEncrypted String?
```

Prefer the existing token column names if they already exist in the real schema. Store only encrypted token or backend-secret-managed token material; diagnostics should use token hash or status only.

### `PreferenceRepository`

Use the existing preference repository if it already returns `UserNotificationPreference[]`.

Required worker-facing method:

```ts
async listForDevices(deviceIds: string[]): Promise<UserNotificationPreference[]>;
```

If only per-device methods exist, keep the worker logic correct first, then optimize batch loading later.

### `DeliveryAttemptRepository`

File: `backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts`

Add:

```ts
export interface CreateDeliveryAttemptInput {
  eventId: string;
  deviceId: string;
  attemptedAt: Date;
  deliveredAt?: Date;
  status: "queued" | "sent" | "failed" | "skipped";
  reason?: string;
  source: PlatformSource;
  eventType: PlatformEventType;
  generationId: string;
  memberId: string;
  deliveryMode: DeliveryMode;
  deliveryLevel: NotificationDeliveryLevel;
  pushPriority: "normal" | "high";
  providerMessageId?: string;
  providerErrorCode?: string;
  retryCount?: number;
  expiresAt?: Date;
}

async create(input: CreateDeliveryAttemptInput): Promise<void>;
```

Rules:

- `sent` attempts include `deliveredAt`.
- `skipped` attempts include a policy reason such as `global_off`, `platform_off`, `event_type_off`, `quiet_hours`, `rate_limited`, `push_not_enqueued`, or `token_missing`.
- `failed` attempts include normalized provider error code if available.
- Do not persist provider response bodies.

## Push Package Design

Create directory:

```text
backend/stellive-hub-api/src/push/
```

### `pushPayloadFactory.ts`

Public API:

```ts
import type {
  NotificationDeliveryLevel,
  PlatformEvent,
  ResolvedNotificationPreference
} from "../types.js";

export interface PushPayloadInput {
  event: PlatformEvent;
  resolution: ResolvedNotificationPreference;
  deliveryLevel: NotificationDeliveryLevel;
}

export interface MinimalPushPayload {
  notification: {
    title: string;
    body: string;
  };
  data: {
    eventId: string;
    source: string;
    eventType: string;
    generationId: string;
    memberId: string;
    tapAction: string;
    appDeepLink: string;
    platformUrl: string;
  };
  android: {
    priority: "normal" | "high";
  };
  apns: {
    headers: {
      "apns-priority": "5" | "10";
    };
    payload: {
      aps: {
        sound?: "default";
      };
    };
  };
}

export function buildPushPayload(input: PushPayloadInput): MinimalPushPayload;
```

Title/body rules:

```ts
const titleByType: Record<HubEventNotificationType, string> = {
  event_announced: "굿즈/행사 일정이 공개됐어요",
  event_sales_open: "굿즈/행사 신청이 시작됐어요",
  event_deadline_soon: "굿즈/행사 마감이 가까워요",
  event_updated: "굿즈/행사 일정이 변경됐어요",
  event_cancelled: "굿즈/행사 일정이 취소됐어요"
};
```

Body:

- Prefer `event.title`.
- Append no private metadata.
- Do not include image, logo, poster, screenshot, token, raw payload, or provider response data.

Priority:

```ts
const highPriority =
  input.deliveryLevel === "immediate_push" &&
  input.resolution.deliveryMode === "realtime_best_effort";
```

Set Android `high` and APNs `10` only when `highPriority` is true. Otherwise use Android `normal` and APNs `5`.

### `fcmClient.ts`

Public API:

```ts
export interface FcmClientConfig {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

export interface FcmSendInput {
  token: string;
  payload: MinimalPushPayload;
}

export interface FcmClient {
  enabled: boolean;
  send(input: FcmSendInput): Promise<PushSendResult>;
}

export function createFcmClient(config: FcmClientConfig): FcmClient;
```

Disabled behavior:

- If any Firebase value is missing, empty, `verify_required`, or `replace_with_*`, return `enabled=false`.
- Disabled sends return `{ status: "disabled", reason: "fcm_not_configured" }`.
- Tests should use a fake `FcmClient`; no test should call Firebase network APIs.

Provider error normalization:

```text
messaging/registration-token-not-registered -> permanent_token_failure
messaging/invalid-registration-token -> permanent_token_failure
messaging/server-unavailable -> transient_failure
messaging/internal-error -> transient_failure
unknown provider exception -> transient_failure
```

### `pushSender.ts`

Public API:

```ts
export interface PushSender {
  sendToDevice(input: {
    device: PushTargetDevice;
    payload: MinimalPushPayload;
  }): Promise<PushSendResult>;
}

export class FcmPushSender implements PushSender {
  constructor(private readonly fcmClient: FcmClient) {}
}
```

Behavior:

- Send Android and iOS through FCM.
- Treat `apns_via_fcm` as FCM transport with APNs headers in payload.
- Do not log tokens.
- Return normalized result only.

## Notification Worker Design

File: `backend/stellive-hub-api/src/jobs/notificationWorker.ts`

Constructor dependencies:

```ts
export interface NotificationWorkerDependencies {
  notificationJobs: NotificationJobRepository;
  platformEvents: PlatformEventRepository;
  devices: DeviceRepository;
  preferences: PreferenceRepository;
  deliveryAttempts: DeliveryAttemptRepository;
  preferenceResolution: PreferenceResolutionService;
  pushSender: PushSender;
  now?: () => Date;
}
```

Class outline:

```ts
export class NotificationWorker {
  constructor(private readonly deps: NotificationWorkerDependencies) {}

  async drain(input: NotificationWorkerDrainInput = {}): Promise<NotificationWorkerDrainResult> {
    const now = input.now ?? this.deps.now?.() ?? new Date();
    const limit = clampDrainLimit(input.limit);
    const lockedBy = input.lockedBy ?? `worker-${process.pid}`;
    const jobs = await this.deps.notificationJobs.claimReady({ limit, lockedBy, now });

    const totals = emptyDrainResult(jobs.length);

    for (const job of jobs) {
      await this.processJob(job, totals, now);
    }

    return totals;
  }
}
```

Per-job flow:

```ts
private async processJob(
  job: ClaimedNotificationJob,
  totals: MutableDrainTotals,
  now: Date
): Promise<void> {
  const event = await this.deps.platformEvents.findById(job.eventId);
  if (!event) {
    await this.deps.notificationJobs.fail({
      jobId: job.id,
      attempts: job.attempts,
      reason: "platform_event_missing",
      terminal: true
    });
    totals.failed += 1;
    return;
  }

  const devices = await this.deps.devices.listPushTargets();
  const preferences = await this.deps.preferences.listForDevices(
    devices.map((device) => device.deviceId)
  );

  let hadTransientFailure = false;

  for (const device of devices) {
    const result = await this.processDevice({ event, device, preferences, job, now });
    updateTotals(totals, result);
    if (result.transientFailure) hadTransientFailure = true;
  }

  if (hadTransientFailure) {
    await this.retryOrFailJob(job, "transient_push_failure", now);
    totals.queued += 1;
    return;
  }

  await this.deps.notificationJobs.complete(job.id);
  totals.completed += 1;
}
```

Per-device flow:

```ts
const resolution = this.deps.preferenceResolution.resolve(event, device.deviceId, preferences, {
  timezone: device.timezone,
  now
});

const delivery = resolveNotificationDelivery(event, resolution, {
  now,
  recentEvents: []
});

if (!resolution.shouldNotify || !delivery.shouldEnqueuePush) {
  await deliveryAttempts.create({
    status: "skipped",
    reason: resolution.reason === "allowed" ? "push_not_enqueued" : resolution.reason,
    deliveryLevel: delivery.deliveryLevel,
    pushPriority: resolution.pushPriority,
    ...
  });
  return { skipped: true };
}

const payload = buildPushPayload({ event, resolution, deliveryLevel: delivery.deliveryLevel });
const sendResult = await pushSender.sendToDevice({ device, payload });
```

Send result handling:

- `sent`: record sent attempt, increment `sent`.
- `disabled`: record queued or skipped attempt with `fcm_not_configured`; do not terminal-fail the job in local/dev.
- `permanent_token_failure`: mark token invalid, record skipped/failed attempt, do not retry the job for that device.
- `transient_failure`: record failed attempt and retry the job.

Recommended disabled behavior:

- In `NODE_ENV !== "production"`, FCM disabled should complete the job after recording `queued` attempts so local development does not accumulate failed jobs.
- In production, FCM disabled should fail the job terminally with `fcm_not_configured` because configuration is required for push delivery.

Backoff:

```ts
const retryDelaysMs = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000
];

function retryAt(attempts: number, now: Date): Date | undefined {
  const delay = retryDelaysMs[attempts];
  return delay === undefined ? undefined : new Date(now.getTime() + delay);
}
```

If `retryAt` returns `undefined`, mark the job failed terminally.

## Load Reduction Code Change

File: `backend/stellive-hub-api/src/notification/loadReductionPolicy.ts`

Current immediate set includes only `chzzk_live_started`.

Change to:

```ts
const immediateEventTypes = new Set<PlatformEvent["type"]>([
  "chzzk_live_started",
  "event_sales_open",
  "event_deadline_soon",
  "event_cancelled"
]);
```

Keep `event_announced` and `event_updated` out of this set.

Rationale:

- Sales-open, deadline-soon, and cancellation are time-sensitive.
- Announcement can remain summary unless the user's preference resolution chooses `realtime_best_effort`.
- Updated starts disabled by policy and should not become urgent by default.

## Internal Route Wiring

File: `backend/stellive-hub-api/src/routes/internalRoutes.ts`

Extend dependencies:

```ts
notificationWorker?: {
  drain(input: NotificationWorkerDrainInput): Promise<NotificationWorkerDrainResult>;
};
```

Route behavior:

```ts
app.post("/v1/internal/jobs/notifications/drain", async (request) => {
  if (!dependencies.notificationWorker) {
    return {
      claimed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      sent: 0,
      queued: 0,
      status: "disabled",
      reason: "notification_worker_not_configured"
    };
  }

  const body = request.body as { limit?: number; lockedBy?: string } | undefined;
  return dependencies.notificationWorker.drain({
    limit: parseInternalLimit(body?.limit, 25),
    lockedBy: body?.lockedBy
  });
});
```

Do not accept:

- `deviceIds`
- `pushTokens`
- `eventTypes` filters
- arbitrary payload fields
- preference override flags

## App Wiring

File: `backend/stellive-hub-api/src/app.ts`

Add default dependency creation only when `options.internalRoutes?.dependencies?.notificationWorker` is not supplied.

Recommended factory:

```ts
function createNotificationWorker(env: AppEnv): NotificationWorker {
  const notificationJobs = new NotificationJobRepository();
  const platformEvents = new PlatformEventRepository();
  const devices = new DeviceRepository();
  const preferences = new PreferenceRepository();
  const deliveryAttempts = new DeliveryAttemptRepository();
  const preferenceResolution = new PreferenceResolutionService();
  const fcmClient = createFcmClient({
    projectId: env.FCM_PROJECT_ID,
    clientEmail: env.FCM_CLIENT_EMAIL,
    privateKey: env.FCM_PRIVATE_KEY
  });
  const pushSender = new FcmPushSender(fcmClient);

  return new NotificationWorker({
    notificationJobs,
    platformEvents,
    devices,
    preferences,
    deliveryAttempts,
    preferenceResolution,
    pushSender
  });
}
```

Tests should inject fake worker or fake repositories through existing `BuildAppOptions.internalRoutes.dependencies`.

## Prisma Considerations

Before editing schema, inspect current generated Prisma model names and existing migrations.

Required data:

- `Device` must store platform, token provider, token status, timezone, app version, and enough token material for backend send.
- `PlatformEvent` must contain normalized event fields required by payload factory.
- `NotificationJob` already contains `eventId`, `priority`, `status`, `runAfter`, `lockedAt`, `lockedBy`, `attempts`, and `lastError`.
- `DeliveryAttempt` must contain `eventId`, `deviceId`, `status`, `reason`, `source`, `eventType`, `generationId`, `memberId`, `deliveryMode`, `deliveryLevel`, `pushPriority`, `providerMessageId`, `providerErrorCode`, and timestamps.

If fields are missing, update `backend/stellive-hub-api/prisma/schema.prisma`, add a migration, and run:

```bash
cd backend/stellive-hub-api
rtk npm run prisma:generate
```

Do not commit real device tokens or Firebase credentials in migrations, fixtures, tests, or seed files.

## Test Design

### Unit Tests

`backend/stellive-hub-api/test/pushPayloadFactory.test.ts`

- Builds payload for each HubEvent notification type.
- Asserts exact allowed data keys.
- Asserts no raw payload or asset fields.
- Asserts priority mapping.

`backend/stellive-hub-api/test/notificationWorker.test.ts`

- Uses fake repositories and fake `PushSender`.
- Covers global off.
- Covers platform off.
- Covers event type off.
- Covers generation/member off.
- Covers quiet-hours and rate-limit blocks.
- Covers allowed urgent HubEvent push.
- Covers `realtime_best_effort` high priority only after allow decision.
- Covers FCM disabled.
- Covers transient retry.
- Covers permanent token failure.
- Covers missing event terminal failure.

`backend/stellive-hub-api/test/notificationLoadReduction.test.ts`

- Adds HubEvent urgent type coverage.
- Preserves `chzzk_live_started` behavior.
- Confirms blocked resolutions stay `in_app_history_only`.

### Route Tests

`backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- Unauthorized drain request returns `401`.
- Authorized drain request calls injected worker.
- Limit is clamped.
- Route does not accept device filters or raw payloads.

### Integration-Style Tests

`backend/stellive-hub-api/test/hubEventNotifications.test.ts`

- Publish HubEvent.
- Assert `PlatformEvent` candidates are created.
- Assert `NotificationJob` rows are queued.
- Drain jobs with fake allowed and global-off devices.
- Assert allowed device gets minimal payload.
- Assert global-off device is skipped with delivery attempt.
- Assert duplicate action dedupes by event key.

## Implementation Sequence

### Task 1: Define Push Payload Factory

**Files:**

- Create: `backend/stellive-hub-api/src/push/pushPayloadFactory.ts`
- Create: `backend/stellive-hub-api/test/pushPayloadFactory.test.ts`

- [ ] Write failing payload tests for all five HubEvent notification types.
- [ ] Run `rtk npm test -- pushPayloadFactory`.
- [ ] Implement `buildPushPayload`.
- [ ] Run `rtk npm test -- pushPayloadFactory`.

Expected: payloads include only minimal normalized fields.

### Task 2: Add FCM Client and Sender Boundary

**Files:**

- Create: `backend/stellive-hub-api/src/push/fcmClient.ts`
- Create: `backend/stellive-hub-api/src/push/pushSender.ts`
- Modify: `backend/stellive-hub-api/src/config/env.ts`
- Modify: `backend/stellive-hub-api/.env.example`
- Test: `backend/stellive-hub-api/test/foundation.test.ts`

- [ ] Write failing env and sender tests.
- [ ] Run `rtk npm test -- foundation`.
- [ ] Implement disabled-safe `createFcmClient`.
- [ ] Implement `FcmPushSender`.
- [ ] Run `rtk npm test -- foundation`.

Expected: Firebase is disabled-safe and testable without provider calls.

### Task 3: Extend Repository Methods

**Files:**

- Modify: `backend/stellive-hub-api/src/jobs/notificationJobRepository.ts`
- Modify: `backend/stellive-hub-api/src/repositories/platformEventRepository.ts`
- Modify: `backend/stellive-hub-api/src/repositories/deviceRepository.ts`
- Modify: `backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts`
- Test: `backend/stellive-hub-api/test/repositories.test.ts`

- [ ] Write failing tests for claim, complete, retry, terminal failure, event lookup, push target listing, and delivery attempt create.
- [ ] Run `rtk npm test -- repositories`.
- [ ] Implement repository methods.
- [ ] Run `rtk npm test -- repositories`.

Expected: repository methods support the worker without exposing secrets in diagnostics.

### Task 4: Implement Notification Worker

**Files:**

- Create: `backend/stellive-hub-api/src/jobs/notificationWorker.ts`
- Create: `backend/stellive-hub-api/test/notificationWorker.test.ts`

- [ ] Write failing worker tests with fake repositories.
- [ ] Run `rtk npm test -- notificationWorker`.
- [ ] Implement `NotificationWorker.drain`.
- [ ] Run `rtk npm test -- notificationWorker`.

Expected: worker enforces preferences, sends allowed pushes, records attempts, and retries transient failures.

### Task 5: Update Load Reduction Policy

**Files:**

- Modify: `backend/stellive-hub-api/src/notification/loadReductionPolicy.ts`
- Modify: `backend/stellive-hub-api/test/notificationLoadReduction.test.ts`

- [ ] Write failing tests for HubEvent urgent event types.
- [ ] Run `rtk npm test -- notificationLoadReduction`.
- [ ] Add `event_sales_open`, `event_deadline_soon`, and `event_cancelled` to immediate push policy.
- [ ] Run `rtk npm test -- notificationLoadReduction`.

Expected: urgent HubEvent events can push when allowed, while blocked resolutions stay blocked.

### Task 6: Wire Internal Drain Route

**Files:**

- Modify: `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- Modify: `backend/stellive-hub-api/src/app.ts`
- Modify: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- [ ] Write failing route tests with an injected fake worker.
- [ ] Run `rtk npm test -- adminInternalRoutes`.
- [ ] Extend internal route dependencies.
- [ ] Wire the default worker factory in `app.ts`.
- [ ] Run `rtk npm test -- adminInternalRoutes`.

Expected: authenticated internal route drains jobs through the worker and no longer returns `notification_worker_not_available` when configured.

### Task 7: Add End-to-End HubEvent Delivery Coverage

**Files:**

- Modify: `backend/stellive-hub-api/test/hubEventNotifications.test.ts`
- Modify: `backend/stellive-hub-api/test/hubEventAdminService.test.ts`

- [ ] Write integration-style test from admin publish to worker drain.
- [ ] Run `rtk npm test -- hubEventNotifications hubEventAdminService notificationWorker`.
- [ ] Fix only gaps exposed by the test.
- [ ] Run `rtk npm test -- hubEventNotifications hubEventAdminService notificationWorker`.

Expected: HubEvent admin changes enqueue jobs and drain into sent/skipped delivery attempts.

### Task 8: Update Documentation

**Files:**

- Modify: `docs/API_IMPLEMENTATION_PLAN.md`
- Modify: `docs/AI_HANDOFF.md`
- Modify: `docs/NOTIFICATION_POLICY.md`
- Modify: `docs/superpowers/plans/2026-06-12-hub-event-notification-jobs.md` only if implementation diverges from the feature plan.

- [ ] Document the implemented class names and drain endpoint behavior.
- [ ] Document Firebase disabled-safe behavior.
- [ ] Document HubEvent urgent/default delivery levels.
- [ ] Run `rtk grep "notification_worker_not_available|NotificationWorker|event_deadline_soon|FCM_PRIVATE_KEY|realtime_best_effort" docs backend/stellive-hub-api/src`.

Expected: docs match code and do not introduce policy violations.

### Task 9: Full Verification

**Files:** no edits unless verification exposes a defect.

- [ ] Run backend build.

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Expected: TypeScript build succeeds.

- [ ] Run backend test suite.

```bash
cd backend/stellive-hub-api
rtk npm test
```

Expected: Vitest suite passes.

- [ ] Run repository policy scan.

```bash
rtk grep "Former|former|official_youtube_live|youtube_live|NID_AUT|NID_SES|logoUrl|posterUrl|profileImage|raw provider|production token" backend shared docs
```

Expected: matches are limited to policy text, tests asserting exclusion, negative documentation, or the scan command itself.

## Failure Modes and Expected Behavior

| Failure | Worker behavior | Job behavior | Attempt behavior |
| --- | --- | --- | --- |
| Missing `PlatformEvent` | Stop processing job | terminal `failed` | no device attempts |
| No active devices | Complete job | `completed` | no attempts |
| Global off | Skip device | continue job | `skipped`, reason `global_off` |
| Event type off | Skip device | continue job | `skipped`, reason `event_type_off` |
| Push not enqueued by load reduction | Skip device | continue job | `skipped`, reason `push_not_enqueued` |
| FCM disabled in development | Queue/skip attempt | complete job | `queued`, reason `fcm_not_configured` |
| FCM disabled in production | Stop job | terminal `failed` | `failed`, reason `fcm_not_configured` |
| Transient provider error | Retry job | `queued` with backoff | `failed`, provider error code |
| Invalid token | Mark token invalid | continue job | `skipped` or `failed`, provider error code |

## Review Checklist

- `NotificationWorker` is dependency-injected and testable without network access.
- `PreferenceResolutionService` is called before every push send.
- `resolveNotificationDelivery` is called before every push send.
- Push payload is built only from normalized `PlatformEvent` and resolution data.
- Internal drain route does not accept device filters or raw push payloads.
- FCM private key, service account email, OAuth tokens, and production device tokens are never committed.
- Diagnostics never expose full push tokens or provider response bodies.
- `realtime_best_effort` only changes delivery strategy after the notification is allowed.
- Official YouTube live events remain unsupported.
- X remains disabled unless a no-cost official API path is separately verified.
