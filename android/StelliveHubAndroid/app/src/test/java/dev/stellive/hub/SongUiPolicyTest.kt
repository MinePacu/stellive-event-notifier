package dev.stellive.hub

import dev.stellive.hub.core.model.ActiveStatus
import dev.stellive.hub.core.model.CatalogRole
import dev.stellive.hub.core.model.HubMember
import dev.stellive.hub.core.model.SongCatalogItem
import dev.stellive.hub.core.model.SongMemberSummary
import dev.stellive.hub.core.model.SongType
import dev.stellive.hub.core.model.YoutubePremiereMetadata
import dev.stellive.hub.feature.home.MainUiPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class SongUiPolicyTest {
    @Test
    fun primaryNavigationReplacesHistoryWithSongs() {
        val navigationItems = MainUiPolicy.primaryNavigationItems()

        assertEquals(listOf("home", "live", "songs", "goods_events"), navigationItems.map { it.screenId })
        assertEquals(listOf("홈", "라이브", "노래", "굿즈/행사"), navigationItems.map { it.label })
        assertFalse(navigationItems.any { it.screenId == "history" })
        assertEquals("노래 검색", MainUiPolicy.topBarTitle("song_search"))
    }

    @Test
    fun songFiltersExposeOnlySupportedGenerationAndTypeValues() {
        assertEquals(listOf("all", "gen1", "gen2", "gen3"), MainUiPolicy.songGenerationFilters().map { it.id })
        assertEquals(listOf("전체", "1기생", "2기생", "3기생"), MainUiPolicy.songGenerationFilters().map { it.label })
        assertEquals(listOf("all", "original", "cover"), MainUiPolicy.songTypeFilters().map { it.id })
        assertEquals(1, MainUiPolicy.songGenerationFilters().count { it.id == "all" })
        assertEquals(1, MainUiPolicy.songTypeFilters().count { it.id == "all" })
        assertFalse(MainUiPolicy.songGenerationFilters().any { it.id == "gamja" || it.id == "official" })
    }

    @Test
    fun songFilterSegmentRowsUseTwelveDpDividerSpacing() {
        assertEquals(12, MainUiPolicy.SONG_FILTER_SEGMENT_SPACING_DP)
    }

    @Test
    fun songTopFiltersExposeGenerationAndTypeGroups() {
        val groups = MainUiPolicy.songTopFilterGroups(
            selectedGenerationId = "gen2",
            selectedType = "cover",
            selectedSortId = "member_asc",
        )

        assertEquals(listOf("generation", "type", "sort"), groups.map { it.id })
        assertEquals("gen2", groups[0].selectedId)
        assertEquals("cover", groups[1].selectedId)
        assertEquals("member_asc", groups[2].selectedId)
    }

    @Test
    fun songSortOptionsExposeStableLabelsAndDefault() {
        assertEquals(
            listOf("publishedAt_desc", "publishedAt_asc", "title_asc", "member_asc"),
            MainUiPolicy.songSortOptions().map { it.id },
        )
        assertEquals(
            listOf("최신순", "오래된순", "제목순", "멤버순"),
            MainUiPolicy.songSortOptions().map { it.label },
        )
    }

    @Test
    fun songSortOrdersByDateTitleAndMemberWithUndatedItemsLast() {
        val older = songCatalogItem(
            id = "older",
            title = "Beta",
            memberName = "Alice",
            publishedAt = "2026-06-20T00:00:00Z",
        )
        val newer = songCatalogItem(
            id = "newer",
            title = "Alpha",
            memberName = "Bob",
            publishedAt = "2026-06-22T00:00:00Z",
        )
        val undated = songCatalogItem(
            id = "undated",
            title = "Gamma",
            memberName = "Carol",
            publishedAt = null,
        )
        val songs = listOf(older, undated, newer)

        assertEquals(
            listOf("newer", "older", "undated"),
            MainUiPolicy.sortSongs(songs, "publishedAt_desc").map { it.id },
        )
        assertEquals(
            listOf("older", "newer", "undated"),
            MainUiPolicy.sortSongs(songs, "publishedAt_asc").map { it.id },
        )
        assertEquals(
            listOf("newer", "older", "undated"),
            MainUiPolicy.sortSongs(songs, "title_asc").map { it.id },
        )
        assertEquals(
            listOf("older", "newer", "undated"),
            MainUiPolicy.sortSongs(songs, "member_asc").map { it.id },
        )
    }

    @Test
    fun songMatchesSelectedGenerationByMemberIds() {
        val song = SongCatalogItem(
            id = "video-1",
            youtubeVideoId = "video-1",
            title = "Collab",
            type = SongType.COVER,
            members = listOf(
                SongMemberSummary(id = "yuzuha-riko", nameKo = "유즈하 리코"),
                SongMemberSummary(id = "neneko-mashiro", nameKo = "네네코 마시로"),
            ),
            youtubeUrl = "https://www.youtube.com/watch?v=video-1",
        )
        val memberGenerations = mapOf(
            "yuzuha-riko" to "gen3",
            "neneko-mashiro" to "gen2",
        )

        assertTrue(MainUiPolicy.songMatchesGeneration(song, "all", memberGenerations))
        assertTrue(MainUiPolicy.songMatchesGeneration(song, "gen2", memberGenerations))
        assertTrue(MainUiPolicy.songMatchesGeneration(song, "gen3", memberGenerations))
        assertFalse(MainUiPolicy.songMatchesGeneration(song, "gen1", memberGenerations))
    }

    @Test
    fun songMatchesQueryByTitleOrMemberDisplayText() {
        val song = SongCatalogItem(
            id = "video-1",
            youtubeVideoId = "video-1",
            title = "Starlight Cover",
            type = SongType.COVER,
            members = listOf(SongMemberSummary(id = "yuzuha-riko", nameKo = "유즈하 리코")),
            youtubeUrl = "https://www.youtube.com/watch?v=video-1",
        )

        assertTrue(MainUiPolicy.songMatchesQuery(song, "starlight"))
        assertTrue(MainUiPolicy.songMatchesQuery(song, "리코"))
        assertTrue(MainUiPolicy.songMatchesQuery(song, ""))
        assertFalse(MainUiPolicy.songMatchesQuery(song, "마시로"))
    }

    @Test
    fun songPaginationCalculatesPagesAndSlicesItems() {
        val songs = (1..45).map { index ->
            SongCatalogItem(
                id = "video-$index",
                youtubeVideoId = "video-$index",
                title = "Song $index",
                type = SongType.COVER,
                youtubeUrl = "https://www.youtube.com/watch?v=video-$index",
            )
        }

        assertEquals(3, MainUiPolicy.songPageCount(totalItems = songs.size, pageSize = 20))
        assertEquals((1..20).map { "video-$it" }, MainUiPolicy.songPageItems(songs, page = 1, pageSize = 20).map { it.id })
        assertEquals((21..40).map { "video-$it" }, MainUiPolicy.songPageItems(songs, page = 2, pageSize = 20).map { it.id })
        assertEquals((41..45).map { "video-$it" }, MainUiPolicy.songPageItems(songs, page = 3, pageSize = 20).map { it.id })
        assertEquals(3, MainUiPolicy.coerceSongPage(page = 99, totalItems = songs.size, pageSize = 20))
        assertEquals(1, MainUiPolicy.coerceSongPage(page = 0, totalItems = songs.size, pageSize = 20))
    }

    @Test
    fun songMemberDisplayJoinsCollaborationMembers() {
        val song = SongCatalogItem(
            id = "video-1",
            youtubeVideoId = "video-1",
            title = "Collab",
            type = SongType.COVER,
            members = listOf(
                SongMemberSummary(id = "yuzuha-riko", nameKo = "유즈하 리코"),
                SongMemberSummary(id = "neneko-mashiro", nameKo = "네네코 마시로"),
            ),
            youtubeUrl = "https://www.youtube.com/watch?v=video-1",
        )

        assertEquals("유즈하 리코 · 네네코 마시로", MainUiPolicy.songMemberDisplayText(song))
        assertEquals("스텔라이브", MainUiPolicy.songMemberDisplayText(song.copy(members = emptyList())))
    }

    @Test
    fun songTitleDisplayTextUsesOnlySongTitle() {
        val song = SongCatalogItem(
            id = "video-1",
            youtubeVideoId = "video-1",
            title = "  Stellar Light  ",
            type = SongType.COVER,
            members = listOf(SongMemberSummary(id = "ayatsuno-yuni", nameKo = "아야츠노 유니")),
            youtubeUrl = "https://www.youtube.com/watch?v=video-1",
        )

        assertEquals("Stellar Light", MainUiPolicy.songTitleDisplayText(song))
    }

    @Test
    fun songDisplayTextParsesCoverTitleFormats() {
        val member = SongMemberSummary(id = "ayatsuno-yuni", nameKo = "아야츠노 유니")
        val songs = listOf(
            SongCatalogItem(
                id = "slash",
                youtubeVideoId = "slash",
                title = "Stellar Light / 아야츠노 유니 Cover",
                type = SongType.COVER,
                members = listOf(member),
            ),
            SongCatalogItem(
                id = "pipe",
                youtubeVideoId = "pipe",
                title = "Stellar Light | 아야츠노 유니 Cover",
                type = SongType.COVER,
                members = listOf(member),
            ),
            SongCatalogItem(
                id = "live",
                youtubeVideoId = "live",
                title = "[4K] Stellar Light | 아야츠노 유니 3D Live Cover",
                type = SongType.COVER,
                members = listOf(member),
            ),
        )

        songs.forEach { song ->
            val display = MainUiPolicy.songDisplayText(song)
            assertEquals("Stellar Light", display.title)
            assertEquals("아야츠노 유니", display.subtitle)
        }
    }

    @Test
    fun songDisplayTextPreservesCoverOriginalArtistDetailsFromDbPatterns() {
        val shibuki = SongMemberSummary(id = "tenko-shibuki", nameKo = "텐코 시부키")
        val hina = SongMemberSummary(id = "shirayuki-hina", nameKo = "시라유키 히나")
        val lize = SongMemberSummary(id = "akane-lize", nameKo = "아카네 리제")

        val slashInParentheses = MainUiPolicy.songDisplayText(
            SongCatalogItem(
                id = "slash-in-parentheses",
                youtubeVideoId = "slash-in-parentheses",
                title = "친애하는 소년이여 (拝啓、少年よ / Hump Back)  / 텐코 시부키 (Tenko Shibuki) cover",
                type = SongType.COVER,
                members = listOf(shibuki),
            ),
        )
        val pipeOriginalArtist = MainUiPolicy.songDisplayText(
            SongCatalogItem(
                id = "pipe-original-artist",
                youtubeVideoId = "pipe-original-artist",
                title = "Mrs. GREEN APPLE - 춘수(春愁) | 시라유키 히나 Cover",
                type = SongType.COVER,
                members = listOf(hina),
            ),
        )
        val koreanPipe = MainUiPolicy.songDisplayText(
            SongCatalogItem(
                id = "korean-pipe",
                youtubeVideoId = "korean-pipe",
                title = "orion - [米津玄師 / 요네즈 켄시] ㅣ아카네 리제(Akane Lize) 【COVER】",
                type = SongType.COVER,
                members = listOf(lize),
            ),
        )

        assertEquals("친애하는 소년이여 (拝啓、少年よ / Hump Back)", slashInParentheses.title)
        assertEquals("텐코 시부키", slashInParentheses.subtitle)
        assertEquals("Mrs. GREEN APPLE - 춘수(春愁)", pipeOriginalArtist.title)
        assertEquals("시라유키 히나", pipeOriginalArtist.subtitle)
        assertEquals("orion - [米津玄師 / 요네즈 켄시]", koreanPipe.title)
        assertEquals("아카네 리제", koreanPipe.subtitle)
    }

    @Test
    fun songDisplayTextCompactsDbCoverGenerationGroupPattern() {
        val catalogMembers = listOf(
            songMember("neneko-mashiro", "네네코 마시로", "gen2", generationName = "2기생", unitName = "Universe"),
            songMember("shirayuki-hina", "시라유키 히나", "gen2", generationName = "2기생", unitName = "Universe"),
            songMember("arahashi-tabi", "아라하시 타비", "gen2", generationName = "2기생", unitName = "Universe"),
            songMember("akane-lize", "아카네 리제", "gen2", generationName = "2기생", unitName = "Universe"),
        )
        val display = MainUiPolicy.songDisplayText(
            SongCatalogItem(
                id = "blackhole",
                youtubeVideoId = "blackhole",
                title = "[4K] BLACKHOLE - IVE / 유니버스 (Universe) Cover",
                type = SongType.COVER,
                members = catalogMembers.map { SongMemberSummary(id = it.id, nameKo = it.koreanName) },
            ),
            catalogMembers,
        )

        assertEquals("BLACKHOLE - IVE", display.title)
        assertEquals("Universe (2기생)", display.subtitle)
    }

    @Test
    fun songDisplayTextParsesOriginalTitleFormats() {
        val member = SongMemberSummary(id = "ayatsuno-yuni", nameKo = "아야츠노 유니")

        assertEquals(
            "Stellar Light",
            MainUiPolicy.songDisplayText(
                SongCatalogItem(
                    id = "original",
                    youtubeVideoId = "original",
                    title = "아야츠노 유니 | Stellar Light",
                    type = SongType.ORIGINAL,
                    members = listOf(member),
                ),
            ).title,
        )
        assertEquals(
            "Stellar Light",
            MainUiPolicy.songDisplayText(
                SongCatalogItem(
                    id = "quoted",
                    youtubeVideoId = "quoted",
                    title = "아야츠노 유니 | 'Stellar Light'",
                    type = SongType.ORIGINAL,
                    members = listOf(member),
                ),
            ).title,
        )
        assertEquals(
            "Stellar Light",
            MainUiPolicy.songDisplayText(
                SongCatalogItem(
                    id = "music-video",
                    youtubeVideoId = "music-video",
                    title = "아야츠노 유니 | 'Stellar Light' Music Video",
                    type = SongType.ORIGINAL,
                    members = listOf(member),
                ),
            ).title,
        )
    }

    @Test
    fun songDisplayTextParsesDbOriginalTitleFormats() {
        val yuni = SongMemberSummary(id = "ayatsuno-yuni", nameKo = "아야츠노 유니")
        val quotedMusicVideo = MainUiPolicy.songDisplayText(
            SongCatalogItem(
                id = "bbijilge",
                youtubeVideoId = "bbijilge",
                title = "아야츠노 유니 ( Ayatsuno Yuni ) | ‘삐질게 (BBiJilGe)’ Music Video",
                type = SongType.ORIGINAL,
                members = listOf(yuni),
            ),
        )
        val noPipeQuoted = MainUiPolicy.songDisplayText(
            SongCatalogItem(
                id = "milky-way",
                youtubeVideoId = "milky-way",
                title = "STELLIVE (스텔라이브) ‘Milky Way’ Music Video",
                type = SongType.ORIGINAL,
                members = emptyList(),
            ),
        )
        val iSeparatorQuoted = MainUiPolicy.songDisplayText(
            SongCatalogItem(
                id = "star-trail",
                youtubeVideoId = "star-trail",
                title = "스텔라이브 (StelLive) I 'STAR TRAIL (스타트레일)'",
                type = SongType.ORIGINAL,
                members = emptyList(),
            ),
        )

        assertEquals("삐질게 (BBiJilGe)", quotedMusicVideo.title)
        assertEquals("아야츠노 유니", quotedMusicVideo.subtitle)
        assertEquals("Milky Way", noPipeQuoted.title)
        assertEquals("스텔라이브", noPipeQuoted.subtitle)
        assertEquals("STAR TRAIL (스타트레일)", iSeparatorQuoted.title)
        assertEquals("스텔라이브", iSeparatorQuoted.subtitle)
    }

    @Test
    fun songDisplayTextAddsExternalCollaboratorsFromTitleArtistSegment() {
        val display = MainUiPolicy.songDisplayText(
            SongCatalogItem(
                id = "collab",
                youtubeVideoId = "collab",
                title = "Stellar Light | 아야츠노 유니 & 외부 보컬 Cover",
                type = SongType.COVER,
                members = listOf(SongMemberSummary(id = "ayatsuno-yuni", nameKo = "아야츠노 유니")),
            ),
        )

        assertEquals("Stellar Light", display.title)
        assertEquals("아야츠노 유니 · 외부 보컬", display.subtitle)
    }

    @Test
    fun songDisplayTextAddsExternalCollaboratorFromDbCoverPerformerSegment() {
        val display = MainUiPolicy.songDisplayText(
            SongCatalogItem(
                id = "pop-stars",
                youtubeVideoId = "pop-stars",
                title = "[4K] POP/STARS / Nerissa Ravencroft(네리사 레이븐크로프트) x 아오쿠모 린(Aokumo Rin) Cover",
                type = SongType.COVER,
                members = listOf(SongMemberSummary(id = "aokumo-rin", nameKo = "아오쿠모 린")),
            ),
        )

        assertEquals("POP/STARS", display.title)
        assertEquals("아오쿠모 린 · Nerissa Ravencroft(네리사 레이븐크로프트)", display.subtitle)
    }

    @Test
    fun songDisplayTextCompactsFullGenerationGroupOnly() {
        val catalogMembers = listOf(
            songMember("member-a", "멤버 A", "gen2", generationName = "2기생", unitName = "Universe"),
            songMember("member-b", "멤버 B", "gen2", generationName = "2기생", unitName = "Universe"),
            songMember("member-c", "멤버 C", "gen3", generationName = "3기생", unitName = "Cliche"),
        )
        val fullGroup = SongCatalogItem(
            id = "group",
            youtubeVideoId = "group",
            title = "Universe | 'Stellar Light' Music Video",
            type = SongType.ORIGINAL,
            members = listOf(
                SongMemberSummary(id = "member-a", nameKo = "멤버 A"),
                SongMemberSummary(id = "member-b", nameKo = "멤버 B"),
            ),
        )
        val partialGroup = fullGroup.copy(
            id = "partial",
            youtubeVideoId = "partial",
            members = listOf(SongMemberSummary(id = "member-a", nameKo = "멤버 A")),
        )

        assertEquals("Universe (2기생)", MainUiPolicy.songDisplayText(fullGroup, catalogMembers).subtitle)
        assertEquals("멤버 A", MainUiPolicy.songDisplayText(partialGroup, catalogMembers).subtitle)
    }

    @Test
    fun songDisplayTextUsesStelliveGroupNameAsIs() {
        val display = MainUiPolicy.songDisplayText(
            SongCatalogItem(
                id = "stellive",
                youtubeVideoId = "stellive",
                title = "스텔라이브 | 'Stellar Light' Music Video",
                type = SongType.ORIGINAL,
                members = emptyList(),
            ),
        )

        assertEquals("Stellar Light", display.title)
        assertEquals("스텔라이브", display.subtitle)
    }

    @Test
    fun songDisplayTextDeduplicatesRepeatedParsedTitle() {
        val display = MainUiPolicy.songDisplayText(
            SongCatalogItem(
                id = "repeated",
                youtubeVideoId = "repeated",
                title = "Stellar Light Stellar Light | 아야츠노 유니 Cover",
                type = SongType.COVER,
                members = listOf(SongMemberSummary(id = "ayatsuno-yuni", nameKo = "아야츠노 유니")),
            ),
        )

        assertEquals("Stellar Light", display.title)
    }

    @Test
    fun songMatchesQueryUsesParsedTitleAndSubtitle() {
        val song = SongCatalogItem(
            id = "query",
            youtubeVideoId = "query",
            title = "Stellar Light | 아야츠노 유니 & 외부 보컬 Cover",
            type = SongType.COVER,
            members = listOf(SongMemberSummary(id = "ayatsuno-yuni", nameKo = "아야츠노 유니")),
        )

        assertTrue(MainUiPolicy.songMatchesQuery(song, "Stellar Light"))
        assertTrue(MainUiPolicy.songMatchesQuery(song, "외부 보컬"))
        assertFalse(MainUiPolicy.songMatchesQuery(song, "Cover"))
    }

    @Test
    fun songPremiereStatusLabelShowsOnlyScheduledAndLivePremieres() {
        val baseSong = SongCatalogItem(
            id = "video-1",
            youtubeVideoId = "video-1",
            title = "Premiere Cover",
            type = SongType.COVER,
            youtubeUrl = "https://www.youtube.com/watch?v=video-1",
        )

        assertEquals(
            "최초 공개 예정 · 6월 28일 17:00",
            MainUiPolicy.songPremiereStatusLabel(
                baseSong.copy(
                    premiere = YoutubePremiereMetadata(
                        classification = "assumed",
                        state = "scheduled",
                        scheduledStartAt = Instant.parse("2026-06-28T08:00:00Z"),
                    ),
                ),
            ),
        )
        assertEquals(
            "최초 공개 예정",
            MainUiPolicy.songPremiereStatusLabel(
                baseSong.copy(premiere = YoutubePremiereMetadata(classification = "assumed", state = "scheduled")),
            ),
        )
        assertEquals(
            "최초 공개 중",
            MainUiPolicy.songPremiereStatusLabel(
                baseSong.copy(premiere = YoutubePremiereMetadata(classification = "assumed", state = "live")),
            ),
        )
        assertNull(
            MainUiPolicy.songPremiereStatusLabel(
                baseSong.copy(premiere = YoutubePremiereMetadata(classification = "assumed", state = "completed")),
            ),
        )
        assertNull(
            MainUiPolicy.songPremiereStatusLabel(
                baseSong.copy(premiere = YoutubePremiereMetadata(classification = "assumed", state = "unknown")),
            ),
        )
        assertNull(MainUiPolicy.songPremiereStatusLabel(baseSong))
    }

    @Test
    fun songExternalUrlAcceptsHttpAndHttpsOnly() {
        assertEquals(
            "https://www.youtube.com/watch?v=abc",
            MainUiPolicy.songExternalUrl("https://www.youtube.com/watch?v=abc"),
        )
        assertEquals(
            "http://www.youtube.com/watch?v=abc",
            MainUiPolicy.songExternalUrl("http://www.youtube.com/watch?v=abc"),
        )
        assertNull(MainUiPolicy.songExternalUrl(""))
        assertNull(MainUiPolicy.songExternalUrl("javascript:alert(1)"))
    }

    @Test
    fun songMemberFiltersUseActiveGenerationMembersAndSupportQuickClear() {
        val members = listOf(
            songMember(id = "yuzuha-riko", name = "유즈하 리코", generationId = "gen3"),
            songMember(id = "neneko-mashiro", name = "네네코 마시로", generationId = "gen2"),
            songMember(id = "gangzi", name = "강지", generationId = "gamja", role = CatalogRole.REPRESENTATIVE),
            songMember(id = "stellive-official", name = "스텔라이브 공식", generationId = "official", role = CatalogRole.OFFICIAL_CHANNEL),
        )
        val collabSong = SongCatalogItem(
            id = "video-1",
            youtubeVideoId = "video-1",
            title = "Collab",
            type = SongType.COVER,
            members = listOf(
                SongMemberSummary(id = "yuzuha-riko", nameKo = "유즈하 리코"),
                SongMemberSummary(id = "neneko-mashiro", nameKo = "네네코 마시로"),
            ),
            youtubeUrl = "https://www.youtube.com/watch?v=video-1",
        )

        val options = MainUiPolicy.songMemberFilters(members)

        assertEquals("all", options.first().id)
        assertFalse(options.any { it.id == "gangzi" || it.id == "stellive-official" })
        assertTrue(MainUiPolicy.songMatchesMember(collabSong, "yuzuha-riko"))
        assertTrue(MainUiPolicy.songMatchesMember(collabSong, "all"))
        assertFalse(MainUiPolicy.songMatchesMember(collabSong, "akane-lize"))
        assertEquals("전체", MainUiPolicy.songMemberFilterLabel(members, "all"))
        assertEquals("네네코 마시로", MainUiPolicy.songMemberFilterLabel(members, "neneko-mashiro"))
        assertFalse(MainUiPolicy.canClearSongMemberFilter("all"))
        assertTrue(MainUiPolicy.canClearSongMemberFilter("neneko-mashiro"))
    }

    @Test
    fun songThumbnailUsesSixteenByNineAspectRatio() {
        assertEquals(16f / 9f, MainUiPolicy.SONG_THUMBNAIL_ASPECT_RATIO)
        assertEquals(63, MainUiPolicy.songThumbnailHeightDp(widthDp = 112))
    }

    @Test
    fun songSearchAndMemberSummaryUseStableNormalizedValues() {
        val members = listOf(songMember("neneko-mashiro", "네네코 마시로", "gen2"))

        assertEquals("", MainUiPolicy.normalizedSongQuery("   "))
        assertEquals("stella", MainUiPolicy.normalizedSongQuery("  stella  "))
        assertEquals(
            "네네코 마시로 · 12곡",
            MainUiPolicy.songMemberFilterSummary(members, "neneko-mashiro", 12),
        )
    }

    @Test
    fun recentSongsAreNewestFirstAcrossCoversAndOriginals() {
        val songs = listOf(
            SongCatalogItem("old", "old", "Old", SongType.COVER, publishedAt = Instant.parse("2026-01-01T00:00:00Z")),
            SongCatalogItem("original", "original", "Original", SongType.ORIGINAL, publishedAt = Instant.parse("2026-06-01T00:00:00Z")),
            SongCatalogItem("new", "new", "New", SongType.COVER, publishedAt = Instant.parse("2026-06-02T00:00:00Z")),
            SongCatalogItem("middle", "middle", "Middle", SongType.COVER, publishedAt = Instant.parse("2026-05-01T00:00:00Z")),
            SongCatalogItem("same-date-z", "same-date-z", "Zeta", SongType.COVER, publishedAt = Instant.parse("2026-06-03T00:00:00Z")),
            SongCatalogItem("same-date-a", "same-date-a", "Alpha", SongType.ORIGINAL, publishedAt = Instant.parse("2026-06-03T00:00:00Z")),
        )

        assertEquals(
            MainUiPolicy.sortSongs(songs, "publishedAt_desc").take(3).map { it.id },
            MainUiPolicy.recentSongs(songs, limit = 3).map { it.id },
        )
    }

    @Test
    fun songsUseExistingTopBarAndHistoryMovesToSettings() {
        assertEquals("노래", MainUiPolicy.topBarTitle("songs"))
        assertEquals("YouTube 업로드 곡 탐색", MainUiPolicy.topBarRole("songs"))
        assertTrue(MainUiPolicy.showsSettingsTopBarAction("songs", canGoBack = false))
        assertTrue(MainUiPolicy.settingsHubRows(
            deliveryMode = "STANDARD",
            enabledTargets = 15,
            totalTargets = 16,
            enabledPlatforms = 4,
            totalPlatforms = 5,
            enabledEventTypes = 12,
            totalEventTypes = 16,
            hubEventsEnabled = true,
            deadlineSoonEnabled = true,
        ).any { it.screenId == "history" && it.title == "알림 기록" })
    }

    private fun songMember(
        id: String,
        name: String,
        generationId: String,
        role: CatalogRole = CatalogRole.MEMBER,
        generationName: String = generationId,
        unitName: String = generationId,
    ): HubMember = HubMember(
        id = id,
        koreanName = name,
        englishName = id,
        generationId = generationId,
        generationName = generationName,
        unitName = unitName,
        catalogRole = role,
        activeStatus = ActiveStatus.ACTIVE,
        isPerson = role == CatalogRole.MEMBER,
    )

    private fun songCatalogItem(
        id: String,
        title: String,
        memberName: String,
        publishedAt: String?,
    ): SongCatalogItem = SongCatalogItem(
        id = id,
        youtubeVideoId = id,
        title = title,
        type = SongType.COVER,
        publishedAt = publishedAt?.let(Instant::parse) ?: Instant.EPOCH,
        members = listOf(SongMemberSummary(id = "$id-member", nameKo = memberName)),
        youtubeUrl = "https://www.youtube.com/watch?v=$id",
    )
}
