package dev.stellive.hub.feature.calendar

import dev.stellive.hub.core.model.HubCalendarEntry

object CalendarWidgetTextFormatter {
    fun subtitle(entry: HubCalendarEntry): String =
        "${CalendarUiPolicy.entryLabel(entry)} · ${entry.displayDate} · ${entry.displayTimeText}"

    fun staleText(): String = CalendarUiPolicy.staleWidgetText

    fun emptyText(): String = CalendarUiPolicy.emptyWidgetText
}
