import SwiftUI

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

                Section("전달 방식") {
                    Toggle("최대한 실시간으로 알림 받기", isOn: $store.settings.realtimeEnabled)
                    ForEach(NotificationSettingsState.realtimeDisclosureLines, id: \.self) { line in
                        Text(line)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

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

                Section("플랫폼별 알림") {
                    ForEach(NotificationPlatform.allCases) { platform in
                        Toggle(platform.displayName, isOn: platformBinding(platform))
                    }
                }

                Section("이벤트 타입별 알림") {
                    ForEach(NotificationEventType.allCases) { eventType in
                        Toggle(eventType.displayName, isOn: eventTypeBinding(eventType))
                    }
                }

                Section("공식 채널") {
                    Toggle("스텔라이브 공식 X 게시글", isOn: eventTypeBinding(.officialXPost))
                    Toggle("스텔라이브 공식 YouTube 업로드", isOn: eventTypeBinding(.officialYoutubeUpload))
                    LabeledContent("스텔라이브 공식 YouTube 라이브", value: "지원하지 않음")
                }

                Section("고급 조합 설정") {
                    ForEach(store.settings.combinationPreferences.indices, id: \.self) { index in
                        Toggle(store.settings.combinationPreferences[index].label, isOn: $store.settings.combinationPreferences[index].enabled)
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

                Section("채팅 알림") {
                    Toggle("치지직 채팅 알림", isOn: $store.settings.chzzkChatEnabled)
                        .disabled(!store.settings.keywordFilters.hasExplicitFilters)
                    LabeledContent("Push 전달 가능", value: store.settings.canEnableChzzkChatPush ? "필터 설정됨" : "필터 필요")
                    Text("기본 off입니다. 키워드 또는 역할 필터를 설정한 경우에만 제한적으로 사용합니다.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("설정")
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
