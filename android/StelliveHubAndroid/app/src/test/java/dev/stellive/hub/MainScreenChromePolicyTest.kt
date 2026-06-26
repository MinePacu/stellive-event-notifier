package dev.stellive.hub

import dev.stellive.hub.ui.chrome.MainScreenChromePolicy
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MainScreenChromePolicyTest {
    @Test
    fun rootScreensHideExpandedHeaderAndCollapseTitleAfterScroll() {
        listOf("home", "live", "songs", "goods_events").forEach { screenId ->
            val spec = MainScreenChromePolicy.spec(screenId)

            assertFalse(spec.showExpandedBodyHeader)
            assertTrue(spec.showTopBarTitleAtRest)
            assertFalse(spec.keepTopBarTitleWhenScrolled)
        }
    }

    @Test
    fun searchAndSettingsScreensRemoveBodyHeaderAndCollapseTitleAfterScroll() {
        listOf(
            "song_search",
            "song_member_filter",
            "settings",
            "settings_delivery",
            "settings_targets",
            "settings_platforms",
            "settings_event_types",
            "settings_hub_events",
            "settings_advanced",
        ).forEach { screenId ->
            val spec = MainScreenChromePolicy.spec(screenId, canGoBack = true)

            assertFalse(spec.showExpandedBodyHeader)
            assertTrue(spec.showTopBarTitleAtRest)
            assertFalse(spec.keepTopBarTitleWhenScrolled)
        }
    }

    @Test
    fun goodsEventDetailKeepsExistingExpandedHeaderAndStickyTitle() {
        val spec = MainScreenChromePolicy.spec("goods_event_detail", canGoBack = true)

        assertTrue(spec.showExpandedBodyHeader)
        assertTrue(spec.keepTopBarTitleWhenScrolled)
    }

    @Test
    fun songsRootShowsSettingsAndSearchActions() {
        val spec = MainScreenChromePolicy.spec("songs")

        assertTrue(spec.showSettingsAction)
        assertTrue(spec.showSongSearchAction)
        assertFalse(MainScreenChromePolicy.spec("song_search", canGoBack = true).showSongSearchAction)
    }
}
