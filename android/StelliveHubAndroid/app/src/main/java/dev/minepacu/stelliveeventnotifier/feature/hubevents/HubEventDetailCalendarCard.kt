package dev.minepacu.stelliveeventnotifier.feature.hubevents

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.transition.AutoTransition
import android.transition.TransitionManager
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.animation.DecelerateInterpolator
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import com.google.android.material.card.MaterialCardView
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleItem
import dev.minepacu.stelliveeventnotifier.core.model.HubEventTimePrecision
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

class HubEventDetailCalendarCard(
    context: Context,
    private val event: HubEvent,
    private val presentation: HubEventDetailCalendarPresentation,
    now: Instant = Instant.now(),
    private val today: LocalDate = LocalDate.now(HubEventDetailCalendarPolicy.DefaultZoneId),
    initiallyExpanded: Boolean = true,
    private val onExpandedChanged: (Boolean) -> Unit = {},
    private val onDateSelected: (LocalDate, List<String>) -> Unit,
) : MaterialCardView(context) {
    private var displayedMonth =
        presentation.displayedMonth ?: YearMonth.from(presentation.initialSelectedDate ?: today)
    private var selectedDate = presentation.selectedDate
    private var isExpanded = initiallyExpanded
    private val timelineById = HubEventDetailFormatting.timeline(event, now).associateBy { it.schedule.id }
    private val content = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(14), dp(14), dp(14))
    }
    private val calendarBody = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        )
    }
    private val headerTitle = TextView(context).apply {
        setTextColor(color(R.color.hub_text))
        textSize = 16f
        typeface = Typeface.DEFAULT_BOLD
        includeFontPadding = false
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    private val headerSummary = TextView(context).apply {
        setTextColor(color(R.color.hub_text_muted))
        textSize = 12f
        includeFontPadding = false
        setPadding(0, dp(4), 0, 0)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    private val collapseIcon = ImageView(context).apply {
        setImageResource(R.drawable.ic_chevron_down_24)
        imageTintList = ColorStateList.valueOf(color(R.color.hub_text))
        scaleType = ImageView.ScaleType.CENTER
        isClickable = false
        isFocusable = false
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    private val headerControl = buildHeader()

    init {
        radius = dp(18).toFloat()
        cardElevation = 0f
        strokeWidth = dp(1)
        strokeColor = color(R.color.hub_line)
        setCardBackgroundColor(color(R.color.hub_card))
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            bottomMargin = dp(12)
        }
        addView(content)
        content.addView(headerControl)
        content.addView(calendarBody)
        renderBody()
        calendarBody.visibility = if (isExpanded) View.VISIBLE else View.GONE
        updateCollapseControl(animate = false)
    }

    private fun renderBody() {
        calendarBody.removeAllViews()
        calendarBody.setOnClickListener(null)
        calendarBody.isClickable = false
        calendarBody.isFocusable = false
        calendarBody.contentDescription = null
        when (presentation.mode) {
            HubEventDetailCalendarMode.HIDDEN -> Unit
            HubEventDetailCalendarMode.COMPACT_DATE -> renderCompactDate()
            HubEventDetailCalendarMode.MONTH_CALENDAR -> renderMonthCalendar()
        }
        updateHeaderPresentation()
    }

    private fun buildHeader(): View = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        minimumHeight = dp(48)
        isClickable = true
        isFocusable = true
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
        val selectableBackground = TypedValue()
        if (context.theme.resolveAttribute(
                android.R.attr.selectableItemBackground,
                selectableBackground,
                true,
            )
        ) {
            background = context.getDrawable(selectableBackground.resourceId)
        }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            addView(headerTitle)
            addView(headerSummary)
        }, LinearLayout.LayoutParams(
            0,
            LinearLayout.LayoutParams.WRAP_CONTENT,
            1f,
        ))
        addView(collapseIcon, LinearLayout.LayoutParams(dp(48), dp(48)).apply {
            marginStart = dp(8)
        })
        setOnClickListener { setCalendarExpanded(!isExpanded) }
    }

    private fun setCalendarExpanded(expanded: Boolean) {
        if (isExpanded == expanded) return
        val shouldAnimate = ValueAnimator.areAnimatorsEnabled() && isLaidOut
        if (shouldAnimate) {
            val transitionRoot = (parent as? ViewGroup) ?: this
            TransitionManager.endTransitions(transitionRoot)
            TransitionManager.beginDelayedTransition(
                transitionRoot,
                AutoTransition().apply {
                    duration = EXPANSION_DURATION_MS
                    interpolator = DecelerateInterpolator()
                },
            )
        }
        isExpanded = expanded
        calendarBody.visibility = if (expanded) View.VISIBLE else View.GONE
        updateCollapseControl(animate = shouldAnimate)
        onExpandedChanged(expanded)
    }

    private fun updateHeaderPresentation() {
        val header = HubEventDetailCalendarPolicy.headerPresentation(
            presentation = presentation,
            displayedMonth = displayedMonth,
            selectedDate = selectedDate,
        ) ?: return
        headerTitle.text = header.title
        headerSummary.text = header.summary
        headerControl.contentDescription = "행사 일정, ${header.title}, ${header.summary}"
        updateCollapseAccessibility()
    }

    private fun updateCollapseControl(animate: Boolean) {
        val targetRotation = if (isExpanded) 180f else 0f
        collapseIcon.animate().cancel()
        if (animate) {
            collapseIcon.animate()
                .rotation(targetRotation)
                .setDuration(EXPANSION_DURATION_MS)
                .setInterpolator(DecelerateInterpolator())
                .start()
        } else {
            collapseIcon.rotation = targetRotation
        }
        updateCollapseAccessibility()
    }

    private fun updateCollapseAccessibility() {
        ViewCompat.setStateDescription(headerControl, if (isExpanded) "펼침" else "접힘")
        ViewCompat.replaceAccessibilityAction(
            headerControl,
            AccessibilityNodeInfoCompat.AccessibilityActionCompat.ACTION_CLICK,
            if (isExpanded) "두 번 탭하여 접기" else "두 번 탭하여 펼치기",
            null,
        )
    }

    private fun renderCompactDate() {
        val date = presentation.initialSelectedDate ?: return
        val day = presentation.day(date)
        val schedules = day?.schedules.orEmpty()
        calendarBody.addView(TextView(context).apply {
            text = compactTimingText(schedules)
            setTextColor(color(R.color.hub_text_muted))
            textSize = 12f
            includeFontPadding = false
            setPadding(0, dp(10), 0, 0)
        })
        calendarBody.addView(TextView(context).apply {
            text = compactStatusText(schedules)
            setTextColor(color(R.color.hub_text_muted))
            textSize = 12f
            includeFontPadding = false
            setPadding(0, dp(5), 0, 0)
        })
        event.venueName?.takeIf(String::isNotBlank)?.let { venue ->
            calendarBody.addView(TextView(context).apply {
                text = "장소 · $venue"
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                includeFontPadding = false
                setPadding(0, dp(7), 0, 0)
            })
        }
        calendarBody.isClickable = schedules.isNotEmpty()
        calendarBody.isFocusable = schedules.isNotEmpty()
        calendarBody.minimumHeight = dp(48)
        calendarBody.contentDescription = buildString {
            append(fullDateFormatter.format(date))
            append(", 세부 일정 ${schedules.size}개")
            if (day?.isInParentEventRange == true) append(", 행사 진행 기간")
            if (day?.hasOnlyCancelledSchedules == true) append(", 모든 일정 취소")
            if (schedules.isNotEmpty()) append(", 두 번 탭하여 세부 일정으로 이동")
        }
        if (schedules.isNotEmpty()) {
            calendarBody.setOnClickListener { selectDate(date) }
        }
    }

    private fun renderMonthCalendar() {
        calendarBody.addView(monthControl())
        calendarBody.addView(weekdayHeader())
        calendarBody.addView(monthGrid())
        selectedDate?.let { date ->
            calendarBody.addView(selectedDateSummary(date))
        }
    }

    private fun monthControl(): View = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        minimumHeight = dp(48)

        val range = presentation.availableMonthRange
        val previous = displayedMonth.minusMonths(1)
        val next = displayedMonth.plusMonths(1)
        addView(
            monthButton(
                label = "이전",
                targetMonth = previous,
                enabled = range != null && previous >= range.start,
            ),
        )
        addView(TextView(context).apply {
            text = monthFormatter.format(displayedMonth)
            setTextColor(color(R.color.hub_text))
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            includeFontPadding = false
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        addView(
            monthButton(
                label = "다음",
                targetMonth = next,
                enabled = range != null && next <= range.endInclusive,
            ),
        )
    }

    private fun monthButton(label: String, targetMonth: YearMonth, enabled: Boolean): View =
        TextView(context).apply {
            text = label
            gravity = Gravity.CENTER
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(color(R.color.hub_text))
            background = rounded(color(R.color.hub_surface), dp(14), color(R.color.hub_line))
            minimumWidth = dp(48)
            minimumHeight = dp(48)
            setPadding(dp(8), dp(7), dp(8), dp(7))
            isEnabled = enabled
            isClickable = enabled
            isFocusable = enabled
            alpha = if (enabled) 1f else 0.36f
            contentDescription = "${monthFormatter.format(targetMonth)}로 이동"
            if (enabled) {
                setOnClickListener {
                    displayedMonth = targetMonth
                    renderBody()
                    announceForAccessibility("${monthFormatter.format(targetMonth)} 표시")
                }
            }
        }

    private fun weekdayHeader(): View = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        listOf("일", "월", "화", "수", "목", "금", "토").forEach { label ->
            addView(TextView(context).apply {
                text = label
                gravity = Gravity.CENTER
                setTextColor(color(R.color.hub_text_muted))
                textSize = 11f
                includeFontPadding = false
            }, LinearLayout.LayoutParams(0, dp(28), 1f))
        }
    }

    private fun monthGrid(): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        val firstDay = displayedMonth.atDay(1)
        val leadingDays = firstDay.dayOfWeek.value % 7
        val totalCells = ((leadingDays + displayedMonth.lengthOfMonth() + 6) / 7) * 7
        val visibleStart = firstDay.minusDays(leadingDays.toLong())

        repeat(totalCells / 7) { weekIndex ->
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                repeat(7) { column ->
                    val date = visibleStart.plusDays((weekIndex * 7L) + column)
                    addView(
                        dateCell(date, YearMonth.from(date) == displayedMonth),
                        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
                    )
                }
            })
        }
    }

    private fun dateCell(date: LocalDate, inDisplayedMonth: Boolean): View {
        val day = presentation.day(date)
        val isSelected = date == selectedDate
        val isToday = date == today
        val isParentRange = day?.isInParentEventRange == true
        val schedules = day?.schedules.orEmpty()
        val selectable = presentation.availableMonthRange?.let { YearMonth.from(date) in it } == true
        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            minimumHeight = dp(54)
            setPadding(dp(1), dp(4), dp(1), dp(4))
            background = dateCellBackground(isSelected, isToday, isParentRange)
            alpha = when {
                !inDisplayedMonth -> 0.36f
                day?.hasOnlyCancelledSchedules == true -> 0.58f
                else -> 1f
            }
            isClickable = selectable
            isFocusable = selectable
            contentDescription = dateAccessibilityLabel(
                date = date,
                scheduleCount = schedules.size,
                selected = isSelected,
                isToday = isToday,
                parentRange = isParentRange,
                cancelledOnly = day?.hasOnlyCancelledSchedules == true,
            )
            if (selectable) setOnClickListener { selectDate(date) }

            addView(TextView(context).apply {
                text = date.dayOfMonth.toString()
                gravity = Gravity.CENTER
                textSize = 13f
                typeface = if (isSelected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
                setTextColor(if (isSelected) color(R.color.hub_on_primary) else color(R.color.hub_text))
                includeFontPadding = false
            })
            day?.countIndicator?.let { indicator ->
                addView(TextView(context).apply {
                    text = indicator
                    gravity = Gravity.CENTER
                    textSize = if (indicator == "•") 12f else 8f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(
                        if (isSelected) {
                            color(R.color.hub_on_primary)
                        } else {
                            when {
                                day.hasOnlyCancelledSchedules -> color(R.color.hub_text_muted)
                                day.hasDeadline -> color(R.color.hub_warning)
                                else -> color(R.color.hub_success)
                            }
                        },
                    )
                    includeFontPadding = false
                    if (indicator != "•") {
                        background = rounded(
                            if (isSelected) Color.TRANSPARENT else color(R.color.hub_surface),
                            dp(8),
                            if (isSelected) color(R.color.hub_on_primary) else color(R.color.hub_line),
                        )
                        setPadding(dp(3), 0, dp(3), 0)
                    }
                }, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    dp(16),
                ).apply {
                    topMargin = dp(2)
                })
            }
        }
    }

    private fun selectDate(date: LocalDate) {
        selectedDate = date
        val targetMonth = YearMonth.from(date)
        val range = presentation.availableMonthRange
        if (range != null && targetMonth in range) displayedMonth = targetMonth
        renderBody()
        val scheduleIds = presentation.scheduleIdsFor(date)
        onDateSelected(date, scheduleIds)
        announceForAccessibility(
            "${fullDateFormatter.format(date)} 선택, 세부 일정 ${scheduleIds.size}개",
        )
    }

    private fun selectedDateSummary(date: LocalDate): View {
        val day = presentation.day(date)
        val schedules = day?.schedules.orEmpty()
        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = rounded(color(R.color.hub_surface), dp(14), color(R.color.hub_line))
            setPadding(dp(12), dp(10), dp(12), dp(10))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                topMargin = dp(12)
            }
            contentDescription = "선택한 날짜 요약, ${dateAccessibilityLabel(
                date = date,
                scheduleCount = schedules.size,
                selected = true,
                isToday = date == today,
                parentRange = day?.isInParentEventRange == true,
                cancelledOnly = day?.hasOnlyCancelledSchedules == true,
            )}"
            addView(TextView(context).apply {
                text = fullDateFormatter.format(date)
                setTextColor(color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                includeFontPadding = false
            })
            if (schedules.isEmpty()) {
                addView(TextView(context).apply {
                    text = if (day?.isInParentEventRange == true) {
                        "행사 진행 기간"
                    } else {
                        "선택한 날짜에 세부 일정이 없습니다."
                    }
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 12f
                    includeFontPadding = false
                    setPadding(0, dp(7), 0, 0)
                })
            } else {
                schedules.take(3).forEach { schedule ->
                    addView(summaryScheduleRow(schedule))
                }
                if (schedules.size > 3) {
                    addView(TextView(context).apply {
                        text = "${schedules.size - 3}개 더 있음"
                        setTextColor(color(R.color.hub_text_muted))
                        textSize = 12f
                        includeFontPadding = false
                        setPadding(0, dp(7), 0, 0)
                    })
                }
            }
        }
    }

    private fun summaryScheduleRow(schedule: HubEventScheduleItem): View =
        TextView(context).apply {
            val timeline = timelineById[schedule.id]
            text = listOfNotNull(
                HubEventDetailFormatting.displayTitle(schedule),
                timeline?.timingText,
                timeline?.stateText,
            ).joinToString(" · ")
            setTextColor(
                if (schedule.cancelledAt != null) color(R.color.hub_text_muted) else color(R.color.hub_text),
            )
            textSize = 12f
            includeFontPadding = false
            setPadding(0, dp(7), 0, 0)
            contentDescription = buildString {
                append(text)
                if (schedule.cancelledAt != null) append(", 취소된 일정")
            }
        }

    private fun compactTimingText(schedules: List<HubEventScheduleItem>): String {
        val firstSchedule = schedules.firstOrNull()
        return when {
            firstSchedule?.timePrecision == HubEventTimePrecision.DATE -> "종일 일정"
            firstSchedule != null -> {
                val zoneId = runCatching { java.time.ZoneId.of(firstSchedule.timezone) }
                    .getOrDefault(HubEventDetailCalendarPolicy.DefaultZoneId)
                "${timeFormatter.format(firstSchedule.startsAt.atZone(zoneId))} 시작"
            }
            event.startsAt != null ->
                "${timeFormatter.format(event.startsAt.atZone(HubEventDetailCalendarPolicy.DefaultZoneId))} 시작"
            else -> "종일 일정"
        }
    }

    private fun compactStatusText(schedules: List<HubEventScheduleItem>): String {
        val timeline = schedules
            .mapNotNull { timelineById[it.id] }
            .let { items ->
                items.firstOrNull { it.stateText == "진행" }
                    ?: items.firstOrNull { it.stateText == "예정" }
                    ?: items.firstOrNull()
            }
        return timeline?.let {
            "${it.stateText} · ${HubEventDetailFormatting.displayTitle(it.schedule)}"
        } ?: "현재 상태 · ${event.status.displayName}"
    }

    private fun dateAccessibilityLabel(
        date: LocalDate,
        scheduleCount: Int,
        selected: Boolean,
        isToday: Boolean,
        parentRange: Boolean,
        cancelledOnly: Boolean,
    ): String = buildString {
        append(fullDateFormatter.format(date))
        if (selected) append(", 선택됨")
        if (isToday) append(", 오늘")
        if (parentRange) append(", 행사 진행 기간")
        append(", 세부 일정 ${scheduleCount}개")
        if (cancelledOnly) append(", 모든 일정 취소")
    }

    private fun dateCellBackground(
        selected: Boolean,
        isToday: Boolean,
        isParentRange: Boolean,
    ): GradientDrawable? = when {
        selected -> rounded(color(R.color.hub_primary), dp(16), color(R.color.hub_primary))
        isToday && isParentRange -> rounded(color(R.color.hub_accent_soft), dp(8), color(R.color.hub_primary))
        isToday -> rounded(Color.TRANSPARENT, dp(16), color(R.color.hub_primary))
        isParentRange -> rounded(color(R.color.hub_accent_soft), 0, null)
        else -> null
    }

    private fun rounded(fill: Int, radius: Int, stroke: Int?): GradientDrawable =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = radius.toFloat()
            if (stroke != null) setStroke(dp(1), stroke)
        }

    private fun color(id: Int): Int = context.getColor(id)

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private companion object {
        const val EXPANSION_DURATION_MS = 220L
        val monthFormatter: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyy년 M월", Locale.KOREAN)
        val fullDateFormatter: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyy년 M월 d일 EEEE", Locale.KOREAN)
        val timeFormatter: DateTimeFormatter =
            DateTimeFormatter.ofPattern("HH:mm", Locale.KOREAN)
    }
}
