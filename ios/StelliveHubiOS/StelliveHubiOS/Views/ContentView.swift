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

    static let titlelessPrimaryScreens: Set<String> = ["home", "live", "hubEvents"]
}

struct ContentView: View {
    @State private var selectedTab = "home"
    @State private var pendingHubEventId: String?

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[0].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[0].systemImage) }
                .tag("home")
            LiveView()
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[1].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[1].systemImage) }
                .tag("live")
            HistoryView()
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[2].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[2].systemImage) }
                .tag("history")
            HubEventsTabView(deepLinkedEventId: $pendingHubEventId)
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[3].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[3].systemImage) }
                .tag("hubEvents")
        }
        .onOpenURL { url in
            guard let eventId = HubCalendarDeepLinkPolicy.eventId(from: url) else { return }
            selectedTab = "hubEvents"
            pendingHubEventId = eventId
        }
    }
}

private struct HubEventsTabView: View {
    @EnvironmentObject private var store: MockHubStore
    @Binding var deepLinkedEventId: String?
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            HubEventsView()
                .settingsToolbar(path: $path)
                .navigationDestination(for: HubEvent.self) { event in
                    HubEventDetailView(event: event)
                }
                .onAppear(perform: openPendingHubEvent)
                .onChange(of: deepLinkedEventId) { _ in
                    openPendingHubEvent()
                }
        }
    }

    private func openPendingHubEvent() {
        guard
            let eventId = deepLinkedEventId,
            let event = store.hubEvents.first(where: { $0.id == eventId })
        else {
            return
        }

        path.removeLast(path.count)
        path.append(event)
        deepLinkedEventId = nil
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
