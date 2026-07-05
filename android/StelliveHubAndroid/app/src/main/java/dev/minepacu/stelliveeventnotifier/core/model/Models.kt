package dev.minepacu.stelliveeventnotifier.core.model

import java.time.Instant

enum class CatalogRole { MEMBER, REPRESENTATIVE, OFFICIAL_CHANNEL, PLACEHOLDER }
enum class ActiveStatus { ACTIVE, UPCOMING }
enum class DeliveryMode { STANDARD, REALTIME_BEST_EFFORT }
enum class TapAction { OPEN_APP, OPEN_PLATFORM }
enum class AppearanceMode { SYSTEM, LIGHT, DARK }

enum class SongType(val apiValue: String, val displayName: String) {
    ORIGINAL("original", "오리지널"),
    COVER("cover", "커버");

    companion object {
        fun fromApiValue(value: String): SongType? =
            entries.firstOrNull { it.apiValue == value }
    }
}

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

enum class HubEventCategory(val displayName: String) {
    ONLINE_GOODS("굿즈"),
    ONLINE_COLLAB("온라인 콜라보"),
    OFFLINE_CONCERT("콘서트"),
    OFFLINE_COLLAB("오프라인 콜라보"),
    OFFLINE_POPUP("팝업"),
    TICKETING("티켓")
}

enum class HubCalendarEntryKind {
    HUB_EVENT,
    MEMBER_BIRTHDAY,
    GENERATION_ANNIVERSARY
}

enum class HubCalendarSpecialDayKind {
    MEMBER_BIRTHDAY,
    GENERATION_ANNIVERSARY
}

enum class HubEventParticipationMode(val displayName: String) {
    ONLINE("온라인"),
    OFFLINE("오프라인"),
    HYBRID("온/오프라인");

    val isOffline: Boolean
        get() = this == OFFLINE || this == HYBRID
}

enum class HubEventStatus(val displayName: String) {
    ANNOUNCED("공개"),
    UPCOMING("예정"),
    OPEN("진행 중"),
    CLOSING_SOON("마감 임박"),
    ENDED("종료"),
    CANCELLED("취소")
}

enum class HubEventSourceType {
    OFFICIAL,
    MEMBER,
    OFFICIAL_COLLAB
}

enum class HubEventImagePolicyState(val apiValue: String) {
    NONE("none"),
    OFFICIAL_RUNTIME_URL("official_runtime_url"),
    THIRD_PARTY_ALLOWED("third_party_allowed"),
    VERIFY_REQUIRED("verify_required"),
    BLOCKED("blocked")
}

data class HubEventImage(
    val policyState: HubEventImagePolicyState,
    val url: String? = null,
    val sourceLabel: String? = null,
    val sourceUrl: String? = null,
    val altText: String? = null,
)

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
    val liveStartedAt: Instant? = null,
    val liveTitle: String? = null,
    val liveViewerCount: Int? = null,
    val livePlatformUrl: String? = null,
    val liveLastCheckedAt: Instant? = null,
    val channelImageUrl: String? = null,
    val profileImageUrl: String? = null,
)

data class HubEvent(
    val id: String,
    val category: HubEventCategory,
    val participationMode: HubEventParticipationMode,
    val status: HubEventStatus,
    val title: String,
    val summary: String? = null,
    val memberId: String? = null,
    val generationId: String,
    val sourceUrl: String,
    val sourceLabel: String,
    val sourceType: HubEventSourceType,
    val announcedAt: Instant? = null,
    val startsAt: Instant? = null,
    val endsAt: Instant? = null,
    val purchaseUrl: String? = null,
    val ticketUrl: String? = null,
    val venueName: String? = null,
    val venueAddress: String? = null,
    val image: HubEventImage? = null,
    val notificationEligible: Boolean = true,
    val updatedAt: Instant
)

data class HubEventsSummary(
    val openCount: Int,
    val upcomingCount: Int,
    val closingSoonCount: Int,
    val preview: List<HubEvent>
)

data class HubCalendarEntry(
    val id: String,
    val eventId: String,
    val entryKind: HubCalendarEntryKind = HubCalendarEntryKind.HUB_EVENT,
    val specialDayKind: HubCalendarSpecialDayKind? = null,
    val specialDayLabel: String? = null,
    val title: String,
    val category: HubEventCategory,
    val status: HubEventStatus,
    val participationMode: HubEventParticipationMode,
    val generationId: String,
    val memberId: String? = null,
    val startsAt: Instant? = null,
    val endsAt: Instant? = null,
    val displayDate: String,
    val displayTimeText: String,
    val sourceLabel: String,
    val appDeepLink: String,
    val platformUrl: String?
)

data class HubCalendarDay(
    val date: String,
    val entries: List<HubCalendarEntry>
)

data class HubCalendarWidgetSnapshot(
    val generatedAt: Instant,
    val timezone: String,
    val entries: List<HubCalendarEntry>,
    val staleAfter: Instant
)

data class SongThumbnail(
    val url: String,
    val width: Int,
    val height: Int,
)

data class SongMemberSummary(
    val id: String,
    val nameKo: String,
    val nameEn: String? = null,
    val role: String? = null,
)

data class YoutubePremiereMetadata(
    val classification: String,
    val state: String,
    val scheduledStartAt: Instant? = null,
    val actualStartAt: Instant? = null,
    val actualEndAt: Instant? = null,
)

data class SongCatalogItem(
    val id: String,
    val youtubeVideoId: String,
    val title: String,
    val type: SongType,
    val memberId: String? = null,
    val memberName: String? = null,
    val generationId: String? = null,
    val generationName: String? = null,
    val sourceUrl: String? = null,
    val thumbnail: SongThumbnail? = null,
    val publishedAt: Instant = Instant.EPOCH,
    val thumbnailUrl: String? = thumbnail?.url,
    val duration: String? = null,
    val durationSeconds: Int? = null,
    val isInstrumental: Boolean = false,
    val specialFlags: List<String> = emptyList(),
    val classificationStatus: String? = null,
    val members: List<SongMemberSummary> = emptyList(),
    val youtubeUrl: String = sourceUrl ?: "https://www.youtube.com/watch?v=$youtubeVideoId",
    val sourcePlaylistId: String? = null,
    val premiere: YoutubePremiereMetadata? = null,
)

data class SongFilterCount(
    val id: String,
    val label: String,
    val generationId: String? = null,
    val count: Int,
)

data class SongFacetSummary(
    val total: Int,
    val original: Int,
    val cover: Int,
)

data class SongFacets(
    val summary: SongFacetSummary,
    val generationFilters: List<SongFilterCount>,
    val memberFilters: List<SongFilterCount>,
    val typeFilters: List<SongFilterCount>,
)

data class SongListResult(
    val items: List<SongCatalogItem>,
    val nextCursor: String? = null,
)

data class GenerationFilter(
    val id: String,
    val displayName: String,
    val notificationDefaultEnabled: Boolean
)

data class HistoryFilterOption(
    val id: String,
    val displayName: String
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
