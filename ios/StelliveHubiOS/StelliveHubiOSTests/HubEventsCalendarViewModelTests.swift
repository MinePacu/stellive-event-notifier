import XCTest
@testable import StelliveHubiOS

@MainActor
final class HubEventsCalendarViewModelTests: XCTestCase {
    private var calendar: Calendar!

    override func setUp() {
        super.setUp()
        calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "ko_KR")
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
    }

    func testInitialStateUsesDayModeAndListView() {
        let viewModel = makeViewModel(days: [])

        XCTAssertEqual(viewModel.viewMode, .list)
        XCTAssertEqual(viewModel.scopeMode, .day)
        XCTAssertEqual(viewModel.filterId, "all")
        XCTAssertTrue(viewModel.visibleEntries().isEmpty)
    }

    func testSelectedMonthEntriesReturnsOnlyCurrentMonthEntries() {
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-14"),
            days: [
                day("2026-06-13", entries: [entry(id: "june-goods")]),
                day("2026-06-29", entries: [entry(id: "june-ticket", category: .ticketing)]),
                day("2026-07-01", entries: [entry(id: "july-offline", participationMode: .offline)])
            ]
        )

        XCTAssertEqual(viewModel.selectedMonthEntries().map(\.id), ["june-goods", "june-ticket"])
    }

    func testSelectedMonthEntriesRespectsActiveFilter() {
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-14"),
            days: [
                day("2026-06-13", entries: [entry(id: "goods", category: .onlineGoods)]),
                day("2026-06-14", entries: [entry(id: "ticket", category: .ticketing)])
            ]
        )

        viewModel.setFilter("ticketing")

        XCTAssertEqual(viewModel.selectedMonthEntries().map(\.id), ["ticket"])
    }

    func testSelectedMonthEntriesDoNotChangeWhenSelectedDayChangesWithinMonth() {
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-14"),
            days: [
                day("2026-06-13", entries: [entry(id: "goods")]),
                day("2026-06-15", entries: [entry(id: "ticket", category: .ticketing)]),
                day("2026-06-28", entries: [entry(id: "closing", status: .closingSoon)]),
                day("2026-07-01", entries: [entry(id: "next-month")])
            ]
        )

        let initialMonthEntries = viewModel.selectedMonthEntries().map(\.id)

        viewModel.selectDate(date("2026-06-28"))

        XCTAssertEqual(viewModel.selectedMonthEntries().map(\.id), initialMonthEntries)
    }

    func testSelectingDayReturnsEntriesForSelectedDate() {
        let viewModel = makeViewModel(days: [
            day("2026-06-13", entries: [entry(id: "today-open", status: .open)]),
            day("2026-06-14", entries: [entry(id: "tomorrow-closing", status: .closingSoon)])
        ])

        viewModel.selectDate(date("2026-06-14"))

        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["tomorrow-closing"])
        XCTAssertEqual(viewModel.marker(for: date("2026-06-14")), .selectedDay)
    }

    func testRangeSelectionNormalizesReversedDatesAndIncludesAllEntries() {
        let viewModel = makeViewModel(days: [
            day("2026-06-13", entries: [entry(id: "goods-open", status: .open)]),
            day("2026-06-14", entries: [entry(id: "ticket-deadline", category: .ticketing, status: .closingSoon)]),
            day("2026-06-15", entries: [entry(id: "popup-open", category: .offlinePopup, participationMode: .offline, status: .open)])
        ])
        viewModel.setScopeMode(.range)

        viewModel.selectDate(date("2026-06-15"))
        viewModel.selectDate(date("2026-06-13"))

        XCTAssertEqual(viewModel.marker(for: date("2026-06-13")), .rangeStart)
        XCTAssertEqual(viewModel.marker(for: date("2026-06-15")), .rangeEnd)
        XCTAssertEqual(
            viewModel.visibleEntries().map(\.id),
            ["ticket-deadline", "goods-open", "popup-open"]
        )
    }

    func testVisibleEntriesDeduplicatesMultiDayCalendarEntriesByEventId() {
        let first = entry(
            id: "goods-range:2026-06-19",
            eventId: "goods-range",
            startsAt: date("2026-06-19"),
            endsAt: date("2026-07-02")
        )
        let second = entry(
            id: "goods-range:2026-06-20",
            eventId: "goods-range",
            startsAt: date("2026-06-19"),
            endsAt: date("2026-07-02")
        )
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-19"),
            days: [
                day("2026-06-19", entries: [first]),
                day("2026-06-20", entries: [second])
            ]
        )
        viewModel.setScopeMode(.range)

        viewModel.selectDate(date("2026-06-19"))
        viewModel.selectDate(date("2026-06-20"))

        XCTAssertEqual(viewModel.visibleEntries().map(\.eventId), ["goods-range"])
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["goods-range:2026-06-19"])
    }

    func testFeedRowsForMonthDeduplicatesByEventIdAndKeepsFirstVisibleDate() {
        let first = entry(
            id: "goods-range:2026-06-19",
            eventId: "goods-range",
            startsAt: date("2026-06-19"),
            endsAt: date("2026-07-02")
        )
        let second = entry(
            id: "goods-range:2026-06-20",
            eventId: "goods-range",
            startsAt: date("2026-06-19"),
            endsAt: date("2026-07-02")
        )
        let other = entry(
            id: "ticket:2026-06-20",
            eventId: "ticket",
            category: .ticketing
        )

        let rows = HubEventsFeedPolicy.rowsForMonth(
            days: [
                day("2026-06-19", entries: [first]),
                day("2026-06-20", entries: [second, other])
            ],
            selectedMonth: date("2026-06-01"),
            calendar: calendar
        )

        XCTAssertEqual(rows.map(\.entry.eventId), ["goods-range", "ticket"])
        XCTAssertEqual(rows.first?.day.date, "2026-06-19")
    }

    func testFeedRowsCollapseDifferentScheduleItemsIntoOneRootEvent() {
        let rows = HubEventsFeedPolicy.rowsForMonth(
            days: [day("2026-06-20", entries: [
                entry(id: "album:tracks", eventId: "album", scheduleItemId: "tracks"),
                entry(id: "album:release", eventId: "album", scheduleItemId: "release")
            ])],
            selectedMonth: date("2026-06-01"),
            calendar: calendar
        )

        XCTAssertEqual(rows.map(\.entry.eventId), ["album"])
    }

    func testFeedRowsCollapseDateExpansionAndSiblingSchedulesIntoOneRootEvent() {
        let rows = HubEventsFeedPolicy.rowsForMonth(
            days: [
                day("2026-06-20", entries: [entry(id: "album:tracks:20", eventId: "album", scheduleItemId: "tracks")]),
                day("2026-06-21", entries: [entry(id: "album:tracks:21", eventId: "album", scheduleItemId: "tracks")]),
                day("2026-06-22", entries: [entry(id: "album:release", eventId: "album", scheduleItemId: "release")])
            ],
            selectedMonth: date("2026-06-01"),
            calendar: calendar
        )

        XCTAssertEqual(rows.map(\.entry.eventId), ["album"])
    }

    func testFeedRowsForDayReturnsOnlySelectedDaySingleDayEntries() {
        let rows = HubEventsFeedPolicy.rowsForDay(
            days: [
                day("2026-06-19", entries: [entry(id: "before")]),
                day("2026-06-20", entries: [entry(id: "picked-b"), entry(id: "picked-a")]),
                day("2026-06-21", entries: [entry(id: "after")])
            ],
            selectedDay: date("2026-06-20"),
            calendar: calendar
        )

        XCTAssertEqual(rows.map(\.entry.eventId), ["picked-a", "picked-b"])
        XCTAssertEqual(Set(rows.map(\.day.date)), ["2026-06-20"])
    }

    func testFeedRowsForDayShowsMultiDayEventOnceOnEverySpannedDay() {
        func spanning(_ dayKey: String) -> HubCalendarEntry {
            entry(
                id: "goods-range:\(dayKey)",
                eventId: "goods-range",
                startsAt: date("2026-06-19"),
                endsAt: date("2026-06-21")
            )
        }
        let days = [
            day("2026-06-19", entries: [spanning("2026-06-19")]),
            day("2026-06-20", entries: [spanning("2026-06-20"), entry(id: "ticket", category: .ticketing)]),
            day("2026-06-21", entries: [spanning("2026-06-21")])
        ]

        for key in ["2026-06-19", "2026-06-20", "2026-06-21"] {
            let rows = HubEventsFeedPolicy.rowsForDay(days: days, selectedDay: date(key), calendar: calendar)
            XCTAssertEqual(rows.filter { $0.entry.eventId == "goods-range" }.count, 1, key)
            XCTAssertEqual(rows.first { $0.entry.eventId == "goods-range" }?.day.date, key)
        }
        XCTAssertEqual(
            HubEventsFeedPolicy.rowsForDay(days: days, selectedDay: date("2026-06-20"), calendar: calendar)
                .map(\.entry.eventId),
            ["goods-range", "ticket"]
        )
        XCTAssertTrue(
            HubEventsFeedPolicy.rowsForDay(days: days, selectedDay: date("2026-06-22"), calendar: calendar).isEmpty
        )
    }

    func testFeedRowsForDayCollapsesSiblingSchedulesOfOneRootEvent() {
        let rows = HubEventsFeedPolicy.rowsForDay(
            days: [day("2026-06-20", entries: [
                entry(id: "album:tracks", eventId: "album", scheduleItemId: "tracks"),
                entry(id: "album:release", eventId: "album", scheduleItemId: "release")
            ])],
            selectedDay: date("2026-06-20"),
            calendar: calendar
        )

        XCTAssertEqual(rows.map(\.entry.eventId), ["album"])
    }

    func testFeedRowsForDayReturnsEmptyForDayWithoutEntries() {
        let days = [day("2026-06-19", entries: [entry(id: "goods")])]

        XCTAssertTrue(
            HubEventsFeedPolicy.rowsForDay(days: days, selectedDay: date("2026-06-20"), calendar: calendar).isEmpty
        )
        XCTAssertTrue(HubEventsFeedPolicy.rowsForDay(days: [], selectedDay: date("2026-06-20"), calendar: calendar).isEmpty)
    }

    func testFeedRowsForDayUsesSeoulDayBoundary() {
        let days = [
            day("2026-06-19", entries: [entry(id: "june-19")]),
            day("2026-06-20", entries: [entry(id: "june-20")])
        ]

        // 2026-06-19T14:59:59Z == 2026-06-19 23:59:59 KST; 15:00:00Z == 2026-06-20 00:00:00 KST.
        let lastSecondOf19th = HubEventsFeedPolicy.rowsForDay(
            days: days,
            selectedDay: dateTime("2026-06-19T14:59:59Z"),
            calendar: calendar
        )
        let firstSecondOf20th = HubEventsFeedPolicy.rowsForDay(
            days: days,
            selectedDay: dateTime("2026-06-19T15:00:00Z"),
            calendar: calendar
        )

        XCTAssertEqual(lastSecondOf19th.map(\.entry.eventId), ["june-19"])
        XCTAssertEqual(firstSecondOf20th.map(\.entry.eventId), ["june-20"])
    }

    func testFeedRowsForDayMatchesMonthRowsRestrictedToThatDay() {
        let days = [
            day("2026-06-19", entries: [entry(id: "b", title: "B"), entry(id: "a", title: "A")]),
            day("2026-06-20", entries: [entry(id: "c", title: "C")])
        ]

        let monthRows = HubEventsFeedPolicy.rowsForMonth(days: days, selectedMonth: date("2026-06-01"), calendar: calendar)
        let dayRows = HubEventsFeedPolicy.rowsForDay(days: days, selectedDay: date("2026-06-19"), calendar: calendar)

        XCTAssertEqual(dayRows.map(\.id), monthRows.filter { $0.day.date == "2026-06-19" }.map(\.id))
    }

    func testToggledDayFilterSelectsThenClearsOnSameDayTap() {
        let june20 = date("2026-06-20")
        let june21 = date("2026-06-21")

        XCTAssertEqual(HubEventsFeedPolicy.toggledDayFilter(current: nil, tapped: june20, calendar: calendar), june20)
        XCTAssertNil(HubEventsFeedPolicy.toggledDayFilter(current: june20, tapped: june20, calendar: calendar))
        XCTAssertNil(
            HubEventsFeedPolicy.toggledDayFilter(
                current: june20,
                tapped: dateTime("2026-06-20T05:00:00Z"),
                calendar: calendar
            )
        )
        XCTAssertEqual(HubEventsFeedPolicy.toggledDayFilter(current: june20, tapped: june21, calendar: calendar), june21)
    }

    func testDayFilterIsClearedWhenDisplayedMonthChanges() {
        let june20 = date("2026-06-20")

        XCTAssertEqual(
            HubEventsFeedPolicy.dayFilter(june20, retainedForMonth: date("2026-06-01"), calendar: calendar),
            june20
        )
        // Same month, different reference date inside the month (e.g. the calendar auto-jumping to its first entry).
        XCTAssertEqual(
            HubEventsFeedPolicy.dayFilter(june20, retainedForMonth: date("2026-06-03"), calendar: calendar),
            june20
        )
        XCTAssertNil(HubEventsFeedPolicy.dayFilter(june20, retainedForMonth: date("2026-07-01"), calendar: calendar))
        XCTAssertNil(HubEventsFeedPolicy.dayFilter(june20, retainedForMonth: date("2026-05-01"), calendar: calendar))
        XCTAssertNil(HubEventsFeedPolicy.dayFilter(nil, retainedForMonth: date("2026-06-01"), calendar: calendar))
    }

    func testFeedDayTitleUsesLocalizedShortDayFormat() {
        XCTAssertEqual(HubEventsView.feedDayTitle(for: date("2026-09-18")), "9월 18일 (금)")
    }

    func testCalendarEntryDecodesLegacyResponseWithoutDisplayTitle() throws {
        let data = Data(#"{"id":"album:tracks","eventId":"album","entryKind":"hub_event","scheduleItemId":"tracks","scheduleLabel":"트랙 리스트 공개","title":"부모 음반","category":"online_goods","status":"upcoming","participationMode":"online","generationId":"official","displayDate":"2026-06-20","displayTimeText":"18:00 시작","sourceLabel":"공식","appDeepLink":"stellivehub://hub-events/album?scheduleItemId=tracks"}"#.utf8)

        let decoded = try JSONDecoder().decode(HubCalendarEntry.self, from: data)

        XCTAssertNil(decoded.displayTitle)
        XCTAssertEqual(decoded.tags, [])
        XCTAssertEqual(decoded.resolvedDisplayTitle, "트랙 리스트 공개")
    }

    func testCalendarEntryDecodesAlbumAndIgnoresUnknownTags() throws {
        let data = Data(#"{"id":"album:tracks","eventId":"album","entryKind":"hub_event","title":"부모 음반","category":"ticketing","tags":["album","future_tag"],"status":"upcoming","participationMode":"online","generationId":"official","displayDate":"2026-06-20","displayTimeText":"18:00 시작","sourceLabel":"공식","appDeepLink":"stellivehub://hub-events/album"}"#.utf8)

        let decoded = try JSONDecoder().decode(HubCalendarEntry.self, from: data)

        XCTAssertEqual(decoded.tags, [.album])
    }

    func testCalendarEntryDecodesDisplayTitleWhenPresent() throws {
        let data = Data(#"{"id":"album:tracks","eventId":"album","entryKind":"hub_event","scheduleItemId":"tracks","scheduleLabel":"레거시 레이블","title":"부모 음반","displayTitle":"트랙 리스트 공개","category":"online_goods","status":"upcoming","participationMode":"online","generationId":"official","displayDate":"2026-06-20","displayTimeText":"18:00 시작","sourceLabel":"공식","appDeepLink":"stellivehub://hub-events/album?scheduleItemId=tracks"}"#.utf8)

        let decoded = try JSONDecoder().decode(HubCalendarEntry.self, from: data)

        XCTAssertEqual(decoded.displayTitle, "트랙 리스트 공개")
        XCTAssertEqual(decoded.resolvedDisplayTitle, "트랙 리스트 공개")
    }

    func testSpecialDayPresentationRemainsCompatible() {
        let birthday = entry(id: "birthday", eventId: "birthday", title: "멤버 생일", entryKind: .memberBirthday)

        XCTAssertEqual(birthday.resolvedDisplayTitle, "멤버 생일")
    }

    func testRootFeedCardOmitsSchedulePresentationAndSelection() {
        let event = detailEvent()
        let presentation = HubEventFeedCardPresentation(event: event)

        XCTAssertEqual(presentation.parentTitle, event.title)
        XCTAssertEqual(presentation.status, event.status)
        XCTAssertFalse(presentation.accessibilityLabel.contains("트랙 리스트"))
    }

    func testRangeMiddleMarkerDistinguishesDatesWithAndWithoutEntries() {
        let viewModel = makeViewModel(days: [
            day("2026-06-13", entries: [entry(id: "start")]),
            day("2026-06-14", entries: [entry(id: "middle")]),
            day("2026-06-16", entries: [entry(id: "end")])
        ])
        viewModel.setScopeMode(.range)
        viewModel.selectDate(date("2026-06-13"))
        viewModel.selectDate(date("2026-06-16"))

        XCTAssertEqual(viewModel.marker(for: date("2026-06-14")), .rangeMiddleWithEvent)
        XCTAssertEqual(viewModel.marker(for: date("2026-06-15")), .rangeMiddleEmpty)
    }

    func testFilteringEntries() {
        let viewModel = makeViewModel(days: [
            day("2026-06-13", entries: [
                entry(id: "goods", category: .onlineGoods, tags: [.album]),
                entry(id: "album-ticket", category: .ticketing, tags: [.album]),
                entry(id: "ticket", category: .ticketing),
                entry(id: "offline", category: .offlinePopup, participationMode: .offline),
                entry(id: "closing", category: .offlinePopup, status: .closingSoon)
            ])
        ])

        viewModel.setFilter("goods")
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["goods"])

        viewModel.setFilter("album")
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["album-ticket", "goods"])

        viewModel.setFilter("ticketing")
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["album-ticket", "ticket"])

        viewModel.setFilter("offline")
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["offline"])

        viewModel.setFilter("closing")
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["closing"])
    }

    func testTopFilterIncludesAlbumWithDiscDisplayName() {
        XCTAssertEqual(
            HubEventsView.filterOptions.first { $0.id == "album" }?.title,
            "음반"
        )
    }

    func testMonthNavigationChangesSelectedMonth() {
        let viewModel = makeViewModel(selectedDay: date("2026-06-13"), days: [])

        viewModel.goToNextMonth()
        XCTAssertTrue(calendar.isDate(viewModel.selectedMonth, equalTo: date("2026-07-13"), toGranularity: .month))

        viewModel.goToPreviousMonth()
        XCTAssertTrue(calendar.isDate(viewModel.selectedMonth, equalTo: date("2026-06-13"), toGranularity: .month))
    }

    func testAccessibilityLabelIncludesRangeAndEntryCount() {
        let viewModel = makeViewModel(days: [
            day("2026-06-13", entries: [entry(id: "start")]),
            day("2026-06-14", entries: [entry(id: "middle")]),
            day("2026-06-15", entries: [entry(id: "end")])
        ])
        viewModel.setScopeMode(.range)
        viewModel.selectDate(date("2026-06-13"))
        viewModel.selectDate(date("2026-06-15"))

        XCTAssertEqual(viewModel.accessibilityLabel(for: date("2026-06-14")), "6월 14일, 기간 포함, 일정 1개")
    }

    func testEntrySpanKindDistinguishesSingleDayAndMultiDayPositions() {
        let viewModel = makeViewModel(days: [])
        let singleDay = entry(
            id: "single",
            startsAt: dateTime("2026-06-15T01:00:00Z"),
            endsAt: dateTime("2026-06-15T14:59:00Z")
        )
        let multiDay = entry(
            id: "multi",
            startsAt: dateTime("2026-06-15T01:00:00Z"),
            endsAt: dateTime("2026-06-17T14:59:00Z")
        )

        XCTAssertEqual(viewModel.spanKind(for: singleDay, on: date("2026-06-15")), .singleDay)
        XCTAssertEqual(viewModel.spanKind(for: multiDay, on: date("2026-06-15")), .multiDayStart)
        XCTAssertEqual(viewModel.spanKind(for: multiDay, on: date("2026-06-16")), .multiDayMiddle)
        XCTAssertEqual(viewModel.spanKind(for: multiDay, on: date("2026-06-17")), .multiDayEnd)
    }

    func testDotStyleScalesWithEntryCountAndStatusImportance() {
        let viewModel = makeViewModel(days: [])

        XCTAssertFalse(viewModel.dotStyle(for: []).visible)

        let one = viewModel.dotStyle(for: [entry(id: "one")])
        XCTAssertTrue(one.visible)
        XCTAssertEqual(one.size, 5)
        XCTAssertEqual(one.emphasis, .normal)

        let two = viewModel.dotStyle(for: [entry(id: "one"), entry(id: "two")])
        XCTAssertEqual(two.size, 6)

        let many = viewModel.dotStyle(for: [entry(id: "one"), entry(id: "two"), entry(id: "three")])
        XCTAssertEqual(many.size, 8)
        XCTAssertEqual(many.countText, "3")

        let closing = viewModel.dotStyle(for: [entry(id: "closing", status: .closingSoon)])
        XCTAssertEqual(closing.emphasis, .high)

        let inactive = viewModel.dotStyle(for: [
            entry(id: "cancelled", status: .cancelled),
            entry(id: "ended", status: .ended),
        ])
        XCTAssertEqual(inactive.emphasis, .muted)
    }

    func testDurationBarSegmentsClipAtVisibleGridBoundaries() {
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-15"),
            days: [
                day("2026-05-31", [entry(id: "grid", startsAt: dateTime("2026-05-28T01:00:00Z"), endsAt: dateTime("2026-07-10T14:59:00Z"))])
            ]
        )

        let layout = viewModel.durationBarLayoutForSelectedMonth()

        XCTAssertEqual(layout.segments.count, 5)
        XCTAssertEqual(layout.segments.first?.weekIndex, 0)
        XCTAssertEqual(layout.segments.first?.startColumn, 0)
        XCTAssertEqual(layout.segments.first?.endColumn, 6)
        XCTAssertEqual(layout.segments.first?.startsAtVisibleBoundary, false)
        XCTAssertEqual(layout.segments.last?.endsAtVisibleBoundary, false)
    }

    func testDurationBarSegmentsIncludeTrailingNextMonthCellsWhenVisible() {
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-15"),
            days: [
                day("2026-06-26", [entry(id: "trailing", startsAt: dateTime("2026-06-26T01:00:00Z"), endsAt: dateTime("2026-07-02T14:59:00Z"))])
            ]
        )

        let layout = viewModel.durationBarLayoutForSelectedMonth()

        XCTAssertEqual(layout.segments.map { [$0.startColumn, $0.endColumn] }, [[5, 6], [0, 4]])
        XCTAssertEqual(layout.segments.first?.startsAtVisibleBoundary, true)
        XCTAssertEqual(layout.segments.last?.endsAtVisibleBoundary, true)
    }

    func testDurationBarSegmentsIncludeLeadingPreviousMonthCellsWhenVisible() {
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-15"),
            days: [
                day("2026-05-31", [entry(id: "leading", startsAt: dateTime("2026-05-31T01:00:00Z"), endsAt: dateTime("2026-06-02T14:59:00Z"))])
            ]
        )

        let layout = viewModel.durationBarLayoutForSelectedMonth()

        XCTAssertEqual(layout.segments.map { [$0.startColumn, $0.endColumn] }, [[0, 2]])
        XCTAssertEqual(layout.segments.first?.startsAtVisibleBoundary, true)
        XCTAssertEqual(layout.segments.first?.endsAtVisibleBoundary, true)
    }

    func testDurationBarSegmentsSplitAtWeekBoundaries() {
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-15"),
            days: [
                day("2026-06-26", [entry(id: "split", startsAt: dateTime("2026-06-26T01:00:00Z"), endsAt: dateTime("2026-06-30T14:59:00Z"))])
            ]
        )

        let layout = viewModel.durationBarLayoutForSelectedMonth()

        XCTAssertEqual(layout.segments.map(\.weekIndex), [3, 4])
        XCTAssertEqual(layout.segments.map { [$0.startColumn, $0.endColumn] }, [[5, 6], [0, 2]])
    }

    func testDurationBarSegmentsStackOverlappingRanges() {
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-15"),
            days: [
                day("2026-06-10", [entry(id: "first", startsAt: dateTime("2026-06-10T01:00:00Z"), endsAt: dateTime("2026-06-14T14:59:00Z"))]),
                day("2026-06-12", [entry(id: "second", startsAt: dateTime("2026-06-12T01:00:00Z"), endsAt: dateTime("2026-06-16T14:59:00Z"))])
            ]
        )

        let layout = viewModel.durationBarLayoutForSelectedMonth()
        let overlappingWeek = layout.segments.filter { $0.weekIndex == 2 }

        XCTAssertEqual(overlappingWeek.map(\.lane).sorted(), [0, 1])
        XCTAssertEqual(layout.laneCountsByWeek[2], 2)
    }

    func testDurationBarSegmentsReuseLaneForNonOverlappingRanges() {
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-15"),
            days: [
                day("2026-06-10", [entry(id: "first", startsAt: dateTime("2026-06-10T01:00:00Z"), endsAt: dateTime("2026-06-11T14:59:00Z"))]),
                day("2026-06-12", [entry(id: "second", startsAt: dateTime("2026-06-12T01:00:00Z"), endsAt: dateTime("2026-06-13T14:59:00Z"))])
            ]
        )

        let layout = viewModel.durationBarLayoutForSelectedMonth()

        XCTAssertEqual(layout.segments.map(\.lane), [0, 0])
        XCTAssertEqual(layout.laneCountsByWeek[1], 1)
    }

    func testDurationBarSegmentsDeduplicateProjectedMultiDayEntries() {
        let projected = entry(id: "same", startsAt: dateTime("2026-06-10T01:00:00Z"), endsAt: dateTime("2026-06-12T14:59:00Z"))
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-15"),
            days: [
                day("2026-06-10", [projected]),
                day("2026-06-11", [projected]),
                day("2026-06-12", [projected])
            ]
        )

        let layout = viewModel.durationBarLayoutForSelectedMonth()

        XCTAssertEqual(layout.segments.count, 1)
        XCTAssertEqual(layout.segments.first?.eventId, "same")
    }

    func testDurationBarSegmentsIgnoreSingleDayMissingEndAndInvalidRanges() {
        let viewModel = makeViewModel(
            selectedDay: date("2026-06-15"),
            days: [
                day("2026-06-10", [entry(id: "single", startsAt: dateTime("2026-06-10T01:00:00Z"), endsAt: dateTime("2026-06-10T14:59:00Z"))]),
                day("2026-06-11", [entry(id: "missing-end", startsAt: dateTime("2026-06-11T01:00:00Z"), endsAt: nil)]),
                day("2026-06-12", [entry(id: "invalid", startsAt: dateTime("2026-06-12T01:00:00Z"), endsAt: dateTime("2026-06-11T14:59:00Z"))])
            ]
        )

        let layout = viewModel.durationBarLayoutForSelectedMonth()

        XCTAssertTrue(layout.segments.isEmpty)
        XCTAssertTrue(layout.laneCountsByWeek.isEmpty)
    }

    func testAccessibilityLabelCanIncludeMultiDayEventHint() {
        let viewModel = makeViewModel(days: [
            day("2026-06-16", entries: [
                entry(
                    id: "multi",
                    startsAt: dateTime("2026-06-15T01:00:00Z"),
                    endsAt: dateTime("2026-06-17T14:59:00Z")
                )
            ])
        ])
        viewModel.setScopeMode(.range)
        viewModel.selectDate(date("2026-06-15"))
        viewModel.selectDate(date("2026-06-17"))

        XCTAssertEqual(viewModel.accessibilityLabel(for: date("2026-06-16")), "6월 16일, 기간 포함, 일정 1개, 기간 행사 포함")
    }

    func testListDayNavigationUpdatesSelectedDayAndVisibleEntries() {
        let viewModel = makeViewModel(selectedDay: date("2026-06-14"), days: [
            day("2026-06-14", entries: []),
            day("2026-06-15", entries: [entry(id: "goods-open")])
        ])

        viewModel.setViewMode(.list)
        viewModel.goToNextDay()

        XCTAssertEqual(viewModel.selectedDay, date("2026-06-15"))
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["goods-open"])

        viewModel.goToPreviousDay()

        XCTAssertEqual(viewModel.selectedDay, date("2026-06-14"))
        XCTAssertTrue(viewModel.visibleEntries().isEmpty)
    }

    func testTodayActionKeepsListModeAndSelectsToday() {
        let viewModel = makeViewModel(selectedDay: date("2026-06-20"), days: [])

        viewModel.setViewMode(.list)
        viewModel.goToToday()

        XCTAssertEqual(viewModel.viewMode, .list)
        XCTAssertEqual(viewModel.selectedDay, date("2026-06-13"))
    }

    func testListRangeNavigationKeepsRangeLength() {
        let viewModel = makeViewModel(days: [])

        viewModel.setViewMode(.list)
        viewModel.setScopeMode(.range)
        viewModel.selectDate(date("2026-06-16"))
        viewModel.selectDate(date("2026-06-22"))
        viewModel.goToNextRange()

        XCTAssertEqual(viewModel.rangeStart, date("2026-06-23"))
        XCTAssertEqual(viewModel.rangeEnd, date("2026-06-29"))

        viewModel.goToPreviousRange()

        XCTAssertEqual(viewModel.rangeStart, date("2026-06-16"))
        XCTAssertEqual(viewModel.rangeEnd, date("2026-06-22"))
    }

    func testCurrentWeekActionSelectsMondayThroughSundayRange() {
        let viewModel = makeViewModel(days: [])

        viewModel.setViewMode(.list)
        viewModel.goToCurrentWeek()

        XCTAssertEqual(viewModel.scopeMode, .range)
        XCTAssertEqual(viewModel.rangeStart, date("2026-06-08"))
        XCTAssertEqual(viewModel.rangeEnd, date("2026-06-14"))
    }

    func testApplyingSelectedDayKeepsListModeAndUpdatesEntries() {
        let viewModel = makeViewModel(days: [
            day("2026-06-15", entries: [entry(id: "goods-open")])
        ])

        viewModel.setViewMode(.list)
        viewModel.applySelectedDay(date("2026-06-15"))

        XCTAssertEqual(viewModel.viewMode, .list)
        XCTAssertEqual(viewModel.scopeMode, .day)
        XCTAssertEqual(viewModel.selectedDay, date("2026-06-15"))
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["goods-open"])
    }

    func testReplacingInitiallyEmptyDaysSelectsFirstVisibleServerDay() {
        let viewModel = makeViewModel(selectedDay: date("2026-06-19"), days: [])

        viewModel.replaceDays([
            day("2026-07-11", entries: [entry(id: "admin-event")])
        ])

        XCTAssertEqual(viewModel.selectedMonth, date("2026-07-11"))
        XCTAssertEqual(viewModel.selectedDay, date("2026-07-11"))
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["admin-event"])
    }

    func testApplyingSelectedRangeKeepsListModeAndNormalizesDates() {
        let viewModel = makeViewModel(days: [])

        viewModel.setViewMode(.list)
        viewModel.applySelectedRange(start: date("2026-06-22"), end: date("2026-06-16"))

        XCTAssertEqual(viewModel.viewMode, .list)
        XCTAssertEqual(viewModel.scopeMode, .range)
        XCTAssertEqual(viewModel.rangeStart, date("2026-06-16"))
        XCTAssertEqual(viewModel.rangeEnd, date("2026-06-22"))
    }

    func testHubEventDetailRowsUseSharedOrder() {
        let rows = HubEventDetailFormatting.rows(for: detailEvent())

        XCTAssertEqual(rows.map(\.label), ["장소", "시작", "기간", "참여 방식", "분류", "출처"])
    }

    func testHubEventMapLinkRejectsBlankVenue() {
        XCTAssertNil(HubEventMapLink.url(for: ""))
        XCTAssertNil(HubEventMapLink.url(for: "  \n\t "))
    }

    func testHubEventMapLinkPercentEncodesKoreanVenue() {
        let url = HubEventMapLink.url(for: " 더현대 서울 ")

        XCTAssertEqual(
            url?.absoluteString,
            "http://maps.apple.com/?q=%EB%8D%94%ED%98%84%EB%8C%80%20%EC%84%9C%EC%9A%B8"
        )
    }

    func testHubEventMapLinkEncodesReservedCharactersInQueryValue() {
        let url = HubEventMapLink.url(for: "A&B #2 +1?x=y")

        XCTAssertEqual(url?.absoluteString, "http://maps.apple.com/?q=A%26B%20%232%20%2B1%3Fx%3Dy")
        XCTAssertEqual(
            url.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false) }?.queryItems?.first?.value,
            "A&B #2 +1?x=y"
        )
    }

    func testHubEventDetailVenueRowLinksToMapOnlyForOfflineEvents() {
        let offline = detailEvent()
        let offlineVenue = HubEventDetailFormatting.rows(for: offline).first { $0.label == "장소" }
        XCTAssertEqual(offlineVenue?.mapURL, HubEventMapLink.url(for: "더현대 서울 B2 아이코닉 스퀘어"))

        let online = detailEvent(participationMode: .online)
        let onlineVenue = HubEventDetailFormatting.rows(for: online).first { $0.label == "장소" }
        XCTAssertNotNil(onlineVenue)
        XCTAssertNil(onlineVenue?.mapURL)
    }

    func testHubEventDetailPeriodTextForStartOnlyEventDoesNotShowUnknownEnd() {
        let rows = HubEventDetailFormatting.rows(for: startOnlyDetailEvent())
        let period = rows.first { $0.label == "기간" }?.value

        XCTAssertEqual(period, "2026.06.17 (수) 19:00 시작")
        XCTAssertFalse(period?.contains("종료 미정") ?? false)
    }

    func testHubEventDetailHeroSubtitleSplitsVenueAndPeriodAcrossLines() {
        XCTAssertEqual(
            HubEventDetailFormatting.heroSubtitleLines(for: detailEvent()),
            [
                "더현대 서울 B2 아이코닉 스퀘어",
                "2026.06.17 (수) 19:00 - 2026.06.23 (화) 21:00"
            ]
        )
    }

    func testHubEventDetailHeroTagsAreDeduplicatedAndUseDistinctTones() {
        let tags = HubEventDetailFormatting.heroTags(for: detailEvent())

        XCTAssertEqual(tags.map(\.label), ["진행 중", "굿즈", "오프라인"])
        XCTAssertEqual(tags.map(\.tone), [.status, .category, .participation])
        XCTAssertEqual(Set(tags.map(\.label)).count, tags.count)
    }

    func testAlbumUsesSecondaryDisplayChipWithoutReplacingStatusOrCategory() {
        var event = detailEvent()
        event.tags = [.album]

        let card = HubEventFeedCardPresentation(event: event)
        let heroTags = HubEventDetailFormatting.heroTags(for: event)

        XCTAssertEqual(card.status, .open)
        XCTAssertEqual(card.secondaryTagLabels, ["음반"])
        XCTAssertEqual(heroTags.map(\.label), ["진행 중", "굿즈", "오프라인", "음반"])
        XCTAssertEqual(heroTags.map(\.tone), [.status, .category, .participation, .supplementary])
    }

    func testHubEventTimelineSortsAndComputesDisplayStates() {
        var event = detailEvent()
        event.scheduleMode = .timeline
        event.scheduleItems = [
            schedule("future", "2026-06-20T00:00:00Z"),
            schedule("completed", "2026-06-10T00:00:00Z"),
            schedule("current", "2026-06-12T00:00:00Z", endsAt: "2026-06-14T00:00:00Z"),
            schedule("cancelled", "2026-06-11T00:00:00Z", cancelled: true)
        ]

        let timeline = HubEventDetailFormatting.timeline(for: event, now: dateTime("2026-06-13T00:00:00Z"))

        XCTAssertEqual(timeline.map(\.schedule.id), ["completed", "cancelled", "current", "future"])
        XCTAssertEqual(timeline.map(\.stateText), ["완료", "취소", "진행", "예정"])
    }

    func testTimelinePolicyHidesParentPeriodAndSelectsNextActiveSchedule() {
        var event = detailEvent()
        event.scheduleMode = .timeline
        event.scheduleItems = [
            schedule("cancelled", "2026-06-14T00:00:00Z", cancelled: true),
            schedule("next", "2026-06-20T00:00:00Z")
        ]

        XCTAssertFalse(HubEventDetailFormatting.rows(for: event).contains { $0.label == "시작" || $0.label == "기간" })
        XCTAssertEqual(HubEventDetailFormatting.activeScheduleItems(event).map(\.id), ["next"])
        XCTAssertEqual(HubEventDetailFormatting.nextScheduleItem(event, now: dateTime("2026-06-15T00:00:00Z"))?.id, "next")
        XCTAssertEqual(
            HubEventDetailFormatting.heroSubtitleLines(for: event, now: dateTime("2026-06-15T00:00:00Z")).last,
            "다음 일정 · next · 2026.06.20 (토) 09:00"
        )
    }

    func testScheduleDisplayTitlePrefersTitleThenLabelThenLocalizedKind() {
        let base = schedule("label", "2026-06-20T00:00:00Z")

        XCTAssertEqual(HubEventDetailFormatting.displayTitle(schedule("label", "2026-06-20T00:00:00Z", title: "  상세 제목  ")), "상세 제목")
        XCTAssertEqual(HubEventDetailFormatting.displayTitle(schedule("label", "2026-06-20T00:00:00Z", title: "   ")), "label")
        XCTAssertEqual(
            HubEventDetailFormatting.displayTitle(schedule("item", "2026-06-20T00:00:00Z", kind: .salesOpen, label: " ")),
            "판매 시작"
        )
        XCTAssertEqual(HubEventDetailFormatting.displayTitle(base), "label")
    }

    func testScheduleDescriptionTreatsNullEmptyAndWhitespaceAsMissing() {
        XCTAssertNil(HubEventDetailFormatting.scheduleDescription(schedule("item", "2026-06-20T00:00:00Z")))
        XCTAssertNil(HubEventDetailFormatting.scheduleDescription(schedule("item", "2026-06-20T00:00:00Z", description: "")))
        XCTAssertNil(HubEventDetailFormatting.scheduleDescription(schedule("item", "2026-06-20T00:00:00Z", description: "   ")))
        XCTAssertEqual(
            HubEventDetailFormatting.scheduleDescription(schedule("item", "2026-06-20T00:00:00Z", description: "  설명  ")),
            "설명"
        )
    }

    func testTimelineHeroUsesDetailedTitleInsteadOfShortLabel() {
        var event = detailEvent()
        event.scheduleMode = .timeline
        event.scheduleItems = [schedule("short", "2026-06-20T00:00:00Z", title: "상세 일정 제목")]

        XCTAssertEqual(
            HubEventDetailFormatting.heroSubtitleLines(for: event, now: dateTime("2026-06-15T00:00:00Z")).last,
            "다음 일정 · 상세 일정 제목 · 2026.06.20 (토) 09:00"
        )
    }

    func testScheduleActionPolicyUsesHttpsAndKindSpecificLabels() {
        let item = schedule(
            "sales",
            "2026-06-20T00:00:00Z",
            kind: .salesOpen,
            actionURL: "http://unsafe.example/action",
            sourceURL: "https://safe.example/source"
        )

        XCTAssertEqual(HubEventDetailFormatting.scheduleActionURL(item)?.absoluteString, "https://safe.example/source")
        XCTAssertEqual(HubEventDetailFormatting.scheduleActionLabel(.salesOpen), "구매/예약 페이지")
        XCTAssertEqual(HubEventDetailFormatting.scheduleActionLabel(.ticketOpen), "티켓 페이지")
        XCTAssertEqual(HubEventDetailFormatting.scheduleActionLabel(.contentReveal), "콘텐츠")
        XCTAssertEqual(HubEventDetailFormatting.scheduleActionLabel(.announcement), "공지")
        XCTAssertEqual(HubEventDetailFormatting.scheduleActionLabel(.deadline), "상세 보기")
    }

    func testScheduleScrollPolicyOnlyTargetsFirstDisplayOrChangedID() {
        XCTAssertEqual(HubEventScheduleScrollPolicy.target(highlightedID: "schedule-1", lastScrolledID: nil), "schedule-1")
        XCTAssertNil(HubEventScheduleScrollPolicy.target(highlightedID: "schedule-1", lastScrolledID: "schedule-1"))
        XCTAssertEqual(HubEventScheduleScrollPolicy.target(highlightedID: "schedule-2", lastScrolledID: "schedule-1"), "schedule-2")
        XCTAssertNil(HubEventScheduleScrollPolicy.target(highlightedID: nil, lastScrolledID: "schedule-1"))
    }

    func testHubEventHeroTagStyleUsesReadableImageOverlayOpacities() {
        XCTAssertEqual(HubEventHeroTagStyle.backgroundOpacity, 0.78, accuracy: 0.001)
        XCTAssertEqual(HubEventHeroTagStyle.borderOpacity, 0.95, accuracy: 0.001)
        XCTAssertEqual(HubEventHeroTagStyle.shadowOpacity, 0.35, accuracy: 0.001)
    }

    func testCalendarEntryDisplaysStartOnlyEventAsStartTime() {
        let store = MockHubStore()
        let entry = store.calendarDays(for: "all")
            .flatMap(\.entries)
            .first { $0.eventId == "upcoming-offline-popup" }

        XCTAssertNil(entry?.endsAt)
        XCTAssertEqual(entry?.displayTimeText.hasSuffix("시작"), true)
        XCTAssertEqual(entry?.displayTimeText.contains("마감"), false)
    }

    func testHubEventDetailNoticeCopyMatchesDesignSource() {
        XCTAssertEqual(
            HubEventDetailFormatting.noticeText,
            "일정, 장소, 판매/입장 조건은 공식 공지 변경에 따라 달라질 수 있습니다. 앱은 확인용 요약만 제공하므로 참여 전 반드시 출처 링크에서 최신 공지를 확인하세요."
        )
    }

    func testHubEventDetailSummaryLabelDoesNotRepeatTitle() {
        let event = detailEvent()

        XCTAssertEqual(HubEventDetailFormatting.summaryLabel, "핵심 안내")
        XCTAssertFalse(HubEventDetailFormatting.summaryLabel.contains(event.title))
    }

    func testHubEventDetailLinkActionLabelFollowsCategory() {
        XCTAssertEqual(HubEventDetailFormatting.linkActionLabel(for: .onlineGoods), "구매 링크")
        XCTAssertEqual(HubEventDetailFormatting.linkActionLabel(for: .onlineCollab), "구매 링크")
        XCTAssertEqual(HubEventDetailFormatting.linkActionLabel(for: .offlineConcert), "티켓 링크")
        XCTAssertEqual(HubEventDetailFormatting.linkActionLabel(for: .ticketing), "티켓 링크")
        XCTAssertEqual(HubEventDetailFormatting.linkActionLabel(for: .offlineCollab), "예약 링크")
        XCTAssertEqual(HubEventDetailFormatting.linkActionLabel(for: .offlinePopup), "예약 링크")
    }

    private func detailEvent(participationMode: HubEventParticipationMode = .offline) -> HubEvent {
        HubEvent(
            id: "popup-store",
            category: .onlineGoods,
            participationMode: participationMode,
            status: .open,
            title: "팝업 스토어 현장 입장 시작",
            summary: "현장 입장과 굿즈 판매가 함께 진행됩니다.",
            memberId: nil,
            generationId: "official",
            sourceUrl: "https://example.com/source",
            sourceLabel: "공식 공지 기반 HubEvent",
            sourceType: .official,
            announcedAt: dateTime("2026-06-10T01:00:00Z"),
            startsAt: dateTime("2026-06-17T10:00:00Z"),
            endsAt: dateTime("2026-06-23T12:00:00Z"),
            purchaseUrl: nil,
            ticketUrl: nil,
            venueName: "더현대 서울 B2 아이코닉 스퀘어",
            venueAddress: nil,
            image: nil,
            notificationEligible: true,
            updatedAt: dateTime("2026-06-10T01:00:00Z")
        )
    }

    private func schedule(
        _ id: String,
        _ startsAt: String,
        endsAt: String? = nil,
        cancelled: Bool = false,
        kind: HubEventScheduleKind = .custom,
        actionURL: String? = nil,
        sourceURL: String? = nil,
        title: String? = nil,
        label: String? = nil,
        description: String? = nil
    ) -> HubEventScheduleItem {
        HubEventScheduleItem(
            id: id,
            kind: kind,
            title: title,
            label: label ?? id,
            description: description,
            startsAt: dateTime(startsAt),
            endsAt: endsAt.map { dateTime($0) },
            timePrecision: .datetime,
            timezone: "Asia/Seoul",
            actionUrl: actionURL,
            sourceUrl: sourceURL,
            sourceLabel: nil,
            notificationEligible: true,
            isPrimary: false,
            sortOrder: 0,
            cancelledAt: cancelled ? dateTime("2026-06-10T00:00:00Z") : nil
        )
    }

    private func startOnlyDetailEvent() -> HubEvent {
        HubEvent(
            id: "start-only-concert",
            category: .offlineConcert,
            participationMode: .offline,
            status: .open,
            title: "종료 시각 미정 콘서트",
            summary: "공연 당일 종료 시각이 아직 확정되지 않았습니다.",
            memberId: nil,
            generationId: "official",
            sourceUrl: "https://example.com/source",
            sourceLabel: "공식 공지 기반 HubEvent",
            sourceType: .official,
            announcedAt: dateTime("2026-06-10T01:00:00Z"),
            startsAt: dateTime("2026-06-17T10:00:00Z"),
            endsAt: nil,
            purchaseUrl: nil,
            ticketUrl: nil,
            venueName: "공연장",
            venueAddress: nil,
            image: nil,
            notificationEligible: true,
            updatedAt: dateTime("2026-06-10T01:00:00Z")
        )
    }

    private func dateTime(_ value: String) -> Date {
        ISO8601DateFormatter().date(from: value)!
    }

    private func makeViewModel(
        selectedDay: Date? = nil,
        days: [HubCalendarDay]
    ) -> HubEventsCalendarViewModel {
        let today = date("2026-06-13")
        return HubEventsCalendarViewModel(
            selectedMonth: selectedDay ?? today,
            selectedDay: selectedDay ?? today,
            days: days,
            calendar: calendar,
            todayProvider: { today }
        )
    }

    private func day(_ date: String, entries: [HubCalendarEntry]) -> HubCalendarDay {
        HubCalendarDay(date: date, entries: entries)
    }

    private func day(_ date: String, _ entries: [HubCalendarEntry]) -> HubCalendarDay {
        day(date, entries: entries)
    }

    private func entry(
        id: String,
        eventId: String? = nil,
        scheduleItemId: String? = nil,
        category: HubEventCategory = .onlineGoods,
        tags: Set<HubEventTag> = [],
        participationMode: HubEventParticipationMode = .online,
        status: HubEventStatus = .open,
        startsAt: Date? = nil,
        endsAt: Date? = nil,
        title: String? = nil,
        displayTitle: String? = nil,
        scheduleLabel: String? = nil,
        displayTimeText: String = "종일",
        entryKind: HubCalendarEntryKind = .hubEvent
    ) -> HubCalendarEntry {
        HubCalendarEntry(
            id: id,
            eventId: eventId ?? id,
            entryKind: entryKind,
            specialDayKind: nil,
            specialDayLabel: nil,
            scheduleItemId: scheduleItemId,
            scheduleLabel: scheduleLabel,
            title: title ?? id,
            displayTitle: displayTitle,
            category: category,
            tags: tags,
            status: status,
            participationMode: participationMode,
            generationId: "official",
            memberId: nil,
            startsAt: startsAt,
            endsAt: endsAt,
            displayDate: "2026.06.13",
            displayTimeText: displayTimeText,
            sourceLabel: "Stellive Official",
            appDeepLink: "stellivehub://hub-events/\(id)",
            platformUrl: "https://example.com/events/\(id)"
        )
    }

    private func date(_ value: String) -> Date {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)!
    }
}
