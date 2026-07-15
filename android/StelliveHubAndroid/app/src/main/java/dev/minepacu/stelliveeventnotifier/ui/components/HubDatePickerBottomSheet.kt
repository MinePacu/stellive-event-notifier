package dev.minepacu.stelliveeventnotifier.ui.components

import android.content.Context
import android.view.ViewGroup
import android.widget.DatePicker
import android.widget.LinearLayout
import dev.minepacu.stelliveeventnotifier.R
import java.time.LocalDate

class HubDatePickerBottomSheet(
    private val context: Context,
    title: CharSequence,
    initialDate: LocalDate,
    private val onConfirmed: (LocalDate) -> Unit,
) {
    private val sheet = HubBottomSheetDialog(context, title)
    private val datePicker = DatePicker(context).apply {
        init(initialDate.year, initialDate.monthValue - 1, initialDate.dayOfMonth, null)
    }

    init {
        sheet.addContent(HubCardFactory(context).create(HubCardStyle.INTERACTIVE).apply {
            addView(
                datePicker,
                ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT),
            )
        })
        sheet.addContent(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(sheet.actionButton(context.getString(R.string.dialog_cancel), primary = false) {
                sheet.dismiss()
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = dp(5)
            })
            addView(sheet.actionButton(context.getString(R.string.dialog_confirm), primary = true) {
                val selectedDate = LocalDate.of(datePicker.year, datePicker.month + 1, datePicker.dayOfMonth)
                sheet.dismiss()
                onConfirmed(selectedDate)
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = dp(5)
            })
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

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
}
