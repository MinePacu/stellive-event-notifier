Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Implement backend notification job draining and FCM/APNs delivery for `굿즈/이벤트` HubEvent changes from GitHub issue #17 and GitLab work item #11.

**Architecture:** Admin HubEvent publish/update/cancel actions already create normalized `hub_event` `PlatformEvent` records and enqueue `NotificationJob` rows. This plan adds a backend-only notification worker that claims jobs, loads normalized events and registered devices, resolves preferences, applies load-reduction/realtime policy, sends minimal FCM/APNs-via-FCM payloads, records delivery attempts, and retries transient failures without allowing admin routes or mobile apps to bypass the server policy boundary.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Firebase Admin SDK, Zod, Vitest.

## Source Issues

- GitHub: https://github.com/MinePacu/stellive-event-notifier/issues/17
- GitLab: https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/11
- Title: `[backend][push] 굿즈/이벤트 변경 알림 job 및 FCM/APNs 전송 구현`
- State: open on both trackers.
- Created: 2026-06-11 13:55:50 UTC on both trackers.
- Comments: GitHub issue #17 has no comments at design time.

## Issue Requirements

- When an admin publishes or changes a `굿즈/이벤트` schedule, the server sends notifications to mobile devices.
- The admin console must not send directly to all devices.
- All delivery must pass through notification jobs and preference resolution.
- HubEvent create/publish/update/cancel actions create notification jobs.
- Supported event types are `event_announced`, `event_sales_open`, `event_deadline_soon`, `event_updated`, and `event_cancelled`.
- Apply device preferences, global off, platform, event type, generation, and member rules.
- Apply quiet hours, rate limits, and `realtime_best_effort`.
- Keep FCM/APNs payloads minimal.
- Record delivery attempts and add failed retry behavior.

## Acceptance Criteria

- A user with global notifications off receives no `굿즈/이벤트` push.
- `realtime_best_effort` changes only the strategy for already-allowed events and never bypasses disabled settings.
- Push payloads contain only minimal fields: `eventId`, `eventType`, `generationId`, `memberId`, deep link, source URL, and display text required by the OS notification.
- Raw provider payloads, production device tokens, and secrets are not committed to the repository.

## Non-Goals

- Do not add new external platform ingestion adapters.
- Do not implement official YouTube live scheduled/started/ended notifications.
- Do not enable X delivery or assume paid X API access.
- Do not add unauthorized crawling, login-cookie scraping, private Cafe collection, profile images, logos, posters, screenshots, fan art, or copied media.
- Do not move preference enforcement into mobile apps or admin console code.

## Current State

