package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventLink
import dev.minepacu.stelliveeventnotifier.core.model.HubEventLinkKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventParticipationMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleItem
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventSourceType
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventLinkCtaMode
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Test

class HubEventLinkPolicyTest {
    @Test
    fun explicitEventLinksTakePriorityAndAreSortedDeduplicatedAndHttpsOnly() {
        val event = event().copy(
            purchaseUrl = "https://legacy.example/purchase",
            links = listOf(
                HubEventLink("second", HubEventLinkKind.TICKET, null, "https://example.com/ticket", 2),
                HubEventLink("unsafe", HubEventLinkKind.CONTENT, null, "http://example.com/content", 0),
                HubEventLink("first", HubEventLinkKind.PURCHASE, "  스토어  ", " https://example.com/store ", 1),
                HubEventLink("duplicate", HubEventLinkKind.CUSTOM, null, "https://example.com/store", 3),
            ),
        )

        val links = HubEventLinkPolicy.resolvedEventLinks(event)

        assertEquals(listOf("first", "second"), links.map { it.id })
        assertEquals("스토어", links.first().label)
    }

    @Test
    fun legacyScheduleLinksRemainAvailableWhenNewLinksAreMissing() {
        val item = schedule("sales", sortOrder = 0).copy(
            kind = HubEventScheduleKind.SALES_OPEN,
            actionUrl = "https://example.com/buy",
            sourceUrl = "https://example.com/source",
            sourceLabel = "공식 공지",
        )

        val links = HubEventLinkPolicy.resolvedScheduleLinks(item)

        assertEquals(listOf(HubEventLinkKind.PURCHASE, HubEventLinkKind.SOURCE), links.map { it.kind })
        assertEquals(listOf("https://example.com/buy", "https://example.com/source"), links.map { it.url })
    }

    @Test
    fun malformedMultiplePrimaryPayloadSelectsExactlyOneDeterministically() {
        val event = event().copy(
            scheduleItems = listOf(
                schedule("later-sort", sortOrder = 3).copy(isPrimary = true),
                schedule("cancelled", sortOrder = 0).copy(isPrimary = true, cancelledAt = Instant.EPOCH),
                schedule("later-created", sortOrder = 1).copy(isPrimary = true, createdAt = Instant.parse("2026-06-02T00:00:00Z")),
                schedule("winner", sortOrder = 1).copy(isPrimary = true, createdAt = Instant.parse("2026-06-01T00:00:00Z")),
            ),
        )

        assertEquals("winner", HubEventLinkPolicy.effectivePrimaryScheduleItemId(event))
    }

    @Test
    fun eventCtaModeCoversNoDirectAndSheetLinks() {
        assertEquals(HubEventLinkCtaMode.NONE, HubEventLinkPolicy.eventCtaMode(event().copy(sourceUrl = "http://unsafe.example")))
        assertEquals(HubEventLinkCtaMode.DIRECT, HubEventLinkPolicy.eventCtaMode(event()))
        assertEquals(
            HubEventLinkCtaMode.SHEET,
            HubEventLinkPolicy.eventCtaMode(event().copy(links = listOf(
                HubEventLink("one", HubEventLinkKind.PURCHASE, null, "https://example.com/one", 0),
                HubEventLink("two", HubEventLinkKind.TICKET, null, "https://example.com/two", 1),
            )))
        )
    }

    @Test
    fun expansionStatePersistsForSameEventResetsForAnotherAndAddsDeepLink() {
        assertEquals(
            setOf("open", "deep-link"),
            HubEventLinkPolicy.resolvedExpandedScheduleItemIds("event", "event", setOf("open"), "deep-link"),
        )
        assertEquals(
            setOf("other-deep-link"),
            HubEventLinkPolicy.resolvedExpandedScheduleItemIds("event", "other", setOf("open"), "other-deep-link"),
        )
    }

    private fun schedule(id: String, sortOrder: Int) = HubEventScheduleItem(
        id = id,
        kind = HubEventScheduleKind.CUSTOM,
        label = id,
        startsAt = Instant.parse("2026-06-10T00:00:00Z"),
        sortOrder = sortOrder,
    )

    private fun event() = HubEvent(
        id = "event",
        category = HubEventCategory.ONLINE_GOODS,
        participationMode = HubEventParticipationMode.ONLINE,
        status = HubEventStatus.UPCOMING,
        title = "이벤트",
        generationId = "official",
        sourceUrl = "https://example.com/source",
        sourceLabel = "공식",
        sourceType = HubEventSourceType.OFFICIAL,
        updatedAt = Instant.parse("2026-06-01T00:00:00Z"),
    )
}
