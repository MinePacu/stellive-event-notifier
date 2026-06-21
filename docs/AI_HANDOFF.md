# AI Handoff

## CHZZK Live API Current Status

- Backend CHZZK live polling uses the official Client-authenticated live-list flow: `GET /open/v1/lives` with `Client-Id` and `Client-Secret` headers.
- It no longer polls `GET /open/v1/lives/{channelId}` and does not use Bearer OAuth access tokens for live polling.
- `ChzzkApiClient` requests live-list pages with `size=20`, accepts `message: null` success responses, and matches returned `channelId` values against catalog `chzzkChannelId`.
- A valid live list that omits a catalog channel is treated as verified offline, not `verify_required`.
- OAuth routes remain separate. `CHZZK_OAUTH_SCOPES` and OAuth token metadata are not required for Client-authenticated live-list polling.
- Android and iOS consume normalized backend DTOs from `/v1/bootstrap` and `/v1/live-status`; they must not call CHZZK directly or store CHZZK credentials.
- Verification on 2026-06-15: local focused tests passed with 5 files and 52 tests; local build passed; remote API container rebuilt; remote scheduler returned `checked=11`, `updated=11`, `verifyRequired=0`; remote adapter health returned `status=enabled`, `reason=chzzk_live_api_verified`; remote public secret-pattern checks passed for `/health`, `/v1/bootstrap`, and `/v1/live-status`; remote focused tests and build passed.

## CHZZK Live API Wiring Status

- Backend CHZZK live polling now uses the official Client-authenticated Open API live-list flow: `GET /open/v1/lives` with `Client-Id` and `Client-Secret` headers. It no longer polls `GET /open/v1/lives/{channelId}` and does not use Bearer OAuth access tokens for live polling.
- `ChzzkApiClient` pages through live-list results and matches response `channelId` values against catalog `chzzkChannelId`. A valid live-list response without a matching row is treated as verified offline, not `verify_required`.
- OAuth routes remain available for future user-authorized CHZZK endpoints and manual connection testing, but OAuth scope/token metadata is not required for the live-list polling path.
- Keep CHZZK credentials backend-only. Android and iOS consume normalized backend DTOs from `/v1/bootstrap` and `/v1/live-status`; they must not call CHZZK directly or store CHZZK credentials.
- Local verification on 2026-06-15: `rtk npm test -- chzzkApiClient chzzkClientAuthLiveList chzzkOpenApiAdapter chzzkLiveApiWiring adminInternalRoutes` passed with 5 files and 52 tests; `rtk npm run build` passed.
- Remote verification still needs to be run after copying the source changes to `minepacu@192.168.50.9:~/StelLiveNoti`, rebuilding the API container, and calling `POST /v1/internal/schedulers/chzzk/live-status` with `INTERNAL_API_TOKEN`.

## Hub Event Image Policy Status

GitHub issue `#19` and GitLab work item `#13` image policy work is implemented as metadata-only support.

Implemented:
- `shared/schemas/domain.ts` defines `HubEventImagePolicyState`, `HubEventImage`, and optional `HubEvent.image`.
- Backend admin policy validates displayable image metadata, rejects non-HTTPS image/source URLs, and rejects nested binary/local asset fields such as `bytes`, `base64`, `assetPath`, `filePath`, and `localPath`.
- Prisma `HubEvent` stores image metadata as nullable `Json`; repository mapping normalizes and strips unknown image fields before public/admin DTO output.
- `/v1/hub-events` list/detail responses can include optional `image`; calendar/widget entries intentionally omit image metadata.
- Push payload tests confirm HubEvent image metadata is not included in FCM data payloads.
- Android domain model and `HubEventImagePolicy` support optional image metadata and display only `official_runtime_url` or `third_party_allowed` HTTPS URLs.
- iOS domain model and `HubEventImagePolicy` support optional image metadata and display only `official_runtime_url` or `third_party_allowed` HTTPS URLs.
- OpenAPI and docs describe the metadata-only contract and image-free calendar/widget/push behavior.

Verification completed:
- `rtk npm run prisma:generate` in `backend/stellive-hub-api`
- `rtk npm run build` in `backend/stellive-hub-api`
- `rtk npm test` in `backend/stellive-hub-api` passed: 27 files, 252 tests.
- `rtk ./gradlew :app:testDebugUnitTest` in `android/StelliveHubAndroid` passed.
- `rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'` passed before moving the new iOS image policy assertions into the existing included test file. A fresh rerun after that move was blocked by the execution environment usage limit on escalated commands.

