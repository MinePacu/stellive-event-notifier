package dev.minepacu.stelliveeventnotifier.ui.chrome

data class MainScreenChromeSpec(
    val showExpandedBodyHeader: Boolean,
    val showTopBarTitleAtRest: Boolean,
    val keepTopBarTitleWhenScrolled: Boolean,
    val showSettingsAction: Boolean,
    val showSongSearchAction: Boolean,
)

object MainScreenChromePolicy {
    private val rootScreens = setOf("home", "live", "songs", "goods_events")
    private val expandedBodyHeaderScreens = setOf("history", "goods_event_detail")
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
}
