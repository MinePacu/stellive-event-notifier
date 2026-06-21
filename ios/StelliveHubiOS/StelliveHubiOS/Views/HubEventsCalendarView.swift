import SwiftUI

struct HubEventsCalendarView: View {
    private let days: [HubCalendarDay]
    @Binding private var selectedMonth: Date
    @StateObject private var viewModel: HubEventsCalendarViewModel
    @State private var presentedPicker: CalendarPickerPresentation?

    init(days: [HubCalendarDay], selectedMonth: Binding<Date>) {
        self.days = days
        _selectedMonth = selectedMonth
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

            monthControl
            weekdayHeader
            monthGrid

        }
        .padding(.vertical, 6)
        .onAppear {
            selectedMonth = viewModel.selectedMonth
        }
        .onChange(of: days) { newDays in
            viewModel.replaceDays(newDays)
            selectedMonth = viewModel.selectedMonth
        }
        .onChange(of: viewModel.selectedMonth) { newMonth in
            selectedMonth = newMonth
        }
        .sheet(item: $presentedPicker) { picker in
            switch picker {
            case .day:
                DayPickerSheet(
                    initialDate: viewModel.selectedDay,
                    onApply: { date in
                        viewModel.applySelectedDay(date)
                        presentedPicker = nil
                    },
                    onCancel: {
                        presentedPicker = nil
                    }
                )
            case .range:
                RangePickerSheet(
                    initialStart: viewModel.rangeStart ?? viewModel.selectedDay,
                    initialEnd: viewModel.rangeEnd ?? Calendar.current.date(byAdding: .day, value: 6, to: viewModel.selectedDay) ?? viewModel.selectedDay,
                    onApply: { start, end in
                        viewModel.applySelectedRange(start: start, end: end)
                        presentedPicker = nil
                    },
                    onCancel: {
                        presentedPicker = nil
                    }
                )
            }
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

    private var listDateNavigationHeader: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                dateNavigationButton(
                    systemName: "chevron.left",
                    accessibilityLabel: previousNavigationAccessibilityLabel
                ) {
                    if viewModel.scopeMode == .day {
                        viewModel.goToPreviousDay()
                    } else {
                        viewModel.goToPreviousRange()
                    }
                }

                if viewModel.scopeMode == .day {
                    dayNavigationCard
                } else {
                    rangeNavigationCard
                }

                dateNavigationButton(
                    systemName: "chevron.right",
                    accessibilityLabel: nextNavigationAccessibilityLabel
                ) {
                    if viewModel.scopeMode == .day {
                        viewModel.goToNextDay()
                    } else {
                        viewModel.goToNextRange()
                    }
                }
            }

