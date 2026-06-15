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
                subtitle: "현재 방송 중 \(store.liveMemberCount)명 · \(store.liveStatusSourceLabel)",
                    metrics: [
                        .init(value: "\(store.liveMemberCount)", label: "라이브"),
                        .init(value: "\(store.chzzkLiveTargetCount)", label: "CHZZK 대상"),
                        .init(value: "\(store.offlineChzzkTargetCount)", label: "오프라인")
                    ]
                )
                .listRowInsets(IOSGroupedScreenPolicy.headerRowInsets)
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)

                Section("치지직 방송 상태") {
                    ForEach(store.chzzkLiveTargets) { member in
                        LiveMemberRow(
                            member: member,
                            moveUp: { store.moveLiveMember(member, offset: -1) },
                            moveDown: { store.moveLiveMember(member, offset: 1) }
                        )
                    }
                }

                Section {
                    Text("최대한 실시간 모드는 즉시성을 보장하지 않으며 플랫폼/OS/네트워크 정책에 따라 지연될 수 있습니다.")
                        .secondaryNoticeTextStyle()
                }
            }
            .refreshable {
                await refreshLiveStatus()
            }
            .listStyle(.insetGrouped)
            .settingsToolbar(path: $path)
        }
    }

    private func refreshLiveStatus() async {
        guard let baseURL = Bundle.main.liveViewHubBaseURL else { return }
        _ = await ServerHubStore(
            api: HubAPIClient(baseURL: baseURL),
            fallback: store
        ).bootstrap()
    }
}

struct LiveSideMetric: View {
    let systemImage: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: systemImage)
                .font(.caption2.weight(.semibold))
                .frame(width: 12)
            Text(value)
                .font(.caption2.weight(.semibold))
                .monospacedDigit()
        }
        .foregroundStyle(color)
        .lineLimit(1)
    }
}

private extension Bundle {
    var liveViewHubBaseURL: URL? {
        guard let value = object(forInfoDictionaryKey: "HubBaseURL") as? String,
              value.isEmpty == false,
              value.contains("$(") == false
        else {
            return nil
        }
        return URL(string: value)
    }
}

private struct LiveMemberRow: View {
    let member: HubMember
    let moveUp: () -> Void
    let moveDown: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            MemberAvatarView(member: member, size: 42, showsLiveRing: true)

            VStack(alignment: .leading, spacing: 2) {
                Text(member.koreanName)
                    .font(.body)
                    .lineLimit(1)
                Text("\(member.generationName) · \(member.unitName)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            Text(member.isLive ? LiveStatusFormatter.liveTitleText(member.liveTitle) : LiveStatusFormatter.statusText(isLive: member.isLive, startedAt: member.liveStartedAt))
                .font(.caption.weight(member.isLive ? .semibold : .regular))
                .foregroundStyle(member.isLive ? .primary : .secondary)
                .lineLimit(2)
                .padding(.top, 2)
            if member.isLive, let livePlatformURL = member.livePlatformURL {
                Link("CHZZK에서 보기", destination: livePlatformURL)
                    .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(Color.teal.opacity(0.14)))
                }
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 4) {
                Text(member.isLive ? "LIVE" : "OFF")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(member.isLive ? Color.teal : Color.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(member.isLive ? Color.teal.opacity(0.14) : Color(.tertiarySystemFill))
                    )
                if member.isLive {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        if let elapsed = LiveStatusFormatter.elapsedClockText(startedAt: member.liveStartedAt, now: context.date) {
                            LiveSideMetric(systemImage: "clock", value: elapsed, color: .secondary)
                        }
                    }
                    if let viewers = LiveStatusFormatter.viewerCountText(member.liveViewerCount) {
                        LiveSideMetric(systemImage: "eye", value: viewers, color: .teal)
                    }
                }
            }
            VStack(spacing: 5) {
                Button("위", action: moveUp)
                Button("아래", action: moveDown)
            }
            .font(.caption2.weight(.semibold))
            .buttonStyle(.bordered)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

}
