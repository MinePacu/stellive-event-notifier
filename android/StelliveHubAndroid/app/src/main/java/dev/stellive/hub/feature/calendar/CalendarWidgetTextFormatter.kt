package dev.stellive.hub.feature.calendar

import dev.stellive.hub.core.model.HubCalendarEntry

object CalendarWidgetTextFormatter {
    fun subtitle(entry: HubCalendarEntry): String =
        "${CalendarUiPolicy.statusLabel(entry.status)} · ${entry.displayDate} · ${entry.displayTimeText}"

    fun staleText(): String = CalendarUiPolicy.staleWidgetText

    fun emptyText(): String = CalendarUiPolicy.emptyWidgetText
}
