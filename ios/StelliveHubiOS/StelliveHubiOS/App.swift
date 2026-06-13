import SwiftUI

@main
struct StelliveHubApp: App {
    @StateObject private var store = MockHubStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .preferredColorScheme(store.settings.appearanceMode.preferredColorScheme)
                .task {
                    if let baseURL = Bundle.main.hubBaseURL {
                        _ = await ServerHubStore(
                            api: HubAPIClient(baseURL: baseURL),
                            fallback: store
                        ).bootstrap()
                    }
                    try? HubCalendarWidgetStore.saveToSharedContainer(store.calendarWidgetSnapshot())
                }
        }
    }
}

private extension Bundle {
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
