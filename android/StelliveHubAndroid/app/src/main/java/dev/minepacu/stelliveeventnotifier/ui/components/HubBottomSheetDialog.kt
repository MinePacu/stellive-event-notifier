package dev.minepacu.stelliveeventnotifier.ui.components

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.graphics.ColorUtils
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.widget.NestedScrollView
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import dev.minepacu.stelliveeventnotifier.R

class HubBottomSheetDialog(
    private val context: Context,
    title: CharSequence,
) {
    private val dialog = BottomSheetDialog(context)
    private val content = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(20), 0, dp(20), dp(24))
    }
    private val scrollView = NestedScrollView(context).apply {
        isFillViewport = false
        background = ContextCompat.getDrawable(context, R.drawable.bg_hub_bottom_sheet)
        addView(
            content,
            ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT),
        )
    }

    init {
        content.addView(FrameLayout(context).apply {
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            addView(View(context).apply {
                background = ContextCompat.getDrawable(context, R.drawable.bg_hub_drag_handle)
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, FrameLayout.LayoutParams(dp(36), dp(4), Gravity.CENTER))
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(24)))
        content.addView(TextView(context).apply {
            text = title
            textSize = 20f
            setTextColor(color(R.color.hub_text))
            setTypeface(typeface, Typeface.BOLD)
            includeFontPadding = false
            ViewCompat.setAccessibilityHeading(this, true)
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(18)
        })

        ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val navigationBarBottom = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
            view.setPadding(dp(20), 0, dp(20), dp(24) + navigationBarBottom)
            insets
        }
        dialog.setContentView(scrollView)
        dialog.setCancelable(true)
        dialog.setCanceledOnTouchOutside(true)
    }

    fun addContent(view: View) {
        content.addView(view)
    }

    fun dismiss() {
        dialog.dismiss()
    }

    fun setOnDismissListener(listener: () -> Unit) {
        dialog.setOnDismissListener { listener() }
    }

    fun actionButton(label: CharSequence, primary: Boolean, onClick: () -> Unit): MaterialButton =
        MaterialButton(context).apply {
            text = label
            textSize = 14f
            isAllCaps = false
            minimumHeight = dp(48)
            minHeight = dp(48)
            cornerRadius = dp(14)
            insetTop = 0
            insetBottom = 0
            setTextColor(color(if (primary) R.color.hub_on_primary else R.color.hub_text))
            backgroundTintList = ColorStateList.valueOf(
                color(if (primary) R.color.hub_primary else R.color.hub_card_surface_compact),
            )
            strokeWidth = if (primary) 0 else dp(1)
            strokeColor = ColorStateList.valueOf(color(R.color.hub_line))
            setOnClickListener { onClick() }
        }

    fun show() {
        dialog.behavior.apply {
            isDraggable = true
            isHideable = true
            skipCollapsed = true
            maxWidth = dp(560)
            maxHeight = (context.resources.displayMetrics.heightPixels * 0.9f).toInt()
            state = BottomSheetBehavior.STATE_EXPANDED
        }
        dialog.setOnShowListener {
            dialog.window?.let { window ->
                WindowCompat.setDecorFitsSystemWindows(window, false)
                window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
                window.navigationBarColor = Color.TRANSPARENT
                WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars =
                    ColorUtils.calculateLuminance(color(R.color.hub_surface)) > 0.5
            }
            dialog.findViewById<FrameLayout>(com.google.android.material.R.id.design_bottom_sheet)?.background =
                ColorDrawable(Color.TRANSPARENT)
            dialog.behavior.state = BottomSheetBehavior.STATE_EXPANDED
            ViewCompat.requestApplyInsets(scrollView)
        }
        dialog.show()
    }

    private fun color(id: Int): Int = ContextCompat.getColor(context, id)

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
}
