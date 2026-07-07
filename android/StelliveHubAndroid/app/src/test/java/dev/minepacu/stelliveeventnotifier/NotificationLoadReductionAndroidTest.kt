package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.NotificationEventType
import dev.minepacu.stelliveeventnotifier.core.notification.AndroidNotificationPresenterPolicy
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationChannels
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationDeliveryLevel
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationPayload
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationPermissionPromptMoment
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationPermissionPromptPolicy
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationTopicKey
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationLoadReductionAndroidTest {
    private fun payload(
        eventId: String = "event-1",
        memberId: String = "ayatsuno-yuni",
        source: String = "chzzk",
        eventType: NotificationEventType = NotificationEventType.CHZZK_LIVE_STARTED,
        deliveryLevel: NotificationDeliveryLevel = NotificationDeliveryLevel.IMMEDIATE_PUSH,
        title: String = "방송 시작",
        body: String = "라이브가 시작되었습니다.",
        summaryGroupId: String? = null
    ) = NotificationPayload(
        eventId = eventId,
        memberId = memberId,
        generationId = "gen1",
        source = source,
        eventType = eventType,
        title = title,
        body = body,
        appDeepLink = "stellivehub://events/$eventId",
        platformUrl = "https://example.com",
        deliveryLevel = deliveryLevel,
        summaryGroupId = summaryGroupId
    )

    @Test
    fun channelsHaveGroupsAndCoverAllowedEventTypes() {
        val groupIds = NotificationChannels.groups.map { it.id }.toSet()

        assertTrue(NotificationChannels.channels.all { it.groupId in groupIds })
        assertNotNull(NotificationChannels.channelFor(NotificationEventType.CHZZK_LIVE_STARTED))
        assertNotNull(NotificationChannels.channelFor(NotificationEventType.OFFICIAL_YOUTUBE_UPLOAD))
        assertNotNull(NotificationChannels.channelFor(NotificationEventType.EVENT_DEADLINE_SOON))
        assertEquals(null, NotificationChannels.channelFor(NotificationEventType.YOUTUBE_LIVE_STARTED))
    }

    @Test
    fun topicKeyGroupsSameMemberSourceAndEventType() {
        val first = payload(eventId = "event-1")
        val second = payload(eventId = "event-2")
        val different = payload(eventId = "event-3", eventType = NotificationEventType.YOUTUBE_UPLOAD, source = "youtube")

        assertEquals(NotificationTopicKey.forPayload(first), NotificationTopicKey.forPayload(second))
        assertFalse(NotificationTopicKey.forPayload(first) == NotificationTopicKey.forPayload(different))
    }

    @Test
    fun topicKeyUsesSummaryGroupAndHubEventIdentityWhenAvailable() {
        assertEquals("summary:official-upload-window", NotificationTopicKey.forPayload(payload(summaryGroupId = "official-upload-window")))
        assertEquals(
            "hub_event:closing-official-goods",
            NotificationTopicKey.forPayload(payload(memberId = "hub-event:closing-official-goods", source = "hub_event"))
        )
    }

    @Test
    fun payloadMapperRequiresCoreFieldsAndDefaultsDeliveryLevel() {
        val parsed = NotificationPayload.fromData(
            mapOf(
                "eventId" to "event-1",
                "memberId" to "ayatsuno-yuni",
                "generationId" to "gen1",
                "source" to "chzzk",
                "eventType" to "chzzk_live_started",
                "title" to "방송 시작",
                "body" to "본문",
                "appDeepLink" to "stellivehub://events/event-1"
            )
        )

        assertEquals(NotificationDeliveryLevel.IMMEDIATE_PUSH, parsed?.deliveryLevel)
        assertEquals(null, NotificationPayload.fromData(mapOf("eventId" to "event-1")))
    }

    @Test
    fun payloadMapperReadsServerPushDataShape() {
        val parsed = NotificationPayload.fromData(
            mapOf(
                "eventId" to "hub_event:event-1:event_sales_open:2026-06-12T00:00:00.000Z",
                "memberId" to "stellive-official",
                "generationId" to "official",
                "source" to "hub_event",
                "eventType" to "event_sales_open",
                "title" to "굿즈/행사 신청이 시작됐어요",
                "body" to "공식 굿즈 판매",
                "appDeepLink" to "stellivehub://hub-events/event-1",
                "platformUrl" to "https://example.com/source",
                "deliveryLevel" to "summary_push",
                "summaryGroupId" to "official-upload-window",
            ),
        )

        assertEquals(NotificationDeliveryLevel.SUMMARY_PUSH, parsed?.deliveryLevel)
        assertEquals("굿즈/행사 신청이 시작됐어요", parsed?.title)
        assertEquals("official-upload-window", parsed?.summaryGroupId)
    }

    @Test
    fun presenterFallsBackToHubEventChannelWhenEventTypeHasNoChannel() {
        assertEquals(
            NotificationChannels.HUB_EVENTS,
            AndroidNotificationPresenterPolicy.channelIdFor(null),
        )
    }

    @Test
    fun presenterUpdatesExistingNotificationWithLatestTwoContents() {
        val body = AndroidNotificationPresenterPolicy.updatedBody(
            listOf(
                payload(eventId = "1", title = "첫 번째", body = "본문 1"),
                payload(eventId = "2", title = "두 번째", body = "본문 2"),
                payload(eventId = "3", title = "세 번째", body = "본문 3")
            )
        )

        assertEquals("두 번째: 본문 2\n세 번째: 본문 3", body)
    }

    @Test
    fun presenterDoesNotShowSystemNotificationForHistoryOnlyDelivery() {
        assertFalse(AndroidNotificationPresenterPolicy.shouldShowSystemNotification(payload(deliveryLevel = NotificationDeliveryLevel.IN_APP_HISTORY_ONLY)))
        assertTrue(AndroidNotificationPresenterPolicy.shouldShowSystemNotification(payload(deliveryLevel = NotificationDeliveryLevel.SUMMARY_PUSH)))
    }

    @Test
    fun permissionPromptDoesNotRunOnFirstLaunch() {
        assertFalse(
            NotificationPermissionPromptPolicy.shouldRequest(
                NotificationPermissionPromptMoment.APP_LAUNCH,
                alreadyGranted = false,
                alreadyRequested = false
            )
        )
        assertTrue(
            NotificationPermissionPromptPolicy.shouldRequest(
                NotificationPermissionPromptMoment.GLOBAL_NOTIFICATION_TOGGLE,
                alreadyGranted = false,
                alreadyRequested = false
            )
        )
    }
}
