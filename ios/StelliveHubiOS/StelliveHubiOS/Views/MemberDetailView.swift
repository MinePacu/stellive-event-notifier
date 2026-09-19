import SwiftUI

struct MemberDetailView: View {
    let member: HubMember

    @EnvironmentObject private var store: MockHubStore

    var body: some View {
        Form {
            Section {
                HStack {
                    Text(String(member.koreanName.prefix(1)))
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 56, height: 56)
                        .background(Circle().fill(Color.hubTealFill))
                    VStack(alignment: .leading) {
                        Text(member.koreanName).font(.headline)
                        Text([member.generationName, member.roleLabel].compactMap { $0 }.joined(separator: " · "))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Section("알림") {
                Toggle("항목 알림", isOn: memberBinding(member.id, defaultValue: member.notificationEnabled))
                Toggle("최대한 실시간 모드", isOn: $store.settings.realtimeEnabled)
                LabeledContent("YouTube 업로드", value: member.youtubeHandle != nil ? "지원함" : "지원 안 함")
                if member.catalogRole == .officialChannel {
                    LabeledContent("공식 YouTube 라이브", value: "지원하지 않음")
                }
            }

            Section("이미지") {
                Text("기본 placeholder를 사용합니다. 공식 API가 반환하는 URL만 조건부로 표시하고, 권리 요청 시 placeholder로 전환할 수 있어야 합니다.")
            }
        }
        .navigationTitle(member.koreanName)
    }

    private func memberBinding(_ id: String, defaultValue: Bool) -> Binding<Bool> {
        Binding {
            store.settings.memberEnabled[id] ?? defaultValue
        } set: { newValue in
            store.settings.memberEnabled[id] = newValue
        }
    }
}
