package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarDay
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntry
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntryKind
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarSpecialDayKind
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarWidgetSnapshot
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventParticipationMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventSourceType
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.feature.calendar.CalendarDateMarker
import dev.minepacu.stelliveeventnotifier.feature.calendar.CalendarEntrySpanKind
import dev.minepacu.stelliveeventnotifier.feature.calendar.CalendarEventDotEmphasis
import dev.minepacu.stelliveeventnotifier.feature.calendar.CalendarUiPolicy
import dev.minepacu.stelliveeventnotifier.feature.calendar.HubCalendarScopeMode
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CalendarUiPolicyTest {
    @Test
    fun sortsActionableHubEventsBeforeBirthdaysAndEndedItems() {
        val entries = listOf(
            calendarEntry("ended", HubEventStatus.ENDED),
            birthdayEntry("birthday"),
            calendarEntry("closing", HubEventStatus.CLOSING_SOON),
            calendarEntry("open", HubEventStatus.OPEN),
        )

        assertEquals(
            listOf("closing", "open", "birthday", "ended"),
            entries.sortedWith(CalendarUiPolicy.entryComparator).map { it.eventId },
        )
    }

    @Test
    fun formatsSpecialDayEntryLabels() {
        assertEquals("생일", CalendarUiPolicy.entryLabel(birthdayEntry("birthday")))
        assertEquals("마감 임박", CalendarUiPolicy.entryLabel(calendarEntry("closing", HubEventStatus.CLOSING_SOON)))
    }

    @Test
    fun formatsDateHeaders() {
        val today = LocalDate.of(2026, 6, 11)

        assertEquals("오늘", CalendarUiPolicy.dateHeaderText(today, now = today))
        assertEquals("내일", CalendarUiPolicy.dateHeaderText(today.plusDays(1), now = today))
        assertEquals("2026.06.13", CalendarUiPolicy.dateHeaderText(LocalDate.of(2026, 6, 13), now = today))
    }

    @Test
    fun formatsEntryPeriodDateTextAsDateOnlyRange() {
        val entry = calendarEntry(
            "duration-title",
            startsAt = Instant.parse("2026-06-26T10:00:00Z"),
            endsAt = Instant.parse("2026-07-12T14:00:00Z"),
        )

        assertEquals(
            "2026-06-26~2026-07-12",
            CalendarUiPolicy.entryPeriodDateText(entry, zoneId = ZoneId.of("UTC")),
        )
    }

    @Test
    fun formatsTimeWindowText() {
        assertEquals("10:00 시작", CalendarUiPolicy.timeWindowText(calendarEntry("open", displayTimeText = "10:00 시작")))
    }

    @Test
    fun detectsStaleWidgetSnapshot() {
        val snapshot = HubCalendarWidgetSnapshot(
            generatedAt = Instant.parse("2026-06-11T00:00:00Z"),
            timezone = "Asia/Seoul",
            entries = emptyList(),
            staleAfter = Instant.parse("2026-06-11T06:00:00Z"),
        )

        assertFalse(CalendarUiPolicy.isWidgetSnapshotStale(snapshot, Instant.parse("2026-06-11T05:59:59Z")))
        assertTrue(CalendarUiPolicy.isWidgetSnapshotStale(snapshot, Instant.parse("2026-06-11T06:00:00Z")))
    }

    @Test
    fun normalizesDateRanges() {
        val start = LocalDate.of(2026, 6, 17)
        val end = LocalDate.of(2026, 6, 15)

        assertEquals(LocalDate.of(2026, 6, 15)..LocalDate.of(2026, 6, 17), CalendarUiPolicy.normalizeRange(start, end))
        assertNull(CalendarUiPolicy.normalizeRange(start, null))
    }

    @Test
    fun filtersEntriesForSelectedDay() {
        val days = listOf(
            HubCalendarDay("2026-06-15", listOf(calendarEntry("open", HubEventStatus.OPEN))),
            HubCalendarDay("2026-06-16", listOf(calendarEntry("upcoming", HubEventStatus.UPCOMING))),
        )

        assertEquals(listOf("open"), CalendarUiPolicy.entriesForDay(days, LocalDate.of(2026, 6, 15)).map { it.eventId })
        assertEquals(emptyList<String>(), CalendarUiPolicy.entriesForDay(days, LocalDate.of(2026, 6, 17)).map { it.eventId })
    }

    @Test
    fun filtersEntriesForInclusiveRangeInDisplayOrder() {
        val days = listOf(
            HubCalendarDay("2026-06-15", listOf(calendarEntry("upcoming", HubEventStatus.UPCOMING))),
            HubCalendarDay("2026-06-16", listOf(calendarEntry("closing", HubEventStatus.CLOSING_SOON))),
            HubCalendarDay("2026-06-17", listOf(calendarEntry("open", HubEventStatus.OPEN))),
            HubCalendarDay("2026-06-18", listOf(calendarEntry("ended", HubEventStatus.ENDED))),
        )

        val entries = CalendarUiPolicy.entriesForRange(
            days,
            LocalDate.of(2026, 6, 17),
            LocalDate.of(2026, 6, 15),
        )

        assertEquals(listOf("closing", "open", "upcoming"), entries.map { it.eventId })
    }

    @Test
    fun entriesForRangeDeduplicatesMultiDayCalendarEntriesByEventId() {
        val first = calendarEntry("goods-range").copy(
            id = "goods-range:2026-06-19",
            displayDate = "2026-06-19",
            startsAt = Instant.parse("2026-06-19T01:00:00Z"),
            endsAt = Instant.parse("2026-07-02T14:59:00Z"),
        )
        val second = first.copy(
            id = "goods-range:2026-06-20",
            displayDate = "2026-06-20",
        )
        val days = listOf(
            HubCalendarDay("2026-06-19", listOf(first)),
            HubCalendarDay("2026-06-20", listOf(second)),
        )

        val entries = CalendarUiPolicy.entriesForRange(
            days,
            LocalDate.of(2026, 6, 19),
            LocalDate.of(2026, 6, 20),
        )

        assertEquals(listOf("goods-range"), entries.map { it.eventId })
        assertEquals("goods-range:2026-06-19", entries.single().id)
    }

    @Test
    fun feedEntriesForMonthDeduplicatesByEventIdAndKeepsFirstVisibleDate() {
        val first = calendarEntry("goods-range").copy(
            id = "goods-range:2026-06-19",
            displayDate = "2026-06-19",
            startsAt = Instant.parse("2026-06-19T01:00:00Z"),
            endsAt = Instant.parse("2026-07-02T14:59:00Z"),
        )
        val second = first.copy(id = "goods-range:2026-06-20", displayDate = "2026-06-20")
        val other = calendarEntry("ticket").copy(id = "ticket:2026-06-20", displayDate = "2026-06-20")

        val rows = CalendarUiPolicy.feedEntriesForMonth(
            days = listOf(
                HubCalendarDay("2026-06-19", listOf(first)),
                HubCalendarDay("2026-06-20", listOf(second, other)),
            ),
            month = YearMonth.of(2026, 6),
        )

        assertEquals(listOf("ticket", "goods-range"), rows.map { it.entry.eventId })
        assertEquals("2026-06-20", rows.first().day.date)
    }

    @Test
    fun feedEntriesKeepDifferentScheduleItemsFromTheSameParentEvent() {
        val first = calendarEntry("album").copy(id = "album:tracks:2026-06-20", scheduleItemId = "tracks", displayDate = "2026-06-20")
        val second = calendarEntry("album").copy(id = "album:release:2026-06-20", scheduleItemId = "release", displayDate = "2026-06-20")

        val rows = CalendarUiPolicy.feedEntriesForMonth(
            days = listOf(HubCalendarDay("2026-06-20", listOf(first, second))),
            month = YearMonth.of(2026, 6),
        )

        assertEquals(listOf("tracks", "release"), rows.map { it.entry.scheduleItemId })
    }

    @Test
    fun feedEntriesCollapseDateExpansionForOneScheduleButKeepSiblingSchedules() {
        val tracks = calendarEntry("album").copy(
            id = "album:tracks:2026-06-20",
            scheduleItemId = "tracks",
            displayDate = "2026-06-20",
        )
        val nextDay = tracks.copy(id = "album:tracks:2026-06-21", displayDate = "2026-06-21")
        val release = tracks.copy(id = "album:release:2026-06-22", scheduleItemId = "release", displayDate = "2026-06-22")

        val rows = CalendarUiPolicy.feedEntriesForMonth(
            days = listOf(
                HubCalendarDay("2026-06-20", listOf(tracks)),
                HubCalendarDay("2026-06-21", listOf(nextDay)),
                HubCalendarDay("2026-06-22", listOf(release)),
            ),
            month = YearMonth.of(2026, 6),
        )

        assertEquals(listOf("tracks", "release"), rows.map { it.entry.scheduleItemId })
    }

    @Test
    fun resolvesDisplayTitleFromServerThenScheduleLabelThenParentTitle() {
        val entry = calendarEntry("album").copy(
            title = "부모 제목",
            scheduleLabel = "일정 레이블",
        )

        assertEquals("서버 표시 제목", CalendarUiPolicy.displayTitle(entry.copy(displayTitle = "서버 표시 제목")))
        assertEquals("일정 레이블", CalendarUiPolicy.displayTitle(entry.copy(displayTitle = null)))
        assertEquals("부모 제목", CalendarUiPolicy.displayTitle(entry.copy(displayTitle = null, scheduleLabel = null)))
    }

    @Test
    fun rootFeedSelectionOmitsScheduleItemContext() {
        val selection = CalendarUiPolicy.feedSelection("album")

        assertEquals("album", selection.eventId)
        assertEquals("goods-event:album", selection.transitionKey)
    }

    @Test
    fun singleEventsAndSpecialDaysKeepLegacyPresentation() {
        val birthday = birthdayEntry("birthday")

        assertEquals(birthday.title, CalendarUiPolicy.displayTitle(birthday))
    }

    @Test
    fun feedRenderRowsKeepsSpecialDaysWithoutCanonicalHubEvent() {
        val birthday = birthdayEntry("birthday:sakihane-huya").copy(
            id = "birthday:sakihane-huya:2026-07-07",
            title = "사키하네 후야 생일",
            displayDate = "2026-07-07",
        )
        val hubEvent = calendarEntry("goods-event").copy(
            id = "goods-event:2026-07-07",
            title = "공식 굿즈",
            displayDate = "2026-07-07",
        )
        val canonicalEvent = hubEvent(
            id = "goods-event",
            title = "공식 굿즈",
        )

        val rows = CalendarUiPolicy.feedRenderRowsForMonth(
            days = listOf(HubCalendarDay("2026-07-07", listOf(birthday, hubEvent))),
            month = YearMonth.of(2026, 7),
            events = listOf(canonicalEvent),
        )

        assertEquals(listOf("birthday:sakihane-huya", "goods-event"), rows.map { it.entry.eventId })
        assertNull(rows.first { it.entry.eventId == "birthday:sakihane-huya" }.canonicalEvent)
        assertEquals(canonicalEvent, rows.first { it.entry.eventId == "goods-event" }.canonicalEvent)
    }

    @Test
    fun feedRenderRowsCollapseSiblingSchedulesIntoOneRootEvent() {
        val tracks = calendarEntry("album").copy(
            id = "album:tracks:2026-07-07",
            scheduleItemId = "tracks",
            displayDate = "2026-07-07",
        )
        val release = tracks.copy(
            id = "album:release:2026-07-08",
            scheduleItemId = "release",
            displayDate = "2026-07-08",
        )
        val canonicalEvent = hubEvent(id = "album", title = "앨범 행사")

        val rows = CalendarUiPolicy.feedRenderRowsForMonth(
            days = listOf(
                HubCalendarDay("2026-07-07", listOf(tracks)),
                HubCalendarDay("2026-07-08", listOf(release)),
            ),
            month = YearMonth.of(2026, 7),
            events = listOf(canonicalEvent),
        )

        assertEquals(listOf("album"), rows.map { it.entry.eventId })
        assertEquals(canonicalEvent, rows.single().canonicalEvent)
    }

    @Test
    fun classifiesDayAndRangeDateMarkers() {
        val today = LocalDate.of(2026, 6, 14)
        val selectedDay = LocalDate.of(2026, 6, 15)
        val start = LocalDate.of(2026, 6, 15)
        val middle = LocalDate.of(2026, 6, 16)
        val emptyMiddle = LocalDate.of(2026, 6, 18)
        val end = LocalDate.of(2026, 6, 17)

        assertEquals(
            CalendarDateMarker.SELECTED_DAY,
            CalendarUiPolicy.markerForDate(
                date = selectedDay,
                today = today,
                scopeMode = HubCalendarScopeMode.DAY,
                selectedDay = selectedDay,
                rangeStart = null,
                rangeEnd = null,
                hasEntries = true,
            ),
        )
        assertEquals(
            CalendarDateMarker.RANGE_START,
            CalendarUiPolicy.markerForDate(start, today, HubCalendarScopeMode.RANGE, selectedDay, start, end, hasEntries = true),
        )
        assertEquals(
            CalendarDateMarker.RANGE_MIDDLE_WITH_EVENT,
            CalendarUiPolicy.markerForDate(middle, today, HubCalendarScopeMode.RANGE, selectedDay, start, end, hasEntries = true),
        )
        assertEquals(
            CalendarDateMarker.RANGE_END,
            CalendarUiPolicy.markerForDate(end, today, HubCalendarScopeMode.RANGE, selectedDay, start, end, hasEntries = true),
        )
        assertEquals(
            CalendarDateMarker.RANGE_MIDDLE_EMPTY,
            CalendarUiPolicy.markerForDate(emptyMiddle, today, HubCalendarScopeMode.RANGE, selectedDay, start, emptyMiddle.plusDays(1), hasEntries = false),
        )
        assertEquals(
            CalendarDateMarker.TODAY,
            CalendarUiPolicy.markerForDate(today, today, HubCalendarScopeMode.RANGE, selectedDay, start, end, hasEntries = true),
        )
    }

    @Test
    fun buildsDateAccessibilityLabels() {
        assertEquals(
            "6월 15일, 기간 시작, 일정 2개",
            CalendarUiPolicy.accessibilityLabelForDate(
                LocalDate.of(2026, 6, 15),
                CalendarDateMarker.RANGE_START,
                entryCount = 2,
            ),
        )
        assertEquals(
            "6월 18일, 기간 포함, 일정 없음",
            CalendarUiPolicy.accessibilityLabelForDate(
                LocalDate.of(2026, 6, 18),
                CalendarDateMarker.RANGE_MIDDLE_EMPTY,
                entryCount = 0,
            ),
        )
    }

    @Test
    fun entrySpanKindDistinguishesSingleDayAndMultiDayPositions() {
        val singleDay = calendarEntry(
            eventId = "single",
            startsAt = Instant.parse("2026-06-15T01:00:00Z"),
            endsAt = Instant.parse("2026-06-15T14:59:00Z"),
        )
        val multiDay = calendarEntry(
            eventId = "multi",
            startsAt = Instant.parse("2026-06-15T01:00:00Z"),
            endsAt = Instant.parse("2026-06-17T14:59:00Z"),
        )

        assertEquals(
            CalendarEntrySpanKind.SINGLE_DAY,
            CalendarUiPolicy.spanKindForEntry(singleDay, LocalDate.of(2026, 6, 15)),
        )
        assertEquals(
            CalendarEntrySpanKind.MULTI_DAY_START,
            CalendarUiPolicy.spanKindForEntry(multiDay, LocalDate.of(2026, 6, 15)),
        )
        assertEquals(
            CalendarEntrySpanKind.MULTI_DAY_MIDDLE,
            CalendarUiPolicy.spanKindForEntry(multiDay, LocalDate.of(2026, 6, 16)),
        )
        assertEquals(
            CalendarEntrySpanKind.MULTI_DAY_END,
            CalendarUiPolicy.spanKindForEntry(multiDay, LocalDate.of(2026, 6, 17)),
        )
    }

    @Test
    fun dotStyleScalesWithEntryCountAndStatusImportance() {
        assertFalse(CalendarUiPolicy.dotStyleForEntries(emptyList()).visible)

        val one = CalendarUiPolicy.dotStyleForEntries(listOf(calendarEntry("one")))
        assertTrue(one.visible)
        assertEquals(6, one.sizeDp)
        assertEquals(CalendarEventDotEmphasis.NORMAL, one.emphasis)

        val two = CalendarUiPolicy.dotStyleForEntries(
            listOf(calendarEntry("one"), calendarEntry("two")),
        )
        assertEquals(7, two.sizeDp)

        val many = CalendarUiPolicy.dotStyleForEntries(
            listOf(calendarEntry("one"), calendarEntry("two"), calendarEntry("three")),
        )
        assertEquals(9, many.sizeDp)
        assertEquals("3", many.countText)

        val closing = CalendarUiPolicy.dotStyleForEntries(
            listOf(calendarEntry("closing", HubEventStatus.CLOSING_SOON)),
        )
        assertEquals(CalendarEventDotEmphasis.HIGH, closing.emphasis)

        val inactive = CalendarUiPolicy.dotStyleForEntries(
            listOf(
                calendarEntry("cancelled", HubEventStatus.CANCELLED),
                calendarEntry("ended", HubEventStatus.ENDED),
            ),
        )
        assertEquals(CalendarEventDotEmphasis.MUTED, inactive.emphasis)
    }

    @Test
    fun accessibilityLabelCanIncludeMultiDayEventHint() {
        assertEquals(
            "6월 16일, 기간 포함, 일정 1개, 기간 행사 포함",
            CalendarUiPolicy.accessibilityLabelForDate(
                LocalDate.of(2026, 6, 16),
                CalendarDateMarker.RANGE_MIDDLE_WITH_EVENT,
                entryCount = 1,
                hasMultiDayEntry = true,
            ),
        )
    }

    @Test
    fun durationBarSegmentsClipAtVisibleGridBoundaries() {
        val layout = CalendarUiPolicy.durationBarLayoutForMonth(
            days = listOf(
                day(
                    "2026-05-31",
                    calendarEntry(
                        "grid",
                        startsAt = instant("2026-05-28T01:00:00Z"),
                        endsAt = instant("2026-07-10T14:59:00Z"),
                    ),
                ),
            ),
            month = YearMonth.of(2026, 6),
        )

        assertEquals(5, layout.segments.size)
        assertEquals(0, layout.segments.first().weekIndex)
        assertEquals(0, layout.segments.first().startColumn)
        assertEquals(6, layout.segments.first().endColumn)
        assertFalse(layout.segments.first().startsAtVisibleBoundary)
        assertFalse(layout.segments.last().endsAtVisibleBoundary)
    }

    @Test
    fun durationBarSegmentsIncludeTrailingNextMonthCellsWhenVisible() {
        val layout = CalendarUiPolicy.durationBarLayoutForMonth(
            days = listOf(
                day(
                    "2026-06-26",
                    calendarEntry(
                        "trailing",
                        startsAt = instant("2026-06-26T01:00:00Z"),
                        endsAt = instant("2026-07-02T14:59:00Z"),
                    ),
                ),
            ),
            month = YearMonth.of(2026, 6),
        )

        assertEquals(listOf(5 to 6, 0 to 4), layout.segments.map { it.startColumn to it.endColumn })
        assertTrue(layout.segments.first().startsAtVisibleBoundary)
        assertTrue(layout.segments.last().endsAtVisibleBoundary)
    }

    @Test
    fun durationBarSegmentsIncludeLeadingPreviousMonthCellsWhenVisible() {
        val layout = CalendarUiPolicy.durationBarLayoutForMonth(
            days = listOf(
                day(
                    "2026-05-31",
                    calendarEntry(
                        "leading",
                        startsAt = instant("2026-05-31T01:00:00Z"),
                        endsAt = instant("2026-06-02T14:59:00Z"),
                    ),
                ),
            ),
            month = YearMonth.of(2026, 6),
        )

        assertEquals(listOf(0 to 2), layout.segments.map { it.startColumn to it.endColumn })
        assertTrue(layout.segments.single().startsAtVisibleBoundary)
        assertTrue(layout.segments.single().endsAtVisibleBoundary)
    }

    @Test
    fun durationBarSegmentsSplitAtWeekBoundaries() {
        val layout = CalendarUiPolicy.durationBarLayoutForMonth(
            days = listOf(
                day(
                    "2026-06-26",
                    calendarEntry(
                        "split",
                        startsAt = instant("2026-06-26T01:00:00Z"),
                        endsAt = instant("2026-06-30T14:59:00Z"),
                    ),
                ),
            ),
            month = YearMonth.of(2026, 6),
        )

        assertEquals(listOf(3, 4), layout.segments.map { it.weekIndex })
        assertEquals(listOf(5 to 6, 0 to 2), layout.segments.map { it.startColumn to it.endColumn })
    }

    @Test
    fun durationBarSegmentsStackOverlappingRanges() {
        val layout = CalendarUiPolicy.durationBarLayoutForMonth(
            days = listOf(
                day(
                    "2026-06-10",
                    calendarEntry(
                        "first",
                        startsAt = instant("2026-06-10T01:00:00Z"),
                        endsAt = instant("2026-06-14T14:59:00Z"),
                    ),
                ),
                day(
                    "2026-06-12",
                    calendarEntry(
                        "second",
                        startsAt = instant("2026-06-12T01:00:00Z"),
                        endsAt = instant("2026-06-16T14:59:00Z"),
                    ),
                ),
            ),
            month = YearMonth.of(2026, 6),
        )

        val overlappingWeek = layout.segments.filter { it.weekIndex == 2 }
        assertEquals(listOf(0, 1), overlappingWeek.map { it.lane }.sorted())
        assertEquals(2, layout.laneCountsByWeek.getValue(2))
    }

    @Test
    fun durationBarSegmentsReuseLaneForNonOverlappingRanges() {
        val layout = CalendarUiPolicy.durationBarLayoutForMonth(
            days = listOf(
                day(
                    "2026-06-10",
                    calendarEntry(
                        "first",
                        startsAt = instant("2026-06-10T01:00:00Z"),
                        endsAt = instant("2026-06-11T14:59:00Z"),
                    ),
                ),
                day(
                    "2026-06-12",
                    calendarEntry(
                        "second",
                        startsAt = instant("2026-06-12T01:00:00Z"),
                        endsAt = instant("2026-06-13T14:59:00Z"),
                    ),
                ),
            ),
            month = YearMonth.of(2026, 6),
        )

        assertEquals(listOf(0, 0), layout.segments.map { it.lane })
        assertEquals(1, layout.laneCountsByWeek.getValue(1))
    }

    @Test
    fun durationBarSegmentsDeduplicateProjectedMultiDayEntries() {
        val entry = calendarEntry(
            "same",
            startsAt = instant("2026-06-10T01:00:00Z"),
            endsAt = instant("2026-06-12T14:59:00Z"),
        )
        val layout = CalendarUiPolicy.durationBarLayoutForMonth(
            days = listOf(day("2026-06-10", entry), day("2026-06-11", entry), day("2026-06-12", entry)),
            month = YearMonth.of(2026, 6),
        )

        assertEquals(1, layout.segments.size)
        assertEquals("same", layout.segments.single().eventId)
    }

    @Test
    fun durationBarSegmentsIgnoreSingleDayMissingEndAndInvalidRanges() {
        val layout = CalendarUiPolicy.durationBarLayoutForMonth(
            days = listOf(
                day(
                    "2026-06-10",
                    calendarEntry(
                        "single",
                        startsAt = instant("2026-06-10T01:00:00Z"),
                        endsAt = instant("2026-06-10T14:59:00Z"),
                    ),
                ),
                day(
                    "2026-06-11",
                    calendarEntry(
                        "missing-end",
                        startsAt = instant("2026-06-11T01:00:00Z"),
                        endsAt = null,
                    ),
                ),
                day(
                    "2026-06-12",
                    calendarEntry(
                        "invalid",
                        startsAt = instant("2026-06-12T01:00:00Z"),
                        endsAt = instant("2026-06-11T14:59:00Z"),
                    ),
                ),
            ),
            month = YearMonth.of(2026, 6),
        )

        assertTrue(layout.segments.isEmpty())
        assertTrue(layout.laneCountsByWeek.isEmpty())
    }

    private fun day(date: String, vararg entries: HubCalendarEntry): HubCalendarDay =
        HubCalendarDay(date, entries.toList())

    private fun instant(value: String): Instant = Instant.parse(value)

    private fun hubEvent(
        id: String,
        title: String = "공식 굿즈",
    ): HubEvent =
        HubEvent(
            id = id,
            category = HubEventCategory.ONLINE_GOODS,
            participationMode = HubEventParticipationMode.ONLINE,
            status = HubEventStatus.OPEN,
            title = title,
            generationId = "official",
            sourceUrl = "https://example.com/$id",
            sourceLabel = "공식",
            sourceType = HubEventSourceType.OFFICIAL,
            updatedAt = Instant.parse("2026-06-01T00:00:00Z"),
        )

    private fun birthdayEntry(eventId: String): HubCalendarEntry =
        calendarEntry(
            eventId = eventId,
            entryKind = HubCalendarEntryKind.MEMBER_BIRTHDAY,
            specialDayKind = HubCalendarSpecialDayKind.MEMBER_BIRTHDAY,
            specialDayLabel = "생일",
            status = HubEventStatus.ANNOUNCED,
        )

    private fun calendarEntry(
        eventId: String,
        status: HubEventStatus = HubEventStatus.OPEN,
        displayTimeText: String = "종일",
        entryKind: HubCalendarEntryKind = HubCalendarEntryKind.HUB_EVENT,
        specialDayKind: HubCalendarSpecialDayKind? = null,
        specialDayLabel: String? = null,
        startsAt: Instant? = Instant.parse("2026-06-15T01:00:00Z"),
        endsAt: Instant? = Instant.parse("2026-06-15T14:59:00Z"),
    ): HubCalendarEntry =
        HubCalendarEntry(
            id = "entry-$eventId",
            eventId = eventId,
            entryKind = entryKind,
            specialDayKind = specialDayKind,
            specialDayLabel = specialDayLabel,
            title = "테스트 일정 $eventId",
            category = HubEventCategory.ONLINE_GOODS,
            status = status,
            participationMode = HubEventParticipationMode.ONLINE,
            generationId = "official",
            memberId = null,
            startsAt = startsAt,
            endsAt = endsAt,
            displayDate = "2026-06-15",
            displayTimeText = displayTimeText,
            sourceLabel = "Stellive Official",
            appDeepLink = "stellivehub://hub-events/$eventId",
            platformUrl = "https://example.com/events/$eventId",
        )
}
