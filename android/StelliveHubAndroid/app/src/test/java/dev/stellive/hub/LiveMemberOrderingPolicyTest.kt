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

    @Test
    fun orderedChzzkTargetsIncludesAllMemberAndRepresentativeTargets() {
        val targets = LiveMemberOrderingPolicy.orderedChzzkTargets(
            members = MockHubRepository().members,
            priorityMemberIds = emptyList(),
        )

        assertEquals(11, targets.size)
        assertTrue(targets.any { it.id == "hanako-nana" })
        assertTrue(targets.any { it.id == "gangzi" })
    }

    @Test
    fun movedPriorityMovesVisibleMemberAndPreservesHiddenPriorityIds() {
        val members = MockHubRepository().members
            .filter { it.chzzkChannelId != null }
            .take(4)

        val reordered = LiveMemberOrderingPolicy.movedPriority(
            priorityMemberIds = listOf("hidden-member"),
            orderedMembers = members,
            fromIndex = 2,
            toIndex = 0,
        )

        assertEquals(
            listOf(members[2].id, members[0].id, members[1].id, members[3].id, "hidden-member"),
            reordered,
        )
    }

    @Test
    fun movedPriorityClampsTargetIndexAndNoopsWhenSameIndex() {
        val members = MockHubRepository().members
            .filter { it.chzzkChannelId != null }
            .take(4)

        val clamped = LiveMemberOrderingPolicy.movedPriority(
            priorityMemberIds = emptyList(),
            orderedMembers = members,
            fromIndex = 0,
            toIndex = 99,
        )
        val unchanged = LiveMemberOrderingPolicy.movedPriority(
            priorityMemberIds = listOf("hidden-member"),
            orderedMembers = members,
            fromIndex = 1,
            toIndex = 1,
        )

        assertEquals(
            listOf(members[1].id, members[2].id, members[3].id, members[0].id),
            clamped,
        )
        assertEquals(listOf("hidden-member"), unchanged)
    }
}
