package dev.stellive.hub

import dev.stellive.hub.core.model.HubCalendarDay
import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubCalendarEntryKind
import dev.stellive.hub.core.model.HubCalendarSpecialDayKind
import dev.stellive.hub.core.model.HubCalendarWidgetSnapshot
import dev.stellive.hub.core.model.HubEventCategory
import dev.stellive.hub.core.model.HubEventParticipationMode
import dev.stellive.hub.core.model.HubEventStatus
import dev.stellive.hub.feature.calendar.CalendarDateMarker
import dev.stellive.hub.feature.calendar.CalendarUiPolicy
import dev.stellive.hub.feature.calendar.HubCalendarScopeMode
import java.time.Instant
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CalendarUiPolicyTest {
    @Test
    fun sortsActionableHubEventsBeforeBirthdaysAndEndedItems() {
        val entries = listOf(
            calendarEntry("ended", HubEventStatus.ENDED),
            birthdayEntry("birthday"),
            calendarEntry("closing", HubEventStatus.CLOSING_SOON),
            calendarEntry("open", HubEventStatus.OPEN),
        )

        assertEquals(
            listOf("closing", "open", "birthday", "ended"),
            entries.sortedWith(CalendarUiPolicy.entryComparator).map { it.eventId },
        )
    }

    @Test
    fun formatsSpecialDayEntryLabels() {
        assertEquals("생일", CalendarUiPolicy.entryLabel(birthdayEntry("birthday")))
        assertEquals("마감 임박", CalendarUiPolicy.entryLabel(calendarEntry("closing", HubEventStatus.CLOSING_SOON)))
    }

    @Test
    fun formatsDateHeaders() {
        val today = LocalDate.of(2026, 6, 11)

        assertEquals("오늘", CalendarUiPolicy.dateHeaderText(today, now = today))
        assertEquals("내일", CalendarUiPolicy.dateHeaderText(today.plusDays(1), now = today))
        assertEquals("2026.06.13", CalendarUiPolicy.dateHeaderText(LocalDate.of(2026, 6, 13), now = today))
    }

    @Test
    fun formatsTimeWindowText() {
        assertEquals("10:00 시작", CalendarUiPolicy.timeWindowText(calendarEntry("open", displayTimeText = "10:00 시작")))
    }

    @Test
    fun detectsStaleWidgetSnapshot() {
        val snapshot = HubCalendarWidgetSnapshot(
            generatedAt = Instant.parse("2026-06-11T00:00:00Z"),
            timezone = "Asia/Seoul",
            entries = emptyList(),
            staleAfter = Instant.parse("2026-06-11T06:00:00Z"),
        )

        assertFalse(CalendarUiPolicy.isWidgetSnapshotStale(snapshot, Instant.parse("2026-06-11T05:59:59Z")))
        assertTrue(CalendarUiPolicy.isWidgetSnapshotStale(snapshot, Instant.parse("2026-06-11T06:00:00Z")))
    }

    @Test
    fun normalizesDateRanges() {
        val start = LocalDate.of(2026, 6, 17)
        val end = LocalDate.of(2026, 6, 15)

        assertEquals(LocalDate.of(2026, 6, 15)..LocalDate.of(2026, 6, 17), CalendarUiPolicy.normalizeRange(start, end))
        assertNull(CalendarUiPolicy.normalizeRange(start, null))
    }

    @Test
    fun filtersEntriesForSelectedDay() {
        val days = listOf(
            HubCalendarDay("2026-06-15", listOf(calendarEntry("open", HubEventStatus.OPEN))),
            HubCalendarDay("2026-06-16", listOf(calendarEntry("upcoming", HubEventStatus.UPCOMING))),
        )

        assertEquals(listOf("open"), CalendarUiPolicy.entriesForDay(days, LocalDate.of(2026, 6, 15)).map { it.eventId })
        assertEquals(emptyList<String>(), CalendarUiPolicy.entriesForDay(days, LocalDate.of(2026, 6, 17)).map { it.eventId })
    }

    @Test
    fun filtersEntriesForInclusiveRangeInDisplayOrder() {
        val days = listOf(
            HubCalendarDay("2026-06-15", listOf(calendarEntry("upcoming", HubEventStatus.UPCOMING))),
            HubCalendarDay("2026-06-16", listOf(calendarEntry("closing", HubEventStatus.CLOSING_SOON))),
            HubCalendarDay("2026-06-17", listOf(calendarEntry("open", HubEventStatus.OPEN))),
            HubCalendarDay("2026-06-18", listOf(calendarEntry("ended", HubEventStatus.ENDED))),
        )

        val entries = CalendarUiPolicy.entriesForRange(
            days,
            LocalDate.of(2026, 6, 17),
            LocalDate.of(2026, 6, 15),
        )

        assertEquals(listOf("closing", "open", "upcoming"), entries.map { it.eventId })
    }

    @Test
    fun classifiesDayAndRangeDateMarkers() {
        val today = LocalDate.of(2026, 6, 14)
        val selectedDay = LocalDate.of(2026, 6, 15)
        val start = LocalDate.of(2026, 6, 15)
        val middle = LocalDate.of(2026, 6, 16)
        val emptyMiddle = LocalDate.of(2026, 6, 18)
        val end = LocalDate.of(2026, 6, 17)

        assertEquals(
            CalendarDateMarker.SELECTED_DAY,
            CalendarUiPolicy.markerForDate(
                date = selectedDay,
                today = today,
                scopeMode = HubCalendarScopeMode.DAY,
                selectedDay = selectedDay,
                rangeStart = null,
                rangeEnd = null,
                hasEntries = true,
            ),
        )
        assertEquals(
            CalendarDateMarker.RANGE_START,
            CalendarUiPolicy.markerForDate(start, today, HubCalendarScopeMode.RANGE, selectedDay, start, end, hasEntries = true),
        )
        assertEquals(
            CalendarDateMarker.RANGE_MIDDLE_WITH_EVENT,
            CalendarUiPolicy.markerForDate(middle, today, HubCalendarScopeMode.RANGE, selectedDay, start, end, hasEntries = true),
        )
        assertEquals(
            CalendarDateMarker.RANGE_END,
            CalendarUiPolicy.markerForDate(end, today, HubCalendarScopeMode.RANGE, selectedDay, start, end, hasEntries = true),
        )
        assertEquals(
            CalendarDateMarker.RANGE_MIDDLE_EMPTY,
            CalendarUiPolicy.markerForDate(emptyMiddle, today, HubCalendarScopeMode.RANGE, selectedDay, start, emptyMiddle.plusDays(1), hasEntries = false),
        )
        assertEquals(
            CalendarDateMarker.TODAY,
            CalendarUiPolicy.markerForDate(today, today, HubCalendarScopeMode.RANGE, selectedDay, start, end, hasEntries = true),
        )
    }

    @Test
    fun buildsDateAccessibilityLabels() {
        assertEquals(
            "6월 15일, 기간 시작, 일정 2개",
            CalendarUiPolicy.accessibilityLabelForDate(
                LocalDate.of(2026, 6, 15),
                CalendarDateMarker.RANGE_START,
                entryCount = 2,
            ),
        )
        assertEquals(
            "6월 18일, 기간 포함, 일정 없음",
            CalendarUiPolicy.accessibilityLabelForDate(
                LocalDate.of(2026, 6, 18),
                CalendarDateMarker.RANGE_MIDDLE_EMPTY,
                entryCount = 0,
            ),
        )
    }

    private fun birthdayEntry(eventId: String): HubCalendarEntry =
        calendarEntry(
            eventId = eventId,
            entryKind = HubCalendarEntryKind.MEMBER_BIRTHDAY,
            specialDayKind = HubCalendarSpecialDayKind.MEMBER_BIRTHDAY,
            specialDayLabel = "생일",
            status = HubEventStatus.ANNOUNCED,
        )

    private fun calendarEntry(
        eventId: String,
        status: HubEventStatus = HubEventStatus.OPEN,
        displayTimeText: String = "종일",
        entryKind: HubCalendarEntryKind = HubCalendarEntryKind.HUB_EVENT,
        specialDayKind: HubCalendarSpecialDayKind? = null,
        specialDayLabel: String? = null,
        startsAt: Instant? = Instant.parse("2026-06-15T01:00:00Z"),
        endsAt: Instant? = Instant.parse("2026-06-15T14:59:00Z"),
    ): HubCalendarEntry =
        HubCalendarEntry(
            id = "entry-$eventId",
            eventId = eventId,
            entryKind = entryKind,
            specialDayKind = specialDayKind,
            specialDayLabel = specialDayLabel,
            title = "테스트 일정 $eventId",
            category = HubEventCategory.ONLINE_GOODS,
            status = status,
            participationMode = HubEventParticipationMode.ONLINE,
            generationId = "official",
            memberId = null,
            startsAt = startsAt,
            endsAt = endsAt,
            displayDate = "2026-06-15",
            displayTimeText = displayTimeText,
            sourceLabel = "Stellive Official",
            appDeepLink = "stellivehub://hub-events/$eventId",
            platformUrl = "https://example.com/events/$eventId",
        )
}
