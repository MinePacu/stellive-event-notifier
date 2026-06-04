import SwiftUI

enum SettingsRoute: String, CaseIterable, Hashable {
    case delivery
    case targets
    case platforms
    case eventTypes
    case hubEvents
    case advanced
}

struct SettingsHubRow: Identifiable, Equatable {
    let route: SettingsRoute
    let title: String
    let note: String
    let summary: String

    var id: SettingsRoute { route }
}

struct SettingsToggleRow: Identifiable, Equatable {
    let id: String
    let title: String
    let note: String
    let isEnabled: Bool
}

enum SettingsNavigationPolicy {
    static let hubEventPolicyNotice = "대표/강지 이벤트, 팬 주최 이벤트, 루틴 방송/라이브/업로드는 MVP 굿즈/행사 피드에 포함하지 않습니다."

    static func hubRows(settings: NotificationSettingsState, members: [HubMember]) -> [SettingsHubRow] {
        [
            SettingsHubRow(
                route: .delivery,
                title: "전달 방식",
                note: "표준, 실시간 우선, 조용한 시간",
                summary: settings.realtimeEnabled ? "실시간 우선" : "표준"
            ),
            SettingsHubRow(
                route: .targets,
                title: "대상별 알림",
                note: "기수, 감자, 기타, 개별 항목",
                summary: enabledSummary(
                    values: settings.generationEnabled.values.map { $0 } + members.filter { $0.catalogRole != .placeholder }.map { settings.memberEnabled[$0.id] ?? $0.notificationEnabled }
                )
            ),
            SettingsHubRow(
                route: .platforms,
                title: "플랫폼별 알림",
                note: "CHZZK, YouTube, X, 굿즈/행사",
                summary: enabledSummary(values: NotificationPlatform.allCases.map { settings.platformEnabled[$0] ?? false })
            ),
            SettingsHubRow(
                route: .eventTypes,
                title: "이벤트 타입별 알림",
                note: "방송, 업로드, 공식, 굿즈/행사",
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
                title: "고급 조합 설정",
                note: "카테고리/개별 항목별 예외 규칙",
                summary: "예외 규칙"
            )
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
                note: "공식/멤버/공식 콜라보 출처가 있는 기간성 정보만 포함합니다.",
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
                note: "콘서트, 팝업, 공식 콜라보를 포함합니다.",
                isEnabled: settings.platformEnabled[.hubEvent] ?? false
            ),
            SettingsToggleRow(
                id: NotificationEventType.eventDeadlineSoon.rawValue,
                title: "마감 임박 우선 표시",
                note: "홈과 최근 알림에 우선 배치합니다.",
                isEnabled: settings.eventTypeEnabled[.eventDeadlineSoon] ?? false
            ),
            SettingsToggleRow(
                id: NotificationEventType.eventUpdated.rawValue,
                title: "변경 알림",
                note: "MVP에서는 기본 OFF입니다.",
                isEnabled: settings.eventTypeEnabled[.eventUpdated] ?? false
            )
        ]
    }

    static func eventTypePolicy(_ eventType: NotificationEventType) -> String {
        switch eventType {
        case .chzzkChat:
            return "기본 OFF입니다. 명시 필터가 없으면 푸시 전송 대상으로 쓰지 않습니다."
        case .youtubeLiveScheduled, .youtubeLiveStarted, .youtubeLiveEnded:
            return "공식 채널에는 적용하지 않음. 일반 채널 정책으로만 유지합니다."
        case .officialYoutubeUpload:
            return "스텔라이브 공식 YouTube는 업로드 알림만 지원합니다."
        case .cafePost:
            return "무단 수집, 로그인 쿠키 수집, 비공개 접근 우회 없이 공식 경로만 사용합니다."
        case .eventAnnounced:
            return "공식/멤버/공식 콜라보 출처가 있는 기간성 정보만 포함합니다."
        case .eventSalesOpen:
            return "굿즈, 티켓, 오프라인 행사의 예약/판매 시작 알림입니다."
        case .eventDeadlineSoon:
            return "예약/판매 종료가 가까운 항목을 홈과 알림에 우선 표시합니다."
        case .eventUpdated:
            return "굿즈/행사 변경 알림이며 MVP에서는 기본 OFF입니다."
        case .eventCancelled:
            return "공식 출처의 취소 안내만 전송합니다."
        default:
            return "사용자 설정, 조용한 시간, 차단 키워드, rate limit 적용 후 전송합니다."
        }
    }

    private static func enabledSummary(values: [Bool]) -> String {
        "\(values.filter { $0 }.count)/\(values.count)"
    }

    private static func hubEventSummary(settings: NotificationSettingsState) -> String {
        guard settings.platformEnabled[.hubEvent] ?? false else { return "꺼짐" }
        return (settings.eventTypeEnabled[.eventDeadlineSoon] ?? false) ? "켜짐 · 마감 임박 ON" : "켜짐"
    }
}

struct SettingsView: View {
    @EnvironmentObject private var store: MockHubStore

