import SwiftUI

@main
struct StelliveHubApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var store: MockHubStore
    @StateObject private var serverStore: ServerHubStore

    init() {
        let fallback = MockHubStore()
        _store = StateObject(wrappedValue: fallback)
        _serverStore = StateObject(
            wrappedValue: ServerHubStore(
                api: HubAPIClient(baseURL: Bundle.main.hubBaseURL ?? URL(string: "http://127.0.0.1:4000")!),
                fallback: fallback
            )
        )
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .environmentObject(serverStore)
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
