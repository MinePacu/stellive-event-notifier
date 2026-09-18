import SwiftUI

enum SettingsRoute: String, CaseIterable, Hashable {
    case history
    case delivery
    case targets
    case platforms
    case eventTypes
    case hubEvents
    case advanced
    case about
}

enum SettingsNavigationRowVerticalAlignment: Equatable {
    case center
}

enum SettingsNavigationRowLayout {
    static let trailingSummaryVerticalAlignment: SettingsNavigationRowVerticalAlignment = .center
    static let summaryLineLimit = 1
    static let summaryMinimumScaleFactor = 0.85
}

struct SettingsHubRow: Identifiable, Equatable {
    let route: SettingsRoute
    let title: String
    let note: String
    let summary: String

    var id: SettingsRoute { route }
}

struct SettingsHubSection: Identifiable, Equatable {
    let title: String
    let rows: [SettingsHubRow]

    var id: String { title }
}

struct SettingsToggleRow: Identifiable, Equatable {
    let id: String
    let title: String
    let note: String?
    let isEnabled: Bool
}

enum SettingsNavigationPolicy {
    static let hubEventPolicyNotice = "강지 대표 항목의 이벤트, 팬이 주최한 이벤트, 정기 방송·라이브·업로드는 굿즈/행사 알림에 포함하지 않습니다."
    static let platformSettingsCommonNotice = "플랫폼 알림을 끄면 해당 플랫폼의 푸시 알림을 받지 않습니다."
    static let eventTypeSettingsCommonNotices = [
        "사용자가 선택한 알림 설정과 방해 금지 시간, 차단 키워드, 알림 빈도 제한은 그대로 적용됩니다.",
        "공식 채널의 YouTube 알림은 새 영상 업로드만 지원하며, 라이브 예정·시작·종료 알림은 보내지 않습니다."
    ]

    static func debugServerConnectionLogs(debugModeEnabled: Bool, logs: [String]) -> [String] {
        debugModeEnabled ? logs : []
    }

    static func hubRows(settings: NotificationSettingsState, members: [HubMember]) -> [SettingsHubRow] {
        [
            SettingsHubRow(
                route: .history,
                title: "알림 기록",
                note: "최근 받은 알림과 제외된 항목",
                summary: "보기"
            ),
            SettingsHubRow(
                route: .delivery,
                title: "알림 수신 방식",
                note: "표준, 실시간 우선, 방해 금지 시간",
                summary: settings.realtimeEnabled ? "실시간 우선" : "표준"
            ),
            SettingsHubRow(
                route: .targets,
                title: "대상별 알림",
                note: "기수, 감자, 기타, 개별 대상",
                summary: enabledSummary(
                    values: settings.generationEnabled.values.map { $0 } + members.filter { $0.catalogRole != .placeholder }.map { settings.memberEnabled[$0.id] ?? $0.notificationEnabled }
                )
            ),
            SettingsHubRow(
                route: .platforms,
                title: "플랫폼별 알림",
                note: "CHZZK, YouTube, 굿즈/행사",
                summary: enabledSummary(values: NotificationPlatform.allCases.map { settings.platformEnabled[$0] ?? false })
            ),
            SettingsHubRow(
                route: .eventTypes,
                title: "알림 종류별 설정",
                note: "방송 시작·종료, 새 영상, 공식 소식, 굿즈/행사",
                summary: enabledSummary(values: NotificationEventType.allCases.map { settings.eventTypeEnabled[$0] ?? false })
            ),
            SettingsHubRow(
                route: .hubEvents,
                title: "굿즈/행사",
                note: "공식 출처 기준과 제외 대상",
                summary: hubEventSummary(settings: settings)
            ),
            SettingsHubRow(
                route: .advanced,
                title: "세부 알림 설정",
                note: "분류와 개별 대상의 우선순위를 설정합니다.",
                summary: "우선순위"
            ),
            SettingsHubRow(
                route: .about,
                title: "앱 정보",
                note: "프로젝트 소개, 버전, 오픈 소스",
                summary: "보기"
            )
        ]
    }

    static func hubSections(rows: [SettingsHubRow]) -> [SettingsHubSection] {
        let rowsByRoute = Dictionary(uniqueKeysWithValues: rows.map { ($0.route, $0) })
        func section(_ title: String, routes: [SettingsRoute]) -> SettingsHubSection {
            SettingsHubSection(title: title, rows: routes.compactMap { rowsByRoute[$0] })
        }

        return [
            section("알림 기본 설정", routes: [.delivery]),
            section("알림 대상 및 종류", routes: [.targets, .platforms, .eventTypes, .hubEvents, .advanced]),
            section("기록 및 정보", routes: [.history, .about])
        ]
    }

