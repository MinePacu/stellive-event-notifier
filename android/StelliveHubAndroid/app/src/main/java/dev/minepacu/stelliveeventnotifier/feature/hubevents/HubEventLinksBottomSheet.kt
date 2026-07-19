package dev.minepacu.stelliveeventnotifier.feature.hubevents

import android.content.Context
import android.graphics.Typeface
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.bottomsheet.BottomSheetDialog
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.HubEventLink

class HubEventLinksBottomSheet(
    private val context: Context,
    private val onOpen: (String) -> Unit,
) {
    fun show(title: String, links: List<HubEventLink>) {
        val dialog = BottomSheetDialog(context)
        val body = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(30))
            setBackgroundColor(color(R.color.hub_surface))
            addView(TextView(context).apply {
                text = title
                textSize = 20f
                setTextColor(color(R.color.hub_text))
                setTypeface(typeface, Typeface.BOLD)
                includeFontPadding = false
                setPadding(0, 0, 0, dp(12))
            })
            links.forEachIndexed { index, link ->
                if (index > 0) addView(divider())
                addView(linkRow(link) {
                    onOpen(link.url)
                    dialog.dismiss()
                })
            }
        }
        dialog.setContentView(ScrollView(context).apply {
            isFillViewport = true
            setBackgroundColor(color(R.color.hub_surface))
            addView(body, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        })
        dialog.show()
    }

    private fun linkRow(link: HubEventLink, onClick: () -> Unit) = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_VERTICAL
        minimumHeight = dp(58)
        isClickable = true
        isFocusable = true
        contentDescription = "${HubEventLinkPolicy.displayLinkLabel(link)}, 외부 링크 열기"
        setPadding(dp(2), dp(10), dp(2), dp(10))
        setOnClickListener { onClick() }
        addView(TextView(context).apply {
            text = HubEventLinkPolicy.displayLinkLabel(link)
            textSize = 14f
            setTextColor(color(R.color.hub_text))
            setTypeface(typeface, Typeface.BOLD)
            includeFontPadding = false
        })
        addView(TextView(context).apply {
            text = "${HubEventLinkPolicy.displayKindLabel(link.kind)} · 외부 링크"
            textSize = 12f
            setTextColor(color(R.color.hub_text_muted))
            includeFontPadding = false
            setPadding(0, dp(3), 0, 0)
        })
    }

    private fun divider() = android.view.View(context).apply {
        setBackgroundColor(color(R.color.hub_line))
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1))
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
    private fun color(resource: Int): Int = ContextCompat.getColor(context, resource)
}