- `backend/stellive-hub-api/src/hub-events/hubEventNotificationFactory.ts` creates normalized `hub_event` `PlatformEvent` candidates for HubEvent admin actions.
- `backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts` persists created `PlatformEvent` records and enqueues `NotificationJob` rows with priority `5`.
- `backend/stellive-hub-api/src/jobs/notificationJobRepository.ts` supports enqueueing and diagnostics but not claim/complete/fail worker operations.
- `backend/stellive-hub-api/src/routes/internalRoutes.ts` exposes `POST /v1/internal/jobs/notifications/drain`, but it currently returns `notification_worker_not_available`.
- `backend/stellive-hub-api/src/preferences/preferenceResolution.ts` already handles global off, scoped rules, quiet hours, keyword filters, rate limits, and realtime delivery mode.
- `backend/stellive-hub-api/src/notification/loadReductionPolicy.ts` currently treats only `chzzk_live_started` as immediate push; HubEvent notifications resolve to summary delivery unless explicitly updated.
- `backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts` provides diagnostics, but the worker path to create/update delivery attempts is not implemented.
- Firebase Admin environment variables exist in config and health surfaces: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY`.

## Design

### Delivery Flow

1. Admin creates, publishes, updates, cancels, deactivates, or deletes a HubEvent through existing admin routes.
2. `HubEventAdminService` builds eligible notification candidates for `event_announced`, `event_sales_open`, `event_deadline_soon`, `event_updated`, or `event_cancelled`.
3. `PlatformEventRepository.createIfNotExists` dedupes each event by `dedupeKey`.
4. `NotificationJobRepository.enqueue` creates one queued job for each newly persisted event.
5. `POST /v1/internal/jobs/notifications/drain` claims queued jobs with `runAfter <= now`.
6. `NotificationWorker` loads the `PlatformEvent`.
7. `NotificationWorker` loads active devices with active push tokens.
8. For each device, `PreferenceResolutionService.resolve` decides whether the event is allowed.
9. `resolveNotificationDelivery` decides `immediate_push`, `summary_push`, or `in_app_history_only`.
10. Allowed push deliveries are sent through `PushSender`.
11. Every device decision writes a `DeliveryAttempt` as `sent`, `queued`, `skipped`, or `failed`.
12. The job is completed when all target devices are processed.
13. Transient sender failures reschedule the job with exponential backoff until max attempts.
14. Permanent failures mark the device token invalid or degraded and skip future sends where appropriate.

### Delivery Decisions

- `global=false` returns `shouldNotify=false` before any platform/event/generation/member rule can re-enable delivery.
- Platform `hub_event` off blocks all HubEvent push notifications.
- Event type off blocks the specific event type.
- Generation and member rules apply to the event's normalized `generationId` and `memberId`.
- Quiet hours downgrade or skip according to the existing preference resolution behavior.
- Rate limits skip or downgrade according to existing rule evaluation.
- `realtime_best_effort` may set high push priority only when the event is already allowed.
- Disabled settings always win over `realtime_best_effort`.

### HubEvent Delivery Level

HubEvent notifications should be push-capable but conservative:

- `event_sales_open`, `event_deadline_soon`, and `event_cancelled`: `immediate_push` when preferences allow notification.
- `event_announced`: `summary_push` by default, `immediate_push` only when the device has `realtime_best_effort`.
- `event_updated`: `summary_push` by default because event updates start disabled in policy.
- `in_app_history_only`: for global off, event type off, platform off, generation/member off, quiet hours blocks, keyword blocks, and rate-limit blocks.

This keeps urgent transactional HubEvent changes timely without treating all schedule edits as realtime live-status events.

### Push Payload

Push payloads must be generated from normalized `PlatformEvent` only.

Required data keys:

```json
{
  "eventId": "hub_event:event-1:event_cancelled:2026-06-12T12:00:00.000Z",
  "source": "hub_event",
  "eventType": "event_cancelled",
  "generationId": "official",
  "memberId": "stellive-official",
  "tapAction": "open_app",
  "appDeepLink": "stellivehub://hub-events/event-1",
  "platformUrl": "https://example.com/source"
}
```

Android:

- Use FCM notification payload for visible title/body.
- Use high priority only when `deliveryMode === "realtime_best_effort"` and the notification is user-visible.
- Do not send high-priority silent data-only messages.

iOS:

- Send through FCM/APNs.
- Set `apns-priority: "10"` only for allowed realtime/immediate user-visible pushes.
- Use normal APNs priority for summary/default pushes.

Never include:

- Raw provider payloads.
- OAuth tokens, API keys, Firebase service accounts, or production device tokens.
- Image URLs, logos, profile images, posters, screenshots, fan art, copied media, or private platform responses.

### Retry Policy

- Claim jobs atomically by transitioning `queued -> locked`.
- `lockedAt` and `lockedBy` prevent duplicate workers from sending the same job concurrently.
- Max attempts: `5`.
- Backoff: `1m`, `5m`, `15m`, `1h`, then `failed`.
- Retry only transient provider failures and transient database failures.
- Do not retry preference-denied deliveries.
- Do not retry inactive, missing, or permanently invalid push tokens.
- Record provider error codes in `DeliveryAttempt.providerErrorCode` without storing raw provider responses.

### Internal API

`POST /v1/internal/jobs/notifications/drain`

Request:

```json
{
  "limit": 25,
  "lockedBy": "scheduler-local"
}
```

Response:

```json
{
  "claimed": 2,
  "completed": 1,
  "failed": 0,
  "skipped": 10,
  "sent": 4,
  "queued": 6,
  "status": "ok"
}
```

Rules:

- The route stays protected by `INTERNAL_API_TOKEN`.
- The route must not accept device filters that bypass preferences.
- The route must not accept raw push payloads from callers.
- The route delegates to `NotificationWorker.drain`.

### Diagnostics

- Admin overview should continue showing queue totals and recent delivery totals.
- Job diagnostics should show `queued`, `locked`, `completed`, and `failed`.
- Delivery diagnostics should show `sent`, `queued`, `skipped`, and `failed`.
- Diagnostics must never include full device tokens, Firebase private keys, OAuth tokens, or raw provider responses.

## Files

Create:

- `backend/stellive-hub-api/src/jobs/notificationWorker.ts`
- `backend/stellive-hub-api/src/push/fcmClient.ts`
- `backend/stellive-hub-api/src/push/pushPayloadFactory.ts`
- `backend/stellive-hub-api/src/push/pushSender.ts`
- `backend/stellive-hub-api/test/notificationWorker.test.ts`
- `backend/stellive-hub-api/test/pushPayloadFactory.test.ts`

Modify:

- `backend/stellive-hub-api/src/jobs/notificationJobRepository.ts`
- `backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts`
- `backend/stellive-hub-api/src/repositories/deviceRepository.ts`
- `backend/stellive-hub-api/src/repositories/platformEventRepository.ts`
- `backend/stellive-hub-api/src/notification/loadReductionPolicy.ts`
- `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- `backend/stellive-hub-api/src/admin/adminHealthService.ts`
- `backend/stellive-hub-api/src/admin/adminTypes.ts`
- `backend/stellive-hub-api/src/config/env.ts`
- `backend/stellive-hub-api/.env.example`
- `backend/stellive-hub-api/prisma/schema.prisma` only if required fields or indexes are missing.
- `docs/API_IMPLEMENTATION_PLAN.md`
- `docs/AI_HANDOFF.md`
- `docs/NOTIFICATION_POLICY.md`

