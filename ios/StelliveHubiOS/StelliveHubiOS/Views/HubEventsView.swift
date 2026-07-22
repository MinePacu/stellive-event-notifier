import SwiftUI

struct HubEventsView: View {
    @EnvironmentObject private var store: MockHubStore
    @EnvironmentObject private var serverStore: ServerHubStore
    @EnvironmentObject private var reservationStore: ReservationStore
    @State private var selectedFilter = "all"
    @State private var selectedCalendarMonth = Date()
    @SceneStorage("hubEvents.calendarExpanded") private var isCalendarExpanded = true

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
                            .init(value: "\(serverStore.hubEvents(for: "all").filter { $0.status == .open }.count)", label: "진행 중"),
                            .init(value: "\(serverStore.hubEvents(for: "all").filter { $0.status == .upcoming }.count)", label: "예정"),
                            .init(value: "\(serverStore.hubEvents(for: "all").filter { $0.status == .closingSoon }.count)", label: "마감 임박")
                ]
            )
            .listRowInsets(IOSGroupedScreenPolicy.headerRowInsets)
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)

            Section {
                ReservationSummaryCard()
            }

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
                HubEventsCalendarView(
                    days: serverStore.calendarDays(for: selectedFilter),
                    selectedMonth: $selectedCalendarMonth,
                    isExpanded: $isCalendarExpanded
                )
            }

            if isInitialHubEventsLoading {
                Section(selectedMonthFeedTitle) {
                    LoadingStateRow(
                        title: "굿즈/행사 불러오는 중",
                        message: "서버에서 게시된 굿즈/행사 목록과 캘린더를 가져오고 있습니다."
                    )
                }
            } else {
                ForEach(selectedMonthFeedSections) { section in
                    Section(section.title) {
                        ForEach(section.rows) { row in
                            if row.entry.entryKind == .hubEvent {
                                if let event = serverStore.cachedHubEvent(id: row.entry.eventId) {
                                    if HubCalendarDeepLinkPolicy.canNavigateToDetail(row.entry) {
                                        HubEventNavigationRow(event: event)
                                    } else {
                                        HubEventRow(event: event)
                                    }
                                }
                            } else {
                                HubCalendarRow(entry: row.entry)
                            }
                        }
                    }
                }

                if selectedMonthRenderableFeedRows.isEmpty {
                    Section(selectedMonthFeedTitle) {
                        Text("선택한 월에 표시할 일정이 없습니다.")
                            .secondaryNoticeTextStyle()
                    }
                }
            }

            Section {
                Text("팬 주최 이벤트는 추후 추가를 검토 중에 있습니다.")
                    .secondaryNoticeTextStyle()
            }
        }
        .listStyle(.insetGrouped)
        .refreshable {
            await refreshServerHubEvents()
        }
        .task {
            await refreshServerHubEvents()
        }
        .onChange(of: selectedFilter) { _ in
            Task { await refreshServerHubEvents() }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                NavigationLink(value: ReservationRoute.list) {
                    Image(systemName: "ticket")
                        .overlay(alignment: .topTrailing) {
                            if reservationStore.pendingCount > 0 {
                                Text("\(min(reservationStore.pendingCount, 99))")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(3)
                                    .background(Color.red, in: Capsule())
                                    .offset(x: 8, y: -7)
                            }
                        }
                }
                .accessibilityLabel("내 예약 및 구매, 확인 필요 \(reservationStore.pendingCount)개")
            }
        }
    }

    private var isInitialHubEventsLoading: Bool {
        (serverStore.isRefreshingHubEvents || serverStore.isRefreshingCalendar) && selectedMonthRenderableFeedRows.isEmpty
    }

    private func refreshServerHubEvents() async {
        let timezone = TimeZone(identifier: "Asia/Seoul") ?? .current
        var calendar = Self.feedCalendar
        calendar.timeZone = timezone
        let now = Date()
        let from = calendar.date(byAdding: .month, value: -1, to: now) ?? now
        let to = calendar.date(byAdding: .month, value: 3, to: now) ?? now
        await serverStore.refreshHubEvents(filter: selectedFilter, from: from, to: to)
        await serverStore.refreshCalendar(from: from, to: to, timezone: timezone)
    }

    private var selectedMonthFeedRows: [HubEventsFeedRow] {
        HubEventsFeedPolicy.rowsForMonth(
            days: serverStore.calendarDays(for: selectedFilter),
            selectedMonth: selectedCalendarMonth,
            calendar: Self.feedCalendar
        )
    }

    private var selectedMonthRenderableFeedRows: [HubEventsFeedRow] {
        selectedMonthFeedRows.filter { row in
            row.entry.entryKind != .hubEvent || serverStore.cachedHubEvent(id: row.entry.eventId) != nil
        }
    }

    private var selectedMonthFeedSections: [HubEventsFeedSection] {
        var sections: [HubEventsFeedSection] = []
        for row in selectedMonthRenderableFeedRows {
            let title = calendarDayHeaderTitle(for: row)
            if sections.last?.title == title {
                sections[sections.count - 1].rows.append(row)
            } else {
                sections.append(HubEventsFeedSection(title: title, rows: [row]))
            }
        }
        return sections
    }

    private var selectedMonthFeedTitle: String {
        Self.monthTitleFormatter.string(from: selectedCalendarMonth)
    }

    private func calendarDayHeaderTitle(for row: HubEventsFeedRow) -> String {
        let periodTitle: String?
        if row.entry.entryKind == .hubEvent,
           let event = serverStore.cachedHubEvent(id: row.entry.eventId) {
            periodTitle = calendarEventDateTitle(startsAt: event.startsAt, endsAt: event.endsAt)
        } else {
            periodTitle = calendarPeriodTitle(startsAt: row.entry.startsAt, endsAt: row.entry.endsAt)
        }
        guard let periodTitle else {
            return row.day.date
        }
        return periodTitle
    }

    private func calendarEventDateTitle(startsAt: Date?, endsAt: Date?) -> String? {
        guard let start = startsAt ?? endsAt else { return nil }
        let startDate = Self.feedCalendar.startOfDay(for: start)
        if let endsAt {
            let endDate = Self.feedCalendar.startOfDay(for: endsAt)
            if endDate > startDate {
                return "\(Self.feedPeriodDateFormatter.string(from: startDate))~\(Self.feedPeriodDateFormatter.string(from: endDate))"
            }
        }
        return Self.feedPeriodDateFormatter.string(from: startDate)
    }

    private func calendarPeriodTitle(startsAt: Date?, endsAt: Date?) -> String? {
        guard let startsAt, let endsAt else {
            return nil
        }
        let startDate = Self.feedCalendar.startOfDay(for: startsAt)
        let endDate = Self.feedCalendar.startOfDay(for: endsAt)
        guard endDate > startDate else {
            return nil
        }
        return "\(Self.feedPeriodDateFormatter.string(from: startDate))~\(Self.feedPeriodDateFormatter.string(from: endDate))"
    }

    private static let feedCalendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "ko_KR")
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul") ?? .current
        return calendar
    }()

    static let calendarDayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = feedCalendar
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = feedCalendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let monthTitleFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = feedCalendar
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = feedCalendar.timeZone
        formatter.dateFormat = "yyyy년 M월 일정"
        return formatter
    }()

    private static let feedPeriodDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = feedCalendar
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = feedCalendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

