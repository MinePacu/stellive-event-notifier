import Foundation

enum CatalogRole: String, Codable {
    case member
    case representative
    case officialChannel = "official_channel"
    case placeholder
}

enum ActiveStatus: String, Codable {
    case active
    case upcoming
}

enum DeliveryMode: String, Codable {
    case standard
    case realtimeBestEffort = "realtime_best_effort"
}

enum TapAction: String, Codable {
    case openApp = "open_app"
    case openPlatform = "open_platform"
}

enum NotificationPlatform: String, Codable, CaseIterable, Hashable, Identifiable {
    case chzzk
    case youtube
    case x
    case hubEvent = "hub_event"
    case naverCafe = "naver_cafe"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .chzzk:
            return "CHZZK"
        case .youtube:
            return "YouTube"
        case .x:
            return "X"
        case .hubEvent:
            return "굿즈/행사"
        case .naverCafe:
            return "Naver Cafe"
        }
    }
}

enum NotificationEventType: String, Codable, CaseIterable, Hashable, Identifiable {
    case xPost = "x_post"
    case cafePost = "cafe_post"
    case chzzkLiveStarted = "chzzk_live_started"
    case chzzkLiveEnded = "chzzk_live_ended"
    case chzzkChat = "chzzk_chat"
    case chzzkSubscription = "chzzk_subscription"
    case youtubeUpload = "youtube_upload"
    case youtubeLiveScheduled = "youtube_live_scheduled"
    case youtubeLiveStarted = "youtube_live_started"
    case youtubeLiveEnded = "youtube_live_ended"
    case officialXPost = "official_x_post"
    case officialYoutubeUpload = "official_youtube_upload"
    case eventAnnounced = "event_announced"
    case eventSalesOpen = "event_sales_open"
    case eventDeadlineSoon = "event_deadline_soon"
    case eventUpdated = "event_updated"
    case eventCancelled = "event_cancelled"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .xPost:
            return "X 게시글"
        case .cafePost:
            return "카페 게시글"
        case .chzzkLiveStarted:
            return "CHZZK 방송 시작"
        case .chzzkLiveEnded:
            return "CHZZK 방송 종료"
        case .chzzkChat:
            return "CHZZK 채팅"
        case .chzzkSubscription:
            return "CHZZK 구독"
        case .youtubeUpload:
            return "YouTube 업로드"
        case .youtubeLiveScheduled:
            return "YouTube 라이브 예정"
        case .youtubeLiveStarted:
            return "YouTube 라이브 시작"
        case .youtubeLiveEnded:
            return "YouTube 라이브 종료"
        case .officialXPost:
            return "공식 X 게시글"
        case .officialYoutubeUpload:
            return "공식 YouTube 업로드"
        case .eventAnnounced:
            return "굿즈/행사 공개"
        case .eventSalesOpen:
            return "예약/판매 시작"
        case .eventDeadlineSoon:
            return "마감 임박"
        case .eventUpdated:
            return "굿즈/행사 변경"
        case .eventCancelled:
            return "굿즈/행사 취소"
        }
    }
}

enum NotificationPreferenceScope: String, Codable, CaseIterable, Hashable {
    case global
    case generation
    case member
    case platform
    case eventType = "event_type"
    case generationPlatform = "generation_platform"
    case generationEventType = "generation_event_type"
    case memberPlatform = "member_platform"
    case memberEventType = "member_event_type"

    var displayName: String {
        switch self {
        case .global:
            return "전체"
        case .generation:
            return "기수/분류"
        case .member:
            return "개별 항목"
        case .platform:
            return "플랫폼"
        case .eventType:
            return "이벤트 타입"
        case .generationPlatform:
            return "기수/분류 + 플랫폼"
        case .generationEventType:
            return "기수/분류 + 이벤트 타입"
        case .memberPlatform:
            return "항목 + 플랫폼"
        case .memberEventType:
            return "항목 + 이벤트 타입"
        }
    }
}

enum AppearanceMode: String, Codable, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system:
            return "자동"
        case .light:
            return "라이트"
        case .dark:
            return "다크"
        }
    }
}