Known follow-up:
- Re-run the iOS test command above when escalation is available to verify the newly added `HubEventImagePolicy` assertions in `HubCalendarPolicyTests.swift`.
- The current Android UI remains text-first and does not add a remote image slot; this preserves the required image-free fallback. Add remote image rendering separately only if product explicitly wants visible images in cards/details.


## Hub Event Admin CRUD Status

Backend admin CRUD for `굿즈/행사` schedules is implemented on `/v1/admin/hub-events*` with admin session or `ADMIN_CONSOLE_TOKEN` authentication. It supports draft create/update, publish, cancel, deactivate, soft delete, validation, audit logs, and an `/admin` console section. Do not add image upload inputs or copied media fields.

Public hub event reads use `HUB_EVENTS_STORAGE_MODE=memory` by default. Set `HUB_EVENTS_STORAGE_MODE=prisma` only after applying the Prisma migration; Prisma mode returns published, non-deleted `HubEvent` rows.

Admin publish/update/cancel actions enqueue normalized `hub_event` notification candidates through `PlatformEvent` and `NotificationJob`; they do not send push directly and must still pass through preference resolution and delivery policy.

Current branch `feat/hub-event-notification-worker` adds backend notification job draining for HubEvent changes: `NotificationWorker`, `pushPayloadFactory`, disabled-safe `fcmClient`, `FcmPushSender`, worker repository methods, and `/v1/internal/jobs/notifications/drain` worker delegation. It records device-level delivery attempts for sent/skipped/failed decisions and keeps push payloads limited to normalized event IDs, type, generation/member IDs, tap action, deep link, and source URL.

Copy this prompt into another Codex, ChatGPT, Copilot, or AI coding session before continuing work.

## Project Summary

Build an unofficial open-source Stellive notification hub with Android, iOS, and a lightweight TypeScript backend/control plane. The backend mediates external platform events, normalizes/deduplicates them, resolves user notification preferences, and sends pushes. Managed services or local Docker PostgreSQL may provide storage, scheduled jobs, and push infrastructure. Mobile apps provide settings, user-visible notification history, live status, foreground refresh, deep links, and local cache.

## Non-negotiable Rules

Former members are excluded from the MVP. No unauthorized images, official logos, fan art, captured images, secrets, private cafe scraping, login-cookie scraping, or platform terms bypasses. Prefer official APIs. Use placeholders and official API image URLs only with fallback behavior.

## Architecture Summary

API-first lightweight control plane with adapters for CHZZK, optional no-paid-API X support, and YouTube. Naver Cafe automatic collection is deferred. The MVP default path should not require self-hosted PostgreSQL/Redis, but Docker Compose is supported for local development and optional self-hosting. Use managed storage or local Docker PostgreSQL for devices, server-visible preferences, normalized events, dedupe keys, notification jobs, short-lived delivery attempts, live status, and delivery state. User-visible notification history is stored on device by default. Start the managed-first path with database-backed jobs; add Redis/BullMQ only if traffic requires it. Mobile foreground refresh is for UI updates, not background push replacement.

The `굿즈/행사` feed is planned as a separate hub event model for official-source, time-bound goods, ticketing, and offline event information. It excludes routine livestreams, uploads, ordinary posts, fan-hosted events, Gangzi/representative events, and unauthorized images/logos/posters.

For backend/API implementation work, use `docs/API_IMPLEMENTATION_PLAN.md` as the primary structure and sequencing reference before changing adapters, ingestion, database jobs, push delivery, or mobile-facing API contracts.

## Member Catalog Policy

Catalog entries are only `active` or `upcoming`. Former entries are not seeded. Unknown external handles stay `verify_required`.

## Gamja Category Policy

Gangzi is included as `catalogRole=representative`, `generationId=gamja`, `generationName=감자`, `roleLabel=스텔라이브 대표`. Do not place Gangzi in member generations.

## Official Channel Policy

The `official` category displays as `기타` and includes the Stellive official YouTube channel and X account. The official item is not a person.

## Asset/Image Policy

Repository assets must not include member/profile images, official logos, fan art, captured images, or copied CDN URLs. Use app-owned placeholder avatars and runtime API image URLs only when policy allows.

## Notification Policy

