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

    private func entry(
        _ eventId: String,
        entryKind: HubCalendarEntryKind = .hubEvent,
        specialDayKind: HubCalendarSpecialDayKind? = nil
    ) -> HubCalendarEntry {
        HubCalendarEntry(
            id: "entry-\(eventId)",
            eventId: eventId,
            entryKind: entryKind,
            specialDayKind: specialDayKind,
            specialDayLabel: specialDayKind == nil ? nil : "생일",
            title: "테스트 일정",
            category: .onlineGoods,
            status: .open,
            participationMode: .online,
            generationId: "official",
            memberId: nil,
            startsAt: Date(timeIntervalSince1970: 1_781_487_200),
            endsAt: Date(timeIntervalSince1970: 1_781_537_400),
            displayDate: "2026.06.15",
            displayTimeText: "10:00 시작",
            sourceLabel: "Stellive Official",
            appDeepLink: eventId.isEmpty ? "" : "stellivehub://hub-events/\(eventId)",
            platformUrl: "https://example.com/events/\(eventId)"
        )
    }
}