struct HubEventsFeedRow: Identifiable {
    let day: HubCalendarDay
    let entry: HubCalendarEntry

    var id: String {
        guard entry.entryKind != .hubEvent else { return entry.eventId }
        return entry.scheduleItemId.map { "\(entry.eventId):\($0)" } ?? entry.eventId
    }
}

struct HubEventsFeedSection: Identifiable {
    let title: String
    var rows: [HubEventsFeedRow]

    var id: String { "\(title)-\(rows.first?.id ?? "empty")" }
}

enum HubEventsFeedPolicy {
    static func rowsForMonth(
        days: [HubCalendarDay],
        selectedMonth: Date,
        calendar: Calendar
    ) -> [HubEventsFeedRow] {
        var seenEventIDs = Set<String>()
        return days
            .sorted { $0.date < $1.date }
            .filter { day in
                guard let date = HubEventsView.calendarDayFormatter.date(from: day.date) else {
                    return false
                }
                return calendar.isDate(date, equalTo: selectedMonth, toGranularity: .month)
            }
            .flatMap { day in
                day.entries.map { entry in HubEventsFeedRow(day: day, entry: entry) }
            }
            .sorted { lhs, rhs in
                orderedBefore(lhs, rhs)
            }
            .filter { row in
                seenEventIDs.insert(row.id).inserted
            }
    }

