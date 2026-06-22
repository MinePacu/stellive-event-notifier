import XCTest
@testable import StelliveHubiOS

@MainActor
final class SongUiPolicyTests: XCTestCase {
    func testPrimaryNavigationReplacesHistoryWithSongs() {
        XCTAssertEqual(IOSPrimaryNavigationPolicy.bottomTabs.map(\.id), ["home", "live", "songs", "hubEvents"])
        XCTAssertEqual(IOSPrimaryNavigationPolicy.bottomTabs.map(\.title), ["홈", "라이브", "노래", "굿즈/행사"])
        XCTAssertFalse(IOSPrimaryNavigationPolicy.bottomTabs.contains { $0.id == "history" })
        XCTAssertTrue(IOSPrimaryNavigationPolicy.titlelessPrimaryScreens.contains("songs"))
    }

    func testSongFiltersExcludeNonSongCategories() {
        XCTAssertEqual(IOSSongPagePolicy.generationFilters.map(\.id), ["all", "gen1", "gen2", "gen3"])
        XCTAssertEqual(IOSSongPagePolicy.generationFilters.map(\.label), ["전체", "1기생", "2기생", "3기생"])
        XCTAssertEqual(IOSSongPagePolicy.typeFilters.map(\.id), ["all", "original", "cover"])
        XCTAssertFalse(IOSSongPagePolicy.generationFilters.contains { $0.id == "gamja" || $0.id == "official" })
    }

    func testHistoryIsReachableFromSettingsRows() {
        let store = MockHubStore()
        let rows = SettingsNavigationPolicy.hubRows(settings: store.settings, members: store.members)

        XCTAssertTrue(rows.contains { $0.route == .history && $0.title == "알림 기록" })
    }
}
