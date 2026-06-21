package dev.stellive.hub

import dev.stellive.hub.core.model.HubCalendarDay
import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubCalendarEntryKind
import dev.stellive.hub.core.model.HubEventCategory
import dev.stellive.hub.core.model.HubEventParticipationMode
import dev.stellive.hub.core.model.HubEventStatus
import dev.stellive.hub.feature.calendar.CalendarDateMarker
import dev.stellive.hub.feature.calendar.HubCalendarScopeMode
import dev.stellive.hub.feature.calendar.HubEventsCalendarUiState
import dev.stellive.hub.feature.calendar.HubEventsCalendarViewModel
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.YearMonth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HubEventsCalendarViewModelTest {
    private val clock = Clock.fixed(Instant.parse("2026-06-14T00:00:00Z"), ZoneId.of("Asia/Seoul"))

    @Test
    fun startsInCalendarDayModeForCurrentMonth() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        assertEquals(YearMonth.of(2026, 6), viewModel.uiState.selectedMonth)
        assertEquals(LocalDate.of(2026, 6, 14), viewModel.uiState.selectedDay)
        assertEquals(HubCalendarScopeMode.DAY, viewModel.uiState.scopeMode)
    }

    @Test
    fun selectDayShowsOnlyThatDaysEntries() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        viewModel.selectDay(LocalDate.of(2026, 6, 15))

        assertEquals(listOf("ticket-deadline", "goods-open"), viewModel.uiState.visibleEntries.map { it.eventId })
        assertEquals(CalendarDateMarker.SELECTED_DAY, viewModel.markerForDate(LocalDate.of(2026, 6, 15)))
    }

    @Test
    fun rangeSelectionNormalizesReversedDatesAndIncludesAllEntries() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        viewModel.selectRangeBoundary(LocalDate.of(2026, 6, 17))
        viewModel.selectRangeBoundary(LocalDate.of(2026, 6, 15))

        assertEquals(LocalDate.of(2026, 6, 15), viewModel.uiState.rangeStart)
        assertEquals(LocalDate.of(2026, 6, 17), viewModel.uiState.rangeEnd)
        assertEquals(
            listOf("fansign-deadline", "ticket-deadline", "goods-open", "popup-open"),
            viewModel.uiState.visibleEntries.map { it.eventId },
        )
    }

    @Test
    fun rangeSelectionDeduplicatesMultiDayCalendarEntriesByEventId() {
        val first = entry("goods-range", HubEventStatus.OPEN, HubEventCategory.ONLINE_GOODS).copy(
            id = "goods-range:2026-06-19",
            displayDate = "2026-06-19",
        )
        val second = first.copy(
            id = "goods-range:2026-06-20",
            displayDate = "2026-06-20",
        )
        val viewModel = HubEventsCalendarViewModel(
            listOf(
                HubCalendarDay("2026-06-19", listOf(first)),
                HubCalendarDay("2026-06-20", listOf(second)),
            ),
            clock,
        )

        viewModel.selectRangeBoundary(LocalDate.of(2026, 6, 19))
        viewModel.selectRangeBoundary(LocalDate.of(2026, 6, 20))

        assertEquals(listOf("goods-range"), viewModel.uiState.visibleEntries.map { it.eventId })
        assertEquals("goods-range:2026-06-19", viewModel.uiState.visibleEntries.single().id)
    }

    @Test
    fun rangeMiddleDatesUseDotMarkerOnlyWhenEntriesExist() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        viewModel.selectRangeBoundary(LocalDate.of(2026, 6, 15))
        viewModel.selectRangeBoundary(LocalDate.of(2026, 6, 18))

        assertEquals(CalendarDateMarker.RANGE_START, viewModel.markerForDate(LocalDate.of(2026, 6, 15)))
        assertEquals(CalendarDateMarker.RANGE_MIDDLE_WITH_EVENT, viewModel.markerForDate(LocalDate.of(2026, 6, 16)))
        assertEquals(CalendarDateMarker.RANGE_MIDDLE_WITH_EVENT, viewModel.markerForDate(LocalDate.of(2026, 6, 17)))
        assertEquals(CalendarDateMarker.RANGE_END, viewModel.markerForDate(LocalDate.of(2026, 6, 18)))
        assertTrue(viewModel.hasEntries(LocalDate.of(2026, 6, 16)))
        assertFalse(viewModel.hasEntries(LocalDate.of(2026, 6, 18)))
    }

    @Test
    fun filtersVisibleEntriesWithoutMutatingCalendarSource() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        viewModel.selectRangeBoundary(LocalDate.of(2026, 6, 15))
        viewModel.selectRangeBoundary(LocalDate.of(2026, 6, 17))
        viewModel.setFilter(HubEventsCalendarUiState.FILTER_TICKETING)

        assertEquals(listOf("ticket-deadline"), viewModel.uiState.visibleEntries.map { it.eventId })
        assertTrue(viewModel.hasEntries(LocalDate.of(2026, 6, 15)))
        assertFalse(viewModel.hasEntries(LocalDate.of(2026, 6, 16)))
    }

    @Test
    fun monthNavigationMovesSelectionToFirstDayWhenChangingMonth() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        viewModel.goToNextMonth()

        assertEquals(YearMonth.of(2026, 7), viewModel.uiState.selectedMonth)
        assertEquals(LocalDate.of(2026, 7, 1), viewModel.uiState.selectedDay)
    }

    @Test
    fun replacingInitiallyEmptyDaysSelectsFirstVisibleServerDay() {
        val viewModel = HubEventsCalendarViewModel(emptyList(), clock)

        viewModel.replaceDays(
            listOf(
                HubCalendarDay(
                    date = "2026-07-11",
                    entries = listOf(
                        entry(
                            "admin-event",
                            HubEventStatus.OPEN,
                            HubEventCategory.OFFLINE_POPUP,
                            HubEventParticipationMode.OFFLINE,
                        ),
                    ),
                ),
            ),
        )

        assertEquals(YearMonth.of(2026, 7), viewModel.uiState.selectedMonth)
        assertEquals(LocalDate.of(2026, 7, 11), viewModel.uiState.selectedDay)
        assertEquals(listOf("admin-event"), viewModel.uiState.visibleEntries.map { it.eventId })
    }

    private fun sampleDays(): List<HubCalendarDay> = listOf(
        HubCalendarDay(
            date = "2026-06-15",
            entries = listOf(
                entry("goods-open", HubEventStatus.OPEN, HubEventCategory.ONLINE_GOODS),
                entry("ticket-deadline", HubEventStatus.CLOSING_SOON, HubEventCategory.TICKETING),
            ),
        ),
        HubCalendarDay(
            date = "2026-06-16",
            entries = listOf(
                entry(
                    "popup-open",
                    HubEventStatus.UPCOMING,
                    HubEventCategory.OFFLINE_POPUP,
                    HubEventParticipationMode.OFFLINE,
                ),
            ),
        ),
        HubCalendarDay(
            date = "2026-06-17",
            entries = listOf(
                entry("fansign-deadline", HubEventStatus.CLOSING_SOON, HubEventCategory.ONLINE_COLLAB),
            ),
        ),
    )

    private fun entry(
        eventId: String,
        status: HubEventStatus,
        category: HubEventCategory,
        participationMode: HubEventParticipationMode = HubEventParticipationMode.ONLINE,
    ): HubCalendarEntry = HubCalendarEntry(
        id = "entry-$eventId",
        eventId = eventId,
        entryKind = HubCalendarEntryKind.HUB_EVENT,
        specialDayKind = null,
        specialDayLabel = null,
        title = "테스트 일정 $eventId",
        category = category,
        status = status,
        participationMode = participationMode,
        generationId = "official",
        memberId = null,
        startsAt = Instant.parse("2026-06-15T01:00:00Z"),
        endsAt = Instant.parse("2026-06-15T14:59:00Z"),
        displayDate = "2026-06-15",
        displayTimeText = "10:00 시작",
        sourceLabel = "Stellive Official",
        appDeepLink = "stellivehub://hub-events/$eventId",
        platformUrl = "https://example.com/events/$eventId",
    )
}