## Implementation Tasks

### Task 1: Repository Worker Operations

**Files:**

- Modify: `backend/stellive-hub-api/src/jobs/notificationJobRepository.ts`
- Modify: `backend/stellive-hub-api/src/repositories/platformEventRepository.ts`
- Modify: `backend/stellive-hub-api/src/repositories/deviceRepository.ts`
- Modify: `backend/stellive-hub-api/src/repositories/deliveryAttemptRepository.ts`
- Test: `backend/stellive-hub-api/test/repositories.test.ts`

- [ ] Add tests for atomic job claim by `status="queued"` and `runAfter <= now`.
- [ ] Add tests proving a locked job cannot be claimed twice.
- [ ] Add tests for completing a job.
- [ ] Add tests for retrying a transient failure with incremented `attempts`, `lastError`, and future `runAfter`.
- [ ] Add tests for marking a job failed after max attempts.
- [ ] Add tests for loading a `PlatformEvent` by `eventId`.
- [ ] Add tests for listing active devices with usable push tokens without exposing token values to diagnostics.
- [ ] Add tests for creating delivery attempts with `sent`, `queued`, `skipped`, and `failed`.
- [ ] Implement repository methods needed by the worker.
- [ ] Run `rtk npm test -- repositories`.

Expected: repository tests pass without network access.

### Task 2: Push Payload Factory

**Files:**

- Create: `backend/stellive-hub-api/src/push/pushPayloadFactory.ts`
- Test: `backend/stellive-hub-api/test/pushPayloadFactory.test.ts`

- [ ] Add tests for `event_announced`, `event_sales_open`, `event_deadline_soon`, `event_updated`, and `event_cancelled`.
- [ ] Assert payload data includes only `eventId`, `source`, `eventType`, `generationId`, `memberId`, `tapAction`, `appDeepLink`, and `platformUrl`.
- [ ] Assert Android priority is `high` only for allowed realtime/immediate user-visible pushes.
- [ ] Assert iOS APNs priority is `10` only for allowed realtime/immediate user-visible pushes.
- [ ] Assert payload factory does not forward `rawPayload`, provider responses, tokens, image URLs, logos, posters, or profile image fields.
- [ ] Implement title/body generation from normalized `PlatformEvent`.
- [ ] Run `rtk npm test -- pushPayloadFactory`.