enum HubEventCategory: String, Codable, CaseIterable, Hashable, Identifiable {
    case onlineGoods = "online_goods"
    case onlineCollab = "online_collab"
    case offlineConcert = "offline_concert"
    case offlineCollab = "offline_collab"
    case offlinePopup = "offline_popup"
    case ticketing

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .onlineGoods:
            return "굿즈"
        case .onlineCollab:
            return "온라인 콜라보"
        case .offlineConcert:
            return "콘서트"
        case .offlineCollab:
            return "오프라인 콜라보"
        case .offlinePopup:
            return "팝업"
        case .ticketing:
            return "티켓"
        }
    }
}

enum HubEventParticipationMode: String, Codable, Hashable {
    case online
    case offline
    case hybrid

    var displayName: String {
        switch self {
        case .online:
            return "온라인"
        case .offline:
            return "오프라인"
        case .hybrid:
            return "온/오프라인"
        }
    }

    var isOffline: Bool {
        self == .offline || self == .hybrid
    }
}

enum HubEventStatus: String, Codable, Hashable {
    case announced
    case upcoming
    case open
    case closingSoon = "closing_soon"
    case ended
    case cancelled

    var displayName: String {
        switch self {
        case .announced:
            return "공개"
        case .upcoming:
            return "예정"
        case .open:
            return "진행 중"
        case .closingSoon:
            return "마감 임박"
        case .ended:
            return "종료"
        case .cancelled:
            return "취소"
        }
    }
}

enum HubEventSourceType: String, Codable, Hashable {
    case official
    case member
    case officialCollab = "official_collab"
}

struct HubEvent: Identifiable, Hashable {
    let id: String
    let category: HubEventCategory
    let participationMode: HubEventParticipationMode
    let status: HubEventStatus
    let title: String
    let summary: String?
    let memberId: String?
    let generationId: String
    let sourceUrl: String
    let sourceLabel: String
    let sourceType: HubEventSourceType
    let announcedAt: Date?
    let startsAt: Date?
    let endsAt: Date?
    let purchaseUrl: String?
    let ticketUrl: String?
    let venueName: String?
    let venueAddress: String?
    let notificationEligible: Bool
    let updatedAt: Date
}

struct HubEventsSummary: Equatable {
    let openCount: Int
    let upcomingCount: Int
    let closingSoonCount: Int
    let preview: [HubEvent]
}

struct HubMember: Identifiable, Hashable {
    let id: String
    let koreanName: String
    let englishName: String
    let generationId: String
    let generationName: String
    let unitName: String
    let catalogRole: CatalogRole
    let roleLabel: String?
    let activeStatus: ActiveStatus
    let isPerson: Bool
    let chzzkChannelId: String?
    let youtubeHandle: String?
    let xHandle: String?
    var isLive: Bool
    var notificationEnabled: Bool
    var realtimeEnabled: Bool
    var liveStartedAt: Date? = nil

    init(
        id: String,
        koreanName: String,
        englishName: String,
        generationId: String,
        generationName: String,
        unitName: String,
        catalogRole: CatalogRole,
        roleLabel: String?,
        activeStatus: ActiveStatus = .active,
        isPerson: Bool,
        chzzkChannelId: String?,
        youtubeHandle: String?,
        xHandle: String?,
        isLive: Bool,
        notificationEnabled: Bool,
        realtimeEnabled: Bool,
        liveStartedAt: Date? = nil
    ) {
        self.id = id
        self.koreanName = koreanName
        self.englishName = englishName
        self.generationId = generationId
        self.generationName = generationName
        self.unitName = unitName
        self.catalogRole = catalogRole
        self.roleLabel = roleLabel
        self.activeStatus = activeStatus
        self.isPerson = isPerson
        self.chzzkChannelId = chzzkChannelId
        self.youtubeHandle = youtubeHandle
        self.xHandle = xHandle
        self.isLive = isLive
        self.notificationEnabled = notificationEnabled
        self.realtimeEnabled = realtimeEnabled
        self.liveStartedAt = liveStartedAt
    }
}

