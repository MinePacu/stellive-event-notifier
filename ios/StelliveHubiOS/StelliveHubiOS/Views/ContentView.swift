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
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var reservationStore: ReservationStore
    @State private var selectedTab = "home"
    @State private var pendingHubEventId: String?
    @State private var pendingHubEventScheduleItemId: String?
    @State private var pendingAnnouncementId: String?
    @State private var pendingReservationRoute: ReservationRoute?
    @State private var reservationReturnBanner: ReservationReturnBanner?
    @State private var promptedReservationSessionIDs = Set<UUID>()

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
            HubEventsTabView(
                deepLinkedEventId: $pendingHubEventId,
                deepLinkedScheduleItemId: $pendingHubEventScheduleItemId,
                pendingReservationRoute: $pendingReservationRoute
            )
                .tabItem { Label(IOSPrimaryNavigationPolicy.bottomTabs[3].title, systemImage: IOSPrimaryNavigationPolicy.bottomTabs[3].systemImage) }
                .tag("hubEvents")
        }
        .onOpenURL { url in
            if let route = ReservationDeepLinkPolicy.route(from: url) {
                selectedTab = "hubEvents"
                pendingReservationRoute = route
                return
            }
            if let announcementId = AnnouncementDeepLinkPolicy.id(from: url) {
                selectedTab = "home"
                pendingAnnouncementId = announcementId
                return
            }
            guard let eventId = HubCalendarDeepLinkPolicy.eventId(from: url) else { return }
            selectedTab = "hubEvents"
            pendingHubEventId = eventId
            pendingHubEventScheduleItemId = HubCalendarDeepLinkPolicy.scheduleItemId(from: url)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if let banner = reservationReturnBanner {
                ReservationReturnBannerView(
                    banner: banner,
                    onConfirm: { openReservationReturnAction(banner) },
                    onDismiss: { dismissReservationReturnBanner(banner) }
                )
                .padding(.horizontal, 12)
                .padding(.top, 4)
            }
        }
        .onChange(of: scenePhase) { phase in
            guard phase == .active else { return }
            reservationStore.reload()
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 350_000_000)
                evaluateReservationReturnBanner()
            }
        }
    }

    private func evaluateReservationReturnBanner() {
        if let message = reservationStore.lastErrorMessage {
            reservationReturnBanner = .error(message)
            return
        }
        let decision = ReservationReturnPromptPolicy.decision(
            drafts: reservationStore.activeDrafts,
            externallyOpenedSessionIDs: reservationStore.externallyOpenedSessionIDs,
            promptedSessionIDs: promptedReservationSessionIDs,
            now: Date()
        )
        switch decision {
        case .none:
            break
        case .single(let sessionID):
            promptedReservationSessionIDs.insert(sessionID)
            reservationReturnBanner = .single(sessionID)
        case .multiple(let sessionIDs):
            promptedReservationSessionIDs.formUnion(sessionIDs)
            reservationReturnBanner = .multiple
        }
    }

    private func openReservationReturnAction(_ banner: ReservationReturnBanner) {
        selectedTab = "hubEvents"
        switch banner {
        case .single(let sessionID): pendingReservationRoute = .quickAdd(sessionID: sessionID)
        case .multiple: pendingReservationRoute = .list
        case .error: reservationStore.clearErrorMessage()
        }
        reservationReturnBanner = nil
    }

    private func dismissReservationReturnBanner(_ banner: ReservationReturnBanner) {
        if case .error = banner { reservationStore.clearErrorMessage() }
        reservationReturnBanner = nil
    }
}

private enum ReservationReturnBanner: Equatable {
    case single(UUID)
    case multiple
    case error(String)
}

private struct ReservationReturnBannerView: View {
    let banner: ReservationReturnBanner
    let onConfirm: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: icon)
                .font(.subheadline.weight(.semibold))
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: 12) {
                Spacer()
                Button("아직 아니에요", action: onDismiss)
                    .frame(minHeight: 44)
                Button(actionTitle, action: onConfirm)
                    .buttonStyle(.borderedProminent)
                    .tint(.teal)
                    .frame(minHeight: 44)
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: .black.opacity(0.12), radius: 8, y: 3)
        .accessibilityElement(children: .contain)
    }

    private var title: String {
        switch banner {
        case .single: "예매·구매를 마치셨나요? 완료 내역을 직접 추가할 수 있습니다."
        case .multiple: "확인이 필요한 내역이 여러 건 있습니다. 내 예약·구매에서 선택해 주세요."
        case .error(let message): message
        }
    }

    private var actionTitle: String {
        switch banner {
        case .single: "내역에 추가"
        case .multiple: "내역 보기"
        case .error: "확인"
        }
    }

    private var icon: String {
        if case .error = banner { return "exclamationmark.triangle" }
        return "ticket"
    }
}

private struct HubEventsTabView: View {
    @EnvironmentObject private var store: MockHubStore
    @EnvironmentObject private var serverStore: ServerHubStore
    @Binding var deepLinkedEventId: String?
    @Binding var deepLinkedScheduleItemId: String?
    @Binding var pendingReservationRoute: ReservationRoute?
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            HubEventsView()
                .globalToolbar(path: $path)
                .navigationDestination(for: HubEventDetailRoute.self) { route in
                    HubEventDetailContainerView(
                        initialEvent: route.event,
                        highlightedScheduleItemId: route.scheduleItemId
                    )
                }
                .navigationDestination(for: ReservationRoute.self) { route in
                    switch route {
                    case .list:
                        ReservationsView()
                    case .detail(let id):
                        ReservationDetailView(reservationID: id)
                    case .edit(let id):
                        ReservationEditView(reservationID: id)
                    case .quickAdd(let sessionID):
                        ReservationQuickAddView(sessionID: sessionID)
                    case .listHelp:
                        ReservationHelpView(page: .list)
                    case .detailHelp:
                        ReservationHelpView(page: .detail)
                    }
                }
                .onAppear(perform: openPendingHubEvent)
                .onAppear(perform: openPendingReservation)
                .onChange(of: deepLinkedEventId) { _ in
                    openPendingHubEvent()
                }
                .onChange(of: pendingReservationRoute) { _ in
                    openPendingReservation()
                }
        }
    }

    private func openPendingReservation() {
        guard let route = pendingReservationRoute else { return }
        path.removeLast(path.count)
        path.append(route)
        pendingReservationRoute = nil
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
                        path.append(HubEventDetailRoute(event: event, scheduleItemId: deepLinkedScheduleItemId))
                        deepLinkedEventId = nil
                        deepLinkedScheduleItemId = nil
                    }
                }
            }
            return
        }

        path.removeLast(path.count)
        path.append(HubEventDetailRoute(event: event, scheduleItemId: deepLinkedScheduleItemId))
        deepLinkedEventId = nil
        deepLinkedScheduleItemId = nil
    }
}

private struct HubEventDetailRoute: Hashable {
    let event: HubEvent
    let scheduleItemId: String?
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
