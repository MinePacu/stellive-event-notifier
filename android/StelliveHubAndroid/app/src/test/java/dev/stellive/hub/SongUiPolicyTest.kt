package dev.stellive.hub

import dev.stellive.hub.feature.home.MainUiPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

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
        assertFalse(MainUiPolicy.songGenerationFilters().any { it.id == "gamja" || it.id == "official" })
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
}
