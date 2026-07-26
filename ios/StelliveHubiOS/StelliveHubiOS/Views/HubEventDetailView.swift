import SwiftUI

private enum HubEventDetailColors {
    static let background = Color(.systemGroupedBackground)
    static let card = Color(.secondarySystemGroupedBackground)
    static let text = Color(.label)
    static let muted = Color(.secondaryLabel)
    static let line = Color(.separator)
}

enum HubEventDetailContentSection: Hashable {
    case actions
    case summary
    case timeline
    case info
    case notice
}

enum HubEventDetailLayoutPolicy {
    static let contentOrder: [HubEventDetailContentSection] = [.actions, .summary, .timeline, .info, .notice]
}

enum HubEventScheduleScrollPolicy {
    static func target(highlightedID: String?, lastScrolledID: String?) -> String? {
        guard let highlightedID, highlightedID != lastScrolledID else { return nil }
        return highlightedID
    }
}

enum HubEventScheduleExpansionPolicy {
    static func resolvedIDs(
        previousEventID: String?,
        eventID: String,
        currentIDs: Set<String>,
        highlightedID: String?
    ) -> Set<String> {
        var result = previousEventID == eventID ? currentIDs : []
        if let highlightedID { result.insert(highlightedID) }
        return result
    }
}

struct HubEventDetailView: View {
    let event: HubEvent
    var highlightedScheduleItemId: String? = nil
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL
    @EnvironmentObject private var reservationStore: ReservationStore
    @State private var lastScrolledScheduleItemId: String? = nil
    @State private var expandedScheduleItemIds = Set<String>()
    @State private var expandedScheduleEventId: String?
    @State private var presentedLinks: HubEventLinksSheetContext?

    var body: some View {
        ZStack(alignment: .top) {
            HubEventDetailColors.background.ignoresSafeArea()
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 0) {
                        hero
                        VStack(spacing: 14) {
                            ForEach(HubEventDetailLayoutPolicy.contentOrder, id: \.self) { section in
                                contentSection(section)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 18)
                        .padding(.bottom, 28)
                    }
                    .padding(.top, -36)
                    .frame(width: UIScreen.main.bounds.width)
                }
                .ignoresSafeArea(edges: .top)
                .onAppear {
                    expandHighlightedSchedule()
                    scrollToHighlightedSchedule(using: proxy)
                }
                .onChange(of: highlightedScheduleItemId) { _ in
                    expandHighlightedSchedule()
                    scrollToHighlightedSchedule(using: proxy)
                }
                .onChange(of: event.id) { _ in expandHighlightedSchedule() }
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .sheet(item: $presentedLinks) { context in
            HubEventLinksSheet(context: context) { link in
                presentedLinks = nil
                openHubEventLink(link, scheduleItem: nil)
            }
        }
    }

    private func expandHighlightedSchedule() {
        expandedScheduleItemIds = HubEventScheduleExpansionPolicy.resolvedIDs(
            previousEventID: expandedScheduleEventId,
            eventID: event.id,
            currentIDs: expandedScheduleItemIds,
            highlightedID: highlightedScheduleItemId
        )
        expandedScheduleEventId = event.id
    }

