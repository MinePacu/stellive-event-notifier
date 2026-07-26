import Combine
import CoreGraphics
import Foundation

enum HubEventsViewMode: String, CaseIterable, Identifiable {
    case list
    case calendar

    var id: String { rawValue }
}

enum HubCalendarScopeMode: String, CaseIterable, Identifiable {
    case day
    case range

    var id: String { rawValue }
}

enum HubCalendarDateMarker: Equatable {
    case outside
    case selectedDay
    case rangeStart
    case rangeMiddleWithEvent
    case rangeMiddleEmpty
    case rangeEnd
    case today
}

enum HubCalendarEntrySpanKind: Equatable {
    case singleDay
    case multiDayStart
    case multiDayMiddle
    case multiDayEnd
    case multiDayAllDay
}

enum HubCalendarEventDotEmphasis: Equatable {
    case muted
    case normal
    case high
}

struct HubCalendarEventDotStyle: Equatable {
    let visible: Bool
    let size: CGFloat
    let emphasis: HubCalendarEventDotEmphasis
    let countText: String?
}

struct HubCalendarDurationBarSegment: Equatable, Identifiable {
    let id: String
    let eventId: String
    let weekIndex: Int
    let lane: Int
    let startColumn: Int
    let endColumn: Int
    let startsAtVisibleBoundary: Bool
    let endsAtVisibleBoundary: Bool
    let emphasis: HubCalendarEventDotEmphasis
}

struct HubCalendarDurationBarLayout: Equatable {
    let segments: [HubCalendarDurationBarSegment]
    let laneCountsByWeek: [Int: Int]
}

@MainActor
final class HubEventsCalendarViewModel: ObservableObject {
    @Published var viewMode: HubEventsViewMode
    @Published var scopeMode: HubCalendarScopeMode
    @Published var selectedMonth: Date
    @Published var selectedDay: Date
    @Published var rangeStart: Date?
    @Published var rangeEnd: Date?
    @Published var filterId: String
    @Published var days: [HubCalendarDay]
    @Published var isLoading: Bool
    @Published var errorMessage: String?

    private let calendar: Calendar
    private let todayProvider: () -> Date
    private let refreshAction: (() async throws -> [HubCalendarDay])?

    init(
        viewMode: HubEventsViewMode = .list,
        scopeMode: HubCalendarScopeMode = .day,
        selectedMonth: Date = Date(),
        selectedDay: Date = Date(),
        rangeStart: Date? = nil,
        rangeEnd: Date? = nil,
        filterId: String = "all",
        days: [HubCalendarDay] = [],
        isLoading: Bool = false,
        errorMessage: String? = nil,
        calendar: Calendar = HubEventsCalendarViewModel.defaultCalendar,
        todayProvider: @escaping () -> Date = Date.init,
        refreshAction: (() async throws -> [HubCalendarDay])? = nil
    ) {
        self.viewMode = viewMode
        self.scopeMode = scopeMode
        self.calendar = calendar
        self.todayProvider = todayProvider
        self.selectedMonth = calendar.startOfDay(for: selectedMonth)
        self.selectedDay = calendar.startOfDay(for: selectedDay)
        self.rangeStart = rangeStart.map { calendar.startOfDay(for: $0) }
        self.rangeEnd = rangeEnd.map { calendar.startOfDay(for: $0) }
        self.filterId = filterId
        self.days = days
        self.isLoading = isLoading
        self.errorMessage = errorMessage
        self.refreshAction = refreshAction
    }

    func setViewMode(_ mode: HubEventsViewMode) {
        viewMode = mode
    }

    func setScopeMode(_ mode: HubCalendarScopeMode) {
        scopeMode = mode
    }

    func goToPreviousMonth() {
        guard let month = calendar.date(byAdding: .month, value: -1, to: selectedMonth) else { return }
        selectedMonth = calendar.startOfDay(for: month)
    }

    func goToNextMonth() {
        guard let month = calendar.date(byAdding: .month, value: 1, to: selectedMonth) else { return }
        selectedMonth = calendar.startOfDay(for: month)
    }

    func goToPreviousDay() {
        guard let day = calendar.date(byAdding: .day, value: -1, to: selectedDay) else { return }
        selectDate(day)
    }

    func goToNextDay() {
        guard let day = calendar.date(byAdding: .day, value: 1, to: selectedDay) else { return }
        selectDate(day)
    }

    func goToToday() {
        selectDate(todayProvider())
    }

    func goToPreviousRange() {
        shiftSelectedRange(direction: -1)
    }

