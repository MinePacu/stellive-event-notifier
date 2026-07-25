package dev.minepacu.stelliveeventnotifier.feature.hubevents

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.HubEventLink
import dev.minepacu.stelliveeventnotifier.ui.components.HubBottomSheetDialog
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardFactory
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardStyle

class HubEventLinksBottomSheet(
    private val context: Context,
    private val onOpen: (HubEventLink) -> Unit,
) {
    fun show(title: String, links: List<HubEventLink>) {
        val sheet = HubBottomSheetDialog(context, title)
        sheet.addContent(HubCardFactory(context).create(HubCardStyle.INTERACTIVE).apply {
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                links.forEachIndexed { index, link ->
                    if (index > 0) addView(divider())
                    addView(linkRow(link) {
                        onOpen(link)
                        sheet.dismiss()
                    })
                }
            })
        })
        sheet.addContent(sheet.actionButton(context.getString(R.string.dialog_close), primary = false) {
            sheet.dismiss()
        }.apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply {
                topMargin = dp(12)
            }
        })
        sheet.show()
    }

    private fun linkRow(link: HubEventLink, onClick: () -> Unit) = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        minimumHeight = dp(68)
        isClickable = true
        isFocusable = true
        background = selectableItemBackground()
        contentDescription = "${HubEventLinkPolicy.displayLinkLabel(link)}, ${HubEventLinkPolicy.displayKindLabel(link.kind)}, 외부 링크 열기"
        setPadding(dp(16), dp(11), dp(14), dp(11))
        setOnClickListener { onClick() }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(context).apply {
                text = HubEventLinkPolicy.displayLinkLabel(link)
                textSize = 15f
                setTextColor(color(R.color.hub_text))
                setTypeface(typeface, Typeface.BOLD)
                includeFontPadding = false
            })
            addView(TextView(context).apply {
                text = "${HubEventLinkPolicy.displayKindLabel(link.kind)} · 외부 링크"
                textSize = 12f
                setTextColor(color(R.color.hub_text_muted))
                includeFontPadding = false
                setPadding(0, dp(4), 0, 0)
            })
        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        addView(TextView(context).apply {
            text = "↗"
            textSize = 18f
            gravity = Gravity.CENTER
            setTextColor(color(R.color.hub_text_subtle))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(dp(36), dp(40)).apply {
            marginStart = dp(8)
        })
    }

    private fun divider() = View(context).apply {
        setBackgroundColor(color(R.color.hub_line))
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)).apply {
            marginStart = dp(16)
        }
    }

    private fun selectableItemBackground(): Drawable? {
        val attributes = context.obtainStyledAttributes(intArrayOf(android.R.attr.selectableItemBackground))
        return attributes.getDrawable(0).also { attributes.recycle() }
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
    private fun color(resource: Int): Int = ContextCompat.getColor(context, resource)
}