            HStack(spacing: 8) {
                if viewModel.scopeMode == .day {
                    Button("오늘") {
                        viewModel.goToToday()
                    }
                    .accessibilityLabel("오늘로 이동, \(selectedDateFormatter.string(from: Date()))")

                    Button("날짜 선택") {
                        presentedPicker = .day
                    }
                    .accessibilityLabel("날짜 선택, \(selectedDateFormatter.string(from: viewModel.selectedDay))")
                } else {
                    Button("이번 주") {
                        viewModel.goToCurrentWeek()
                    }
                    .accessibilityLabel("이번 주로 이동")

                    Button("기간 선택") {
                        presentedPicker = .range
                    }
                    .accessibilityLabel(rangeSelectionAccessibilityLabel)
                }
            }
            .buttonStyle(.bordered)
            .controlSize(.regular)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color(.separator).opacity(0.3), lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
    }

    private func dateNavigationButton(
        systemName: String,
        accessibilityLabel: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .semibold))
                .frame(width: 34, height: 34)
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
        .frame(width: 44, height: 44)
        .contentShape(Rectangle())
        .accessibilityLabel(accessibilityLabel)
    }

    private var dayNavigationCard: some View {
        Button {
            presentedPicker = .day
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "calendar")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(Color(.systemBackground)))

                VStack(alignment: .leading, spacing: 3) {
                    Text(dayNavigationTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.84)

                    Text(dayNavigationSubtitle)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.tint)
                        .lineLimit(2)
                }

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, minHeight: 58)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.accentColor.opacity(0.12))
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("날짜 선택, \(selectedDateFormatter.string(from: viewModel.selectedDay)), \(dayNavigationSubtitle)")
    }

    private var rangeNavigationCard: some View {
        Button {
            presentedPicker = .range
        } label: {
            HStack(spacing: 8) {
                rangeDateColumn(label: "시작", date: selectedRangeStart)

                Image(systemName: "arrow.right")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.secondary)

                rangeDateColumn(label: "종료", date: selectedRangeEnd)
            }
            .frame(maxWidth: .infinity, minHeight: 62)
            .padding(.horizontal, 12)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.accentColor.opacity(0.12))
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(rangeSelectionAccessibilityLabel)
    }

    private func rangeDateColumn(label: String, date: Date) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.tint)
            Text(rangeDateFormatter.string(from: date))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.86)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var listNavigationTitle: String {
        if viewModel.scopeMode == .day {
            return dayNavigationTitle
        }

        let start = viewModel.rangeStart ?? viewModel.selectedDay
        let end = viewModel.rangeEnd ?? Calendar.current.date(byAdding: .day, value: 6, to: start) ?? start
        return "\(rangeDateFormatter.string(from: start)) - \(rangeDateFormatter.string(from: end))"
    }

    private var dayNavigationTitle: String {
        let entries = viewModel.visibleEntries()
        if entries.count == 1, let periodText = periodDateText(for: entries[0]) {
            return periodText
        }
        return selectedDateFormatter.string(from: viewModel.selectedDay)
    }

    private func periodDateText(for entry: HubCalendarEntry) -> String? {
        guard let startsAt = entry.startsAt, let endsAt = entry.endsAt else {
            return nil
        }
        let calendar = Calendar.current
        let startDate = calendar.startOfDay(for: startsAt)
        let endDate = calendar.startOfDay(for: endsAt)
        guard endDate > startDate else {
            return nil
        }
        return "\(Self.periodDateFormatter.string(from: startDate))~\(Self.periodDateFormatter.string(from: endDate))"
    }

    private var dayNavigationSubtitle: String {
        let eventText = "일정 \(viewModel.visibleEntries().count)개"
        if Calendar.current.isDateInToday(viewModel.selectedDay) {
            return "오늘 · \(eventText)"
        }
        return eventText
    }

    private var selectedRangeStart: Date {
        viewModel.rangeStart ?? viewModel.selectedDay
    }

    private var selectedRangeEnd: Date {
        viewModel.rangeEnd ?? Calendar.current.date(byAdding: .day, value: 6, to: selectedRangeStart) ?? selectedRangeStart
    }

    private var previousNavigationAccessibilityLabel: String {
        if viewModel.scopeMode == .day {
            let target = Calendar.current.date(byAdding: .day, value: -1, to: viewModel.selectedDay) ?? viewModel.selectedDay
            return "이전 날짜, \(selectedDateFormatter.string(from: target))로 이동"
        }
        return "이전 기간으로 이동"
    }

    private var nextNavigationAccessibilityLabel: String {
        if viewModel.scopeMode == .day {
            let target = Calendar.current.date(byAdding: .day, value: 1, to: viewModel.selectedDay) ?? viewModel.selectedDay
            return "다음 날짜, \(selectedDateFormatter.string(from: target))로 이동"
        }
        return "다음 기간으로 이동"
    }

    private var rangeSelectionAccessibilityLabel: String {
        "기간 선택, \(selectedDateFormatter.string(from: selectedRangeStart))부터 \(selectedDateFormatter.string(from: selectedRangeEnd))까지"
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
        let durationLayout = viewModel.durationBarLayoutForSelectedMonth()
        return VStack(spacing: 6) {
            ForEach(Array(monthWeeks.enumerated()), id: \.offset) { weekIndex, dates in
                VStack(spacing: 2) {
                    LazyVGrid(columns: gridColumns, spacing: 4) {
                        ForEach(dates, id: \.self) { date in
                            CalendarDateCell(
                                date: date,
                                isCurrentMonth: Calendar.current.isDate(date, equalTo: viewModel.selectedMonth, toGranularity: .month),
                                marker: viewModel.marker(for: date),
                                entryCount: viewModel.entryCount(on: date),
                                dotStyle: viewModel.dotStyle(on: date),
                                hasMultiDayEntry: viewModel.hasMultiDayEntry(on: date),
                                accessibilityLabel: viewModel.accessibilityLabel(for: date)
                            ) {
                                viewModel.selectDate(date)
                            }
                        }
                    }
                    durationBars(for: durationLayout.segments.filter { $0.weekIndex == weekIndex })
                }
                .frame(minHeight: 52 + CGFloat(durationLayout.laneCountsByWeek[weekIndex] ?? 0) * 7)
            }
        }
    }

    private func durationBars(for segments: [HubCalendarDurationBarSegment]) -> some View {
        GeometryReader { proxy in
            let columnWidth = proxy.size.width / 7
            ForEach(segments) { segment in
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(durationBarColor(segment.emphasis).opacity(0.7))
                    .frame(
                        width: max(0, columnWidth * CGFloat(segment.endColumn - segment.startColumn + 1) - 4),
                        height: 5
                    )
                    .offset(
                        x: columnWidth * CGFloat(segment.startColumn) + 2,
                        y: CGFloat(segment.lane) * 7
                    )
            }
        }
        .frame(height: CGFloat((segments.map(\.lane).max() ?? -1) + 1) * 7)
        .allowsHitTesting(false)
    }

    private func durationBarColor(_ emphasis: HubCalendarEventDotEmphasis) -> Color {
        switch emphasis {
        case .high:
            return .orange
        case .muted:
            return .secondary
        case .normal:
            return .teal
        }
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

    private var monthWeeks: [[Date]] {
        stride(from: 0, to: monthDates.count, by: 7).map { start in
            Array(monthDates[start..<min(start + 7, monthDates.count)])
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

    private var selectedDateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 EEEE"
        return formatter
    }

    private var rangeDateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M.d"
        return formatter
    }

    private static let periodDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

private enum CalendarPickerPresentation: String, Identifiable {
    case day
    case range

    var id: String { rawValue }
}

private struct DayPickerSheet: View {
    @State private var selectedDate: Date
    let onApply: (Date) -> Void
    let onCancel: () -> Void

    init(initialDate: Date, onApply: @escaping (Date) -> Void, onCancel: @escaping () -> Void) {
        _selectedDate = State(initialValue: initialDate)
        self.onApply = onApply
        self.onCancel = onCancel
    }

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("날짜", selection: $selectedDate, displayedComponents: .date)
                    .datePickerStyle(.graphical)
            }
            .navigationTitle("날짜 선택")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("적용") {
                        onApply(selectedDate)
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

private struct RangePickerSheet: View {
    @State private var startDate: Date
    @State private var endDate: Date
    let onApply: (Date, Date) -> Void
    let onCancel: () -> Void

    init(initialStart: Date, initialEnd: Date, onApply: @escaping (Date, Date) -> Void, onCancel: @escaping () -> Void) {
        _startDate = State(initialValue: initialStart)
        _endDate = State(initialValue: initialEnd)
        self.onApply = onApply
        self.onCancel = onCancel
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("시작일") {
                    DatePicker("시작일", selection: $startDate, displayedComponents: .date)
                        .datePickerStyle(.graphical)
                }
                Section("종료일") {
                    DatePicker("종료일", selection: $endDate, displayedComponents: .date)
                        .datePickerStyle(.graphical)
                }
            }
            .navigationTitle("기간 선택")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("적용") {
                        onApply(startDate, endDate)
                    }
                }
            }
        }
        .presentationDetents([.large])
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

                Text("\(HubCalendarPolicy.entryLabel(entry)) · \(periodDateText) · \(entry.displayTimeText)")
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

    private var periodDateText: String {
        guard let startsAt = entry.startsAt, let endsAt = entry.endsAt else {
            return entry.displayDate
        }
        let calendar = Calendar.current
        let startDate = calendar.startOfDay(for: startsAt)
        let endDate = calendar.startOfDay(for: endsAt)
        guard endDate > startDate else {
            return entry.displayDate
        }
        return "\(Self.periodDateFormatter.string(from: startDate))~\(Self.periodDateFormatter.string(from: endDate))"
    }

    private static let periodDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

private struct CalendarDateCell: View {
    let date: Date
    let isCurrentMonth: Bool
    let marker: HubCalendarDateMarker
    let entryCount: Int
    let dotStyle: HubCalendarEventDotStyle
    let hasMultiDayEntry: Bool
    let accessibilityLabel: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 3) {
                Text("\(Calendar.current.component(.day, from: date))")
                    .font(.caption.weight(strongMarker ? .bold : .regular))

                if hasMultiDayEntry {
                    Capsule(style: .continuous)
                        .fill(Color.teal.opacity(0.28))
                        .frame(width: 24, height: 4)
                }

                if dotStyle.visible {
                    dotView
                } else {
                    Color.clear.frame(width: 5, height: 5)
                }
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
    private var dotView: some View {
        if let countText = dotStyle.countText {
            Text(countText)
                .font(.system(size: 7, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: dotStyle.size, height: dotStyle.size)
                .background(Circle().fill(dotColor))
        } else {
            Circle()
                .fill(dotColor)
                .frame(width: dotStyle.size, height: dotStyle.size)
        }
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
        switch dotStyle.emphasis {
        case .high:
            return .orange
        case .muted:
            return .secondary
        case .normal:
            return strongMarker ? .white : .teal
        }
    }
}
