import Foundation

enum HubEventDetailCalendarMode: Equatable {
    case hidden
    case compactDate
    case monthCalendar
}

struct HubEventDetailCalendarDate: Hashable, Comparable {
    let year: Int
    let month: Int
    let day: Int

    static func < (lhs: Self, rhs: Self) -> Bool {
        if lhs.year != rhs.year { return lhs.year < rhs.year }
        if lhs.month != rhs.month { return lhs.month < rhs.month }
        return lhs.day < rhs.day
    }

    var calendarMonth: HubEventDetailCalendarMonth {
        HubEventDetailCalendarMonth(year: year, month: month)
    }

    var foundationDate: Date {
        var calendar = HubEventDetailCalendarPolicy.calendar(timeZone: HubEventDetailCalendarPolicy.fallbackTimeZone)
        return calendar.date(from: DateComponents(year: year, month: month, day: day))!
    }

    func addingDays(_ value: Int) -> Self {
        var calendar = HubEventDetailCalendarPolicy.calendar(timeZone: HubEventDetailCalendarPolicy.fallbackTimeZone)
        let result = calendar.date(byAdding: .day, value: value, to: foundationDate)!
        return HubEventDetailCalendarPolicy.localDate(result, timeZone: calendar.timeZone)
    }
}

struct HubEventDetailCalendarMonth: Hashable, Comparable {
    let year: Int
    let month: Int

    static func < (lhs: Self, rhs: Self) -> Bool {
        lhs.year == rhs.year ? lhs.month < rhs.month : lhs.year < rhs.year
    }

    func addingMonths(_ value: Int) -> Self {
        let monthIndex = year * 12 + (month - 1) + value
        return Self(year: monthIndex / 12, month: monthIndex % 12 + 1)
    }
}

struct HubEventDetailCalendarDay: Equatable {
    let date: HubEventDetailCalendarDate
    let isInParentEventRange: Bool
    let schedules: [HubEventScheduleItem]

    var activeScheduleCount: Int {
        schedules.lazy.filter { $0.cancelledAt == nil }.count
    }

    var scheduleCount: Int {
        schedules.count
    }

    var hasDeadline: Bool {
        schedules.contains { $0.kind == .deadline && $0.cancelledAt == nil }
    }

    var hasOnlyCancelledSchedules: Bool {
        !schedules.isEmpty && activeScheduleCount == 0
    }

    var badgeText: String? {
        switch scheduleCount {
        case 0, 1: nil
        case 2...9: String(scheduleCount)
        default: "9+"
        }
    }

    var hasContent: Bool {
        isInParentEventRange || !schedules.isEmpty
    }

    var accessibilityDescription: String {
        var components = ["\(date.year)년 \(date.month)월 \(date.day)일"]
        if isInParentEventRange { components.append("행사 기간") }
        if scheduleCount > 0 { components.append("일정 \(scheduleCount)개") }
        if hasOnlyCancelledSchedules { components.append("모두 취소됨") }
        if hasDeadline { components.append("마감 일정 포함") }
        return components.joined(separator: ", ")
    }
}

struct HubEventDetailCalendarPresentation: Equatable {
    let mode: HubEventDetailCalendarMode
    let displayedMonth: HubEventDetailCalendarMonth?
    let availableMonthRange: ClosedRange<HubEventDetailCalendarMonth>?
    let selectedDate: HubEventDetailCalendarDate?
    let initialSelectedDate: HubEventDetailCalendarDate?
    let today: HubEventDetailCalendarDate
    let days: [HubEventDetailCalendarDate: HubEventDetailCalendarDay]
    let earliestDate: HubEventDetailCalendarDate?
    let latestDate: HubEventDetailCalendarDate?

    func day(for date: HubEventDetailCalendarDate) -> HubEventDetailCalendarDay {
        days[date] ?? HubEventDetailCalendarDay(
            date: date,
            isInParentEventRange: false,
            schedules: []
        )
    }

    func scheduleIDs(on date: HubEventDetailCalendarDate) -> [String] {
        day(for: date).schedules.map(\.id)
    }

    func monthGrid(for month: HubEventDetailCalendarMonth) -> [HubEventDetailCalendarDate] {
        let first = HubEventDetailCalendarDate(year: month.year, month: month.month, day: 1)
        var calendar = HubEventDetailCalendarPolicy.calendar(timeZone: HubEventDetailCalendarPolicy.fallbackTimeZone)
        let weekday = calendar.component(.weekday, from: first.foundationDate)
        let gridStart = first.addingDays(-(weekday - 1))
        return (0..<42).map { gridStart.addingDays($0) }
    }

    func contains(_ date: HubEventDetailCalendarDate) -> Bool {
        guard let earliestDate, let latestDate else { return false }
        return date >= earliestDate && date <= latestDate
    }
}

enum HubEventDetailCalendarPolicy {
    static let fallbackTimeZone = TimeZone(identifier: "Asia/Seoul")!

    private struct ScheduleProjection {
        let item: HubEventScheduleItem
        let dates: [HubEventDetailCalendarDate]
    }

