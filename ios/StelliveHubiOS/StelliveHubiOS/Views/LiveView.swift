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
                        .init(value: "\(store.offlineChzzkTargetCount)", label: "오프라인"),
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
                        .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
                        .listRowSeparator(.hidden)
                        .accessibilityAction(named: "위로 이동") {
                            store.moveLiveMember(member, offset: -1)
                        }
                        .accessibilityAction(named: "아래로 이동") {
                            store.moveLiveMember(member, offset: 1)
                        }
                    }
                    .onMove(perform: store.moveLiveMember)
                }
            }
            .refreshable {
                await refreshLiveStatus()
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color(uiColor: .systemGroupedBackground))
            .settingsToolbar(path: $path)
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func refreshLiveStatus() async {
        guard
            let value = Bundle.main.object(forInfoDictionaryKey: "HubBaseURL") as? String,
            value.isEmpty == false,
            value.contains("$(") == false,
            let baseURL = URL(string: value)
        else { return }

        _ = await ServerHubStore(api: HubAPIClient(baseURL: baseURL), fallback: store).bootstrap()
    }
}

private struct LiveMemberRow: View {
    let member: HubMember
    let moveUp: () -> Void
    let moveDown: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            MemberAvatarView(member: member, size: 44, showsLiveRing: true)

            VStack(alignment: .leading, spacing: 6) {
                Text(member.koreanName)
                    .font(.headline)

                Text("\(member.generationName) · \(member.roleLabel ?? "멤버")")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(
                    member.isLive
                    ? LiveStatusFormatter.liveTitleText(member.liveTitle)
                    : LiveStatusFormatter.statusText(isLive: member.isLive, startedAt: member.liveStartedAt)
                )
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if member.isLive, let category = LiveStatusFormatter.liveCategoryText(member.liveCategory) {
                    Text(category)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(Color(uiColor: .tertiarySystemGroupedBackground))
                        )
                }

                if member.isLive, let livePlatformURL = member.livePlatformURL {
                    Link("CHZZK에서 보기", destination: livePlatformURL)
                        .font(.caption.weight(.semibold))
                }
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 8) {
                Text(member.isLive ? "LIVE" : "OFF")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(member.isLive ? .red : .secondary)

                if member.isLive {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        VStack(alignment: .trailing, spacing: 4) {
                            if let elapsed = LiveStatusFormatter.elapsedClockText(
                                startedAt: member.liveStartedAt,
                                now: context.date
                            ) {
                                LiveSideMetric(systemImage: "clock", value: elapsed, color: .secondary)
                            }

                            if let viewers = LiveStatusFormatter.viewerCountText(member.liveViewerCount) {
                                LiveSideMetric(systemImage: "eye", value: viewers, color: .teal)
                            }
                        }
                    }
                }

                Image(systemName: "line.3.horizontal")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .accessibilityElement(children: .combine)
        .accessibilityHint("길게 눌러 순서를 변경합니다.")
    }
}

struct LiveSideMetric: View {
    let systemImage: String
    let value: String?
    let color: Color

    var body: some View {
        if let value {
            HStack(spacing: 4) {
                Image(systemName: systemImage)
                    .frame(width: 12, height: 12)
                Text(value)
                    .frame(height: 12)
            }
            .font(.caption2.monospacedDigit())
            .foregroundStyle(color)
            .frame(height: 14, alignment: .center)
        }
    }
}
