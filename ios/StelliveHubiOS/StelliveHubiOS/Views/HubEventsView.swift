import SwiftUI

struct HubEventsView: View {
    @EnvironmentObject private var store: MockHubStore
    @State private var selectedFilter = "all"

    private let filters: [(id: String, title: String)] = [
        ("all", "전체"),
        ("goods", "굿즈"),
        ("ticketing", "티켓"),
        ("offline", "오프라인"),
        ("closing", "마감 임박")
    ]

    var body: some View {
        List {
            HubHeaderCard(
                iconText: "굿",
                title: "굿즈/행사",
                subtitle: "공식 출처의 기간성 정보",
                metrics: [
                    .init(value: "\(store.hubEventsSummary.openCount)", label: "진행 중"),
                    .init(value: "\(store.hubEventsSummary.upcomingCount)", label: "예정"),
                    .init(value: "\(store.hubEventsSummary.closingSoonCount)", label: "마감 임박")
                ]
            )
            .listRowInsets(EdgeInsets(top: 18, leading: 16, bottom: 10, trailing: 16))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(filters, id: \.id) { filter in
                        Button {
                            selectedFilter = filter.id
                        } label: {
                            Text(filter.title)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(selectedFilter == filter.id ? Color.teal : Color.secondary)
                                .lineLimit(1)
                                .padding(.horizontal, 13)
                                .padding(.vertical, 8)
                                .background(
                                    Capsule()
                                        .fill(selectedFilter == filter.id ? Color.teal.opacity(0.16) : Color(.tertiarySystemFill))
                                )
                                .overlay(
                                    Capsule()
                                        .stroke(selectedFilter == filter.id ? Color.teal.opacity(0.28) : Color.clear, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(selectedFilter == filter.id ? .isSelected : [])
                    }
                }
            }
            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)

            Section("목록") {
                ForEach(store.hubEvents(for: selectedFilter)) { event in
                    NavigationLink {
                        HubEventDetailView(event: event)
                    } label: {
                        HubEventRow(event: event)
                    }
                }
            }

            Section {
                Text("방송/라이브/업로드와 팬 주최 이벤트는 굿즈/행사 피드에 포함하지 않습니다.")
            }
        }
        .listStyle(.plain)
        .navigationTitle("굿즈/행사")
    }
}

private struct HubEventRow: View {
    let event: HubEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(event.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.88)

                Spacer(minLength: 8)

                HubEventStatusBadge(status: event.status)
            }

            Text([event.category.displayName, event.participationMode.displayName, event.sourceLabel]
                .joined(separator: " · "))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .minimumScaleFactor(0.82)

            if let summary = event.summary, !summary.isEmpty {
                Text(summary)
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

private struct HubEventStatusBadge: View {
    let status: HubEventStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(status == .closingSoon ? Color.red : Color.teal)
            .lineLimit(1)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill((status == .closingSoon ? Color.red : Color.teal).opacity(0.14))
            )
    }
}

