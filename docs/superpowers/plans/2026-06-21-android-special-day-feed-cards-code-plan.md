# Android Special-Day Feed Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render member birthday and generation anniversary calendar entries as cards in the Android 굿즈/행사 feed instead of silently dropping them when no canonical `HubEvent` exists.

**Architecture:** Keep the backend contract unchanged: `/v1/hub-events` returns canonical goods/events, while `/v1/hub-events/calendar` returns both hub-event entries and special-day entries. Fix Android by adding a small feed render projection that preserves non-`HUB_EVENT` calendar entries and only requires canonical `HubEvent` lookup for `HUB_EVENT` rows.

**Tech Stack:** Android Kotlin, existing `CalendarUiPolicy`, `MainActivity`, JUnit/Gradle unit tests. No backend, iOS, schema, or OpenAPI changes are required.

---

## Root Cause

The server has verified birthday data. For the screenshot date, `birthday:sakihane-huya` is registered as `member_birthday` on `7/7` in `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDayCatalog.ts`.

Android receives special-day rows through `ServerHubRepository.HubCalendarEntryDto.toCalendarEntryOrNull()`. The loss happens later in `MainActivity.renderServerGoodsEvents()`:

```kotlin
val eventsById = events.associateBy { it.id }
val feedEntries = CalendarUiPolicy.feedEntriesForMonth(monthDays, goodsEventsSelectedMonth)
feedEntries.forEach { row ->
    eventsById[row.entry.eventId]?.let { event ->
        binding.contentList.addView(hubEventCard(event))
    }
}
```

Special-day entries use IDs such as `birthday:sakihane-huya`; those IDs are not present in `/v1/hub-events`, so `eventsById[row.entry.eventId]` is `null` and no card is rendered.

## Files

Modify:

- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt`
- `docs/AI_HANDOFF.md`

Do not modify:

- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`
- `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDayCatalog.ts`
- `shared/schemas/domain.ts`
- `shared/openapi/openapi.yaml`
- Any image assets, logos, profile images, fan art, screenshots, secrets, or generated build outputs.

## Token-Minimizing Work Rules

- [ ] Prefix every shell command with `rtk`.
- [ ] Use `rtk rg -n "symbol"` to locate code, then read only exact ranges with `rtk sh -lc 'sed -n "start,endp" file'`.
- [ ] Avoid full-file reads for `MainActivity.kt`; inspect only `renderServerGoodsEvents`, `localCalendarEntryRow`, and imports.
- [ ] Prefer one focused Android test command before any broad build:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
```

- [ ] If a broader Android build is needed, run it only after the focused test is green:

```bash
rtk ./gradlew :app:assembleDebug
```

- [ ] Use `rtk git diff --stat`, `rtk git diff --name-only`, and file-scoped `rtk git diff -- <path>`; avoid pasting full diffs into handoff notes.
- [ ] Do not query or paste full backend JSON. If server verification is needed, print only selected fields: `date`, `eventId`, `entryKind`, `title`.
- [ ] Do not run iOS tests, backend tests, remote Docker rebuilds, or adb install unless the implementation unexpectedly touches those boundaries.
- [ ] Keep `docs/AI_HANDOFF.md` update to one compact paragraph with root cause, files changed, and focused verification result.

## Required Verification Scope

Run only the checks that match the changed surface.

Required:

- [ ] `rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest`
  - Covers the new render projection behavior.
  - Compiles the touched Android app sources, including `MainActivity.kt` and `CalendarUiPolicy.kt`.
- [ ] `rtk git diff --check`
  - Catches whitespace and patch formatting issues.
- [ ] `rtk git diff --stat`
  - Confirms the change stayed scoped to Android source/test, this plan, and optional handoff docs.

Conditional:

- [ ] `rtk ./gradlew :app:assembleDebug`
  - Run only if the implementer needs an installable APK, manual device verification, or the focused unit command passes but there is a packaging/resource concern.
- [ ] `rtk adb ... install/start`
  - Run only when an Android target is already connected and manual UI confirmation is explicitly desired.
- [ ] Minimal `/v1/hub-events/calendar` selected-field API query
  - Run only if the implementer suspects the target backend deployment is stale or missing special-day data.

Do not run for this task unless scope expands:

- [ ] Backend unit tests. The backend contract is unchanged and already has special-day projection coverage.
- [ ] iOS tests. No iOS files are touched.
- [ ] Full Android test suite. The change is isolated to `CalendarUiPolicy` behavior and `MainActivity` rendering compilation.
- [ ] Remote Docker rebuilds or backend deploys. No backend code changes are planned.

## Task 1: Confirm Current Android Drop Path

**Files:**

- Read only: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- Read only: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt`