    private static func orderedBefore(_ lhs: HubEventsFeedRow, _ rhs: HubEventsFeedRow) -> Bool {
        let left = feedSortKey(lhs)
        let right = feedSortKey(rhs)
        if left.primaryDate != right.primaryDate {
            return left.primaryDate < right.primaryDate
        }
        if left.endDate != right.endDate {
            return left.endDate < right.endDate
        }
        if left.title != right.title {
            return left.title < right.title
        }
        return left.eventId < right.eventId
    }

    private static func feedSortKey(_ row: HubEventsFeedRow) -> FeedSortKey {
        let primaryDate = (row.entry.startsAt ?? row.entry.endsAt).map {
            feedSortCalendar.startOfDay(for: $0)
        } ?? HubEventsView.calendarDayFormatter.date(from: row.day.date) ?? .distantFuture
        let endDate = row.entry.endsAt.map {
            feedSortCalendar.startOfDay(for: $0)
        } ?? primaryDate
        return FeedSortKey(
            primaryDate: primaryDate,
            endDate: endDate,
            title: row.entry.resolvedDisplayTitle,
            eventId: row.entry.eventId
        )
    }

    private struct FeedSortKey {
        let primaryDate: Date
        let endDate: Date
        let title: String
        let eventId: String
    }

    private static let feedSortCalendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul") ?? .current
        return calendar
    }()
}

struct HubEventDetailContainerView: View {
    @EnvironmentObject private var serverStore: ServerHubStore
    let initialEvent: HubEvent
    var highlightedScheduleItemId: String? = nil
    @State private var event: HubEvent?
    @State private var didLoad = false

    var body: some View {
        Group {
            if let event {
                HubEventDetailView(event: event, highlightedScheduleItemId: highlightedScheduleItemId)
            } else if didLoad {
                VStack(spacing: 12) {
                    Image(systemName: "bag")
                        .font(.title)
                        .foregroundStyle(.secondary)
                    Text("항목 없음")
                        .font(.headline)
                    Text("서버에서 굿즈/행사를 찾을 수 없습니다.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding()
            } else {
                HubEventDetailView(event: initialEvent, highlightedScheduleItemId: highlightedScheduleItemId)
            }
        }
        .task(id: initialEvent.id) {
            if !didLoad {
                event = await serverStore.loadHubEventDetail(id: initialEvent.id)
                didLoad = true
            }
        }
    }
}

struct HubEventRow: View {
    let event: HubEvent
    var showsChevron = false

    private var presentation: HubEventFeedCardPresentation {
        HubEventFeedCardPresentation(event: event)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let thumbnailURL = HubEventImagePolicy.displayURL(for: event.image) {
                HubEventRemoteImage(url: thumbnailURL)
            }

            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 5) {
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

                HubEventStatusBadge(status: presentation.status)

                if showsChevron {
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 12)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(presentation.accessibilityLabel)
    }
}

private struct HubEventNavigationRow: View {
    let event: HubEvent

    var body: some View {
        HubEventRow(event: event, showsChevron: true)
            .contentShape(Rectangle())
            .overlay {
                NavigationLink {
                    HubEventDetailContainerView(initialEvent: event, highlightedScheduleItemId: nil)
                } label: {
                    Color.clear
                }
                .opacity(0)
                .accessibilityHidden(true)
            }
    }
}

struct HubEventFeedCardPresentation: Equatable {
    let parentTitle: String
    let summary: String?
    let status: HubEventStatus
    let accessibilityLabel: String

    init(event: HubEvent) {
        parentTitle = event.title
        summary = event.summary
        status = event.status
        accessibilityLabel = [
            event.title,
            status.displayName,
            summary
        ]
        .compactMap { $0?.nilIfBlank }
        .joined(separator: ", ")
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
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
                Text(entry.resolvedDisplayTitle)
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
