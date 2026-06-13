package dev.stellive.hub.feature.calendar

import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubCalendarEntryKind
import java.net.URI

object HubCalendarDeepLinkPolicy {
    private const val Scheme = "stellivehub"
    private const val HubEventsHost = "hub-events"

    fun appDeepLinkForEvent(eventId: String): String = "$Scheme://$HubEventsHost/$eventId"

    fun eventIdFromAppDeepLink(rawDeepLink: String?): String? {
        if (rawDeepLink.isNullOrBlank()) return null

        val uri = runCatching { URI(rawDeepLink) }.getOrNull() ?: return null
        if (uri.scheme != Scheme || uri.host != HubEventsHost) return null

        val eventId = uri.path?.trim('/') ?: return null
        return eventId.takeIf { it.isNotBlank() && !it.contains('/') }
    }

    fun canNavigateToDetail(entry: HubCalendarEntry): Boolean =
        entry.entryKind == HubCalendarEntryKind.HUB_EVENT &&
            eventIdFromAppDeepLink(entry.appDeepLink) == entry.eventId &&
            entry.eventId.isNotBlank()
}
