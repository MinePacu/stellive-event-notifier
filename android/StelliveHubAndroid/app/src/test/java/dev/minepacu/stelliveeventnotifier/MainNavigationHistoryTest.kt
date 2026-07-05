package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.feature.home.HubScreen
import dev.minepacu.stelliveeventnotifier.feature.home.MainNavigationHistory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MainNavigationHistoryTest {
    @Test
    fun selectingDifferentScreensAddsPreviousScreenToBackStack() {
        val history = MainNavigationHistory()

        history.select(HubScreen.LIVE)
        history.select(HubScreen.SETTINGS)

        assertTrue(history.canGoBack)
        assertEquals(HubScreen.LIVE, history.goBack())
        assertEquals(HubScreen.HOME, history.goBack())
        assertFalse(history.canGoBack)
    }

    @Test
    fun selectingCurrentScreenDoesNotCreateDuplicateBackEntry() {
        val history = MainNavigationHistory()

        history.select(HubScreen.HOME)

        assertFalse(history.canGoBack)
        assertNull(history.goBack())
    }

    @Test
    fun primaryTabSelectionClearsBackStack() {
        val history = MainNavigationHistory()

        history.select(HubScreen.SETTINGS)
        history.selectRoot(HubScreen.GOODS_EVENTS)

        assertEquals(HubScreen.GOODS_EVENTS, history.currentScreen)
        assertFalse(history.canGoBack)
        assertNull(history.goBack())
    }

    @Test
    fun goodsEventDetailReturnsToGoodsEvents() {
        val history = MainNavigationHistory()

        history.select(HubScreen.GOODS_EVENTS)
        history.select(HubScreen.GOODS_EVENT_DETAIL)

        assertEquals(HubScreen.GOODS_EVENT_DETAIL, history.currentScreen)
        assertEquals(HubScreen.GOODS_EVENTS, history.goBack())
        assertEquals(HubScreen.GOODS_EVENTS, history.currentScreen)
    }

    @Test
    fun subPageSystemBackReturnsToCurrentRoot() {
        val history = MainNavigationHistory()

        history.selectRoot(HubScreen.SONGS)
        history.select(HubScreen.SONG_SEARCH)

        assertEquals(HubScreen.SONGS, history.goBackToCurrentRoot())
        assertEquals(HubScreen.SONGS, history.currentScreen)
        assertFalse(history.canGoBack)
    }

    @Test
    fun settingsSystemBackReturnsToOpeningRoot() {
        val history = MainNavigationHistory()

        history.selectRoot(HubScreen.LIVE)
        history.select(HubScreen.SETTINGS)

        assertEquals(HubScreen.LIVE, history.goBackToCurrentRoot())
        assertEquals(HubScreen.LIVE, history.currentScreen)
        assertFalse(history.canGoBack)
    }

    @Test
    fun rootSystemBackHasNoNavigationTarget() {
        val history = MainNavigationHistory()

        history.selectRoot(HubScreen.GOODS_EVENTS)

        assertNull(history.goBackToCurrentRoot())
        assertEquals(HubScreen.GOODS_EVENTS, history.currentScreen)
    }
}
