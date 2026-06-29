import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var store: MockHubStore
    @EnvironmentObject private var serverStore: ServerHubStore
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List {
                Section("지금 라이브") {
                    if store.homeLiveMembers.isEmpty {
                        Text("현재 라이브 없음")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(store.homeLiveMembers) { member in
                            NavigationLink(value: member) {
                                MemberRow(member: member)
                            }
                        }
                        if store.hasHomeLiveOverflow {
                            NavigationLink {
                                LiveView()
                            } label: {
                                Label("더보기", systemImage: "chevron.right")
                            }
                        }
                    }
                }

                Section("최근 곡") {
                    if serverStore.recentSongs.isEmpty {
                        Text("최근 곡을 불러오는 중입니다.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(serverStore.recentSongs) { song in
                            SongRow(song: song, catalogMembers: store.members)
                                .listRowInsets(IOSSongPagePolicy.songRowInsets)
                        }
                    }

                    NavigationLink {
                        SongsView()
                    } label: {
                        Text("노래 전체 보기")
                    }
                }

                Section("최근 알림") {
                    if store.recentHistoryPreview.isEmpty {
                        Text("최근 알림 없음")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(store.recentHistoryPreview) { item in
                            HomeHistoryRow(
                                item: item,
                                member: store.member(for: item)
                            )
                        }
                    }
                }

                Section("마감 임박 굿즈/행사") {
                    if store.closingSoonHubEvents.isEmpty {
                        NavigationLink {
                            HubEventsView()
                        } label: {
                            Text("마감 임박 항목 없음")
                        }
                    } else {
                        ForEach(store.closingSoonHubEvents) { event in
                            NavigationLink {
                                HubEventDetailView(event: event)
                            } label: {
                                HomeHubEventRow(event: event)
                            }
                        }

                        NavigationLink {
                            HubEventsView()
                        } label: {
                            Text("굿즈/행사 전체 보기")
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .settingsToolbar(path: $path)
            .navigationDestination(for: HubMember.self) { member in
                MemberDetailView(member: member)
            }
            .task {
                await serverStore.refreshRecentSongs()
            }
        }
    }
}

private struct HomeHistoryRow: View {
    let item: NotificationHistoryItem
    let member: HubMember?

    var body: some View {
        HistoryNotificationRowContent(
            item: item,
            member: member
        )
    }
}

private struct HomeHubEventRow: View {
    let event: HubEvent

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            VStack(alignment: .leading, spacing: 5) {
                Text(event.title)
                    .font(.headline)
                    .lineLimit(2)
                    .minimumScaleFactor(0.86)
                Text([event.category.displayName, event.participationMode.displayName, event.sourceLabel].joined(separator: " · "))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.84)
            }
            .layoutPriority(1)

            Spacer(minLength: 8)

            Text(event.status.displayName)
                .font(.caption.weight(.semibold))
                .foregroundStyle(event.status == .closingSoon ? Color.red : Color.teal)
                .lineLimit(HubEventStatusRowLayout.statusLineLimit)
                .minimumScaleFactor(HubEventStatusRowLayout.statusMinimumScaleFactor)
                .multilineTextAlignment(.trailing)
                .fixedSize(horizontal: HubEventStatusRowLayout.preservesStatusIntrinsicWidth, vertical: false)
        }
        .accessibilityElement(children: .combine)
    }
}

private extension DeliveryMode {
    var displayName: String {
        switch self {
        case .standard:
            return "표준"
        case .realtimeBestEffort:
            return "실시간 우선"
        }
    }
}

private struct HubEventPreviewBadge: View {
    let event: HubEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(event.title)
                .font(.caption.weight(.medium))
                .foregroundStyle(.primary)
                .lineLimit(2)
                .minimumScaleFactor(0.82)
            Text(event.status.displayName)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(event.status == .closingSoon ? Color.red : Color.teal)
                .lineLimit(1)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill((event.status == .closingSoon ? Color.red : Color.teal).opacity(0.14))
                )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(.tertiarySystemGroupedBackground))
        )
    }
}

struct HubHeaderMetric: Identifiable {
    let value: String
    let label: String

    var id: String { label }
}

struct IOSGroupedScreenPolicy {
    struct Screen: Equatable {
        let id: String
        let usesInsetGroupedList: Bool
        let wrapsRowsInGroupedCards: Bool
    }

    enum FilterPlacement {
        case groupedSection
    }

    enum SecondaryNoticeStyle: Equatable {
        case settingsFootnoteSecondary
    }

    static let groupedScreens: [Screen] = [
        .init(id: "live", usesInsetGroupedList: true, wrapsRowsInGroupedCards: true),
        .init(id: "history", usesInsetGroupedList: true, wrapsRowsInGroupedCards: true),
        .init(id: "hubEvents", usesInsetGroupedList: true, wrapsRowsInGroupedCards: true)
    ]

