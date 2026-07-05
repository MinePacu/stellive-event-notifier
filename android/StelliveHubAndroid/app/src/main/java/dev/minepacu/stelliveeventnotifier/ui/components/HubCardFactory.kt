package dev.minepacu.stelliveeventnotifier.ui.components

import android.content.Context
import androidx.core.content.ContextCompat
import com.google.android.material.card.MaterialCardView
import dev.minepacu.stelliveeventnotifier.R

enum class HubCardStyle {
    STANDARD,
    COMPACT,
    INTERACTIVE,
}

class HubCardFactory(private val context: Context) {
    fun create(style: HubCardStyle = HubCardStyle.STANDARD): MaterialCardView =
        MaterialCardView(context).apply {
            radius = dp(if (style == HubCardStyle.COMPACT) 18 else 22).toFloat()
            cardElevation = 0f
            setCardBackgroundColor(ContextCompat.getColor(context, R.color.hub_card_surface))
            strokeWidth = if (style == HubCardStyle.INTERACTIVE) dp(1) else 0
            strokeColor = ContextCompat.getColor(context, R.color.hub_line)
        }

    private fun dp(value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()
}
