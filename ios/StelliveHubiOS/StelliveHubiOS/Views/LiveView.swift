import SwiftUI

struct LiveView: View {
    @EnvironmentObject private var store: MockHubStore
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List {
                HubHeaderCard(
                    iconText: "ON",
                    title: "라이브 상태",
                    subtitle: "현재 방송 중 \(store.liveMemberCount)명",
                    metrics: [
                        .init(value: "\(store.liveMemberCount)", label: "라이브"),
                        .init(value: "\(store.chzzkLiveTargetCount)", label: "대상"),
                        .init(value: "\(store.offlineChzzkTargetCount)", label: "오프라인")
                    ]
                )
                .listRowInsets(IOSGroupedScreenPolicy.headerRowInsets)
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)

                Section("치지직 방송 상태") {
                    ForEach(store.chzzkLiveTargets) { member in
                        LiveMemberRow(member: member)
                    }
                }

                Section {
                    Text("최대한 실시간 모드는 즉시성을 보장하지 않으며 플랫폼/OS/네트워크 정책에 따라 지연될 수 있습니다.")
                }
            }
            .listStyle(.insetGrouped)
            .settingsToolbar(path: $path)
        }
    }
}

private struct LiveMemberRow: View {
    let member: HubMember

    var body: some View {
        HStack(spacing: 12) {
            MemberAvatarView(member: member, size: 42, showsLiveRing: true)

            VStack(alignment: .leading, spacing: 4) {
                Text(member.koreanName)
                    .font(.body)
                    .lineLimit(1)
                TimelineView(.periodic(from: .now, by: 60)) { context in
                    Text(LiveStatusFormatter.statusText(isLive: member.isLive, startedAt: member.liveStartedAt, now: context.date))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 8)

            Text(member.isLive ? "LIVE" : "OFF")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(member.isLive ? Color.teal : Color.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(member.isLive ? Color.teal.opacity(0.14) : Color(.tertiarySystemFill))
                )
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

}