- [ ] **Step 1: Locate the feed renderer**

```bash
rtk rg -n "renderServerGoodsEvents|eventsById|feedEntriesForMonth|localCalendarEntryRow" android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt
```

Expected: `MainActivity.renderServerGoodsEvents()` resolves every feed row through `eventsById[row.entry.eventId]`; `localCalendarEntryRow(entry)` exists but is not used in that loop.

- [ ] **Step 2: Read only the relevant ranges**

```bash
rtk sh -lc 'sed -n "548,606p" android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt'
rtk sh -lc 'sed -n "386,410p" android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt'
```

Expected: no backend or schema read is needed for implementation.

## Task 2: Add A Failing Render Projection Test

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt`
- Modify later: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt`

- [ ] **Step 1: Add the failing test**

Add this test near the existing `feedEntriesForMonthDeduplicatesByEventIdAndKeepsFirstVisibleDate` test:

```kotlin
@Test
fun feedRenderRowsKeepsSpecialDaysWithoutCanonicalHubEvent() {
    val birthday = birthdayEntry("birthday:sakihane-huya").copy(
        id = "birthday:sakihane-huya:2026-07-07",
        title = "사키하네 후야 생일",
        displayDate = "2026-07-07",
    )
    val hubEvent = calendarEntry("goods-event").copy(
        id = "goods-event:2026-07-07",
        title = "공식 굿즈",
        displayDate = "2026-07-07",
    )
    val canonicalEvent = hubEvent(
        id = "goods-event",
        title = "공식 굿즈",
    )

    val rows = CalendarUiPolicy.feedRenderRowsForMonth(
        days = listOf(HubCalendarDay("2026-07-07", listOf(birthday, hubEvent))),
        month = YearMonth.of(2026, 7),
        events = listOf(canonicalEvent),
    )

    assertEquals(listOf("birthday:sakihane-huya", "goods-event"), rows.map { it.entry.eventId })
    assertNull(rows.first { it.entry.eventId == "birthday:sakihane-huya" }.canonicalEvent)
    assertEquals(canonicalEvent, rows.first { it.entry.eventId == "goods-event" }.canonicalEvent)
}
```

- [ ] **Step 2: Add a small test helper if missing**

If `CalendarUiPolicyTest.kt` does not already have a `hubEvent()` helper, add this near the existing `calendarEntry()` helper:

```kotlin
private fun hubEvent(
    id: String,
    title: String = "공식 굿즈",
): HubEvent =
    HubEvent(
        id = id,
        category = HubEventCategory.ONLINE_GOODS,
        participationMode = HubEventParticipationMode.ONLINE,
        status = HubEventStatus.OPEN,
        title = title,
        generationId = "official",
        sourceUrl = "https://example.com/$id",
        sourceLabel = "공식",
        sourceType = HubEventSourceType.OFFICIAL,
        updatedAt = Instant.parse("2026-06-01T00:00:00Z"),
    )
```

If the file lacks imports for model types used above, add exact imports from `dev.stellive.hub.core.model`.

- [ ] **Step 3: Run the focused test and verify RED**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
```

Expected: compile failure because `CalendarUiPolicy.feedRenderRowsForMonth` and `canonicalEvent` do not exist yet.

## Task 3: Implement The Minimal Android Feed Render Projection

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt`

- [ ] **Step 1: Add the render row model**

Add this near `CalendarFeedEntry`:

```kotlin
data class CalendarFeedRenderRow(
    val day: HubCalendarDay,
    val entry: HubCalendarEntry,
    val canonicalEvent: HubEvent?,
)
```