    static let headerHorizontalContentInset = 0.0
    static let headerRowInsets = EdgeInsets(top: 0, leading: headerHorizontalContentInset, bottom: 10, trailing: headerHorizontalContentInset)
    static let hubEventsFilterPlacement: FilterPlacement = .groupedSection
    static let secondaryNoticeStyle: SecondaryNoticeStyle = .settingsFootnoteSecondary
    static let darkModeGuidance = "Avoid placing secondary content in a plain list on dark backgrounds; wrap summaries, filters, rows, and notices in grouped card surfaces."
}

private struct SecondaryNoticeTextModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.footnote)
            .foregroundStyle(.secondary)
    }
}

extension View {
    func secondaryNoticeTextStyle() -> some View {
        modifier(SecondaryNoticeTextModifier())
    }
}

enum HubEventStatusRowVerticalAlignment: Equatable {
    case center
}

enum HubEventStatusRowLayout {
    static let trailingStatusVerticalAlignment: HubEventStatusRowVerticalAlignment = .center
    static let statusLineLimit = 1
    static let statusMinimumScaleFactor = 0.85
    static let preservesStatusIntrinsicWidth = true
}

struct HubHeaderCard: View {
    let iconText: String
    let title: String
    let subtitle: String
    let metrics: [HubHeaderMetric]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center, spacing: 12) {
                Text(iconText)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(width: 56, height: 56)
                    .background(
                        RoundedRectangle(cornerRadius: 15, style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [.teal, .blue],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    )
                    .shadow(color: .teal.opacity(0.24), radius: 12, y: 6)

                VStack(alignment: .leading, spacing: 5) {
                    Text(title)
                        .font(.title3.weight(.bold))
                        .lineLimit(2)
                        .minimumScaleFactor(0.82)
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }

            HStack(spacing: 8) {
                ForEach(metrics) { metric in
                    HeaderMetric(value: metric.value, label: metric.label)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(.white.opacity(0.05), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}

private struct HeaderMetric: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(value)
                .font(.headline.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.72)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 13, style: .continuous)
                .fill(Color(.tertiarySystemGroupedBackground))
        )
    }
}

struct MemberRow: View {
    let member: HubMember

    var body: some View {
        HStack(spacing: 12) {
            MemberAvatarView(member: member)

            VStack(alignment: .leading, spacing: 4) {
                Text(member.koreanName).font(.headline)
                Text([member.generationName, member.roleLabel].compactMap { $0 }.joined(separator: " · "))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            Text(platformText)
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(member.catalogRole == .officialChannel ? "공식" : (member.isLive ? "LIVE" : "OFF"))
                    .font(.caption.weight(.semibold))
                if member.isLive {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        if let elapsed = LiveStatusFormatter.elapsedClockText(startedAt: member.liveStartedAt, now: context.date) {
                            LiveSideMetric(systemImage: "clock", value: elapsed, color: .secondary)
                        }
                    }
                    if let viewers = LiveStatusFormatter.viewerCountText(member.liveViewerCount) {
                        LiveSideMetric(systemImage: "eye", value: viewers, color: .teal)
                    }
                } else {
                    Text(member.realtimeEnabled ? "실시간 우선" : "표준")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var platformText: String {
        var labels: [String] = []
        if member.chzzkChannelId != nil { labels.append("CHZZK") }
        if member.youtubeHandle != nil { labels.append("YouTube") }
        if member.xHandle != nil { labels.append("X") }
        return labels.joined(separator: " · ")
    }
}

struct MemberAvatarView: View {
    let member: HubMember
    var size: CGFloat = 44
    var showsLiveRing = false

    var body: some View {
        ZStack {
            Text(label)
                .font(.system(size: max(12, size * 0.34), weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let channelImageURL = member.channelImageURL {
                AsyncImage(url: channelImageURL) { phase in
                    if let image = phase.image {
                        image
                            .resizable()
                            .scaledToFill()
                    }
                }
            }
        }
            .frame(width: size, height: size)
            .background(avatarShape.fill(backgroundColor))
            .clipShape(avatarShape)
            .overlay {
                if showsLiveRing && member.isLive {
                    avatarShape.stroke(Color.teal, lineWidth: 2)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if member.isLive {
                    Circle()
                        .fill(Color.green)
                        .frame(width: max(10, size * 0.27), height: max(10, size * 0.27))
                        .overlay(Circle().stroke(Color(.systemBackground), lineWidth: 2))
                }
            }
            .accessibilityHidden(true)
    }

    private var label: String {
        member.catalogRole == .officialChannel ? "공식" : String(member.koreanName.prefix(2))
    }

    private var backgroundColor: Color {
        switch member.catalogRole {
        case .officialChannel:
            return Color(.systemGray)
        case .placeholder:
            return Color(.systemGray3)
        default:
            return .teal
        }
    }

    private var avatarShape: RoundedRectangle {
        RoundedRectangle(
            cornerRadius: member.catalogRole == .officialChannel ? size * 0.22 : size / 2,
            style: .continuous
        )
    }
}
