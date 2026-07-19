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
    HUB_EVENT("굿즈/행사"),
    NAVER_CAFE("Naver Cafe")
}

enum class NotificationEventType(val wireName: String, val displayName: String) {
    CAFE_POST("cafe_post", "카페 게시글"),
    CHZZK_LIVE_STARTED("chzzk_live_started", "CHZZK 방송 시작"),
    CHZZK_LIVE_ENDED("chzzk_live_ended", "CHZZK 방송 종료"),
    CHZZK_CHAT("chzzk_chat", "CHZZK 채팅"),
    CHZZK_SUBSCRIPTION("chzzk_subscription", "CHZZK 구독"),
    YOUTUBE_UPLOAD("youtube_upload", "YouTube 업로드"),
    YOUTUBE_LIVE_SCHEDULED("youtube_live_scheduled", "YouTube 라이브 예정"),
    YOUTUBE_LIVE_STARTED("youtube_live_started", "YouTube 라이브 시작"),
    YOUTUBE_LIVE_ENDED("youtube_live_ended", "YouTube 라이브 종료"),
    OFFICIAL_YOUTUBE_UPLOAD("official_youtube_upload", "공식 YouTube 업로드"),
    EVENT_ANNOUNCED("event_announced", "굿즈/행사 공개"),
    EVENT_SALES_OPEN("event_sales_open", "예약/판매 시작"),
    EVENT_DEADLINE_SOON("event_deadline_soon", "마감 임박"),
    EVENT_MILESTONE_DUE("event_milestone_due", "굿즈/행사 마일스톤"),
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

enum class HubEventScheduleMode { SINGLE_WINDOW, TIMELINE }

enum class HubEventScheduleKind {
    MAIN_WINDOW,
    ANNOUNCEMENT,
    SALES_OPEN,
    TICKET_OPEN,
    CONTENT_REVEAL,
    RELEASE,
    DEADLINE,
    CUSTOM,
}

enum class HubEventTimePrecision { DATE, DATETIME }

enum class HubEventLinkKind {
    SOURCE,
    PURCHASE,
    TICKET,
    RESERVATION,
    CONTENT,
    VIDEO,
    MAP,
    CUSTOM,
}

data class HubEventLink(
    val id: String,
    val kind: HubEventLinkKind,
    val label: String? = null,
    val url: String,
    val sortOrder: Int = 0,
    val createdAt: Instant? = null,
    val updatedAt: Instant? = null,
)

data class HubEventScheduleItem(
    val id: String,
    val kind: HubEventScheduleKind,
    val title: String? = null,
    val label: String,
    val description: String? = null,
    val startsAt: Instant,
    val endsAt: Instant? = null,
    val timePrecision: HubEventTimePrecision = HubEventTimePrecision.DATETIME,
    val timezone: String = "Asia/Seoul",
    val actionUrl: String? = null,
    val sourceUrl: String? = null,
    val sourceLabel: String? = null,
    val links: List<HubEventLink> = emptyList(),
    val notificationEligible: Boolean = true,
    val isPrimary: Boolean = false,
    val sortOrder: Int = 0,
    val cancelledAt: Instant? = null,
    val createdAt: Instant? = null,
)

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
    val isLive: Boolean = false,
    val notificationEnabled: Boolean = true,
    val realtimeEnabled: Boolean = false,
    val liveStartedAt: Instant? = null,
    val liveTitle: String? = null,
    val liveCategory: String? = null,
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
    val scheduleMode: HubEventScheduleMode = HubEventScheduleMode.SINGLE_WINDOW,
    val scheduleItems: List<HubEventScheduleItem> = emptyList(),
    val links: List<HubEventLink> = emptyList(),
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
    val scheduleItemId: String? = null,
    val scheduleKind: HubEventScheduleKind? = null,
    val scheduleLabel: String? = null,
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

data class SongSourcePlaylist(
    val youtubePlaylistId: String,
    val title: String,
    val type: String,
    val youtubeUrl: String,
    val isPrimary: Boolean,
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
    val catalogAddedAt: Instant? = null,
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
    val sourcePlaylists: List<SongSourcePlaylist> = emptyList(),
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
    val serverTime: Instant? = null,
    val isAuthoritative: Boolean = false,
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
    val serviceAnnouncementsEnabled: Boolean = true,
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
            "최대한 실시간으로 알림 받기는 알림을 빠르게 보내도록 시도하는 기능입니다. 플랫폼, 운영체제 또는 네트워크 상태에 따라 늦어질 수 있습니다.",
            "배터리와 데이터 사용량이 늘어날 수 있습니다.",
            "사용자가 꺼둔 알림과 방해 금지 시간, 차단 키워드는 그대로 적용됩니다."
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

enum class ServiceAnnouncementType(val apiValue: String, val displayName: String) {
    GENERAL("general", "일반 안내"), INCIDENT("incident", "장애 및 복구"),
    MAINTENANCE("maintenance", "예정된 점검"), VERSION_UPDATE("version_update", "앱 업데이트");
}

enum class ServiceAnnouncementSeverity(val apiValue: String, val displayName: String) {
    INFO("info", "정보"), IMPORTANT("important", "중요"), CRITICAL("critical", "긴급");
}

data class ServiceAnnouncement(
    val id: String,
    val type: ServiceAnnouncementType,
    val severity: ServiceAnnouncementSeverity,
    val title: String,
    val summary: String,
    val body: String,
    val isPinned: Boolean,
    val targetPlatforms: List<String>,
    val minimumAppVersion: String? = null,
    val maximumAppVersion: String? = null,
    val appDeepLink: String? = null,
    val externalUrl: String? = null,
    val actionLabel: String? = null,
    val publishedAt: java.time.Instant,
    val expiresAt: java.time.Instant? = null,
    val resolvedAt: java.time.Instant? = null,
    val archivedAt: java.time.Instant? = null,
    val attentionRevision: Int,
    val revision: Int,
    val updatedAt: java.time.Instant,
)

data class AnnouncementSummaryItem(
    val id: String,
    val attentionRevision: Int,
    val publishedAt: java.time.Instant,
    val severity: ServiceAnnouncementSeverity,
    val isPinned: Boolean,
)

data class AnnouncementsSummary(
    val activeCount: Int = 0,
    val items: List<AnnouncementSummaryItem> = emptyList(),
    val pinned: ServiceAnnouncement? = null,
    val generatedAt: java.time.Instant? = null,
)

data class ServiceAnnouncementListResult(
    val items: List<ServiceAnnouncement>,
    val nextCursor: String? = null,
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
    NotificationPlatform.HUB_EVENT to true,
    NotificationPlatform.NAVER_CAFE to false
)

private fun defaultEventTypeEnabled(): Map<NotificationEventType, Boolean> = linkedMapOf(
    NotificationEventType.CAFE_POST to false,
    NotificationEventType.CHZZK_LIVE_STARTED to true,
    NotificationEventType.CHZZK_LIVE_ENDED to true,
    NotificationEventType.CHZZK_CHAT to false,
    NotificationEventType.CHZZK_SUBSCRIPTION to true,
    NotificationEventType.YOUTUBE_UPLOAD to true,
    NotificationEventType.YOUTUBE_LIVE_SCHEDULED to false,
    NotificationEventType.YOUTUBE_LIVE_STARTED to false,
    NotificationEventType.YOUTUBE_LIVE_ENDED to false,
    NotificationEventType.OFFICIAL_YOUTUBE_UPLOAD to true,
    NotificationEventType.EVENT_ANNOUNCED to true,
    NotificationEventType.EVENT_SALES_OPEN to true,
    NotificationEventType.EVENT_DEADLINE_SOON to true,
    NotificationEventType.EVENT_MILESTONE_DUE to true,
    NotificationEventType.EVENT_UPDATED to false,
    NotificationEventType.EVENT_CANCELLED to true
)

private fun defaultCombinationPreferences(): List<CombinationPreference> = listOf(
    CombinationPreference("generation_platform", NotificationPreferenceScope.GENERATION_PLATFORM, "분류별 플랫폼 설정"),
    CombinationPreference("generation_event_type", NotificationPreferenceScope.GENERATION_EVENT_TYPE, "분류별 알림 종류 설정"),
    CombinationPreference("member_platform", NotificationPreferenceScope.MEMBER_PLATFORM, "개별 대상의 플랫폼 설정"),
    CombinationPreference("member_event_type", NotificationPreferenceScope.MEMBER_EVENT_TYPE, "개별 대상의 알림 종류 설정")
)