    var body: some View {
        NavigationStack {
            Form {
                Section("전체") {
                    Toggle("전체 알림", isOn: $store.settings.globalEnabled)
                    Picker("터치 동작", selection: $store.settings.tapAction) {
                        Text("앱에서 열기").tag(TapAction.openApp)
                        Text("원 플랫폼에서 열기").tag(TapAction.openPlatform)
                    }
                }

                Section("화면 모드") {
                    appearanceModePicker
                }

                Section("알림 설정") {
                    ForEach(SettingsNavigationPolicy.hubRows(settings: store.settings, members: store.members)) { row in
                        NavigationLink(value: row.route) {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(row.title)
                                    Spacer()
                                    Text(row.summary)
                                        .foregroundStyle(.secondary)
                                }
                                Text(row.note)
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 3)
                        }
                    }
                }

                Section("표시 정책") {
                    LabeledContent("Former 멤버", value: "MVP 제외")
                    LabeledContent("강지", value: "감자 대표 항목")
                    LabeledContent("공식 이미지/로고/포스터", value: "저장/재사용 안 함")
                    Text("홈은 현재 라이브, 최근 알림, 마감 임박 굿즈/행사를 우선 표시하고, 알림 대상과 전송 정책은 설정에서 관리합니다.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("설정")
            .navigationDestination(for: SettingsRoute.self) { route in
                settingsDestination(route)
            }
        }
    }

    private var appearanceModePicker: some View {
        Group {
            Picker("화면 모드", selection: $store.settings.appearanceMode) {
                ForEach(AppearanceMode.allCases) { mode in
                    Text(mode.displayName).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            Text("자동은 기기의 시스템 설정을 따릅니다.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func settingsDestination(_ route: SettingsRoute) -> some View {
        switch route {
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
        }
    }

    private var deliverySettings: some View {
        Form {
            Section("전달 방식") {
                Toggle("최대한 실시간으로 알림 받기", isOn: $store.settings.realtimeEnabled)
                ForEach(NotificationSettingsState.realtimeDisclosureLines, id: \.self) { line in
                    Text(line)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("조용한 시간") {
                Toggle("조용한 시간 적용", isOn: $store.settings.quietHours.enabled)
                TextField("시작", text: $store.settings.quietHours.start)
                TextField("종료", text: $store.settings.quietHours.end)
                TextField("시간대", text: $store.settings.quietHours.timezone)
            }

            Section("키워드 필터") {
                TextField("허용 키워드", text: $store.settings.keywordFilters.allowlistText)
                TextField("차단 키워드", text: $store.settings.keywordFilters.blocklistText)
                Text("쉼표로 여러 키워드를 구분합니다. 차단 키워드와 조용한 시간은 최대한 실시간 모드에도 계속 적용됩니다.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Rate limit") {
                Stepper(value: $store.settings.rateLimit.maxNotificationsPerMinute, in: 1...60) {
                    LabeledContent("분당 최대 알림", value: "\(store.settings.rateLimit.maxNotificationsPerMinute)")
                }
            }
        }
        .navigationTitle("전달 방식")
    }

    private var targetSettings: some View {
        Form {
            Section("기수/분류별 알림") {
                ForEach(store.filters.filter { $0.id != "all" }) { filter in
                    Toggle(filter.displayName, isOn: generationBinding(filter.id, defaultValue: filter.notificationDefaultEnabled))
                }
            }

            Section("개별 항목별 알림") {
                ForEach(store.members.filter { $0.catalogRole != .placeholder }) { member in
                    Toggle(member.koreanName, isOn: memberBinding(member.id, defaultValue: member.notificationEnabled))
                }
            }

            Section("대상 정책") {
                LabeledContent("Former 멤버", value: "MVP 제외")
                LabeledContent("강지", value: "감자 대표 항목")
                LabeledContent("공식 채널", value: "기타")
            }
        }
        .navigationTitle("대상별 알림")
    }

    private var platformSettings: some View {
        Form {
            Section("플랫폼별 알림") {
                ForEach(NotificationPlatform.allCases) { platform in
                    Toggle(platform.displayName, isOn: platformBinding(platform))
                    Text(platformPolicy(platform))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("플랫폼별 알림")
    }

    private var eventTypeSettings: some View {
        Form {
            Section("이벤트 타입별 알림") {
                ForEach(NotificationEventType.allCases) { eventType in
                    Toggle(eventType.displayName, isOn: eventTypeBinding(eventType))
                    Text(SettingsNavigationPolicy.eventTypePolicy(eventType))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("채팅 알림") {
                Toggle("치지직 채팅 알림", isOn: $store.settings.chzzkChatEnabled)
                    .disabled(!store.settings.keywordFilters.hasExplicitFilters)
                LabeledContent("Push 전달 가능", value: store.settings.canEnableChzzkChatPush ? "필터 설정됨" : "필터 필요")
                Text("기본 off입니다. 키워드 또는 역할 필터를 설정한 경우에만 제한적으로 사용합니다.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("이벤트 타입")
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
                LabeledContent("오프라인 행사", value: "콘서트, 팝업, 공식 콜라보")
                LabeledContent("출처", value: "공식/멤버/공식 콜라보")
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
            Section("고급 조합 설정") {
                ForEach(store.settings.combinationPreferences.indices, id: \.self) { index in
                    Toggle(store.settings.combinationPreferences[index].label, isOn: $store.settings.combinationPreferences[index].enabled)
                }
            }

            Section("해석 순서") {
                Text("개별 명시 설정은 카테고리 설정을 덮어쓸 수 있습니다. 플랫폼, 이벤트 타입, 조용한 시간, 키워드, rate limit은 이후에도 계속 적용됩니다.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("고급 조합 설정")
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

    private func platformPolicy(_ platform: NotificationPlatform) -> String {
        switch platform {
        case .naverCafe:
            return "공식 API와 약관을 우선합니다. 무단 수집이나 로그인 쿠키 수집은 사용하지 않습니다."
        case .hubEvent:
            return "공식 출처가 있는 기간성 굿즈, 티켓, 오프라인 행사만 포함합니다."
        default:
            return "플랫폼 OFF이면 해당 플랫폼 이벤트 푸시를 차단합니다."
        }
    }

}
