import SwiftUI

@main
struct StelliveHubApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var store: MockHubStore
    @StateObject private var serverStore: ServerHubStore
    @StateObject private var songFavoritesStore: SongFavoritesStore
    @StateObject private var songDiscoveryStore: SongDiscoveryStore
    @StateObject private var songBrowseSessionStore: SongBrowseSessionStore
    @StateObject private var songOpenPreferenceStore: SongOpenPreferenceStore

    init() {
        let fallback = MockHubStore()
        _store = StateObject(wrappedValue: fallback)
        _serverStore = StateObject(
            wrappedValue: ServerHubStore(
                api: HubAPIClient(baseURL: Bundle.main.hubBaseURL ?? URL(string: "http://127.0.0.1:4000")!),
                fallback: fallback
            )
        )
        _songFavoritesStore = StateObject(wrappedValue: SongFavoritesStore())
        _songDiscoveryStore = StateObject(wrappedValue: SongDiscoveryStore())
        _songBrowseSessionStore = StateObject(wrappedValue: SongBrowseSessionStore())
        _songOpenPreferenceStore = StateObject(wrappedValue: SongOpenPreferenceStore())
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .environmentObject(serverStore)
                .environmentObject(songFavoritesStore)
                .environmentObject(songDiscoveryStore)
                .environmentObject(songBrowseSessionStore)
                .environmentObject(songOpenPreferenceStore)
                .preferredColorScheme(store.settings.appearanceMode.preferredColorScheme)
                .task {
                    _ = await serverStore.bootstrap()
                    try? HubCalendarWidgetStore.saveToSharedContainer(store.calendarWidgetSnapshot())
                }
        }
    }
}

extension Bundle {
    var hubBaseURL: URL? {
        guard
            let value = object(forInfoDictionaryKey: "HubBaseURL") as? String,
            value.isEmpty == false,
            value.contains("$(") == false
        else {
            return nil
        }
        return URL(string: value)
    }
}

private extension AppearanceMode {
    var preferredColorScheme: ColorScheme? {
        switch self {
        case .system:
            return nil
        case .light:
            return .light
        case .dark:
            return .dark
        }
    }
}
