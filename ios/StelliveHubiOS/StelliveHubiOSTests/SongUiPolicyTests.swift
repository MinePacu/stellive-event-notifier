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

    func testSongPaginationCalculatesPagesAndSlicesItems() {
        let songs = (1...45).map { index in
            SongCatalogItem(
                id: "video-\(index)",
                youtubeVideoId: "video-\(index)",
                title: "Song \(index)",
                type: .cover,
                youtubeUrl: "https://www.youtube.com/watch?v=video-\(index)"
            )
        }

        XCTAssertEqual(IOSSongPagePolicy.pageCount(totalItems: songs.count, pageSize: 20), 3)
        XCTAssertEqual(IOSSongPagePolicy.pageItems(songs, page: 1, pageSize: 20).map(\.id), (1...20).map { "video-\($0)" })
        XCTAssertEqual(IOSSongPagePolicy.pageItems(songs, page: 2, pageSize: 20).map(\.id), (21...40).map { "video-\($0)" })
        XCTAssertEqual(IOSSongPagePolicy.pageItems(songs, page: 3, pageSize: 20).map(\.id), (41...45).map { "video-\($0)" })
        XCTAssertEqual(IOSSongPagePolicy.clampedPage(99, totalItems: songs.count, pageSize: 20), 3)
        XCTAssertEqual(IOSSongPagePolicy.clampedPage(0, totalItems: songs.count, pageSize: 20), 1)
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

    func testThumbnailUrlCandidatesUseBackendUrlThenYoutubeFallbacks() {
        let song = SongCatalogItem(
            id: "id-1",
            youtubeVideoId: "abc123",
            title: "Song",
            type: .cover,
            thumbnailUrl: "https://example.test/thumb.jpg",
            youtubeUrl: "https://www.youtube.com/watch?v=abc123"
        )

        XCTAssertEqual(
            IOSSongPagePolicy.thumbnailUrlCandidates(for: song),
            [
                URL(string: "https://example.test/thumb.jpg")!,
                URL(string: "https://i.ytimg.com/vi/abc123/hqdefault.jpg")!,
                URL(string: "https://i.ytimg.com/vi/abc123/mqdefault.jpg")!,
                URL(string: "https://i.ytimg.com/vi/abc123/default.jpg")!,
            ]
        )
    }

    func testSongMemberFiltersUseActiveGenerationMembersAndSupportQuickClear() {
        let members = [
            songMember(id: "yuzuha-riko", name: "유즈하 리코", generationId: "gen3"),
            songMember(id: "neneko-mashiro", name: "네네코 마시로", generationId: "gen2"),
            songMember(id: "gangzi", name: "강지", generationId: "gamja", role: .representative),
            songMember(id: "stellive-official", name: "스텔라이브 공식", generationId: "official", role: .officialChannel),
        ]
        let collabSong = SongCatalogItem(
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
                MusicMemberSummary(id: "neneko-mashiro", nameKo: "네네코 마시로", nameEn: "Neneko Mashiro", role: "COLLAB"),
            ],
            youtubeUrl: "https://www.youtube.com/watch?v=video-1",
            sourcePlaylistId: nil
        )

        let filters = IOSSongPagePolicy.memberFilters(from: members)

        XCTAssertEqual(filters.first?.id, "all")
        XCTAssertFalse(filters.contains { $0.id == "gangzi" || $0.id == "stellive-official" })
        XCTAssertTrue(IOSSongPagePolicy.matchesMember(collabSong, selectedMemberId: "yuzuha-riko"))
        XCTAssertTrue(IOSSongPagePolicy.matchesMember(collabSong, selectedMemberId: "all"))
        XCTAssertFalse(IOSSongPagePolicy.matchesMember(collabSong, selectedMemberId: "akane-lize"))
        XCTAssertEqual(IOSSongPagePolicy.memberFilterLabel(from: members, selectedMemberId: "all"), "전체")
        XCTAssertEqual(IOSSongPagePolicy.memberFilterLabel(from: members, selectedMemberId: "neneko-mashiro"), "네네코 마시로")
        XCTAssertFalse(IOSSongPagePolicy.canClearMemberFilter("all"))
        XCTAssertTrue(IOSSongPagePolicy.canClearMemberFilter("neneko-mashiro"))
    }

    func testSongThumbnailUsesSixteenByNineAspectRatio() {
        XCTAssertEqual(IOSSongPagePolicy.thumbnailAspectRatio, 16.0 / 9.0, accuracy: 0.001)
        XCTAssertEqual(
            IOSSongPagePolicy.thumbnailSize.width / IOSSongPagePolicy.thumbnailSize.height,
            16.0 / 9.0,
            accuracy: 0.001
        )
    }

    private func songMember(
        id: String,
        name: String,
        generationId: String,
        role: CatalogRole = .member
    ) -> HubMember {
        HubMember(
            id: id,
            koreanName: name,
            englishName: id,
            generationId: generationId,
            generationName: generationId,
            unitName: generationId,
            catalogRole: role,
            roleLabel: nil,
            activeStatus: .active,
            isPerson: role == .member,
            chzzkChannelId: nil,
            youtubeHandle: nil,
            xHandle: nil,
            isLive: false,
            notificationEnabled: true,
            realtimeEnabled: false
        )
    }
}
