package dev.stellive.hub

import dev.stellive.hub.core.model.NotificationEventType
import dev.stellive.hub.core.model.NotificationPlatform
import dev.stellive.hub.core.model.NotificationSettingState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HubEventsPolicyTest {
    @Test
    fun displayNamesAndDefaultsIncludeHubEvents() {
        assertEquals("굿즈/행사 공개", NotificationEventType.EVENT_ANNOUNCED.displayName)
        assertEquals("예약/판매 시작", NotificationEventType.EVENT_SALES_OPEN.displayName)
        assertEquals("마감 임박", NotificationEventType.EVENT_DEADLINE_SOON.displayName)

        val settings = NotificationSettingState()
        assertTrue(settings.platformEnabled[NotificationPlatform.HUB_EVENT] == true)
        assertTrue(settings.eventTypeEnabled[NotificationEventType.EVENT_ANNOUNCED] == true)
        assertTrue(settings.eventTypeEnabled[NotificationEventType.EVENT_SALES_OPEN] == true)
        assertTrue(settings.eventTypeEnabled[NotificationEventType.EVENT_DEADLINE_SOON] == true)
        assertTrue(settings.eventTypeEnabled[NotificationEventType.EVENT_UPDATED] == false)
        assertTrue(settings.eventTypeEnabled[NotificationEventType.EVENT_CANCELLED] == true)
    }
}
