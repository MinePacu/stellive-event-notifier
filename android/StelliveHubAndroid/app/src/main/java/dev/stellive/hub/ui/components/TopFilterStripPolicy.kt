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
    fun layoutMode(optionCount: Int): FilterStripLayoutMode =
        if (optionCount <= 3) FilterStripLayoutMode.EQUAL_WIDTH
        else FilterStripLayoutMode.HORIZONTAL_SCROLL

    fun showsTrailingOverflowHint(): Boolean = false

    fun showsSelectedCheckIcon(): Boolean = false
}