Add `HubEvent` import if needed:

```kotlin
import dev.stellive.hub.core.model.HubEvent
```

- [ ] **Step 2: Add the projection helper**

Add this inside `object CalendarUiPolicy`, near `feedEntriesForMonth`:

```kotlin
fun feedRenderRowsForMonth(
    days: List<HubCalendarDay>,
    month: YearMonth,
    events: List<HubEvent>,
): List<CalendarFeedRenderRow> {
    val eventsById = events.associateBy { it.id }
    return feedEntriesForMonth(days, month)
        .mapNotNull { row ->
            val canonicalEvent = eventsById[row.entry.eventId]
            if (row.entry.entryKind == HubCalendarEntryKind.HUB_EVENT && canonicalEvent == null) {
                null
            } else {
                CalendarFeedRenderRow(
                    day = row.day,
                    entry = row.entry,
                    canonicalEvent = canonicalEvent,
                )
            }
        }
}
```

Add `HubCalendarEntryKind` import if needed:

```kotlin
import dev.stellive.hub.core.model.HubCalendarEntryKind
```

- [ ] **Step 3: Run the focused test and verify GREEN**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
```

Expected: PASS.

## Task 4: Use The Projection In MainActivity

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`

- [ ] **Step 1: Replace local `eventsById` rendering**

In `renderServerGoodsEvents(days, events)`, replace:

```kotlin
val eventsById = events.associateBy { it.id }
val feedEntries = CalendarUiPolicy.feedEntriesForMonth(monthDays, goodsEventsSelectedMonth)
var previousHeader: String? = null
feedEntries.forEach { row ->
    val header = calendarDayHeaderText(row.day)
    if (header != previousHeader) {
        binding.contentList.addView(calendarDayHeader(header))
        previousHeader = header
    }
    eventsById[row.entry.eventId]?.let { event ->
        binding.contentList.addView(hubEventCard(event))
    }
}
```

with:

```kotlin
val feedRows = CalendarUiPolicy.feedRenderRowsForMonth(
    days = monthDays,
    month = goodsEventsSelectedMonth,
    events = events,
)
var previousHeader: String? = null
feedRows.forEach { row ->
    val header = calendarDayHeaderText(row.day)
    if (header != previousHeader) {
        binding.contentList.addView(calendarDayHeader(header))
        previousHeader = header
    }
    row.canonicalEvent?.let { event ->
        binding.contentList.addView(hubEventCard(event))
    } ?: binding.contentList.addView(localCalendarEntryRow(row.entry))
}
```

This keeps existing `HubEvent` cards for canonical events and uses the existing compact calendar-entry card for birthdays and anniversaries.

- [ ] **Step 2: Confirm no new detail-navigation behavior is introduced**

Do not change `HubCalendarDeepLinkPolicy` or `renderHubEventDetail()` in this task. Special-day cards should display in the feed, but tapping behavior is not expanded unless explicitly requested later.

- [ ] **Step 3: Run the focused test again**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
```

Expected: PASS.

## Task 5: Optional Manual Local API Check With Minimal Output

**Files:** none.

Run this only if the implementer needs to confirm the local or remote server still emits special-day rows. Do not paste full JSON.

- [ ] **Step 1: Query selected fields only**

```bash
rtk node -e "const r=await fetch('http://192.168.50.9:4000/v1/hub-events/calendar?from=2026-07-01T00:00:00.000Z&to=2026-07-31T23:59:59.999Z&timezone=Asia/Seoul&entryKind=member_birthday'); const d=await r.json(); console.log(d.days.flatMap(day=>day.entries.map(e=>({date:day.date,eventId:e.eventId,entryKind:e.entryKind,title:e.title}))).filter(e=>e.date==='2026-07-07'))"
```

Expected: one row similar to:

```text
{ date: '2026-07-07', eventId: 'birthday:sakihane-huya', entryKind: 'member_birthday', title: '사키하네 후야 생일' }
```

Skip this step if the internal server is unavailable; the backend unit contract already covers special-day projection.

## Task 6: Required And Conditional Verification

**Files:** none.

- [ ] **Step 1: Run the required focused unit test**

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
```

