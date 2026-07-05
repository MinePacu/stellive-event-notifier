package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarDay
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntry
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntryKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventParticipationMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.feature.calendar.HubCalendarScopeMode
import dev.minepacu.stelliveeventnotifier.feature.calendar.HubEventsCalendarViewModel
import dev.minepacu.stelliveeventnotifier.feature.calendar.HubEventsViewMode
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class ListDateNavigationViewModelTest {
    private val clock = Clock.fixed(Instant.parse("2026-06-14T00:00:00Z"), ZoneId.of("Asia/Seoul"))

    @Test
    fun listDayNavigationUpdatesSelectedDayAndVisibleEntries() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        viewModel.setViewMode(HubEventsViewMode.LIST)
        viewModel.goToNextDay()

        assertEquals(LocalDate.of(2026, 6, 15), viewModel.uiState.selectedDay)
        assertEquals(listOf("goods-open"), viewModel.uiState.visibleEntries.map { it.eventId })

        viewModel.goToPreviousDay()

        assertEquals(LocalDate.of(2026, 6, 14), viewModel.uiState.selectedDay)
        assertEquals(emptyList<String>(), viewModel.uiState.visibleEntries.map { it.eventId })
    }

    @Test
    fun todayActionKeepsListModeAndSelectsToday() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        viewModel.setViewMode(HubEventsViewMode.LIST)
        viewModel.selectDay(LocalDate.of(2026, 6, 20))
        viewModel.goToToday()

        assertEquals(HubEventsViewMode.LIST, viewModel.uiState.viewMode)
        assertEquals(LocalDate.of(2026, 6, 14), viewModel.uiState.selectedDay)
    }

    @Test
    fun listRangeNavigationKeepsRangeLength() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        viewModel.setViewMode(HubEventsViewMode.LIST)
        viewModel.selectRangeBoundary(LocalDate.of(2026, 6, 16))
        viewModel.selectRangeBoundary(LocalDate.of(2026, 6, 22))
        viewModel.goToNextRange()

        assertEquals(LocalDate.of(2026, 6, 23), viewModel.uiState.rangeStart)
        assertEquals(LocalDate.of(2026, 6, 29), viewModel.uiState.rangeEnd)

        viewModel.goToPreviousRange()

        assertEquals(LocalDate.of(2026, 6, 16), viewModel.uiState.rangeStart)
        assertEquals(LocalDate.of(2026, 6, 22), viewModel.uiState.rangeEnd)
    }

    @Test
    fun currentWeekActionSelectsMondayThroughSundayRange() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        viewModel.setViewMode(HubEventsViewMode.LIST)
        viewModel.goToCurrentWeek()

        assertEquals(HubCalendarScopeMode.RANGE, viewModel.uiState.scopeMode)
        assertEquals(LocalDate.of(2026, 6, 8), viewModel.uiState.rangeStart)
        assertEquals(LocalDate.of(2026, 6, 14), viewModel.uiState.rangeEnd)
    }

    @Test
    fun applyingSelectedDayKeepsListModeAndUpdatesEntries() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        viewModel.setViewMode(HubEventsViewMode.LIST)
        viewModel.applySelectedDay(LocalDate.of(2026, 6, 15))

        assertEquals(HubEventsViewMode.LIST, viewModel.uiState.viewMode)
        assertEquals(HubCalendarScopeMode.DAY, viewModel.uiState.scopeMode)
        assertEquals(LocalDate.of(2026, 6, 15), viewModel.uiState.selectedDay)
        assertEquals(listOf("goods-open"), viewModel.uiState.visibleEntries.map { it.eventId })
    }

    @Test
    fun applyingSelectedRangeKeepsListModeAndNormalizesDates() {
        val viewModel = HubEventsCalendarViewModel(sampleDays(), clock)

        viewModel.setViewMode(HubEventsViewMode.LIST)
        viewModel.applySelectedRange(
            start = LocalDate.of(2026, 6, 22),
            end = LocalDate.of(2026, 6, 16),
        )

        assertEquals(HubEventsViewMode.LIST, viewModel.uiState.viewMode)
        assertEquals(HubCalendarScopeMode.RANGE, viewModel.uiState.scopeMode)
        assertEquals(LocalDate.of(2026, 6, 16), viewModel.uiState.rangeStart)
        assertEquals(LocalDate.of(2026, 6, 22), viewModel.uiState.rangeEnd)
    }
}

private fun sampleDays(): List<HubCalendarDay> = listOf(
    HubCalendarDay(
        date = "2026-06-15",
        entries = listOf(entry("goods-open", HubEventStatus.OPEN)),
    ),
    HubCalendarDay(
        date = "2026-06-23",
        entries = listOf(entry("ticket-open", HubEventStatus.UPCOMING)),
    ),
)

private fun entry(
    eventId: String,
    status: HubEventStatus,
): HubCalendarEntry = HubCalendarEntry(
    id = "entry-$eventId",
    eventId = eventId,
    entryKind = HubCalendarEntryKind.HUB_EVENT,
    specialDayKind = null,
    specialDayLabel = null,
    title = "테스트 일정 $eventId",
    category = HubEventCategory.ONLINE_GOODS,
    status = status,
    participationMode = HubEventParticipationMode.ONLINE,
    generationId = "official",
    memberId = null,
    startsAt = Instant.parse("2026-06-15T01:00:00Z"),
    endsAt = Instant.parse("2026-06-15T14:59:00Z"),
    displayDate = "2026-06-15",
    displayTimeText = "10:00 시작",
    sourceLabel = "공식 공지",
    appDeepLink = "stellivehub://hub-events/$eventId",
    platformUrl = "https://example.com/$eventId",
)