enum LiveStatusFormatter {
    static func statusText(isLive: Bool, startedAt: Date?, now: Date = Date()) -> String {
        guard isLive else { return "오프라인" }
        guard let startedAt, startedAt <= now else { return "방송 중" }

        let elapsedMinutes = max(0, Int(now.timeIntervalSince(startedAt) / 60))
        let hours = elapsedMinutes / 60
        let minutes = elapsedMinutes % 60
        let elapsedText: String
        if elapsedMinutes < 1 {
            elapsedText = "방금 시작"
        } else if hours > 0 {
            elapsedText = "\(hours)시간 \(minutes)분"
        } else {
            elapsedText = "\(minutes)분"
        }
        return "방송 중 · \(elapsedText) 진행 중"
    }
}

struct GenerationFilter: Identifiable, Hashable {
    let id: String
    let displayName: String
    let notificationDefaultEnabled: Bool
}

struct NotificationHistoryItem: Identifiable, Hashable {
    let id: String
    let title: String
    let body: String
    let memberId: String
    let memberName: String
    let eventType: String
    let deliveryMode: DeliveryMode
    let deliveryLatencyMs: Int?
}

struct CombinationPreference: Identifiable, Hashable {
    let id: String
    let scope: NotificationPreferenceScope
    let label: String
    var enabled: Bool
}

struct QuietHoursState: Equatable {
    var enabled = false
    var start = "23:00"
    var end = "08:00"
    var timezone = "Asia/Seoul"
}

struct KeywordFilterState: Equatable {
    var allowlistText = ""
    var blocklistText = ""

    var hasExplicitFilters: Bool {
        !allowlistText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            !blocklistText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

struct RateLimitState: Equatable {
    var maxNotificationsPerMinute = 10
}

struct NotificationSettingsState: Equatable {
    static let realtimeDisclosureLines = [
        "최대한 실시간 모드는 가능한 한 빠르게 알림을 받도록 시도하지만, 플랫폼/OS/네트워크 사정으로 지연될 수 있습니다.",
        "배터리와 데이터 사용량이 증가할 수 있습니다.",
        "사용자가 꺼둔 알림, 조용한 시간, 차단 키워드, rate limit은 계속 적용됩니다."
    ]

    var globalEnabled = true
    var realtimeEnabled = false
    var tapAction: TapAction = .openApp
    var appearanceMode: AppearanceMode = .system
    var chzzkChatEnabled = false
    var generationEnabled = [
        "gen1": true,
        "gen2": true,
        "gen3": true,
        "gamja": true,
        "official": true,
        "gen4-upcoming": false
    ]
    var memberEnabled: [String: Bool] = [:]
    var platformEnabled: [NotificationPlatform: Bool] = [
        .chzzk: true,
        .youtube: true,
        .x: true,
        .hubEvent: true,
        .naverCafe: false
    ]
    var eventTypeEnabled: [NotificationEventType: Bool] = [
        .xPost: true,
        .cafePost: false,
        .chzzkLiveStarted: true,
        .chzzkLiveEnded: true,
        .chzzkChat: false,
        .chzzkSubscription: true,
        .youtubeUpload: true,
        .youtubeLiveScheduled: false,
        .youtubeLiveStarted: false,
        .youtubeLiveEnded: false,
        .officialXPost: true,
        .officialYoutubeUpload: true,
        .eventAnnounced: true,
        .eventSalesOpen: true,
        .eventDeadlineSoon: true,
        .eventUpdated: false,
        .eventCancelled: true
    ]
    var combinationPreferences = [
        CombinationPreference(id: "generation_platform", scope: .generationPlatform, label: "기수/분류 + 플랫폼", enabled: true),
        CombinationPreference(id: "generation_event_type", scope: .generationEventType, label: "기수/분류 + 이벤트 타입", enabled: true),
        CombinationPreference(id: "member_platform", scope: .memberPlatform, label: "항목 + 플랫폼", enabled: true),
        CombinationPreference(id: "member_event_type", scope: .memberEventType, label: "항목 + 이벤트 타입", enabled: true)
    ]
    var quietHours = QuietHoursState()
    var keywordFilters = KeywordFilterState()
    var rateLimit = RateLimitState()

    var canEnableChzzkChatPush: Bool {
        chzzkChatEnabled && keywordFilters.hasExplicitFilters
    }
}
