package dev.stellive.hub

import dev.stellive.hub.ui.components.FilterStripLayoutMode
import dev.stellive.hub.ui.components.TopFilterStripPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class TopFilterStripPolicyTest {
    @Test
    fun threeOptionsUseEqualWidthWithoutScrolling() {
        assertEquals(
            FilterStripLayoutMode.EQUAL_WIDTH,
            TopFilterStripPolicy.layoutMode(optionCount = 3),
        )
    }

    @Test
    fun fourOrMoreOptionsUseHorizontalScroll() {
        assertEquals(
            FilterStripLayoutMode.HORIZONTAL_SCROLL,
            TopFilterStripPolicy.layoutMode(optionCount = 4),
        )
    }

    @Test
    fun filterStripDoesNotShowExtraSelectionOrOverflowHints() {
        assertFalse(TopFilterStripPolicy.showsTrailingOverflowHint())
        assertFalse(TopFilterStripPolicy.showsSelectedCheckIcon())
    }

    @Test
    fun filterStripKeepsExtraTopPaddingAndTouchHeight() {
        assertEquals(8, TopFilterStripPolicy.ContainerTopPaddingDp)
        assertEquals(8, TopFilterStripPolicy.ContainerBottomPaddingDp)
        assertEquals(42, TopFilterStripPolicy.OptionHeightDp)
        assertEquals(6, TopFilterStripPolicy.OptionEndMarginDp)
        assertEquals(6, TopFilterStripPolicy.OptionBottomMarginDp)
    }
}
