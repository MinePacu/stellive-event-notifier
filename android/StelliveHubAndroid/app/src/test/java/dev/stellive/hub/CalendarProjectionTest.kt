package dev.stellive.hub

import dev.stellive.hub.feature.home.MockHubRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CalendarProjectionTest {
    @Test
    fun groupsFilteredHubEventsByDisplayDate() {
        val days = MockHubRepository().calendarDaysForFilter("all")

        assertTrue(days.isNotEmpty())
        assertTrue(days.all { day -> day.entries.isNotEmpty() })
        assertEquals(days.map { it.date }.sorted(), days.map { it.date })
        assertTrue(days.flatMap { it.entries }.all { it.appDeepLink.startsWith("stellivehub://hub-events/") })
    }

    @Test
    fun buildsWidgetSnapshotFromFilteredCalendarEvents() {
        val snapshot = MockHubRepository().calendarWidgetSnapshot(limit = 2)

        assertEquals("Asia/Seoul", snapshot.timezone)
        assertTrue(snapshot.entries.size <= 2)
        assertTrue(snapshot.staleAfter.isAfter(snapshot.generatedAt))
    }
}
