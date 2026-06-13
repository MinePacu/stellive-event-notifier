package dev.stellive.hub.feature.calendar

import dev.stellive.hub.core.model.HubCalendarDay
import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubCalendarWidgetSnapshot
import dev.stellive.hub.core.model.HubEventStatus
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

enum class HubCalendarScopeMode {
    DAY,
    RANGE,
}

enum class CalendarDateMarker {
    OUTSIDE,
    SELECTED_DAY,
    RANGE_START,
    RANGE_MIDDLE_WITH_EVENT,
    RANGE_MIDDLE_EMPTY,
    RANGE_END,
    TODAY,
}

object CalendarUiPolicy {
    const val staleWidgetText = "최근 동기화 필요"
    const val emptyWidgetText = "예정된 일정 없음"

    private val normalDateFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy.MM.dd")
    private val accessibilityDateFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("M월 d일")

    private val statusRank = mapOf(
        HubEventStatus.CLOSING_SOON to 0,
        HubEventStatus.OPEN to 1,
        HubEventStatus.UPCOMING to 2,
        HubEventStatus.ANNOUNCED to 3,
        HubEventStatus.CANCELLED to 4,
        HubEventStatus.ENDED to 5,
    )

    val entryComparator: Comparator<HubCalendarEntry> = compareBy<HubCalendarEntry>(
        { statusRank[it.status] ?: Int.MAX_VALUE },
        { it.endsAt ?: it.startsAt ?: Instant.MAX },
        { it.title },
    )

    fun statusLabel(status: HubEventStatus): String = when (status) {
        HubEventStatus.ANNOUNCED -> "공개"
        HubEventStatus.UPCOMING -> "예정"
        HubEventStatus.OPEN -> "진행중"
        HubEventStatus.CLOSING_SOON -> "마감 임박"
        HubEventStatus.ENDED -> "종료"
        HubEventStatus.CANCELLED -> "취소"
    }

    fun entryLabel(entry: HubCalendarEntry): String = entry.specialDayLabel ?: statusLabel(entry.status)

    fun dateHeaderText(date: LocalDate, now: LocalDate = LocalDate.now()): String = when (date) {
        now -> "오늘"
        now.plusDays(1) -> "내일"
        else -> normalDateFormatter.format(date)
    }

    fun timeWindowText(entry: HubCalendarEntry): String = entry.displayTimeText

    fun isWidgetSnapshotStale(snapshot: HubCalendarWidgetSnapshot, now: Instant): Boolean =
        !now.isBefore(snapshot.staleAfter)

    fun normalizeRange(start: LocalDate?, end: LocalDate?): ClosedRange<LocalDate>? {
        if (start == null || end == null) return null
        return if (start <= end) start..end else end..start
    }

    fun previousDay(selectedDay: LocalDate): LocalDate = selectedDay.minusDays(1)

    fun nextDay(selectedDay: LocalDate): LocalDate = selectedDay.plusDays(1)

    fun currentWeek(today: LocalDate): ClosedRange<LocalDate> {
        val start = today.minusDays((today.dayOfWeek.value - 1).toLong())
        return start..start.plusDays(6)
    }

    fun shiftRange(start: LocalDate?, end: LocalDate?, direction: Int): Pair<LocalDate, LocalDate> {
        val rangeStart = start ?: LocalDate.now()
        val rangeEnd = end ?: rangeStart.plusDays(6)
        val normalized = normalizeRange(rangeStart, rangeEnd) ?: (rangeStart..rangeStart.plusDays(6))
        val dayCount = ChronoUnit.DAYS.between(normalized.start, normalized.endInclusive) + 1
        val offset = dayCount * direction
        return normalized.start.plusDays(offset) to normalized.endInclusive.plusDays(offset)
    }

    fun needsCalendarFetch(
        targetFrom: LocalDate,
        targetTo: LocalDate,
        loadedFrom: LocalDate?,
        loadedTo: LocalDate?,
    ): Boolean {
        if (loadedFrom == null || loadedTo == null) return true
        return targetFrom < loadedFrom || targetTo > loadedTo
    }

    fun entriesForDay(days: List<HubCalendarDay>, date: LocalDate): List<HubCalendarEntry> =
        days.firstOrNull { it.date == date.toString() }
            ?.entries
            ?.sortedWith(entryComparator)
            .orEmpty()

    fun entriesForRange(
        days: List<HubCalendarDay>,
        start: LocalDate,
        end: LocalDate,
    ): List<HubCalendarEntry> {
        val range = normalizeRange(start, end) ?: return emptyList()
        return days
            .asSequence()
            .filter { LocalDate.parse(it.date) in range }
            .flatMap { it.entries.asSequence() }
            .sortedWith(entryComparator)
            .toList()
    }

    fun markerForDate(
        date: LocalDate,
        today: LocalDate,
        scopeMode: HubCalendarScopeMode,
        selectedDay: LocalDate,
        rangeStart: LocalDate?,
        rangeEnd: LocalDate?,
        hasEntries: Boolean,
    ): CalendarDateMarker {
        if (scopeMode == HubCalendarScopeMode.DAY && date == selectedDay) {
            return CalendarDateMarker.SELECTED_DAY
        }

        if (scopeMode == HubCalendarScopeMode.RANGE) {
            val range = normalizeRange(rangeStart, rangeEnd)
            if (range != null && date in range) {
                return when (date) {
                    range.start -> CalendarDateMarker.RANGE_START
                    range.endInclusive -> CalendarDateMarker.RANGE_END
                    else -> if (hasEntries) {
                        CalendarDateMarker.RANGE_MIDDLE_WITH_EVENT
                    } else {
                        CalendarDateMarker.RANGE_MIDDLE_EMPTY
                    }
                }
            }

            if (rangeStart != null && rangeEnd == null && date == rangeStart) {
                return CalendarDateMarker.RANGE_START
            }
        }

        return if (date == today) CalendarDateMarker.TODAY else CalendarDateMarker.OUTSIDE
    }

    fun accessibilityLabelForDate(
        date: LocalDate,
        marker: CalendarDateMarker,
        entryCount: Int,
    ): String {
        val markerLabel = when (marker) {
            CalendarDateMarker.SELECTED_DAY -> "선택됨"
            CalendarDateMarker.RANGE_START -> "기간 시작"
            CalendarDateMarker.RANGE_MIDDLE_WITH_EVENT,
            CalendarDateMarker.RANGE_MIDDLE_EMPTY -> "기간 포함"
            CalendarDateMarker.RANGE_END -> "기간 종료"
            CalendarDateMarker.TODAY -> "오늘"
            CalendarDateMarker.OUTSIDE -> null
        }
        val scheduleLabel = if (entryCount > 0) "일정 ${entryCount}개" else "일정 없음"
        return listOfNotNull(accessibilityDateFormatter.format(date), markerLabel, scheduleLabel)
            .joinToString(", ")
    }
}
