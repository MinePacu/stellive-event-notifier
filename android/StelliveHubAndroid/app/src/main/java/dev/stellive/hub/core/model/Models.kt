package dev.stellive.hub.core.model

import java.time.Instant

enum class CatalogRole { MEMBER, REPRESENTATIVE, OFFICIAL_CHANNEL, PLACEHOLDER }
enum class ActiveStatus { ACTIVE, UPCOMING }
enum class DeliveryMode { STANDARD, REALTIME_BEST_EFFORT }
enum class TapAction { OPEN_APP, OPEN_PLATFORM }
enum class AppearanceMode { SYSTEM, LIGHT, DARK }

enum class NotificationPlatform(val displayName: String) {
    CHZZK("CHZZK"),
    YOUTUBE("YouTube"),
    X("X"),
    HUB_EVENT("굿즈/행사"),
    NAVER_CAFE("Naver Cafe")
}

enum class NotificationEventType(val wireName: String, val displayName: String) {
    X_POST("x_post", "X 게시글"),
    CAFE_POST("cafe_post", "카페 게시글"),
    CHZZK_LIVE_STARTED("chzzk_live_started", "CHZZK 방송 시작"),
    CHZZK_LIVE_ENDED("chzzk_live_ended", "CHZZK 방송 종료"),
    CHZZK_CHAT("chzzk_chat", "CHZZK 채팅"),
    CHZZK_SUBSCRIPTION("chzzk_subscription", "CHZZK 구독"),
    YOUTUBE_UPLOAD("youtube_upload", "YouTube 업로드"),
    YOUTUBE_LIVE_SCHEDULED("youtube_live_scheduled", "YouTube 라이브 예정"),
    YOUTUBE_LIVE_STARTED("youtube_live_started", "YouTube 라이브 시작"),
    YOUTUBE_LIVE_ENDED("youtube_live_ended", "YouTube 라이브 종료"),
    OFFICIAL_X_POST("official_x_post", "공식 X 게시글"),
    OFFICIAL_YOUTUBE_UPLOAD("official_youtube_upload", "공식 YouTube 업로드"),
    EVENT_ANNOUNCED("event_announced", "굿즈/행사 공개"),
    EVENT_SALES_OPEN("event_sales_open", "예약/판매 시작"),
    EVENT_DEADLINE_SOON("event_deadline_soon", "마감 임박"),
    EVENT_UPDATED("event_updated", "굿즈/행사 변경"),
    EVENT_CANCELLED("event_cancelled", "굿즈/행사 취소")
}

enum class NotificationPreferenceScope {
    GLOBAL,
    GENERATION,
    MEMBER,
    PLATFORM,
    EVENT_TYPE,
    GENERATION_PLATFORM,
    GENERATION_EVENT_TYPE,
    MEMBER_PLATFORM,
    MEMBER_EVENT_TYPE
}

data class CombinationPreference(
    val id: String,
    val scope: NotificationPreferenceScope,
    val label: String,
    val enabled: Boolean = true
)

data class QuietHoursState(
    val enabled: Boolean = false,
    val start: String = "23:00",
    val end: String = "08:00",
    val timezone: String = "Asia/Seoul"
)

data class KeywordFilterState(
    val allowlistText: String = "",
    val blocklistText: String = ""
) {
    val hasExplicitFilters: Boolean
        get() = allowlistText.isNotBlank() || blocklistText.isNotBlank()
}

data class RateLimitState(
    val maxNotificationsPerMinute: Int = 10
)

data class HubMember(
    val id: String,
    val koreanName: String,
    val englishName: String,
    val generationId: String,
    val generationName: String,
    val unitName: String,
    val catalogRole: CatalogRole,
    val roleLabel: String? = null,
    val activeStatus: ActiveStatus = ActiveStatus.ACTIVE,
    val isPerson: Boolean,
    val chzzkChannelId: String? = null,
    val youtubeHandle: String? = null,
    val xHandle: String? = null,
    val isLive: Boolean = false,
    val notificationEnabled: Boolean = true,
    val realtimeEnabled: Boolean = false,
    val liveStartedAt: Instant? = null
)

data class GenerationFilter(
    val id: String,
    val displayName: String,
    val notificationDefaultEnabled: Boolean
)

