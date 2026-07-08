package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.feature.hubevents.GoodsEventSelectionMode
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventsPanePolicy
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubAdaptivePolicy
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldFeature
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldOrientation
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HubEventsPanePolicyTest {
    @Test
    fun compactUsesFullscreenDetailNavigation() {
        val spec = HubAdaptivePolicy.spec(widthDp = 599)

        assertFalse(HubEventsPanePolicy.shouldUseTwoPane(spec))
        assertFalse(HubEventsPanePolicy.shouldUseFoldAwarePane(spec))
        assertEquals(GoodsEventSelectionMode.NAVIGATE_TO_DETAIL, HubEventsPanePolicy.selectionMode(spec))
    }

    @Test
    fun mediumAndExpandedUseInlineDetailPane() {
        listOf(600, 840).forEach { widthDp ->
            val spec = HubAdaptivePolicy.spec(widthDp)

            assertTrue(HubEventsPanePolicy.shouldUseTwoPane(spec))
            assertFalse(HubEventsPanePolicy.shouldUseFoldAwarePane(spec))
            assertEquals(GoodsEventSelectionMode.UPDATE_INLINE_DETAIL, HubEventsPanePolicy.selectionMode(spec))
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

        assertTrue(HubEventsPanePolicy.shouldUseTwoPane(spec))
        assertTrue(HubEventsPanePolicy.shouldUseFoldAwarePane(spec))
        assertEquals(GoodsEventSelectionMode.UPDATE_INLINE_DETAIL, HubEventsPanePolicy.selectionMode(spec))
    }
}
