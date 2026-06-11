import Foundation

@MainActor
final class MockHubStore: ObservableObject {
    private static let calendarTimeZone = TimeZone(identifier: "Asia/Seoul") ?? .current
    private static let calendarDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = calendarTimeZone
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
    private static let calendarTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = calendarTimeZone
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    @Published var selectedFilter = "all"
    @Published var settings = NotificationSettingsState()

    let filters: [GenerationFilter] = [
        .init(id: "all", displayName: "전체", notificationDefaultEnabled: true),
        .init(id: "gen1", displayName: "1기생", notificationDefaultEnabled: true),
        .init(id: "gen2", displayName: "2기생", notificationDefaultEnabled: true),
        .init(id: "gen3", displayName: "3기생", notificationDefaultEnabled: true),
        .init(id: "gamja", displayName: "감자", notificationDefaultEnabled: true),
        .init(id: "official", displayName: "기타", notificationDefaultEnabled: true),
        .init(id: "gen4-upcoming", displayName: "upcoming", notificationDefaultEnabled: false)
    ]

    let members: [HubMember] = [
        .init(id: "ayatsuno-yuni", koreanName: "아야츠노 유니", englishName: "Ayatsuno Yuni", generationId: "gen1", generationName: "1기생", unitName: "Everys", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "45e71a76e949e16a34764deb962f9d9f", youtubeHandle: "@ayatsunoyuni", xHandle: "AyatsunoYuni", isLive: true, notificationEnabled: true, realtimeEnabled: true, liveStartedAt: Date(timeIntervalSince1970: 1_780_390_800)),
        .init(id: "sakihane-huya", koreanName: "사키하네 후야", englishName: "Sakihane Huya", generationId: "gen1", generationName: "1기생", unitName: "Everys", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "36ddb9bb4f17593b60f1b63cec86611d", youtubeHandle: "@Sakihanechannel", xHandle: "verify_required", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "shirayuki-hina", koreanName: "시라유키 히나", englishName: "Shirayuki Hina", generationId: "gen2", generationName: "2기생", unitName: "Universe", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "b044e3a3b9259246bc92e863e7d3f3b8", youtubeHandle: "verify_required", xHandle: "verify_required", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "neneko-mashiro", koreanName: "네네코 마시로", englishName: "Neneko Mashiro", generationId: "gen2", generationName: "2기생", unitName: "Universe", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "4515b179f86b67b4981e16190817c580", youtubeHandle: "verify_required", xHandle: "verify_required", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "akane-lize", koreanName: "아카네 리제", englishName: "Akane Lize", generationId: "gen2", generationName: "2기생", unitName: "Universe", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "4325b1d5bbc321fad3042306646e2e50", youtubeHandle: "verify_required", xHandle: "verify_required", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "arahashi-tabi", koreanName: "아라하시 타비", englishName: "Arahashi Tabi", generationId: "gen2", generationName: "2기생", unitName: "Universe", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "a6c4ddb09cdb160478996007bff35296", youtubeHandle: "verify_required", xHandle: "verify_required", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "tenko-shibuki", koreanName: "텐코 시부키", englishName: "Tenko Shibuki", generationId: "gen3", generationName: "3기생", unitName: "Cliche", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "64d76089fba26b180d9c9e48a32600d9", youtubeHandle: nil, xHandle: "TenkoShibuki", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "aokumo-rin", koreanName: "아오쿠모 린", englishName: "Aokumo Rin", generationId: "gen3", generationName: "3기생", unitName: "Cliche", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "516937b5f85cbf2249ce31b0ad046b0f", youtubeHandle: nil, xHandle: "AokumoRin", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "hanako-nana", koreanName: "하나코 나나", englishName: "Hanako Nana", generationId: "gen3", generationName: "3기생", unitName: "Cliche", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "4d812b586ff63f8a2946e64fa860bbf5", youtubeHandle: nil, xHandle: "HanakoNana_", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "yuzuha-riko", koreanName: "유즈하 리코", englishName: "Yuzuha Riko", generationId: "gen3", generationName: "3기생", unitName: "Cliche", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "8fd39bb8de623317de90654718638b10", youtubeHandle: nil, xHandle: "YuzuhaRiko", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "gangzi", koreanName: "강지", englishName: "Gangzi", generationId: "gamja", generationName: "감자", unitName: "감자", catalogRole: .representative, roleLabel: "스텔라이브 대표", isPerson: true, chzzkChannelId: "b5ed5db484d04faf4d150aedd362f34b", youtubeHandle: "@GANGZI1", xHandle: "GANGZIIII", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "stellive-official", koreanName: "스텔라이브 공식", englishName: "Stellive Official", generationId: "official", generationName: "기타", unitName: "공식 채널", catalogRole: .officialChannel, roleLabel: "스텔라이브 공식 채널", isPerson: false, chzzkChannelId: nil, youtubeHandle: "@stellive_official", xHandle: "StelLive_kr", isLive: false, notificationEnabled: true, realtimeEnabled: true),
        .init(id: "gen4-placeholder", koreanName: "4기생 placeholder", englishName: "Generation 4 Placeholder", generationId: "gen4-upcoming", generationName: "4기생", unitName: "upcoming", catalogRole: .placeholder, roleLabel: nil, activeStatus: .upcoming, isPerson: false, chzzkChannelId: nil, youtubeHandle: nil, xHandle: nil, isLive: false, notificationEnabled: false, realtimeEnabled: false)
    ]

