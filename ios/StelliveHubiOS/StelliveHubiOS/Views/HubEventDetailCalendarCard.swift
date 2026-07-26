import SwiftUI

struct HubEventDetailCalendarCard: View {
    let event: HubEvent
    let presentation: HubEventDetailCalendarPresentation
    let onSelectDay: (HubEventDetailCalendarDay) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var displayedMonth: HubEventDetailCalendarMonth
    @State private var selectedDate: HubEventDetailCalendarDate
    @AccessibilityFocusState private var isSummaryAccessibilityFocused: Bool

    init(
        event: HubEvent,
        presentation: HubEventDetailCalendarPresentation,
        onSelectDay: @escaping (HubEventDetailCalendarDay) -> Void
    ) {
        self.event = event
        self.presentation = presentation
        self.onSelectDay = onSelectDay
        let fallbackDate = presentation.initialSelectedDate
            ?? HubEventDetailCalendarPolicy.localDate(Date(), timeZone: HubEventDetailCalendarPolicy.fallbackTimeZone)
        _selectedDate = State(initialValue: fallbackDate)
        _displayedMonth = State(initialValue: presentation.displayedMonth ?? fallbackDate.calendarMonth)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            switch presentation.mode {
            case .hidden:
                EmptyView()
            case .compactDate:
                compactContent
            case .monthCalendar:
                monthContent
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            HubEventDetailColors.card,
            in: RoundedRectangle(cornerRadius: 20, style: .continuous)
        )
    }

