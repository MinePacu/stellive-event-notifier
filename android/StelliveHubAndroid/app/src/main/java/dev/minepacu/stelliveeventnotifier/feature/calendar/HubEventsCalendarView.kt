package dev.minepacu.stelliveeventnotifier.feature.calendar

import android.app.DatePickerDialog
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.material.card.MaterialCardView
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarDay
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntry
import java.time.Clock
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

class HubEventsCalendarView(
    context: Context,
    days: List<HubCalendarDay>,
    clock: Clock = Clock.systemDefaultZone(),
    initialMonth: YearMonth? = null,
    private val showModeControls: Boolean = true,
    private val onMonthChanged: (YearMonth) -> Unit = {},
    private val onEntryClick: (String) -> Unit = {},
) : MaterialCardView(context) {
    private val viewModel = HubEventsCalendarViewModel(days, clock, initialMonth)
    private val content = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(14), dp(14), dp(14))
    }

    init {
        radius = dp(18).toFloat()
        cardElevation = 0f
        strokeWidth = dp(1)
        strokeColor = color(R.color.hub_line)
        setCardBackgroundColor(color(R.color.hub_card))
        layoutParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(12)
        }
        addView(content)
        render()
    }

    private fun render() {
        content.removeAllViews()
        content.addView(titleBlock())
        if (showModeControls) {
            content.addView(modeSwitch())
            content.addView(scopeSwitch())
        }

        if (showModeControls && viewModel.uiState.viewMode == HubEventsViewMode.LIST) {
            content.addView(listDateNavigationHeader())
            return
        }

        content.addView(monthControl())
        content.addView(weekdayHeader())
        content.addView(monthGrid())
    }

    private fun titleBlock(): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        addView(TextView(context).apply {
            text = "굿즈/행사 캘린더"
            setTextColor(color(R.color.hub_text))
            textSize = 17f
            typeface = Typeface.DEFAULT_BOLD
        })
        addView(TextView(context).apply {
            text = "서버에서 동기화된 일정만 표시합니다."
            setTextColor(color(R.color.hub_text_muted))
            textSize = 12f
            setPadding(0, dp(3), 0, dp(10))
        })
    }

    private fun modeSwitch(): View = segmentedRow(
        listOf(
            Segment("목록", viewModel.uiState.viewMode == HubEventsViewMode.LIST) {
                viewModel.setViewMode(HubEventsViewMode.LIST)
            },
            Segment("캘린더", viewModel.uiState.viewMode == HubEventsViewMode.CALENDAR) {
                viewModel.setViewMode(HubEventsViewMode.CALENDAR)
            },
        ),
    )

    private fun scopeSwitch(): View = segmentedRow(
        listOf(
            Segment("일별", viewModel.uiState.scopeMode == HubCalendarScopeMode.DAY) {
                viewModel.setScopeMode(HubCalendarScopeMode.DAY)
            },
            Segment("기간별", viewModel.uiState.scopeMode == HubCalendarScopeMode.RANGE) {
                viewModel.setScopeMode(HubCalendarScopeMode.RANGE)
            },
        ),
    )

    private fun listDateNavigationHeader(): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        background = rounded(color(R.color.hub_surface), dp(18), color(R.color.hub_line))
        setPadding(dp(10), dp(10), dp(10), dp(10))
        layoutParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(10)
        }

        addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL

            val isDayMode = viewModel.uiState.scopeMode == HubCalendarScopeMode.DAY
            addView(monthButton(if (isDayMode) "이전 날짜" else "이전 기간") {
            updateState { if (isDayMode) viewModel.goToPreviousDay() else viewModel.goToPreviousRange() }
            })

            addView(TextView(context).apply {
                text = listNavigationTitle()
                setTextColor(color(R.color.hub_text))
                textSize = 14f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
            })

            addView(monthButton(if (isDayMode) "다음 날짜" else "다음 기간") {
            updateState { if (isDayMode) viewModel.goToNextDay() else viewModel.goToNextRange() }
            })
        })

        addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, 0)

            if (viewModel.uiState.scopeMode == HubCalendarScopeMode.DAY) {
                addView(monthButton("오늘") { updateState { viewModel.goToToday() } })
                addView(monthButton("날짜 선택") { showDayPicker() })
            } else {
                addView(monthButton("이번 주") { updateState { viewModel.goToCurrentWeek() } })
                addView(monthButton("기간 선택") { showRangeStartPicker() })
            }
        })
    }

    private fun listNavigationTitle(): String =
        if (viewModel.uiState.scopeMode == HubCalendarScopeMode.DAY) {
            dayNavigationTitle()
        } else {
            val start = viewModel.uiState.rangeStart ?: viewModel.uiState.selectedDay
            val end = viewModel.uiState.rangeEnd ?: start.plusDays(6)
            "${rangeDateFormatter.format(start)} - ${rangeDateFormatter.format(end)}"
        }

    private fun dayNavigationTitle(): String {
        val singleEntry = viewModel.uiState.visibleEntries.singleOrNull()
        if (singleEntry != null) {
            val periodText = CalendarUiPolicy.entryPeriodDateText(singleEntry)
            if (periodText != singleEntry.displayDate) return periodText
        }
        return selectedDateFormatter.format(viewModel.uiState.selectedDay)
    }

    private fun showDayPicker() {
        showDatePicker(viewModel.uiState.selectedDay, "날짜 선택") { selectedDate ->
            updateState { viewModel.applySelectedDay(selectedDate) }
        }
    }

    private fun showRangeStartPicker() {
        val initialStart = viewModel.uiState.rangeStart ?: viewModel.uiState.selectedDay
        showDatePicker(initialStart, "시작일 선택") { startDate ->
            val initialEnd = viewModel.uiState.rangeEnd ?: startDate.plusDays(6)
            showDatePicker(initialEnd, "종료일 선택") { endDate ->
                updateState { viewModel.applySelectedRange(startDate, endDate) }
            }
        }
    }

    private fun showDatePicker(
        initialDate: LocalDate,
        title: String,
        onDateSelected: (LocalDate) -> Unit,
    ) {
        DatePickerDialog(
            context,
            { _, year, month, dayOfMonth ->
                onDateSelected(LocalDate.of(year, month + 1, dayOfMonth))
            },
            initialDate.year,
            initialDate.monthValue - 1,
            initialDate.dayOfMonth,
        ).apply {
            setTitle(title)
        }.show()
    }

    private fun monthControl(): View = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(0, dp(8), 0, dp(8))

        addView(monthButton("이전") {
            updateState { viewModel.goToPreviousMonth() }
        })
        addView(TextView(context).apply {
            text = monthFormatter.format(viewModel.uiState.selectedMonth)
            setTextColor(color(R.color.hub_text))
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
        })
        addView(monthButton("다음") {
            updateState { viewModel.goToNextMonth() }
        })
    }

    private fun weekdayHeader(): View = GridLayout(context).apply {
        columnCount = 7
        listOf("일", "월", "화", "수", "목", "금", "토").forEachIndexed { column, label ->
            addView(TextView(context).apply {
                text = label
                gravity = Gravity.CENTER
                setTextColor(color(R.color.hub_text_muted))
                textSize = 11f
                layoutParams = GridLayout.LayoutParams().apply {
                    width = 0
                    height = dp(24)
                    rowSpec = GridLayout.spec(0)
                    columnSpec = GridLayout.spec(column, 1, GridLayout.FILL, 1f)
                }
            })
        }
    }

    private fun monthGrid(): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        val month = viewModel.uiState.selectedMonth
        val firstDay = month.atDay(1)
        val leadingDays = firstDay.dayOfWeek.value % 7
        val totalCells = ((leadingDays + month.lengthOfMonth() + 6) / 7) * 7
        val visibleStart = firstDay.minusDays(leadingDays.toLong())
        val durationLayout = CalendarUiPolicy.durationBarLayoutForMonth(viewModel.uiState.days, month)

        repeat(totalCells / 7) { weekIndex ->
            val weekStart = visibleStart.plusDays((weekIndex * 7).toLong())
            addView(GridLayout(context).apply {
                columnCount = 7
                repeat(7) { column ->
                    val date = weekStart.plusDays(column.toLong())
                    addView(dateCell(date, YearMonth.from(date) == month, column))
                }
            })
            val laneCount = durationLayout.laneCountsByWeek[weekIndex] ?: 0
            repeat(laneCount) { lane ->
                addView(durationLaneRow(durationLayout.segments.filter { it.weekIndex == weekIndex && it.lane == lane }))
            }
        }
    }

    private fun durationLaneRow(segments: List<CalendarDurationBarSegment>): View =
        LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(1), 0, dp(1), 0)
            layoutParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, dp(7)).apply {
                topMargin = dp(1)
            }
            var cursor = 0
            segments.sortedBy { it.startColumn }.forEach { segment ->
                if (segment.startColumn > cursor) {
                    addDurationSpacer(segment.startColumn - cursor)
                }
                addView(View(context).apply {
                    background = rounded(durationBarColor(segment.emphasis), dp(3), Color.TRANSPARENT)
                    alpha = 0.72f
                    layoutParams = LinearLayout.LayoutParams(
                        0,
                        dp(5),
                        (segment.endColumn - segment.startColumn + 1).toFloat(),
                    )
                })
                cursor = segment.endColumn + 1
            }
            if (cursor < 7) {
                addDurationSpacer(7 - cursor)
            }
        }

    private fun LinearLayout.addDurationSpacer(columnSpan: Int) {
        if (columnSpan <= 0) return
        addView(View(context).apply {
            layoutParams = LinearLayout.LayoutParams(0, dp(5), columnSpan.toFloat())
        })
    }

    private fun dateCell(date: LocalDate, inSelectedMonth: Boolean, column: Int): View {
        val marker = viewModel.markerForDate(date)
        val entries = viewModel.uiState.days
            .firstOrNull { it.date == date.toString() }
            ?.entries
            .orEmpty()
        val dotStyle = CalendarUiPolicy.dotStyleForEntries(entries)
        val hasMultiDayEntry = CalendarUiPolicy.hasMultiDayEntry(entries, date)
        val cell = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            isClickable = true
            isFocusable = true
            minimumHeight = dp(54)
            contentDescription = CalendarUiPolicy.accessibilityLabelForDate(
                date,
                marker,
                entries.size,
                hasMultiDayEntry = hasMultiDayEntry,
            )
            background = cellBackground(marker)
            alpha = if (inSelectedMonth) 1f else 0.36f
            setOnClickListener {
                if (viewModel.uiState.scopeMode == HubCalendarScopeMode.DAY) {
                    updateState { viewModel.selectDay(date) }
                } else {
                    updateState { viewModel.selectRangeBoundary(date) }
                }
            }
            layoutParams = GridLayout.LayoutParams().apply {
                width = 0
                height = dp(58)
                setMargins(dp(1), dp(2), dp(1), dp(2))
                rowSpec = GridLayout.spec(0)
                columnSpec = GridLayout.spec(column, 1, GridLayout.FILL, 1f)
            }
        }

        cell.addView(TextView(context).apply {
            text = date.dayOfMonth.toString()
            gravity = Gravity.CENTER
            textSize = 13f
            typeface = if (marker == CalendarDateMarker.SELECTED_DAY ||
                marker == CalendarDateMarker.RANGE_START ||
                marker == CalendarDateMarker.RANGE_END
            ) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            setTextColor(dateTextColor(marker))
        })
        if (dotStyle.visible) {
            val dotColor = when (dotStyle.emphasis) {
                CalendarEventDotEmphasis.HIGH -> color(R.color.hub_warning)
                CalendarEventDotEmphasis.MUTED -> color(R.color.hub_text_muted)
                CalendarEventDotEmphasis.NORMAL -> color(R.color.hub_success)
            }
            cell.addView(TextView(context).apply {
                text = dotStyle.countText.orEmpty()
                gravity = Gravity.CENTER
                textSize = 8f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.WHITE)
                background = rounded(dotColor, dp(dotStyle.sizeDp), Color.TRANSPARENT)
                layoutParams = LinearLayout.LayoutParams(dp(dotStyle.sizeDp), dp(dotStyle.sizeDp)).apply {
                    topMargin = dp(3)
                }
            })
        }
        return cell
    }

    private fun entryList(entries: List<HubCalendarEntry>): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(0, dp(10), 0, 0)
        if (entries.isEmpty()) {
            addView(TextView(context).apply {
                text = "선택한 범위에 표시할 일정이 없습니다."
                setTextColor(color(R.color.hub_text_muted))
                textSize = 13f
                gravity = Gravity.CENTER
                setPadding(0, dp(14), 0, dp(8))
            })
            return@apply
        }

        entries.forEach { entry ->
            addView(entryRow(entry))
        }
    }

    private fun entryRow(entry: HubCalendarEntry): View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        val rowDate = runCatching { LocalDate.parse(entry.displayDate) }
            .getOrDefault(viewModel.uiState.selectedDay)
        val canNavigate = HubCalendarDeepLinkPolicy.canNavigateToDetail(entry)
        isClickable = canNavigate
        isFocusable = canNavigate
        background = rounded(color(R.color.hub_surface), dp(14), color(R.color.hub_line))
        setPadding(dp(12), dp(10), dp(12), dp(10))
        if (canNavigate) {
            setOnClickListener { onEntryClick(entry.eventId) }
        }
        layoutParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(8)
        }

        addView(TextView(context).apply {
            text = entry.title
            setTextColor(color(R.color.hub_text))
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
        })
        addView(TextView(context).apply {
            text = listOf(entry.category.displayName, entry.participationMode.displayName, entry.sourceLabel)
                .filter { it.isNotBlank() }
                .joinToString(" · ")
            setTextColor(color(R.color.hub_text_muted))
            textSize = 12f
            setPadding(0, dp(3), 0, 0)
        })
        addView(TextView(context).apply {
            text = "${CalendarUiPolicy.entryRowStatusText(entry, rowDate)} · ${CalendarUiPolicy.entryPeriodDateText(entry)} · ${entry.displayTimeText}"
            setTextColor(color(R.color.hub_success))
            textSize = 12f
            setPadding(0, dp(4), 0, 0)
        })
    }

    private fun segmentedRow(segments: List<Segment>): View = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        background = rounded(color(R.color.hub_surface), dp(18), color(R.color.hub_line))
        setPadding(dp(3), dp(3), dp(3), dp(3))
        layoutParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(8)
        }

        segments.forEach { segment ->
            addView(TextView(context).apply {
                text = segment.label
                gravity = Gravity.CENTER
                textSize = 13f
                typeface = if (segment.selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
                setTextColor(if (segment.selected) Color.WHITE else color(R.color.hub_text_muted))
                background = if (segment.selected) rounded(color(R.color.hub_success), dp(15), Color.TRANSPARENT) else null
                setPadding(0, dp(7), 0, dp(7))
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    segment.onClick()
                    render()
                }
                layoutParams = LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
            })
        }
    }

    private fun updateState(action: () -> Unit) {
        val previousMonth = viewModel.uiState.selectedMonth
        action()
        render()
        val currentMonth = viewModel.uiState.selectedMonth
        if (currentMonth != previousMonth) {
            onMonthChanged(currentMonth)
        }
    }

    private fun monthButton(label: String, onClick: () -> Unit): View = TextView(context).apply {
        text = label
        gravity = Gravity.CENTER
        textSize = 12f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(color(R.color.hub_text))
        background = rounded(color(R.color.hub_surface), dp(14), color(R.color.hub_line))
        setPadding(dp(12), dp(7), dp(12), dp(7))
        isClickable = true
        isFocusable = true
        setOnClickListener {
            onClick()
        }
    }

    private fun cellBackground(marker: CalendarDateMarker): GradientDrawable? = when (marker) {
        CalendarDateMarker.SELECTED_DAY,
        CalendarDateMarker.RANGE_START,
        CalendarDateMarker.RANGE_END -> rounded(color(R.color.hub_success), dp(16), color(R.color.hub_success))
        CalendarDateMarker.RANGE_MIDDLE_WITH_EVENT,
        CalendarDateMarker.RANGE_MIDDLE_EMPTY -> rounded(color(R.color.hub_accent_soft), dp(10), Color.TRANSPARENT)
        CalendarDateMarker.TODAY -> rounded(Color.TRANSPARENT, dp(16), color(R.color.hub_success))
        CalendarDateMarker.OUTSIDE -> null
    }

    private fun dateTextColor(marker: CalendarDateMarker): Int = when (marker) {
        CalendarDateMarker.SELECTED_DAY,
        CalendarDateMarker.RANGE_START,
        CalendarDateMarker.RANGE_END -> Color.WHITE
        else -> color(R.color.hub_text)
    }

    private fun dotColor(marker: CalendarDateMarker): Int = when (marker) {
        CalendarDateMarker.SELECTED_DAY,
        CalendarDateMarker.RANGE_START,
        CalendarDateMarker.RANGE_END -> Color.WHITE
        else -> color(R.color.hub_success)
    }

    private fun durationBarColor(emphasis: CalendarEventDotEmphasis): Int = when (emphasis) {
        CalendarEventDotEmphasis.HIGH -> color(R.color.hub_warning)
        CalendarEventDotEmphasis.MUTED -> color(R.color.hub_text_muted)
        CalendarEventDotEmphasis.NORMAL -> color(R.color.hub_success)
    }

    private fun rounded(fill: Int, radius: Int, stroke: Int): GradientDrawable =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = radius.toFloat()
            if (stroke != Color.TRANSPARENT) {
                setStroke(dp(1), stroke)
            }
        }

    private fun color(id: Int): Int = context.getColor(id)

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private data class Segment(
        val label: String,
        val selected: Boolean,
        val onClick: () -> Unit,
    )

    private companion object {
        val monthFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy년 M월", Locale.KOREAN)
        val selectedDateFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("M월 d일 EEEE", Locale.KOREAN)
        val rangeDateFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("M.d", Locale.KOREAN)
    }
}
