package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.ui.components.FilterStripLayoutMode
import dev.minepacu.stelliveeventnotifier.ui.components.TopFilterStripPolicy
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
    fun siblingRowsUseScrollModeWhenAnyRowHasMoreThanThreeOptions() {
        assertEquals(
            FilterStripLayoutMode.HORIZONTAL_SCROLL,
            TopFilterStripPolicy.layoutMode(optionCount = 3, maxOptionCountInStrip = 4),
        )
    }

    @Test
    fun filterStripDoesNotShowExtraSelectionOrOverflowHints() {
        assertFalse(TopFilterStripPolicy.showsTrailingOverflowHint())
        assertFalse(TopFilterStripPolicy.showsSelectedCheckIcon())
    }

    @Test
    fun filterStripKeepsExtraTopPaddingAndTouchHeight() {
        assertEquals(12, TopFilterStripPolicy.ContainerTopPaddingDp)
        assertEquals(10, TopFilterStripPolicy.ContainerBottomPaddingDp)
        assertEquals(2, TopFilterStripPolicy.GroupTopPaddingDp)
        assertEquals(44, TopFilterStripPolicy.OptionHeightDp)
        assertEquals(6, TopFilterStripPolicy.OptionEndMarginDp)
        assertEquals(6, TopFilterStripPolicy.OptionBottomMarginDp)
    }
}
