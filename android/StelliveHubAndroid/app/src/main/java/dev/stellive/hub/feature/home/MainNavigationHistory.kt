package dev.stellive.hub.feature.home

enum class HubScreen(val id: String) {
    HOME("home"),
    LIVE("live"),
    HISTORY("history"),
    SETTINGS("settings");
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

    fun goBack(): HubScreen? {
        val previous = previousScreens.removeLastOrNull() ?: return null
        currentScreen = previous
        return previous
    }
}
