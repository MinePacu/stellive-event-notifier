import SwiftUI

struct HubEventsCalendarView: View {
    private let days: [HubCalendarDay]
    @StateObject private var viewModel: HubEventsCalendarViewModel

    init(days: [HubCalendarDay]) {
        self.days = days
        _viewModel = StateObject(wrappedValue: HubEventsCalendarViewModel(viewMode: .calendar, days: days))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("굿즈/행사 캘린더")
                    .font(.headline.weight(.semibold))
                Text("서버에서 동기화된 일정만 표시합니다.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Picker("보기 방식", selection: Binding(
                get: { viewModel.viewMode },
                set: { viewModel.setViewMode($0) }
            )) {
                Text("목록").tag(HubEventsViewMode.list)
                Text("캘린더").tag(HubEventsViewMode.calendar)
            }
            .pickerStyle(.segmented)

            Picker("선택 방식", selection: Binding(
                get: { viewModel.scopeMode },
                set: { viewModel.setScopeMode($0) }
            )) {
                Text("일별").tag(HubCalendarScopeMode.day)
                Text("기간별").tag(HubCalendarScopeMode.range)
            }
            .pickerStyle(.segmented)

            if viewModel.viewMode == .calendar {
                monthControl
                weekdayHeader
                monthGrid
            }

            eventList
        }
        .padding(.vertical, 6)
        .onChange(of: days) { newDays in
            viewModel.replaceDays(newDays)
        }
    }

    private var monthControl: some View {
        HStack {
            Button("이전") {
                viewModel.goToPreviousMonth()
            }
            .buttonStyle(.bordered)
            .controlSize(.small)

            Spacer()

            Text(monthFormatter.string(from: viewModel.selectedMonth))
                .font(.subheadline.weight(.semibold))

            Spacer()

            Button("다음") {
                viewModel.goToNextMonth()
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .padding(.top, 2)
    }

    private var weekdayHeader: some View {
        LazyVGrid(columns: gridColumns, spacing: 4) {
            ForEach(["일", "월", "화", "수", "목", "금", "토"], id: \.self) { weekday in
                Text(weekday)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var monthGrid: some View {
        LazyVGrid(columns: gridColumns, spacing: 6) {
            ForEach(monthDates, id: \.self) { date in
                CalendarDateCell(
                    date: date,
                    isCurrentMonth: Calendar.current.isDate(date, equalTo: viewModel.selectedMonth, toGranularity: .month),
                    marker: viewModel.marker(for: date),
                    entryCount: viewModel.entryCount(on: date),
                    accessibilityLabel: viewModel.accessibilityLabel(for: date)
                ) {
                    viewModel.selectDate(date)
                }
            }
        }
    }

    private var eventList: some View {
        VStack(alignment: .leading, spacing: 8) {
            let entries = viewModel.visibleEntries()
            if entries.isEmpty {
                Text("선택한 범위에 표시할 일정이 없습니다.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 16)
            } else {
                ForEach(entries) { entry in
                    CalendarEntryRow(entry: entry)
                        .padding(10)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(Color(.secondarySystemGroupedBackground))
                        )
                }
            }
        }
        .padding(.top, 4)
    }

    private var monthDates: [Date] {
        let calendar = Calendar.current
        guard
            let monthInterval = calendar.dateInterval(of: .month, for: viewModel.selectedMonth),
            let daysRange = calendar.range(of: .day, in: .month, for: viewModel.selectedMonth)
        else { return [] }

        let firstDay = monthInterval.start
        let leadingDays = calendar.component(.weekday, from: firstDay) - 1
        let totalCells = ((leadingDays + daysRange.count + 6) / 7) * 7

        return (0..<totalCells).compactMap { index in
            calendar.date(byAdding: .day, value: index - leadingDays, to: firstDay)
        }
    }

    private var gridColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
    }

    private var monthFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월"
        return formatter
    }
}

private struct CalendarEntryRow: View {
    let entry: HubCalendarEntry

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 5) {
                Text(entry.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.88)

                Text([entry.category.displayName, entry.participationMode.displayName, entry.sourceLabel]
                    .filter { $0.isEmpty == false }
                    .joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                Text("\(HubCalendarPolicy.entryLabel(entry)) · \(entry.displayDate) · \(entry.displayTimeText)")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.teal)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }

            Spacer(minLength: 8)

            Text(entry.status.displayName)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(entry.status == .closingSoon ? Color.red : Color.teal)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill((entry.status == .closingSoon ? Color.red : Color.teal).opacity(0.14))
                )
        }
        .accessibilityElement(children: .combine)
    }
}

private struct CalendarDateCell: View {
    let date: Date
    let isCurrentMonth: Bool
    let marker: HubCalendarDateMarker
    let entryCount: Int
    let accessibilityLabel: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 2) {
                Text("\(Calendar.current.component(.day, from: date))")
                    .font(.caption.weight(strongMarker ? .bold : .regular))
                Text(entryCount > 0 ? "•" : "")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(dotColor)
            }
            .frame(maxWidth: .infinity, minHeight: 46)
            .foregroundStyle(textColor)
            .background(background)
            .opacity(isCurrentMonth ? 1 : 0.36)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }

    private var strongMarker: Bool {
        marker == .selectedDay || marker == .rangeStart || marker == .rangeEnd
    }

    @ViewBuilder
    private var background: some View {
        switch marker {
        case .selectedDay, .rangeStart, .rangeEnd:
            Capsule(style: .continuous)
                .fill(Color.teal)
        case .rangeMiddleWithEvent, .rangeMiddleEmpty:
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.teal.opacity(0.14))
        case .today:
            Capsule(style: .continuous)
                .stroke(Color.teal.opacity(0.7), lineWidth: 1)
        case .outside:
            Color.clear
        }
    }

    private var textColor: Color {
        strongMarker ? .white : .primary
    }

    private var dotColor: Color {
        strongMarker ? .white : .teal
    }
}
