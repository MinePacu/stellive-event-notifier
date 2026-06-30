package dev.stellive.hub

import dev.stellive.hub.feature.home.MainUiPolicy
import dev.stellive.hub.ui.chrome.MainScreenChromePolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TopBarTextPolicyTest {
    @Test
    fun topBarTextShowsAtRestAndNeverSticksWhileScrolling() {
        listOf("home", "live", "songs", "song_member_filter", "goods_events", "settings", "song_search", "settings_delivery", "goods_event_detail").forEach {
            assertTrue(MainScreenChromePolicy.spec(it).showTopBarTitleAtRest)
            assertFalse(MainScreenChromePolicy.spec(it).keepTopBarTitleWhenScrolled)
        }
    }

    @Test
    fun songMemberFilterTopBarTextUsesSongMemberCopy() {
        assertEquals("노래 멤버 선택", MainUiPolicy.topBarTitle("song_member_filter"))
        assertEquals("노래 목록을 멤버별로 좁혀 봅니다", MainUiPolicy.topBarRole("song_member_filter"))
    }

    @Test
    fun goodsEventDetailTopBarTextIsHidden() {
        assertEquals("", MainUiPolicy.goodsEventDetailTopBarTitle("콜라보 팝업"))
        assertEquals("", MainUiPolicy.goodsEventDetailTopBarRole())
    }
}