Expected: PASS. This is the only required Gradle test for this task because it verifies the new projection and compiles the touched Android sources.

- [ ] **Step 2: Run required patch checks**

```bash
rtk git diff --check
rtk git diff --stat
```

Expected: no whitespace errors; scoped file list.

- [ ] **Step 3: Conditionally run Android debug build**

Run this only if an APK is needed for manual install or if there is a packaging/resource concern after source changes.

```bash
rtk ./gradlew :app:assembleDebug
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Conditionally install only if a target device is already available**

Skip this when the focused unit test and patch checks are enough for handoff.

```bash
rtk adb devices
rtk adb -s <device-id> install -r android/StelliveHubAndroid/app/build/outputs/apk/debug/app-debug.apk
rtk adb -s <device-id> shell am start -n dev.stellive.hub/.MainActivity
```

Expected: app launches; 굿즈/행사 July 2026 feed shows a `사키하네 후야 생일` compact card under `2026-07-07`.

## Task 7: Policy And Diff Checks

**Files:** none.

- [ ] **Step 1: Check prohibited policy regressions**

```bash
rtk rg -n "Former|youtube_live_scheduled|youtube_live_started|youtube_live_ended|profileImageUrl|posterUrl|logoUrl|rawPayload|providerResponse|NID_AUT|NID_SES|login-cookie|cookie scraping" android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub docs/superpowers/plans/2026-06-21-android-special-day-feed-cards-code-plan.md
```

Expected: no new prohibited implementation paths.

- [ ] **Step 2: Check whitespace and changed files if not already done in Task 6**

```bash
rtk git diff --check
rtk git diff --stat
rtk git diff --name-only
```

Expected: only the Android source/test file, this plan, and optional `docs/AI_HANDOFF.md` are related to this task. Do not include generated Gradle outputs. If `rtk git diff --check` and `rtk git diff --stat` already ran in Task 6 after the final edit, do not rerun them.

## Task 8: Handoff Update

**Files:**

- Modify: `docs/AI_HANDOFF.md`

- [ ] **Step 1: Add one compact paragraph**

Append a short note:

```markdown
## Android Special-Day Feed Cards

Root cause: Android Goods/Events feed resolved every calendar row through canonical `/v1/hub-events` IDs, so `member_birthday` and `generation_anniversary` rows such as `birthday:sakihane-huya` were dropped. Fix: `CalendarUiPolicy.feedRenderRowsForMonth()` keeps special-day rows without canonical `HubEvent` and `MainActivity.renderServerGoodsEvents()` renders them with `localCalendarEntryRow()`. Verification: `rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest` passed; `rtk ./gradlew :app:assembleDebug` passed if performed.
```

Keep this update factual. Do not paste full diffs, backend JSON, screenshots, or device logs.

## Task 9: Commit

**Files:**

- Commit only relevant files.

- [ ] **Step 1: Stage scoped files**

```bash
rtk git add android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/CalendarUiPolicyTest.kt docs/AI_HANDOFF.md docs/superpowers/plans/2026-06-21-android-special-day-feed-cards-code-plan.md
```

- [ ] **Step 2: Commit with consecutive body bullets**

```bash
rtk sh -lc "printf '%s\n' 'fix: render Android special-day feed cards' '- Preserve birthday and anniversary calendar rows without canonical HubEvent records' '- Render special-day rows with the existing compact calendar-entry card' '- Add focused CalendarUiPolicy coverage for special-day feed render rows' > /private/tmp/commit_msg && rtk git commit -F /private/tmp/commit_msg"
```

## Self-Review Checklist

- [ ] The plan does not ask for backend, iOS, schema, OpenAPI, or asset changes.
- [ ] The plan adds a RED test before implementation.
- [ ] The implementation keeps canonical `HubEvent` rendering for normal goods/events.
- [ ] The implementation renders `member_birthday` and `generation_anniversary` without requiring `/v1/hub-events` rows.
- [ ] The token-minimizing rules avoid broad file reads, full JSON dumps, unnecessary platform tests, and noisy diffs.