    let hubEvents: [HubEvent] = [
        .init(
            id: "closing-official-goods",
            category: .onlineGoods,
            participationMode: .online,
            status: .closingSoon,
            title: "스텔라이브 공식 굿즈 예약 마감 임박",
            summary: "공식 굿즈 예약이 곧 마감됩니다.",
            memberId: nil,
            generationId: "official",
            sourceUrl: "https://example.com/hub/closing-official-goods",
            sourceLabel: "Stellive Official",
            sourceType: .official,
            announcedAt: Date(timeIntervalSince1970: 1_780_300_000),
            startsAt: nil,
            endsAt: Date(timeIntervalSince1970: 1_780_560_000),
            purchaseUrl: "https://example.com/hub/closing-official-goods/buy",
            ticketUrl: nil,
            venueName: nil,
            venueAddress: nil,
            notificationEligible: true,
            updatedAt: Date(timeIntervalSince1970: 1_780_400_000)
        ),
        .init(
            id: "open-gen3-goods",
            category: .onlineCollab,
            participationMode: .online,
            status: .open,
            title: "3기생 콜라보 굿즈 판매 중",
            summary: "3기생 콜라보 굿즈가 판매 중입니다.",
            memberId: nil,
            generationId: "gen3",
            sourceUrl: "https://example.com/hub/open-gen3-goods",
            sourceLabel: "Stellive Official Collab",
            sourceType: .officialCollab,
            announcedAt: Date(timeIntervalSince1970: 1_780_200_000),
            startsAt: Date(timeIntervalSince1970: 1_780_340_000),
            endsAt: Date(timeIntervalSince1970: 1_780_660_000),
            purchaseUrl: "https://example.com/hub/open-gen3-goods/buy",
            ticketUrl: nil,
            venueName: nil,
            venueAddress: nil,
            notificationEligible: true,
            updatedAt: Date(timeIntervalSince1970: 1_780_350_000)
        ),
        .init(
            id: "upcoming-offline-popup",
            category: .offlinePopup,
            participationMode: .offline,
            status: .upcoming,
            title: "오프라인 팝업 스토어 예정",
            summary: "오프라인 팝업 스토어가 곧 열립니다.",
            memberId: nil,
            generationId: "official",
            sourceUrl: "https://example.com/hub/upcoming-offline-popup",
            sourceLabel: "Stellive Official Collab",
            sourceType: .officialCollab,
            announcedAt: Date(timeIntervalSince1970: 1_780_100_000),
            startsAt: Date(timeIntervalSince1970: 1_780_720_000),
            endsAt: nil,
            purchaseUrl: nil,
            ticketUrl: nil,
            venueName: "서울 팝업 스토어",
            venueAddress: nil,
            notificationEligible: true,
            updatedAt: Date(timeIntervalSince1970: 1_780_120_000)
        )
    ]