    static func eventTypeRows(settings: NotificationSettingsState) -> [SettingsToggleRow] {
        NotificationEventType.allCases.map { eventType in
            SettingsToggleRow(
                id: eventType.rawValue,
                title: eventType.displayName,
                note: eventTypePolicy(eventType),
                isEnabled: settings.eventTypeEnabled[eventType] ?? false
            )
        }
    }

    static func hubEventRows(settings: NotificationSettingsState) -> [SettingsToggleRow] {
        [
            SettingsToggleRow(
                id: "hub-event-platform",
                title: "굿즈/행사 알림",
                note: "공식 채널, 멤버 또는 공식 협업처에서 안내한 기간 한정 정보만 포함합니다.",
                isEnabled: settings.platformEnabled[.hubEvent] ?? false
            ),
            SettingsToggleRow(
                id: "online-goods",
                title: "온라인 굿즈",
                note: "한정 예약, 판매 시작, 마감 임박을 포함합니다.",
                isEnabled: settings.platformEnabled[.hubEvent] ?? false
            ),
            SettingsToggleRow(
                id: "offline-events",
                title: "오프라인 행사",
                note: "콘서트, 팝업, 공식 협업 행사를 포함합니다.",
                isEnabled: settings.platformEnabled[.hubEvent] ?? false
            ),
            SettingsToggleRow(
                id: NotificationEventType.eventDeadlineSoon.rawValue,
                title: "마감 임박 우선 표시",
                note: "홈과 최근 알림에 우선 배치합니다.",
                isEnabled: settings.eventTypeEnabled[.eventDeadlineSoon] ?? false
            ),
            SettingsToggleRow(
                id: NotificationEventType.eventMilestoneDue.rawValue,
                title: "세부 일정 알림",
                note: "콘텐츠 공개와 발매 같은 개별 일정을 알려드립니다.",
                isEnabled: settings.eventTypeEnabled[.eventMilestoneDue] ?? false
            ),
            SettingsToggleRow(
                id: NotificationEventType.eventUpdated.rawValue,
                title: "변경 알림",
                note: "기본적으로 꺼져 있습니다.",
                isEnabled: settings.eventTypeEnabled[.eventUpdated] ?? false
            )
        ]
    }

    static func eventTypePolicy(_ eventType: NotificationEventType) -> String? {
        switch eventType {
        case .chzzkChat, .youtubeLiveScheduled, .youtubeLiveStarted, .youtubeLiveEnded, .officialYoutubeUpload:
            return nil
        case .cafePost:
            return "무단 수집, 로그인 쿠키 수집, 비공개 접근 우회 없이 공식 경로만 사용합니다."
        case .eventAnnounced:
            return "공식 채널, 멤버 또는 공식 협업처에서 안내한 기간 한정 정보만 포함합니다."
        case .eventSalesOpen:
            return "굿즈, 티켓, 오프라인 행사의 예약이나 판매가 시작될 때 알려드립니다."
        case .eventDeadlineSoon:
            return "예약/판매 종료가 가까운 항목을 홈과 알림에 우선 표시합니다."
        case .eventMilestoneDue:
            return "트랙 리스트, 콘텐츠 공개와 발매 같은 개별 일정을 알려드립니다."
        case .eventUpdated:
            return "굿즈나 행사 정보가 바뀌었을 때 알려드리며, 기본적으로 꺼져 있습니다."
        case .eventCancelled:
            return "공식 채널에서 취소를 안내한 경우에만 알려드립니다."
        default:
            return nil
        }
    }

    static func platformPolicy(_ platform: NotificationPlatform) -> String? {
        switch platform {
        case .naverCafe:
            return "공식 API와 이용 약관을 따르며, 로그인 정보가 필요한 방식으로 게시물을 수집하지 않습니다."
        case .hubEvent:
            return "공식 출처에서 안내한 기간 한정 굿즈, 티켓, 오프라인 행사만 포함합니다."
        default:
            return nil
        }
    }

    private static func enabledSummary(values: [Bool]) -> String {
        guard !values.isEmpty else { return "없음" }
        let enabledCount = values.filter { $0 }.count
        if enabledCount == values.count { return "전체 켜짐" }
        if enabledCount == 0 { return "전체 꺼짐" }
        return "\(values.count)개 중 \(enabledCount)개 켜짐"
    }

    private static func hubEventSummary(settings: NotificationSettingsState) -> String {
        guard settings.platformEnabled[.hubEvent] ?? false else { return "꺼짐" }
        return (settings.eventTypeEnabled[.eventDeadlineSoon] ?? false) ? "켜짐 · 마감 임박 우선" : "켜짐"
    }
}