Support global, generation/category, individual item, platform, event type, generation-platform, generation-event-type, member-platform, and member-event-type preferences. Global off always wins. Individual explicit overrides can override generation/category settings. Quiet hours, keyword block, and rate limit always apply.

Notification load reduction is documented in `docs/NOTIFICATION_LOAD_REDUCTION_POLICY.md`. Future backend, Android, and iOS notification work must preserve the three delivery levels, spike downgrade controls, Android channel/group/update behavior, iOS thread/collapse/cleanup behavior, and the future 10-minute push cap consideration.

## Realtime Delivery Policy

`realtime_best_effort` is best-effort and never guaranteed. It applies only to allowed and realtime-eligible events such as CHZZK live started, X posts, YouTube uploads, official X posts, and official YouTube uploads. Naver Cafe is deferred; if reintroduced, it falls back to standard.

## Preference Resolution Policy

Resolve notification permission first, then resolve delivery mode. Realtime mode does not enable disabled notifications. Official YouTube live events are excluded before notification resolution.

## API/Secrets Policy

Secrets live only in environment variables. `.env.example` may name keys but must not include real values.

## CHZZK Open API Status

Backend OAuth, token metadata storage, live-status polling, live started/ended transition generation, repository-backed `/v1/live-status`, and the internal scheduler trigger are implemented on `codex/chzzk-open-api-code-implementation`. Main files are `chzzkAuthClient.ts`, `chzzkOAuthState.ts`, `chzzkApiClient.ts`, `chzzkOpenApiAdapter.ts`, `chzzkAuthRoutes.ts`, `internalRoutes.ts`, and `liveStatusRepository.ts` under `backend/stellive-hub-api/src`.

Android and iOS boundary tests enforce that CHZZK credentials and direct CHZZK hosts stay out of app source. Mobile apps consume normalized backend DTOs only.

Rollout tracking should update GitHub issue `#13` and GitLab work item `#8` with verification output, OAuth setup status, scheduler enablement status, and platform review notes before production enablement.

Remaining operational checks: register `https://<backend-public-origin>/v1/auth/chzzk/callback` and `http://localhost:4000/v1/auth/chzzk/callback`, set backend-only CHZZK OAuth environment variables, connect OAuth through `/v1/auth/chzzk/connect`, confirm token metadata exists in `PlatformApiState`, run `POST /v1/internal/schedulers/chzzk/live-status` with `INTERNAL_API_TOKEN`, then enable `CHZZK_LIVE_POLLING_ENABLED=true` only after adapter health and live-status cache freshness are verified.

## Current TODOs

- Verify latest official platform account IDs/handles from official sources.
- Replace mock adapters with official API integrations. X must remain disabled unless a no-cost official API path is confirmed.
- Connect Firebase projects for Android/iOS.
- Choose the first managed storage provider and database-backed job implementation.
- Keep Docker Compose working as a local development/self-hosting option.
- Add production authentication for preference sync and optional foreground refresh.
- Add admin tooling for avatar placeholder enforcement and catalog reloads.
`굿즈/행사` calendar implementation has started. Backend now exposes `GET /v1/hub-events/calendar` and `GET /v1/hub-events/widget-snapshot` as read-only projections of normalized `HubEvent` records, and bootstrap config exposes `hubCalendarEnabled: true` with X notifications disabled for MVP via `x_notifications_dropped_for_mvp`. Android and iOS now have shared calendar/widget DTOs and policy helpers for status ordering, date headers, and stale/empty widget text. Continue UI wiring from the existing Goods Events surfaces; do not add logos, posters, profile images, thumbnails, copied media, raw provider payloads, or direct widget platform API calls.

Follow-up implementation update: Android `MockHubRepository` now derives `HubCalendarDay` and `HubCalendarWidgetSnapshot` from existing `HubEvent` seed data, the Goods Events tab renders date-grouped calendar sections, and a standard `AppWidgetProvider` + RemoteViews widget is registered. iOS `MockHubStore` now derives calendar days and widget snapshots, `HubEventsView` renders date-grouped sections, and `HubCalendarWidgetStore` persists compact snapshots through the `group.dev.stellive.hub` app group. `StelliveHubCalendarWidget` is now wired as a WidgetKit extension target, embedded in the app target, and verified with simulator tests plus a widget scheme build.
## Mobile API Backend Status

