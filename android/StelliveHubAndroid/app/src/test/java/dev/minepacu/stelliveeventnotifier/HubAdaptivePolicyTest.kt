package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubAdaptivePolicy
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldFeature
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldOrientation
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldState
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubWindowWidthClass
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HubAdaptivePolicyTest {
    @Test
    fun widthClassUsesMaterialBreakpoints() {
        assertEquals(HubWindowWidthClass.COMPACT, HubAdaptivePolicy.widthClass(599))
        assertEquals(HubWindowWidthClass.MEDIUM, HubAdaptivePolicy.widthClass(600))
        assertEquals(HubWindowWidthClass.MEDIUM, HubAdaptivePolicy.widthClass(839))
        assertEquals(HubWindowWidthClass.EXPANDED, HubAdaptivePolicy.widthClass(840))
    }

    @Test
    fun expandedWithoutFoldUsesLargeScreenLayoutOnly() {
        val spec = HubAdaptivePolicy.spec(widthDp = 840)

        assertTrue(spec.useLargeScreenLayout)
        assertTrue(spec.showAdjacentLiveAction)
        assertFalse(spec.hasFoldingFeatureInCurrentWindow)
        assertFalse(spec.useBookFoldLayout)
        assertFalse(spec.useFoldAwareTwoPane)
    }

    @Test
    fun verticalSeparatingFoldEnablesFoldAwareTwoPaneOnLargeScreens() {
        val spec = HubAdaptivePolicy.spec(
            widthDp = 840,
            foldFeature = HubFoldFeature(
                state = HubFoldState.FLAT,
                orientation = HubFoldOrientation.VERTICAL,
                isSeparating = true,
                bounds = null,
            ),
        )

        assertTrue(spec.hasFoldingFeatureInCurrentWindow)
        assertTrue(spec.useBookFoldLayout)
        assertTrue(spec.useFoldAwareTwoPane)
    }

    @Test
    fun horizontalHalfOpenedFoldDoesNotEnableBookFoldTwoPane() {
        val spec = HubAdaptivePolicy.spec(
            widthDp = 840,
            foldFeature = HubFoldFeature(
                state = HubFoldState.HALF_OPENED,
                orientation = HubFoldOrientation.HORIZONTAL,
                isSeparating = true,
                bounds = null,
            ),
        )

        assertTrue(spec.hasFoldingFeatureInCurrentWindow)
        assertFalse(spec.useBookFoldLayout)
        assertFalse(spec.useFoldAwareTwoPane)
    }

    @Test
    fun compactFoldDoesNotEnableLargeScreenOrAdjacentActions() {
        val spec = HubAdaptivePolicy.spec(
            widthDp = 599,
            foldFeature = HubFoldFeature(
                state = HubFoldState.FLAT,
                orientation = HubFoldOrientation.VERTICAL,
                isSeparating = true,
                bounds = null,
            ),
        )

        assertFalse(spec.useLargeScreenLayout)
        assertFalse(spec.showAdjacentLiveAction)
        assertFalse(spec.useBookFoldLayout)
        assertFalse(spec.useFoldAwareTwoPane)
    }
}
