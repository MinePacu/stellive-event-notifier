package dev.minepacu.stelliveeventnotifier.ui.components

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.view.AccessibilityDelegateCompat
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import dev.minepacu.stelliveeventnotifier.R

data class HubSingleChoiceOption(
    val id: String,
    val label: CharSequence,
)

class HubSingleChoiceBottomSheet(
    private val context: Context,
    title: CharSequence,
    options: List<HubSingleChoiceOption>,
    selectedId: String,
    private val onSelected: (String) -> Unit,
) {
    private val sheet = HubBottomSheetDialog(context, title)

    init {
        sheet.addContent(HubCardFactory(context).create(HubCardStyle.INTERACTIVE).apply {
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                options.forEachIndexed { index, option ->
                    if (index > 0) addView(divider())
                    addView(choiceRow(option, option.id == selectedId))
                }
            })
        })
        sheet.addContent(sheet.actionButton(context.getString(R.string.dialog_cancel), primary = false) {
            sheet.dismiss()
        }.apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply {
                topMargin = dp(12)
            }
        })
    }

    fun show() {
        sheet.show()
    }

    private fun choiceRow(option: HubSingleChoiceOption, selected: Boolean): LinearLayout =
        LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = dp(56)
            isClickable = true
            isFocusable = true
            isSelected = selected
            background = rowBackground(selected)
            contentDescription = option.label
            setPadding(dp(16), dp(8), dp(14), dp(8))
            ViewCompat.setStateDescription(
                this,
                if (selected) context.getString(R.string.choice_selected_state) else null,
            )
            ViewCompat.setAccessibilityDelegate(this, object : AccessibilityDelegateCompat() {
                override fun onInitializeAccessibilityNodeInfo(
                    host: View,
                    info: AccessibilityNodeInfoCompat,
                ) {
                    super.onInitializeAccessibilityNodeInfo(host, info)
                    info.className = RadioButton::class.java.name
                    info.isCheckable = true
                    info.isChecked = selected
                    info.isSelected = selected
                }
            })
            setOnClickListener {
                onSelected(option.id)
                sheet.dismiss()
            }
            addView(TextView(context).apply {
                text = option.label
                textSize = 15f
                setTextColor(color(R.color.hub_text))
                setTypeface(typeface, if (selected) Typeface.BOLD else Typeface.NORMAL)
                includeFontPadding = false
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            if (selected) {
                addView(TextView(context).apply {
                    text = context.getString(R.string.choice_selected_mark)
                    textSize = 20f
                    setTextColor(color(R.color.hub_primary))
                    gravity = Gravity.CENTER
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                }, LinearLayout.LayoutParams(dp(32), dp(40)).apply {
                    marginStart = dp(8)
                })
            }
        }

    private fun rowBackground(selected: Boolean) = RippleDrawable(
        ColorStateList.valueOf(color(R.color.hub_line)),
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            setColor(if (selected) color(R.color.hub_accent_soft) else Color.TRANSPARENT)
        },
        null,
    )

    private fun divider() = View(context).apply {
        setBackgroundColor(color(R.color.hub_line))
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)).apply {
            marginStart = dp(16)
        }
    }

    private fun color(id: Int): Int = ContextCompat.getColor(context, id)

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
}
