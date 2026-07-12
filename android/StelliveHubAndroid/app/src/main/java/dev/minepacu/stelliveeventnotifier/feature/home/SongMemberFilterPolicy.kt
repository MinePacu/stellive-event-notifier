package dev.minepacu.stelliveeventnotifier.feature.home

import dev.minepacu.stelliveeventnotifier.core.model.ActiveStatus
import dev.minepacu.stelliveeventnotifier.core.model.CatalogRole
import dev.minepacu.stelliveeventnotifier.core.model.HubMember
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem

enum class SongMemberMatchMode { ANY, ALL }
enum class SongParticipation { ANY, SOLO, COLLABORATION }

data class SongMemberFilterState(
    val selectedMemberIds: Set<String> = emptySet(),
    val matchMode: SongMemberMatchMode = SongMemberMatchMode.ANY,
    val participation: SongParticipation = SongParticipation.ANY,
) {
    fun normalized(validMemberIds: Set<String>? = null): SongMemberFilterState {
        val ids = selectedMemberIds.map(String::trim).filter(String::isNotEmpty).toSet()
            .let { values -> validMemberIds?.let(values::intersect) ?: values }
        return copy(
            selectedMemberIds = ids,
            matchMode = if (ids.size < 2 || participation == SongParticipation.SOLO) SongMemberMatchMode.ANY else matchMode,
        )
    }

    companion object {
        fun migrate(selectedMemberId: String?, validMemberIds: Set<String>): SongMemberFilterState {
            val id = selectedMemberId?.trim().orEmpty()
            return SongMemberFilterState(selectedMemberIds = if (id.isNotEmpty() && id != "all" && id in validMemberIds) setOf(id) else emptySet())
        }
    }
}

object SongMemberFilterPolicy {
    fun selectableMembers(members: List<HubMember>): List<HubMember> = members.filter {
        it.catalogRole == CatalogRole.MEMBER && it.generationId in setOf("gen1", "gen2", "gen3") &&
            it.activeStatus in setOf(ActiveStatus.ACTIVE, ActiveStatus.UPCOMING)
    }

    fun participantIds(song: SongCatalogItem): Set<String> {
        val linked = song.members.map { it.id.trim() }.filter(String::isNotEmpty).toSet()
        if (linked.isNotEmpty()) return linked
        return song.memberId?.trim()?.takeIf(String::isNotEmpty)?.let(::setOf) ?: emptySet()
    }

    fun matches(song: SongCatalogItem, rawState: SongMemberFilterState): Boolean {
        val state = rawState.normalized()
        val participants = participantIds(song)
        val memberMatches = state.selectedMemberIds.isEmpty() || when (state.matchMode) {
            SongMemberMatchMode.ANY -> state.selectedMemberIds.any(participants::contains)
            SongMemberMatchMode.ALL -> participants.containsAll(state.selectedMemberIds)
        }
        val participationMatches = when (state.participation) {
            SongParticipation.ANY -> true
            SongParticipation.SOLO -> participants.size == 1
            SongParticipation.COLLABORATION -> participants.size >= 2
        }
        return memberMatches && participationMatches
    }

    fun generationMemberIds(members: List<HubMember>, generationId: String): Set<String> =
        selectableMembers(members).filter { it.generationId == generationId }.map { it.id }.toSet()

    fun generationPreset(members: List<HubMember>, generationId: String) = SongMemberFilterState(
        selectedMemberIds = generationMemberIds(members, generationId),
        matchMode = SongMemberMatchMode.ALL,
    ).normalized()

    fun generationPresetLabel(members: List<HubMember>, state: SongMemberFilterState): String? =
        listOf("gen1" to "1기생", "gen2" to "2기생", "gen3" to "3기생").firstNotNullOfOrNull { (id, label) ->
            generationMemberIds(members, id).takeIf { it.isNotEmpty() && it == state.normalized().selectedMemberIds }?.let { "$label 전원 참여" }
        }

    fun summary(members: List<HubMember>, rawState: SongMemberFilterState): String {
        val state = rawState.normalized()
        generationPresetLabel(members, state)?.let { preset ->
            return if (state.participation == SongParticipation.ANY) preset else "$preset · ${participationLabel(state.participation)}"
        }
        if (state.selectedMemberIds.isEmpty() && state.participation == SongParticipation.ANY) return "멤버 전체"
        val member = if (state.selectedMemberIds.isEmpty()) "멤버 전체" else "선택 ${state.selectedMemberIds.size}명" +
            if (state.selectedMemberIds.size >= 2) " · ${if (state.matchMode == SongMemberMatchMode.ALL) "모두 참여" else "한 명 이상"}" else ""
        return if (state.participation == SongParticipation.ANY) member else "$member · ${participationLabel(state.participation)}"
    }

    fun emptyMessage(members: List<HubMember>, rawState: SongMemberFilterState): String {
        val state = rawState.normalized()
        if (generationPresetLabel(members, state) != null) return "선택한 기수 전원이 참여한 노래가 없습니다."
        return when (state.participation) {
            SongParticipation.SOLO -> "조건에 맞는 솔로곡이 없습니다."
            SongParticipation.COLLABORATION -> "조건에 맞는 콜라보곡이 없습니다."
            SongParticipation.ANY -> if (state.matchMode == SongMemberMatchMode.ALL && state.selectedMemberIds.size >= 2)
                "선택한 멤버가 모두 참여한 노래가 없습니다." else "선택한 멤버 중 한 명 이상 참여한 노래가 없습니다."
        }
    }

    private fun participationLabel(value: SongParticipation) = when (value) {
        SongParticipation.ANY -> "전체"
        SongParticipation.SOLO -> "솔로"
        SongParticipation.COLLABORATION -> "콜라보"
    }
}
