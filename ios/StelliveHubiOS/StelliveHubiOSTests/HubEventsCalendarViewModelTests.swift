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
                entry(id: "goods", category: .onlineGoods),
                entry(id: "ticket", category: .ticketing),
                entry(id: "offline", category: .offlinePopup, participationMode: .offline),
                entry(id: "closing", category: .offlinePopup, status: .closingSoon)
            ])
        ])

        viewModel.setFilter("goods")
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["goods"])

        viewModel.setFilter("ticketing")
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["ticket"])

        viewModel.setFilter("offline")
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["offline"])

        viewModel.setFilter("closing")
        XCTAssertEqual(viewModel.visibleEntries().map(\.id), ["closing"])
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

    func testHubEventDetailPeriodTextForStartOnlyEventDoesNotShowUnknownEnd() {
        let rows = HubEventDetailFormatting.rows(for: startOnlyDetailEvent())
        let period = rows.first { $0.label == "기간" }?.value

        XCTAssertEqual(period, "2026.06.17 (수) 19:00 시작")
        XCTAssertFalse(period?.contains("종료 미정") ?? false)
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

    private func detailEvent() -> HubEvent {
        HubEvent(
            id: "popup-store",
            category: .onlineGoods,
            participationMode: .offline,
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

    private func entry(
        id: String,
        category: HubEventCategory = .onlineGoods,
        participationMode: HubEventParticipationMode = .online,
        status: HubEventStatus = .open,
        startsAt: Date? = nil,
        endsAt: Date? = nil
    ) -> HubCalendarEntry {
        HubCalendarEntry(
            id: id,
            eventId: id,
            entryKind: .hubEvent,
            specialDayKind: nil,
            specialDayLabel: nil,
            title: id,
            category: category,
            status: status,
            participationMode: participationMode,
            generationId: "official",
            memberId: nil,
            startsAt: startsAt,
            endsAt: endsAt,
            displayDate: "2026.06.13",
            displayTimeText: "종일",
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
