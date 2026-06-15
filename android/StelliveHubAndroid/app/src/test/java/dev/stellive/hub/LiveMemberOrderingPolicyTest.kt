package dev.stellive.hub

import dev.stellive.hub.feature.home.LiveMemberOrderingPolicy
import dev.stellive.hub.feature.home.MockHubRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveMemberOrderingPolicyTest {
    @Test
    fun orderedLiveMembersUsesPriorityThenCatalogOrder() {
        val members = MockHubRepository().members
            .filter { it.chzzkChannelId != null }
            .take(4)
            .map { it.copy(isLive = true) }

        val ordered = LiveMemberOrderingPolicy.orderedLiveMembers(
            members = members,
            priorityMemberIds = listOf(members[2].id, members[0].id),
        )

        assertEquals(
            listOf(members[2].id, members[0].id, members[1].id, members[3].id),
            ordered.map { it.id },
        )
    }

    @Test
    fun homePreviewShowsTopThreeAndReportsOverflow() {
        val members = MockHubRepository().members
            .filter { it.chzzkChannelId != null }
            .take(4)
            .map { it.copy(isLive = true) }

        val preview = LiveMemberOrderingPolicy.homeLivePreview(members, priorityMemberIds = emptyList())

        assertEquals(members.take(3).map { it.id }, preview.map { it.id })
        assertTrue(LiveMemberOrderingPolicy.hasHomeLiveOverflow(members))
    }
}
