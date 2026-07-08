package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.feature.songs.SongMemberSelectionMode
import dev.minepacu.stelliveeventnotifier.feature.songs.SongsPanePolicy
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubAdaptivePolicy
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldFeature
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldOrientation
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SongsPanePolicyTest {
    @Test
    fun compactKeepsFullscreenMemberSelectionAndSearchAction() {
        val spec = HubAdaptivePolicy.spec(widthDp = 599)

        assertFalse(SongsPanePolicy.shouldUseTwoPane(spec))
        assertFalse(SongsPanePolicy.shouldUseFoldAwarePane(spec))
        assertTrue(SongsPanePolicy.shouldShowTopBarSearchAction(spec))
        assertEquals(SongMemberSelectionMode.NAVIGATE_TO_MEMBER_FILTER, SongsPanePolicy.memberSelectionMode(spec))
    }

    @Test
    fun mediumAndExpandedUseInlineFilterPane() {
        listOf(600, 840).forEach { widthDp ->
            val spec = HubAdaptivePolicy.spec(widthDp)

            assertTrue(SongsPanePolicy.shouldUseTwoPane(spec))
            assertFalse(SongsPanePolicy.shouldUseFoldAwarePane(spec))
            assertFalse(SongsPanePolicy.shouldShowTopBarSearchAction(spec))
            assertEquals(SongMemberSelectionMode.UPDATE_INLINE_FILTER, SongsPanePolicy.memberSelectionMode(spec))
        }
    }

    @Test
    fun separatingVerticalFoldMarksFoldAwarePane() {
        val spec = HubAdaptivePolicy.spec(
            widthDp = 840,
            foldFeature = HubFoldFeature(
                state = HubFoldState.FLAT,
                orientation = HubFoldOrientation.VERTICAL,
                isSeparating = true,
                bounds = null,
            ),
        )

        assertTrue(SongsPanePolicy.shouldUseTwoPane(spec))
        assertTrue(SongsPanePolicy.shouldUseFoldAwarePane(spec))
        assertFalse(SongsPanePolicy.shouldShowTopBarSearchAction(spec))
        assertEquals(SongMemberSelectionMode.UPDATE_INLINE_FILTER, SongsPanePolicy.memberSelectionMode(spec))
    }
}
