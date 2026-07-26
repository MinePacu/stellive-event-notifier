package dev.minepacu.stelliveeventnotifier.feature.hubevents

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleItem
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

enum class HubEventDetailCalendarMode {
    HIDDEN,
    COMPACT_DATE,
    MONTH_CALENDAR,
}

data class HubEventDetailCalendarDay(
    val date: LocalDate,
    val isInParentEventRange: Boolean,
    val schedules: List<HubEventScheduleItem>,
    val activeScheduleCount: Int,
    val hasDeadline: Boolean,
    val hasOnlyCancelledSchedules: Boolean,
) {
    val scheduleCount: Int
        get() = schedules.size

    val countIndicator: String?
        get() = when (scheduleCount) {
            0 -> null
            1 -> "•"
            in 2..9 -> scheduleCount.toString()
            else -> "9+"
        }
}

data class HubEventDetailCalendarPresentation(
    val mode: HubEventDetailCalendarMode,
    val displayedMonth: YearMonth?,
    val availableMonthRange: ClosedRange<YearMonth>?,
    val selectedDate: LocalDate?,
    val initialSelectedDate: LocalDate?,
    val days: List<HubEventDetailCalendarDay>,
) {
    fun day(date: LocalDate): HubEventDetailCalendarDay? = days.firstOrNull { it.date == date }

    fun scheduleIdsFor(date: LocalDate): List<String> =
        day(date)?.schedules.orEmpty().map(HubEventScheduleItem::id)
}

object HubEventDetailCalendarPolicy {
    val DefaultZoneId: ZoneId = ZoneId.of("Asia/Seoul")

    fun build(
        event: HubEvent,
        highlightedScheduleItemId: String? = null,
        today: LocalDate = LocalDate.now(DefaultZoneId),
        parentZoneId: ZoneId = DefaultZoneId,
    ): HubEventDetailCalendarPresentation {
        val parentDates = parentDateRange(event, parentZoneId)
        val projectedSchedules = event.scheduleItems
            .sortedWith(
                compareBy<HubEventScheduleItem> { it.startsAt }
                    .thenBy { it.sortOrder }
                    .thenBy { it.id },
            )
            .map { schedule ->
                ProjectedSchedule(
                    schedule = schedule,
                    dates = scheduleDateRange(schedule),
                )
            }
        val allDates = (parentDates + projectedSchedules.flatMap(ProjectedSchedule::dates)).toSortedSet()
        if (allDates.isEmpty()) {
            return HubEventDetailCalendarPresentation(
                mode = HubEventDetailCalendarMode.HIDDEN,
                displayedMonth = null,
                availableMonthRange = null,
                selectedDate = null,
                initialSelectedDate = null,
                days = emptyList(),
            )
        }

        val schedulesByDate = buildMap<LocalDate, MutableList<HubEventScheduleItem>> {
            projectedSchedules.forEach { projected ->
                projected.dates.forEach { date ->
                    getOrPut(date) { mutableListOf() }.apply {
                        if (none { it.id == projected.schedule.id }) add(projected.schedule)
                    }
                }
            }
        }
        val firstDate = allDates.first()
        val lastDate = allDates.last()
        val days = generateSequence(firstDate) { date ->
            date.plusDays(1).takeIf { it <= lastDate }
        }.map { date ->
            val schedules = schedulesByDate[date].orEmpty()
            HubEventDetailCalendarDay(
                date = date,
                isInParentEventRange = date in parentDates,
                schedules = schedules,
                activeScheduleCount = schedules.count { it.cancelledAt == null },
                hasDeadline = schedules.any { it.kind == HubEventScheduleKind.DEADLINE },
                hasOnlyCancelledSchedules = schedules.isNotEmpty() && schedules.all { it.cancelledAt != null },
            )
        }.toList()

        val initialSelectedDate =
            highlightedScheduleItemId
                ?.let { highlightedId -> projectedSchedules.firstOrNull { it.schedule.id == highlightedId } }
                ?.dates
                ?.firstOrNull()
                ?: today.takeIf { date -> date in parentDates || schedulesByDate[date].orEmpty().isNotEmpty() }
                ?: projectedSchedules
                    .asSequence()
                    .filter { it.schedule.cancelledAt == null }
                    .flatMap { projected -> projected.dates.asSequence() }
                    .filter { it >= today }
                    .minOrNull()
                ?: parentDates.firstOrNull()
                ?: projectedSchedules.flatMap(ProjectedSchedule::dates).minOrNull()

        val mode = if (allDates.size == 1) {
            HubEventDetailCalendarMode.COMPACT_DATE
        } else {
            HubEventDetailCalendarMode.MONTH_CALENDAR
        }
        val availableMonthRange = YearMonth.from(firstDate)..YearMonth.from(lastDate)
        return HubEventDetailCalendarPresentation(
            mode = mode,
            displayedMonth = initialSelectedDate?.let(YearMonth::from) ?: YearMonth.from(firstDate),
            availableMonthRange = availableMonthRange,
            selectedDate = initialSelectedDate,
            initialSelectedDate = initialSelectedDate,
            days = days,
        )
    }

    private fun parentDateRange(event: HubEvent, zoneId: ZoneId): List<LocalDate> {
        val start = (event.startsAt ?: event.endsAt)?.atZone(zoneId)?.toLocalDate() ?: return emptyList()
        val requestedEnd = event.endsAt?.atZone(zoneId)?.toLocalDate() ?: start
        return inclusiveDateRange(start, requestedEnd)
    }

    private fun scheduleDateRange(schedule: HubEventScheduleItem): List<LocalDate> {
        val zoneId = runCatching { ZoneId.of(schedule.timezone) }.getOrDefault(DefaultZoneId)
        val start = schedule.startsAt.atZone(zoneId).toLocalDate()
        val requestedEnd = schedule.endsAt?.atZone(zoneId)?.toLocalDate() ?: start
        return inclusiveDateRange(start, requestedEnd)
    }

    private fun inclusiveDateRange(start: LocalDate, requestedEnd: LocalDate): List<LocalDate> {
        val end = requestedEnd.takeIf { it >= start } ?: start
        return generateSequence(start) { date ->
            date.plusDays(1).takeIf { it <= end }
        }.toList()
    }

    private data class ProjectedSchedule(
        val schedule: HubEventScheduleItem,
        val dates: List<LocalDate>,
    )
}
