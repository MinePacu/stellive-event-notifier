import SwiftUI

struct HubEventsView: View {
    @EnvironmentObject private var store: MockHubStore
    @EnvironmentObject private var serverStore: ServerHubStore
    @State private var selectedFilter = "all"
    @State private var selectedCalendarMonth = Date()
    /// Day the user explicitly tapped in the calendar grid; `nil` means the feed lists the whole selected month.
    @State private var selectedFeedDay: Date?
    @State private var filterRefreshTask: Task<Void, Never>?
    @SceneStorage("hubEvents.calendarExpanded") private var isCalendarExpanded = true

    static let filterChipMinTapHeight: CGFloat = 44
    static let dayFilterClearMinTapHeight: CGFloat = 44
    static let filterRefreshDebounceNanoseconds: UInt64 = 250_000_000

    static let filterOptions: [(id: String, title: String)] = [
        ("all", "전체"),
        ("goods", "굿즈"),
        ("album", "음반"),
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
                        ForEach(Self.filterOptions, id: \.id) { filter in
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
                                    // Keep the visual chip compact but make the tappable area meet the 44pt HIG minimum.
                                    .frame(minHeight: Self.filterChipMinTapHeight)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(selectedFilter == filter.id ? .isSelected : [])
                        }
                    }
                    .padding(.horizontal, 14)
                }
                // Full-bleed scroll area: clipped chips reach the card edge, hinting the row scrolls horizontally.
                .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
            }

            Section("캘린더") {
                HubEventsCalendarView(
                    days: serverStore.calendarDays(for: selectedFilter),
                    selectedMonth: $selectedCalendarMonth,
                    selectedFeedDay: $selectedFeedDay,
                    isExpanded: $isCalendarExpanded
                )
            }

            if let feedDay = selectedFeedDay {
                Section {
                    dayFilterClearButton(for: feedDay)
                }
            }

            if isInitialHubEventsLoading {
                Section(feedSectionTitle) {
                    LoadingStateRow(
                        title: "굿즈/행사 불러오는 중",
                        message: "서버에서 게시된 굿즈/행사 목록과 캘린더를 가져오고 있습니다."
                    )
                }
            } else {
                ForEach(feedSections) { section in
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

                if renderableFeedRows.isEmpty {
                    Section(feedSectionTitle) {
                        Text(selectedFeedDay == nil ? "선택한 월에 표시할 일정이 없습니다." : "선택한 날짜에 표시할 일정이 없습니다.")
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
            // Coalesce rapid filter taps: a newer selection cancels the pending/in-flight refresh.
            filterRefreshTask?.cancel()
            filterRefreshTask = Task {
                try? await Task.sleep(nanoseconds: Self.filterRefreshDebounceNanoseconds)
                guard !Task.isCancelled else { return }
                await refreshServerHubEvents()
            }
        }
        .onDisappear {
            filterRefreshTask?.cancel()
        }
        .alert(
            "새로고침 실패",
            isPresented: Binding(
                get: { serverStore.hubEventsRefreshErrorMessage != nil },
                set: { isPresented in
                    if !isPresented { serverStore.clearHubEventsRefreshError() }
                }
            )
        ) {
            Button("확인", role: .cancel) {
                serverStore.clearHubEventsRefreshError()
            }
        } message: {
            Text(serverStore.hubEventsRefreshErrorMessage ?? "")
        }
        .onChange(of: selectedCalendarMonth) { newMonth in
            // Any path that moves the displayed month drops the single-day filter back to the whole month.
            selectedFeedDay = HubEventsFeedPolicy.dayFilter(
                selectedFeedDay,
                retainedForMonth: newMonth,
                calendar: Self.feedCalendar
            )
            Task { await serverStore.ensureCalendarLoaded(covering: newMonth) }
        }
        .onChange(of: selectedFeedDay) { newDay in
            guard let newDay else { return }
            UIAccessibility.post(
                notification: .announcement,
                argument: "\(Self.feedDayTitle(for: newDay)) 일정만 표시"
            )
        }
    }

    private var isInitialHubEventsLoading: Bool {
        (serverStore.isRefreshingHubEvents || serverStore.isRefreshingCalendar) && renderableFeedRows.isEmpty
    }

    private func dayFilterClearButton(for day: Date) -> some View {
        let title = Self.feedDayTitle(for: day)
        return Button {
            selectedFeedDay = nil
        } label: {
            HStack(spacing: 8) {
                Text("\(title) 일정")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Spacer(minLength: 8)
                Text("월 전체 보기")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.teal)
            }
            .frame(maxWidth: .infinity, minHeight: Self.dayFilterClearMinTapHeight, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title) 일정만 표시 중, 월 전체 보기")
        .accessibilityHint("두 번 탭하여 날짜 필터 해제")
    }

    private func refreshServerHubEvents() async {
        let timezone = TimeZone(identifier: "Asia/Seoul") ?? .current
        var calendar = Self.feedCalendar
        calendar.timeZone = timezone
        let now = Date()
        let from = calendar.date(byAdding: .month, value: -1, to: now) ?? now
        let to = calendar.date(byAdding: .month, value: 3, to: now) ?? now
        await serverStore.refreshHubEvents(filter: selectedFilter, from: from, to: to)
        guard !Task.isCancelled else { return }
        await serverStore.refreshCalendar(from: from, to: to, timezone: timezone)
    }

    private var feedRows: [HubEventsFeedRow] {
        let days = serverStore.calendarDays(for: selectedFilter)
        if let selectedFeedDay {
            return HubEventsFeedPolicy.rowsForDay(
                days: days,
                selectedDay: selectedFeedDay,
                calendar: Self.feedCalendar
            )
        }
        return HubEventsFeedPolicy.rowsForMonth(
            days: days,
            selectedMonth: selectedCalendarMonth,
            calendar: Self.feedCalendar
        )
    }

    private var renderableFeedRows: [HubEventsFeedRow] {
        feedRows.filter { row in
            row.entry.entryKind != .hubEvent || serverStore.cachedHubEvent(id: row.entry.eventId) != nil
        }
    }

    private var feedSections: [HubEventsFeedSection] {
        var sections: [HubEventsFeedSection] = []
        for row in renderableFeedRows {
            let title = calendarDayHeaderTitle(for: row)
            if sections.last?.title == title {
                sections[sections.count - 1].rows.append(row)
            } else {
                sections.append(HubEventsFeedSection(title: title, rows: [row]))
            }
        }
        return sections
    }

    private var feedSectionTitle: String {
        if let selectedFeedDay {
            return Self.feedDayTitle(for: selectedFeedDay)
        }
        return Self.monthTitleFormatter.string(from: selectedCalendarMonth)
    }

    private func calendarDayHeaderTitle(for row: HubEventsFeedRow) -> String {
        let periodTitle: String?
        if row.entry.entryKind == .hubEvent,
           let event = serverStore.cachedHubEvent(id: row.entry.eventId) {
            periodTitle = Self.calendarEventDateTitle(startsAt: event.startsAt, endsAt: event.endsAt)
        } else {
            periodTitle = Self.calendarPeriodTitle(startsAt: row.entry.startsAt, endsAt: row.entry.endsAt)
        }
        guard let periodTitle else {
            return Self.feedDayTitle(isoDay: row.day.date)
        }
        return periodTitle
    }

    /// Localized section title for a `yyyy-MM-dd` day key (e.g. "9월 7일 (월)"); falls back to the raw key if unparsable.
    static func feedDayTitle(isoDay: String) -> String {
        guard let date = calendarDayFormatter.date(from: isoDay) else { return isoDay }
        return feedPeriodDateFormatter.string(from: date)
    }

    /// Localized section title for a calendar day (e.g. "9월 18일 (금)") in the feed's Asia/Seoul calendar.
    static func feedDayTitle(for date: Date) -> String {
        feedPeriodDateFormatter.string(from: date)
    }

    static func calendarEventDateTitle(startsAt: Date?, endsAt: Date?) -> String? {
        guard let start = startsAt ?? endsAt else { return nil }
        let startDate = Self.feedCalendar.startOfDay(for: start)
        if let endsAt {
            let endDate = Self.feedCalendar.startOfDay(for: endsAt)
            if endDate > startDate {
                return "\(feedPeriodDateFormatter.string(from: startDate))~\(feedPeriodDateFormatter.string(from: endDate))"
            }
        }
        return feedPeriodDateFormatter.string(from: startDate)
    }

    static func calendarPeriodTitle(startsAt: Date?, endsAt: Date?) -> String? {
        guard let startsAt, let endsAt else {
            return nil
        }
        let startDate = Self.feedCalendar.startOfDay(for: startsAt)
        let endDate = Self.feedCalendar.startOfDay(for: endsAt)
        guard endDate > startDate else {
            return nil
        }
        return "\(feedPeriodDateFormatter.string(from: startDate))~\(feedPeriodDateFormatter.string(from: endDate))"
    }

    static let feedCalendar: Calendar = {
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
        formatter.dateFormat = "M월 d일 (E)"
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
        rows(days: days) { date in
            calendar.isDate(date, equalTo: selectedMonth, toGranularity: .month)
        }
    }

    /// Rows for a single tapped day. Same bucket lookup, ordering and event-level de-duplication as
    /// `rowsForMonth`, so a multi-day event whose expanded entries include `selectedDay` shows once.
    static func rowsForDay(
        days: [HubCalendarDay],
        selectedDay: Date,
        calendar: Calendar
    ) -> [HubEventsFeedRow] {
        rows(days: days) { date in
            calendar.isDate(date, inSameDayAs: selectedDay)
        }
    }

    /// Tapping the day that is already filtered clears the filter; any other day becomes the filter.
    static func toggledDayFilter(current: Date?, tapped: Date, calendar: Calendar) -> Date? {
        if let current, calendar.isDate(current, inSameDayAs: tapped) {
            return nil
        }
        return tapped
    }

    /// Keeps the day filter only while it belongs to the displayed month.
    static func dayFilter(_ day: Date?, retainedForMonth month: Date, calendar: Calendar) -> Date? {
        guard let day, calendar.isDate(day, equalTo: month, toGranularity: .month) else {
            return nil
        }
        return day
    }

    private static func rows(
        days: [HubCalendarDay],
        includingDay: (Date) -> Bool
    ) -> [HubEventsFeedRow] {
        var seenEventIDs = Set<String>()
        return days
            .sorted { $0.date < $1.date }
            .filter { day in
                guard let date = HubEventsView.calendarDayFormatter.date(from: day.date) else {
                    return false
                }
                return includingDay(date)
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

                    HubEventSupplementaryTagChips(labels: presentation.secondaryTagLabels)

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
    let secondaryTagLabels: [String]
    let accessibilityLabel: String

    init(event: HubEvent) {
        parentTitle = event.title
        summary = event.summary
        status = event.status
        secondaryTagLabels = HubEventTagDisplayPolicy.secondaryLabels(for: event.tags)
        accessibilityLabel = [
            event.title,
            status.displayName,
            secondaryTagLabels.joined(separator: ", "),
            summary
        ]
        .compactMap { $0?.nilIfBlank }
        .joined(separator: ", ")
    }
}

struct HubEventSupplementaryTagChips: View {
    let labels: [String]

    var body: some View {
        if !labels.isEmpty {
            HStack(spacing: 6) {
                ForEach(labels, id: \.self) { label in
                    Text(label)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Color.indigo)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.indigo.opacity(0.12), in: Capsule())
                }
            }
        }
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
            switch phase {
            case let .success(image):
                image
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity)
                    .frame(height: Self.imageHeight)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .clipped()
            case .failure:
                placeholder {
                    Image(systemName: "photo")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }
            default:
                placeholder {
                    ProgressView()
                }
            }
        }
    }

    private static let imageHeight: CGFloat = 132

    /// Fixed-size neutral placeholder so the row height matches the loaded image and doesn't jump.
    private func placeholder<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color(.tertiarySystemFill))
            .frame(maxWidth: .infinity)
            .frame(height: Self.imageHeight)
            .overlay(content())
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

                HubEventSupplementaryTagChips(
                    labels: HubEventTagDisplayPolicy.secondaryLabels(for: entry.tags)
                )

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
            .foregroundStyle(status.displayColor)
            .lineLimit(HubEventStatusRowLayout.statusLineLimit)
            .minimumScaleFactor(HubEventStatusRowLayout.statusMinimumScaleFactor)
            .multilineTextAlignment(.trailing)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(status.displayColor.opacity(0.14))
            )
            .fixedSize(horizontal: HubEventStatusRowLayout.preservesStatusIntrinsicWidth, vertical: false)
    }
}
