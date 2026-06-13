package dev.stellive.hub.feature.calendar

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import dev.stellive.hub.MainActivity
import dev.stellive.hub.R
import dev.stellive.hub.feature.home.MockHubRepository

class HubCalendarWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { appWidgetId ->
            appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context))
        }
    }

    private fun buildRemoteViews(context: Context): RemoteViews {
        val snapshot = MockHubRepository().calendarWidgetSnapshot(limit = 1)
        val entry = snapshot.entries.firstOrNull()
        val views = RemoteViews(context.packageName, R.layout.widget_hub_calendar)
        val intent = Intent(context, MainActivity::class.java).apply {
            if (entry != null && HubCalendarDeepLinkPolicy.canNavigateToDetail(entry)) {
                data = Uri.parse(entry.appDeepLink)
            }
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        views.setOnClickPendingIntent(R.id.widget_calendar_root, pendingIntent)
        views.setTextViewText(R.id.widget_calendar_header, "굿즈/행사")
        if (entry == null) {
            views.setTextViewText(R.id.widget_calendar_title, CalendarWidgetTextFormatter.emptyText())
            views.setTextViewText(R.id.widget_calendar_subtitle, "")
        } else {
            views.setTextViewText(R.id.widget_calendar_title, entry.title)
            views.setTextViewText(R.id.widget_calendar_subtitle, CalendarWidgetTextFormatter.subtitle(entry))
        }
        return views
    }
}
