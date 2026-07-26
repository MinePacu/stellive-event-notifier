package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventParticipationMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleItem
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventSourceType
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.core.model.HubEventTimePrecision
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailCalendarMode
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailCalendarPolicy
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventLinkPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

class HubEventDetailCalendarPolicyTest {
    private val seoul = ZoneId.of("Asia/Seoul")
    private val today = LocalDate.parse("2026-06-15")

    @Test
    fun noParentOrScheduleDatesIsHidden() {
        val presentation = build(event())

        assertEquals(HubEventDetailCalendarMode.HIDDEN, presentation.mode)
        assertNull(presentation.initialSelectedDate)
        assertNull(presentation.availableMonthRange)
        assertTrue(presentation.days.isEmpty())
    }

    @Test
    fun singleDateParentUsesCompactDate() {
        val presentation = build(
            event(
                startsAt = "2026-06-20T01:00:00Z",
                endsAt = "2026-06-20T08:00:00Z",
            ),
        )

        assertEquals(HubEventDetailCalendarMode.COMPACT_DATE, presentation.mode)
        assertEquals(LocalDate.parse("2026-06-20"), presentation.initialSelectedDate)
    }

    @Test
    fun multipleSchedulesOnSameLocalDateRemainCompact() {
        val presentation = build(
            event(
                schedules = listOf(
                    schedule("first", "2026-06-20T01:00:00Z"),
                    schedule("second", "2026-06-20T08:00:00Z"),
                ),
            ),
        )

        assertEquals(HubEventDetailCalendarMode.COMPACT_DATE, presentation.mode)
        assertEquals(listOf("first", "second"), presentation.scheduleIdsFor(LocalDate.parse("2026-06-20")))
    }

    @Test
    fun schedulesOnDifferentDatesUseMonthCalendar() {
        val presentation = build(
            event(
                schedules = listOf(
                    schedule("first", "2026-06-20T01:00:00Z"),
                    schedule("second", "2026-06-21T01:00:00Z"),
                ),
            ),
        )

        assertEquals(HubEventDetailCalendarMode.MONTH_CALENDAR, presentation.mode)
    }

    @Test
    fun multiDayParentMarksInclusiveRange() {
        val presentation = build(
            event(
                startsAt = "2026-06-19T15:00:00Z",
                endsAt = "2026-06-22T14:59:59Z",
            ),
        )

        assertEquals(HubEventDetailCalendarMode.MONTH_CALENDAR, presentation.mode)
        assertEquals(
            listOf("2026-06-20", "2026-06-21", "2026-06-22"),
            presentation.days.filter { it.isInParentEventRange }.map { it.date.toString() },
        )
    }

    @Test
    fun dateAndDateTimeUseEachScheduleTimezoneWithSeoulFallback() {
        val presentation = build(
            event(
                schedules = listOf(
                    schedule(
                        id = "date-la",
                        startsAt = "2026-06-20T01:00:00Z",
                        precision = HubEventTimePrecision.DATE,
                        timezone = "America/Los_Angeles",
                    ),
                    schedule(
                        id = "datetime-tokyo",
                        startsAt = "2026-06-20T23:30:00Z",
                        timezone = "Asia/Tokyo",
                    ),
                    schedule(
                        id = "fallback",
                        startsAt = "2026-06-21T15:30:00Z",
                        timezone = "Not/A_Zone",
                    ),
                ),
            ),
        )

        assertEquals(listOf("date-la"), presentation.scheduleIdsFor(LocalDate.parse("2026-06-19")))
        assertEquals(listOf("datetime-tokyo"), presentation.scheduleIdsFor(LocalDate.parse("2026-06-21")))
        assertEquals(listOf("fallback"), presentation.scheduleIdsFor(LocalDate.parse("2026-06-22")))
    }

