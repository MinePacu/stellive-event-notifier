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
            .listRowInsets(IOSGroupedScreenPolicy.headerRowInsets)
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)

            Section("필터") {
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
                .listRowInsets(EdgeInsets(top: 10, leading: 14, bottom: 10, trailing: 14))
            }

            Section("캘린더") {
                HubEventsCalendarView(days: store.calendarDays(for: selectedFilter))
            }

            ForEach(store.calendarDays(for: selectedFilter)) { day in
                Section(day.date) {
                    ForEach(day.entries) { entry in
                        if HubCalendarDeepLinkPolicy.canNavigateToDetail(entry),
                           let event = store.hubEvents.first(where: { $0.id == entry.eventId }) {
                            NavigationLink {
                                HubEventDetailView(event: event)
                            } label: {
                                HubCalendarRow(entry: entry)
                            }
                        } else {
                            HubCalendarRow(entry: entry)
                        }
                    }
                }
            }

            Section {
                Text("팬 주최 이벤트는 추후 추가를 검토 중에 있습니다.")
                    .secondaryNoticeTextStyle()
            }
        }
        .listStyle(.insetGrouped)
    }
}

private struct HubEventRow: View {
    let event: HubEvent

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 8) {
                if let thumbnailURL = HubEventImagePolicy.displayURL(for: event.image) {
                    HubEventRemoteImage(url: thumbnailURL)
                }

                Text(event.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.88)

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
            .layoutPriority(1)

            Spacer(minLength: 8)

            HubEventStatusBadge(status: event.status)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}

struct HubEventRemoteImage: View {
    let url: URL

    var body: some View {
        AsyncImage(url: url) { phase in
            if case let .success(image) = phase {
                image
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity)
                    .frame(height: 132)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .clipped()
            }
        }
    }
}

private struct HubCalendarRow: View {
    let entry: HubCalendarEntry

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 8) {
                Text(entry.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.88)

                Text([entry.category.displayName, entry.participationMode.displayName, entry.sourceLabel]
                    .joined(separator: " · "))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.82)

                Text(entry.displayTimeText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .layoutPriority(1)

            Spacer(minLength: 8)

            HubEventStatusBadge(status: entry.status)
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
            .lineLimit(HubEventStatusRowLayout.statusLineLimit)
            .minimumScaleFactor(HubEventStatusRowLayout.statusMinimumScaleFactor)
            .multilineTextAlignment(.trailing)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill((status == .closingSoon ? Color.red : Color.teal).opacity(0.14))
            )
            .fixedSize(horizontal: HubEventStatusRowLayout.preservesStatusIntrinsicWidth, vertical: false)
    }
}
