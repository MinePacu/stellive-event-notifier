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
                    try? HubCalendarWidgetStore.saveToSharedContainer(store.calendarWidgetSnapshot())
                }
        }
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
