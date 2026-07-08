package dev.minepacu.stelliveeventnotifier.ui.adaptive

import android.graphics.Rect

enum class HubWindowWidthClass {
    COMPACT,
    MEDIUM,
    EXPANDED,
}

enum class HubFoldState {
    NONE,
    FLAT,
    HALF_OPENED,
    UNKNOWN,
}

enum class HubFoldOrientation {
    VERTICAL,
    HORIZONTAL,
}

data class HubFoldFeature(
    val state: HubFoldState,
    val orientation: HubFoldOrientation?,
    val isSeparating: Boolean,
    val bounds: Rect?,
)

data class HubAdaptiveSpec(
    val widthClass: HubWindowWidthClass,
    val foldFeature: HubFoldFeature? = null,
) {
    val hasFoldingFeatureInCurrentWindow: Boolean
        get() = foldFeature != null && foldFeature.state != HubFoldState.NONE

    val useLargeScreenLayout: Boolean
        get() = widthClass != HubWindowWidthClass.COMPACT

    val useBookFoldLayout: Boolean
        get() = useLargeScreenLayout &&
            hasFoldingFeatureInCurrentWindow &&
            foldFeature?.orientation == HubFoldOrientation.VERTICAL

    val useFoldAwareTwoPane: Boolean
        get() = useBookFoldLayout && foldFeature?.isSeparating == true

    val showAdjacentLiveAction: Boolean
        get() = useLargeScreenLayout
}

object HubAdaptivePolicy {
    fun widthClass(widthDp: Int): HubWindowWidthClass = when {
        widthDp >= 840 -> HubWindowWidthClass.EXPANDED
        widthDp >= 600 -> HubWindowWidthClass.MEDIUM
        else -> HubWindowWidthClass.COMPACT
    }

    fun spec(widthDp: Int, foldFeature: HubFoldFeature? = null): HubAdaptiveSpec =
        HubAdaptiveSpec(
            widthClass = widthClass(widthDp),
            foldFeature = foldFeature,
        )
}
