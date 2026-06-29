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

    func testSongSortOptionsExposeStableLabelsAndDefault() {
        XCTAssertEqual(IOSSongPagePolicy.sortOptions.map(\.id), ["publishedAt_desc", "publishedAt_asc", "title_asc", "member_asc"])
        XCTAssertEqual(IOSSongPagePolicy.sortOptions.map(\.label), ["최신순", "오래된순", "제목순", "멤버순"])
    }

    func testSongSortOrdersByDateTitleAndMemberWithUndatedItemsLast() {
        let older = songCatalogItem(
            id: "older",
            title: "Beta",
            memberName: "Alice",
            publishedAt: Date(timeIntervalSince1970: 1_750_377_600)
        )
        let newer = songCatalogItem(
            id: "newer",
            title: "Alpha",
            memberName: "Bob",
            publishedAt: Date(timeIntervalSince1970: 1_750_550_400)
        )
        let undated = songCatalogItem(
            id: "undated",
            title: "Gamma",
            memberName: "Carol",
            publishedAt: nil
        )
        let songs = [older, undated, newer]

        XCTAssertEqual(IOSSongPagePolicy.sortedSongs(songs, sortId: "publishedAt_desc").map(\.id), ["newer", "older", "undated"])
        XCTAssertEqual(IOSSongPagePolicy.sortedSongs(songs, sortId: "publishedAt_asc").map(\.id), ["older", "newer", "undated"])
        XCTAssertEqual(IOSSongPagePolicy.sortedSongs(songs, sortId: "title_asc").map(\.id), ["newer", "older", "undated"])
        XCTAssertEqual(IOSSongPagePolicy.sortedSongs(songs, sortId: "member_asc").map(\.id), ["older", "newer", "undated"])
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

    func testSongTitleDisplayTextUsesOnlySongTitle() {
        let song = SongCatalogItem(
            id: "video-1",
            youtubeVideoId: "video-1",
            title: "  Stellar Light  ",
            type: .cover,
            publishedAt: nil,
            thumbnailUrl: nil,
            duration: nil,
            durationSeconds: nil,
            isInstrumental: false,
            specialFlags: [],
            classificationStatus: nil,
            members: [
                MusicMemberSummary(id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni", role: "MAIN")
            ],
            youtubeUrl: "https://www.youtube.com/watch?v=video-1",
            sourcePlaylistId: nil
        )

        XCTAssertEqual(IOSSongPagePolicy.titleDisplayText(song), "Stellar Light")
    }

    func testSongDisplayTextParsesCoverTitleFormats() {
        let member = MusicMemberSummary(id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni", role: "MAIN")
        let songs = [
            SongCatalogItem(
                id: "slash",
                youtubeVideoId: "slash",
                title: "Stellar Light / 아야츠노 유니 Cover",
                type: .cover,
                members: [member],
                youtubeUrl: "https://www.youtube.com/watch?v=slash"
            ),
            SongCatalogItem(
                id: "pipe",
                youtubeVideoId: "pipe",
                title: "Stellar Light | 아야츠노 유니 Cover",
                type: .cover,
                members: [member],
                youtubeUrl: "https://www.youtube.com/watch?v=pipe"
            ),
            SongCatalogItem(
                id: "live",
                youtubeVideoId: "live",
                title: "[4K] Stellar Light | 아야츠노 유니 3D Live Cover",
                type: .cover,
                members: [member],
                youtubeUrl: "https://www.youtube.com/watch?v=live"
            )
        ]

        for song in songs {
            let display = IOSSongPagePolicy.displayText(for: song)
            XCTAssertEqual(display.title, "Stellar Light")
            XCTAssertEqual(display.subtitle, "아야츠노 유니")
        }
    }

    func testSongDisplayTextPreservesCoverOriginalArtistDetailsFromDbPatterns() {
        let shibuki = MusicMemberSummary(id: "tenko-shibuki", nameKo: "텐코 시부키", nameEn: nil, role: "MAIN")
        let hina = MusicMemberSummary(id: "shirayuki-hina", nameKo: "시라유키 히나", nameEn: nil, role: "MAIN")
        let lize = MusicMemberSummary(id: "akane-lize", nameKo: "아카네 리제", nameEn: nil, role: "MAIN")

        let slashInParentheses = IOSSongPagePolicy.displayText(
            for: SongCatalogItem(
                id: "slash-in-parentheses",
                youtubeVideoId: "slash-in-parentheses",
                title: "친애하는 소년이여 (拝啓、少年よ / Hump Back)  / 텐코 시부키 (Tenko Shibuki) cover",
                type: .cover,
                members: [shibuki],
                youtubeUrl: "https://www.youtube.com/watch?v=slash-in-parentheses"
            )
        )
        let pipeOriginalArtist = IOSSongPagePolicy.displayText(
            for: SongCatalogItem(
                id: "pipe-original-artist",
                youtubeVideoId: "pipe-original-artist",
                title: "Mrs. GREEN APPLE - 춘수(春愁) | 시라유키 히나 Cover",
                type: .cover,
                members: [hina],
                youtubeUrl: "https://www.youtube.com/watch?v=pipe-original-artist"
            )
        )
        let koreanPipe = IOSSongPagePolicy.displayText(
            for: SongCatalogItem(
                id: "korean-pipe",
                youtubeVideoId: "korean-pipe",
                title: "orion - [米津玄師 / 요네즈 켄시] ㅣ아카네 리제(Akane Lize) 【COVER】",
                type: .cover,
                members: [lize],
                youtubeUrl: "https://www.youtube.com/watch?v=korean-pipe"
            )
        )

        XCTAssertEqual(slashInParentheses.title, "친애하는 소년이여 (拝啓、少年よ / Hump Back)")
        XCTAssertEqual(slashInParentheses.subtitle, "텐코 시부키")
        XCTAssertEqual(pipeOriginalArtist.title, "Mrs. GREEN APPLE - 춘수(春愁)")
        XCTAssertEqual(pipeOriginalArtist.subtitle, "시라유키 히나")
        XCTAssertEqual(koreanPipe.title, "orion - [米津玄師 / 요네즈 켄시]")
        XCTAssertEqual(koreanPipe.subtitle, "아카네 리제")
    }

    func testSongDisplayTextCompactsDbCoverGenerationGroupPattern() {
        let catalogMembers = [
            songMember(id: "neneko-mashiro", name: "네네코 마시로", generationId: "gen2", generationName: "2기생", unitName: "Universe"),
            songMember(id: "shirayuki-hina", name: "시라유키 히나", generationId: "gen2", generationName: "2기생", unitName: "Universe"),
            songMember(id: "arahashi-tabi", name: "아라하시 타비", generationId: "gen2", generationName: "2기생", unitName: "Universe"),
            songMember(id: "akane-lize", name: "아카네 리제", generationId: "gen2", generationName: "2기생", unitName: "Universe"),
        ]
        let display = IOSSongPagePolicy.displayText(
            for: SongCatalogItem(
                id: "blackhole",
                youtubeVideoId: "blackhole",
                title: "[4K] BLACKHOLE - IVE / 유니버스 (Universe) Cover",
                type: .cover,
                members: catalogMembers.map {
                    MusicMemberSummary(id: $0.id, nameKo: $0.koreanName, nameEn: nil, role: "MAIN")
                },
                youtubeUrl: "https://www.youtube.com/watch?v=blackhole"
            ),
            catalogMembers: catalogMembers
        )

        XCTAssertEqual(display.title, "BLACKHOLE - IVE")
        XCTAssertEqual(display.subtitle, "Universe (2기생)")
    }

    func testSongDisplayTextParsesOriginalTitleFormats() {
        let member = MusicMemberSummary(id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni", role: "MAIN")

        XCTAssertEqual(
            IOSSongPagePolicy.displayText(
                for: SongCatalogItem(
                    id: "original",
                    youtubeVideoId: "original",
                    title: "아야츠노 유니 | Stellar Light",
                    type: .original,
                    members: [member],
                    youtubeUrl: "https://www.youtube.com/watch?v=original"
                )
            ).title,
            "Stellar Light"
        )
        XCTAssertEqual(
            IOSSongPagePolicy.displayText(
                for: SongCatalogItem(
                    id: "quoted",
                    youtubeVideoId: "quoted",
                    title: "아야츠노 유니 | 'Stellar Light'",
                    type: .original,
                    members: [member],
                    youtubeUrl: "https://www.youtube.com/watch?v=quoted"
                )
            ).title,
            "Stellar Light"
        )
        XCTAssertEqual(
            IOSSongPagePolicy.displayText(
                for: SongCatalogItem(
                    id: "music-video",
                    youtubeVideoId: "music-video",
                    title: "아야츠노 유니 | 'Stellar Light' Music Video",
                    type: .original,
                    members: [member],
                    youtubeUrl: "https://www.youtube.com/watch?v=music-video"
                )
            ).title,
            "Stellar Light"
        )
    }

    func testSongDisplayTextParsesDbOriginalTitleFormats() {
        let yuni = MusicMemberSummary(id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: nil, role: "MAIN")
        let quotedMusicVideo = IOSSongPagePolicy.displayText(
            for: SongCatalogItem(
                id: "bbijilge",
                youtubeVideoId: "bbijilge",
                title: "아야츠노 유니 ( Ayatsuno Yuni ) | ‘삐질게 (BBiJilGe)’ Music Video",
                type: .original,
                members: [yuni],
                youtubeUrl: "https://www.youtube.com/watch?v=bbijilge"
            )
        )
        let noPipeQuoted = IOSSongPagePolicy.displayText(
            for: SongCatalogItem(
                id: "milky-way",
                youtubeVideoId: "milky-way",
                title: "STELLIVE (스텔라이브) ‘Milky Way’ Music Video",
                type: .original,
                members: [],
                youtubeUrl: "https://www.youtube.com/watch?v=milky-way"
            )
        )
        let iSeparatorQuoted = IOSSongPagePolicy.displayText(
            for: SongCatalogItem(
                id: "star-trail",
                youtubeVideoId: "star-trail",
                title: "스텔라이브 (StelLive) I 'STAR TRAIL (스타트레일)'",
                type: .original,
                members: [],
                youtubeUrl: "https://www.youtube.com/watch?v=star-trail"
            )
        )

        XCTAssertEqual(quotedMusicVideo.title, "삐질게 (BBiJilGe)")
        XCTAssertEqual(quotedMusicVideo.subtitle, "아야츠노 유니")
        XCTAssertEqual(noPipeQuoted.title, "Milky Way")
        XCTAssertEqual(noPipeQuoted.subtitle, "스텔라이브")
        XCTAssertEqual(iSeparatorQuoted.title, "STAR TRAIL (스타트레일)")
        XCTAssertEqual(iSeparatorQuoted.subtitle, "스텔라이브")
    }

    func testSongDisplayTextAddsExternalCollaboratorsFromTitleArtistSegment() {
        let display = IOSSongPagePolicy.displayText(
            for: SongCatalogItem(
                id: "collab",
                youtubeVideoId: "collab",
                title: "Stellar Light | 아야츠노 유니 & 외부 보컬 Cover",
                type: .cover,
                members: [
                    MusicMemberSummary(id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni", role: "MAIN")
                ],
                youtubeUrl: "https://www.youtube.com/watch?v=collab"
            )
        )

        XCTAssertEqual(display.title, "Stellar Light")
        XCTAssertEqual(display.subtitle, "아야츠노 유니 · 외부 보컬")
    }

    func testSongDisplayTextAddsExternalCollaboratorFromDbCoverPerformerSegment() {
        let display = IOSSongPagePolicy.displayText(
            for: SongCatalogItem(
                id: "pop-stars",
                youtubeVideoId: "pop-stars",
                title: "[4K] POP/STARS / Nerissa Ravencroft(네리사 레이븐크로프트) x 아오쿠모 린(Aokumo Rin) Cover",
                type: .cover,
                members: [
                    MusicMemberSummary(id: "aokumo-rin", nameKo: "아오쿠모 린", nameEn: nil, role: "MAIN")
                ],
                youtubeUrl: "https://www.youtube.com/watch?v=pop-stars"
            )
        )

        XCTAssertEqual(display.title, "POP/STARS")
        XCTAssertEqual(display.subtitle, "아오쿠모 린 · Nerissa Ravencroft(네리사 레이븐크로프트)")
    }

    func testSongDisplayTextCompactsFullGenerationGroupOnly() {
        let catalogMembers = [
            songMember(id: "member-a", name: "멤버 A", generationId: "gen2", generationName: "2기생", unitName: "Universe"),
            songMember(id: "member-b", name: "멤버 B", generationId: "gen2", generationName: "2기생", unitName: "Universe"),
            songMember(id: "member-c", name: "멤버 C", generationId: "gen3", generationName: "3기생", unitName: "Cliche")
        ]
        let fullGroup = SongCatalogItem(
            id: "group",
            youtubeVideoId: "group",
            title: "Universe | 'Stellar Light' Music Video",
            type: .original,
            members: [
                MusicMemberSummary(id: "member-a", nameKo: "멤버 A", nameEn: nil, role: "MAIN"),
                MusicMemberSummary(id: "member-b", nameKo: "멤버 B", nameEn: nil, role: "MAIN")
            ],
            youtubeUrl: "https://www.youtube.com/watch?v=group"
        )
        let partialGroup = SongCatalogItem(
            id: "partial",
            youtubeVideoId: "partial",
            title: fullGroup.title,
            type: .original,
            members: [
                MusicMemberSummary(id: "member-a", nameKo: "멤버 A", nameEn: nil, role: "MAIN")
            ],
            youtubeUrl: "https://www.youtube.com/watch?v=partial"
        )

        XCTAssertEqual(IOSSongPagePolicy.displayText(for: fullGroup, catalogMembers: catalogMembers).subtitle, "Universe (2기생)")
        XCTAssertEqual(IOSSongPagePolicy.displayText(for: partialGroup, catalogMembers: catalogMembers).subtitle, "멤버 A")
    }

    func testSongDisplayTextUsesStelliveGroupNameAsIs() {
        let display = IOSSongPagePolicy.displayText(
            for: SongCatalogItem(
                id: "stellive",
                youtubeVideoId: "stellive",
                title: "스텔라이브 | 'Stellar Light' Music Video",
                type: .original,
                members: [],
                youtubeUrl: "https://www.youtube.com/watch?v=stellive"
            )
        )

        XCTAssertEqual(display.title, "Stellar Light")
        XCTAssertEqual(display.subtitle, "스텔라이브")
    }

    func testSongDisplayTextDeduplicatesRepeatedParsedTitle() {
        let display = IOSSongPagePolicy.displayText(
            for: SongCatalogItem(
                id: "repeated",
                youtubeVideoId: "repeated",
                title: "Stellar Light Stellar Light | 아야츠노 유니 Cover",
                type: .cover,
                members: [
                    MusicMemberSummary(id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni", role: "MAIN")
                ],
                youtubeUrl: "https://www.youtube.com/watch?v=repeated"
            )
        )

        XCTAssertEqual(display.title, "Stellar Light")
    }

    func testSongMatchesQueryUsesParsedTitleAndSubtitle() {
        let song = SongCatalogItem(
            id: "query",
            youtubeVideoId: "query",
            title: "Stellar Light | 아야츠노 유니 & 외부 보컬 Cover",
            type: .cover,
            members: [
                MusicMemberSummary(id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni", role: "MAIN")
            ],
            youtubeUrl: "https://www.youtube.com/watch?v=query"
        )

        XCTAssertTrue(IOSSongPagePolicy.matchesQuery(song, query: "Stellar Light"))
        XCTAssertTrue(IOSSongPagePolicy.matchesQuery(song, query: "외부 보컬"))
        XCTAssertFalse(IOSSongPagePolicy.matchesQuery(song, query: "Cover"))
    }

    func testSongPremiereStatusLabelShowsOnlyScheduledAndLivePremieres() {
        let baseSong = SongCatalogItem(
            id: "video-1",
            youtubeVideoId: "video-1",
            title: "Premiere Cover",
            type: .cover,
            youtubeUrl: "https://www.youtube.com/watch?v=video-1"
        )

        XCTAssertEqual(
            IOSSongPagePolicy.premiereStatusLabel(
                for: SongCatalogItem(
                    id: baseSong.id,
                    youtubeVideoId: baseSong.youtubeVideoId,
                    title: baseSong.title,
                    type: baseSong.type,
                    youtubeUrl: baseSong.youtubeUrl,
                    premiere: YoutubePremiereMetadata(
                        classification: "assumed",
                        state: "scheduled",
                        scheduledStartAt: Date(timeIntervalSince1970: 1_782_633_600),
                        actualStartAt: nil,
                        actualEndAt: nil
                    )
                )
            ),
            "최초 공개 예정 · 6월 28일 17:00"
        )
        XCTAssertEqual(
            IOSSongPagePolicy.premiereStatusLabel(
                for: SongCatalogItem(
                    id: baseSong.id,
                    youtubeVideoId: baseSong.youtubeVideoId,
                    title: baseSong.title,
                    type: baseSong.type,
                    youtubeUrl: baseSong.youtubeUrl,
                    premiere: YoutubePremiereMetadata(
                        classification: "assumed",
                        state: "scheduled",
                        scheduledStartAt: nil,
                        actualStartAt: nil,
                        actualEndAt: nil
                    )
                )
            ),
            "최초 공개 예정"
        )
        XCTAssertEqual(
            IOSSongPagePolicy.premiereStatusLabel(
                for: SongCatalogItem(
                    id: baseSong.id,
                    youtubeVideoId: baseSong.youtubeVideoId,
                    title: baseSong.title,
                    type: baseSong.type,
                    youtubeUrl: baseSong.youtubeUrl,
                    premiere: YoutubePremiereMetadata(
                        classification: "assumed",
                        state: "live",
                        scheduledStartAt: nil,
                        actualStartAt: nil,
                        actualEndAt: nil
                    )
                )
            ),
            "최초 공개 중"
        )
        XCTAssertNil(
            IOSSongPagePolicy.premiereStatusLabel(
                for: SongCatalogItem(
                    id: baseSong.id,
                    youtubeVideoId: baseSong.youtubeVideoId,
                    title: baseSong.title,
                    type: baseSong.type,
                    youtubeUrl: baseSong.youtubeUrl,
                    premiere: YoutubePremiereMetadata(
                        classification: "assumed",
                        state: "completed",
                        scheduledStartAt: nil,
                        actualStartAt: nil,
                        actualEndAt: nil
                    )
                )
            )
        )
        XCTAssertNil(
            IOSSongPagePolicy.premiereStatusLabel(
                for: SongCatalogItem(
                    id: baseSong.id,
                    youtubeVideoId: baseSong.youtubeVideoId,
                    title: baseSong.title,
                    type: baseSong.type,
                    youtubeUrl: baseSong.youtubeUrl,
                    premiere: YoutubePremiereMetadata(
                        classification: "assumed",
                        state: "unknown",
                        scheduledStartAt: nil,
                        actualStartAt: nil,
                        actualEndAt: nil
                    )
                )
            )
        )
        XCTAssertNil(IOSSongPagePolicy.premiereStatusLabel(for: baseSong))
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

    func testHomeRecentCoverRowsUseSongPageInsets() {
        XCTAssertEqual(IOSSongPagePolicy.rowInsetTop, 6)
        XCTAssertEqual(IOSSongPagePolicy.rowInsetLeading, 0)
        XCTAssertEqual(IOSSongPagePolicy.rowInsetBottom, 6)
        XCTAssertEqual(IOSSongPagePolicy.rowInsetTrailing, 0)
    }

    func testRecentSongsAreNewestFirstAcrossCoversAndOriginals() {
        let songs = [
            SongCatalogItem(
                id: "old-cover",
                youtubeVideoId: "old-cover",
                title: "Old",
                type: .cover,
                publishedAt: Date(timeIntervalSince1970: 100),
                youtubeUrl: "https://www.youtube.com/watch?v=old-cover"
            ),
            SongCatalogItem(
                id: "original",
                youtubeVideoId: "original",
                title: "Original",
                type: .original,
                publishedAt: Date(timeIntervalSince1970: 300),
                youtubeUrl: "https://www.youtube.com/watch?v=original"
            ),
            SongCatalogItem(
                id: "new-cover",
                youtubeVideoId: "new-cover",
                title: "New",
                type: .cover,
                publishedAt: Date(timeIntervalSince1970: 200),
                youtubeUrl: "https://www.youtube.com/watch?v=new-cover"
            ),
        ]

        XCTAssertEqual(
            IOSSongPagePolicy.recentSongs(songs, limit: 2).map(\.id),
            ["original", "new-cover"]
        )
    }

    private func songMember(
        id: String,
        name: String,
        generationId: String,
        role: CatalogRole = .member,
        generationName: String? = nil,
        unitName: String? = nil
    ) -> HubMember {
        HubMember(
            id: id,
            koreanName: name,
            englishName: id,
            generationId: generationId,
            generationName: generationName ?? generationId,
            unitName: unitName ?? generationId,
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

    private func songCatalogItem(
        id: String,
        title: String,
        memberName: String,
        publishedAt: Date?
    ) -> SongCatalogItem {
        SongCatalogItem(
            id: id,
            youtubeVideoId: id,
            title: title,
            type: .cover,
            publishedAt: publishedAt,
            thumbnailUrl: nil,
            duration: nil,
            durationSeconds: nil,
            isInstrumental: false,
            specialFlags: [],
            classificationStatus: nil,
            members: [
                MusicMemberSummary(id: "\(id)-member", nameKo: memberName, nameEn: nil, role: "MAIN")
            ],
            youtubeUrl: "https://www.youtube.com/watch?v=\(id)",
            sourcePlaylistId: nil
        )
    }
}
