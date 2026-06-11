import XCTest
@testable import StelliveHubiOS

@MainActor
final class HubCalendarStoreTests: XCTestCase {
    func testGroupsHubEventsByCalendarDate() {
        let store = MockHubStore()
        let days = store.calendarDays(for: "all")

        XCTAssertFalse(days.isEmpty)
        XCTAssertTrue(days.allSatisfy { !$0.entries.isEmpty })
        XCTAssertEqual(days.map(\.date), days.map(\.date).sorted())
        XCTAssertTrue(days.flatMap(\.entries).allSatisfy { $0.appDeepLink.hasPrefix("stellivehub://hub-events/") })
    }

    func testBuildsWidgetSnapshotFromCalendarEvents() {
        let store = MockHubStore()
        let snapshot = store.calendarWidgetSnapshot(limit: 2)

        XCTAssertEqual(snapshot.timezone, "Asia/Seoul")
        XCTAssertLessThanOrEqual(snapshot.entries.count, 2)
        XCTAssertGreaterThan(snapshot.staleAfter, snapshot.generatedAt)
    }
}
