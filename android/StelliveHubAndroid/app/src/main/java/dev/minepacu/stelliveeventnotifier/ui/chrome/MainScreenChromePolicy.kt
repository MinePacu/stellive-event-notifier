package dev.minepacu.stelliveeventnotifier.ui.chrome

import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubAdaptiveSpec

data class MainScreenChromeSpec(
    val showExpandedBodyHeader: Boolean,
    val showTopBarTitleAtRest: Boolean,
    val keepTopBarTitleWhenScrolled: Boolean,
    val showSettingsAction: Boolean,
    val showSongSearchAction: Boolean,
)

data class MainNavigationChromeSpec(
    val showBottomNavigation: Boolean,
    val showNavigationRail: Boolean,
    val constrainContentWidth: Boolean,
)

object MainScreenChromePolicy {
    private val rootScreens = setOf("home", "live", "songs", "goods_events")
    private val expandedBodyHeaderScreens = setOf("goods_event_detail")
    private val titleStickyWhileScrollingScreens = emptySet<String>()

    fun spec(screenId: String, canGoBack: Boolean = false): MainScreenChromeSpec {
        val isRoot = screenId in rootScreens
        return MainScreenChromeSpec(
            showExpandedBodyHeader = screenId in expandedBodyHeaderScreens,
            showTopBarTitleAtRest = true,
            keepTopBarTitleWhenScrolled = screenId in titleStickyWhileScrollingScreens,
            showSettingsAction = screenId != "settings" && !screenId.startsWith("settings_"),
            showSongSearchAction = screenId == "songs" && !canGoBack,
        )
    }

    fun navigationSpec(adaptiveSpec: HubAdaptiveSpec): MainNavigationChromeSpec {
        val useRail = adaptiveSpec.useLargeScreenLayout
        return MainNavigationChromeSpec(
            showBottomNavigation = !useRail,
            showNavigationRail = useRail,
            constrainContentWidth = useRail,
        )
    }
}
