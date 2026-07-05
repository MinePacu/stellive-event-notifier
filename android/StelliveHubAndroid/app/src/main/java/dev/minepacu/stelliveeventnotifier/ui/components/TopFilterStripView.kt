package dev.minepacu.stelliveeventnotifier.ui.components

import android.content.Context
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.card.MaterialCardView
import dev.minepacu.stelliveeventnotifier.R

class TopFilterStripView(context: Context) : LinearLayout(context) {
    private val scrollPositions = mutableMapOf<String, Int>()

    init {
        orientation = VERTICAL
        clipChildren = false
        clipToPadding = false
        setPadding(0, dp(TopFilterStripPolicy.ContainerTopPaddingDp), 0, dp(TopFilterStripPolicy.ContainerBottomPaddingDp))
    }

    fun bind(
        groups: List<TopFilterGroup>,
        onSelected: (groupId: String, optionId: String) -> Unit,
    ) {
        removeAllViews()
        val maxOptionCountInStrip = groups.maxOfOrNull { it.options.size } ?: 0
        groups.forEach { group ->
            addView(filterGroup(group, maxOptionCountInStrip, onSelected))
        }
    }

    private fun filterGroup(
        group: TopFilterGroup,
        maxOptionCountInStrip: Int,
        onSelected: (groupId: String, optionId: String) -> Unit,
    ): View {
        val mode = TopFilterStripPolicy.layoutMode(group.options.size, maxOptionCountInStrip)
        val optionRow = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            clipChildren = false
            clipToPadding = false
            setPadding(0, dp(TopFilterStripPolicy.GroupTopPaddingDp), 0, 0)
        }
        group.options.forEach { option ->
            optionRow.addView(filterOption(group, option, mode, onSelected))
        }
        if (mode == FilterStripLayoutMode.EQUAL_WIDTH) return optionRow

        val scroll = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            clipChildren = false
            clipToPadding = false
            addView(optionRow)
            setOnScrollChangeListener { _, scrollX, _, _, _ ->
                scrollPositions[group.id] = scrollX
            }
            post { scrollTo(scrollPositions[group.id] ?: 0, 0) }
        }
        return scroll
    }

    private fun filterOption(
        group: TopFilterGroup,
        option: TopFilterOption,
        mode: FilterStripLayoutMode,
        onSelected: (groupId: String, optionId: String) -> Unit,
    ): MaterialCardView =
        MaterialCardView(context).apply {
            val selected = option.id == group.selectedId
            radius = dp(18).toFloat()
            cardElevation = 0f
            clipToOutline = true
            setCardBackgroundColor(
                ContextCompat.getColor(
                    context,
                    if (selected) R.color.hub_accent_soft else R.color.hub_card_surface_compact,
                ),
            )
            contentDescription = "${group.id} ${option.label}${if (selected) ", 선택됨" else ""}"
            layoutParams = LayoutParams(
                if (mode == FilterStripLayoutMode.EQUAL_WIDTH) 0 else dp(112),
                dp(TopFilterStripPolicy.OptionHeightDp),
                if (mode == FilterStripLayoutMode.EQUAL_WIDTH) 1f else 0f,
            ).apply {
                marginEnd = dp(TopFilterStripPolicy.OptionEndMarginDp)
                bottomMargin = dp(TopFilterStripPolicy.OptionBottomMarginDp)
            }
            addView(TextView(context).apply {
                text = option.label
                gravity = Gravity.CENTER
                setTextColor(ContextCompat.getColor(context, R.color.hub_text))
                textSize = 13f
                typeface = if (selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            }, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            ))
            setOnClickListener { onSelected(group.id, option.id) }
        }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()
}