    func goToNextRange() {
        shiftSelectedRange(direction: 1)
    }

    func goToCurrentWeek() {
        let today = calendar.startOfDay(for: todayProvider())
        let weekday = calendar.component(.weekday, from: today)
        let daysFromMonday = (weekday + 5) % 7
        guard
            let start = calendar.date(byAdding: .day, value: -Int(daysFromMonday), to: today),
            let end = calendar.date(byAdding: .day, value: 6, to: start)
        else { return }

        scopeMode = .range
        selectedMonth = calendar.startOfDay(for: start)
        selectedDay = calendar.startOfDay(for: start)
        rangeStart = calendar.startOfDay(for: start)
        rangeEnd = calendar.startOfDay(for: end)
    }

    func applySelectedDay(_ date: Date) {
        scopeMode = .day
        selectDate(date)
    }

    func applySelectedRange(start: Date, end: Date) {
        let normalizedStart = calendar.startOfDay(for: min(start, end))
        let normalizedEnd = calendar.startOfDay(for: max(start, end))
        scopeMode = .range
        selectedMonth = normalizedStart
        selectedDay = normalizedStart
        rangeStart = normalizedStart
        rangeEnd = normalizedEnd
    }

    func selectDate(_ date: Date) {
        let normalizedDate = calendar.startOfDay(for: date)
        switch scopeMode {
        case .day:
            selectedDay = normalizedDate
        case .range:
            selectRangeBoundary(normalizedDate)
        }
    }

    private func shiftSelectedRange(direction: Int) {
        let start = calendar.startOfDay(for: rangeStart ?? selectedDay)
        let end = calendar.startOfDay(for: rangeEnd ?? calendar.date(byAdding: .day, value: 6, to: start) ?? start)
        let lower = min(start, end)
        let upper = max(start, end)
        let dayCount = (calendar.dateComponents([.day], from: lower, to: upper).day ?? 0) + 1
        guard
            let shiftedStart = calendar.date(byAdding: .day, value: dayCount * direction, to: lower),
            let shiftedEnd = calendar.date(byAdding: .day, value: dayCount * direction, to: upper)
        else { return }

        scopeMode = .range
        selectedMonth = calendar.startOfDay(for: shiftedStart)
        selectedDay = calendar.startOfDay(for: shiftedStart)
        rangeStart = calendar.startOfDay(for: shiftedStart)
        rangeEnd = calendar.startOfDay(for: shiftedEnd)
    }

    func setFilter(_ filterId: String) {
        self.filterId = filterId
    }

    func replaceDays(_ days: [HubCalendarDay]) {
        let hadVisibleEntries = !visibleEntries().isEmpty
        self.days = days
        guard
            !hadVisibleEntries,
            visibleEntries().isEmpty,
            let firstSelectableDate = firstSelectableDate()
        else { return }

        switch scopeMode {
        case .day:
            selectedMonth = firstSelectableDate
            selectDate(firstSelectableDate)
        case .range:
            selectedMonth = firstSelectableDate
            selectedDay = firstSelectableDate
            rangeStart = firstSelectableDate
            rangeEnd = firstSelectableDate
        }
    }

