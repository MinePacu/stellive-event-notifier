package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntry
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntryKind
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarSpecialDayKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventParticipationMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.feature.calendar.HubCalendarDeepLinkPolicy
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HubCalendarDeepLinkPolicyTest {
    @Test
    fun buildsAndParsesHubEventDeepLink() {
        val deepLink = HubCalendarDeepLinkPolicy.appDeepLinkForEvent("ticket-drop")

        assertEquals("stellivehub://hub-events/ticket-drop", deepLink)
        assertEquals("ticket-drop", HubCalendarDeepLinkPolicy.eventIdFromAppDeepLink(deepLink))
    }

    @Test
    fun parsesScheduleItemFromTimelineDeepLink() {
        val deepLink = HubCalendarDeepLinkPolicy.appDeepLinkForEvent("album", "track-list")

        assertEquals("stellivehub://hub-events/album?scheduleItemId=track-list", deepLink)
        assertEquals("album", HubCalendarDeepLinkPolicy.eventIdFromAppDeepLink(deepLink))
        assertEquals("track-list", HubCalendarDeepLinkPolicy.scheduleItemIdFromAppDeepLink(deepLink))
    }

    @Test
    fun rejectsUnsupportedDeepLinks() {
        assertNull(HubCalendarDeepLinkPolicy.eventIdFromAppDeepLink("https://example.com/events/ticket-drop"))
        assertNull(HubCalendarDeepLinkPolicy.eventIdFromAppDeepLink("stellivehub://members/ayatsuno-yuni"))
        assertNull(HubCalendarDeepLinkPolicy.eventIdFromAppDeepLink("stellivehub://hub-events/"))
    }

    @Test
    fun onlyHubEventEntriesNavigateToDetail() {
        assertTrue(HubCalendarDeepLinkPolicy.canNavigateToDetail(entry("ticket-drop")))
        assertFalse(
            HubCalendarDeepLinkPolicy.canNavigateToDetail(
                entry(
                    eventId = "",
                    entryKind = HubCalendarEntryKind.MEMBER_BIRTHDAY,
                    specialDayKind = HubCalendarSpecialDayKind.MEMBER_BIRTHDAY,
                ),
            ),
        )
    }

    private fun entry(
        eventId: String,
        entryKind: HubCalendarEntryKind = HubCalendarEntryKind.HUB_EVENT,
        specialDayKind: HubCalendarSpecialDayKind? = null,
    ): HubCalendarEntry = HubCalendarEntry(
        id = "entry-$eventId",
        eventId = eventId,
        entryKind = entryKind,
        specialDayKind = specialDayKind,
        title = "테스트 일정",
        category = HubEventCategory.ONLINE_GOODS,
        status = HubEventStatus.OPEN,
        participationMode = HubEventParticipationMode.ONLINE,
        generationId = "official",
        memberId = null,
        startsAt = Instant.parse("2026-06-15T01:00:00Z"),
        endsAt = Instant.parse("2026-06-15T14:59:00Z"),
        displayDate = "2026-06-15",
        displayTimeText = "10:00 시작",
        sourceLabel = "Stellive Official",
        appDeepLink = if (eventId.isBlank()) "" else "stellivehub://hub-events/$eventId",
        platformUrl = "https://example.com/events/$eventId",
    )
}
