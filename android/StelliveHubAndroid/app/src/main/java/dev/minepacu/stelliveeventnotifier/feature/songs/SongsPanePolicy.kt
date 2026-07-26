package dev.minepacu.stelliveeventnotifier.feature.songs

import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubAdaptiveSpec

enum class SongMemberSelectionMode {
    NAVIGATE_TO_MEMBER_FILTER,
    UPDATE_INLINE_FILTER,
}

object SongsPanePolicy {
    fun shouldUseTwoPane(adaptiveSpec: HubAdaptiveSpec): Boolean =
        adaptiveSpec.useLargeScreenLayout

    fun shouldUseFoldAwarePane(adaptiveSpec: HubAdaptiveSpec): Boolean =
        adaptiveSpec.useFoldAwareTwoPane

    fun shouldShowTopBarSearchAction(adaptiveSpec: HubAdaptiveSpec): Boolean =
        !shouldUseTwoPane(adaptiveSpec)

    fun memberSelectionMode(adaptiveSpec: HubAdaptiveSpec): SongMemberSelectionMode =
        if (shouldUseTwoPane(adaptiveSpec)) {
            SongMemberSelectionMode.UPDATE_INLINE_FILTER
        } else {
            SongMemberSelectionMode.NAVIGATE_TO_MEMBER_FILTER
        }

    fun shouldEnablePullToRefresh(
        isSongsScreen: Boolean,
        isTwoPaneScreen: Boolean,
        otherwiseRefreshable: Boolean,
    ): Boolean =
        isSongsScreen || (!isTwoPaneScreen && otherwiseRefreshable)

    fun shouldBlockTwoPanePullToRefresh(canScrollUpStates: List<Boolean>): Boolean =
        canScrollUpStates.any { it }
}