    @Test
    fun missingEndProjectsOnlyStartDateAndMultiDayScheduleProjectsEveryDay() {
        val presentation = build(
            event(
                schedules = listOf(
                    schedule("single", "2026-06-18T01:00:00Z"),
                    schedule("range", "2026-06-20T01:00:00Z", "2026-06-22T01:00:00Z"),
                ),
            ),
        )

        assertEquals(listOf("single"), presentation.scheduleIdsFor(LocalDate.parse("2026-06-18")))
        assertEquals(listOf("range"), presentation.scheduleIdsFor(LocalDate.parse("2026-06-20")))
        assertEquals(listOf("range"), presentation.scheduleIdsFor(LocalDate.parse("2026-06-21")))
        assertEquals(listOf("range"), presentation.scheduleIdsFor(LocalDate.parse("2026-06-22")))
    }

    @Test
    fun cancellationIsRetainedAndCancelledOnlyDayIsSemantic() {
        val presentation = build(
            event(
                schedules = listOf(
                    schedule("cancelled", "2026-06-20T01:00:00Z", cancelled = true),
                    schedule("active", "2026-06-21T01:00:00Z"),
                ),
            ),
        )

        val cancelledDay = presentation.day(LocalDate.parse("2026-06-20"))!!
        assertTrue(cancelledDay.hasOnlyCancelledSchedules)
        assertEquals(0, cancelledDay.activeScheduleCount)
        assertEquals(listOf("cancelled"), cancelledDay.schedules.map { it.id })
        assertFalse(presentation.day(LocalDate.parse("2026-06-21"))!!.hasOnlyCancelledSchedules)
    }

    @Test
    fun tenSchedulesRenderNinePlusButExposeActualCount() {
        val presentation = build(
            event(
                schedules = (0 until 10).map { index ->
                    schedule("item-$index", "2026-06-20T${index.toString().padStart(2, '0')}:00:00Z")
                },
            ),
        )

        val day = presentation.day(LocalDate.parse("2026-06-20"))!!
        assertEquals("9+", day.countIndicator)
        assertEquals(10, day.scheduleCount)
    }

    @Test
    fun inverseParentAndScheduleRangesSafelyCollapseToStart() {
        val presentation = build(
            event(
                startsAt = "2026-06-20T01:00:00Z",
                endsAt = "2026-06-18T01:00:00Z",
                schedules = listOf(schedule("inverse", "2026-06-22T01:00:00Z", "2026-06-21T01:00:00Z")),
            ),
        )

        assertEquals(listOf(LocalDate.parse("2026-06-20")), presentation.days.filter { it.isInParentEventRange }.map { it.date })
        assertEquals(listOf("inverse"), presentation.scheduleIdsFor(LocalDate.parse("2026-06-22")))
        assertTrue(presentation.scheduleIdsFor(LocalDate.parse("2026-06-21")).isEmpty())
    }

    @Test
    fun initialSelectionUsesHighlightThenTodayThenFutureThenParentThenEarliestSchedule() {
        val schedules = listOf(
            schedule("past", "2026-06-10T01:00:00Z"),
            schedule("future", "2026-06-20T01:00:00Z"),
            schedule("highlight", "2026-06-22T01:00:00Z"),
        )
        assertEquals(
            LocalDate.parse("2026-06-22"),
            build(event(schedules = schedules), highlightedId = "highlight").initialSelectedDate,
        )
        assertEquals(
            today,
            build(event(startsAt = "2026-06-14T15:00:00Z", endsAt = "2026-06-15T15:00:00Z", schedules = schedules)).initialSelectedDate,
        )
        assertEquals(LocalDate.parse("2026-06-20"), build(event(schedules = schedules)).initialSelectedDate)
        assertEquals(
            LocalDate.parse("2026-06-18"),
            build(event(startsAt = "2026-06-18T01:00:00Z", schedules = listOf(schedule("past", "2026-06-10T01:00:00Z")))).initialSelectedDate,
        )
        assertEquals(
            LocalDate.parse("2026-06-10"),
            build(event(schedules = listOf(schedule("past", "2026-06-10T01:00:00Z")))).initialSelectedDate,
        )
    }

