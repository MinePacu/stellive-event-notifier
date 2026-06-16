package dev.stellive.hub.feature.home

import dev.stellive.hub.core.model.CatalogRole
import dev.stellive.hub.core.model.HubMember

object LiveMemberOrderingPolicy {
    private const val HOME_PREVIEW_LIMIT = 3

    fun orderedLiveMembers(
        members: List<HubMember>,
        priorityMemberIds: List<String>,
    ): List<HubMember> = orderedMembers(
        members = members.filter { it.catalogRole != CatalogRole.OFFICIAL_CHANNEL && it.isLive },
        priorityMemberIds = priorityMemberIds,
    )

    fun orderedChzzkTargets(
        members: List<HubMember>,
        priorityMemberIds: List<String>,
    ): List<HubMember> = orderedMembers(
        members = members.filter { it.catalogRole != CatalogRole.OFFICIAL_CHANNEL && it.chzzkChannelId != null },
        priorityMemberIds = priorityMemberIds,
    )

    fun homeLivePreview(
        members: List<HubMember>,
        priorityMemberIds: List<String>,
    ): List<HubMember> = orderedLiveMembers(members, priorityMemberIds).take(HOME_PREVIEW_LIMIT)

    fun hasHomeLiveOverflow(members: List<HubMember>): Boolean =
        members.count { it.catalogRole != CatalogRole.OFFICIAL_CHANNEL && it.isLive } > HOME_PREVIEW_LIMIT

    fun movePriority(
        priorityMemberIds: List<String>,
        orderedMembers: List<HubMember>,
        memberId: String,
        offset: Int,
    ): List<String> {
        val ids = orderedMembers.map { it.id }.toMutableList()
        val currentIndex = ids.indexOf(memberId)
        if (currentIndex == -1) return priorityMemberIds
        return movedPriority(
            priorityMemberIds = priorityMemberIds,
            orderedMembers = orderedMembers,
            fromIndex = currentIndex,
            toIndex = currentIndex + offset,
        )
    }

    fun movedPriority(
        priorityMemberIds: List<String>,
        orderedMembers: List<HubMember>,
        fromIndex: Int,
        toIndex: Int,
    ): List<String> {
        if (orderedMembers.isEmpty()) return priorityMemberIds
        val visibleIds = orderedMembers.map { it.id }
        val safeFromIndex = fromIndex.coerceIn(0, visibleIds.lastIndex)
        val safeToIndex = toIndex.coerceIn(0, visibleIds.lastIndex)
        if (safeFromIndex == safeToIndex) return priorityMemberIds

        val reorderedVisibleIds = visibleIds.toMutableList()
        val movedId = reorderedVisibleIds.removeAt(safeFromIndex)
        reorderedVisibleIds.add(safeToIndex, movedId)

        val visibleIdSet = visibleIds.toSet()
        val hiddenIds = priorityMemberIds.filter { it !in visibleIdSet }
        return reorderedVisibleIds + hiddenIds
    }

    private fun orderedMembers(
        members: List<HubMember>,
        priorityMemberIds: List<String>,
    ): List<HubMember> {
        if (priorityMemberIds.isEmpty()) return members
        val fallbackOrder = members.mapIndexed { index, member -> member.id to index }.toMap()
        val priorityOrder = priorityMemberIds.mapIndexed { index, memberId -> memberId to index }.toMap()
        return members.sortedWith(
            compareBy<HubMember>(
                { priorityOrder[it.id] ?: Int.MAX_VALUE },
                { fallbackOrder[it.id] ?: Int.MAX_VALUE },
            ),
        )
    }
}
