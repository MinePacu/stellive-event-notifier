import XCTest

final class HubCalendarDeepLinkPolicyTests: XCTestCase {
    func testBuildsAndParsesHubEventDeepLink() {
        let url = HubCalendarDeepLinkPolicy.appDeepLink(forEventId: "ticket-drop")

        XCTAssertEqual(url.absoluteString, "stellivehub://hub-events/ticket-drop")
        XCTAssertEqual(HubCalendarDeepLinkPolicy.eventId(from: url), "ticket-drop")
    }

    func testRejectsUnsupportedDeepLinks() {
        XCTAssertNil(HubCalendarDeepLinkPolicy.eventId(from: URL(string: "https://example.com/events/ticket-drop")!))
        XCTAssertNil(HubCalendarDeepLinkPolicy.eventId(from: URL(string: "stellivehub://members/ayatsuno-yuni")!))
        XCTAssertNil(HubCalendarDeepLinkPolicy.eventId(from: URL(string: "stellivehub://hub-events/")!))
    }

    func testOnlyHubEventEntriesNavigateToDetail() {
        XCTAssertTrue(HubCalendarDeepLinkPolicy.canNavigateToDetail(entry("ticket-drop")))
        XCTAssertFalse(
            HubCalendarDeepLinkPolicy.canNavigateToDetail(
                entry("", entryKind: .memberBirthday, specialDayKind: .memberBirthday)
            )
        )
    }

    func testFeedRowsForMonthSortsRowsByActualEventDatesBeforeDeduping() {
        let first = entry(
            "event-a",
            title: "A",
            startsAt: date("2026-06-19T00:00:00Z"),
            endsAt: date("2026-07-02T00:00:00Z"),
            displayDate: "2026-07-02"
        )
        let second = entry(
            "event-b",
            title: "B",
            startsAt: date("2026-07-02T00:00:00Z"),
            endsAt: date("2026-07-10T00:00:00Z"),
            displayDate: "2026-07-02"
        )
        let third = entry(
            "event-c",
            title: "C",
            startsAt: date("2026-07-01T00:00:00Z"),
            endsAt: date("2026-07-03T00:00:00Z"),
            displayDate: "2026-07-01"
        )
        let selectedMonth = HubEventsView.calendarDayFormatter.date(from: "2026-07-01")!
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!

        let rows = HubEventsFeedPolicy.rowsForMonth(
            days: [
                HubCalendarDay(date: "2026-07-02", entries: [second, first]),
                HubCalendarDay(date: "2026-07-01", entries: [third]),
            ],
            selectedMonth: selectedMonth,
            calendar: calendar
        )

        XCTAssertEqual(rows.map { $0.entry.eventId }, ["event-a", "event-c", "event-b"])
    }

    private func entry(
        _ eventId: String,
        entryKind: HubCalendarEntryKind = .hubEvent,
        specialDayKind: HubCalendarSpecialDayKind? = nil,
        title: String = "테스트 일정",
        startsAt: Date? = Date(timeIntervalSince1970: 1_781_487_200),
        endsAt: Date? = Date(timeIntervalSince1970: 1_781_537_400),
        displayDate: String = "2026.06.15"
    ) -> HubCalendarEntry {
        HubCalendarEntry(
            id: "entry-\(eventId)",
            eventId: eventId,
            entryKind: entryKind,
            specialDayKind: specialDayKind,
            specialDayLabel: specialDayKind == nil ? nil : "생일",
            title: title,
            category: .onlineGoods,
            status: .open,
            participationMode: .online,
            generationId: "official",
            memberId: nil,
            startsAt: startsAt,
            endsAt: endsAt,
            displayDate: displayDate,
            displayTimeText: "10:00 시작",
            sourceLabel: "Stellive Official",
            appDeepLink: eventId.isEmpty ? "" : "stellivehub://hub-events/\(eventId)",
            platformUrl: "https://example.com/events/\(eventId)"
        )
    }

    private func date(_ value: String) -> Date {
        ISO8601DateFormatter().date(from: value)!
    }
}
