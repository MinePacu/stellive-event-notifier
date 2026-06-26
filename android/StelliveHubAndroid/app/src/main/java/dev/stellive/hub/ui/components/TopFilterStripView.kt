package dev.stellive.hub.ui.components

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
import dev.stellive.hub.R

class TopFilterStripView(context: Context) : LinearLayout(context) {
    private val scrollPositions = mutableMapOf<String, Int>()

    init {
        orientation = VERTICAL
        setPadding(0, dp(5), 0, dp(7))
    }

    fun bind(
        groups: List<TopFilterGroup>,
        onSelected: (groupId: String, optionId: String) -> Unit,
    ) {
        removeAllViews()
        groups.forEach { group ->
            addView(filterGroup(group, onSelected))
        }
    }

    private fun filterGroup(
        group: TopFilterGroup,
        onSelected: (groupId: String, optionId: String) -> Unit,
    ): View {
        val mode = TopFilterStripPolicy.layoutMode(group.options.size)
        val optionRow = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        group.options.forEach { option ->
            optionRow.addView(filterOption(group, option, mode, onSelected))
        }
        if (mode == FilterStripLayoutMode.EQUAL_WIDTH) return optionRow

        val scroll = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
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
            setCardBackgroundColor(
                ContextCompat.getColor(
                    context,
                    if (selected) R.color.hub_accent_soft else R.color.hub_card_surface_compact,
                ),
            )
            contentDescription = "${group.id} ${option.label}${if (selected) ", 선택됨" else ""}"
            layoutParams = LayoutParams(
                if (mode == FilterStripLayoutMode.EQUAL_WIDTH) 0 else dp(112),
                dp(40),
                if (mode == FilterStripLayoutMode.EQUAL_WIDTH) 1f else 0f,
            ).apply {
                marginEnd = dp(6)
                bottomMargin = dp(5)
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
