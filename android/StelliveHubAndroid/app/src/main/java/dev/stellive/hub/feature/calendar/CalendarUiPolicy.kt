package dev.stellive.hub.feature.calendar

import dev.stellive.hub.core.model.HubCalendarDay
import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubCalendarWidgetSnapshot
import dev.stellive.hub.core.model.HubEventStatus
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
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

enum class CalendarEntrySpanKind {
    SINGLE_DAY,
    MULTI_DAY_START,
    MULTI_DAY_MIDDLE,
    MULTI_DAY_END,
    MULTI_DAY_ALL_DAY,
}

enum class CalendarEventDotEmphasis {
    MUTED,
    NORMAL,
    HIGH,
}

data class CalendarEventDotStyle(
    val visible: Boolean,
    val sizeDp: Int,
    val emphasis: CalendarEventDotEmphasis,
    val countText: String? = null,
)

data class CalendarDurationBarSegment(
    val eventId: String,
    val weekIndex: Int,
    val lane: Int,
    val startColumn: Int,
    val endColumn: Int,
    val startsAtVisibleBoundary: Boolean,
    val endsAtVisibleBoundary: Boolean,
    val emphasis: CalendarEventDotEmphasis,
)

data class CalendarDurationBarLayout(
    val segments: List<CalendarDurationBarSegment>,
    val laneCountsByWeek: Map<Int, Int>,
)

object CalendarUiPolicy {
    const val staleWidgetText = "최근 동기화 필요"
    const val emptyWidgetText = "예정된 일정 없음"

    private val normalDateFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy.MM.dd")
    private val periodDateFormatter: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE
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

    fun entryLabel(entry: HubCalendarEntry): String =
        entry.specialDayLabel ?: statusLabel(entry.status)

    fun dateHeaderText(date: LocalDate, now: LocalDate = LocalDate.now()): String = when (date) {
        now -> "오늘"
        now.plusDays(1) -> "내일"
        else -> normalDateFormatter.format(date)
    }

    fun timeWindowText(entry: HubCalendarEntry): String =
        entry.displayTimeText.ifBlank { entry.displayDate }

    fun entryPeriodDateText(
        entry: HubCalendarEntry,
        zoneId: ZoneId = ZoneId.systemDefault(),
    ): String {
        val startsAt = entry.startsAt ?: return entry.displayDate
        val endsAt = entry.endsAt ?: return entry.displayDate
        val startDate = startsAt.atZone(zoneId).toLocalDate()
        val endDate = endsAt.atZone(zoneId).toLocalDate()
        if (endDate <= startDate) return entry.displayDate
        return "${periodDateFormatter.format(startDate)}~${periodDateFormatter.format(endDate)}"
    }

    fun isWidgetSnapshotStale(snapshot: HubCalendarWidgetSnapshot, now: Instant): Boolean =
        !snapshot.staleAfter.isAfter(now)

    fun spanKindForEntry(
        entry: HubCalendarEntry,
        cellDate: LocalDate,
        zoneId: ZoneId = ZoneId.systemDefault(),
    ): CalendarEntrySpanKind {
        val startsAt = entry.startsAt ?: return CalendarEntrySpanKind.SINGLE_DAY
        val endsAt = entry.endsAt ?: return CalendarEntrySpanKind.SINGLE_DAY
        val startDate = startsAt.atZone(zoneId).toLocalDate()
        val endDate = endsAt.atZone(zoneId).toLocalDate()

        if (startDate == endDate || endDate < startDate) {
            return CalendarEntrySpanKind.SINGLE_DAY
        }

        return when (cellDate) {
            startDate -> CalendarEntrySpanKind.MULTI_DAY_START
            endDate -> CalendarEntrySpanKind.MULTI_DAY_END
            else -> if (cellDate > startDate && cellDate < endDate) {
                CalendarEntrySpanKind.MULTI_DAY_MIDDLE
            } else {
                CalendarEntrySpanKind.MULTI_DAY_ALL_DAY
            }
        }
    }

