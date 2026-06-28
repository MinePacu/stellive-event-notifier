package dev.stellive.hub.core.network

data class MobileConfigDto(
    val unofficialProject: Boolean,
    val catalogVersion: String,
    val officialYoutubeLiveExcluded: Boolean,
    val xNotificationsEnabled: Boolean,
    val xDisabledReason: String? = null,
    val hubCalendarEnabled: Boolean,
    val foregroundRealtimeEnabled: Boolean? = null,
)

data class BootstrapDeviceDto(
    val deviceId: String,
    val registered: Boolean,
    val tokenStatus: String? = null,
)

data class BootstrapCatalogDto(
    val generations: List<GenerationDto> = emptyList(),
    val members: List<MemberDto> = emptyList(),
)

data class GenerationDto(
    val id: String,
    val displayName: String,
    val unitName: String? = null,
    val sortOrder: Int,
    val type: String,
    val notificationDefaultEnabled: Boolean,
)

data class MemberDto(
    val id: String,
    val koreanName: String,
    val englishName: String,
    val generationId: String,
    val generationName: String,
    val unitName: String,
    val catalogRole: String,
    val activeStatus: String,
    val roleLabel: String? = null,
    val isPerson: Boolean,
    val profileImageUrl: String? = null,
    val platforms: Map<String, Any?> = emptyMap(),
    val supportedEventTypes: List<String> = emptyList(),
)

data class PreferenceDto(
    val deviceId: String,
    val scope: String,
    val generationId: String? = null,
    val memberId: String? = null,
    val source: String? = null,
    val eventType: String? = null,
    val enabled: Boolean,
    val explicitOverride: Boolean,
    val tapAction: String,
    val deliveryMode: String,
    val realtimePreference: String? = null,
    val updatedAt: String,
)

data class LiveStatusDto(
    val memberId: String,
    val generationId: String,
    val platform: String? = null,
    val isLive: Boolean,
    val title: String? = null,
    val viewerCount: Int? = null,
    val startedAt: String? = null,
    val channelImageUrl: String? = null,
    val platformUrl: String? = null,
    val lastCheckedAt: String,
    val sourceVerificationState: String,
)

data class HubEventsSummaryDto(
    val openCount: Int,
    val upcomingCount: Int,
    val closingSoonCount: Int,
    val preview: List<HubEventDto> = emptyList(),
)

data class HubEventDto(
    val id: String,
    val category: String? = null,
    val participationMode: String? = null,
    val status: String? = null,
    val title: String,
    val summary: String? = null,
    val memberId: String? = null,
    val generationId: String? = null,
    val sourceUrl: String? = null,
    val sourceLabel: String? = null,
    val sourceType: String? = null,
    val announcedAt: String? = null,
    val startsAt: String? = null,
    val endsAt: String? = null,
    val purchaseUrl: String? = null,
    val ticketUrl: String? = null,
    val venueName: String? = null,
    val venueAddress: String? = null,
    val image: HubEventImageDto? = null,
    val notificationEligible: Boolean = true,
    val updatedAt: String? = null,
)

data class HubEventImageDto(
    val policyState: String,
    val url: String? = null,
    val sourceLabel: String? = null,
    val sourceUrl: String? = null,
    val altText: String? = null,
)

data class HubEventsListResponseDto(
    val items: List<HubEventDto> = emptyList(),
    val nextCursor: String? = null,
)

data class HubCalendarResponseDto(
    val timezone: String,
    val generatedAt: String? = null,
    val days: List<HubCalendarDayDto> = emptyList(),
)

data class HubCalendarDayDto(
    val date: String,
    val entries: List<HubCalendarEntryDto> = emptyList(),
)

data class HubCalendarEntryDto(
    val id: String,
    val eventId: String? = null,
    val entryKind: String? = null,
    val specialDayKind: String? = null,
    val specialDayLabel: String? = null,
    val title: String,
    val category: String? = null,
    val status: String? = null,
    val participationMode: String? = null,
    val generationId: String? = null,
    val memberId: String? = null,
    val startsAt: String? = null,
    val endsAt: String? = null,
    val displayDate: String,
    val displayTimeText: String,
    val sourceLabel: String,
    val appDeepLink: String? = null,
    val platformUrl: String? = null,
)

data class SongThumbnailDto(
    val url: String,
    val width: Int,
    val height: Int,
)

