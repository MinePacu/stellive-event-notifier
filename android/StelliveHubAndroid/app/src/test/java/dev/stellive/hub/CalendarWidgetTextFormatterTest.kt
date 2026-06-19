package dev.stellive.hub

import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubCalendarEntryKind
import dev.stellive.hub.core.model.HubCalendarSpecialDayKind
import dev.stellive.hub.core.model.HubEventCategory
import dev.stellive.hub.core.model.HubEventParticipationMode
import dev.stellive.hub.core.model.HubEventStatus
import dev.stellive.hub.feature.calendar.CalendarWidgetTextFormatter
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Test

class CalendarWidgetTextFormatterTest {
    @Test
    fun formatsHubEventSubtitleFromStatus() {
        val entry = calendarEntry(
            status = HubEventStatus.CLOSING_SOON,
            title = "공식 굿즈 판매",
            startsAt = Instant.parse("2026-06-11T01:00:00Z"),
            displayTimeText = "10:00 시작"
        )

        assertEquals("마감 임박 · 2026-06-11 · 10:00 시작", CalendarWidgetTextFormatter.subtitle(entry))
    }

    @Test
    fun formatsStartOnlyHubEventSubtitleWithoutDeadlineCopy() {
        val entry = calendarEntry(
            status = HubEventStatus.OPEN,
            title = "콘서트 당일",
            displayDate = "2026-07-11",
            displayTimeText = "18:00 시작"
        )

        assertEquals("진행중 · 2026-07-11 · 18:00 시작", CalendarWidgetTextFormatter.subtitle(entry))
    }

    @Test
    fun formatsSpecialDaySubtitleFromSpecialDayLabel() {
        val birthday = calendarEntry(
            id = "birthday:ayatsuno-yuni:2026-05-21",
            eventId = "birthday:ayatsuno-yuni",
            entryKind = HubCalendarEntryKind.MEMBER_BIRTHDAY,
            specialDayKind = HubCalendarSpecialDayKind.MEMBER_BIRTHDAY,
            specialDayLabel = "생일",
            title = "아야츠노 유니 생일",
            status = HubEventStatus.UPCOMING,
            generationId = "gen1",
            memberId = "ayatsuno-yuni",
            displayDate = "2026-05-21",
            displayTimeText = "종일",
            sourceLabel = "카탈로그",
            appDeepLink = "stellivehub://calendar/special-days/birthday:ayatsuno-yuni?date=2026-05-21",
            platformUrl = null
        )

        assertEquals("생일 · 2026-05-21 · 종일", CalendarWidgetTextFormatter.subtitle(birthday))
    }

    @Test
    fun returnsStaticWidgetFallbackText() {
        assertEquals("최근 동기화 필요", CalendarWidgetTextFormatter.staleText())
        assertEquals("예정된 일정 없음", CalendarWidgetTextFormatter.emptyText())
    }

    private fun calendarEntry(
        id: String = "event:2026-06-11",
        eventId: String = "event",
        entryKind: HubCalendarEntryKind = HubCalendarEntryKind.HUB_EVENT,
        specialDayKind: HubCalendarSpecialDayKind? = null,
        specialDayLabel: String? = null,
        title: String = "공식 굿즈 판매",
        category: HubEventCategory = HubEventCategory.ONLINE_GOODS,
        status: HubEventStatus = HubEventStatus.UPCOMING,
        participationMode: HubEventParticipationMode = HubEventParticipationMode.ONLINE,
        generationId: String = "official",
        memberId: String? = null,
        startsAt: Instant? = null,
        endsAt: Instant? = null,
        displayDate: String = "2026-06-11",
        displayTimeText: String = "종일",
        sourceLabel: String = "Stellive Official",
        appDeepLink: String = "stellivehub://hub-events/event",
        platformUrl: String? = "https://example.com/hub-events/event"
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