    @Test
    fun availableMonthRangeAndDisplayedMonthCoverAllProjectedDates() {
        val presentation = build(
            event(
                startsAt = "2026-05-31T01:00:00Z",
                endsAt = "2026-05-31T02:00:00Z",
                schedules = listOf(schedule("late", "2026-08-01T01:00:00Z")),
            ),
        )

        assertEquals(YearMonth.parse("2026-05")..YearMonth.parse("2026-08"), presentation.availableMonthRange)
        assertEquals(YearMonth.parse("2026-08"), presentation.displayedMonth)
    }

    @Test
    fun selectionReturnsScheduleIdsInTimelineOrderWithoutDuplicates() {
        val presentation = build(
            event(
                schedules = listOf(
                    schedule("later-order", "2026-06-20T01:00:00Z", sortOrder = 2),
                    schedule("earlier-order", "2026-06-20T01:00:00Z", sortOrder = 1),
                    schedule("multi", "2026-06-19T01:00:00Z", "2026-06-21T01:00:00Z"),
                ),
            ),
        )

        assertEquals(
            listOf("multi", "earlier-order", "later-order"),
            presentation.scheduleIdsFor(LocalDate.parse("2026-06-20")),
        )
    }

    @Test
    fun highlightedScheduleStillUsesExistingExpansionPolicy() {
        val event = event(schedules = listOf(schedule("highlight", "2026-06-20T01:00:00Z")))

        assertEquals(
            setOf("highlight"),
            HubEventLinkPolicy.resolvedExpandedScheduleItemIds(
                previousEventId = null,
                eventId = event.id,
                currentIds = emptySet(),
                highlightedScheduleItemId = "highlight",
            ),
        )
        assertEquals(
            LocalDate.parse("2026-06-20"),
            build(event, highlightedId = "highlight").initialSelectedDate,
        )
    }

    @Test
    fun deadlineAndSingleItemDotAreProjected() {
        val presentation = build(
            event(
                schedules = listOf(
                    schedule("deadline", "2026-06-20T01:00:00Z", kind = HubEventScheduleKind.DEADLINE),
                ),
            ),
        )

        val day = presentation.day(LocalDate.parse("2026-06-20"))!!
        assertTrue(day.hasDeadline)
        assertEquals("•", day.countIndicator)
    }

    private fun build(event: HubEvent, highlightedId: String? = null) =
        HubEventDetailCalendarPolicy.build(
            event = event,
            highlightedScheduleItemId = highlightedId,
            today = today,
            parentZoneId = seoul,
        )

    private fun event(
        startsAt: String? = null,
        endsAt: String? = null,
        schedules: List<HubEventScheduleItem> = emptyList(),
    ) = HubEvent(
        id = "event",
        category = HubEventCategory.OFFLINE_POPUP,
        participationMode = HubEventParticipationMode.OFFLINE,
        status = HubEventStatus.UPCOMING,
        title = "행사",
        generationId = "official",
        sourceUrl = "https://example.com",
        sourceLabel = "공식 공지",
        sourceType = HubEventSourceType.OFFICIAL,
        startsAt = startsAt?.let(Instant::parse),
        endsAt = endsAt?.let(Instant::parse),
        scheduleItems = schedules,
        updatedAt = Instant.parse("2026-06-01T00:00:00Z"),
    )

    private fun schedule(
        id: String,
        startsAt: String,
        endsAt: String? = null,
        precision: HubEventTimePrecision = HubEventTimePrecision.DATETIME,
        timezone: String = "Asia/Seoul",
        cancelled: Boolean = false,
        sortOrder: Int = 0,
        kind: HubEventScheduleKind = HubEventScheduleKind.CUSTOM,
    ) = HubEventScheduleItem(
        id = id,
        kind = kind,
        label = id,
        startsAt = Instant.parse(startsAt),
        endsAt = endsAt?.let(Instant::parse),
        timePrecision = precision,
        timezone = timezone,
        cancelledAt = if (cancelled) Instant.parse("2026-06-01T00:00:00Z") else null,
        sortOrder = sortOrder,
    )
}
