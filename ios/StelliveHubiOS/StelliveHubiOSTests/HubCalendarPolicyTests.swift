import XCTest
@testable import StelliveHubiOS

final class HubCalendarPolicyTests: XCTestCase {
    func testSortsActionableStatusesBeforeEndedItems() {
        let entries = [
            entry(eventId: "ended", status: .ended),
            entry(eventId: "upcoming", status: .upcoming),
            entry(eventId: "closing", status: .closingSoon),
            entry(eventId: "open", status: .open)
        ]

        XCTAssertEqual(
            entries.sorted(by: HubCalendarPolicy.areInDisplayOrder).map(\.eventId),
            ["closing", "open", "upcoming", "ended"]
        )
    }

    func testFormatsDateHeaders() throws {
        let today = try XCTUnwrap(Calendar(identifier: .gregorian).date(from: DateComponents(year: 2026, month: 6, day: 11)))
        let tomorrow = try XCTUnwrap(Calendar(identifier: .gregorian).date(byAdding: .day, value: 1, to: today))
        let normal = try XCTUnwrap(Calendar(identifier: .gregorian).date(byAdding: .day, value: 2, to: today))

        XCTAssertEqual(HubCalendarPolicy.dateHeaderText(for: today, now: today), "오늘")
        XCTAssertEqual(HubCalendarPolicy.dateHeaderText(for: tomorrow, now: today), "내일")
        XCTAssertEqual(HubCalendarPolicy.dateHeaderText(for: normal, now: today), "2026.06.13")
    }

    func testDetectsWidgetSnapshotStaleness() throws {
        let snapshot = HubCalendarWidgetSnapshot(
            generatedAt: try Date("2026-06-11T00:00:00Z", strategy: .iso8601),
            timezone: "Asia/Seoul",
            entries: [],
            staleAfter: try Date("2026-06-11T06:00:00Z", strategy: .iso8601)
        )

        XCTAssertFalse(HubCalendarPolicy.isWidgetSnapshotStale(snapshot, now: try Date("2026-06-11T05:59:59Z", strategy: .iso8601)))
        XCTAssertTrue(HubCalendarPolicy.isWidgetSnapshotStale(snapshot, now: try Date("2026-06-11T06:00:00Z", strategy: .iso8601)))
    }

    func testTextOnlyWidgetFallbacks() {
        XCTAssertEqual(HubCalendarPolicy.staleWidgetText, "최근 동기화 필요")
        XCTAssertEqual(HubCalendarPolicy.emptyWidgetText, "예정된 일정 없음")
    }

    private func entry(eventId: String, status: HubEventStatus) -> HubCalendarEntry {
        HubCalendarEntry(
            id: "\(eventId):2026-06-11",
            eventId: eventId,
            title: eventId,
            category: .onlineGoods,
            status: status,
            participationMode: .online,
            generationId: "official",
            memberId: nil,
            startsAt: try? Date("2026-06-11T01:00:00Z", strategy: .iso8601),
            endsAt: try? Date("2026-06-11T12:00:00Z", strategy: .iso8601),
            displayDate: "2026-06-11",
            displayTimeText: "10:00 시작",
            sourceLabel: "Stellive Official",
            appDeepLink: "stellivehub://hub-events/\(eventId)"
        )
    }
}