    let history: [NotificationHistoryItem] = [
        .init(id: "h3", title: "마감 임박", body: "스텔라이브 공식 굿즈 예약 마감 임박", memberId: "hub-event:closing-official-goods", memberName: "굿즈/행사", eventType: "event_deadline_soon", deliveryMode: .standard, deliveryLatencyMs: nil),
        .init(id: "h1", title: "방송 시작", body: "아야츠노 유니 CHZZK 방송 시작", memberId: "ayatsuno-yuni", memberName: "아야츠노 유니", eventType: "chzzk_live_started", deliveryMode: .realtimeBestEffort, deliveryLatencyMs: 1800),
        .init(id: "h2", title: "공식 업로드", body: "스텔라이브 공식 YouTube 업로드", memberId: "stellive-official", memberName: "스텔라이브 공식", eventType: "official_youtube_upload", deliveryMode: .realtimeBestEffort, deliveryLatencyMs: 2400)
    ]

    var historyEventTypeFilters: [HistoryFilterOption] {
        let filters = uniqueHistoryFilters { item in
            .init(
                id: item.eventType,
                displayName: NotificationEventType(rawValue: item.eventType)?.displayName ?? item.title
            )
        }

        return [.init(id: "all", displayName: "전체")] + filters
    }

    var historyMemberFilters: [HistoryFilterOption] {
        let filters = uniqueHistoryFilters { item in
            .init(id: item.memberId, displayName: item.memberName)
        }

        return [.init(id: "all", displayName: "전체")] + filters
    }

    var filteredMembers: [HubMember] {
        members.filter { selectedFilter == "all" || $0.generationId == selectedFilter }
    }

    var liveMembers: [HubMember] {
        members
            .filter { $0.catalogRole != .officialChannel && $0.isLive }
            .sorted { $0.koreanName < $1.koreanName }
    }

    var recentHistoryPreview: [NotificationHistoryItem] {
        Array(history.prefix(3))
    }

    var closingSoonHubEvents: [HubEvent] {
        orderedHubEvents(hubEvents.filter { $0.status == .closingSoon })
    }

    var liveMemberCount: Int {
        members.filter(\.isLive).count
    }

    var chzzkLiveTargets: [HubMember] {
        members.filter { $0.catalogRole != .officialChannel && $0.chzzkChannelId != nil }
    }

    var chzzkLiveTargetCount: Int {
        chzzkLiveTargets.count
    }

    var offlineChzzkTargetCount: Int {
        chzzkLiveTargets.filter { !$0.isLive }.count
    }

    var recentNotificationCount: Int {
        history.count
    }

    var realtimeHistoryCount: Int {
        history.filter { $0.deliveryMode == .realtimeBestEffort }.count
    }

    var averageHistoryLatencySummary: String {
        let latencies = history.compactMap(\.deliveryLatencyMs)
        guard !latencies.isEmpty else { return "-" }

        let averageMilliseconds = Double(latencies.reduce(0, +)) / Double(latencies.count)
        return String(format: "%.1f초", averageMilliseconds / 1000)
    }

    var deliveryModeSummary: String {
        settings.realtimeEnabled ? "실시간" : "표준"
    }

    var hubEventsSummary: HubEventsSummary {
        let sortedEvents = orderedHubEvents(hubEvents)

        return HubEventsSummary(
            openCount: hubEvents.filter { $0.status == .open }.count,
            upcomingCount: hubEvents.filter { $0.status == .upcoming }.count,
            closingSoonCount: hubEvents.filter { $0.status == .closingSoon }.count,
            preview: Array(sortedEvents.prefix(3))
        )
    }

    func orderedHubEvents(_ events: [HubEvent]) -> [HubEvent] {
        events.sorted { lhs, rhs in
            let lhsRank = Self.hubEventStatusRank(lhs.status)
            let rhsRank = Self.hubEventStatusRank(rhs.status)
            if lhsRank != rhsRank {
                return lhsRank < rhsRank
            }

            let lhsDate = lhs.endsAt ?? lhs.startsAt ?? lhs.updatedAt
            let rhsDate = rhs.endsAt ?? rhs.startsAt ?? rhs.updatedAt
            if lhsDate != rhsDate {
                return lhsDate < rhsDate
            }

            return lhs.id < rhs.id
        }
    }

