package dev.minepacu.stelliveeventnotifier.feature.home

import dev.minepacu.stelliveeventnotifier.core.model.GenerationFilter
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarDay
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventsSummary
import dev.minepacu.stelliveeventnotifier.core.model.AnnouncementsSummary
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncement
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncementListResult
import dev.minepacu.stelliveeventnotifier.core.model.HubMember
import dev.minepacu.stelliveeventnotifier.core.model.KeywordFilterState
import dev.minepacu.stelliveeventnotifier.core.model.NotificationEventType
import dev.minepacu.stelliveeventnotifier.core.model.NotificationPlatform
import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.core.model.QuietHoursState
import dev.minepacu.stelliveeventnotifier.core.model.SongFacets
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.core.model.SongListResult
import dev.minepacu.stelliveeventnotifier.core.network.HubNetworkResult
import java.time.LocalDate

data class HubDataState(
    val filters: List<GenerationFilter>,
    val members: List<HubMember>,
    val settings: NotificationSettingState,
    val hubEventsSummary: HubEventsSummary,
    val announcementsSummary: AnnouncementsSummary = AnnouncementsSummary(),
    val liveStatusSourceLabel: String = "앱 내 목업",
)

/**
 * The server-synced subset of the preference rules the client owns. Null or empty
 * members mean the server holds no data for them, so the local values are kept.
 */
data class RemoteNotificationPreferences(
    val globalEnabled: Boolean,
    val serviceAnnouncementsEnabled: Boolean,
    val quietHours: QuietHoursState? = null,
    val keywordFilters: KeywordFilterState? = null,
    val maxNotificationsPerMinute: Int? = null,
    val generationEnabled: Map<String, Boolean> = emptyMap(),
    val memberEnabled: Map<String, Boolean> = emptyMap(),
    val platformEnabled: Map<NotificationPlatform, Boolean> = emptyMap(),
    val eventTypeEnabled: Map<NotificationEventType, Boolean> = emptyMap(),
) {
    /** False for a server that only holds a global rule, as an older app build or a new device leaves it. */
    val hasOwnedScopedRules: Boolean
        get() = generationEnabled.isNotEmpty() || memberEnabled.isNotEmpty() ||
            platformEnabled.isNotEmpty() || eventTypeEnabled.isNotEmpty()
}

sealed interface PreferenceSyncResult {
    /** The server accepted the local settings. */
    object Pushed : PreferenceSyncResult

    /** The server held a newer snapshot, so the local settings were not applied; [remote] is its client-owned rules. */
    data class ServerNewer(val remote: RemoteNotificationPreferences?) : PreferenceSyncResult

    /** The settings did not reach the server (no device id, network error, rate limit, ...). */
    object Failed : PreferenceSyncResult
}

/** [isFresh] is true only when [event] was just parsed from a successful server detail response (not cache/fallback). */
data class HubEventDetailResult(val event: HubEvent?, val isFresh: Boolean)

interface HubRepository {
    suspend fun bootstrap(): HubDataState
    suspend fun refresh(): HubDataState = bootstrap()
    /** Throws [PreferenceSyncConflictException] after two consecutive conflicts. */
    suspend fun updatePreferences(settings: NotificationSettingState): PreferenceSyncResult

    /** Success(null) means the server has no global rule yet. */
    suspend fun notificationPreferences(): HubNetworkResult<RemoteNotificationPreferences?>
    suspend fun hubEvents(
        filterId: String = "all",
        from: LocalDate? = null,
        to: LocalDate? = null,
    ): List<HubEvent>
    suspend fun hubEventDetail(id: String): HubEvent?
    /** Like [hubEventDetail] but also reports whether the event came from a successful (HTTP 200) detail fetch. */
    suspend fun hubEventDetailResult(id: String): HubEventDetailResult =
        HubEventDetailResult(hubEventDetail(id), isFresh = false)
    suspend fun announcements(cursor: String? = null): ServiceAnnouncementListResult = ServiceAnnouncementListResult(emptyList())
    suspend fun announcementDetail(id: String): ServiceAnnouncement? = null
    suspend fun hubCalendarDays(from: LocalDate, to: LocalDate, timezone: String): List<HubCalendarDay>
    suspend fun songs(
        generationId: String? = null,
        memberId: String? = null,
        type: String? = null,
        query: String? = null,
        cursor: String? = null,
        forceRefresh: Boolean = false,
    ): SongListResult
    suspend fun recentSongs(limit: Int = 5): List<SongCatalogItem> =
        songs().items.take(limit)
    suspend fun songDetail(id: String, fallback: SongCatalogItem): SongCatalogItem = fallback
    suspend fun songFacets(
        generationId: String? = null,
        memberId: String? = null,
        type: String? = null,
        query: String? = null,
    ): SongFacets
}