    static func presentation(
        for event: HubEvent,
        highlightedScheduleItemID: String? = nil,
        now: Date = Date()
    ) -> HubEventDetailCalendarPresentation {
        let parentDates = projectedDates(
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            timeZone: fallbackTimeZone
        )
        let parentDateSet = Set(parentDates)
        let scheduleProjections = projectedSchedules(event.scheduleItems)
        var schedulesByDate: [HubEventDetailCalendarDate: [HubEventScheduleItem]] = [:]

        for projection in scheduleProjections {
            for date in projection.dates {
                if schedulesByDate[date, default: []].contains(where: { $0.id == projection.item.id }) {
                    continue
                }
                schedulesByDate[date, default: []].append(projection.item)
            }
        }

        let relevantDates = parentDateSet.union(schedulesByDate.keys).sorted()
        let today = localDate(now, timeZone: fallbackTimeZone)
        guard let earliestDate = relevantDates.first, let latestDate = relevantDates.last else {
            return HubEventDetailCalendarPresentation(
                mode: .hidden,
                displayedMonth: nil,
                availableMonthRange: nil,
                selectedDate: nil,
                initialSelectedDate: nil,
                today: today,
                days: [:],
                earliestDate: nil,
                latestDate: nil
            )
        }

        var days: [HubEventDetailCalendarDate: HubEventDetailCalendarDay] = [:]
        for date in relevantDates {
            days[date] = HubEventDetailCalendarDay(
                date: date,
                isInParentEventRange: parentDateSet.contains(date),
                schedules: schedulesByDate[date] ?? []
            )
        }

        let initialSelectedDate = initialSelection(
            highlightedScheduleItemID: highlightedScheduleItemID,
            today: today,
            parentDates: parentDates,
            schedules: scheduleProjections
        ) ?? earliestDate
        let firstMonth = earliestDate.calendarMonth
        let lastMonth = latestDate.calendarMonth
        let mode: HubEventDetailCalendarMode = relevantDates.count == 1
            ? .compactDate
            : .monthCalendar

        return HubEventDetailCalendarPresentation(
            mode: mode,
            displayedMonth: initialSelectedDate.calendarMonth,
            availableMonthRange: firstMonth...lastMonth,
            selectedDate: initialSelectedDate,
            initialSelectedDate: initialSelectedDate,
            today: today,
            days: days,
            earliestDate: earliestDate,
            latestDate: latestDate
        )
    }

    static func calendar(timeZone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "ko_KR")
        calendar.timeZone = timeZone
        calendar.firstWeekday = 1
        return calendar
    }

    static func localDate(_ date: Date, timeZone: TimeZone) -> HubEventDetailCalendarDate {
        let components = calendar(timeZone: timeZone).dateComponents([.year, .month, .day], from: date)
        return HubEventDetailCalendarDate(
            year: components.year!,
            month: components.month!,
            day: components.day!
        )
    }

    static func resolvedTimeZone(for item: HubEventScheduleItem) -> TimeZone {
        TimeZone(identifier: item.timezone) ?? fallbackTimeZone
    }

    private static func projectedSchedules(
        _ items: [HubEventScheduleItem]
    ) -> [ScheduleProjection] {
        var seenIDs = Set<String>()
        return items
            .sorted(by: scheduleSort)
            .compactMap { item in
                guard seenIDs.insert(item.id).inserted else { return nil }
                return ScheduleProjection(
                    item: item,
                    dates: projectedDates(
                        startsAt: item.startsAt,
                        endsAt: item.endsAt,
                        timeZone: resolvedTimeZone(for: item)
                    )
                )
            }
    }

    private static func projectedDates(
        startsAt: Date?,
        endsAt: Date?,
        timeZone: TimeZone
    ) -> [HubEventDetailCalendarDate] {
        guard let startsAt else {
            return endsAt.map { [localDate($0, timeZone: timeZone)] } ?? []
        }
        let start = localDate(startsAt, timeZone: timeZone)
        guard let endsAt else { return [start] }
        let end = localDate(endsAt, timeZone: timeZone)
        guard end >= start else { return [start] }

        var result: [HubEventDetailCalendarDate] = []
        var date = start
        while date <= end {
            result.append(date)
            date = date.addingDays(1)
        }
        return result
    }

    private static func initialSelection(
        highlightedScheduleItemID: String?,
        today: HubEventDetailCalendarDate,
        parentDates: [HubEventDetailCalendarDate],
        schedules: [ScheduleProjection]
    ) -> HubEventDetailCalendarDate? {
        if let highlightedScheduleItemID,
           let highlighted = schedules.first(where: { $0.item.id == highlightedScheduleItemID }),
           let date = highlighted.dates.first {
            return date
        }

        if parentDates.contains(today) || schedules.contains(where: { $0.dates.contains(today) }) {
            return today
        }

        if let nextDate = schedules
            .filter({ $0.item.cancelledAt == nil })
            .flatMap(\.dates)
            .filter({ $0 > today })
            .min() {
            return nextDate
        }

        if let parentStart = parentDates.first {
            return parentStart
        }

        return schedules.flatMap(\.dates).min()
    }

    private static func scheduleSort(
        _ left: HubEventScheduleItem,
        _ right: HubEventScheduleItem
    ) -> Bool {
        if left.startsAt != right.startsAt { return left.startsAt < right.startsAt }
        if left.sortOrder != right.sortOrder { return left.sortOrder < right.sortOrder }
        return left.id < right.id
    }
}
