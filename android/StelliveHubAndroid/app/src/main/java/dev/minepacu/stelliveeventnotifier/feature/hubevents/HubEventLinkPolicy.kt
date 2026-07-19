package dev.minepacu.stelliveeventnotifier.feature.hubevents

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventLink
import dev.minepacu.stelliveeventnotifier.core.model.HubEventLinkKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleItem
import java.net.URI

enum class HubEventLinkCtaMode { NONE, DIRECT, SHEET }

object HubEventLinkPolicy {
    fun resolvedEventLinks(event: HubEvent): List<HubEventLink> =
        resolve(event.links).ifEmpty {
            resolve(listOfNotNull(
                legacy("legacy:${event.id}:purchase", HubEventLinkKind.PURCHASE, event.purchaseUrl, null, 0),
                legacy("legacy:${event.id}:ticket", HubEventLinkKind.TICKET, event.ticketUrl, null, 1),
                legacy("legacy:${event.id}:source", HubEventLinkKind.SOURCE, event.sourceUrl, event.sourceLabel, 2),
            ))
        }

    fun resolvedScheduleLinks(item: HubEventScheduleItem): List<HubEventLink> =
        resolve(item.links).ifEmpty {
            val actionKind = when (item.kind) {
                dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind.SALES_OPEN -> HubEventLinkKind.PURCHASE
                dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind.TICKET_OPEN -> HubEventLinkKind.TICKET
                dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind.DEADLINE,
                dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind.MAIN_WINDOW -> HubEventLinkKind.RESERVATION
                dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind.ANNOUNCEMENT -> HubEventLinkKind.SOURCE
                else -> HubEventLinkKind.CONTENT
            }
            resolve(listOfNotNull(
                legacy("legacy:${item.id}:action", actionKind, item.actionUrl, null, 0),
                legacy("legacy:${item.id}:source", HubEventLinkKind.SOURCE, item.sourceUrl, item.sourceLabel, 1),
            ))
        }

    fun displayLinkLabel(link: HubEventLink): String =
        link.label?.trim()?.takeIf(String::isNotEmpty) ?: displayKindLabel(link.kind)

    fun displayKindLabel(kind: HubEventLinkKind): String = when (kind) {
        HubEventLinkKind.SOURCE -> "출처"
        HubEventLinkKind.PURCHASE -> "구매"
        HubEventLinkKind.TICKET -> "티켓"
        HubEventLinkKind.RESERVATION -> "예약"
        HubEventLinkKind.CONTENT -> "콘텐츠"
        HubEventLinkKind.VIDEO -> "영상"
        HubEventLinkKind.MAP -> "지도"
        HubEventLinkKind.CUSTOM -> "관련 링크"
    }

    fun eventCtaMode(event: HubEvent): HubEventLinkCtaMode = when (resolvedEventLinks(event).size) {
        0 -> HubEventLinkCtaMode.NONE
        1 -> HubEventLinkCtaMode.DIRECT
        else -> HubEventLinkCtaMode.SHEET
    }

    fun resolvedExpandedScheduleItemIds(
        previousEventId: String?,
        eventId: String,
        currentIds: Set<String>,
        highlightedScheduleItemId: String?,
    ): Set<String> = buildSet {
        if (previousEventId == eventId) addAll(currentIds)
        highlightedScheduleItemId?.let(::add)
    }

    fun effectivePrimaryScheduleItemId(event: HubEvent): String? = event.scheduleItems
        .asSequence()
        .filter { it.cancelledAt == null && it.isPrimary }
        .sortedWith(
            compareBy<HubEventScheduleItem> { it.sortOrder }
                .thenBy { it.startsAt }
                .thenBy { it.createdAt }
                .thenBy { it.id }
        )
        .firstOrNull()
        ?.id

    private fun resolve(links: List<HubEventLink>): List<HubEventLink> {
        val seen = mutableSetOf<String>()
        return links
            .mapNotNull { link -> link.copy(url = link.url.trim(), label = link.label?.trim()?.takeIf(String::isNotEmpty)).takeIf { isHttps(it.url) } }
            .sortedWith(compareBy<HubEventLink> { it.sortOrder }.thenBy { it.id })
            .filter { seen.add(it.url) }
    }

    private fun legacy(id: String, kind: HubEventLinkKind, url: String?, label: String?, sortOrder: Int): HubEventLink? =
        url?.trim()?.takeIf(::isHttps)?.let { HubEventLink(id, kind, label?.trim()?.takeIf(String::isNotEmpty), it, sortOrder) }

    private fun isHttps(value: String): Boolean = runCatching {
        val uri = URI(value)
        uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank()
    }.getOrDefault(false)
}
