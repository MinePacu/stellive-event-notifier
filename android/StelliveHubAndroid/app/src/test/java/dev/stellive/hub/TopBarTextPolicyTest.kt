package dev.stellive.hub

import dev.stellive.hub.feature.home.MainUiPolicy
import dev.stellive.hub.ui.chrome.MainScreenChromePolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TopBarTextPolicyTest {
    @Test
    fun topBarTextShowsAtRestAndOnlyGoodsDetailKeepsItWhileScrolling() {
        listOf("home", "live", "songs", "goods_events", "settings", "song_search", "settings_delivery", "goods_event_detail").forEach {
            assertTrue(MainScreenChromePolicy.spec(it).showTopBarTitleAtRest)
        }
        assertFalse(MainScreenChromePolicy.spec("home").keepTopBarTitleWhenScrolled)
        assertFalse(MainScreenChromePolicy.spec("settings").keepTopBarTitleWhenScrolled)
        assertFalse(MainScreenChromePolicy.spec("song_search").keepTopBarTitleWhenScrolled)
        assertFalse(MainScreenChromePolicy.spec("settings_delivery").keepTopBarTitleWhenScrolled)
        assertTrue(MainScreenChromePolicy.spec("goods_event_detail").keepTopBarTitleWhenScrolled)
    }

    @Test
    fun goodsEventDetailTopBarUsesEventTitleAndDetailSubtitle() {
        assertEquals("콜라보 팝업", MainUiPolicy.goodsEventDetailTopBarTitle("콜라보 팝업"))
        assertEquals("상세", MainUiPolicy.goodsEventDetailTopBarRole())
    }
}
