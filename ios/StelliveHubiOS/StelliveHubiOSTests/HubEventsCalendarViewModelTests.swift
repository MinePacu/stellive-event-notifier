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
        status: HubEventStatus = .open
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
            startsAt: nil,
            endsAt: nil,
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
