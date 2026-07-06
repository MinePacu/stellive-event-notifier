package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.ui.chrome.MainScreenChromePolicy
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
    fun goodsEventDetailKeepsExpandedHeaderWithoutStickyTitle() {
        val spec = MainScreenChromePolicy.spec("goods_event_detail", canGoBack = true)

        assertTrue(spec.showExpandedBodyHeader)
        assertFalse(spec.keepTopBarTitleWhenScrolled)
    }

    @Test
    fun settingsActionIsVisibleOutsideSettingsFlow() {
        listOf(
            "home",
            "live",
            "songs",
            "goods_events",
            "goods_event_detail",
            "song_search",
        ).forEach { screenId ->
            assertTrue(MainScreenChromePolicy.spec(screenId, canGoBack = screenId != "home").showSettingsAction)
        }
    }

    @Test
    fun settingsActionIsHiddenThroughoutSettingsFlow() {
        listOf(
            "settings",
            "settings_delivery",
            "settings_targets",
            "settings_platforms",
            "settings_event_types",
            "settings_hub_events",
            "settings_advanced",
        ).forEach { screenId ->
            assertFalse(MainScreenChromePolicy.spec(screenId, canGoBack = true).showSettingsAction)
        }
    }

    @Test
    fun songsRootShowsSearchAction() {
        val spec = MainScreenChromePolicy.spec("songs")

        assertTrue(spec.showSongSearchAction)
        assertFalse(MainScreenChromePolicy.spec("song_search", canGoBack = true).showSongSearchAction)
    }
}
