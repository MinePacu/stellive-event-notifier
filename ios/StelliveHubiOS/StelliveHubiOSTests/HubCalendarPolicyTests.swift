import XCTest
@testable import StelliveHubiOS

final class HubCalendarPolicyTests: XCTestCase {
    func testSortsActionableHubEventsBeforeBirthdaysAndEndedItems() {
        let entries = [
            entry(eventId: "ended", status: .ended),
            birthdayEntry(eventId: "birthday"),
            entry(eventId: "closing", status: .closingSoon),
            entry(eventId: "open", status: .open)
        ]

        XCTAssertEqual(
            entries.sorted(by: HubCalendarPolicy.areInDisplayOrder).map(\.eventId),
            ["closing", "open", "birthday", "ended"]
        )
    }

    func testFormatsSpecialDayEntryLabels() {
        XCTAssertEqual(HubCalendarPolicy.entryLabel(birthdayEntry(eventId: "birthday")), "생일")
        XCTAssertEqual(HubCalendarPolicy.entryLabel(entry(eventId: "closing", status: .closingSoon)), "마감 임박")
    }

    func testFormatsDateHeaders() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul") ?? .current
        let today = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 6, day: 11)))
        let tomorrow = try XCTUnwrap(calendar.date(byAdding: .day, value: 1, to: today))
        let normal = try XCTUnwrap(calendar.date(byAdding: .day, value: 2, to: today))

        XCTAssertEqual(HubCalendarPolicy.dateHeaderText(for: today, now: today), "오늘")
        XCTAssertEqual(HubCalendarPolicy.dateHeaderText(for: tomorrow, now: today), "내일")
        XCTAssertEqual(HubCalendarPolicy.dateHeaderText(for: normal, now: today), "2026.06.13")
    }

    func testDetectsWidgetSnapshotStaleness() {
        let snapshot = HubCalendarWidgetSnapshot(
            generatedAt: Date(timeIntervalSince1970: 1_780_113_600),
            timezone: "Asia/Seoul",
            entries: [],
            staleAfter: Date(timeIntervalSince1970: 1_780_135_200)
        )

        XCTAssertFalse(
            HubCalendarPolicy.isWidgetSnapshotStale(
                snapshot,
                now: Date(timeIntervalSince1970: 1_780_135_199)
            )
        )
        XCTAssertTrue(
            HubCalendarPolicy.isWidgetSnapshotStale(
                snapshot,
                now: Date(timeIntervalSince1970: 1_780_135_200)
            )
        )
    }

    private func birthdayEntry(eventId: String) -> HubCalendarEntry {
        entry(
            id: "birthday:ayatsuno-yuni:2026-05-21",
            eventId: eventId,
            entryKind: .memberBirthday,
            specialDayKind: .memberBirthday,
            specialDayLabel: "생일",
            title: "아야츠노 유니 생일",
            status: .upcoming,
            generationId: "gen1",
            memberId: "ayatsuno-yuni",
            startsAt: nil,
            endsAt: nil,
            displayDate: "2026-05-21",
            displayTimeText: "종일",
            sourceLabel: "카탈로그",
            appDeepLink: "stellivehub://calendar/special-days/birthday:ayatsuno-yuni?date=2026-05-21",
            platformUrl: nil
        )
    }

    private func entry(
        id: String? = nil,
        eventId: String,
        entryKind: HubCalendarEntryKind = .hubEvent,
        specialDayKind: HubCalendarSpecialDayKind? = nil,
        specialDayLabel: String? = nil,
        title: String? = nil,
        category: HubEventCategory = .onlineGoods,
        status: HubEventStatus,
        participationMode: HubEventParticipationMode = .online,
        generationId: String = "official",
        memberId: String? = nil,
        startsAt: Date? = Date(timeIntervalSince1970: 1_780_117_200),
        endsAt: Date? = Date(timeIntervalSince1970: 1_780_149_600),
        displayDate: String = "2026-06-11",
        displayTimeText: String = "10:00 시작",
        sourceLabel: String = "Stellive Official",
        appDeepLink: String? = nil,
        platformUrl: String? = "https://example.com/hub-events/event"
    ) -> HubCalendarEntry {
        HubCalendarEntry(
            id: id ?? "\(eventId):2026-06-11",
            eventId: eventId,
            entryKind: entryKind,
            specialDayKind: specialDayKind,
            specialDayLabel: specialDayLabel,
            title: title ?? eventId,
            category: category,
            status: status,
            participationMode: participationMode,
            generationId: generationId,
            memberId: memberId,
            startsAt: startsAt,
            endsAt: endsAt,
            displayDate: displayDate,
            displayTimeText: displayTimeText,
            sourceLabel: sourceLabel,
            appDeepLink: appDeepLink ?? "stellivehub://hub-events/\(eventId)",
            platformUrl: platformUrl
        )
    }
}
