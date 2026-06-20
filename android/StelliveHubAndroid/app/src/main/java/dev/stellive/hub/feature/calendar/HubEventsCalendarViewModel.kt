package dev.stellive.hub.feature.calendar

import dev.stellive.hub.core.model.HubCalendarDay
import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubEventCategory
import dev.stellive.hub.core.model.HubEventParticipationMode
import dev.stellive.hub.core.model.HubEventStatus
import java.time.Clock
import java.time.LocalDate
import java.time.YearMonth

enum class HubEventsViewMode {
    LIST,
    CALENDAR,
}

data class HubEventsCalendarUiState(
    val viewMode: HubEventsViewMode = HubEventsViewMode.CALENDAR,
    val scopeMode: HubCalendarScopeMode = HubCalendarScopeMode.DAY,
    val selectedMonth: YearMonth,
    val selectedDay: LocalDate,
    val rangeStart: LocalDate? = null,
    val rangeEnd: LocalDate? = null,
    val filterId: String = FILTER_ALL,
    val days: List<HubCalendarDay> = emptyList(),
    val visibleEntries: List<HubCalendarEntry> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
) {
    companion object {
        const val FILTER_ALL = "all"
        const val FILTER_GOODS = "goods"
        const val FILTER_TICKETING = "ticketing"
        const val FILTER_OFFLINE = "offline"
        const val FILTER_CLOSING = "closing"
    }
}

