# Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Hub Event admin editing so clearing `endsAt` persists as a real null value, and make Android/iOS goods-event list, calendar, and detail screens handle events with no end time consistently.

**Architecture:** Treat omitted fields and explicitly cleared fields differently across the admin flow. Admin edit requests should send `null` for cleared nullable fields, backend validation should validate the merged post-update event, and Prisma writes should persist `null` instead of dropping the field. Mobile surfaces should render events with `startsAt` and no `endsAt` as scheduled single-start events, not as broken date ranges or implicitly ended events.

**Tech Stack:** TypeScript, Fastify, Prisma, Vitest, server-rendered admin console JavaScript, Kotlin Android Views/JUnit, Swift/SwiftUI/XCTest, OpenAPI shared Hub Event DTOs.

**Current Root Cause**

The current admin edit flow cannot clear `endsAt`.

Observed behavior:

- Existing DB row has `startsAt = 2026-07-11T09:00:00.000Z` and `endsAt = 2026-07-11T14:00:00.000Z`.
- User clears `Ends at` in the admin form.
- `collectHubEventInput()` omits empty date fields instead of sending `endsAt: null`.
- `HubEventAdminService.update()` validates `{ ...before, ...input }`, so the old `endsAt` remains present during validation.
- `HubEventRepository.toWriteData()` turns missing date fields into `undefined`, and `stripUndefined()` removes them from the Prisma update.
- The DB update does not touch `endsAt`, so the old value remains.
- The save response contains the old `endsAt`, and `bindHubEventForm()` fills the field again.

Relevant current files:

- `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`

**Target Semantics**

Use three distinct meanings:

- Field omitted: keep the existing value for partial update semantics.
- Field set to `null`: clear the existing nullable value in the database.
- Field set to ISO string: replace the existing value.

Apply this to at least these nullable admin fields:

- `announcedAt`
- `startsAt`
- `endsAt`
- `summary`
- `memberId`
- `purchaseUrl`
- `ticketUrl`
- `venueName`
- `venueAddress`
- `image`

For this plan, date clearing is mandatory. Non-date nullable text fields can be handled in the same patch only where the existing admin form already supports clearing them safely.

**Mobile Display Policy For Missing `endsAt`**

When `startsAt` exists and `endsAt` is null:

- Goods/event list row should show start time only, for example `7월 11일 18:00 시작`.
- Calendar entry should remain on the start date only.
- Calendar display time should be `HH:mm 시작`.
- Detail page period row should show start time and an explicit no-end-time label, for example `2026.7.11 18:00 시작 · 종료 미정`.
- Status calculation should not auto-end the event without `endsAt`; after `startsAt` passes it may be `open` until admin manually sets `status = ended` or adds `endsAt`.
- Closing-soon logic should only apply when `endsAt` exists.
- Widget snapshots should not show `마감` text for events without `endsAt`.

When both `startsAt` and `endsAt` are null, keep existing announced/date-window policy:

- Published non-announced, non-cancelled events still require at least one date field.
- Drafts can remain looser if current draft validation allows it.

**Files**

Create:

- `docs/superpowers/plans/2026-06-19-hub-event-null-end-time-admin-mobile-plan.md`

Modify:

- `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventAdminTypes.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`
- `backend/stellive-hub-api/src/hub-events/hubEventService.ts`
- `shared/schemas/domain.ts`
- `shared/openapi/openapi.yaml`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/model/Models.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/network/HubApiModels.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarWidgetTextFormatter.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/HubEventsCalendarView.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MockHubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/hubevents/HubEventDetailFormatting.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`

Test:

- `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts`
- `backend/stellive-hub-api/test/hubEventAdminService.test.ts`
- `backend/stellive-hub-api/test/repositories.test.ts`
- `backend/stellive-hub-api/test/hubEventCalendar.test.ts`
- `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarWidgetTextFormatterTest.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsCalendarViewModelTest.kt`
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`
- Add an iOS formatting/policy test file if no existing XCTest covers Hub Event detail/date formatting.

## Step 1: Confirm Baseline And Reproduce Admin Clear Bug

- [ ] Run status:

```bash
rtk git status --short --branch
```

- [ ] Run focused backend tests before editing:

```bash
cd backend/stellive-hub-api
rtk npm test -- adminHubEvent hubEventCalendar hubEventReadRoutes repositories
```

- [ ] Add a failing route or service test proving update with `endsAt: null` clears the persisted value.

Target test shape in `backend/stellive-hub-api/test/adminHubEventRoutes.test.ts` or `backend/stellive-hub-api/test/hubEventAdminService.test.ts`:

```ts
const updated = await service.update("event-1", {
  startsAt: "2026-07-11T09:00:00.000Z",
  endsAt: null,
});

expect(updated.endsAt).toBeUndefined();
```

Expected before implementation: FAIL because `endsAt` remains the old ISO timestamp.

## Step 2: Add Explicit Nullable Date Types

