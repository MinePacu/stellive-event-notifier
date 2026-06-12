package dev.stellive.hub.feature.home

import dev.stellive.hub.core.model.GenerationFilter
import dev.stellive.hub.core.model.HubEventsSummary
import dev.stellive.hub.core.model.HubMember
import dev.stellive.hub.core.model.NotificationSettingState

data class HubDataState(
    val filters: List<GenerationFilter>,
    val members: List<HubMember>,
    val settings: NotificationSettingState,
    val hubEventsSummary: HubEventsSummary,
)

interface HubRepository {
    suspend fun bootstrap(): HubDataState
    suspend fun refresh(): HubDataState = bootstrap()
    suspend fun updatePreferences(settings: NotificationSettingState): HubDataState
}
