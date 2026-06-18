package dev.stellive.hub

import dev.stellive.hub.feature.home.MainUiPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TopBarTextPolicyTest {
    @Test
    fun topBarTextOnlyShowsForSettingsAndGoodsEventDetail() {
        assertFalse(MainUiPolicy.showsTopBarText("home"))
        assertFalse(MainUiPolicy.showsTopBarText("live"))
        assertFalse(MainUiPolicy.showsTopBarText("history"))
        assertFalse(MainUiPolicy.showsTopBarText("goods_events"))

        assertTrue(MainUiPolicy.showsTopBarText("settings"))
        assertTrue(MainUiPolicy.showsTopBarText("settings_delivery"))
        assertTrue(MainUiPolicy.showsTopBarText("goods_event_detail"))
    }

    @Test
    fun goodsEventDetailTopBarUsesEventTitleAndDetailSubtitle() {
        assertEquals("콜라보 팝업", MainUiPolicy.goodsEventDetailTopBarTitle("콜라보 팝업"))
        assertEquals("상세", MainUiPolicy.goodsEventDetailTopBarRole())
    }
}
