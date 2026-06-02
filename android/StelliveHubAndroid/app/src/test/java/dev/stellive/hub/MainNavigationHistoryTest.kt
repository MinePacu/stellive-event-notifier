package dev.stellive.hub

import dev.stellive.hub.feature.home.HubScreen
import dev.stellive.hub.feature.home.MainNavigationHistory
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
}