    private func scrollToHighlightedSchedule(using proxy: ScrollViewProxy) {
        guard let id = HubEventScheduleScrollPolicy.target(
            highlightedID: highlightedScheduleItemId,
            lastScrolledID: lastScrolledScheduleItemId
        ) else { return }
        lastScrolledScheduleItemId = id
        DispatchQueue.main.async {
            withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo(id, anchor: .center) }
        }
    }

    @ViewBuilder
    private func contentSection(_ section: HubEventDetailContentSection) -> some View {
        switch section {
        case .actions:
            ctaRow
        case .summary:
            detailSection(HubEventDetailFormatting.summaryLabel) {
                summaryCard
            }
        case .timeline:
            if HubEventDetailFormatting.hasTimelineSchedule(event), !event.scheduleItems.isEmpty {
                detailSection("세부 일정") {
                    timelineCards
                }
            }
        case .info:
            detailSection("행사 정보") {
                infoCard
            }
        case .notice:
            noticeCard
        }
    }

    private var hero: some View {
        GeometryReader { geometry in
            let horizontalPadding: CGFloat = 18
            let contentWidth = max(0, geometry.size.width - horizontalPadding * 2)

            ZStack(alignment: .bottomLeading) {
            HubEventHeroImage(url: HubEventImagePolicy.displayURL(for: event.image))
                    .frame(width: geometry.size.width, height: geometry.size.height)
            LinearGradient(
                colors: [.clear, .black.opacity(0.46)],
                startPoint: .center,
                endPoint: .bottom
            )
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 7) {
                    ForEach(HubEventDetailFormatting.heroTags(for: event)) { tag in
                        HubEventHeroTagView(tag: tag)
                    }
                }
            Text(event.title)
                .font(.system(size: 25, weight: .bold))
                .lineLimit(3)
                .minimumScaleFactor(0.84)
                .multilineTextAlignment(.leading)
                    .frame(maxWidth: contentWidth, alignment: .leading)
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(HubEventDetailFormatting.heroSubtitleLines(for: event), id: \.self) { line in
                        Text(line)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.84))
                    }
                }
            }
                    .frame(maxWidth: contentWidth, alignment: .leading)
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.22), radius: 12, y: 4)
            .padding(.horizontal, horizontalPadding)
            .padding(.bottom, 10)
        }
            .frame(width: geometry.size.width, height: geometry.size.height)
        }
        .frame(height: 390)
        .clipped()
        .ignoresSafeArea(edges: .top)
    }

    private func detailSection<Content: View>(
        _ title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(HubEventDetailColors.muted)
                .padding(.horizontal, 2)
            content()
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(event.summary?.isEmpty == false ? event.summary! : "공식 출처 기반 굿즈/행사 정보입니다.")
                .font(.subheadline)
                .foregroundStyle(HubEventDetailColors.muted)
                .lineSpacing(3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(17)
        .background(HubEventDetailColors.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var ctaRow: some View {
        let links = HubEventLinkPolicy.resolvedEventLinks(event)
        let ctaMode = HubEventLinkPolicy.eventCTAMode(event)
        let columns = Array(
            repeating: GridItem(.flexible(), spacing: 10),
            count: links.isEmpty ? 1 : 2
        )
        return LazyVGrid(columns: columns, spacing: 10) {
            Button("캘린더 추가") {}
                .buttonStyle(HubEventCTAButtonStyle(primary: true))
            if ctaMode == .direct, url(from: links[0].url) != nil {
                Button(HubEventLinkPolicy.displayLabel(links[0])) {
                    openHubEventLink(links[0], scheduleItem: nil)
                }
                    .buttonStyle(HubEventCTAButtonStyle(primary: false))
                    .accessibilityLabel("\(HubEventLinkPolicy.displayLabel(links[0])), 외부 링크 열기")
            } else if ctaMode == .sheet {
                Button("관련 링크 \(links.count)개") {
                    presentedLinks = HubEventLinksSheetContext(title: "관련 링크", links: links)
                }
                .buttonStyle(HubEventCTAButtonStyle(primary: false))
                .accessibilityLabel("관련 링크 \(links.count)개, 목록 열기")
            }
        }
        .padding(.top, 5)
    }

    private var infoCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(HubEventDetailFormatting.rows(for: event).enumerated()), id: \.offset) { index, row in
                if index > 0 {
                    Divider()
                }
                HStack(alignment: .top, spacing: 12) {
                    Text(row.label)
                        .font(.footnote)
                        .foregroundStyle(HubEventDetailColors.muted)
                        .frame(width: 72, alignment: .leading)
                    Text(row.value)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(HubEventDetailColors.text)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.vertical, 12)
            }
        }
        .padding(16)
        .background(HubEventDetailColors.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var timelineCards: some View {
        let effectivePrimaryID = HubEventLinkPolicy.effectivePrimaryScheduleItemID(event)
        return VStack(spacing: 10) {
            ForEach(HubEventDetailFormatting.timeline(for: event), id: \.schedule.id) { item in
                HubEventScheduleCard(
                    item: item,
                    highlighted: item.schedule.id == highlightedScheduleItemId,
                    isEffectivePrimary: item.schedule.id == effectivePrimaryID,
                    expanded: expandedScheduleItemIds.contains(item.schedule.id),
                    onToggle: {
                        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.18)) {
                            if expandedScheduleItemIds.contains(item.schedule.id) {
                                expandedScheduleItemIds.remove(item.schedule.id)
                            } else {
                                expandedScheduleItemIds.insert(item.schedule.id)
                            }
                        }
                    },
                    onOpenLink: { link in openHubEventLink(link, scheduleItem: item.schedule) }
                )
                .id(item.schedule.id)
            }
        }
    }

    private var noticeCard: some View {
        Text(HubEventDetailFormatting.noticeText)
            .font(.footnote)
            .foregroundStyle(HubEventDetailColors.muted)
            .lineSpacing(3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(HubEventDetailColors.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func url(from rawValue: String?) -> URL? {
        guard let rawValue, !rawValue.isEmpty else { return nil }
        guard let url = URL(string: rawValue), url.scheme?.lowercased() == "https", url.host != nil else { return nil }
        return url
    }

    private func openHubEventLink(_ link: HubEventLink, scheduleItem: HubEventScheduleItem?) {
        guard let destination = url(from: link.url) else { return }
        ReservationExternalLinkPolicy.openFailOpen(
            openExternal: { openURL(destination) },
            recordBestEffort: {
            if let draft = try reservationStore.begin(event: event, scheduleItem: scheduleItem, link: link) {
                    try ReservationActivityCoordinator.start(for: draft, draftCount: reservationStore.pendingCount)
                }
            },
            onRecordingFailure: {
                reservationStore.reportBestEffortError()
            }
        )
    }
}

private struct HubEventScheduleCard: View {
    private enum BadgeTone: Equatable {
        case upcoming
        case inProgress
        case completed
        case cancelled
        case kind
        case primary
        case selected

        var foreground: Color {
            switch self {
            case .upcoming: Color(.systemBlue)
            case .inProgress: Color(.systemGreen)
            case .completed: Color(.secondaryLabel)
            case .cancelled: Color(.systemRed)
            case .kind: Color(.systemPurple)
            case .primary: Color(.systemOrange)
            case .selected: Color(.systemTeal)
            }
        }

        var background: Color {
            foreground.opacity(self == .completed ? 0.12 : 0.14)
        }
    }

    let item: HubEventScheduleTimelineItem
    let highlighted: Bool
    let isEffectivePrimary: Bool
    let expanded: Bool
    let onToggle: () -> Void
    let onOpenLink: (HubEventLink) -> Void

    var body: some View {
        let links = HubEventLinkPolicy.resolvedScheduleLinks(item.schedule)
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onToggle) {
                VStack(alignment: .leading, spacing: 7) {
                    HStack(spacing: 6) {
                        scheduleBadge(item.stateText, tone: stateBadgeTone)
                        scheduleBadge(HubEventDetailFormatting.scheduleKindLabel(item.schedule.kind), tone: .kind)
                        if isEffectivePrimary { scheduleBadge("대표 일정", tone: .primary) }
                        if highlighted { scheduleBadge("선택한 일정", tone: .selected) }
                        Spacer(minLength: 0)
                    }
                    HStack(alignment: .center, spacing: 10) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(HubEventDetailFormatting.displayTitle(item.schedule))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(HubEventDetailColors.text)
                            Text(item.timingText)
                                .font(.footnote)
                                .foregroundStyle(HubEventDetailColors.muted)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.down")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(HubEventDetailColors.muted)
                            .rotationEffect(.degrees(expanded ? 180 : 0))
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel([
                HubEventDetailFormatting.displayTitle(item.schedule),
                item.stateText,
                isEffectivePrimary ? "대표 일정" : nil,
                highlighted ? "선택한 일정" : nil,
            ].compactMap { $0 }.joined(separator: ", "))
            .accessibilityValue(expanded ? "펼쳐짐" : "접힘")
            .accessibilityHint(expanded ? "두 번 탭하여 세부 내용을 접습니다." : "두 번 탭하여 세부 내용을 펼칩니다.")

            if expanded {
                VStack(alignment: .leading, spacing: 9) {
                    Text("정확한 일정 · \(item.timingText)")
                        .font(.caption)
                        .foregroundStyle(HubEventDetailColors.muted)
                    Text("\(item.schedule.timePrecision == .date ? "날짜만" : "날짜와 시간") · \(item.schedule.timezone)")
                        .font(.caption)
                        .foregroundStyle(HubEventDetailColors.muted)
                    if let description = HubEventDetailFormatting.scheduleDescription(item.schedule) {
                        Text(description)
                            .font(.footnote)
                            .foregroundStyle(HubEventDetailColors.text)
                    }
                    if let source = item.schedule.sourceLabel, !source.isEmpty {
                        Text("출처 · \(source)")
                            .font(.caption)
                            .foregroundStyle(HubEventDetailColors.muted)
                    }
                    ForEach(links) { link in
                        if url(from: link.url) != nil {
                            Button(HubEventLinkPolicy.displayLabel(link)) { onOpenLink(link) }
                                .font(.footnote.weight(.semibold))
                                .accessibilityLabel("\(HubEventLinkPolicy.displayLabel(link)), 외부 링크 열기")
                        }
                    }
                }
                .padding(.top, 10)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(highlighted ? Color.teal.opacity(0.1) : HubEventDetailColors.card)
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(highlighted ? Color.teal : HubEventDetailColors.line, lineWidth: highlighted ? 2 : 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .opacity(item.schedule.cancelledAt == nil ? 1 : 0.58)
    }

    private var stateBadgeTone: BadgeTone {
        switch item.stateText {
        case "예정": .upcoming
        case "진행": .inProgress
        case "취소": .cancelled
        default: .completed
        }
    }

    private func scheduleBadge(_ label: String, tone: BadgeTone) -> some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(tone.foreground)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tone.background, in: Capsule())
    }

    private func url(from rawValue: String) -> URL? {
        guard let url = URL(string: rawValue), url.scheme?.lowercased() == "https", url.host != nil else { return nil }
        return url
    }
}

private struct HubEventLinksSheetContext: Identifiable {
    let id = UUID()
    let title: String
    let links: [HubEventLink]
}

private struct HubEventLinksSheet: View {
    let context: HubEventLinksSheetContext
    let onOpenLink: (HubEventLink) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(context.links) { link in
                if let destination = URL(string: link.url), destination.scheme?.lowercased() == "https", destination.host != nil {
                    Button {
                        onOpenLink(link)
                    } label: {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(HubEventLinkPolicy.displayLabel(link))
                                    .font(.body.weight(.semibold))
                                Text(link.kind.displayName)
                                    .font(.caption)
                                    .foregroundStyle(HubEventDetailColors.muted)
                            }
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(HubEventDetailColors.muted)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(HubEventLinkPolicy.displayLabel(link)), 외부 링크 열기")
                }
            }
            .navigationTitle(context.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("닫기") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

private extension HubEventLinkKind {
    var displayName: String {
        switch self {
        case .source: "출처"
        case .purchase: "구매"
        case .ticket: "티켓"
        case .reservation: "예약"
        case .content: "콘텐츠"
        case .video: "영상"
        case .map: "지도"
        case .custom: "관련 링크"
        }
    }
}

struct HubEventDetailRow: Equatable {
    let label: String
    let value: String
}

struct HubEventScheduleTimelineItem: Equatable {
    let schedule: HubEventScheduleItem
    let timingText: String
    let stateText: String
}

struct HubEventHeroTag: Equatable, Identifiable {
    let label: String
    let tone: HubEventHeroTagTone

    var id: String {
        "\(tone)-\(label)"
    }
}

enum HubEventHeroTagTone: Equatable {
    case status
    case category
    case participation
    case supplementary
}

enum HubEventDetailFormatting {
    static let summaryLabel = "핵심 안내"
    static let noticeText = "일정, 장소, 판매/입장 조건은 공식 공지 변경에 따라 달라질 수 있습니다. 앱은 확인용 요약만 제공하므로 참여 전 반드시 출처 링크에서 최신 공지를 확인하세요."

    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        formatter.dateFormat = "yyyy.MM.dd (E) HH:mm"
        return formatter
    }()

    static func rows(for event: HubEvent) -> [HubEventDetailRow] {
        var rows: [HubEventDetailRow] = []
        if let venueName = event.venueName, !venueName.isEmpty {
            rows.append(HubEventDetailRow(label: "장소", value: venueName))
        }
        if showsParentPeriod(event) {
            rows.append(HubEventDetailRow(label: "시작", value: event.startsAt.map(format) ?? "미정"))
            rows.append(HubEventDetailRow(label: "기간", value: periodText(for: event)))
        }
        rows.append(HubEventDetailRow(label: "참여 방식", value: event.participationMode.displayName))
        rows.append(HubEventDetailRow(label: "분류", value: event.category.displayName))
        rows.append(HubEventDetailRow(label: "출처", value: event.sourceLabel))
        return rows
    }

    static func timeline(for event: HubEvent, now: Date = Date()) -> [HubEventScheduleTimelineItem] {
        event.scheduleItems
            .sorted { left, right in
                if left.startsAt != right.startsAt { return left.startsAt < right.startsAt }
                if left.sortOrder != right.sortOrder { return left.sortOrder < right.sortOrder }
                return left.id < right.id
            }
            .map { item in
                HubEventScheduleTimelineItem(
                    schedule: item,
                    timingText: schedulePeriodText(item),
                    stateText: scheduleStateText(item, now: now)
                )
            }
    }

    static func activeScheduleItems(_ event: HubEvent) -> [HubEventScheduleItem] {
        event.scheduleItems.filter { $0.cancelledAt == nil }
    }

    static func hasTimelineSchedule(_ event: HubEvent) -> Bool {
        event.scheduleMode == .timeline || activeScheduleItems(event).count >= 2
    }

    static func showsParentPeriod(_ event: HubEvent) -> Bool {
        !hasTimelineSchedule(event)
    }

    static func nextScheduleItem(_ event: HubEvent, now: Date = Date()) -> HubEventScheduleItem? {
        activeScheduleItems(event)
            .filter { item in item.endsAt.map { $0 >= now } ?? (item.startsAt >= now) }
            .sorted { left, right in
                if left.startsAt != right.startsAt { return left.startsAt < right.startsAt }
                if left.sortOrder != right.sortOrder { return left.sortOrder < right.sortOrder }
                return left.id < right.id
            }
            .first
    }

    static func scheduleActionURL(_ item: HubEventScheduleItem) -> URL? {
        [item.actionUrl, item.sourceUrl]
            .compactMap { $0 }
            .compactMap { rawValue -> URL? in
                guard let url = URL(string: rawValue), url.scheme?.lowercased() == "https", url.host != nil else { return nil }
                return url
            }
            .first
    }

    static func scheduleActionLabel(_ kind: HubEventScheduleKind) -> String {
        switch kind {
        case .salesOpen: return "구매/예약 페이지"
        case .ticketOpen: return "티켓 페이지"
        case .contentReveal: return "콘텐츠"
        case .announcement: return "공지"
        case .deadline, .mainWindow, .release, .custom: return "상세 보기"
        }
    }

    static func scheduleKindLabel(_ kind: HubEventScheduleKind) -> String {
        switch kind {
        case .mainWindow: return "행사 기간"
        case .announcement: return "공지"
        case .salesOpen: return "판매 시작"
        case .ticketOpen: return "예매 시작"
        case .contentReveal: return "콘텐츠 공개"
        case .release: return "출시"
        case .deadline: return "마감"
        case .custom: return "일정"
        }
    }

    static func displayTitle(_ item: HubEventScheduleItem) -> String {
        if let title = item.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty {
            return title
        }
        let label = item.label.trimmingCharacters(in: .whitespacesAndNewlines)
        return label.isEmpty ? scheduleKindLabel(item.kind) : label
    }

    static func scheduleDescription(_ item: HubEventScheduleItem) -> String? {
        guard let description = item.description?.trimmingCharacters(in: .whitespacesAndNewlines),
              !description.isEmpty else { return nil }
        return description
    }

    private static func schedulePeriodText(_ item: HubEventScheduleItem) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: item.timezone) ?? TimeZone(identifier: "Asia/Seoul")!
        if item.timePrecision == .date {
            let start = calendar.startOfDay(for: item.startsAt)
            let end = item.endsAt.map { calendar.startOfDay(for: $0) }
            let dateFormatter = DateFormatter()
            dateFormatter.calendar = calendar
            dateFormatter.timeZone = calendar.timeZone
            dateFormatter.dateFormat = "yyyy.MM.dd"
            if let end, end != start { return "\(dateFormatter.string(from: start)) - \(dateFormatter.string(from: end))" }
            return dateFormatter.string(from: start)
        }
        if let end = item.endsAt { return "\(format(item.startsAt)) - \(format(end))" }
        return format(item.startsAt)
    }

    private static func scheduleStateText(_ item: HubEventScheduleItem, now: Date) -> String {
        if item.cancelledAt != nil { return "취소" }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: item.timezone) ?? TimeZone(identifier: "Asia/Seoul")!
        if item.timePrecision == .date {
            let today = calendar.startOfDay(for: now)
            let start = calendar.startOfDay(for: item.startsAt)
            let end = item.endsAt.map { calendar.startOfDay(for: $0) } ?? start
            if today < start { return "예정" }
            if today > end { return "완료" }
            return "진행"
        }
        if now < item.startsAt { return "예정" }
        if let end = item.endsAt, now < end { return "진행" }
        if item.endsAt == nil && now == item.startsAt { return "진행" }
        return "완료"
    }

    static func heroSubtitleLines(for event: HubEvent, now: Date = Date()) -> [String] {
        let venue = event.venueName?.isEmpty == false ? event.venueName! : event.sourceLabel
        let timing = hasTimelineSchedule(event)
            ? nextScheduleItem(event, now: now).map { "다음 일정 · \(displayTitle($0)) · \(schedulePeriodText($0))" } ?? "예정된 세부 일정이 없습니다."
            : periodText(for: event)
        return [venue, timing]
            .filter { !$0.isEmpty }
            .reduce(into: [String]()) { result, line in
                if !result.contains(line) {
                    result.append(line)
                }
            }
    }

    static func heroTags(for event: HubEvent) -> [HubEventHeroTag] {
        let primaryTags = [
            HubEventHeroTag(label: event.status.displayName, tone: .status),
            HubEventHeroTag(label: event.category.displayName, tone: .category),
            HubEventHeroTag(label: event.participationMode.displayName, tone: .participation)
        ]
        let supplementaryTags = HubEventTagDisplayPolicy.secondaryLabels(for: event.tags)
            .map { HubEventHeroTag(label: $0, tone: .supplementary) }
        return (primaryTags + supplementaryTags).reduce(into: [HubEventHeroTag]()) { result, tag in
            if !result.contains(where: { $0.label == tag.label }) {
                result.append(tag)
            }
        }
    }

    static func periodText(for event: HubEvent) -> String {
        switch (event.startsAt, event.endsAt) {
        case let (start?, end?):
            return "\(format(start)) - \(format(end))"
        case let (start?, nil):
            return "\(format(start)) 시작"
        default:
            return "미정"
        }
    }

    static func statusTimingText(for event: HubEvent) -> String {
        if event.status == .open {
            return "진행 중"
        }
        if event.status == .closingSoon {
            return "마감 임박"
        }
        return event.status.displayName
    }

    static func linkActionLabel(for category: HubEventCategory) -> String {
        switch category {
        case .onlineGoods, .onlineCollab:
            return "구매 링크"
        case .offlineConcert, .ticketing:
            return "티켓 링크"
        default:
            return "예약 링크"
        }
    }

    static func format(_ date: Date) -> String {
        formatter.string(from: date)
    }
}

private struct HubEventHeroImage: View {
    let url: URL?

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
                    .background(Color.black)
            default:
                fallback
            }
                }
            } else {
                fallback
            }
        }
    }

    private var fallback: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.21, green: 0.31, blue: 0.39), Color(red: 0.06, green: 0.17, blue: 0.21), Color(red: 0.06, green: 0.08, blue: 0.09)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Circle()
                .fill(.white.opacity(0.18))
                .frame(width: 94, height: 94)
                .offset(x: -110, y: -70)
            RoundedRectangle(cornerRadius: 40, style: .continuous)
                .fill(.white.opacity(0.13))
                .frame(width: 260, height: 150)
                .rotationEffect(.degrees(-8))
                .offset(x: 86, y: 86)
        }
    }
}