`shared/schemas/mobileApi.ts` now defines the mobile bootstrap, device registration, push token, and preference DTOs. `backend/stellive-hub-api/src/routes/appRoutes.ts` owns the mobile-facing routes and is delegated from `routes.ts`. `DeviceRepository`, `PreferenceRepository`, and `BootstrapService` provide repository/service boundaries for server-mediated mobile communication. Backend verification passed with `rtk npm run build` and `rtk npm test` from `backend/stellive-hub-api`.
## HubEvent Read API Contract Status

GitHub issue `#18` and GitLab work item `#12` are implemented as public HubEvent read API contract work.
`backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts` owns `/v1/hub-events`, `/v1/hub-events/:id`, `/v1/hub-events/calendar`, `/v1/hub-events/widget-snapshot`, and `/v1/hub-events/summary` route registration and query validation.
`backend/stellive-hub-api/test/hubEventReadRoutes.test.ts` covers list/detail/calendar/widget responses, invalid enum/date query errors, missing detail ids, allowed generation ids, and missing-image tolerance.
Calendar/widget DTOs are shared from `shared/schemas/domain.ts`; Android and iOS `HubCalendarEntry` models include `platformUrl`.
`shared/openapi/openapi.yaml` now documents public HubEvent list/detail/calendar/widget paths, `HubEventListResponse`, `HubEventQueryError`, and `HubCalendarEntry.platformUrl`.
## Hub Calendar Special Days Status

GitHub issue `#28` and GitLab work item `#15` track member birthday and generation anniversary support for the goods/events calendar. `docs/HUB_EVENT_ANNIVERSARY_CALENDAR_DESIGN.md` and `docs/HUB_EVENT_ANNIVERSARY_CALENDAR_CODE_DESIGN.md` define the feature and code plan. Initial implementation adds `HubCalendarEntry.entryKind`, optional `specialDayKind`, optional `specialDayLabel`, and optional `platformUrl` in `shared/schemas/domain.ts`.

Backend `hubCalendarSpecialDays.ts` projects verified catalog special days into read-only calendar entries and keeps them out of `PlatformEvent`, `NotificationJob`, push payloads, realtime streams, and notification history. `hubEventReadRoutes.ts` accepts `includeSpecialDays` and `entryKind` query parameters and can receive `hubCalendarSpecialDays` through app route dependencies.

Production special-day seed data now includes the 10 verified active member birthdays from the official Stellive talent profiles in `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDayCatalog.ts`. Gen1 anniversary and Gangzi birthday remain excluded until an allowed source is confirmed and explicitly approved. No Former members, official channel anniversaries, images, logos, or copied media were added.
Latest verification on this branch: backend `rtk npm run build` and `rtk npm test` passed with 28 files and 260 tests; iOS `test_sim` passed on `iPhone 17` with 38 tests; Android `rtk ./gradlew testDebugUnitTest --tests dev.stellive.hub.CalendarWidgetTextFormatterTest --tests dev.stellive.hub.CalendarUiPolicyTest` and full `rtk ./gradlew testDebugUnitTest` passed from `android/StelliveHubAndroid`.
## Hub Calendar Special Day Yearly Materialization

Special day yearly materialization uses `POST /v1/internal/schedulers/hub-events/special-days/materialize-year` with `Authorization: Bearer <INTERNAL_API_TOKEN>`. The request may omit `targetYear` to use the current `Asia/Seoul` year, or pass `targetYear` for manual backfill; `dryRun` is supported for non-writing checks.

Schedule the production job for January 1 00:05 `Asia/Seoul` or later. The endpoint is idempotent and upserts by `specialDayId + displayYear`, so repeated scheduler calls are acceptable.

Apply the Prisma migration for `HubCalendarSpecialDayOccurrence` and run Prisma generate before enabling DB occurrence reads in a deployed Prisma-backed environment. After migration, call the endpoint once for the current KST year to backfill current-year birthdays/anniversaries.

Verification commands from `backend/stellive-hub-api`: `rtk npm test -- hubCalendarSpecialDayMaterializer adminInternalRoutes hubEventCalendar hubEventReadRoutes`, `rtk npm run build`, and `rtk npm test`. Do not write real admin tokens, internal API tokens, credentials, raw provider payloads, member images, official logos, or copied media into docs, commits, or logs.

## Calendar Event Display Visibility Status

Linked issues: GitHub `#46`, GitHub `#47`, GitLab work items `#24`, `#25`.

Implementation branch: `calendar-event-display-46-47-24-25-plan`.