    fun hasMultiDayEntry(
        entries: List<HubCalendarEntry>,
        cellDate: LocalDate,
        zoneId: ZoneId = ZoneId.systemDefault(),
    ): Boolean =
        entries.any { spanKindForEntry(it, cellDate, zoneId) != CalendarEntrySpanKind.SINGLE_DAY }

    fun durationBarLayoutForMonth(
        days: List<HubCalendarDay>,
        month: YearMonth,
        zoneId: ZoneId = ZoneId.systemDefault(),
    ): CalendarDurationBarLayout {
        val visibleStart = visibleGridStart(month)
        val visibleEnd = visibleGridEnd(month, visibleStart)
        val candidates = days
            .asSequence()
            .filter { day ->
                val date = runCatching { LocalDate.parse(day.date) }.getOrNull()
                date != null && date in visibleStart..visibleEnd
            }
            .flatMap { it.entries.asSequence() }
            .distinctBy { it.eventId }
            .mapNotNull { entry ->
                val startsAt = entry.startsAt ?: return@mapNotNull null
                val endsAt = entry.endsAt ?: return@mapNotNull null
                val startDate = startsAt.atZone(zoneId).toLocalDate()
                val endDate = endsAt.atZone(zoneId).toLocalDate()
                if (startDate >= endDate) return@mapNotNull null
                val clippedStart = maxOf(startDate, visibleStart)
                val clippedEnd = minOf(endDate, visibleEnd)
                if (clippedStart > clippedEnd) return@mapNotNull null
                DurationCandidate(
                    entry = entry,
                    startDate = startDate,
                    endDate = endDate,
                    visibleStart = clippedStart,
                    visibleEnd = clippedEnd,
                )
            }
            .sortedWith(
                compareBy<DurationCandidate> { it.visibleStart }
                    .thenByDescending { ChronoUnit.DAYS.between(it.visibleStart, it.visibleEnd) }
                    .thenBy { it.entry.title }
                    .thenBy { it.entry.eventId },
            )
            .toList()

        val unassigned = candidates.flatMap { splitDurationCandidate(it, visibleStart) }
        val assigned = unassigned
            .groupBy { it.weekIndex }
            .toSortedMap()
            .flatMap { (_, weekSegments) -> assignDurationLanes(weekSegments) }
        val laneCounts = assigned
            .groupBy { it.weekIndex }
            .mapValues { (_, segments) -> segments.maxOf { it.lane } + 1 }
        return CalendarDurationBarLayout(segments = assigned, laneCountsByWeek = laneCounts)
    }

    private data class DurationCandidate(
        val entry: HubCalendarEntry,
        val startDate: LocalDate,
        val endDate: LocalDate,
        val visibleStart: LocalDate,
        val visibleEnd: LocalDate,
    )

    private data class UnassignedDurationSegment(
        val candidate: DurationCandidate,
        val weekIndex: Int,
        val startColumn: Int,
        val endColumn: Int,
        val startsAtVisibleBoundary: Boolean,
        val endsAtVisibleBoundary: Boolean,
    )

    private fun visibleGridStart(month: YearMonth): LocalDate {
        val firstDay = month.atDay(1)
        return firstDay.minusDays((firstDay.dayOfWeek.value % 7).toLong())
    }

    private fun visibleGridEnd(month: YearMonth, visibleStart: LocalDate): LocalDate {
        val firstDay = month.atDay(1)
        val leadingDays = firstDay.dayOfWeek.value % 7
        val totalCells = ((leadingDays + month.lengthOfMonth() + 6) / 7) * 7
        return visibleStart.plusDays((totalCells - 1).toLong())
    }

    private fun splitDurationCandidate(
        candidate: DurationCandidate,
        visibleGridStart: LocalDate,
    ): List<UnassignedDurationSegment> {
        val segments = mutableListOf<UnassignedDurationSegment>()
        var cursor = candidate.visibleStart
        while (cursor <= candidate.visibleEnd) {
            val daysFromGridStart = ChronoUnit.DAYS.between(visibleGridStart, cursor).toInt()
            val weekIndex = daysFromGridStart / 7
            val startColumn = daysFromGridStart % 7
            val weekEnd = visibleGridStart.plusDays((weekIndex * 7 + 6).toLong())
            val segmentEnd = minOf(candidate.visibleEnd, weekEnd)
            val endColumn = ChronoUnit.DAYS.between(visibleGridStart.plusDays((weekIndex * 7).toLong()), segmentEnd).toInt()
            segments += UnassignedDurationSegment(
                candidate = candidate,
                weekIndex = weekIndex,
                startColumn = startColumn,
                endColumn = endColumn,
                startsAtVisibleBoundary = cursor == candidate.startDate,
                endsAtVisibleBoundary = segmentEnd == candidate.endDate,
            )
            cursor = segmentEnd.plusDays(1)
        }
        return segments
    }

