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
        XCTAssertEqual(IOSSongPagePolicy.generationFilters.filter { $0.id == "all" }.count, 1)
        XCTAssertEqual(IOSSongPagePolicy.typeFilters.filter { $0.id == "all" }.count, 1)
        XCTAssertFalse(IOSSongPagePolicy.generationFilters.contains { $0.id == "gamja" || $0.id == "official" })
    }

    func testSongMatchesSelectedGenerationByMemberIds() {
        let song = SongCatalogItem(
            id: "video-1",
            youtubeVideoId: "video-1",
            title: "Collab",
            type: .cover,
            publishedAt: nil,
            thumbnailUrl: nil,
            duration: nil,
            durationSeconds: nil,
            isInstrumental: false,
            specialFlags: [],
            classificationStatus: nil,
            members: [
                MusicMemberSummary(id: "yuzuha-riko", nameKo: "유즈하 리코", nameEn: "Yuzuha Riko", role: "MAIN"),
                MusicMemberSummary(id: "neneko-mashiro", nameKo: "네네코 마시로", nameEn: "Neneko Mashiro", role: "COLLAB")
            ],
            youtubeUrl: "https://www.youtube.com/watch?v=video-1",
            sourcePlaylistId: nil
        )
        let memberGenerations = [
            "yuzuha-riko": "gen3",
            "neneko-mashiro": "gen2"
        ]

        XCTAssertTrue(IOSSongPagePolicy.matchesGeneration(song, selectedGenerationId: "all", memberGenerationById: memberGenerations))
        XCTAssertTrue(IOSSongPagePolicy.matchesGeneration(song, selectedGenerationId: "gen2", memberGenerationById: memberGenerations))
        XCTAssertTrue(IOSSongPagePolicy.matchesGeneration(song, selectedGenerationId: "gen3", memberGenerationById: memberGenerations))
        XCTAssertFalse(IOSSongPagePolicy.matchesGeneration(song, selectedGenerationId: "gen1", memberGenerationById: memberGenerations))
    }

    func testSongMatchesQueryByTitleOrMemberDisplayText() {
        let song = SongCatalogItem(
            id: "video-1",
            youtubeVideoId: "video-1",
            title: "Starlight Cover",
            type: .cover,
            publishedAt: nil,
            thumbnailUrl: nil,
            duration: nil,
            durationSeconds: nil,
            isInstrumental: false,
            specialFlags: [],
            classificationStatus: nil,
            members: [
                MusicMemberSummary(id: "yuzuha-riko", nameKo: "유즈하 리코", nameEn: "Yuzuha Riko", role: "MAIN")
            ],
            youtubeUrl: "https://www.youtube.com/watch?v=video-1",
            sourcePlaylistId: nil
        )

        XCTAssertTrue(IOSSongPagePolicy.matchesQuery(song, query: "starlight"))
        XCTAssertTrue(IOSSongPagePolicy.matchesQuery(song, query: "리코"))
        XCTAssertTrue(IOSSongPagePolicy.matchesQuery(song, query: ""))
        XCTAssertFalse(IOSSongPagePolicy.matchesQuery(song, query: "마시로"))
    }

    func testSongMemberDisplayJoinsCollaborationMembers() {
        let song = SongCatalogItem(
            id: "video-1",
            youtubeVideoId: "video-1",
            title: "Collab",
            type: .cover,
            publishedAt: nil,
            thumbnailUrl: nil,
            duration: nil,
            durationSeconds: nil,
            isInstrumental: false,
            specialFlags: [],
            classificationStatus: nil,
            members: [
                MusicMemberSummary(id: "yuzuha-riko", nameKo: "유즈하 리코", nameEn: "Yuzuha Riko", role: "MAIN"),
                MusicMemberSummary(id: "neneko-mashiro", nameKo: "네네코 마시로", nameEn: "Neneko Mashiro", role: "COLLAB")
            ],
            youtubeUrl: "https://www.youtube.com/watch?v=video-1",
            sourcePlaylistId: nil
        )
        let emptyMembers = SongCatalogItem(
            id: "video-2",
            youtubeVideoId: "video-2",
            title: "Group",
            type: .original,
            publishedAt: nil,
            thumbnailUrl: nil,
            duration: nil,
            durationSeconds: nil,
            isInstrumental: false,
            specialFlags: [],
            classificationStatus: nil,
            members: [],
            youtubeUrl: "https://www.youtube.com/watch?v=video-2",
            sourcePlaylistId: nil
        )

        XCTAssertEqual(IOSSongPagePolicy.memberDisplayText(song), "유즈하 리코 · 네네코 마시로")
        XCTAssertEqual(IOSSongPagePolicy.memberDisplayText(emptyMembers), "스텔라이브")
    }

    func testHistoryIsReachableFromSettingsRows() {
        let store = MockHubStore()
        let rows = SettingsNavigationPolicy.hubRows(settings: store.settings, members: store.members)

        XCTAssertTrue(rows.contains { $0.route == .history && $0.title == "알림 기록" })
    }
}
