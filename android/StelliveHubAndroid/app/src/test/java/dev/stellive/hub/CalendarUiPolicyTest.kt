package dev.stellive.hub

import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubCalendarWidgetSnapshot
import dev.stellive.hub.core.model.HubEventCategory
import dev.stellive.hub.core.model.HubEventParticipationMode
import dev.stellive.hub.core.model.HubEventStatus
import dev.stellive.hub.feature.calendar.CalendarUiPolicy
import java.time.Instant
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CalendarUiPolicyTest {
    @Test
    fun sortsActionableStatusesBeforeEndedItems() {
        val entries = listOf(
            calendarEntry("ended", HubEventStatus.ENDED),
            calendarEntry("upcoming", HubEventStatus.UPCOMING),
            calendarEntry("closing", HubEventStatus.CLOSING_SOON),
            calendarEntry("open", HubEventStatus.OPEN)
        )

        assertEquals(
            listOf("closing", "open", "upcoming", "ended"),
            entries.sortedWith(CalendarUiPolicy.entryComparator).map { it.eventId }
        )
    }

    @Test
    fun formatsDateHeadersForTodayTomorrowAndNormalDates() {
        val today = LocalDate.of(2026, 6, 11)

        assertEquals("오늘", CalendarUiPolicy.dateHeaderText(today, today))
        assertEquals("내일", CalendarUiPolicy.dateHeaderText(today.plusDays(1), today))
        assertEquals("2026.06.13", CalendarUiPolicy.dateHeaderText(today.plusDays(2), today))
    }

    @Test
    fun detectsWidgetSnapshotStaleness() {
        val snapshot = HubCalendarWidgetSnapshot(
            generatedAt = Instant.parse("2026-06-11T00:00:00Z"),
            timezone = "Asia/Seoul",
            entries = emptyList(),
            staleAfter = Instant.parse("2026-06-11T06:00:00Z")
        )

        assertFalse(CalendarUiPolicy.isWidgetSnapshotStale(snapshot, Instant.parse("2026-06-11T05:59:59Z")))
        assertTrue(CalendarUiPolicy.isWidgetSnapshotStale(snapshot, Instant.parse("2026-06-11T06:00:00Z")))
    }

    @Test
    fun exposesTextOnlyWidgetFallbacks() {
        assertEquals("최근 동기화 필요", CalendarUiPolicy.staleWidgetText)
        assertEquals("예정된 일정 없음", CalendarUiPolicy.emptyWidgetText)
    }

    private fun calendarEntry(eventId: String, status: HubEventStatus): HubCalendarEntry =
        HubCalendarEntry(
            id = "$eventId:2026-06-11",
            eventId = eventId,
            title = eventId,
            category = HubEventCategory.ONLINE_GOODS,
            status = status,
            participationMode = HubEventParticipationMode.ONLINE,
            generationId = "official",
            memberId = null,
            startsAt = Instant.parse("2026-06-11T01:00:00Z"),
            endsAt = Instant.parse("2026-06-11T12:00:00Z"),
            displayDate = "2026-06-11",
            displayTimeText = "10:00 시작",
        sourceLabel = "Stellive Official",
        appDeepLink = "stellivehub://hub-events/$eventId",
        platformUrl = "https://example.com/hub-events/$eventId"
    )
}