Expected: payload tests pass and payloads remain minimal.

### Task 3: Firebase Client Boundary

**Files:**

- Create: `backend/stellive-hub-api/src/push/fcmClient.ts`
- Create: `backend/stellive-hub-api/src/push/pushSender.ts`
- Modify: `backend/stellive-hub-api/src/config/env.ts`
- Modify: `backend/stellive-hub-api/.env.example`
- Test: `backend/stellive-hub-api/test/foundation.test.ts`

- [ ] Add env validation tests for `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY`.
- [ ] Treat placeholder or empty Firebase values as disabled.
- [ ] Implement a Firebase Admin client factory that initializes only when all required values are configured.
- [ ] Implement a fake sender injection point for tests.
- [ ] Normalize provider results into `sent`, `failed`, `permanent_token_failure`, or `transient_failure`.
- [ ] Ensure the client never logs or returns full tokens or Firebase private keys.
- [ ] Run `rtk npm test -- foundation`.

Expected: Firebase config is safe-by-default and testable without network access.

### Task 4: Notification Worker

**Files:**

- Create: `backend/stellive-hub-api/src/jobs/notificationWorker.ts`
- Test: `backend/stellive-hub-api/test/notificationWorker.test.ts`

- [ ] Add a test proving global off skips every HubEvent push.
- [ ] Add a test proving platform `hub_event` off skips HubEvent push.
- [ ] Add a test proving event type off skips the matching HubEvent event.
- [ ] Add a test proving generation/member off skips matching HubEvent events.
- [ ] Add a test proving quiet hours and rate limits are respected.
- [ ] Add a test proving `realtime_best_effort` changes priority only for an allowed event.
- [ ] Add a test proving `event_sales_open`, `event_deadline_soon`, and `event_cancelled` can be immediate push.
- [ ] Add a test proving `event_updated` remains summary/default unless explicitly allowed by policy.
- [ ] Add a test proving skipped deliveries still record delivery attempts with a reason.
- [ ] Add a test proving transient provider failure schedules retry.
- [ ] Add a test proving permanent token failure marks or skips the token without retrying the same token.
- [ ] Implement `NotificationWorker.drain({ limit, lockedBy })`.
- [ ] Run `rtk npm test -- notificationWorker`.

Expected: worker tests pass with fake repositories and fake push sender.

### Task 5: Load Reduction Policy

**Files:**

- Modify: `backend/stellive-hub-api/src/notification/loadReductionPolicy.ts`
- Test: `backend/stellive-hub-api/test/notificationLoadReduction.test.ts`

- [ ] Add tests for HubEvent delivery levels.
- [ ] Keep `chzzk_live_started` existing behavior intact.
- [ ] Ensure disabled preference resolution remains `in_app_history_only`.
- [ ] Add HubEvent urgent types to immediate-push policy only where issue acceptance requires timely push.
- [ ] Run `rtk npm test -- notificationLoadReduction`.

Expected: urgent HubEvent types can enqueue push while disabled/blocked events cannot.

### Task 6: Internal Drain Route

**Files:**

