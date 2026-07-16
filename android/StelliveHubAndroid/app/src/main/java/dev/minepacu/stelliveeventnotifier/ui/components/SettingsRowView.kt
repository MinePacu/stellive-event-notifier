package dev.minepacu.stelliveeventnotifier.ui.components

import android.content.Context
import android.graphics.Typeface
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Checkable
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.view.AccessibilityDelegateCompat
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import com.google.android.material.switchmaterial.SwitchMaterial
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import dev.minepacu.stelliveeventnotifier.feature.home.SettingsRowActionEdge

enum class SettingsRowStyle {
    GROUPED,
    STANDALONE,
}

class SettingsRowView(context: Context) : ViewGroup(context), Checkable {
    private val textContainer = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
    }
    private var actionView: View? = null
    private var checkedState: Boolean? = null
    private var checkedChangeListener: ((Boolean) -> Unit)? = null

    init {
        isSaveEnabled = false
        ViewCompat.setAccessibilityDelegate(this, object : AccessibilityDelegateCompat() {
            override fun onInitializeAccessibilityNodeInfo(
                host: View,
                info: AccessibilityNodeInfoCompat,
            ) {
                super.onInitializeAccessibilityNodeInfo(host, info)
                if (checkedState != null) {
                    info.className = Switch::class.java.name
                    info.isCheckable = true
                    info.isChecked = isChecked
                    info.isEnabled = isEnabled
                }
            }
        })
    }

    fun bind(
        title: String,
        body: String?,
        checked: Boolean?,
        enabled: Boolean = true,
        badge: View? = null,
        onCheckedChange: ((Boolean) -> Unit)? = null,
        style: SettingsRowStyle = SettingsRowStyle.GROUPED,
    ): SettingsRowView {
        removeAllViews()
        textContainer.removeAllViews()
        checkedState = checked
        checkedChangeListener = onCheckedChange

        val spacing = MainUiPolicy.settingsCardSpacing
        val horizontalPadding = if (style == SettingsRowStyle.STANDALONE) 13 else 0
        val verticalPadding = if (style == SettingsRowStyle.STANDALONE) {
            spacing.standaloneRowVerticalPaddingDp
        } else {
            spacing.rowVerticalPaddingDp
        }
        setPadding(dp(horizontalPadding), dp(verticalPadding), dp(horizontalPadding), dp(verticalPadding))

        textContainer.addView(TextView(context).apply {
            text = title
            setTextColor(ContextCompat.getColor(context, R.color.hub_text))
            textSize = if (style == SettingsRowStyle.STANDALONE) 15f else 14f
            typeface = Typeface.DEFAULT_BOLD
            includeFontPadding = false
        })
        body?.takeIf { it.isNotBlank() }?.let { description ->
            textContainer.addView(TextView(context).apply {
                text = description
                setTextColor(ContextCompat.getColor(context, R.color.hub_text_muted))
                textSize = 12f
                includeFontPadding = false
                setLineSpacing(0f, 1.1f)
                setPadding(0, dp(spacing.titleBodySpacingDp), 0, 0)
            })
        }
        addView(textContainer)

        actionView = when {
            checked != null -> createVisualSwitch(checked, enabled)
            badge != null -> badge
            else -> null
        }?.also(::addView)

        isEnabled = enabled
        isClickable = checked != null && enabled
        isFocusable = checked != null && enabled
        importantForAccessibility = if (checked != null) {
            IMPORTANT_FOR_ACCESSIBILITY_YES
        } else {
            IMPORTANT_FOR_ACCESSIBILITY_AUTO
        }
        if (checked != null) {
            textContainer.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            actionView?.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
            contentDescription = listOfNotNull(title, body?.takeIf { it.isNotBlank() }).joinToString(", ")
            updateStateDescription(checked)
        } else {
            textContainer.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_AUTO
            contentDescription = null
            ViewCompat.setStateDescription(this, null)
        }
        return this
    }

    override fun isChecked(): Boolean = checkedState == true

    override fun setChecked(checked: Boolean) {
        if (checkedState == null || checkedState == checked) return
        checkedState = checked
        (actionView as? SwitchMaterial)?.isChecked = checked
        updateStateDescription(checked)
    }

    override fun toggle() {
        if (checkedState != null && isEnabled) setChecked(!isChecked)
    }

    override fun performClick(): Boolean {
        if (checkedState == null || !isEnabled) return false
        toggle()
        checkedChangeListener?.invoke(isChecked)
        super.performClick()
        return true
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        val activatesRow = keyCode == KeyEvent.KEYCODE_ENTER ||
            keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == KeyEvent.KEYCODE_SPACE
        return if (activatesRow && event.hasNoModifiers() && checkedState != null && isEnabled) {
            performClick()
        } else {
            super.onKeyUp(keyCode, event)
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val spacing = MainUiPolicy.settingsCardSpacing
        val widthMode = MeasureSpec.getMode(widthMeasureSpec)
        val widthSize = MeasureSpec.getSize(widthMeasureSpec)
        val action = actionView

        if (action is SwitchMaterial) {
            action.measure(
                MeasureSpec.makeMeasureSpec(dp(spacing.switchVisualWidthDp), MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(dp(spacing.switchVisualHeightDp), MeasureSpec.EXACTLY),
            )
        } else if (action != null) {
            val maximumActionWidth = if (widthMode == MeasureSpec.UNSPECIFIED) 0 else {
                (widthSize - paddingLeft - paddingRight).coerceAtLeast(0)
            }
            action.measure(
                if (widthMode == MeasureSpec.UNSPECIFIED) {
                    MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
                } else {
                    MeasureSpec.makeMeasureSpec(maximumActionWidth, MeasureSpec.AT_MOST)
                },
                MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED),
            )
        }

        val actionWidth = action?.measuredWidth ?: 0
        val actionSpacing = if (action != null) dp(spacing.actionSpacingDp) else 0
        val availableTextWidth = if (widthMode == MeasureSpec.UNSPECIFIED) {
            0
        } else {
            (widthSize - paddingLeft - paddingRight - actionWidth - actionSpacing).coerceAtLeast(0)
        }
        textContainer.measure(
            if (widthMode == MeasureSpec.UNSPECIFIED) {
                MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
            } else {
                MeasureSpec.makeMeasureSpec(availableTextWidth, MeasureSpec.AT_MOST)
            },
            MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED),
        )

        val desiredWidth = paddingLeft + textContainer.measuredWidth + actionSpacing + actionWidth + paddingRight
        val desiredHeight = when {
            checkedState != null -> MainUiPolicy.settingsToggleRowHeight(
                textHeight = textContainer.measuredHeight,
                verticalPadding = paddingTop,
                minimumTouchTarget = dp(spacing.minimumTouchTargetDp),
            )
            action != null -> MainUiPolicy.settingsValueRowHeight(
                textHeight = textContainer.measuredHeight,
                actionHeight = action.measuredHeight,
                verticalPadding = paddingTop,
            )
            else -> textContainer.measuredHeight + paddingTop + paddingBottom
        }

        setMeasuredDimension(
            resolveSize(desiredWidth.coerceAtLeast(suggestedMinimumWidth), widthMeasureSpec),
            resolveSize(desiredHeight.coerceAtLeast(suggestedMinimumHeight), heightMeasureSpec),
        )
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        val action = actionView
        val actionSpacing = if (action != null) dp(MainUiPolicy.settingsCardSpacing.actionSpacingDp) else 0
        val actionEdge = MainUiPolicy.settingsRowActionEdge(layoutDirection == LAYOUT_DIRECTION_RTL)
        val contentTop = paddingTop
        val contentBottom = height - paddingBottom
        val textTop = contentTop + (contentBottom - contentTop - textContainer.measuredHeight) / 2

        if (action == null) {
            textContainer.layout(
                paddingLeft,
                textTop,
                width - paddingRight,
                textTop + textContainer.measuredHeight,
            )
            return
        }

        val actionTop = contentTop + (contentBottom - contentTop - action.measuredHeight) / 2
        if (actionEdge == SettingsRowActionEdge.LEFT) {
            val actionLeft = paddingLeft
            action.layout(actionLeft, actionTop, actionLeft + action.measuredWidth, actionTop + action.measuredHeight)
            val textLeft = actionLeft + action.measuredWidth + actionSpacing
            textContainer.layout(textLeft, textTop, width - paddingRight, textTop + textContainer.measuredHeight)
        } else {
            val actionLeft = width - paddingRight - action.measuredWidth
            action.layout(actionLeft, actionTop, actionLeft + action.measuredWidth, actionTop + action.measuredHeight)
            textContainer.layout(paddingLeft, textTop, actionLeft - actionSpacing, textTop + textContainer.measuredHeight)
        }
    }

    private fun createVisualSwitch(checked: Boolean, enabled: Boolean): SwitchMaterial =
        SwitchMaterial(context).apply {
            isChecked = checked
            isEnabled = enabled
            isClickable = false
            isFocusable = false
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
            minimumWidth = 0
            minimumHeight = 0
            minWidth = 0
            minHeight = 0
            setPadding(0, 0, 0, 0)
        }

    private fun updateStateDescription(checked: Boolean) {
        ViewCompat.setStateDescription(this, if (checked) "켜짐" else "꺼짐")
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()
}
