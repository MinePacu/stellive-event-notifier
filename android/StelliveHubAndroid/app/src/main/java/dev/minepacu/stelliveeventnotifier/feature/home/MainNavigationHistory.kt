package dev.minepacu.stelliveeventnotifier.feature.home

enum class HubScreen(val id: String) {
    HOME("home"),
    SONGS("songs"),
    SONG_SEARCH("song_search"),
    SONG_MEMBER_FILTER("song_member_filter"),
    GOODS_EVENTS("goods_events"),
    GOODS_EVENT_DETAIL("goods_event_detail"),
    LIVE("live"),
    HISTORY("history"),
    SETTINGS("settings"),
    SETTINGS_DELIVERY("settings_delivery"),
    SETTINGS_TARGETS("settings_targets"),
    SETTINGS_PLATFORMS("settings_platforms"),
    SETTINGS_EVENT_TYPES("settings_event_types"),
    SETTINGS_HUB_EVENTS("settings_hub_events"),
    SETTINGS_ADVANCED("settings_advanced"),
    SETTINGS_ABOUT("settings_about");
}

data class MainNavigationHistoryState(
    val currentRoot: HubScreen,
    val currentScreen: HubScreen,
    val previousScreens: List<HubScreen>,
)

class MainNavigationHistory(initialScreen: HubScreen = HubScreen.HOME) {
    private val previousScreens = mutableListOf<HubScreen>()
    private var currentRoot: HubScreen = initialScreen.rootScreen()
    var currentScreen: HubScreen = initialScreen
        private set

    val canGoBack: Boolean
        get() = previousScreens.isNotEmpty()

    val previousScreen: HubScreen?
        get() = previousScreens.lastOrNull()

    val currentRootScreen: HubScreen
        get() = currentRoot

    fun select(screen: HubScreen) {
        if (screen == currentScreen) return
        previousScreens += currentScreen
        currentScreen = screen
    }

    fun selectRoot(screen: HubScreen) {
        previousScreens.clear()
        currentRoot = screen.rootScreen()
        currentScreen = screen
    }

    fun goBack(): HubScreen? {
        val previous = previousScreens.removeLastOrNull() ?: return null
        currentScreen = previous
        return previous
    }

    fun goBackToCurrentRoot(): HubScreen? {
        if (currentScreen == currentRoot) return null
        previousScreens.clear()
        currentScreen = currentRoot
        return currentRoot
    }

    fun snapshot(): MainNavigationHistoryState = MainNavigationHistoryState(
        currentRoot = currentRoot,
        currentScreen = currentScreen,
        previousScreens = previousScreens.toList(),
    )

    fun restore(state: MainNavigationHistoryState) {
        previousScreens.clear()
        previousScreens += state.previousScreens
        currentRoot = state.currentRoot.rootScreen()
        currentScreen = state.currentScreen
    }
}

fun HubScreen.rootScreen(): HubScreen = when (this) {
    HubScreen.LIVE -> HubScreen.LIVE
    HubScreen.SONGS,
    HubScreen.SONG_SEARCH,
    HubScreen.SONG_MEMBER_FILTER -> HubScreen.SONGS
    HubScreen.GOODS_EVENTS,
    HubScreen.GOODS_EVENT_DETAIL -> HubScreen.GOODS_EVENTS
    else -> HubScreen.HOME
}
