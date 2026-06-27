package dev.stellive.hub.ui.components

enum class FilterStripLayoutMode {
    EQUAL_WIDTH,
    HORIZONTAL_SCROLL,
}

data class TopFilterOption(
    val id: String,
    val label: String,
)

data class TopFilterGroup(
    val id: String,
    val options: List<TopFilterOption>,
    val selectedId: String,
)

object TopFilterStripPolicy {
    const val ContainerTopPaddingDp = 12
    const val ContainerBottomPaddingDp = 10
    const val GroupTopPaddingDp = 2
    const val OptionHeightDp = 44
    const val OptionEndMarginDp = 6
    const val OptionBottomMarginDp = 6

    fun layoutMode(optionCount: Int, maxOptionCountInStrip: Int = optionCount): FilterStripLayoutMode =
        if (optionCount <= 3 && maxOptionCountInStrip <= 3) FilterStripLayoutMode.EQUAL_WIDTH
        else FilterStripLayoutMode.HORIZONTAL_SCROLL

    fun showsTrailingOverflowHint(): Boolean = false

    fun showsSelectedCheckIcon(): Boolean = false
}
