package dev.stellive.hub

import dev.stellive.hub.core.model.ActiveStatus
import dev.stellive.hub.core.model.CatalogRole
import dev.stellive.hub.core.model.HubMember
import dev.stellive.hub.core.model.SongCatalogItem
import dev.stellive.hub.core.model.SongMemberSummary
import dev.stellive.hub.core.model.SongType
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
    fun recentCoverSongsAreNewestFirstAndLimited() {
        val songs = listOf(
            SongCatalogItem("old", "old", "Old", SongType.COVER, publishedAt = Instant.parse("2026-01-01T00:00:00Z")),
            SongCatalogItem("original", "original", "Original", SongType.ORIGINAL, publishedAt = Instant.parse("2026-06-01T00:00:00Z")),
            SongCatalogItem("new", "new", "New", SongType.COVER, publishedAt = Instant.parse("2026-06-02T00:00:00Z")),
            SongCatalogItem("middle", "middle", "Middle", SongType.COVER, publishedAt = Instant.parse("2026-05-01T00:00:00Z")),
        )

        assertEquals(listOf("new", "middle"), MainUiPolicy.recentCoverSongs(songs, limit = 2).map { it.id })
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
    ): HubMember = HubMember(
        id = id,
        koreanName = name,
        englishName = id,
        generationId = generationId,
        generationName = generationId,
        unitName = generationId,
        catalogRole = role,
        activeStatus = ActiveStatus.ACTIVE,
        isPerson = role == CatalogRole.MEMBER,
    )
}
