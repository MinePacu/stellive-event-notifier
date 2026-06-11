import XCTest
@testable import StelliveHubiOS

final class HubCalendarWidgetStoreTests: XCTestCase {
    func testAppGroupIdentifierIsStable() {
        XCTAssertEqual(HubCalendarWidgetStore.appGroupIdentifier, "group.dev.stellive.hub")
    }

    func testSavesAndLoadsSnapshot() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let snapshot = HubCalendarWidgetSnapshot(
            generatedAt: try Date("2026-06-11T00:00:00Z", strategy: .iso8601),
            timezone: "Asia/Seoul",
            entries: [],
            staleAfter: try Date("2026-06-11T06:00:00Z", strategy: .iso8601)
        )

        try HubCalendarWidgetStore.save(snapshot, in: directory)

        XCTAssertEqual(try HubCalendarWidgetStore.load(from: directory), snapshot)
    }
}
