import Combine
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

    func entryCount(on date: Date) -> Int {
        entries(on: date).count
    }

    func accessibilityLabel(for date: Date) -> String {
        let marker = marker(for: date)
        let count = entryCount(on: date)
        let countText = count > 0 ? "일정 \(count)개" : "일정 없음"
        return "\(accessibilityDateFormatter.string(from: date)), \(marker.accessibilityText), \(countText)"
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
        return result.sorted(by: HubCalendarPolicy.areInDisplayOrder)
    }

    private func filteredEntries(from entries: [HubCalendarEntry]) -> [HubCalendarEntry] {
        let filtered: [HubCalendarEntry]
        switch filterId {
        case "goods":
            filtered = entries.filter { $0.category == .onlineGoods || $0.category == .onlineCollab }
        case "ticketing":
            filtered = entries.filter { $0.category == .ticketing }
        case "offline":
            filtered = entries.filter { $0.participationMode.isOffline }
        case "closing":
            filtered = entries.filter { $0.status == .closingSoon }
        default:
            filtered = entries
        }
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
