package dev.stellive.hub.feature.home

import dev.stellive.hub.core.model.GenerationFilter
import dev.stellive.hub.core.model.HubCalendarDay
import dev.stellive.hub.core.model.HubEvent
import dev.stellive.hub.core.model.HubEventsSummary
import dev.stellive.hub.core.model.HubMember
import dev.stellive.hub.core.model.NotificationSettingState
import dev.stellive.hub.core.model.SongFacets
import dev.stellive.hub.core.model.SongCatalogItem
import dev.stellive.hub.core.model.SongListResult
import java.time.LocalDate

data class HubDataState(
    val filters: List<GenerationFilter>,
    val members: List<HubMember>,
    val settings: NotificationSettingState,
    val hubEventsSummary: HubEventsSummary,
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
    suspend fun hubCalendarDays(from: LocalDate, to: LocalDate, timezone: String): List<HubCalendarDay>
    suspend fun songs(
        generationId: String? = null,
        memberId: String? = null,
        type: String? = null,
        query: String? = null,
        cursor: String? = null,
    ): SongListResult
    suspend fun recentCoverSongs(limit: Int = 5): List<SongCatalogItem> =
        songs(type = "cover").items.take(limit)
    suspend fun songFacets(
        generationId: String? = null,
        memberId: String? = null,
        type: String? = null,
        query: String? = null,
    ): SongFacets
}
