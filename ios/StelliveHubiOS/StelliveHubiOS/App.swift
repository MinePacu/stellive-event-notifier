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
    @StateObject private var announcementReadStore: AnnouncementReadStore
    @StateObject private var reservationStore: ReservationStore
    @StateObject private var goodsChecklistStore: GoodsChecklistStore

    init() {
        let fallback = MockHubStore(settingsPersistence: .standard)
        _store = StateObject(wrappedValue: fallback)
        let resolvedHubBaseURL: URL
        if let configuredHubBaseURL = Bundle.main.hubBaseURL {
            resolvedHubBaseURL = configuredHubBaseURL
        } else {
            assertionFailure("hubBaseURL missing from Info.plist — check build configuration")
            // swiftlint:disable:next force_unwrapping
            resolvedHubBaseURL = URL(string: "https://hub.invalid")!
        }
        let goodsChecklist = GoodsChecklistStore()
        _goodsChecklistStore = StateObject(wrappedValue: goodsChecklist)
        _serverStore = StateObject(
            wrappedValue: ServerHubStore(
                api: HubAPIClient(baseURL: resolvedHubBaseURL),
                fallback: fallback,
                goodsChecklist: goodsChecklist
            )
        )
        _songFavoritesStore = StateObject(wrappedValue: SongFavoritesStore())
        _songDiscoveryStore = StateObject(wrappedValue: SongDiscoveryStore())
        _songBrowseSessionStore = StateObject(wrappedValue: SongBrowseSessionStore())
        _songOpenPreferenceStore = StateObject(wrappedValue: SongOpenPreferenceStore())
        _announcementReadStore = StateObject(wrappedValue: AnnouncementReadStore())
        _reservationStore = StateObject(wrappedValue: ReservationStore())
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
                .environmentObject(announcementReadStore)
                .environmentObject(reservationStore)
                .environmentObject(goodsChecklistStore)
                .preferredColorScheme(store.settings.appearanceMode.preferredColorScheme)
                .task {
                    _ = await serverStore.bootstrap()
                    await serverStore.reconcileNotificationSettingsOnLaunch()
                    if let summary = serverStore.announcementsSummary { announcementReadStore.initialize(summaryItems: summary.items) }
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