Plan document: `docs/superpowers/plans/2026-06-21-calendar-event-display-visibility-code-design.md`.

Implemented:
- Android `CalendarUiPolicy` now derives multi-day span kind, event dot size/emphasis/count text, row status text, and multi-day accessibility hints from existing `HubCalendarEntry` fields.
- Android `HubEventsCalendarView` renders a secondary multi-day bar and larger/stronger event dot or compact count marker without changing calendar DTOs.
- iOS `HubEventsCalendarViewModel` now derives multi-day span kind, event dot style, row status/range text, and multi-day accessibility hints from existing `HubCalendarEntry` fields.
- iOS `HubEventsCalendarView` passes derived dot/multi-day state into `CalendarDateCell` and renders a secondary multi-day bar plus larger/stronger dot/count marker.
- No backend ingestion, push notification, external API, catalog, asset, or schedule creation behavior changed.

Verification:
- Android RED: `rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest` failed before implementation because the new policy helpers did not exist.
- Android focused GREEN: `rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest --tests dev.stellive.hub.HubEventsCalendarViewModelTest` passed.
- Android broad GREEN: `rtk ./gradlew :app:testDebugUnitTest` passed.
- iOS RED: `rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests` failed before implementation because `spanKind` and `dotStyle` did not exist.
- iOS focused GREEN: same focused XCTest command passed on `iPhone 17 Pro` simulator ID `89B0B46A-8515-47E7-A122-681498F16C66`.
- Contract check: `rtk rg -n "startsAt|endsAt|displayDate|displayTimeText|HubCalendarEntry" shared/schemas/domain.ts shared/openapi/openapi.yaml backend/stellive-hub-api/src/hub-events backend/stellive-hub-api/test` confirmed the calendar DTO path exposes fields used by local span display.
- Policy grep: `rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|profileImageUrl|posterUrl|logoUrl|rawPayload|providerResponse|NID_AUT|NID_SES|login-cookie|cookie scraping" android ios docs/superpowers/plans/2026-06-21-calendar-event-display-visibility-code-design.md` matched existing policy/model/test references and explicit exclusions only.

Known verification gap:
- iOS broad test command `rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66"` failed in existing `PreferenceStateTests.testIOSPrimaryNavigationMovesSettingsToToolbarAndAddsHubEventsTab`: actual primary navigation IDs were `["live", "hubEvents", "home"]`, expected `["home", "hubEvents"]`. This failure is outside the calendar display files changed here.
- The plan referenced `iPhone 16`, but this machine did not have an `iPhone 16` simulator. Focused iOS verification used the available booted `iPhone 17 Pro` simulator instead.

## Calendar Duration Bars And Start-Only Event Rollover Status

Plan document: `docs/superpowers/plans/2026-06-21-calendar-duration-bars-stacking-code-design.md`.

Implemented:
- Android `CalendarUiPolicy` now builds visible-grid-clipped, week-split, lane-stacked duration bar segments from existing `HubCalendarEntry.startsAt` and `endsAt` fields.
- Android `HubEventsCalendarView` renders duration bars per visible week row, including leading and trailing adjacent-month cells, and event card dates display a period when `endsAt` exists.
- Android detail formatting no longer shows `종료 미정` for start-only hub events.
- iOS `HubEventsCalendarViewModel` now builds matching duration bar layout data for the selected visible month grid.
- iOS `HubEventsCalendarView` renders stacked duration bars per visible week row, including adjacent-month cells, and event card dates display a period when `endsAt` exists.
- iOS detail formatting no longer shows `종료 미정` for start-only hub events.
- Backend status reconciliation now treats `endsAt == null` hub events as ended after their Korea-date start/display day rolls over, and exposes `startOnlyEnded` in reconciliation results.
- `HubEventStatusReconcileWorker` now schedules the next reconciliation at the next `Asia/Seoul` midnight boundary.

