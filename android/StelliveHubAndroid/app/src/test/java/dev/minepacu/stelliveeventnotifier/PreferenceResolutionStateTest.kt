package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.datastore.PreferenceKeys
import dev.minepacu.stelliveeventnotifier.core.model.ActiveStatus
import dev.minepacu.stelliveeventnotifier.core.model.AppearanceMode
import dev.minepacu.stelliveeventnotifier.core.model.CatalogRole
import dev.minepacu.stelliveeventnotifier.core.model.DeliveryMode
import dev.minepacu.stelliveeventnotifier.core.model.NotificationEventType
import dev.minepacu.stelliveeventnotifier.core.model.NotificationPlatform
import dev.minepacu.stelliveeventnotifier.core.model.NotificationPreferenceScope
import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.feature.home.MockHubRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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
        assertEquals("song_open_target", PreferenceKeys.SONG_OPEN_TARGET)
    }

    @Test
    fun historyItemsResolveCatalogEntriesOrFallbackTargetsForAvatars() {
        val repository = MockHubRepository()
        val historyMembers = repository.history.mapNotNull { repository.memberForHistory(it) }
        val hubEventHistory = repository.history.first { it.memberId == "hub-event:closing-official-goods" }

        assertTrue(historyMembers.any { it.id == "ayatsuno-yuni" && it.catalogRole == CatalogRole.MEMBER })
        assertTrue(historyMembers.any { it.id == "stellive-official" && it.generationId == "official" && it.catalogRole == CatalogRole.OFFICIAL_CHANNEL })
        assertEquals("event_deadline_soon", hubEventHistory.eventType)
        assertEquals("굿즈/행사", hubEventHistory.memberName)
        assertNull(repository.memberForHistory(hubEventHistory))
    }

    @Test
    fun historyFiltersExposeOnlyVisibleEventTypesAndMembers() {
        val repository = MockHubRepository()

        assertEquals(
            listOf("all", "event_deadline_soon", "chzzk_live_started", "official_youtube_upload"),
            repository.historyEventTypeFilters().map { it.id }
        )
        assertEquals(
            listOf("전체", "마감 임박", "CHZZK 방송 시작", "공식 YouTube 업로드"),
            repository.historyEventTypeFilters().map { it.displayName }
        )
        assertEquals(
            listOf("all", "hub-event:closing-official-goods", "ayatsuno-yuni", "stellive-official"),
            repository.historyMemberFilters().map { it.id }
        )
        assertEquals(
            listOf("전체", "굿즈/행사", "아야츠노 유니", "스텔라이브 공식"),
            repository.historyMemberFilters().map { it.displayName }
        )
    }

    @Test
    fun historyFiltersCombineEventTypeAndMemberSelection() {
        val repository = MockHubRepository()

        assertEquals(
            listOf("h3"),
            repository.filteredHistory(eventTypeFilterId = "event_deadline_soon", memberFilterId = "all").map { it.id }
        )
        assertEquals(
            listOf("h1"),
            repository.filteredHistory(eventTypeFilterId = "all", memberFilterId = "ayatsuno-yuni").map { it.id }
        )
        assertTrue(
            repository.filteredHistory(eventTypeFilterId = "event_deadline_soon", memberFilterId = "ayatsuno-yuni").isEmpty()
        )
    }

    @Test
    fun settingsExposeRequiredPreferencePolicyStructures() {
        val settings = NotificationSettingState()

        assertEquals(setOf("gen1", "gen2", "gen3", "gamja", "official", "gen4-upcoming"), settings.generationEnabled.keys)
        assertFalse(settings.generationEnabled.getValue("gen4-upcoming"))
        assertEquals(NotificationPlatform.entries.toSet(), settings.platformEnabled.keys)
        assertEquals(NotificationEventType.entries.toSet(), settings.eventTypeEnabled.keys)
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
                "최대한 실시간으로 알림 받기는 알림을 빠르게 보내도록 시도하는 기능입니다. 플랫폼, 운영체제 또는 네트워크 상태에 따라 늦어질 수 있습니다.",
                "배터리와 데이터 사용량이 늘어날 수 있습니다.",
                "사용자가 꺼둔 알림과 방해 금지 시간, 차단 키워드는 그대로 적용됩니다."
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