class HubEventsCalendarViewModel(
    initialDays: List<HubCalendarDay>,
    private val clock: Clock = Clock.systemDefaultZone(),
    private val initialSelectedMonth: YearMonth? = null,
) {
    private val today: LocalDate
        get() = LocalDate.now(clock)

    var uiState: HubEventsCalendarUiState = createInitialState(initialDays)
        private set

    fun setViewMode(mode: HubEventsViewMode) {
        uiState = uiState.copy(viewMode = mode)
    }

    fun setScopeMode(mode: HubCalendarScopeMode) {
        uiState = recalculate(
            uiState.copy(
                scopeMode = mode,
                rangeStart = if (mode == HubCalendarScopeMode.RANGE) uiState.rangeStart ?: uiState.selectedDay else null,
                rangeEnd = if (mode == HubCalendarScopeMode.RANGE) uiState.rangeEnd else null,
            ),
        )
    }

    fun selectMonth(month: YearMonth) {
        val selectedDay = if (YearMonth.from(uiState.selectedDay) == month) {
            uiState.selectedDay
        } else {
            month.atDay(1)
        }
        uiState = recalculate(
            uiState.copy(
                selectedMonth = month,
                selectedDay = selectedDay,
                rangeStart = null,
                rangeEnd = null,
            ),
        )
    }

    fun goToPreviousMonth() {
        selectMonth(uiState.selectedMonth.minusMonths(1))
    }

    fun goToNextMonth() {
        selectMonth(uiState.selectedMonth.plusMonths(1))
    }

    fun goToPreviousDay() {
        selectDay(CalendarUiPolicy.previousDay(uiState.selectedDay))
    }

    fun goToNextDay() {
        selectDay(CalendarUiPolicy.nextDay(uiState.selectedDay))
    }

    fun goToToday() {
        selectDay(today)
    }

    fun goToPreviousRange() {
        shiftSelectedRange(direction = -1)
    }

    fun goToNextRange() {
        shiftSelectedRange(direction = 1)
    }

    fun goToCurrentWeek() {
        val week = CalendarUiPolicy.currentWeek(today)
        uiState = recalculate(
            uiState.copy(
                scopeMode = HubCalendarScopeMode.RANGE,
                selectedMonth = YearMonth.from(week.start),
                selectedDay = week.start,
                rangeStart = week.start,
                rangeEnd = week.endInclusive,
            ),
        )
    }

    fun applySelectedDay(date: LocalDate) {
        selectDay(date)
    }

    fun applySelectedRange(start: LocalDate, end: LocalDate) {
        val range = CalendarUiPolicy.normalizeRange(start, end) ?: (start..end)
        uiState = recalculate(
            uiState.copy(
                scopeMode = HubCalendarScopeMode.RANGE,
                selectedMonth = YearMonth.from(range.start),
                selectedDay = range.start,
                rangeStart = range.start,
                rangeEnd = range.endInclusive,
            ),
        )
    }

    fun selectDay(date: LocalDate) {
        uiState = recalculate(
            uiState.copy(
                scopeMode = HubCalendarScopeMode.DAY,
                selectedMonth = YearMonth.from(date),
                selectedDay = date,
                rangeStart = null,
                rangeEnd = null,
            ),
        )
    }

    fun selectRangeBoundary(date: LocalDate) {
        val current = uiState
        val nextState = if (current.scopeMode != HubCalendarScopeMode.RANGE || current.rangeStart == null || current.rangeEnd != null) {
            current.copy(
                scopeMode = HubCalendarScopeMode.RANGE,
                selectedMonth = YearMonth.from(date),
                selectedDay = date,
                rangeStart = date,
                rangeEnd = null,
            )
        } else {
            current.copy(
                scopeMode = HubCalendarScopeMode.RANGE,
                selectedMonth = YearMonth.from(date),
                selectedDay = date,
                rangeStart = minOf(current.rangeStart, date),
                rangeEnd = maxOf(current.rangeStart, date),
            )
        }
        uiState = recalculate(nextState)
    }

    private fun shiftSelectedRange(direction: Int) {
        val (start, end) = CalendarUiPolicy.shiftRange(
            start = uiState.rangeStart ?: uiState.selectedDay,
            end = uiState.rangeEnd,
            direction = direction,
        )
        uiState = recalculate(
            uiState.copy(
                scopeMode = HubCalendarScopeMode.RANGE,
                selectedMonth = YearMonth.from(start),
                selectedDay = start,
                rangeStart = start,
                rangeEnd = end,
            ),
        )
    }

    fun setFilter(filterId: String) {
        uiState = recalculate(uiState.copy(filterId = filterId))
    }

    fun replaceDays(days: List<HubCalendarDay>) {
        val hadVisibleEntries = uiState.visibleEntries.isNotEmpty()
        uiState = recalculate(uiState.copy(days = days))
        if (hadVisibleEntries || uiState.visibleEntries.isNotEmpty()) return

        val firstSelectableDate = firstSelectableDate() ?: return
        when (uiState.scopeMode) {
            HubCalendarScopeMode.DAY -> selectDay(firstSelectableDate)
            HubCalendarScopeMode.RANGE -> {
                uiState = recalculate(
                    uiState.copy(
                        selectedMonth = YearMonth.from(firstSelectableDate),
                        selectedDay = firstSelectableDate,
                        rangeStart = firstSelectableDate,
                        rangeEnd = firstSelectableDate,
                    ),
                )
            }
        }
    }

    fun hasEntries(date: LocalDate): Boolean =
        filteredDays(uiState.days, uiState.filterId).any { it.date == date.toString() && it.entries.isNotEmpty() }

    fun markerForDate(date: LocalDate): CalendarDateMarker =
        CalendarUiPolicy.markerForDate(
            date = date,
            today = today,
            scopeMode = uiState.scopeMode,
            selectedDay = uiState.selectedDay,
            rangeStart = uiState.rangeStart,
            rangeEnd = uiState.rangeEnd,
            hasEntries = hasEntries(date),
        )

    private fun createInitialState(days: List<HubCalendarDay>): HubEventsCalendarUiState {
        val today = today
        return recalculate(
            HubEventsCalendarUiState(
                selectedMonth = initialSelectedMonth ?: YearMonth.from(today),
                selectedDay = today,
                days = days,
            ),
        )
    }

    private fun recalculate(state: HubEventsCalendarUiState): HubEventsCalendarUiState {
        val filteredDays = filteredDays(state.days, state.filterId)
        val visibleEntries = when (state.scopeMode) {
            HubCalendarScopeMode.DAY -> CalendarUiPolicy.entriesForDay(filteredDays, state.selectedDay)
            HubCalendarScopeMode.RANGE -> {
                val start = state.rangeStart ?: state.selectedDay
                val end = state.rangeEnd ?: start
                CalendarUiPolicy.entriesForRange(filteredDays, start, end)
            }
        }
        return state.copy(visibleEntries = visibleEntries)
    }

    private fun firstSelectableDate(): LocalDate? {
        val selectableDates = filteredDays(uiState.days, uiState.filterId)
            .filter { it.entries.isNotEmpty() }
            .mapNotNull { runCatching { LocalDate.parse(it.date) }.getOrNull() }
            .sorted()

        return selectableDates.firstOrNull {
            YearMonth.from(it) == uiState.selectedMonth
        } ?: selectableDates.firstOrNull()
    }

    private fun filteredDays(days: List<HubCalendarDay>, filterId: String): List<HubCalendarDay> =
        days.mapNotNull { day ->
            val entries = day.entries.filter { entry -> entry.matchesFilter(filterId) }
            if (entries.isEmpty()) null else day.copy(entries = entries)
        }

    private fun HubCalendarEntry.matchesFilter(filterId: String): Boolean = when (filterId) {
        HubEventsCalendarUiState.FILTER_GOODS ->
            category == HubEventCategory.ONLINE_GOODS || category == HubEventCategory.ONLINE_COLLAB
        HubEventsCalendarUiState.FILTER_TICKETING ->
            category == HubEventCategory.TICKETING
        HubEventsCalendarUiState.FILTER_OFFLINE ->
            participationMode == HubEventParticipationMode.OFFLINE || participationMode == HubEventParticipationMode.HYBRID
        HubEventsCalendarUiState.FILTER_CLOSING ->
            status == HubEventStatus.CLOSING_SOON
        else -> true
    }
}
