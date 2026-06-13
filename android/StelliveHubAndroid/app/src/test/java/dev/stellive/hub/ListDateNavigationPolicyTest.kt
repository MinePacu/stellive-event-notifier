package dev.stellive.hub

import dev.stellive.hub.feature.calendar.CalendarUiPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class ListDateNavigationPolicyTest {
    @Test
    fun previousAndNextDayMoveByOneDay() {
        val selectedDay = LocalDate.of(2026, 6, 15)

        assertEquals(LocalDate.of(2026, 6, 14), CalendarUiPolicy.previousDay(selectedDay))
        assertEquals(LocalDate.of(2026, 6, 16), CalendarUiPolicy.nextDay(selectedDay))
    }

    @Test
    fun currentWeekUsesMondayThroughSunday() {
        val week = CalendarUiPolicy.currentWeek(LocalDate.of(2026, 6, 18))

        assertEquals(LocalDate.of(2026, 6, 15), week.start)
        assertEquals(LocalDate.of(2026, 6, 21), week.endInclusive)
    }

    @Test
    fun shiftRangeKeepsCurrentRangeLength() {
        val previous = CalendarUiPolicy.shiftRange(
            start = LocalDate.of(2026, 6, 16),
            end = LocalDate.of(2026, 6, 22),
            direction = -1,
        )
        val next = CalendarUiPolicy.shiftRange(
            start = LocalDate.of(2026, 6, 16),
            end = LocalDate.of(2026, 6, 22),
            direction = 1,
        )

        assertEquals(LocalDate.of(2026, 6, 9) to LocalDate.of(2026, 6, 15), previous)
        assertEquals(LocalDate.of(2026, 6, 23) to LocalDate.of(2026, 6, 29), next)
    }

    @Test
    fun shiftRangeUsesSevenDaysWhenEndIsMissing() {
        val shifted = CalendarUiPolicy.shiftRange(
            start = LocalDate.of(2026, 6, 16),
            end = null,
            direction = 1,
        )

        assertEquals(LocalDate.of(2026, 6, 23) to LocalDate.of(2026, 6, 29), shifted)
    }

    @Test
    fun needsCalendarFetchOnlyWhenTargetEscapesLoadedWindow() {
        val loadedFrom = LocalDate.of(2026, 6, 1)
        val loadedTo = LocalDate.of(2026, 6, 30)

        assertFalse(
            CalendarUiPolicy.needsCalendarFetch(
                targetFrom = LocalDate.of(2026, 6, 14),
                targetTo = LocalDate.of(2026, 6, 14),
                loadedFrom = loadedFrom,
                loadedTo = loadedTo,
            ),
        )
        assertTrue(
            CalendarUiPolicy.needsCalendarFetch(
                targetFrom = LocalDate.of(2026, 7, 1),
                targetTo = LocalDate.of(2026, 7, 1),
                loadedFrom = loadedFrom,
                loadedTo = loadedTo,
            ),
        )
        assertTrue(
            CalendarUiPolicy.needsCalendarFetch(
                targetFrom = LocalDate.of(2026, 6, 14),
                targetTo = LocalDate.of(2026, 6, 14),
                loadedFrom = null,
                loadedTo = loadedTo,
            ),
        )
    }
}
