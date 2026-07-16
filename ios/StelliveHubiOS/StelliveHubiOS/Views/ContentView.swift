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
        .init(id: "songs", title: "노래", systemImage: "music.note.list"),
        .init(id: "hubEvents", title: "굿즈/행사", systemImage: "bag")
    ]

    static let settingsAccess = SettingsAccess(
        placement: .topBarTrailing,
        systemImage: "slider.horizontal.3",
        appliesToAllPrimaryTabs: true,
        presentation: .navigationStackPush,
        reusesPresenterNavigationStack: true,
        showsOnlyOnPrimaryRoots: false,
        suppressesPrimaryButtonWithinSettingsFlow: true
    )

    static let titlelessPrimaryScreens: Set<String> = ["home", "live", "songs", "hubEvents"]

    static func shouldAttachSettingsToolbar(screenId: String) -> Bool {
        screenId != "settings" && !screenId.hasPrefix("settings_")
    }

    static func shouldAttachGlobalToolbar(screenId: String) -> Bool { shouldAttachSettingsToolbar(screenId: screenId) }
    static func showsAnnouncementButton(screenId: String) -> Bool {
        shouldAttachGlobalToolbar(screenId: screenId) && screenId != "announcements" && screenId != "announcement_detail"
    }

    static func showsSettingsButton(pathCount: Int, settingsRouteDepth: Int?) -> Bool {
        if settingsAccess.showsOnlyOnPrimaryRoots && pathCount > 0 {
            return false
        }
        guard settingsAccess.suppressesPrimaryButtonWithinSettingsFlow,
              let settingsRouteDepth else {
            return true
        }
        return pathCount < settingsRouteDepth
    }
}

struct ContentView: View {
    @State private var selectedTab = "home"
    @State private var pendingHubEventId: String?
    @State private var pendingAnnouncementId: String?

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(deepLinkedAnnouncementId: $pendingAnnouncementId)
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[0].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[0].systemImage) }
                .tag("home")
            LiveView()
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[1].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[1].systemImage) }
                .tag("live")
            SongsView()
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[2].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[2].systemImage) }
                .tag("songs")
            HubEventsTabView(deepLinkedEventId: $pendingHubEventId)
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[3].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[3].systemImage) }
                .tag("hubEvents")
        }
        .onOpenURL { url in
            if let announcementId = AnnouncementDeepLinkPolicy.id(from: url) {
                selectedTab = "home"
                pendingAnnouncementId = announcementId
                return
            }
            guard let eventId = HubCalendarDeepLinkPolicy.eventId(from: url) else { return }
            selectedTab = "hubEvents"
            pendingHubEventId = eventId
        }
    }
}

private struct HubEventsTabView: View {
    @EnvironmentObject private var store: MockHubStore
    @EnvironmentObject private var serverStore: ServerHubStore
    @Binding var deepLinkedEventId: String?
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            HubEventsView()
                .globalToolbar(path: $path)
                .navigationDestination(for: HubEvent.self) { event in
                    HubEventDetailContainerView(initialEvent: event)
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
            let event = serverStore.cachedHubEvent(id: eventId) ?? store.hubEvents.first(where: { $0.id == eventId })
        else {
            if let eventId = deepLinkedEventId {
                Task {
                    if let event = await serverStore.loadHubEventDetail(id: eventId) {
                        path.removeLast(path.count)
                        path.append(event)
                        deepLinkedEventId = nil
                    }
                }
            }
            return
        }

        path.removeLast(path.count)
        path.append(event)
        deepLinkedEventId = nil
    }
}

enum GlobalToolbarRoute: Hashable {
    case settings
    case announcements
    case announcementDetail(String)
}

private struct GlobalToolbarModifier: ViewModifier {
    @Binding var path: NavigationPath
    @EnvironmentObject private var serverStore: ServerHubStore
    @EnvironmentObject private var readStore: AnnouncementReadStore
    @State private var settingsRouteDepth: Int?
    @State private var announcementRouteDepth: Int?

    private var showsToolbarButton: Bool {
        IOSPrimaryNavigationPolicy.showsSettingsButton(
            pathCount: path.count,
            settingsRouteDepth: settingsRouteDepth
        )
    }

    private var unreadCount: Int {
        serverStore.announcementsSummary?.items.filter {
            !readStore.readKeys.contains(AnnouncementPolicy.readKey(id: $0.id, attentionRevision: $0.attentionRevision))
        }.count ?? 0
    }

    private var showsAnnouncementButton: Bool {
        showsToolbarButton && (announcementRouteDepth == nil || path.count < announcementRouteDepth!)
    }

    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        guard announcementRouteDepth == nil else { return }
                        announcementRouteDepth = path.count + 1
                        path.append(GlobalToolbarRoute.announcements)
                    } label: {
                        AnnouncementBellLabel(unreadCount: unreadCount)
                            .frame(width: 34, height: 34)
                            .background(Circle().fill(Color(.secondarySystemGroupedBackground)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityHidden(!showsAnnouncementButton)
                    .disabled(!showsAnnouncementButton)
                    .opacity(showsAnnouncementButton ? 1 : 0)

                    Button {
                        guard settingsRouteDepth == nil else { return }
                        settingsRouteDepth = path.count + 1
                        path.append(GlobalToolbarRoute.settings)
                    } label: {
                        Image(systemName: IOSPrimaryNavigationPolicy.settingsAccess.systemImage)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.primary)
                            .frame(width: 34, height: 34)
                            .background(
                                Circle()
                                    .fill(Color(.secondarySystemGroupedBackground))
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("설정")
                    .accessibilityHidden(!showsToolbarButton)
                    .disabled(!showsToolbarButton)
                    .opacity(showsToolbarButton ? 1 : 0)
                }
            }
            .navigationDestination(for: GlobalToolbarRoute.self) { route in
                switch route {
                case .settings:
                    SettingsContentView()
                case .announcements:
                    AnnouncementsView()
                        .onAppear { if announcementRouteDepth == nil { announcementRouteDepth = path.count } }
                case .announcementDetail(let id):
                    AnnouncementDetailView(announcementID: id)
                        .onAppear { if announcementRouteDepth == nil { announcementRouteDepth = path.count } }
                }
            }
            .onChange(of: path.count) { newCount in
                if let settingsRouteDepth, newCount < settingsRouteDepth {
                    self.settingsRouteDepth = nil
                }
                if let announcementRouteDepth, newCount < announcementRouteDepth {
                    self.announcementRouteDepth = nil
                }
            }
    }
}

extension View {
    func globalToolbar(path: Binding<NavigationPath>) -> some View {
        modifier(GlobalToolbarModifier(path: path))
    }

    func settingsToolbar(path: Binding<NavigationPath>) -> some View { globalToolbar(path: path) }
}