- [ ] Update `AdminHubEventWriteInput` in `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts` or the current source type location to allow `string | Date | null` for `announcedAt`, `startsAt`, and `endsAt`.
- [ ] Update `backend/stellive-hub-api/src/hub-events/hubEventAdminTypes.ts` if request DTO schemas/types currently reject null date fields.
- [ ] Update any helper signatures that currently take `string | Date | undefined` so null is not lost.

Implementation target:

```ts
type NullableDateInput = string | Date | null | undefined;
```

Expected result: TypeScript accepts explicit null in tests and admin route request bodies.

## Step 3: Preserve Null In Repository Writes

- [ ] Change `toDate()` in `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts` so `null` returns `null`, while `undefined` remains `undefined`.
- [ ] Keep `stripUndefined()` behavior so omitted fields are not written.
- [ ] Ensure Prisma receives `endsAt: null` when an admin update clears the field.

Implementation target:

```ts
function toDate(value: string | Date | null | undefined): Date | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return value instanceof Date ? value : new Date(value);
}
```

- [ ] Run the focused repository test:

```bash
cd backend/stellive-hub-api
rtk npm test -- repositories
```

Expected after implementation: repository update with `endsAt: null` persists a null DB value.

## Step 4: Make Admin Console Send Null For Cleared Dates

- [ ] Update `collectHubEventInput()` in `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`.
- [ ] For date fields, if the input is empty, set `input[key] = null`.
- [ ] Keep valid date inputs as ISO strings.
- [ ] Do not add hidden fallback fields or sentinel strings.

Implementation target:

```js
if (["announcedAt", "startsAt", "endsAt"].includes(key)) {
  const iso = toIsoFromLocal(element.value);
  input[key] = iso || null;
  return;
}
```

- [ ] Add or update admin console JS test coverage if current backend tests render and exercise the HTML script.
- [ ] If no JS harness exists, cover the route behavior through `PUT /v1/admin/hub-events/:id` with `endsAt: null`.

Expected result: clearing the `Ends at` input no longer re-sends an omitted field.

## Step 5: Validate Merged Post-Update Event With Null Overrides

- [ ] Update `HubEventAdminService.update()` so validation merges `before` and `input` while honoring explicit null as a clear.
- [ ] Confirm `{ ...before, ...input }` remains acceptable when `input.endsAt === null`; it should override the old value.
- [ ] Ensure `validateHubEventForAdmin()` treats null date fields like absent date fields.
- [ ] Add tests for these cases:

```ts
await service.update("published-event", { endsAt: null });
await service.update("published-event", { startsAt: null, endsAt: null });
```

Expected:

- Clearing only `endsAt` passes when `startsAt` or `announcedAt` remains.
- Clearing all date fields from a published non-announced/non-cancelled event fails with `date_window_required`.

## Step 6: Publish Flow Must Not Restore Cleared Dates

- [ ] Add a service test that performs update with `endsAt: null`, then `publish()`.
- [ ] Assert publish does not restore the previous `endsAt`.
- [ ] Assert the publish notification candidate uses the post-update event with `endsAt` absent/null.

Expected result:

```ts
expect(published.endsAt).toBeUndefined();
```

## Step 7: Backend Calendar And Public Read Behavior

- [ ] Add `hubEventCalendar` tests for a published event with `startsAt` and null `endsAt`.
- [ ] Assert the calendar entry appears on the start date only.
- [ ] Assert `displayTimeText` is `HH:mm 시작`.
- [ ] Assert `effectiveStatus()` does not return `ended` solely because the start time is in the past and `endsAt` is null.
- [ ] Assert `closing_soon` is not derived without an `endsAt`.

Run:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventCalendar hubEventReadRoutes
```

Expected: calendar/list/detail public APIs return the event with no `endsAt` field and stable display text.

## Step 8: Shared Contract And OpenAPI

- [ ] Verify `shared/schemas/domain.ts` already models `endsAt?: string`; keep public DTO as optional, not required.
- [ ] Update `shared/openapi/openapi.yaml` so admin update/create request schemas allow nullable date fields for `announcedAt`, `startsAt`, and `endsAt`.
- [ ] Ensure public response schemas keep `endsAt` optional and do not require null.

Run:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Expected: TypeScript and OpenAPI contract stay aligned.

## Step 9: Android Date Display Policy

- [ ] Add tests in `CalendarUiPolicyTest.kt` and `CalendarWidgetTextFormatterTest.kt` for `startsAt != null && endsAt == null`.
- [ ] Expected list/calendar label: `HH:mm 시작`.
- [ ] Expected widget subtitle should not include `마감`.
- [ ] Expected detail period text in `HubEventDetailFormatting.kt`: start time plus `종료 미정`.
- [ ] Verify `HubEventsCalendarViewModel` keeps the entry on the start date.

Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest --tests dev.stellive.hub.CalendarWidgetTextFormatterTest
```

Expected before implementation: formatting tests fail if current UI assumes an end time.

## Step 10: Android UI Implementation

- [ ] Update `HubEventDetailFormatting.kt` to render:

