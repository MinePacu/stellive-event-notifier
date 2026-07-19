package dev.minepacu.stelliveeventnotifier.feature.calendar

import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntry
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntryKind
import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

object HubCalendarDeepLinkPolicy {
    private const val Scheme = "stellivehub"
    private const val HubEventsHost = "hub-events"

    fun appDeepLinkForEvent(eventId: String, scheduleItemId: String? = null): String =
        "$Scheme://$HubEventsHost/$eventId" + (scheduleItemId?.let { "?scheduleItemId=$it" } ?: "")

    fun eventIdFromAppDeepLink(rawDeepLink: String?): String? {
        if (rawDeepLink.isNullOrBlank()) return null

        val uri = runCatching { URI(rawDeepLink) }.getOrNull() ?: return null
        if (uri.scheme != Scheme || uri.host != HubEventsHost) return null

        val eventId = uri.path?.trim('/') ?: return null
        return eventId.takeIf { it.isNotBlank() && !it.contains('/') }
    }

    fun scheduleItemIdFromAppDeepLink(rawDeepLink: String?): String? {
        val uri = runCatching { URI(rawDeepLink) }.getOrNull() ?: return null
        if (uri.scheme != Scheme || uri.host != HubEventsHost) return null
        return uri.rawQuery?.split('&')
            ?.mapNotNull { part -> part.split('=', limit = 2).takeIf { it.size == 2 } }
            ?.firstOrNull { it[0] == "scheduleItemId" }
            ?.get(1)
            ?.let { URLDecoder.decode(it, StandardCharsets.UTF_8) }
            ?.takeIf(String::isNotBlank)
    }

    fun canNavigateToDetail(entry: HubCalendarEntry): Boolean =
        entry.entryKind == HubCalendarEntryKind.HUB_EVENT &&
            eventIdFromAppDeepLink(entry.appDeepLink) == entry.eventId &&
            entry.eventId.isNotBlank()
}
