package dev.stellive.hub.ui.components

import android.content.Context
import android.graphics.Typeface
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import dev.stellive.hub.R

class SectionHeaderView(context: Context) : LinearLayout(context) {
    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(0, dp(6), 0, dp(8))
    }

    fun bind(title: String, trailingText: String? = null): SectionHeaderView {
        removeAllViews()
        addView(TextView(context).apply {
            text = title
            setTextColor(ContextCompat.getColor(context, R.color.hub_text_muted))
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            layoutParams = LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
        })
        if (!trailingText.isNullOrBlank()) {
            addView(TextView(context).apply {
                text = trailingText
                setTextColor(ContextCompat.getColor(context, R.color.hub_text_subtle))
                textSize = 12f
            })
        }
        return this
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()
}
