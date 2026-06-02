package dev.stellive.hub

import dev.stellive.hub.core.datastore.PreferenceKeys
import dev.stellive.hub.core.model.ActiveStatus
import dev.stellive.hub.core.model.AppearanceMode
import dev.stellive.hub.core.model.CatalogRole
import dev.stellive.hub.core.model.DeliveryMode
import dev.stellive.hub.core.model.NotificationEventType
import dev.stellive.hub.core.model.NotificationPlatform
import dev.stellive.hub.core.model.NotificationPreferenceScope
import dev.stellive.hub.core.model.NotificationSettingState
import dev.stellive.hub.feature.home.MockHubRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PreferenceResolutionStateTest {
    @Test
    fun mockCatalogExcludesFormerAndIncludesRequiredCategories() {
        val repository = MockHubRepository()
        assertTrue(repository.members.any { it.id == "gangzi" && it.generationId == "gamja" })
        assertTrue(repository.members.any { it.id == "stellive-official" && it.generationId == "official" })
        assertFalse(repository.members.any { it.generationName.contains("Former", ignoreCase = true) })
        assertTrue(repository.members.all { it.activeStatus == ActiveStatus.ACTIVE || it.activeStatus == ActiveStatus.UPCOMING })
    }

    @Test
    fun realtimeSettingDefaultsToStandardAndChatOff() {
        val settings = MockHubRepository().settings
        assertEquals(DeliveryMode.STANDARD, settings.deliveryMode)
        assertFalse(settings.chatEnabled)
        assertFalse(settings.canEnableChzzkChatPush)
    }

    @Test
    fun appearanceModeDefaultsToSystemAndHasPreferenceKey() {
        val settings = MockHubRepository().settings
        assertEquals(AppearanceMode.SYSTEM, settings.appearanceMode)
        assertEquals("appearance_mode", PreferenceKeys.APPEARANCE_MODE)
    }

    @Test
    fun historyItemsResolveToCatalogEntriesForAvatars() {
        val repository = MockHubRepository()
        val historyMembers = repository.history.mapNotNull { repository.memberForHistory(it) }

        assertEquals(repository.history.size, historyMembers.size)
        assertTrue(historyMembers.any { it.id == "ayatsuno-yuni" && it.catalogRole == CatalogRole.MEMBER })
        assertTrue(historyMembers.any { it.id == "stellive-official" && it.generationId == "official" && it.catalogRole == CatalogRole.OFFICIAL_CHANNEL })
    }

    @Test
    fun settingsExposeRequiredPreferencePolicyStructures() {
        val settings = NotificationSettingState()

        assertEquals(setOf("gen1", "gen2", "gen3", "gamja", "official", "gen4-upcoming"), settings.generationEnabled.keys)
        assertFalse(settings.generationEnabled.getValue("gen4-upcoming"))
        assertEquals(NotificationPlatform.entries.toSet(), settings.platformEnabled.keys)
        assertEquals(NotificationEventType.entries.toSet(), settings.eventTypeEnabled.keys)
        assertTrue(settings.eventTypeEnabled.getValue(NotificationEventType.OFFICIAL_X_POST))
        assertTrue(settings.eventTypeEnabled.getValue(NotificationEventType.OFFICIAL_YOUTUBE_UPLOAD))
        assertFalse(settings.eventTypeEnabled.getValue(NotificationEventType.YOUTUBE_LIVE_SCHEDULED))
        assertFalse(settings.eventTypeEnabled.getValue(NotificationEventType.YOUTUBE_LIVE_STARTED))
        assertFalse(settings.eventTypeEnabled.getValue(NotificationEventType.YOUTUBE_LIVE_ENDED))
        assertTrue(settings.combinationPreferences.map { it.scope }.contains(NotificationPreferenceScope.GENERATION_PLATFORM))
        assertTrue(settings.combinationPreferences.map { it.scope }.contains(NotificationPreferenceScope.GENERATION_EVENT_TYPE))
        assertTrue(settings.combinationPreferences.map { it.scope }.contains(NotificationPreferenceScope.MEMBER_PLATFORM))
        assertTrue(settings.combinationPreferences.map { it.scope }.contains(NotificationPreferenceScope.MEMBER_EVENT_TYPE))
        assertFalse(settings.quietHours.enabled)
        assertFalse(settings.keywordFilters.hasExplicitFilters)
        assertEquals(10, settings.rateLimit.maxNotificationsPerMinute)
    }

    @Test
    fun realtimeDisclosureMentionsPolicyLimits() {
        assertEquals(
            listOf(
                "최대한 실시간 모드는 가능한 한 빠르게 알림을 받도록 시도하지만, 플랫폼/OS/네트워크 사정으로 지연될 수 있습니다.",
                "배터리와 데이터 사용량이 증가할 수 있습니다.",
                "사용자가 꺼둔 알림, 조용한 시간, 차단 키워드, rate limit은 계속 적용됩니다."
            ),
            NotificationSettingState.REALTIME_DISCLOSURE_LINES
        )
    }

    @Test
    fun chzzkChatPushRequiresExplicitFilters() {
        var settings = NotificationSettingState(chatEnabled = true)

        assertFalse(settings.canEnableChzzkChatPush)

        settings = settings.copy(keywordFilters = settings.keywordFilters.copy(allowlistText = "공지"))

        assertTrue(settings.canEnableChzzkChatPush)
    }

    @Test
    fun officialYoutubeLiveIsNotRepresentedInHistoryOrSettings() {
        val repository = MockHubRepository()

        assertFalse(repository.history.any { it.eventType.contains("youtube_live") })
        assertFalse(repository.settings.eventTypeEnabled.getValue(NotificationEventType.YOUTUBE_LIVE_SCHEDULED))
        assertFalse(repository.settings.eventTypeEnabled.getValue(NotificationEventType.YOUTUBE_LIVE_STARTED))
        assertFalse(repository.settings.eventTypeEnabled.getValue(NotificationEventType.YOUTUBE_LIVE_ENDED))
    }
}