Verification:
- Backend focused GREEN: `rtk npm test -- hubEventStatus` passed, 3 files / 7 tests.
- Backend focused GREEN: `rtk npm test -- adminInternalRoutes` passed, 1 file / 43 tests.
- Backend build GREEN: `rtk npm run build` passed.
- Backend broad GREEN: `rtk npm test` passed, 36 files / 313 tests.
- Contract check: `rtk rg -n "HubCalendarEntry|startsAt|endsAt|displayDate|displayTimeText" shared/schemas/domain.ts shared/openapi/openapi.yaml backend/stellive-hub-api/src/hub-events backend/stellive-hub-api/test` confirmed existing DTO fields support local duration layout; no shared/mobile DTO shape change was needed.
- Policy grep: `rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|profileImageUrl|posterUrl|logoUrl|rawPayload|providerResponse|NID_AUT|NID_SES|login-cookie|cookie scraping" android ios backend/stellive-hub-api/src backend/stellive-hub-api/test docs/superpowers/plans/2026-06-21-calendar-duration-bars-stacking-code-design.md` matched existing policy/model/test references and explicit exclusions only.

Known verification gap:
- Android focused test `rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest` could not run in sandbox because Gradle wrapper needed `/Users/nohyunsoo/.gradle/.../gradle-9.0.0-bin.zip.lck` write access. Escalated retry was rejected by policy, so Android post-implementation tests remain unverified in this session.
- iOS focused test `rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests` could not run in sandbox because CoreSimulator access was unavailable and the simulator destination could not be resolved. Escalated retry was rejected by policy, so iOS post-implementation tests remain unverified in this session.

Follow-up device verification:
- iOS build/install/run GREEN: XcodeBuildMCP `build_run_sim` succeeded on booted `iPhone 17 Pro` simulator `89B0B46A-8515-47E7-A122-681498F16C66`; app path `/Users/nohyunsoo/Library/Developer/XcodeBuildMCP/workspaces/StelLiveNoti-05b02c56ff42/DerivedData/StelliveHubiOS-6035de198454/Build/Products/Debug-iphonesimulator/StelliveHubiOS.app`, bundle id `dev.stellive.hub`, process id `97204`.
- iOS runtime UI snapshot and screenshot capture succeeded; screenshot path `/var/folders/sr/67htrnl50s993g5t4qcktcg80000gn/T/screenshot_optimized_44c23b09-17c9-44d7-837d-18329d45cd4b.jpg`.
- Android build/install/run GREEN after explicit user approval: `rtk ./gradlew :app:assembleDebug` passed, `rtk adb devices` found `100.76.105.15:44105`, `rtk adb -s 100.76.105.15:44105 install -r android/StelliveHubAndroid/app/build/outputs/apk/debug/app-debug.apk` returned `Success`, and `rtk adb -s 100.76.105.15:44105 shell am start -n dev.stellive.hub/.MainActivity` launched the app.
- Android runtime verification: package `dev.stellive.hub` is installed, resolved activity is `dev.stellive.hub/.MainActivity`, process id `13322` was observed after launch, foreground window showed `dev.stellive.hub/dev.stellive.hub.MainActivity`, and crash buffer was empty after clearing old unrelated crash entries.

Follow-up date-range title fix:
- Android and iOS now render multi-day hub event date titles as client-formatted date-only ranges such as `2026-06-26~2026-07-12`; server timestamps remain unchanged and times are omitted only in the client title formatter.
- Android day-mode list navigation title uses the single visible multi-day event's period range when exactly one event is shown; multiple events keep the selected day title to avoid ambiguous representative ranges.
- iOS day navigation title and list title use the same single-visible-event period range behavior.
- Android feed day headers now prefer a visible duration entry's client-formatted date range over raw `day.date`, so image-card sections such as `SIX STAR STELLIVE` show `2026-06-26~2026-07-12` instead of `2026-06-26`.
- iOS feed sections now apply the same duration-entry header rule instead of using raw `day.date`.
- Android focused GREEN: `rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest` passed after adding a range-title formatter test.
- Android focused GREEN: `rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest` passed again after feed header wiring changes. A parallel `assembleDebug` attempt hit Kotlin incremental cache contention; rerunning `assembleDebug` alone passed.
- Android simplified build/install/run GREEN: `rtk ./gradlew :app:assembleDebug` passed, `rtk adb -s 100.76.105.15:44105 install -r android/StelliveHubAndroid/app/build/outputs/apk/debug/app-debug.apk` returned `Success`, `rtk adb -s 100.76.105.15:44105 shell am start -n dev.stellive.hub/.MainActivity` started the activity, and `pidof` returned `18760`.
- iOS build/run GREEN: XcodeBuildMCP `build_run_sim` succeeded on `iPhone 17 Pro` simulator `89B0B46A-8515-47E7-A122-681498F16C66`, bundle id `dev.stellive.hub`, process id `4965`.