```text
YYYY.MM.DD HH:mm 시작 · 종료 미정
```

when `startsAt` exists and `endsAt` is null.

- [ ] Update `CalendarWidgetTextFormatter.kt` to use `시작` label for start-only events.
- [ ] Update `HubEventsCalendarView.kt` only if row text currently assumes `endsAt`.
- [ ] Update mock data in `MockHubRepository.kt` to include one event with `startsAt` and no `endsAt` so local UI can be inspected without server data.
- [ ] Do not add new assets, logos, profile images, screenshots, or official media.

Run:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

Expected: all Android unit tests pass.

## Step 11: iOS Date Display Policy

- [ ] Add XCTest coverage for a Hub Event with `startsAt != nil` and `endsAt == nil`.
- [ ] Assert list/calendar row displays start-only text.
- [ ] Assert detail page formatting includes `종료 미정`.
- [ ] Assert widget snapshot formatting, if covered in iOS tests, does not show a deadline label.
- [ ] If there is no pure formatting helper, extract the smallest testable formatter from `HubEventDetailView.swift` or `HubModels.swift`.

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

Expected before implementation: focused iOS date-formatting test fails.

## Step 12: iOS UI Implementation

- [ ] Update `HubEventsCalendarView.swift` row display if it assumes an end time.
- [ ] Update `HubEventsView.swift` list display if it shows event date ranges directly.
- [ ] Update `HubEventDetailView.swift` to show `종료 미정` for start-only events.
- [ ] Update `MockHubStore.swift` to include one start-only event for visual inspection.
- [ ] Keep SwiftUI grouped styling consistent with current goods/event pages.

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

Expected: iOS tests pass.

## Step 13: Admin End-To-End Verification On Internal Server

- [ ] Sync workspace to the internal server using the AGENTS.md rsync exclusions.
- [ ] Rebuild API containers:

```bash
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti && docker compose -f backend/stellive-hub-api/docker-compose.yml up -d --build --force-recreate'
```

- [ ] In admin console, edit an event that has `Ends at`, clear `Ends at`, run Validate, Save draft, then Publish.
- [ ] Query the DB:

```bash
rtk ssh minepacu@192.168.50.9 'docker exec stellive-hub-api-postgres-1 psql -U stellive -d stellive_hub -c "select id, \"startsAt\", \"endsAt\", revision from \"HubEvent\" where \"deletedAt\" is null order by \"updatedAt\" desc;"'
```

Expected: target event has `endsAt` as null after Save draft and remains null after Publish.

## Step 14: Mobile Runtime Verification

- [ ] Trigger or wait for mobile app refresh after the server update.
- [ ] Android goods/event page should show the start-only event in list/calendar.
- [ ] Android detail page should show `종료 미정`.
- [ ] iOS goods/event page should show the start-only event in list/calendar.
- [ ] iOS detail page should show `종료 미정`.
- [ ] Confirm neither app treats the event as ended solely because current time is after `startsAt`.

Install verification:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:assembleDebug
rtk adb install -r app/build/outputs/apk/debug/app-debug.apk
```

```bash
rtk xcodebuild build -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

## Step 15: Full Verification

- [ ] Backend:

```bash
cd backend/stellive-hub-api
rtk npm run build
rtk npm test
```

- [ ] Android:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

- [ ] iOS:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

- [ ] Diff hygiene:

```bash
rtk git diff --check
rtk git status --short
```

## Acceptance Criteria

- [ ] Clearing `Ends at` in admin console sends `endsAt: null`.
- [ ] Backend update persists `endsAt = null`.
- [ ] Validate, Save draft, and Publish do not restore the old end time.
- [ ] Clearing all date fields from a published event still fails validation when policy requires a date window.
- [ ] Public `/v1/hub-events`, detail, calendar, summary, and widget APIs tolerate missing `endsAt`.
- [ ] Android list/calendar/detail/widget displays start-only events without deadline wording.
- [ ] iOS list/calendar/detail/widget displays start-only events without deadline wording.
- [ ] No Former members, Gangzi generation-member placement, official YouTube live events, unauthorized assets, secrets, raw private responses, or platform-policy bypasses are introduced.
- [ ] Notification preference resolution and `realtime_best_effort` behavior remain unchanged.

## Out Of Scope

- New admin fields unrelated to nullable edit semantics.
- Automatic event-ending heuristics for performances with unknown end time.
- Push delivery behavior changes.
- CHZZK, YouTube, X, or Naver adapter changes.
- New image, logo, poster, profile, fan art, screenshot, or copied media support.

## Commit

After all verification passes:

```bash
rtk git add backend/stellive-hub-api shared android/StelliveHubAndroid ios/StelliveHubiOS docs/superpowers/plans/2026-06-19-hub-event-null-end-time-admin-mobile-plan.md
rtk git commit -m "fix: support clearing hub event end time" -m "- Persist explicit null date fields from admin edits\n- Keep published start-only hub events visible across calendar projections\n- Render start-only goods/events correctly on Android and iOS"
```
