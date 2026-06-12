package dev.stellive.hub

import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubEventCategory
import dev.stellive.hub.core.model.HubEventParticipationMode
import dev.stellive.hub.core.model.HubEventStatus
import dev.stellive.hub.feature.calendar.CalendarWidgetTextFormatter
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Test

class CalendarWidgetTextFormatterTest {
    @Test
    fun formatsEntryRowsWithoutMediaOrRawFields() {
        val entry = HubCalendarEntry(
            id = "event:2026-06-11",
            eventId = "event",
            title = "공식 굿즈 판매",
            category = HubEventCategory.ONLINE_GOODS,
            status = HubEventStatus.CLOSING_SOON,
            participationMode = HubEventParticipationMode.ONLINE,
            generationId = "official",
            startsAt = Instant.parse("2026-06-11T01:00:00Z"),
            endsAt = Instant.parse("2026-06-11T12:00:00Z"),
            displayDate = "2026-06-11",
            displayTimeText = "10:00 시작",
            sourceLabel = "Stellive Official",
            appDeepLink = "stellivehub://hub-events/event",
            platformUrl = "https://example.com/hub-events/event"
        )

        assertEquals("마감 임박 · 2026-06-11 · 10:00 시작", CalendarWidgetTextFormatter.subtitle(entry))
    }

    @Test
    fun returnsFallbacksForWidgetStates() {
        assertEquals("최근 동기화 필요", CalendarWidgetTextFormatter.staleText())
        assertEquals("예정된 일정 없음", CalendarWidgetTextFormatter.emptyText())
    }
}