    private var compactContent: some View {
        let day = presentation.day(for: selectedDate)
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 7) {
                Text(fullDateText(selectedDate))
                    .font(.headline)
                    .foregroundStyle(HubEventDetailColors.text)
                    .fixedSize(horizontal: false, vertical: true)
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 7) {
                        compactBadge(compactTimingText(day))
                        compactBadge(event.status.displayName)
                        if day.scheduleCount > 0 {
                            compactBadge("세부 일정 \(day.scheduleCount)개")
                        }
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        compactBadge(compactTimingText(day))
                        compactBadge(event.status.displayName)
                        if day.scheduleCount > 0 {
                            compactBadge("세부 일정 \(day.scheduleCount)개")
                        }
                    }
                }
                if let venue = event.venueName?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !venue.isEmpty {
                    Label(venue, systemImage: "mappin.and.ellipse")
                        .font(.footnote)
                        .foregroundStyle(HubEventDetailColors.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let next = nextScheduleDescription(day) {
                    Text(next)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(HubEventDetailColors.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Divider()
            selectionSummary(day)
        }
    }

    private var monthContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            monthHeader
            weekdayHeader
            monthGrid
            Divider()
            selectionSummary(presentation.day(for: selectedDate))
        }
    }

    private var monthHeader: some View {
        HStack(spacing: 8) {
            monthNavigationButton(direction: -1)
            Spacer(minLength: 8)
            Text(monthText(displayedMonth))
                .font(.headline)
                .foregroundStyle(HubEventDetailColors.text)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 8)
            monthNavigationButton(direction: 1)
        }
    }

    private var weekdayHeader: some View {
        LazyVGrid(columns: calendarColumns, spacing: 0) {
            ForEach(Array(["일", "월", "화", "수", "목", "금", "토"].enumerated()), id: \.offset) { index, title in
                Text(title)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(index == 0 ? Color(.systemRed) : HubEventDetailColors.muted)
                    .frame(maxWidth: .infinity)
                    .accessibilityHidden(true)
            }
        }
    }

    private var monthGrid: some View {
        LazyVGrid(columns: calendarColumns, spacing: 3) {
            ForEach(presentation.monthGrid(for: displayedMonth), id: \.self) { date in
                dayButton(date)
            }
        }
    }

    private var calendarColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(minimum: 34), spacing: 3), count: 7)
    }

    private func monthNavigationButton(direction: Int) -> some View {
        let target = displayedMonth.addingMonths(direction)
        let canNavigate = presentation.availableMonthRange?.contains(target) == true
        return Button {
            if reduceMotion {
                displayedMonth = target
            } else {
                withAnimation(.easeInOut(duration: 0.18)) {
                    displayedMonth = target
                }
            }
        } label: {
            Image(systemName: direction < 0 ? "chevron.left" : "chevron.right")
                .font(.subheadline.weight(.semibold))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(canNavigate ? Color.accentColor : HubEventDetailColors.muted.opacity(0.35))
        .disabled(!canNavigate)
        .accessibilityLabel("\(monthText(target))로 이동")
    }

    private func dayButton(_ date: HubEventDetailCalendarDate) -> some View {
        let day = presentation.day(for: date)
        let isSelected = date == selectedDate
        let isToday = date == presentation.today
        let isInDisplayedMonth = date.calendarMonth == displayedMonth
        let isSelectable = presentation.contains(date) && day.hasContent

        return Button {
            select(date, day: day)
        } label: {
            VStack(spacing: 2) {
                Text(String(date.day))
                    .font(.caption.weight(isSelected ? .bold : .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 0)
                scheduleMarker(day, selected: isSelected)
                    .frame(height: 13)
            }
            .foregroundStyle(isSelected ? Color.white : HubEventDetailColors.text)
            .frame(maxWidth: .infinity, minHeight: 44, maxHeight: 48)
            .padding(.vertical, 3)
            .background {
                if isSelected {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.accentColor)
                } else if day.isInParentEventRange {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color.accentColor.opacity(0.1))
                }
            }
            .overlay {
                if isToday {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(isSelected ? Color.white.opacity(0.9) : Color.accentColor, lineWidth: 1.5)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isSelectable)
        .opacity((isInDisplayedMonth ? 1 : 0.38) * (day.hasOnlyCancelledSchedules ? 0.62 : 1))
        .accessibilityLabel(dayAccessibilityLabel(day, selected: isSelected, today: isToday))
        .accessibilityHint(isSelectable ? "두 번 탭하여 이 날짜의 일정과 세부 일정 카드를 확인합니다." : "")
    }

    @ViewBuilder
    private func scheduleMarker(
        _ day: HubEventDetailCalendarDay,
        selected: Bool
    ) -> some View {
        if day.hasOnlyCancelledSchedules {
            HStack(spacing: 2) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 9, weight: .semibold))
                if let badgeText = day.badgeText {
                    Text(badgeText)
                        .font(.system(size: 9, weight: .bold))
                }
            }
            .foregroundStyle(selected ? Color.white : Color(.systemRed))
            .accessibilityHidden(true)
        } else if day.scheduleCount == 1 {
            Circle()
                .fill(markerColor(day, selected: selected))
                .frame(width: 6, height: 6)
                .accessibilityHidden(true)
        } else if let badgeText = day.badgeText {
            Text(badgeText)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(selected ? Color.accentColor : Color.white)
                .padding(.horizontal, 4)
                .frame(minWidth: 17, minHeight: 13)
                .background(
                    markerColor(day, selected: selected),
                    in: Capsule()
                )
                .lineLimit(1)
                .accessibilityHidden(true)
        }
    }

    private func markerColor(_ day: HubEventDetailCalendarDay, selected: Bool) -> Color {
        if selected { return .white }
        return day.hasDeadline ? Color(.systemOrange) : Color.accentColor
    }

    private func selectionSummary(_ day: HubEventDetailCalendarDay) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(fullDateText(day.date))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(HubEventDetailColors.text)
                .fixedSize(horizontal: false, vertical: true)

            if day.schedules.isEmpty, day.isInParentEventRange {
                Label("행사 진행 기간", systemImage: "calendar.badge.clock")
                    .font(.footnote)
                    .foregroundStyle(HubEventDetailColors.muted)
            } else {
                ForEach(Array(day.schedules.prefix(3)), id: \.id) { schedule in
                    scheduleSummaryRow(schedule)
                }
                if day.scheduleCount > 3 {
                    Text("\(day.scheduleCount - 3)개 더 있음")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityFocused($isSummaryAccessibilityFocused)
    }

    private func scheduleSummaryRow(_ schedule: HubEventScheduleItem) -> some View {
        let item = timelineItem(for: schedule)
        return HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                Text(HubEventDetailFormatting.displayTitle(schedule))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(HubEventDetailColors.text)
                    .fixedSize(horizontal: false, vertical: true)
                Text(item?.timingText ?? scheduleTimeText(schedule))
                    .font(.caption)
                    .foregroundStyle(HubEventDetailColors.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 4)
            Text(item?.stateText ?? (schedule.cancelledAt == nil ? "예정" : "취소"))
                .font(.caption2.weight(.semibold))
                .foregroundStyle(schedule.cancelledAt == nil ? HubEventDetailColors.muted : Color(.systemRed))
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(
                    (schedule.cancelledAt == nil ? HubEventDetailColors.muted : Color(.systemRed)).opacity(0.12),
                    in: Capsule()
                )
        }
        .opacity(schedule.cancelledAt == nil ? 1 : 0.62)
    }

    private func compactBadge(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(HubEventDetailColors.muted)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(HubEventDetailColors.muted.opacity(0.1), in: Capsule())
            .fixedSize(horizontal: false, vertical: true)
    }

    private func compactTimingText(_ day: HubEventDetailCalendarDay) -> String {
        if let schedule = day.schedules.first {
            return schedule.timePrecision == .date ? "종일" : "\(timeText(schedule.startsAt, timeZone: HubEventDetailCalendarPolicy.resolvedTimeZone(for: schedule))) 시작"
        }
        if let startsAt = event.startsAt {
            return "\(timeText(startsAt, timeZone: HubEventDetailCalendarPolicy.fallbackTimeZone)) 시작"
        }
        return "종일"
    }

    private func nextScheduleDescription(_ day: HubEventDetailCalendarDay) -> String? {
        guard let next = day.schedules.first(where: {
            $0.cancelledAt == nil && timelineItem(for: $0)?.stateText == "예정"
        }) else { return nil }
        return "다음 일정 · \(HubEventDetailFormatting.displayTitle(next))"
    }

    private func timelineItem(for schedule: HubEventScheduleItem) -> HubEventScheduleTimelineItem? {
        HubEventDetailFormatting.timeline(for: event).first { $0.schedule.id == schedule.id }
    }

    private func scheduleTimeText(_ schedule: HubEventScheduleItem) -> String {
        if schedule.timePrecision == .date { return "종일" }
        return timeText(
            schedule.startsAt,
            timeZone: HubEventDetailCalendarPolicy.resolvedTimeZone(for: schedule)
        )
    }

    private func timeText(_ date: Date, timeZone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = timeZone
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    private func fullDateText(_ date: HubEventDetailCalendarDate) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = HubEventDetailCalendarPolicy.fallbackTimeZone
        formatter.dateFormat = "yyyy년 M월 d일 EEEE"
        return formatter.string(from: date.foundationDate)
    }

    private func monthText(_ month: HubEventDetailCalendarMonth) -> String {
        "\(month.year)년 \(month.month)월"
    }

    private func dayAccessibilityLabel(
        _ day: HubEventDetailCalendarDay,
        selected: Bool,
        today: Bool
    ) -> String {
        var components = [day.accessibilityDescription]
        if selected { components.append("선택됨") }
        if today { components.append("오늘") }
        return components.joined(separator: ", ")
    }

    private func select(
        _ date: HubEventDetailCalendarDate,
        day: HubEventDetailCalendarDay
    ) {
        let update = {
            selectedDate = date
            if date.calendarMonth != displayedMonth,
               presentation.availableMonthRange?.contains(date.calendarMonth) == true {
                displayedMonth = date.calendarMonth
            }
        }
        if reduceMotion {
            update()
        } else {
            withAnimation(.easeInOut(duration: 0.18), update)
        }
        onSelectDay(day)
        DispatchQueue.main.async {
            isSummaryAccessibilityFocused = true
        }
    }
}