enum HubEventHeroTagStyle {
    static let backgroundOpacity = 0.78
    static let borderOpacity = 0.95
    static let shadowOpacity = 0.35
}

private struct HubEventHeroTagView: View {
    let tag: HubEventHeroTag

    var body: some View {
        Text(tag.label)
            .font(.caption.weight(.bold))
            .foregroundStyle(Color.black.opacity(0.78))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(background, in: Capsule())
            .overlay {
                Capsule()
                    .stroke(toneColor.opacity(HubEventHeroTagStyle.borderOpacity), lineWidth: 1)
            }
            .shadow(
                color: .black.opacity(HubEventHeroTagStyle.shadowOpacity),
                radius: 3,
                y: 1
            )
    }

    private var toneColor: Color {
        switch tag.tone {
        case .status:
            return Color(red: 0.22, green: 0.78, blue: 0.61)
        case .category:
            return Color(red: 1.0, green: 0.74, blue: 0.32)
        case .participation:
            return Color(red: 0.64, green: 0.83, blue: 1.0)
        case .supplementary:
            return Color(red: 0.75, green: 0.68, blue: 1.0)
        }
    }

    private var background: Color {
        toneColor.opacity(HubEventHeroTagStyle.backgroundOpacity)
    }
}

private struct HubEventStatusBadge: View {
    let status: HubEventStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption.weight(.bold))
            .foregroundStyle(Color(red: 0.08, green: 0.44, blue: 0.33))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(red: 0.08, green: 0.44, blue: 0.33).opacity(0.1), in: Capsule())
    }
}

private struct HubEventCTAButtonStyle: ButtonStyle {
    let primary: Bool

    func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .font(.subheadline.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.82)
                .foregroundStyle(primary ? .white : HubEventDetailColors.text)
                .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(primary ? Color(red: 0.04, green: 0.48, blue: 0.44) : HubEventDetailColors.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(primary ? .clear : HubEventDetailColors.line, lineWidth: 1)
            }
            .opacity(configuration.isPressed ? 0.82 : 1)
    }
}
