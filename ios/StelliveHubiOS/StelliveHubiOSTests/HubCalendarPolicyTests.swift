import XCTest
@testable import StelliveHubiOS

final class HubCalendarDeepLinkPolicyTests: XCTestCase {
    func testBuildsAndParsesHubEventDeepLink() {
        let url = HubCalendarDeepLinkPolicy.appDeepLink(forEventId: "ticket-drop")

        XCTAssertEqual(url.absoluteString, "stellivehub://hub-events/ticket-drop")
        XCTAssertEqual(HubCalendarDeepLinkPolicy.eventId(from: url), "ticket-drop")
    }

    func testParsesScheduleItemFromTimelineDeepLink() {
        let url = URL(string: "stellivehub://hub-events/album?scheduleItemId=track-list")!

        XCTAssertEqual(HubCalendarDeepLinkPolicy.eventId(from: url), "album")
        XCTAssertEqual(HubCalendarDeepLinkPolicy.scheduleItemId(from: url), "track-list")
    }

    func testScheduleExpansionKeepsSameEventResetsAnotherAndAddsDeepLink() {
        XCTAssertEqual(
            HubEventScheduleExpansionPolicy.resolvedIDs(
                previousEventID: "event",
                eventID: "event",
                currentIDs: ["open"],
                highlightedID: "deep-link"
            ),
            ["open", "deep-link"]
        )
        XCTAssertEqual(
            HubEventScheduleExpansionPolicy.resolvedIDs(
                previousEventID: "event",
                eventID: "other",
                currentIDs: ["open"],
                highlightedID: "other-deep-link"
            ),
            ["other-deep-link"]
        )
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

final class HubEventLinkPolicyTests: XCTestCase {
    func testExplicitLinksTakePriorityAndAreNormalized() {
        let event = event().withLinks([
            HubEventLink(id: "second", kind: .ticket, label: nil, url: "https://example.com/ticket", sortOrder: 2),
            HubEventLink(id: "unsafe", kind: .content, label: nil, url: "http://example.com/content", sortOrder: 0),
            HubEventLink(id: "first", kind: .purchase, label: "  스토어  ", url: " https://example.com/store ", sortOrder: 1),
            HubEventLink(id: "duplicate", kind: .custom, label: nil, url: "https://example.com/store", sortOrder: 3),
        ])

        let links = HubEventLinkPolicy.resolvedEventLinks(event)

        XCTAssertEqual(links.map(\.id), ["first", "second"])
        XCTAssertEqual(links.first?.label, "스토어")
    }

    func testLegacyScheduleLinksRemainAvailable() {
        let item = schedule(id: "sales", sortOrder: 0, primary: false, createdAt: nil)
        let legacy = HubEventScheduleItem(
            id: item.id,
            kind: .salesOpen,
            title: item.title,
            label: item.label,
            description: item.description,
            startsAt: item.startsAt,
            endsAt: item.endsAt,
            timePrecision: item.timePrecision,
            timezone: item.timezone,
            actionUrl: "https://example.com/buy",
            sourceUrl: "https://example.com/source",
            sourceLabel: "공식 공지",
            notificationEligible: item.notificationEligible,
            isPrimary: item.isPrimary,
            sortOrder: item.sortOrder,
            cancelledAt: item.cancelledAt
        )

        XCTAssertEqual(
            HubEventLinkPolicy.resolvedScheduleLinks(legacy).map(\.kind),
            [.purchase, .source]
        )
    }

    func testMultiplePrimaryPayloadSelectsOneDeterministically() {
        let schedules = [
            schedule(id: "later-sort", sortOrder: 3, primary: true, createdAt: nil),
            schedule(id: "later-created", sortOrder: 1, primary: true, createdAt: date("2026-06-02T00:00:00Z")),
            schedule(id: "winner", sortOrder: 1, primary: true, createdAt: date("2026-06-01T00:00:00Z")),
        ]
        let event = event().withScheduleItems(schedules)

        XCTAssertEqual(HubEventLinkPolicy.effectivePrimaryScheduleItemID(event), "winner")
    }

    func testEventCTAModeCoversNoneDirectAndSheet() {
        var noLinks = event()
        noLinks = HubEvent(
            id: noLinks.id, category: noLinks.category, participationMode: noLinks.participationMode,
            status: noLinks.status, title: noLinks.title, summary: noLinks.summary, memberId: noLinks.memberId,
            generationId: noLinks.generationId, sourceUrl: "http://unsafe.example", sourceLabel: noLinks.sourceLabel,
            sourceType: noLinks.sourceType, announcedAt: noLinks.announcedAt, startsAt: noLinks.startsAt,
            endsAt: noLinks.endsAt, purchaseUrl: nil, ticketUrl: nil, venueName: noLinks.venueName,
            venueAddress: noLinks.venueAddress, notificationEligible: noLinks.notificationEligible,
            updatedAt: noLinks.updatedAt
        )
        XCTAssertEqual(HubEventLinkPolicy.eventCTAMode(noLinks), .none)
        XCTAssertEqual(HubEventLinkPolicy.eventCTAMode(event()), .direct)
        XCTAssertEqual(HubEventLinkPolicy.eventCTAMode(event().withLinks([
            HubEventLink(id: "one", kind: .purchase, label: nil, url: "https://example.com/one", sortOrder: 0),
            HubEventLink(id: "two", kind: .ticket, label: nil, url: "https://example.com/two", sortOrder: 1),
        ])), .sheet)
    }

    private func schedule(id: String, sortOrder: Int, primary: Bool, createdAt: Date?) -> HubEventScheduleItem {
        HubEventScheduleItem(
            id: id,
            kind: .custom,
            title: nil,
            label: id,
            description: nil,
            startsAt: date("2026-06-10T00:00:00Z"),
            endsAt: nil,
            timePrecision: .datetime,
            timezone: "Asia/Seoul",
            actionUrl: nil,
            sourceUrl: nil,
            sourceLabel: nil,
            notificationEligible: true,
            isPrimary: primary,
            sortOrder: sortOrder,
            cancelledAt: nil,
            createdAt: createdAt
        )
    }

    private func event() -> HubEvent {
        HubEvent(
            id: "event",
            category: .onlineGoods,
            participationMode: .online,
            status: .upcoming,
            title: "이벤트",
            summary: nil,
            memberId: nil,
            generationId: "official",
            sourceUrl: "https://example.com/source",
            sourceLabel: "공식",
            sourceType: .official,
            announcedAt: nil,
            startsAt: nil,
            endsAt: nil,
            purchaseUrl: nil,
            ticketUrl: nil,
            venueName: nil,
            venueAddress: nil,
            notificationEligible: true,
            updatedAt: date("2026-06-01T00:00:00Z")
        )
    }

    private func date(_ value: String) -> Date {
        ISO8601DateFormatter().date(from: value)!
    }
}

private extension HubEvent {
    func withLinks(_ newLinks: [HubEventLink]) -> HubEvent {
        var copy = self
        copy.links = newLinks
        return copy
    }

    func withScheduleItems(_ newScheduleItems: [HubEventScheduleItem]) -> HubEvent {
        var copy = self
        copy.scheduleItems = newScheduleItems
        return copy
    }
}
