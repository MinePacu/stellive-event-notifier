import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var store: MockHubStore

    var body: some View {
        NavigationStack {
            List {
                Section("지금 라이브") {
                    if store.liveMembers.isEmpty {
                        Text("현재 라이브 없음")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(store.liveMembers) { member in
                            NavigationLink(value: member) {
                                MemberRow(member: member)
                            }
                        }
                    }
                }

                Section("최근 알림") {
                    if store.recentHistoryPreview.isEmpty {
                        Text("최근 알림 없음")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(store.recentHistoryPreview) { item in
                            HomeHistoryRow(item: item)
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
                                HubEventPreviewBadge(event: event)
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
            .navigationTitle("홈")
            .navigationDestination(for: HubMember.self) { member in
                MemberDetailView(member: member)
            }
        }
    }
}

private struct HomeHistoryRow: View {
    let item: NotificationHistoryItem

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(item.title)
                .font(.headline)
                .lineLimit(2)
                .minimumScaleFactor(0.86)
            Text(item.body)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .minimumScaleFactor(0.84)
            Text([item.eventType, item.deliveryMode.displayName].joined(separator: " · "))
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
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
                Text(member.realtimeEnabled ? "실시간 우선" : "표준")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
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
        Text(label)
            .font(.system(size: max(12, size * 0.34), weight: .bold))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .frame(width: size, height: size)
            .background(avatarShape.fill(backgroundColor))
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