data class NotificationSettingState(
    val globalEnabled: Boolean = true,
    val deliveryMode: DeliveryMode = DeliveryMode.STANDARD,
    val tapAction: TapAction = TapAction.OPEN_APP,
    val appearanceMode: AppearanceMode = AppearanceMode.SYSTEM,
    val chatEnabled: Boolean = false,
    val generationEnabled: Map<String, Boolean> = defaultGenerationEnabled(),
    val memberEnabled: Map<String, Boolean> = defaultMemberEnabled(),
    val platformEnabled: Map<NotificationPlatform, Boolean> = defaultPlatformEnabled(),
    val eventTypeEnabled: Map<NotificationEventType, Boolean> = defaultEventTypeEnabled(),
    val combinationPreferences: List<CombinationPreference> = defaultCombinationPreferences(),
    val quietHours: QuietHoursState = QuietHoursState(),
    val keywordFilters: KeywordFilterState = KeywordFilterState(),
    val rateLimit: RateLimitState = RateLimitState()
) {
    val canEnableChzzkChatPush: Boolean
        get() = chatEnabled && keywordFilters.hasExplicitFilters

    companion object {
        val REALTIME_DISCLOSURE_LINES = listOf(
            "최대한 실시간 모드는 가능한 한 빠르게 알림을 받도록 시도하지만, 플랫폼/OS/네트워크 사정으로 지연될 수 있습니다.",
            "배터리와 데이터 사용량이 증가할 수 있습니다.",
            "사용자가 꺼둔 알림, 조용한 시간, 차단 키워드, rate limit은 계속 적용됩니다."
        )
    }
}

data class NotificationHistoryItem(
    val id: String,
    val title: String,
    val body: String,
    val memberId: String,
    val memberName: String,
    val eventType: String,
    val deliveryMode: DeliveryMode,
    val deliveryLatencyMs: Long? = null
)

private fun defaultGenerationEnabled(): Map<String, Boolean> = linkedMapOf(
    "gen1" to true,
    "gen2" to true,
    "gen3" to true,
    "gamja" to true,
    "official" to true,
    "gen4-upcoming" to false
)

private fun defaultMemberEnabled(): Map<String, Boolean> = linkedMapOf(
    "ayatsuno-yuni" to true,
    "sakihane-huya" to true,
    "shirayuki-hina" to true,
    "neneko-mashiro" to true,
    "akane-lize" to true,
    "arahashi-tabi" to true,
    "tenko-shibuki" to true,
    "aokumo-rin" to true,
    "hanako-nana" to true,
    "yuzuha-riko" to true,
    "gangzi" to true,
    "stellive-official" to true,
    "gen4-placeholder" to false
)

private fun defaultPlatformEnabled(): Map<NotificationPlatform, Boolean> = linkedMapOf(
    NotificationPlatform.CHZZK to true,
    NotificationPlatform.YOUTUBE to true,
    NotificationPlatform.X to true,
    NotificationPlatform.HUB_EVENT to true,
    NotificationPlatform.NAVER_CAFE to false
)

private fun defaultEventTypeEnabled(): Map<NotificationEventType, Boolean> = linkedMapOf(
    NotificationEventType.X_POST to true,
    NotificationEventType.CAFE_POST to false,
    NotificationEventType.CHZZK_LIVE_STARTED to true,
    NotificationEventType.CHZZK_LIVE_ENDED to true,
    NotificationEventType.CHZZK_CHAT to false,
    NotificationEventType.CHZZK_SUBSCRIPTION to true,
    NotificationEventType.YOUTUBE_UPLOAD to true,
    NotificationEventType.YOUTUBE_LIVE_SCHEDULED to false,
    NotificationEventType.YOUTUBE_LIVE_STARTED to false,
    NotificationEventType.YOUTUBE_LIVE_ENDED to false,
    NotificationEventType.OFFICIAL_X_POST to true,
    NotificationEventType.OFFICIAL_YOUTUBE_UPLOAD to true,
    NotificationEventType.EVENT_ANNOUNCED to true,
    NotificationEventType.EVENT_SALES_OPEN to true,
    NotificationEventType.EVENT_DEADLINE_SOON to true,
    NotificationEventType.EVENT_UPDATED to false,
    NotificationEventType.EVENT_CANCELLED to true
)

private fun defaultCombinationPreferences(): List<CombinationPreference> = listOf(
    CombinationPreference("generation_platform", NotificationPreferenceScope.GENERATION_PLATFORM, "카테고리 + 플랫폼"),
    CombinationPreference("generation_event_type", NotificationPreferenceScope.GENERATION_EVENT_TYPE, "카테고리 + 이벤트 타입"),
    CombinationPreference("member_platform", NotificationPreferenceScope.MEMBER_PLATFORM, "개별 항목 + 플랫폼"),
    CombinationPreference("member_event_type", NotificationPreferenceScope.MEMBER_EVENT_TYPE, "개별 항목 + 이벤트 타입")
)