- Modify: `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- Test: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- [ ] Add tests proving `/v1/internal/jobs/notifications/drain` requires `INTERNAL_API_TOKEN`.
- [ ] Add tests proving the route calls `NotificationWorker.drain`.
- [ ] Add tests proving request `limit` is clamped.
- [ ] Add tests proving the route returns worker counts instead of `notification_worker_not_available`.
- [ ] Implement route dependency wiring.
- [ ] Run `rtk npm test -- adminInternalRoutes`.

Expected: the internal drain endpoint is available only to authenticated scheduler/admin automation.

### Task 7: Admin Diagnostics

**Files:**

- Modify: `backend/stellive-hub-api/src/admin/adminHealthService.ts`
- Modify: `backend/stellive-hub-api/src/admin/adminTypes.ts`
- Test: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- [ ] Add tests for queue totals after queued, locked, completed, and failed jobs.
- [ ] Add tests for delivery totals after sent, queued, skipped, and failed attempts.
- [ ] Assert diagnostics do not include device tokens, Firebase private keys, raw provider payloads, or full provider responses.
- [ ] Wire new repository methods into admin overview only where missing.
- [ ] Run `rtk npm test -- adminInternalRoutes`.

Expected: admin diagnostics expose operational status without secrets.

### Task 8: End-to-End HubEvent Push Path

**Files:**

- Modify: `backend/stellive-hub-api/test/hubEventNotifications.test.ts`
- Modify: `backend/stellive-hub-api/test/hubEventAdminService.test.ts`

- [ ] Add an integration-style test that publishes a HubEvent and enqueues `event_announced` plus `event_sales_open` jobs.
- [ ] Drain the queued jobs through `NotificationWorker` with fake devices and fake sender.
- [ ] Assert global-off device receives no push.
- [ ] Assert allowed device receives only minimal payload.
- [ ] Assert delivery attempts are recorded for sent and skipped devices.
- [ ] Assert duplicate publish/action does not create duplicate push jobs for the same dedupe key.
- [ ] Run `rtk npm test -- hubEventNotifications hubEventAdminService notificationWorker`.

Expected: admin HubEvent changes flow through jobs, preferences, push sender, and delivery attempts.

### Task 9: Documentation Updates

**Files:**

- Modify: `docs/API_IMPLEMENTATION_PLAN.md`
- Modify: `docs/AI_HANDOFF.md`
- Modify: `docs/NOTIFICATION_POLICY.md`

- [ ] Document the notification worker and drain endpoint.
- [ ] Document Firebase environment variables and safe disabled behavior.
- [ ] Document HubEvent urgent/default delivery levels.
- [ ] Document that admin console never directly broadcasts to devices.
- [ ] Document that mobile apps consume normalized notifications only and never hold Firebase server credentials.
- [ ] Run `rtk grep "notification_worker_not_available|FCM_PRIVATE_KEY|event_deadline_soon|global off|realtime_best_effort" docs backend/stellive-hub-api/src`.

Expected: docs describe the implemented behavior and preserve project policy constraints.

### Task 10: Full Verification

**Files:** no edits unless verification exposes a defect.

- [ ] Run backend build.

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Expected: TypeScript build succeeds.

- [ ] Run backend tests.

```bash
cd backend/stellive-hub-api
rtk npm test
```

Expected: Vitest suite passes.

- [ ] Run policy scan.

```bash
rtk grep "Former|former|official_youtube_live|youtube_live|NID_AUT|NID_SES|logoUrl|posterUrl|profileImage|raw provider|production token" backend shared docs
```

Expected: matches are limited to policy text, tests asserting exclusion, or explicit negative documentation.

## Rollout Plan

1. Deploy backend with Firebase env vars unset and confirm worker reports push disabled without failing jobs permanently.
2. Configure Firebase service account values only in secret-managed backend environment.
3. Trigger `POST /v1/internal/jobs/notifications/drain` in a staging environment with fake or staging device tokens.
4. Publish a staging HubEvent and verify queue, delivery attempts, and minimal payloads.
5. Verify global off, event type off, generation/member off, quiet hours, and rate limits with staging devices.
6. Enable scheduled draining at low frequency.
7. Monitor queue depth, failed jobs, provider error codes, invalid token counts, and delivery latency.
8. Increase drain frequency only after failure and retry behavior is stable.

## Safety Checklist

- Former members are not added to catalog, seed data, notification targets, filters, or tests except exclusion checks.
- Gangzi remains only `gamja` representative and is not treated as a generation member.
- `official` remains `기타`.
- Official YouTube creates upload notifications only; no official YouTube live events are generated.
- All delivery passes through preference resolution.
- Global off blocks every push.
- `realtime_best_effort` never bypasses disabled settings, quiet hours, rate limits, OS policy, push-service policy, or user opt-outs.
- No secrets, Firebase private keys, production device tokens, raw private responses, profile images, logos, fan art, screenshots, or copied media are committed.
