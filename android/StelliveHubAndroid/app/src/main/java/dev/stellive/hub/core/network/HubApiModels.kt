package dev.stellive.hub.core.network

data class MobileConfigDto(
    val unofficialProject: Boolean,
    val catalogVersion: String,
    val officialYoutubeLiveExcluded: Boolean,
    val xNotificationsEnabled: Boolean,
    val xDisabledReason: String? = null,
    val hubCalendarEnabled: Boolean,
    val foregroundRealtimeEnabled: Boolean,
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
    val unitName: String,
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
    val platform: String,
    val isLive: Boolean,
    val title: String? = null,
    val viewerCount: Int? = null,
    val startedAt: String? = null,
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
    val title: String,
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
    val preferences: List<PreferenceDto> = emptyList(),
    val liveStatus: List<LiveStatusDto> = emptyList(),
    val hubEventsSummary: HubEventsSummaryDto? = null,
    val hubCalendarWidgetSnapshot: HubCalendarWidgetSnapshotDto? = null,
    val serverTime: String,
)

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
