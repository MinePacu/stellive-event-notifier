import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var store: MockHubStore
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List {
                HubHeaderCard(
                    iconText: "기",
                    title: "알림 기록",
                    subtitle: "최근 알림 \(store.recentNotificationCount)개",
                    metrics: [
                        .init(value: "\(store.recentNotificationCount)", label: "전체"),
                        .init(value: "\(store.realtimeHistoryCount)", label: "실시간"),
                        .init(value: store.averageHistoryLatencySummary, label: "평균 지연")
                    ]
                )
                .listRowInsets(IOSGroupedScreenPolicy.headerRowInsets)
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)

                Section("최근 알림") {
                    ForEach(store.history) { item in
                        HistoryNotificationRow(
                            item: item,
                            member: store.member(for: item)
                        )
                    }
                }

                Section {
                    Text("공식 YouTube 라이브 알림 기록은 생성하지 않습니다.")
                        .secondaryNoticeTextStyle()
                }
            }
            .listStyle(.insetGrouped)
            .settingsToolbar(path: $path)
        }
    }
}

private struct HistoryNotificationRow: View {
    let item: NotificationHistoryItem
    let member: HubMember?

    var body: some View {
        HistoryNotificationRowContent(item: item, member: member)
    }
}

struct HistoryPresentationPolicy {
    static func titleText(for item: NotificationHistoryItem) -> String {
        item.title
    }

    static func subtitleText(for item: NotificationHistoryItem) -> String {
        item.body
    }

    static func metadataText(for item: NotificationHistoryItem) -> String {
        [deliveryLabel(for: item.deliveryMode), latencyLabel(for: item.deliveryLatencyMs)].joined(separator: " · ")
    }

    private static func deliveryLabel(for mode: DeliveryMode) -> String {
        switch mode {
        case .standard:
            return "표준"
        case .realtimeBestEffort:
            return "실시간"
        }
    }

    private static func latencyLabel(for latencyMs: Int?) -> String {
        guard let latencyMs, latencyMs > 0 else {
            return "방금"
        }

        guard latencyMs >= 1000 else {
            return "\(latencyMs)ms"
        }

        let seconds = Double(latencyMs) / 1000
        if seconds.rounded() == seconds {
            return "\(Int(seconds))초"
        }

        return String(format: "%.1f초", seconds)
    }
}

struct HistoryNotificationRowContent: View {
    let item: NotificationHistoryItem
    let member: HubMember?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if let member {
                MemberAvatarView(member: member, size: 40)
            } else {
                HistoryFallbackAvatarView(label: String(item.memberName.prefix(2)))
            }

            VStack(alignment: .leading, spacing: 5) {
                Text(HistoryPresentationPolicy.titleText(for: item))
                    .font(.headline)
                    .lineLimit(2)
                    .minimumScaleFactor(0.86)
                Text(HistoryPresentationPolicy.subtitleText(for: item))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.84)
                Text(HistoryPresentationPolicy.metadataText(for: item))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.84)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}

private struct HistoryFallbackAvatarView: View {
    let label: String

    var body: some View {
        Text(label.isEmpty ? "?" : label)
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .frame(width: 40, height: 40)
            .background(Circle().fill(Color(.systemGray3)))
            .accessibilityHidden(true)
    }
}