    private fun assignDurationLanes(segments: List<UnassignedDurationSegment>): List<CalendarDurationBarSegment> {
        val laneEnds = mutableListOf<Int>()
        return segments
            .sortedWith(
                compareBy<UnassignedDurationSegment> { it.startColumn }
                    .thenByDescending { it.endColumn }
                    .thenBy { it.candidate.entry.eventId },
            )
            .map { segment ->
                val lane = laneEnds.indexOfFirst { it < segment.startColumn }.takeIf { it >= 0 }
                    ?: laneEnds.size.also { laneEnds += -1 }
                laneEnds[lane] = segment.endColumn
                CalendarDurationBarSegment(
                    eventId = segment.candidate.entry.eventId,
                    weekIndex = segment.weekIndex,
                    lane = lane,
                    startColumn = segment.startColumn,
                    endColumn = segment.endColumn,
                    startsAtVisibleBoundary = segment.startsAtVisibleBoundary,
                    endsAtVisibleBoundary = segment.endsAtVisibleBoundary,
                    emphasis = emphasisForEntries(listOf(segment.candidate.entry)),
                )
            }
    }

    private fun emphasisForEntries(entries: List<HubCalendarEntry>): CalendarEventDotEmphasis =
        when {
            entries.any { it.status == HubEventStatus.CLOSING_SOON } -> CalendarEventDotEmphasis.HIGH
            entries.all { it.status == HubEventStatus.CANCELLED || it.status == HubEventStatus.ENDED } ->
                CalendarEventDotEmphasis.MUTED
            else -> CalendarEventDotEmphasis.NORMAL
        }

    fun dotStyleForEntries(entries: List<HubCalendarEntry>): CalendarEventDotStyle {
        if (entries.isEmpty()) {
            return CalendarEventDotStyle(
                visible = false,
                sizeDp = 0,
                emphasis = CalendarEventDotEmphasis.MUTED,
            )
        }

        val emphasis = emphasisForEntries(entries)
        val size = when (entries.size) {
            1 -> 5
            2 -> 6
            else -> 8
        }

        return CalendarEventDotStyle(
            visible = true,
            sizeDp = size,
            emphasis = emphasis,
            countText = if (entries.size >= 3) entries.size.coerceAtMost(9).toString() else null,
        )
    }

    fun entryRangeLabel(entry: HubCalendarEntry, cellDate: LocalDate): String? =
        when (spanKindForEntry(entry, cellDate)) {
            CalendarEntrySpanKind.SINGLE_DAY -> null
            CalendarEntrySpanKind.MULTI_DAY_START -> "기간 시작"
            CalendarEntrySpanKind.MULTI_DAY_MIDDLE,
            CalendarEntrySpanKind.MULTI_DAY_ALL_DAY -> "진행 기간"
            CalendarEntrySpanKind.MULTI_DAY_END -> "기간 종료"
        }

    fun entryRowStatusText(entry: HubCalendarEntry, cellDate: LocalDate): String =
        listOfNotNull(entryLabel(entry), entryRangeLabel(entry, cellDate))
            .distinct()
            .joinToString(" · ")

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
        val normalized = normalizeRange(rangeStart, rangeEnd) ?: return rangeStart to rangeEnd
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
        hasMultiDayEntry: Boolean = false,
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
        val multiDayLabel = if (hasMultiDayEntry) "기간 행사 포함" else null
        return listOfNotNull(
            accessibilityDateFormatter.format(date),
            markerLabel,
            scheduleLabel,
            multiDayLabel,
        ).joinToString(", ")
    }
}
