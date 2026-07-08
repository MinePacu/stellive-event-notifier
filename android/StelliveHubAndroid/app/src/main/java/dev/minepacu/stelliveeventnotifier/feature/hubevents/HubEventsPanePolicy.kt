package dev.minepacu.stelliveeventnotifier.feature.hubevents

import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubAdaptiveSpec

enum class GoodsEventSelectionMode {
    NAVIGATE_TO_DETAIL,
    UPDATE_INLINE_DETAIL,
}

object HubEventsPanePolicy {
    fun shouldUseTwoPane(adaptiveSpec: HubAdaptiveSpec): Boolean =
        adaptiveSpec.useLargeScreenLayout

    fun shouldUseFoldAwarePane(adaptiveSpec: HubAdaptiveSpec): Boolean =
        adaptiveSpec.useFoldAwareTwoPane

    fun selectionMode(adaptiveSpec: HubAdaptiveSpec): GoodsEventSelectionMode =
        if (shouldUseTwoPane(adaptiveSpec)) {
            GoodsEventSelectionMode.UPDATE_INLINE_DETAIL
        } else {
            GoodsEventSelectionMode.NAVIGATE_TO_DETAIL
        }
}
