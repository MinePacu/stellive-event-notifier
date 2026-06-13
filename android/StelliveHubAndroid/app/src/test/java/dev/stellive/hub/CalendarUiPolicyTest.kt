package dev.stellive.hub

import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubCalendarEntryKind
import dev.stellive.hub.core.model.HubCalendarSpecialDayKind
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
    fun sortsActionableHubEventsBeforeBirthdaysAndEndedItems() {
        val entries = listOf(
            calendarEntry("ended", HubEventStatus.ENDED),
            birthdayEntry("birthday"),
            calendarEntry("closing", HubEventStatus.CLOSING_SOON),
            calendarEntry("open", HubEventStatus.OPEN)
        )

        assertEquals(
            listOf("closing", "open", "birthday", "ended"),
            entries.sortedWith(CalendarUiPolicy.entryComparator).map { it.eventId }
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

    private fun birthdayEntry(eventId: String): HubCalendarEntry = calendarEntry(
        eventId = eventId,
        id = "birthday:ayatsuno-yuni:2026-05-21",
        entryKind = HubCalendarEntryKind.MEMBER_BIRTHDAY,
        specialDayKind = HubCalendarSpecialDayKind.MEMBER_BIRTHDAY,
        specialDayLabel = "생일",
        title = "아야츠노 유니 생일",
        status = HubEventStatus.UPCOMING,
        generationId = "gen1",
        memberId = "ayatsuno-yuni",
        startsAt = null,
        endsAt = null,
        displayDate = "2026-05-21",
        displayTimeText = "종일",
        sourceLabel = "카탈로그",
        appDeepLink = "stellivehub://calendar/special-days/birthday:ayatsuno-yuni?date=2026-05-21",
        platformUrl = null
    )

    private fun calendarEntry(
        eventId: String,
        status: HubEventStatus,
        id: String = "$eventId:2026-06-11",
        entryKind: HubCalendarEntryKind = HubCalendarEntryKind.HUB_EVENT,
        specialDayKind: HubCalendarSpecialDayKind? = null,
        specialDayLabel: String? = null,
        title: String = eventId,
        category: HubEventCategory = HubEventCategory.ONLINE_GOODS,
        participationMode: HubEventParticipationMode = HubEventParticipationMode.ONLINE,
        generationId: String = "official",
        memberId: String? = null,
        startsAt: Instant? = Instant.parse("2026-06-11T01:00:00Z"),
        endsAt: Instant? = Instant.parse("2026-06-11T10:00:00Z"),
        displayDate: String = "2026-06-11",
        displayTimeText: String = "10:00 시작",
        sourceLabel: String = "Stellive Official",
        appDeepLink: String = "stellivehub://hub-events/$eventId",
        platformUrl: String? = "https://example.com/hub-events/$eventId"
    ) = HubCalendarEntry(
        id = id,
        eventId = eventId,
        entryKind = entryKind,
        specialDayKind = specialDayKind,
        specialDayLabel = specialDayLabel,
        title = title,
        category = category,
        status = status,
        participationMode = participationMode,
        generationId = generationId,
        memberId = memberId,
        startsAt = startsAt,
        endsAt = endsAt,
        displayDate = displayDate,
        displayTimeText = displayTimeText,
        sourceLabel = sourceLabel,
        appDeepLink = appDeepLink,
        platformUrl = platformUrl
    )
}
