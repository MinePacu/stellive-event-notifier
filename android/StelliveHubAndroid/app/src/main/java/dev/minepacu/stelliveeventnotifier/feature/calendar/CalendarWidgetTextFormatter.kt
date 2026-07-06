package dev.minepacu.stelliveeventnotifier.feature.calendar

import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntry

object CalendarWidgetTextFormatter {
    fun subtitle(entry: HubCalendarEntry): String =
        "${CalendarUiPolicy.entryLabel(entry)} · ${entry.displayDate} · ${entry.displayTimeText}"

    fun staleText(): String = CalendarUiPolicy.staleWidgetText

    fun emptyText(): String = CalendarUiPolicy.emptyWidgetText
}
