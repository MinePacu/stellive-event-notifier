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
