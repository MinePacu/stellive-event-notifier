package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.NotificationEventType
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventParticipationMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.core.model.NotificationPlatform
import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import dev.minepacu.stelliveeventnotifier.feature.home.MockHubRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HubEventsPolicyTest {
    @Test
    fun goodsEventsSummaryCardsAreHidden() {
        assertFalse(MainUiPolicy.goodsEventsSummaryCardsVisible())
    }

    @Test
    fun goodsEventFiltersUseExistingCategoryStatusAndParticipationMode() {
        assertTrue(
            MainUiPolicy.goodsEventMatchesFilter(
                filterId = "goods",
                category = HubEventCategory.ONLINE_GOODS,
                status = HubEventStatus.OPEN,
                participationMode = HubEventParticipationMode.ONLINE,
            ),
        )
        assertTrue(
            MainUiPolicy.goodsEventMatchesFilter(
                filterId = "offline",
                category = HubEventCategory.OFFLINE_POPUP,
                status = HubEventStatus.OPEN,
                participationMode = HubEventParticipationMode.HYBRID,
            ),
        )
        assertFalse(
            MainUiPolicy.goodsEventMatchesFilter(
                filterId = "closing",
                category = HubEventCategory.TICKETING,
                status = HubEventStatus.UPCOMING,
                participationMode = HubEventParticipationMode.ONLINE,
            ),
        )
    }

    @Test
    fun displayNamesAndDefaultsIncludeHubEvents() {
        assertEquals("굿즈/행사 공개", NotificationEventType.EVENT_ANNOUNCED.displayName)
        assertEquals("예약/판매 시작", NotificationEventType.EVENT_SALES_OPEN.displayName)
        assertEquals("마감 임박", NotificationEventType.EVENT_DEADLINE_SOON.displayName)

        val settings = NotificationSettingState()
        assertEquals(
            listOf("generation_platform", "generation_event_type", "member_platform", "member_event_type"),
            settings.combinationPreferences.map { it.id }
        )
        assertTrue(settings.platformEnabled[NotificationPlatform.HUB_EVENT] == true)
        assertTrue(settings.eventTypeEnabled[NotificationEventType.EVENT_ANNOUNCED] == true)
        assertTrue(settings.eventTypeEnabled[NotificationEventType.EVENT_SALES_OPEN] == true)
        assertTrue(settings.eventTypeEnabled[NotificationEventType.EVENT_DEADLINE_SOON] == true)
        assertTrue(settings.eventTypeEnabled[NotificationEventType.EVENT_UPDATED] == false)
        assertTrue(settings.eventTypeEnabled[NotificationEventType.EVENT_CANCELLED] == true)
    }

    @Test
    fun hubEventsExcludeGangziAndGamja() {
        val repository = MockHubRepository()

        assertTrue(repository.hubEvents.none { it.memberId == "gangzi" })
        assertTrue(repository.hubEvents.none { it.generationId == "gamja" })
    }

    @Test
    fun hubEventSummaryPrioritizesClosingSoonOpenUpcoming() {
        val repository = MockHubRepository()

        assertTrue(repository.hubEventsSummary.closingSoonCount >= 1)
        assertTrue(repository.hubEventsSummary.openCount >= 1)
        assertTrue(repository.hubEventsSummary.upcomingCount >= 1)
        assertEquals("closing-official-goods", repository.hubEventsSummary.preview.first().id)
        assertEquals(HubEventStatus.CLOSING_SOON, repository.hubEventsSummary.preview.first().status)
    }

    @Test
    fun homePreviewSelectorsSurfaceCurrentStatus() {
        val repository = MockHubRepository()

        assertEquals(listOf("ayatsuno-yuni"), repository.liveMembers.map { it.id })
        assertEquals(listOf("h3", "h1", "h2"), repository.recentHistoryPreview.map { it.id })
        assertEquals(listOf("closing-official-goods"), repository.closingSoonHubEvents.map { it.id })
    }

    @Test
    fun hubEventsForFilterUsesStatusFirstStableOrdering() {
        val repository = MockHubRepository()

        assertEquals(
            listOf("closing-official-goods", "open-gen3-goods", "upcoming-offline-popup", "start-only-concert"),
            repository.hubEventsForFilter("all").map { it.id }
        )
    }

    @Test
    fun goodsEventsLabelDoesNotImplyBroadcasts() {
        assertEquals("굿즈/행사", MainUiPolicy.topBarTitle("goods_events"))
        assertEquals("공식 출처의 기간성 굿즈와 행사", MainUiPolicy.topBarRole("goods_events"))
    }

    @Test
    fun filteringSupportsGoodsAndOffline() {
        val repository = MockHubRepository()

        val goodsEvents = repository.hubEventsForFilter("goods")
        assertTrue(goodsEvents.isNotEmpty())
        assertTrue(goodsEvents.all { it.category == HubEventCategory.ONLINE_GOODS || it.category == HubEventCategory.ONLINE_COLLAB })

        val offlineEvents = repository.hubEventsForFilter("offline")
        assertTrue(offlineEvents.isNotEmpty())
        assertTrue(offlineEvents.all { it.participationMode.isOffline })
    }
}
