package dev.minepacu.stelliveeventnotifier.feature.home

import dev.minepacu.stelliveeventnotifier.core.model.GenerationFilter
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarDay
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventsSummary
import dev.minepacu.stelliveeventnotifier.core.model.AnnouncementsSummary
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncement
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncementListResult
import dev.minepacu.stelliveeventnotifier.core.model.HubMember
import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.core.model.SongFacets
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.core.model.SongListResult
import java.time.LocalDate

data class HubDataState(
    val filters: List<GenerationFilter>,
    val members: List<HubMember>,
    val settings: NotificationSettingState,
    val hubEventsSummary: HubEventsSummary,
    val announcementsSummary: AnnouncementsSummary = AnnouncementsSummary(),
    val liveStatusSourceLabel: String = "앱 내 목업",
)

interface HubRepository {
    suspend fun bootstrap(): HubDataState
    suspend fun refresh(): HubDataState = bootstrap()
    suspend fun updatePreferences(settings: NotificationSettingState): HubDataState
    suspend fun hubEvents(
        filterId: String = "all",
        from: LocalDate? = null,
        to: LocalDate? = null,
    ): List<HubEvent>
    suspend fun hubEventDetail(id: String): HubEvent?
    suspend fun announcements(cursor: String? = null): ServiceAnnouncementListResult = ServiceAnnouncementListResult(emptyList())
    suspend fun announcementDetail(id: String): ServiceAnnouncement? = null
    suspend fun hubCalendarDays(from: LocalDate, to: LocalDate, timezone: String): List<HubCalendarDay>
    suspend fun songs(
        generationId: String? = null,
        memberId: String? = null,
        type: String? = null,
        query: String? = null,
        cursor: String? = null,
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