    func hubEvents(for filter: String) -> [HubEvent] {
        let filtered: [HubEvent]
        switch filter {
        case "goods":
            filtered = hubEvents.filter { $0.category == .onlineGoods || $0.category == .onlineCollab }
        case "ticketing":
            filtered = hubEvents.filter { $0.category == .ticketing }
        case "offline":
            filtered = hubEvents.filter { $0.participationMode.isOffline }
        case "closing":
            filtered = hubEvents.filter { $0.status == .closingSoon }
        default:
            filtered = hubEvents
        }

        return orderedHubEvents(filtered)
    }

    func calendarDays(for filter: String) -> [HubCalendarDay] {
        let entries = hubEvents(for: filter)
            .map(calendarEntry(for:))
            .sorted(by: HubCalendarPolicy.areInDisplayOrder)
        let grouped = Dictionary(grouping: entries, by: \.displayDate)

        return grouped.keys.sorted().map { date in
            HubCalendarDay(date: date, entries: grouped[date] ?? [])
        }
    }

    func calendarWidgetSnapshot(limit: Int = 5) -> HubCalendarWidgetSnapshot {
        let now = Date()
        let entries = hubEvents(for: "all")
            .map(calendarEntry(for:))
            .filter { $0.status != .ended && $0.status != .cancelled }
            .sorted(by: HubCalendarPolicy.areInDisplayOrder)
            .prefix(max(1, min(limit, 10)))

        return HubCalendarWidgetSnapshot(
            generatedAt: now,
            timezone: "Asia/Seoul",
            entries: Array(entries),
            staleAfter: now.addingTimeInterval(6 * 60 * 60)
        )
    }

    private func calendarEntry(for event: HubEvent) -> HubCalendarEntry {
        let displayDate = Self.calendarDateFormatter.string(from: event.startsAt ?? event.endsAt ?? event.updatedAt)

        return HubCalendarEntry(
            id: "\(event.id):\(displayDate)",
            eventId: event.id,
            title: event.title,
            category: event.category,
            status: event.status,
            participationMode: event.participationMode,
            generationId: event.generationId,
            memberId: event.memberId,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            displayDate: displayDate,
            displayTimeText: calendarTimeText(for: event),
            sourceLabel: event.sourceLabel,
            appDeepLink: "stellivehub://hub-events/\(event.id)"
        )
    }

    private func calendarTimeText(for event: HubEvent) -> String {
        if let startsAt = event.startsAt {
            return "\(Self.calendarTimeFormatter.string(from: startsAt)) 시작"
        }
        if let endsAt = event.endsAt {
            return "\(Self.calendarTimeFormatter.string(from: endsAt)) 마감"
        }
        return "종일"
    }

    func member(for historyItem: NotificationHistoryItem) -> HubMember? {
        members.first { $0.id == historyItem.memberId }
    }

    func filteredHistory(eventTypeFilterId: String, memberFilterId: String) -> [NotificationHistoryItem] {
        history.filter { item in
            let matchesEventType = eventTypeFilterId == "all" || item.eventType == eventTypeFilterId
            let matchesMember = memberFilterId == "all" || item.memberId == memberFilterId
            return matchesEventType && matchesMember
        }
    }

    private func uniqueHistoryFilters(
        map: (NotificationHistoryItem) -> HistoryFilterOption
    ) -> [HistoryFilterOption] {
        var seen = Set<String>()

        return history.compactMap { item in
            let option = map(item)
            guard seen.insert(option.id).inserted else { return nil }
            return option
        }
    }

    private static func hubEventStatusRank(_ status: HubEventStatus) -> Int {
        switch status {
        case .closingSoon:
            return 0
        case .open:
            return 1
        case .upcoming:
            return 2
        case .announced:
            return 3
        case .cancelled:
            return 4
        case .ended:
            return 5
        }
    }
}