    func refresh() async {
        guard let refreshAction else { return }
        isLoading = true
        errorMessage = nil
        do {
            days = try await refreshAction()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func visibleEntries() -> [HubCalendarEntry] {
        switch scopeMode {
        case .day:
            return entries(on: selectedDay)
        case .range:
            if let range = normalizedRange() {
                return entries(in: range)
            }
            if let rangeStart {
                return entries(on: rangeStart)
            }
            return []
        }
    }

    func selectedMonthEntries() -> [HubCalendarEntry] {
        deduplicatedByEventId(
            days
                .sorted { $0.date < $1.date }
                .filter { day in
                    guard let date = Self.dayKeyFormatter.date(from: day.date) else {
                        return false
                    }
                    return calendar.isDate(date, equalTo: selectedMonth, toGranularity: .month)
                }
                .flatMap { filteredEntries(from: $0.entries) }
        )
    }

    func marker(for date: Date) -> HubCalendarDateMarker {
        let day = calendar.startOfDay(for: date)
        switch scopeMode {
        case .day:
            if calendar.isDate(day, inSameDayAs: selectedDay) {
                return .selectedDay
            }
        case .range:
            if let range = normalizedRange() {
                if calendar.isDate(day, inSameDayAs: range.lowerBound) {
                    return .rangeStart
                }
                if calendar.isDate(day, inSameDayAs: range.upperBound) {
                    return .rangeEnd
                }
                if day > range.lowerBound && day < range.upperBound {
                    return entryCount(on: day) > 0 ? .rangeMiddleWithEvent : .rangeMiddleEmpty
                }
            } else if let rangeStart, calendar.isDate(day, inSameDayAs: rangeStart) {
                return .rangeStart
            }
        }

        if calendar.isDate(day, inSameDayAs: todayProvider()) {
            return .today
        }
        return .outside
    }

    func spanKind(for entry: HubCalendarEntry, on date: Date) -> HubCalendarEntrySpanKind {
        guard let startsAt = entry.startsAt, let endsAt = entry.endsAt else {
            return .singleDay
        }

        let startDate = calendar.startOfDay(for: startsAt)
        let endDate = calendar.startOfDay(for: endsAt)
        let cellDate = calendar.startOfDay(for: date)

        guard startDate < endDate else {
            return .singleDay
        }

        if calendar.isDate(cellDate, inSameDayAs: startDate) {
            return .multiDayStart
        }
        if calendar.isDate(cellDate, inSameDayAs: endDate) {
            return .multiDayEnd
        }
        if cellDate > startDate && cellDate < endDate {
            return .multiDayMiddle
        }
        return .multiDayAllDay
    }

    func hasMultiDayEntry(on date: Date) -> Bool {
        entries(on: date).contains { spanKind(for: $0, on: date) != .singleDay }
    }

    func durationBarLayoutForSelectedMonth() -> HubCalendarDurationBarLayout {
        let visibleStart = visibleGridStart(for: selectedMonth)
        let visibleEnd = visibleGridEnd(for: selectedMonth, visibleStart: visibleStart)
        let visibleRange = visibleStart...visibleEnd
        let candidates = days
            .filter { day in
                guard let date = Self.dayKeyFormatter.date(from: day.date) else { return false }
                return visibleRange.contains(calendar.startOfDay(for: date))
            }
            .flatMap { filteredEntries(from: $0.entries) }
            .reduce(into: [String: HubCalendarEntry]()) { result, entry in
                let key = projectionKey(entry)
                result[key] = result[key] ?? entry
            }
            .compactMap { _, entry -> DurationCandidate? in
                guard let startsAt = entry.startsAt, let endsAt = entry.endsAt else { return nil }
                let startDate = calendar.startOfDay(for: startsAt)
                let endDate = calendar.startOfDay(for: endsAt)
                guard startDate < endDate else { return nil }
                let clippedStart = max(startDate, visibleStart)
                let clippedEnd = min(endDate, visibleEnd)
                guard clippedStart <= clippedEnd else { return nil }
                return DurationCandidate(
                    entry: entry,
                    startDate: startDate,
                    endDate: endDate,
                    visibleStart: clippedStart,
                    visibleEnd: clippedEnd
                )
            }
            .sorted {
                if $0.visibleStart != $1.visibleStart { return $0.visibleStart < $1.visibleStart }
                if $0.durationDays != $1.durationDays { return $0.durationDays > $1.durationDays }
                if $0.entry.title != $1.entry.title { return $0.entry.title < $1.entry.title }
                return $0.entry.eventId < $1.entry.eventId
            }

        let unassigned = candidates.flatMap { splitDurationCandidate($0, visibleGridStart: visibleStart) }
        let assigned = Dictionary(grouping: unassigned, by: \.weekIndex)
            .keys
            .sorted()
            .flatMap { weekIndex in
                assignDurationLanes(Dictionary(grouping: unassigned, by: \.weekIndex)[weekIndex] ?? [])
            }
        let laneCounts = Dictionary(grouping: assigned, by: \.weekIndex)
            .mapValues { segments in (segments.map(\.lane).max() ?? -1) + 1 }
        return HubCalendarDurationBarLayout(segments: assigned, laneCountsByWeek: laneCounts)
    }

    private struct DurationCandidate {
        let entry: HubCalendarEntry
        let startDate: Date
        let endDate: Date
        let visibleStart: Date
        let visibleEnd: Date

        var durationDays: Int {
            Calendar.current.dateComponents([.day], from: visibleStart, to: visibleEnd).day ?? 0
        }
    }

    private struct UnassignedDurationSegment {
        let candidate: DurationCandidate
        let weekIndex: Int
        let startColumn: Int
        let endColumn: Int
        let startsAtVisibleBoundary: Bool
        let endsAtVisibleBoundary: Bool
    }

    private func visibleGridStart(for month: Date) -> Date {
        guard let interval = calendar.dateInterval(of: .month, for: month) else {
            return calendar.startOfDay(for: month)
        }
        let firstDay = calendar.startOfDay(for: interval.start)
        let leadingDays = calendar.component(.weekday, from: firstDay) - 1
        return calendar.date(byAdding: .day, value: -leadingDays, to: firstDay) ?? firstDay
    }

    private func visibleGridEnd(for month: Date, visibleStart: Date) -> Date {
        guard
            let interval = calendar.dateInterval(of: .month, for: month),
            let daysRange = calendar.range(of: .day, in: .month, for: interval.start)
        else {
            return visibleStart
        }
        let leadingDays = calendar.component(.weekday, from: interval.start) - 1
        let totalCells = ((leadingDays + daysRange.count + 6) / 7) * 7
        return calendar.date(byAdding: .day, value: totalCells - 1, to: visibleStart) ?? visibleStart
    }

    private func splitDurationCandidate(
        _ candidate: DurationCandidate,
        visibleGridStart: Date
    ) -> [UnassignedDurationSegment] {
        var segments: [UnassignedDurationSegment] = []
        var cursor = candidate.visibleStart
        while cursor <= candidate.visibleEnd {
            let daysFromGridStart = calendar.dateComponents([.day], from: visibleGridStart, to: cursor).day ?? 0
            let weekIndex = daysFromGridStart / 7
            let startColumn = daysFromGridStart % 7
            let weekStart = calendar.date(byAdding: .day, value: weekIndex * 7, to: visibleGridStart) ?? visibleGridStart
            let weekEnd = calendar.date(byAdding: .day, value: 6, to: weekStart) ?? weekStart
            let segmentEnd = min(candidate.visibleEnd, weekEnd)
            let endColumn = calendar.dateComponents([.day], from: weekStart, to: segmentEnd).day ?? startColumn
            segments.append(
                UnassignedDurationSegment(
                    candidate: candidate,
                    weekIndex: weekIndex,
                    startColumn: startColumn,
                    endColumn: endColumn,
                    startsAtVisibleBoundary: calendar.isDate(cursor, inSameDayAs: candidate.startDate),
                    endsAtVisibleBoundary: calendar.isDate(segmentEnd, inSameDayAs: candidate.endDate)
                )
            )
            guard let next = calendar.date(byAdding: .day, value: 1, to: segmentEnd) else { break }
            cursor = next
        }
        return segments
    }

    private func assignDurationLanes(_ segments: [UnassignedDurationSegment]) -> [HubCalendarDurationBarSegment] {
        var laneEnds: [Int] = []
        return segments
            .sorted {
                if $0.startColumn != $1.startColumn { return $0.startColumn < $1.startColumn }
                if $0.endColumn != $1.endColumn { return $0.endColumn > $1.endColumn }
                return $0.candidate.entry.eventId < $1.candidate.entry.eventId
            }
            .map { segment in
                let lane = laneEnds.firstIndex { $0 < segment.startColumn } ?? laneEnds.count
                if lane == laneEnds.count {
                    laneEnds.append(-1)
                }
                laneEnds[lane] = segment.endColumn
                return HubCalendarDurationBarSegment(
                    id: "\(segment.candidate.entry.eventId)-\(segment.weekIndex)-\(lane)",
                    eventId: segment.candidate.entry.eventId,
                    weekIndex: segment.weekIndex,
                    lane: lane,
                    startColumn: segment.startColumn,
                    endColumn: segment.endColumn,
                    startsAtVisibleBoundary: segment.startsAtVisibleBoundary,
                    endsAtVisibleBoundary: segment.endsAtVisibleBoundary,
                    emphasis: dotStyle(for: [segment.candidate.entry]).emphasis
                )
            }
    }

    func dotStyle(for entries: [HubCalendarEntry]) -> HubCalendarEventDotStyle {
        guard entries.isEmpty == false else {
            return HubCalendarEventDotStyle(visible: false, size: 0, emphasis: .muted, countText: nil)
        }

        let emphasis: HubCalendarEventDotEmphasis
        if entries.contains(where: { $0.status == .closingSoon }) {
            emphasis = .high
        } else if entries.allSatisfy({ $0.status == .cancelled || $0.status == .ended }) {
            emphasis = .muted
        } else {
            emphasis = .normal
        }

        let size: CGFloat
        switch entries.count {
        case 1:
            size = 5
        case 2:
            size = 6
        default:
            size = 8
        }

        return HubCalendarEventDotStyle(
            visible: true,
            size: size,
            emphasis: emphasis,
            countText: entries.count >= 3 ? "\(min(entries.count, 9))" : nil
        )
    }

    func dotStyle(on date: Date) -> HubCalendarEventDotStyle {
        dotStyle(for: entries(on: date))
    }

    func rangeLabel(for entry: HubCalendarEntry, on date: Date) -> String? {
        switch spanKind(for: entry, on: date) {
        case .singleDay:
            return nil
        case .multiDayStart:
            return "기간 시작"
        case .multiDayMiddle, .multiDayAllDay:
            return "진행 기간"
        case .multiDayEnd:
            return "기간 종료"
        }
    }

    func rowStatusText(for entry: HubCalendarEntry, on date: Date) -> String {
        [HubCalendarPolicy.entryLabel(entry), rangeLabel(for: entry, on: date)]
            .compactMap { $0 }
            .reduce(into: [String]()) { labels, label in
                if labels.contains(label) == false {
                    labels.append(label)
                }
            }
            .joined(separator: " · ")
    }

    func entryCount(on date: Date) -> Int {
        entries(on: date).count
    }

    func accessibilityLabel(for date: Date) -> String {
        let marker = marker(for: date)
        let count = entryCount(on: date)
        let countText = count > 0 ? "일정 \(count)개" : "일정 없음"
        let multiDayText = hasMultiDayEntry(on: date) ? ", 기간 행사 포함" : ""
        return "\(accessibilityDateFormatter.string(from: date)), \(marker.accessibilityText), \(countText)\(multiDayText)"
    }

    private func selectRangeBoundary(_ date: Date) {
        if rangeStart == nil || rangeEnd != nil {
            rangeStart = date
            rangeEnd = nil
            return
        }
        rangeEnd = date
    }

    private func normalizedRange() -> ClosedRange<Date>? {
        guard let rangeStart, let rangeEnd else { return nil }
        if rangeStart <= rangeEnd {
            return rangeStart...rangeEnd
        }
        return rangeEnd...rangeStart
    }

    private func entries(on date: Date) -> [HubCalendarEntry] {
        let key = Self.dayKeyFormatter.string(from: calendar.startOfDay(for: date))
        return filteredEntries(from: days.first { $0.date == key }?.entries ?? [])
    }

    private func entries(in range: ClosedRange<Date>) -> [HubCalendarEntry] {
        var result: [HubCalendarEntry] = []
        var current = range.lowerBound
        while current <= range.upperBound {
            result.append(contentsOf: entries(on: current))
            guard let next = calendar.date(byAdding: .day, value: 1, to: current) else { break }
            current = next
        }
        return deduplicatedByEventId(result.sorted(by: HubCalendarPolicy.areInDisplayOrder))
    }

    private func deduplicatedByEventId(_ entries: [HubCalendarEntry]) -> [HubCalendarEntry] {
        var seen = Set<String>()
        return entries.filter { entry in
            seen.insert(projectionKey(entry)).inserted
        }
    }

    private func projectionKey(_ entry: HubCalendarEntry) -> String {
        entry.scheduleItemId.map { "\(entry.eventId):\($0)" } ?? entry.eventId
    }

    private func filteredEntries(from entries: [HubCalendarEntry]) -> [HubCalendarEntry] {
        let filtered = entries.filter { HubEventFilterPolicy.matches($0, filterId: filterId) }
        return filtered.sorted(by: HubCalendarPolicy.areInDisplayOrder)
    }

    private func firstSelectableDate() -> Date? {
        let selectableDates = days
            .filter { !filteredEntries(from: $0.entries).isEmpty }
            .sorted { $0.date < $1.date }
            .compactMap { Self.dayKeyFormatter.date(from: $0.date) }
            .map { calendar.startOfDay(for: $0) }

        return selectableDates.first {
            calendar.isDate($0, equalTo: selectedMonth, toGranularity: .month)
        } ?? selectableDates.first
    }

    private nonisolated static var defaultCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "ko_KR")
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul") ?? .current
        return calendar
    }

    private nonisolated static var dayKeyFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = defaultCalendar
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = defaultCalendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }

    private var accessibilityDateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "M월 d일"
        return formatter
    }
}

private extension HubCalendarDateMarker {
    var accessibilityText: String {
        switch self {
        case .outside:
            return "일반 날짜"
        case .selectedDay:
            return "선택됨"
        case .rangeStart:
            return "기간 시작"
        case .rangeMiddleWithEvent, .rangeMiddleEmpty:
            return "기간 포함"
        case .rangeEnd:
            return "기간 종료"
        case .today:
            return "오늘"
        }
    }
}