data class YoutubePremiereMetadataDto(
    val classification: String,
    val state: String,
    val scheduledStartAt: String? = null,
    val actualStartAt: String? = null,
    val actualEndAt: String? = null,
)

data class SongCatalogItemDto(
    val id: String,
    val youtubeVideoId: String,
    val title: String,
    val memberId: String,
    val memberName: String,
    val generationId: String,
    val generationName: String,
    val type: String,
    val sourceUrl: String,
    val thumbnail: SongThumbnailDto? = null,
    val publishedAt: String,
    val premiere: YoutubePremiereMetadataDto? = null,
)

data class SongListResponseDto(
    val items: List<SongCatalogItemDto> = emptyList(),
    val nextCursor: String? = null,
)

data class MusicMemberSummaryDto(
    val id: String,
    val nameKo: String,
    val nameEn: String? = null,
    val role: String? = null,
)

data class MusicCatalogItemDto(
    val id: String,
    val youtubeVideoId: String,
    val title: String,
    val type: String,
    val publishedAt: String? = null,
    val thumbnailUrl: String? = null,
    val duration: String? = null,
    val durationSeconds: Int? = null,
    val isInstrumental: Boolean = false,
    val specialFlags: List<String> = emptyList(),
    val classificationStatus: String? = null,
    val members: List<MusicMemberSummaryDto> = emptyList(),
    val youtubeUrl: String,
    val sourcePlaylistId: String? = null,
    val premiere: YoutubePremiereMetadataDto? = null,
)

data class MusicListResponseDto(
    val items: List<MusicCatalogItemDto> = emptyList(),
    val nextCursor: String? = null,
)

data class SongFilterCountDto(
    val id: String,
    val label: String,
    val generationId: String? = null,
    val count: Int,
)

data class SongFacetSummaryDto(
    val total: Int,
    val original: Int,
    val cover: Int,
)

data class SongFacetsResponseDto(
    val summary: SongFacetSummaryDto,
    val generationFilters: List<SongFilterCountDto> = emptyList(),
    val memberFilters: List<SongFilterCountDto> = emptyList(),
    val typeFilters: List<SongFilterCountDto> = emptyList(),
)

data class HubCalendarWidgetSnapshotDto(
    val timezone: String,
    val generatedAt: String,
    val items: List<Map<String, Any?>> = emptyList(),
)

data class BootstrapResponseDto(
    val config: MobileConfigDto,
    val device: BootstrapDeviceDto? = null,
    val catalog: BootstrapCatalogDto? = null,
    val generations: List<GenerationDto> = emptyList(),
    val members: List<MemberDto> = emptyList(),
    val preferences: List<PreferenceDto> = emptyList(),
    val liveStatus: List<LiveStatusDto> = emptyList(),
    val hubEventsSummary: HubEventsSummaryDto? = null,
    val hubCalendarWidgetSnapshot: HubCalendarWidgetSnapshotDto? = null,
    val serverTime: String? = null,
) {
    val effectiveCatalog: BootstrapCatalogDto
        get() = catalog ?: BootstrapCatalogDto(generations = generations, members = members)
}

data class RegisterDeviceRequestDto(
    val deviceId: String? = null,
    val platform: String = "android",
    val appVersion: String? = null,
    val locale: String? = null,
    val timezone: String? = null,
    val installationId: String? = null,
)

data class RegisterDeviceResponseDto(
    val deviceId: String,
    val registered: Boolean,
    val serverTime: String,
)

data class UpdateDeviceTokenRequestDto(
    val deviceId: String,
    val platform: String = "android",
    val provider: String = "fcm",
    val token: String,
    val appVersion: String? = null,
    val locale: String? = null,
    val timezone: String? = null,
)

data class UpdateDeviceTokenResponseDto(
    val updated: Boolean,
    val tokenStatus: String,
    val serverTime: String,
)

data class PreferencesResponseDto(
    val deviceId: String,
    val preferences: List<PreferenceDto>,
    val updatedAt: String,
    val conflict: String? = null,
)

data class UpdatePreferencesRequestDto(
    val deviceId: String,
    val preferences: List<PreferenceDto>,
    val clientUpdatedAt: String,
)

data class UpdatePreferencesResponseDto(
    val deviceId: String,
    val preferences: List<PreferenceDto>,
    val updatedAt: String,
    val conflict: String? = null,
)
