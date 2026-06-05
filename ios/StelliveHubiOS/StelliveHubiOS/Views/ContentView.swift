import SwiftUI

struct IOSPrimaryNavigationPolicy {
    struct BottomTab: Equatable {
        let id: String
        let title: String
        let systemImage: String
    }

    struct SettingsAccess: Equatable {
        enum Placement {
            case topBarTrailing
        }

        enum Presentation {
            case navigationStackPush
        }

        let placement: Placement
        let systemImage: String
        let appliesToAllPrimaryTabs: Bool
        let presentation: Presentation
        let reusesPresenterNavigationStack: Bool
        let showsOnlyOnPrimaryRoots: Bool
        let suppressesPrimaryButtonWithinSettingsFlow: Bool
    }

    static let bottomTabs: [BottomTab] = [
        .init(id: "home", title: "홈", systemImage: "house"),
        .init(id: "live", title: "라이브", systemImage: "dot.radiowaves.left.and.right"),
        .init(id: "history", title: "기록", systemImage: "clock"),
        .init(id: "hubEvents", title: "굿즈/행사", systemImage: "bag")
    ]

    static let settingsAccess = SettingsAccess(
        placement: .topBarTrailing,
        systemImage: "slider.horizontal.3",
        appliesToAllPrimaryTabs: true,
        presentation: .navigationStackPush,
        reusesPresenterNavigationStack: true,
        showsOnlyOnPrimaryRoots: true,
        suppressesPrimaryButtonWithinSettingsFlow: true
    )

    static let titlelessPrimaryScreens: Set<String> = ["home", "hubEvents"]
}

struct ContentView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[0].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[0].systemImage) }
            LiveView()
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[1].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[1].systemImage) }
            HistoryView()
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[2].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[2].systemImage) }
            HubEventsTabView()
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[3].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[3].systemImage) }
        }
    }
}

private struct HubEventsTabView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            HubEventsView()
                .settingsToolbar(path: $path)
        }
    }
}

private enum SettingsToolbarRoute: Hashable {
    case settings
}

private struct SettingsToolbarModifier: ViewModifier {
    @Binding var path: NavigationPath

    private var showsToolbarButton: Bool {
        !IOSPrimaryNavigationPolicy.settingsAccess.showsOnlyOnPrimaryRoots || path.isEmpty
    }

    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        path.append(SettingsToolbarRoute.settings)
                    } label: {
                        Image(systemName: IOSPrimaryNavigationPolicy.settingsAccess.systemImage)
                    }
                    .accessibilityLabel("설정")
                    .accessibilityHidden(!showsToolbarButton)
                    .disabled(!showsToolbarButton)
                    .opacity(showsToolbarButton ? 1 : 0)
                }
            }
            .navigationDestination(for: SettingsToolbarRoute.self) { route in
                switch route {
                case .settings:
                    SettingsContentView()
                }
            }
    }
}

extension View {
    func settingsToolbar(path: Binding<NavigationPath>) -> some View {
        modifier(SettingsToolbarModifier(path: path))
    }
}
