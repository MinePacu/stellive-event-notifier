package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.feature.home.HubScreen
import dev.minepacu.stelliveeventnotifier.ui.navigation.LatestNavigationRequestQueue
import dev.minepacu.stelliveeventnotifier.ui.navigation.ScreenNavigationMotion
import dev.minepacu.stelliveeventnotifier.ui.navigation.ScreenTransitionPolicy
import dev.minepacu.stelliveeventnotifier.ui.navigation.ScreenTransitionReason
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ScreenTransitionPolicyTest {
    @Test
    fun rootOrderDeterminesForwardAndBackwardMotion() {
        assertEquals(
            ScreenNavigationMotion.ROOT_FORWARD,
            ScreenTransitionPolicy.motion(
                HubScreen.HOME,
                HubScreen.SONGS,
                ScreenTransitionReason.ROOT_SELECTION,
            ),
        )
        assertEquals(
            ScreenNavigationMotion.ROOT_BACKWARD,
            ScreenTransitionPolicy.motion(
                HubScreen.GOODS_EVENTS,
                HubScreen.LIVE,
                ScreenTransitionReason.ROOT_SELECTION,
            ),
        )
    }

    @Test
    fun pushAndPopUseOppositeDirections() {
        assertEquals(
            ScreenNavigationMotion.PUSH,
            ScreenTransitionPolicy.motion(HubScreen.SONGS, HubScreen.SONG_SEARCH, ScreenTransitionReason.PUSH),
        )
        assertEquals(
            ScreenNavigationMotion.POP,
            ScreenTransitionPolicy.motion(HubScreen.SONG_SEARCH, HubScreen.SONGS, ScreenTransitionReason.POP),
        )
        assertEquals(1, ScreenTransitionPolicy.horizontalDirection(ScreenNavigationMotion.PUSH, isRtl = false))
        assertEquals(-1, ScreenTransitionPolicy.horizontalDirection(ScreenNavigationMotion.POP, isRtl = false))
    }

    @Test
    fun rtlReversesHorizontalDirection() {
        assertEquals(-1, ScreenTransitionPolicy.horizontalDirection(ScreenNavigationMotion.ROOT_FORWARD, isRtl = true))
        assertEquals(1, ScreenTransitionPolicy.horizontalDirection(ScreenNavigationMotion.POP, isRtl = true))
    }

    @Test
    fun sameScreenNavigationHasNoMotion() {
        assertEquals(
            ScreenNavigationMotion.NONE,
            ScreenTransitionPolicy.motion(HubScreen.LIVE, HubScreen.LIVE, ScreenTransitionReason.ROOT_SELECTION),
        )
    }

    @Test
    fun nonNavigationRenderingHasNoMotion() {
        listOf(
            ScreenTransitionReason.INITIAL_RENDER,
            ScreenTransitionReason.DATA_REFRESH,
            ScreenTransitionReason.WINDOW_CHANGE,
        ).forEach { reason ->
            assertEquals(
                ScreenNavigationMotion.NONE,
                ScreenTransitionPolicy.motion(HubScreen.HOME, HubScreen.LIVE, reason),
            )
        }
    }

    @Test
    fun twoPaneSelectionUsesCrossFade() {
        assertEquals(
            ScreenNavigationMotion.CROSS_FADE,
            ScreenTransitionPolicy.motion(
                HubScreen.GOODS_EVENTS,
                HubScreen.GOODS_EVENTS,
                ScreenTransitionReason.TWO_PANE_SELECTION,
            ),
        )
    }

    @Test
    fun activeTransitionKeepsOnlyLatestDistinctRequest() {
        val queue = LatestNavigationRequestQueue<String>()

        assertFalse(queue.offer(activeKey = "root:live", key = "root:live", request = "duplicate-active"))
        assertTrue(queue.offer(activeKey = "root:live", key = "root:songs", request = "songs"))
        assertFalse(queue.offer(activeKey = "root:live", key = "root:songs", request = "duplicate-pending"))
        assertTrue(queue.offer(activeKey = "root:live", key = "root:goods", request = "goods"))

        assertEquals("goods", queue.take())
        assertEquals(null, queue.take())
    }
}
