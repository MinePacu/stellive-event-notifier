import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var store: MockHubStore

    var body: some View {
        NavigationStack {
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
                .listRowInsets(EdgeInsets(top: 18, leading: 16, bottom: 10, trailing: 16))
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
                }
            }
            .listStyle(.plain)
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

private struct HistoryNotificationRow: View {
    let item: NotificationHistoryItem
    let member: HubMember?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if let member {
                MemberAvatarView(member: member, size: 40)
            } else {
                HistoryFallbackAvatarView(label: String(item.memberName.prefix(2)))
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.headline)
                    .lineLimit(2)
                    .minimumScaleFactor(0.88)
                Text(item.body)
                    .font(.body)
                    .lineLimit(2)
                    .foregroundStyle(.primary)
                Text("\(item.eventType) · \(item.deliveryMode.rawValue) · \(item.deliveryLatencyMs ?? 0)ms")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.82)
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