struct SettingsView: View {
    var body: some View {
        NavigationStack {
            SettingsContentView()
        }
    }
}

struct SettingsContentView: View {
    @EnvironmentObject private var store: MockHubStore
    @EnvironmentObject private var serverStore: ServerHubStore
    @EnvironmentObject private var songOpenPreferenceStore: SongOpenPreferenceStore
    @State private var debugModeEnabled = false

    var body: some View {
        let hubRows = SettingsNavigationPolicy.hubRows(settings: store.settings, members: store.members)
        let hubSections = Dictionary(
            uniqueKeysWithValues: SettingsNavigationPolicy.hubSections(rows: hubRows).map { ($0.title, $0.rows) }
        )

        Form {
            if let message = serverStore.preferenceSyncErrorMessage {
                Section {
                    Label(message, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                        .accessibilityIdentifier("preference-sync-error")
                }
            }

            Section("알림 기본 설정") {
                Toggle("전체 알림", isOn: persistedToggle(\.globalEnabled))
                Toggle("서비스 공지", isOn: persistedToggle(\.serviceAnnouncementsEnabled))
                    .disabled(!store.settings.globalEnabled)

                ForEach(hubSections["알림 기본 설정"] ?? []) { row in
                    settingsNavigationLink(row)
                }
            }

            Section("알림 대상 및 종류") {
                ForEach(hubSections["알림 대상 및 종류"] ?? []) { row in
                    settingsNavigationLink(row)
                }
            }

            Section("앱 사용") {
                Picker("알림을 눌렀을 때", selection: $store.settings.tapAction) {
                    Text("앱에서 열기").tag(TapAction.openApp)
                    Text("원본 플랫폼에서 열기").tag(TapAction.openPlatform)
                }
                appearanceModePicker
                Picker("기본으로 열 앱", selection: $songOpenPreferenceStore.target) {
                    ForEach(SongOpenTarget.allCases) { target in
                        Text(target.displayName).tag(target)
                    }
                }
                .pickerStyle(.segmented)
                Text("노래 상세 화면의 ‘열기’ 버튼에서 사용할 앱입니다. 공유와 링크 복사에는 YouTube 주소를 사용합니다.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("기록 및 정보") {
                ForEach(hubSections["기록 및 정보"] ?? []) { row in
                    settingsNavigationLink(row)
                }
            }

            #if DEBUG
            Section("진단") {
                Toggle("진단 모드", isOn: $debugModeEnabled)
                Text("켜면 이 화면에 서버 연결 기록을 임시로 표시합니다.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                ForEach(
                    Array(SettingsNavigationPolicy.debugServerConnectionLogs(
                        debugModeEnabled: debugModeEnabled,
                        logs: store.serverConnectionDebugLogs
                    ).enumerated()),
                    id: \.offset
                ) { _, log in
                    Text(log)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
            }
            #endif
        }
        .navigationTitle("설정")
    }

    private func settingsNavigationLink(_ row: SettingsHubRow) -> some View {
        NavigationLink(value: row.route) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(row.title)
                    Text(row.note)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .layoutPriority(1)

                Spacer(minLength: 8)

                Text(row.summary)
                    .foregroundStyle(.secondary)
                    .lineLimit(SettingsNavigationRowLayout.summaryLineLimit)
                    .minimumScaleFactor(SettingsNavigationRowLayout.summaryMinimumScaleFactor)
                    .multilineTextAlignment(.trailing)
            }
            .padding(.vertical, 3)
        }
    }

    private func persistedToggle(_ keyPath: WritableKeyPath<NotificationSettingsState, Bool>) -> Binding<Bool> {
        Binding(
            get: { store.settings[keyPath: keyPath] },
            set: { value in
                store.settings[keyPath: keyPath] = value
                let settings = store.settings
                Task { await serverStore.updatePreferences(settings) }
            }
        )
    }

    private var appearanceModePicker: some View {
        Group {
            Picker("화면 모드", selection: $store.settings.appearanceMode) {
                ForEach(AppearanceMode.allCases) { mode in
                    Text(mode.displayName).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            Text("자동 모드는 기기의 화면 설정을 따릅니다.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

}

/// The destination pushed for each `SettingsRoute`. This is registered as a real, standalone
/// `View` (see `.navigationDestination(for: SettingsRoute.self)` in `GlobalToolbarModifier`)
/// so SwiftUI mounts it into the navigation stack normally and resolves its `@EnvironmentObject`
/// values the standard way, rather than via a bare method call on a manually-constructed
/// `SettingsContentView` instance (which would never receive environment injection).
struct SettingsRouteDestinationView: View {
    let route: SettingsRoute

    @EnvironmentObject private var store: MockHubStore

    var body: some View {
        switch route {
        case .history:
            HistoryView()
        case .delivery:
            deliverySettings
        case .targets:
            targetSettings
        case .platforms:
            platformSettings
        case .eventTypes:
            eventTypeSettings
        case .hubEvents:
            hubEventSettings
        case .advanced:
            advancedSettings
        case .about:
            aboutSettings
        }
    }

    private var deliverySettings: some View {
        Form {
            Section("알림 수신 방식") {
                Toggle("최대한 실시간으로 받기", isOn: $store.settings.realtimeEnabled)
                ForEach(NotificationSettingsState.realtimeDisclosureLines, id: \.self) { line in
                    Text(line)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("방해 금지 시간") {
                Toggle("방해 금지 시간 사용", isOn: $store.settings.quietHours.enabled)
                DatePicker("시작 시간", selection: quietHoursTimeBinding(\.start, fallback: QuietHoursClock.fallbackStart), displayedComponents: .hourAndMinute)
                DatePicker("종료 시간", selection: quietHoursTimeBinding(\.end, fallback: QuietHoursClock.fallbackEnd), displayedComponents: .hourAndMinute)
                Picker("기준 시간대", selection: $store.settings.quietHours.timezone) {
                    ForEach(QuietHoursClock.timeZoneOptions(including: store.settings.quietHours.timezone), id: \.self) { identifier in
                        Text(identifier.isEmpty ? "미설정" : identifier).tag(identifier)
                    }
                }
                .pickerStyle(.navigationLink)
            }

            Section("키워드 필터") {
                TextField("허용 키워드", text: $store.settings.keywordFilters.allowlistText)
                TextField("차단 키워드", text: $store.settings.keywordFilters.blocklistText)
                Text("키워드가 여러 개라면 쉼표로 구분해 주세요. 차단 키워드와 방해 금지 시간은 실시간 우선 설정에도 그대로 적용됩니다.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("알림 빈도 제한") {
                Stepper(value: $store.settings.rateLimit.maxNotificationsPerMinute, in: 1...60) {
                    LabeledContent("1분당 최대 알림 수", value: "\(store.settings.rateLimit.maxNotificationsPerMinute)")
                }
            }
        }
        .navigationTitle("알림 수신 방식")
    }

    private var targetSettings: some View {
        Form {
            Section("분류별 알림") {
                ForEach(store.filters.filter { $0.id != "all" && $0.id != "gamja" }) { filter in
                    Toggle(targetFilterDisplayName(id: filter.id, defaultName: filter.displayName), isOn: generationBinding(filter.id, defaultValue: filter.notificationDefaultEnabled))
                }
            }

            Section("개별 대상 알림") {
                ForEach(store.members.filter { $0.catalogRole != .placeholder }) { member in
                    Toggle(member.koreanName, isOn: memberBinding(member.id, defaultValue: member.notificationEnabled))
                }
            }

        }
        .navigationTitle("대상별 알림")
    }

    private var platformSettings: some View {
        Form {
            Section("플랫폼별 알림") {
                ForEach(NotificationPlatform.allCases) { platform in
                    Toggle(platform.displayName, isOn: platformBinding(platform))
                    if let note = SettingsNavigationPolicy.platformPolicy(platform) {
                        Text(note)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                Text(SettingsNavigationPolicy.platformSettingsCommonNotice)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("플랫폼별 알림")
    }

    private var eventTypeSettings: some View {
        Form {
            Section("알림 종류별 설정") {
                ForEach(NotificationEventType.allCases) { eventType in
                    Toggle(eventType.displayName, isOn: eventTypeBinding(eventType))
                    if let note = SettingsNavigationPolicy.eventTypePolicy(eventType) {
                        Text(note)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                ForEach(SettingsNavigationPolicy.eventTypeSettingsCommonNotices, id: \.self) { notice in
                    Text(notice)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("채팅 알림") {
                Toggle("치지직 채팅 알림", isOn: $store.settings.chzzkChatEnabled)
                    .disabled(!store.settings.keywordFilters.hasExplicitFilters)
                LabeledContent("채팅 푸시 알림", value: store.settings.canEnableChzzkChatPush ? "사용 가능" : "키워드 설정 필요")
                Text("기본적으로 꺼져 있으며, 키워드 또는 역할 필터를 설정한 경우에만 받을 수 있습니다.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("알림 종류")
    }

    private var hubEventSettings: some View {
        Form {
            Section("굿즈/행사") {
                Toggle("굿즈/행사 알림", isOn: platformBinding(.hubEvent))
                Toggle("마감 임박 우선 표시", isOn: eventTypeBinding(.eventDeadlineSoon))
                Toggle("변경 알림", isOn: eventTypeBinding(.eventUpdated))
            }

            Section("포함 기준") {
                LabeledContent("온라인 굿즈", value: "한정 예약, 판매 시작, 마감")
                LabeledContent("오프라인 행사", value: "콘서트, 팝업, 공식 협업")
                LabeledContent("출처", value: "공식 채널, 멤버, 공식 협업처")
            }

            Section("제외 기준") {
                Text(SettingsNavigationPolicy.hubEventPolicyNotice)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Text("공식 이미지, 로고, 포스터는 앱에 저장하거나 재사용하지 않습니다.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("굿즈/행사")
    }

    private var advancedSettings: some View {
        Form {
            Section("알림 우선순위") {
                ForEach(store.settings.combinationPreferences.indices, id: \.self) { index in
                    Toggle(store.settings.combinationPreferences[index].scope.displayName, isOn: $store.settings.combinationPreferences[index].enabled)
                }
            }

            Section("적용 순서") {
                Text("개별 대상에서 선택한 설정은 분류별 설정보다 우선할 수 있습니다. 플랫폼, 알림 종류, 방해 금지 시간, 키워드 필터와 알림 빈도 제한은 그대로 적용됩니다.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("세부 알림 설정")
    }

    private var aboutSettings: some View {
        Form {
            Section("앱") {
                HStack(alignment: .top, spacing: 12) {
                    Text("앱")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.tint)
                        .frame(width: 44, height: 44)
                        .background(.tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))

                    VStack(alignment: .leading, spacing: 4) {
                        Text("스텔라이브 이벤트 알리미")
                            .font(.body.weight(.semibold))
                        Text("굿즈/행사 일정, 멤버 기념일, 플랫폼 알림을 한곳에서 확인하는 비공식 오픈 소스 앱입니다.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                LabeledContent("버전", value: appVersionText)
                LabeledContent("라이선스", value: "Apache-2.0")
            }

            Section("오픈 소스") {
                Link("GitHub 저장소 열기", destination: URL(string: "https://github.com/MinePacu/stellive-event-notifier")!)
            }

            Section("고지") {
                LabeledContent("비공식 프로젝트") {
                    Text("스텔라이브, 치지직, YouTube, 네이버, Samsung, Apple과 공식 관계가 없습니다.")
                        .multilineTextAlignment(.trailing)
                }
            }
        }
        .navigationTitle("앱 정보")
    }

    private var appVersionText: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "-"
        let build = info?["CFBundleVersion"] as? String ?? "-"
        return "\(version) (\(build))"
    }

    private func targetFilterDisplayName(id: String, defaultName: String) -> String {
        id == "gen4-upcoming" ? "합류 예정 멤버" : defaultName
    }

    /// Shows the stored "HH:mm" as a time; a malformed stored value displays `fallback` but is only
    /// replaced once the user actually changes the picker.
    private func quietHoursTimeBinding(_ keyPath: WritableKeyPath<QuietHoursState, String>, fallback: String) -> Binding<Date> {
        Binding {
            QuietHoursClock.displayDate(from: store.settings.quietHours[keyPath: keyPath], fallback: fallback)
        } set: { newValue in
            store.settings.quietHours[keyPath: keyPath] = QuietHoursClock.string(from: newValue)
        }
    }

    private func generationBinding(_ id: String, defaultValue: Bool) -> Binding<Bool> {
        Binding {
            store.settings.generationEnabled[id] ?? defaultValue
        } set: { newValue in
            store.settings.generationEnabled[id] = newValue
        }
    }

    private func memberBinding(_ id: String, defaultValue: Bool) -> Binding<Bool> {
        Binding {
            store.settings.memberEnabled[id] ?? defaultValue
        } set: { newValue in
            store.settings.memberEnabled[id] = newValue
        }
    }

    private func platformBinding(_ platform: NotificationPlatform) -> Binding<Bool> {
        Binding {
            store.settings.platformEnabled[platform] ?? true
        } set: { newValue in
            store.settings.platformEnabled[platform] = newValue
        }
    }

    private func eventTypeBinding(_ eventType: NotificationEventType) -> Binding<Bool> {
        Binding {
            store.settings.eventTypeEnabled[eventType] ?? false
        } set: { newValue in
            store.settings.eventTypeEnabled[eventType] = newValue
        }
    }
}
