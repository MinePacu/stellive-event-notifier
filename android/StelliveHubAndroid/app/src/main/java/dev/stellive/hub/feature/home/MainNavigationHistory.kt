package dev.stellive.hub.feature.home

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
    SETTINGS_ADVANCED("settings_advanced");
}

class MainNavigationHistory(initialScreen: HubScreen = HubScreen.HOME) {
    private val previousScreens = mutableListOf<HubScreen>()
    var currentScreen: HubScreen = initialScreen
        private set

    val canGoBack: Boolean
        get() = previousScreens.isNotEmpty()

    fun select(screen: HubScreen) {
        if (screen == currentScreen) return
        previousScreens += currentScreen
        currentScreen = screen
    }

    fun selectRoot(screen: HubScreen) {
        previousScreens.clear()
        currentScreen = screen
    }

    fun goBack(): HubScreen? {
        val previous = previousScreens.removeLastOrNull() ?: return null
        currentScreen = previous
        return previous
    }
}
