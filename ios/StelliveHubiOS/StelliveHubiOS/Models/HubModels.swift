import Foundation
import Combine

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
    case hubEvent = "hub_event"
    case naverCafe = "naver_cafe"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .chzzk:
            return "CHZZK"
        case .youtube:
            return "YouTube"
        case .hubEvent:
            return "굿즈/행사"
        case .naverCafe:
            return "Naver Cafe"
        }
    }
}

enum NotificationEventType: String, Codable, CaseIterable, Hashable, Identifiable {
    case cafePost = "cafe_post"
    case chzzkLiveStarted = "chzzk_live_started"
    case chzzkLiveEnded = "chzzk_live_ended"
    case chzzkChat = "chzzk_chat"
    case chzzkSubscription = "chzzk_subscription"
    case youtubeUpload = "youtube_upload"
    case youtubeLiveScheduled = "youtube_live_scheduled"
    case youtubeLiveStarted = "youtube_live_started"
    case youtubeLiveEnded = "youtube_live_ended"
    case officialYoutubeUpload = "official_youtube_upload"
    case eventAnnounced = "event_announced"
    case eventSalesOpen = "event_sales_open"
    case eventDeadlineSoon = "event_deadline_soon"
    case eventMilestoneDue = "event_milestone_due"
    case eventUpdated = "event_updated"
    case eventCancelled = "event_cancelled"

    var id: String { rawValue }

    var displayName: String {
        switch self {
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
        case .officialYoutubeUpload:
            return "공식 YouTube 업로드"
        case .eventAnnounced:
            return "굿즈/행사 공개"
        case .eventSalesOpen:
            return "예약/판매 시작"
        case .eventDeadlineSoon:
            return "마감 임박"
        case .eventMilestoneDue:
            return "굿즈/행사 마일스톤"
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
            return "개별 대상"
        case .platform:
            return "플랫폼"
        case .eventType:
            return "알림 종류"
        case .generationPlatform:
            return "분류별 플랫폼 설정"
        case .generationEventType:
            return "분류별 알림 종류 설정"
        case .memberPlatform:
            return "개별 대상의 플랫폼 설정"
        case .memberEventType:
            return "개별 대상의 알림 종류 설정"
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

enum HubCalendarEntryKind: String, Codable, Hashable {
    case hubEvent = "hub_event"
    case memberBirthday = "member_birthday"
    case generationAnniversary = "generation_anniversary"
}

enum HubCalendarSpecialDayKind: String, Codable, Hashable {
    case memberBirthday = "member_birthday"
    case generationAnniversary = "generation_anniversary"
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

enum HubEventScheduleMode: String, Codable, Hashable {
    case singleWindow = "single_window"
    case timeline
}

enum HubEventScheduleKind: String, Codable, Hashable {
    case mainWindow = "main_window"
    case announcement
    case salesOpen = "sales_open"
    case ticketOpen = "ticket_open"
    case contentReveal = "content_reveal"
    case release
    case deadline
    case custom
}

enum HubEventTimePrecision: String, Codable, Hashable {
    case date
    case datetime
}

enum HubEventLinkKind: String, Codable, Hashable {
    case source
    case purchase
    case ticket
    case reservation
    case content
    case video
    case map
    case custom
}

struct HubEventLink: Identifiable, Hashable {
    let id: String
    let kind: HubEventLinkKind
    let label: String?
    let url: String
    let sortOrder: Int
    var createdAt: Date? = nil
    var updatedAt: Date? = nil
}

struct HubEventScheduleItem: Identifiable, Hashable {
    let id: String
    let kind: HubEventScheduleKind
    let title: String?
    let label: String
    let description: String?
    let startsAt: Date
    let endsAt: Date?
    let timePrecision: HubEventTimePrecision
    let timezone: String
    let actionUrl: String?
    let sourceUrl: String?
    let sourceLabel: String?
    var links: [HubEventLink] = []
    let notificationEligible: Bool
    let isPrimary: Bool
    let sortOrder: Int
    let cancelledAt: Date?
    var createdAt: Date? = nil
}

enum HubEventImagePolicyState: String, Codable, Hashable {
    case none
    case officialRuntimeUrl = "official_runtime_url"
    case thirdPartyAllowed = "third_party_allowed"
    case verifyRequired = "verify_required"
    case blocked
}

struct HubEventImage: Codable, Hashable {
    let policyState: HubEventImagePolicyState
    let url: String?
    let sourceLabel: String?
    let sourceUrl: String?
    let altText: String?
}

enum HubEventImagePolicy {
    static func displayURL(for image: HubEventImage?) -> URL? {
        guard
            let image,
            image.policyState == .officialRuntimeUrl || image.policyState == .thirdPartyAllowed,
            let rawURL = image.url,
            let url = URL(string: rawURL),
            url.scheme == "https"
        else {
            return nil
        }

        return url
    }
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
    var scheduleMode: HubEventScheduleMode = .singleWindow
    var scheduleItems: [HubEventScheduleItem] = []
    var links: [HubEventLink] = []
    let announcedAt: Date?
    let startsAt: Date?
    let endsAt: Date?
    let purchaseUrl: String?
    let ticketUrl: String?
    let venueName: String?
    let venueAddress: String?
    var image: HubEventImage? = nil
    let notificationEligible: Bool
    let updatedAt: Date
}

enum HubEventLinkCTAMode: Equatable {
    case none
    case direct
    case sheet
}

enum HubEventLinkPolicy {
    static func resolvedEventLinks(_ event: HubEvent) -> [HubEventLink] {
        let explicit = resolved(event.links)
        guard explicit.isEmpty else { return explicit }
        return resolved([
            legacy(id: "legacy:\(event.id):purchase", kind: .purchase, label: nil, url: event.purchaseUrl, sortOrder: 0),
            legacy(id: "legacy:\(event.id):ticket", kind: .ticket, label: nil, url: event.ticketUrl, sortOrder: 1),
            legacy(id: "legacy:\(event.id):source", kind: .source, label: event.sourceLabel, url: event.sourceUrl, sortOrder: 2),
        ].compactMap { $0 })
    }

    static func resolvedScheduleLinks(_ item: HubEventScheduleItem) -> [HubEventLink] {
        let explicit = resolved(item.links)
        guard explicit.isEmpty else { return explicit }
        let actionKind: HubEventLinkKind = switch item.kind {
        case .salesOpen: .purchase
        case .ticketOpen: .ticket
        case .deadline, .mainWindow: .reservation
        case .announcement: .source
        case .contentReveal, .release, .custom: .content
        }
        return resolved([
            legacy(id: "legacy:\(item.id):action", kind: actionKind, label: nil, url: item.actionUrl, sortOrder: 0),
            legacy(id: "legacy:\(item.id):source", kind: .source, label: item.sourceLabel, url: item.sourceUrl, sortOrder: 1),
        ].compactMap { $0 })
    }

    static func displayLabel(_ link: HubEventLink) -> String {
        if let label = link.label?.trimmingCharacters(in: .whitespacesAndNewlines), !label.isEmpty {
            return label
        }
        return switch link.kind {
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

    static func eventCTAMode(_ event: HubEvent) -> HubEventLinkCTAMode {
        switch resolvedEventLinks(event).count {
        case 0: .none
        case 1: .direct
        default: .sheet
        }
    }

    static func effectivePrimaryScheduleItemID(_ event: HubEvent) -> String? {
        event.scheduleItems
            .filter { $0.cancelledAt == nil && $0.isPrimary }
            .sorted { left, right in
                if left.sortOrder != right.sortOrder { return left.sortOrder < right.sortOrder }
                if left.startsAt != right.startsAt { return left.startsAt < right.startsAt }
                let leftCreatedAt = left.createdAt ?? .distantPast
                let rightCreatedAt = right.createdAt ?? .distantPast
                if leftCreatedAt != rightCreatedAt { return leftCreatedAt < rightCreatedAt }
                return left.id < right.id
            }
            .first?.id
    }

    private static func resolved(_ links: [HubEventLink]) -> [HubEventLink] {
        var seen = Set<String>()
        return links
            .compactMap { link -> HubEventLink? in
                let value = link.url.trimmingCharacters(in: .whitespacesAndNewlines)
                guard isHTTPS(value) else { return nil }
                let label = link.label?.trimmingCharacters(in: .whitespacesAndNewlines)
                return HubEventLink(
                    id: link.id,
                    kind: link.kind,
                    label: label?.isEmpty == false ? label : nil,
                    url: value,
                    sortOrder: link.sortOrder
                )
            }
            .sorted { left, right in
                left.sortOrder == right.sortOrder ? left.id < right.id : left.sortOrder < right.sortOrder
            }
            .filter { seen.insert($0.url).inserted }
    }

    private static func legacy(id: String, kind: HubEventLinkKind, label: String?, url: String?, sortOrder: Int) -> HubEventLink? {
        guard let url else { return nil }
        return HubEventLink(id: id, kind: kind, label: label, url: url, sortOrder: sortOrder)
    }

    private static func isHTTPS(_ value: String) -> Bool {
        guard let components = URLComponents(string: value) else { return false }
        return components.scheme?.lowercased() == "https" && components.host?.isEmpty == false
    }
}

struct HubEventsSummary: Equatable {
    let openCount: Int
    let upcomingCount: Int
    let closingSoonCount: Int
    let preview: [HubEvent]
}

struct HubCalendarEntry: Identifiable, Codable, Equatable {
    let id: String
    let eventId: String
    let entryKind: HubCalendarEntryKind
    let specialDayKind: HubCalendarSpecialDayKind?
    let specialDayLabel: String?
    var scheduleItemId: String? = nil
    var scheduleKind: HubEventScheduleKind? = nil
    var scheduleLabel: String? = nil
    let title: String
    let category: HubEventCategory
    let status: HubEventStatus
    let participationMode: HubEventParticipationMode
    let generationId: String
    let memberId: String?
    let startsAt: Date?
    let endsAt: Date?
    let displayDate: String
    let displayTimeText: String
    let sourceLabel: String
    let appDeepLink: String
    let platformUrl: String?
}

struct HubCalendarDay: Identifiable, Codable, Equatable {
    var id: String { date }

    let date: String
    let entries: [HubCalendarEntry]
}

enum HubCalendarDeepLinkPolicy {
    private static let scheme = "stellivehub"
    private static let hubEventsHost = "hub-events"

    static func appDeepLink(forEventId eventId: String) -> URL {
        URL(string: "\(scheme)://\(hubEventsHost)/\(eventId)")!
    }

    static func eventId(from url: URL?) -> String? {
        guard
            let url,
            url.scheme == scheme,
            url.host == hubEventsHost
        else {
            return nil
        }

        let eventId = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !eventId.isEmpty, !eventId.contains("/") else { return nil }
        return eventId
    }

    static func scheduleItemId(from url: URL?) -> String? {
        guard let url, url.scheme == scheme, url.host == hubEventsHost else { return nil }
        let value = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == "scheduleItemId" })?
            .value
        return value?.isEmpty == false ? value : nil
    }

    static func canNavigateToDetail(_ entry: HubCalendarEntry) -> Bool {
        entry.entryKind == .hubEvent &&
            eventId(from: URL(string: entry.appDeepLink)) == entry.eventId &&
            !entry.eventId.isEmpty
    }
}

struct HubCalendarWidgetSnapshot: Codable, Equatable {
    let generatedAt: Date
    let timezone: String
    let entries: [HubCalendarEntry]
    let staleAfter: Date
}

enum SongType: String, Codable, CaseIterable, Hashable, Identifiable {
    case original
    case cover

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .original:
            return "오리지널"
        case .cover:
            return "커버"
        }
    }
}

struct SongThumbnail: Codable, Equatable, Hashable {
    let url: String
    let width: Int
    let height: Int
}

struct MusicMemberSummary: Codable, Equatable, Hashable, Identifiable {
    let id: String
    let nameKo: String
    let nameEn: String?
    let role: String?
}

struct SongDisplayText: Equatable {
    let title: String
    let subtitle: String
}

struct YoutubePremiereMetadata: Codable, Equatable, Hashable {
    let classification: String
    let state: String
    let scheduledStartAt: Date?
    let actualStartAt: Date?
    let actualEndAt: Date?
}

struct MusicSourcePlaylist: Codable, Equatable, Hashable {
    let youtubePlaylistId: String
    let title: String
    let type: String
    let youtubeUrl: String
    let isPrimary: Bool
}

struct SongCatalogItem: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let youtubeVideoId: String
    let title: String
    let memberId: String?
    let memberName: String?
    let generationId: String?
    let generationName: String?
    let type: SongType
    let sourceUrl: String?
    let thumbnail: SongThumbnail?
    let publishedAt: Date?
    let catalogAddedAt: Date?
    let thumbnailUrl: String?
    let duration: String?
    let durationSeconds: Int?
    let isInstrumental: Bool
    let specialFlags: [String]
    let classificationStatus: String?
    let members: [MusicMemberSummary]
    let youtubeUrl: String
    let sourcePlaylistId: String?
    let premiere: YoutubePremiereMetadata?
    let sourcePlaylists: [MusicSourcePlaylist]

    init(
        id: String,
        youtubeVideoId: String,
        title: String,
        type: SongType,
        publishedAt: Date? = nil,
        catalogAddedAt: Date? = nil,
        thumbnailUrl: String? = nil,
        duration: String? = nil,
        durationSeconds: Int? = nil,
        isInstrumental: Bool = false,
        specialFlags: [String] = [],
        classificationStatus: String? = nil,
        members: [MusicMemberSummary] = [],
        youtubeUrl: String,
        sourcePlaylistId: String? = nil,
        memberId: String? = nil,
        memberName: String? = nil,
        generationId: String? = nil,
        generationName: String? = nil,
        sourceUrl: String? = nil,
        thumbnail: SongThumbnail? = nil,
        premiere: YoutubePremiereMetadata? = nil,
        sourcePlaylists: [MusicSourcePlaylist] = []
    ) {
        self.id = id
        self.youtubeVideoId = youtubeVideoId
        self.title = title
        self.memberId = memberId
        self.memberName = memberName
        self.generationId = generationId
        self.generationName = generationName
        self.type = type
        self.sourceUrl = sourceUrl
        self.thumbnail = thumbnail
        self.publishedAt = publishedAt
        self.catalogAddedAt = catalogAddedAt
        self.thumbnailUrl = thumbnailUrl ?? thumbnail?.url
        self.duration = duration
        self.durationSeconds = durationSeconds
        self.isInstrumental = isInstrumental
        self.specialFlags = specialFlags
        self.classificationStatus = classificationStatus
        self.members = members
        self.youtubeUrl = youtubeUrl
        self.sourcePlaylistId = sourcePlaylistId
        self.premiere = premiere
        self.sourcePlaylists = sourcePlaylists
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case youtubeVideoId
        case title
        case memberId
        case memberName
        case generationId
        case generationName
        case type
        case sourceUrl
        case thumbnail
        case publishedAt
        case catalogAddedAt
        case thumbnailUrl
        case duration
        case durationSeconds
        case isInstrumental
        case specialFlags
        case classificationStatus
        case members
        case youtubeUrl
        case sourcePlaylistId
        case premiere
        case sourcePlaylists
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let id = try container.decode(String.self, forKey: .id)
        let youtubeVideoId = try container.decode(String.self, forKey: .youtubeVideoId)
        let sourceUrl = try container.decodeIfPresent(String.self, forKey: .sourceUrl)
        self.init(
            id: id,
            youtubeVideoId: youtubeVideoId,
            title: try container.decode(String.self, forKey: .title),
            type: try container.decode(SongType.self, forKey: .type),
            publishedAt: try container.decodeIfPresent(Date.self, forKey: .publishedAt),
            catalogAddedAt: try container.decodeIfPresent(Date.self, forKey: .catalogAddedAt),
            thumbnailUrl: try container.decodeIfPresent(String.self, forKey: .thumbnailUrl),
            duration: try container.decodeIfPresent(String.self, forKey: .duration),
            durationSeconds: try container.decodeIfPresent(Int.self, forKey: .durationSeconds),
            isInstrumental: try container.decodeIfPresent(Bool.self, forKey: .isInstrumental) ?? false,
            specialFlags: (try? container.decode(LossyStringArray.self, forKey: .specialFlags))?.values ?? [],
            classificationStatus: try container.decodeIfPresent(String.self, forKey: .classificationStatus),
            members: try container.decodeIfPresent([MusicMemberSummary].self, forKey: .members) ?? [],
            youtubeUrl: try container.decodeIfPresent(String.self, forKey: .youtubeUrl) ?? sourceUrl ?? "https://www.youtube.com/watch?v=\(youtubeVideoId)",
            sourcePlaylistId: try container.decodeIfPresent(String.self, forKey: .sourcePlaylistId),
            memberId: try container.decodeIfPresent(String.self, forKey: .memberId),
            memberName: try container.decodeIfPresent(String.self, forKey: .memberName),
            generationId: try container.decodeIfPresent(String.self, forKey: .generationId),
            generationName: try container.decodeIfPresent(String.self, forKey: .generationName),
            sourceUrl: sourceUrl,
            thumbnail: try container.decodeIfPresent(SongThumbnail.self, forKey: .thumbnail),
            premiere: try container.decodeIfPresent(YoutubePremiereMetadata.self, forKey: .premiere),
            sourcePlaylists: try container.decodeIfPresent([MusicSourcePlaylist].self, forKey: .sourcePlaylists) ?? []
        )
    }
}

private struct LossyStringArray: Decodable {
    let values: [String]

    init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer()
        var output: [String] = []
        while !container.isAtEnd {
            if let value = try? container.decode(String.self) {
                output.append(value)
            } else {
                _ = try? container.decode(DiscardedJSONValue.self)
            }
        }
        values = output
    }
}

private struct DiscardedJSONValue: Decodable {
    init(from decoder: Decoder) throws {
        if var array = try? decoder.unkeyedContainer() {
            while !array.isAtEnd { _ = try? array.decode(DiscardedJSONValue.self) }
            return
        }
        if let object = try? decoder.container(keyedBy: DynamicCodingKey.self) {
            for key in object.allKeys { _ = try? object.decode(DiscardedJSONValue.self, forKey: key) }
            return
        }
        let value = try decoder.singleValueContainer()
        if value.decodeNil() { return }
        if (try? value.decode(Bool.self)) != nil { return }
        if (try? value.decode(Double.self)) != nil { return }
        _ = try? value.decode(String.self)
    }
}

private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int? = nil
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

struct SongListResponse: Codable, Equatable {
    let items: [SongCatalogItem]
    let nextCursor: String?
    let serverTime: String?

    init(items: [SongCatalogItem], nextCursor: String?, serverTime: String? = nil) {
        self.items = items
        self.nextCursor = nextCursor
        self.serverTime = serverTime
    }
}

typealias MusicListResponse = SongListResponse

struct SongFilterCount: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let label: String
    let generationId: String?
    let count: Int
}

struct SongFacetSummary: Codable, Equatable, Hashable {
    let total: Int
    let original: Int
    let cover: Int
}

struct SongFacetsResponse: Codable, Equatable {
    let summary: SongFacetSummary
    let generationFilters: [SongFilterCount]
    let memberFilters: [SongFilterCount]
    let typeFilters: [SongFilterCount]
}

struct SongFilterOption: Identifiable, Equatable {
    let id: String
    let label: String
}

enum SongMemberMatchMode: String, Codable, Hashable { case any, all }
enum SongParticipation: String, Codable, Hashable { case any, solo, collaboration }

struct SongMemberFilterState: Codable, Equatable, Hashable {
    var selectedMemberIds: Set<String> = []
    var matchMode: SongMemberMatchMode = .any
    var participation: SongParticipation = .any

    func normalized(validMemberIds: Set<String>? = nil) -> Self {
        var copy = self
        let ids = Set(selectedMemberIds.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })
        copy.selectedMemberIds = validMemberIds.map { ids.intersection($0) } ?? ids
        if copy.selectedMemberIds.count < 2 || copy.participation == .solo { copy.matchMode = .any }
        return copy
    }

    static func migrate(selectedMemberId: String?, validMemberIds: Set<String>) -> Self {
        let id = selectedMemberId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return Self(selectedMemberIds: !id.isEmpty && id != "all" && validMemberIds.contains(id) ? [id] : [])
    }
}

enum SongIdentity {
    static func identifier(for song: SongCatalogItem) -> String? {
        let videoId = song.youtubeVideoId.trimmingCharacters(in: .whitespacesAndNewlines)
        if !videoId.isEmpty { return "youtube:\(videoId)" }
        let songId = song.id.trimmingCharacters(in: .whitespacesAndNewlines)
        return songId.isEmpty ? nil : "song:\(songId)"
    }
}

struct SongListQueryKey: Equatable, Hashable {
    let generationId: String
    let type: String
    let libraryId: String
    let sortId: String
    let selectedMemberIds: [String]
    let memberMatchMode: SongMemberMatchMode
    let participation: SongParticipation
    let query: String

    init(generationId: String, type: String, libraryId: String, sortId: String, selectedMemberIds: [String], memberMatchMode: SongMemberMatchMode, participation: SongParticipation, query: String) {
        self.generationId = generationId; self.type = type; self.libraryId = libraryId; self.sortId = sortId
        self.selectedMemberIds = selectedMemberIds.sorted(); self.memberMatchMode = memberMatchMode; self.participation = participation; self.query = query
    }

    init(generationId: String, type: String, libraryId: String, sortId: String, memberId: String, query: String) {
        self.init(generationId: generationId, type: type, libraryId: libraryId, sortId: sortId,
                  selectedMemberIds: memberId.isEmpty || memberId == "all" ? [] : [memberId], memberMatchMode: .any, participation: .any, query: query)
    }
}

struct SongScrollPosition: Equatable, Hashable {
    let anchorSongId: String?
    let anchorOffset: CGFloat
    let fallbackAbsoluteOffset: CGFloat
    let visibleLimitAtCapture: Int
    let queryKey: SongListQueryKey
}

struct SongBrowseSnapshot: Equatable, Hashable {
    var selectedGenerationId = "all"
    var selectedType = "all"
    var selectedLibraryId = "all"
    var selectedSortId = "publishedAt_desc"
    var memberFilter = SongMemberFilterState()
    var query = ""
    var visibleLimit = IOSSongPagePolicy.pageSize

    var queryKey: SongListQueryKey {
        SongListQueryKey(
            generationId: selectedGenerationId,
            type: selectedType,
            libraryId: selectedLibraryId,
            sortId: selectedSortId,
            selectedMemberIds: memberFilter.selectedMemberIds.sorted(),
            memberMatchMode: memberFilter.normalized().matchMode,
            participation: memberFilter.participation,
            query: query
        )
    }
}

@MainActor
final class SongBrowseSessionStore: ObservableObject {
    @Published private(set) var snapshot = SongBrowseSnapshot()
    private(set) var scrollPosition: SongScrollPosition?

    var queryKey: SongListQueryKey {
        snapshot.queryKey
    }

    @discardableResult
    func saveFilters(_ newSnapshot: SongBrowseSnapshot) -> Bool {
        guard snapshot != newSnapshot else { return false }
        snapshot = newSnapshot
        return true
    }

    @discardableResult
    func saveScrollPosition(_ position: SongScrollPosition?) -> Bool {
        guard scrollPosition != position else { return false }
        scrollPosition = position
        return true
    }

    func resetForQueryChange(snapshot newSnapshot: SongBrowseSnapshot) {
        var resetSnapshot = newSnapshot
        resetSnapshot.visibleLimit = IOSSongPagePolicy.pageSize
        saveFilters(resetSnapshot)
        saveScrollPosition(nil)
    }
}

enum IOSSongPagePolicy {
    static let pageSize = 20
    static let titleLineLimit = 3
    static let subtitleLineLimit = 2

    static let generationFilters: [SongFilterOption] = [
        .init(id: "all", label: "전체"),
        .init(id: "gen1", label: "1기생"),
        .init(id: "gen2", label: "2기생"),
        .init(id: "gen3", label: "3기생")
    ]

    static let typeFilters: [SongFilterOption] = [
        .init(id: "all", label: "전체"),
        .init(id: "original", label: "오리지널"),
        .init(id: "cover", label: "커버")
    ]

    static let libraryFilters: [SongFilterOption] = [
        .init(id: "all", label: "전체"),
        .init(id: "favorites", label: "즐겨찾기")
    ]

    static func favoriteIdentifier(for song: SongCatalogItem) -> String? {
        SongIdentity.identifier(for: song)
    }

    static func matchesLibrary(_ song: SongCatalogItem, selectedLibraryId: String, favorites: Set<String>) -> Bool {
        selectedLibraryId != "favorites" || favoriteIdentifier(for: song).map(favorites.contains) == true
    }

    static func favoriteEmptyMessage(hasStoredFavorites: Bool) -> String {
        hasStoredFavorites
            ? "현재 필터 조건에 맞는 즐겨찾기가 없습니다."
            : "즐겨찾기한 노래가 없습니다. 노래 카드의 별 버튼으로 추가해 보세요."
    }

    static let sortOptions: [SongFilterOption] = [
        .init(id: "publishedAt_desc", label: "최신순"),
        .init(id: "publishedAt_asc", label: "오래된순"),
        .init(id: "title_asc", label: "제목순"),
        .init(id: "member_asc", label: "멤버순")
    ]

    static let thumbnailAspectRatio: CGFloat = 16.0 / 9.0
    static let thumbnailSize = CGSize(width: 96, height: 54)
    static let rowInsetTop: CGFloat = 6
    static let rowInsetLeading: CGFloat = 0
    static let rowInsetBottom: CGFloat = 6
    static let rowInsetTrailing: CGFloat = 0
    private static let premiereDateTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        formatter.dateFormat = "M월 d일 HH:mm"
        return formatter
    }()

    static func memberFilters(from members: [HubMember]) -> [SongFilterOption] {
        members
            .filter { $0.catalogRole == .member && ["gen1", "gen2", "gen3"].contains($0.generationId) }
            .map { SongFilterOption(id: $0.id, label: $0.koreanName.isEmpty ? $0.englishName : $0.koreanName) }
    }

    static func participantIds(_ song: SongCatalogItem) -> Set<String> {
        let linked = Set(song.members.map { $0.id.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })
        if !linked.isEmpty { return linked }
        let legacy = song.memberId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return legacy.isEmpty ? [] : [legacy]
    }

    static func matchesMember(_ song: SongCatalogItem, state rawState: SongMemberFilterState) -> Bool {
        let state = rawState.normalized()
        let participants = participantIds(song)
        let memberMatches = state.selectedMemberIds.isEmpty || (state.matchMode == .any
            ? !state.selectedMemberIds.isDisjoint(with: participants)
            : state.selectedMemberIds.isSubset(of: participants))
        let participationMatches: Bool
        switch state.participation {
        case .any: participationMatches = true
        case .solo: participationMatches = participants.count == 1
        case .collaboration: participationMatches = participants.count >= 2
        }
        return memberMatches && participationMatches
    }

    static func matchesMember(_ song: SongCatalogItem, selectedMemberId: String) -> Bool {
        matchesMember(song, state: .migrate(selectedMemberId: selectedMemberId, validMemberIds: [selectedMemberId]))
    }

    static func generationMemberIds(_ members: [HubMember], generationId: String) -> Set<String> {
        Set(memberFilters(from: members).compactMap { option in members.first(where: { $0.id == option.id && $0.generationId == generationId })?.id })
    }

    static func generationPreset(_ members: [HubMember], generationId: String) -> SongMemberFilterState {
        SongMemberFilterState(selectedMemberIds: generationMemberIds(members, generationId: generationId), matchMode: .all).normalized()
    }

    static func generationPresetLabel(_ members: [HubMember], state: SongMemberFilterState) -> String? {
        for (id, label) in [("gen1", "1기생"), ("gen2", "2기생"), ("gen3", "3기생")] {
            let ids = generationMemberIds(members, generationId: id)
            if !ids.isEmpty && ids == state.normalized().selectedMemberIds { return "\(label) 전원 참여" }
        }
        return nil
    }

    static func memberFilterLabel(from members: [HubMember], state rawState: SongMemberFilterState) -> String {
        let state = rawState.normalized()
        if let preset = generationPresetLabel(members, state: state) {
            if state.participation == .any { return preset }
            return preset + (state.participation == .solo ? " · 솔로" : " · 함께")
        }
        if state.selectedMemberIds.isEmpty && state.participation == .any { return "멤버 전체" }
        var text = state.selectedMemberIds.isEmpty ? "멤버 전체" : "선택 \(state.selectedMemberIds.count)명"
        if state.selectedMemberIds.count >= 2 { text += state.matchMode == .all ? " · 모두 참여" : " · 한 명 이상" }
        if state.participation != .any { text += state.participation == .solo ? " · 솔로" : " · 함께" }
        return text
    }

    static func memberFilterLabel(from members: [HubMember], selectedMemberId: String) -> String {
        guard selectedMemberId != "all" else { return "전체" }
        let name = members.first { $0.id == selectedMemberId }?.koreanName ?? ""
        return name.isEmpty ? selectedMemberId : name
    }

    static func canClearMemberFilter(_ state: SongMemberFilterState) -> Bool {
        state.normalized() != SongMemberFilterState()
    }

    static func canClearMemberFilter(_ selectedMemberId: String) -> Bool { !selectedMemberId.isEmpty && selectedMemberId != "all" }

    static func memberFilterEmptyMessage(from members: [HubMember], state rawState: SongMemberFilterState) -> String {
        let state = rawState.normalized()
        if generationPresetLabel(members, state: state) != nil { return "선택한 기수 전원이 참여한 노래가 없습니다." }
        if state.participation == .solo { return "조건에 맞는 솔로곡이 없습니다." }
        if state.participation == .collaboration { return "조건에 맞는 함께 부른 곡이 없습니다." }
        return state.matchMode == .all && state.selectedMemberIds.count >= 2
            ? "선택한 멤버가 모두 참여한 노래가 없습니다."
            : "선택한 멤버 중 한 명 이상 참여한 노래가 없습니다."
    }

    static func displayText(for song: SongCatalogItem, catalogMembers: [HubMember] = []) -> SongDisplayText {
        let parsed = parsedSongTitle(song)
        return SongDisplayText(
            title: parsed.title.isEmpty ? song.title.trimmingCharacters(in: .whitespacesAndNewlines) : parsed.title,
            subtitle: subtitleDisplayText(for: song, parsedArtistNames: parsed.artistNames, catalogMembers: catalogMembers)
        )
    }

    static func titleDisplayText(_ song: SongCatalogItem) -> String {
        displayText(for: song).title
    }

    static func memberDisplayText(_ song: SongCatalogItem, catalogMembers: [HubMember] = []) -> String {
        displayText(for: song, catalogMembers: catalogMembers).subtitle
    }

    private struct ParsedSongTitle {
        let title: String
        let artistNames: [String]
    }

    private static func parsedSongTitle(_ song: SongCatalogItem) -> ParsedSongTitle {
        let normalizedRawTitle = removeLeadingMediaTags(song.title).trimmingCharacters(in: .whitespacesAndNewlines)
        if song.type == .cover {
            return parsedCoverSongTitle(normalizedRawTitle)
        }
        return parsedOriginalSongTitle(normalizedRawTitle)
    }

    private static func parsedCoverSongTitle(_ normalizedRawTitle: String) -> ParsedSongTitle {
        guard let delimiter = lastCoverPerformerDelimiter(in: normalizedRawTitle) else {
            return ParsedSongTitle(title: cleanSongTitle(normalizedRawTitle), artistNames: [])
        }
        let left = String(normalizedRawTitle[..<delimiter.range.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
        let right = String(normalizedRawTitle[delimiter.range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
        return ParsedSongTitle(title: cleanSongTitle(left), artistNames: artistNames(from: right))
    }

    private static func parsedOriginalSongTitle(_ normalizedRawTitle: String) -> ParsedSongTitle {
        let quotedTitle = firstQuotedTitle(in: normalizedRawTitle)
        let delimiter = lastTopLevelDelimiter(in: normalizedRawTitle, delimiters: [" | ", "|"])
        if let quotedTitle {
            let artists = delimiter.map {
                artistNames(from: String(normalizedRawTitle[..<$0.range.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines))
            } ?? []
            return ParsedSongTitle(title: cleanSongTitle(quotedTitle), artistNames: artists)
        }
        guard let delimiter else {
            return ParsedSongTitle(title: cleanSongTitle(normalizedRawTitle), artistNames: [])
        }
        let left = String(normalizedRawTitle[..<delimiter.range.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
        let right = String(normalizedRawTitle[delimiter.range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
        return ParsedSongTitle(title: cleanSongTitle(right), artistNames: artistNames(from: left))
    }

    private static func lastCoverPerformerDelimiter(in value: String) -> (range: Range<String.Index>, delimiter: String)? {
        topLevelDelimiters(in: value, delimiters: ["|", "ㅣ", " / "])
            .reversed()
            .first { delimiter in
                let right = String(value[delimiter.range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                return looksLikeCoverPerformerSegment(right)
            }
    }

    private static func looksLikeCoverPerformerSegment(_ segment: String) -> Bool {
        segment.range(
            of: "\\b(3D\\s+Live\\s+Cover|Live\\s+Cover|Cover|covered\\s+by)\\b|【\\s*COVER\\s*】|커버",
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    private static func lastTopLevelDelimiter(in value: String, delimiters: [String]) -> (range: Range<String.Index>, delimiter: String)? {
        topLevelDelimiters(in: value, delimiters: delimiters).last
    }

    private static func topLevelDelimiters(in value: String, delimiters: [String]) -> [(range: Range<String.Index>, delimiter: String)] {
        var result: [(range: Range<String.Index>, delimiter: String)] = []
        var roundDepth = 0
        var squareDepth = 0
        var japaneseDepth = 0
        var index = value.startIndex
        while index < value.endIndex {
            switch value[index] {
            case "(":
                roundDepth += 1
            case ")":
                roundDepth = max(0, roundDepth - 1)
            case "[":
                squareDepth += 1
            case "]":
                squareDepth = max(0, squareDepth - 1)
            case "【", "「", "『":
                japaneseDepth += 1
            case "】", "」", "』":
                japaneseDepth = max(0, japaneseDepth - 1)
            default:
                break
            }
            if roundDepth == 0, squareDepth == 0, japaneseDepth == 0 {
                if let delimiter = delimiters.first(where: { value[index...].hasPrefix($0) }) {
                    let upperBound = value.index(index, offsetBy: delimiter.count)
                    result.append((range: index..<upperBound, delimiter: delimiter))
                    index = upperBound
                    continue
                }
            }
            index = value.index(after: index)
        }
        return result
    }

    private static func firstQuotedTitle(in value: String) -> String? {
        for pattern in ["‘([^’]+)’", "'([^']+)'", "“([^”]+)”", "\"([^\"]+)\""] {
            if let range = value.range(of: pattern, options: .regularExpression) {
                let matched = String(value[range])
                let trimmed = trimWrappingQuotes(matched)
                if !trimmed.isEmpty {
                    return trimmed
                }
            }
        }
        return nil
    }

    private static func cleanSongTitle(_ value: String) -> String {
        deduplicateRepeatedTitle(
            trimWrappingQuotes(
                removeMusicVideoSuffix(removeLeadingMediaTags(value)).trimmingCharacters(in: .whitespacesAndNewlines)
            )
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        )
    }

    private static func removeLeadingMediaTags(_ value: String) -> String {
        var result = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let pattern = "^\\[(4K|8K|MV|Official MV|Official Music Video)\\]\\s*"
        while result.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil {
            result = result.replacingOccurrences(of: pattern, with: "", options: [.regularExpression, .caseInsensitive])
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return result
    }

    private static func removeMusicVideoSuffix(_ value: String) -> String {
        value.replacingOccurrences(
            of: "\\s*(Official\\s+)?(Music\\s+Video|MV)\\s*$",
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
        .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func trimWrappingQuotes(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "'\"‘’“”"))
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func deduplicateRepeatedTitle(_ value: String) -> String {
        let words = value.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard words.count >= 2, words.count.isMultiple(of: 2) else { return value }
        let midpoint = words.count / 2
        let left = words.prefix(midpoint).joined(separator: " ")
        let right = words.suffix(midpoint).joined(separator: " ")
        return left.caseInsensitiveCompare(right) == .orderedSame ? left : value
    }

    private static func artistNames(from segment: String) -> [String] {
        let cleaned = trimWrappingQuotes(
            segment.replacingOccurrences(
                of: "\\b(3D\\s+Live\\s+Cover|Live\\s+Cover|Cover|covered\\s+by)\\b|【\\s*COVER\\s*】|커버|\\b불러보았다\\b",
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )
            .replacingOccurrences(
                of: "\\s*(Official\\s+)?(Music\\s+Video|MV)\\s*$",
                with: "",
                options: [.regularExpression, .caseInsensitive]
            )
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        )
        guard !cleaned.isEmpty else { return [] }
        let delimiters = ["&", "＆", ",", "、", "/", "+", "×", " x ", " X ", " and "]
        let parts = delimiters.reduce([cleaned]) { values, delimiter in
            values.flatMap { $0.components(separatedBy: delimiter) }
        }
        return uniqueNames(
            parts
                .map { trimWrappingQuotes($0).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression) }
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        )
    }

    private static func subtitleDisplayText(
        for song: SongCatalogItem,
        parsedArtistNames: [String],
        catalogMembers: [HubMember]
    ) -> String {
        if parsedArtistNames.contains(where: { normalizedNameKey($0) == normalizedNameKey("스텔라이브") }) {
            return "스텔라이브"
        }
        let memberNames = songMemberNames(song)
        let groupDisplayName = generationGroupDisplayName(for: song, catalogMembers: catalogMembers)
        let baseNames = groupDisplayName.map { [$0] } ?? memberNames
        let blockedArtistKeys = Set(
            (memberNames + catalogMembers.flatMap { [$0.koreanName, $0.englishName, $0.unitName, $0.generationName] })
                .map(normalizedNameKey)
        )
        let externalNames = parsedArtistNames.filter { !isBlockedArtistName($0, blockedArtistKeys: blockedArtistKeys) }
        let names = uniqueNames(baseNames + externalNames).filter { !$0.isEmpty }
        if !names.isEmpty {
            return names.joined(separator: " · ")
        }
        if let memberName = song.memberName, !memberName.isEmpty {
            return memberName
        }
        return "스텔라이브"
    }

    private static func isBlockedArtistName(_ name: String, blockedArtistKeys: Set<String>) -> Bool {
        let nameKey = normalizedNameKey(name)
        return blockedArtistKeys.contains { blockedKey in
            !blockedKey.isEmpty && (nameKey == blockedKey || nameKey.contains(blockedKey) || blockedKey.contains(nameKey))
        }
    }

    private static func songMemberNames(_ song: SongCatalogItem) -> [String] {
        uniqueNames(
            song.members
                .map { $0.nameKo.isEmpty ? ($0.nameEn ?? "") : $0.nameKo }
                .filter { !$0.isEmpty }
        )
    }

    private static func generationGroupDisplayName(for song: SongCatalogItem, catalogMembers: [HubMember]) -> String? {
        let songMemberIds = Set(song.members.map(\.id))
        guard !songMemberIds.isEmpty, !catalogMembers.isEmpty else { return nil }
        let activeCatalogMembers = catalogMembers.filter {
            $0.catalogRole == .member && $0.activeStatus == .active
        }
        let songCatalogMembers = activeCatalogMembers.filter { songMemberIds.contains($0.id) }
        guard let generationId = songCatalogMembers.first?.generationId else { return nil }
        guard songCatalogMembers.allSatisfy({ $0.generationId == generationId }) else { return nil }
        let generationMembers = activeCatalogMembers.filter { $0.generationId == generationId }
        guard !generationMembers.isEmpty, songMemberIds == Set(generationMembers.map(\.id)) else { return nil }
        let representative = generationMembers[0]
        let unitName = representative.unitName.isEmpty ? nil : representative.unitName
        let generationName = representative.generationName.isEmpty ? generationId : representative.generationName
        if let unitName, unitName != generationName {
            return "\(unitName) (\(generationName))"
        }
        return generationName
    }

    private static func uniqueNames(_ names: [String]) -> [String] {
        names.reduce(into: [String]()) { result, name in
            if !result.contains(where: { normalizedNameKey($0) == normalizedNameKey(name) }) {
                result.append(name)
            }
        }
    }

    private static func normalizedNameKey(_ value: String) -> String {
        value.lowercased().replacingOccurrences(of: "\\s+", with: "", options: .regularExpression)
    }

    static func premiereStatusLabel(for song: SongCatalogItem) -> String? {
        switch song.premiere?.state {
        case "scheduled":
            if let scheduledStartAt = song.premiere?.scheduledStartAt {
                return "최초 공개 예정 · \(premiereDateTimeFormatter.string(from: scheduledStartAt))"
            }
            return "최초 공개 예정"
        case "live":
            return "최초 공개 중"
        default:
            return nil
        }
    }

    static func matchesGeneration(
        _ song: SongCatalogItem,
        selectedGenerationId: String,
        memberGenerationById: [String: String]
    ) -> Bool {
        if selectedGenerationId == "all" {
            return true
        }
        return song.members.contains { memberGenerationById[$0.id] == selectedGenerationId }
    }

    static func matchesQuery(_ song: SongCatalogItem, query: String, catalogMembers: [HubMember] = []) -> Bool {
        if query.isEmpty {
            return true
        }
        let display = displayText(for: song, catalogMembers: catalogMembers)
        return display.title.localizedCaseInsensitiveContains(query) ||
            display.subtitle.localizedCaseInsensitiveContains(query)
    }

    static func clampedVisibleLimit(_ visibleLimit: Int, totalItems: Int, batchSize: Int = Self.pageSize) -> Int {
        guard totalItems > 0 else { return 0 }
        return min(max(visibleLimit, batchSize), totalItems)
    }

    static func displayedItems(_ songs: [SongCatalogItem], visibleLimit: Int, batchSize: Int = Self.pageSize) -> [SongCatalogItem] {
        Array(songs.prefix(clampedVisibleLimit(visibleLimit, totalItems: songs.count, batchSize: batchSize)))
    }

    static func displayedCount(visibleLimit: Int, totalItems: Int, batchSize: Int = Self.pageSize) -> Int {
        clampedVisibleLimit(visibleLimit, totalItems: totalItems, batchSize: batchSize)
    }

    static func remainingCount(visibleLimit: Int, totalItems: Int, batchSize: Int = Self.pageSize) -> Int {
        max(totalItems - displayedCount(visibleLimit: visibleLimit, totalItems: totalItems, batchSize: batchSize), 0)
    }

    static func canLoadMore(visibleLimit: Int, totalItems: Int, batchSize: Int = Self.pageSize) -> Bool {
        remainingCount(visibleLimit: visibleLimit, totalItems: totalItems, batchSize: batchSize) > 0
    }

    static func nextVisibleLimit(visibleLimit: Int, totalItems: Int, batchSize: Int = Self.pageSize) -> Int {
        min(displayedCount(visibleLimit: visibleLimit, totalItems: totalItems, batchSize: batchSize) + batchSize, totalItems)
    }

    static func progressText(displayedCount: Int, totalFilteredCount: Int, authoritative: Bool) -> String {
        let totalText = NumberFormatter.localizedString(from: NSNumber(value: totalFilteredCount), number: .decimal)
        if authoritative && displayedCount == totalFilteredCount { return "\(displayedCount) / \(totalText)곡 모두 표시" }
        if authoritative { return "\(displayedCount) / \(totalText)곡 표시" }
        return "\(displayedCount) / \(totalText)곡 이상 표시"
    }

    static func loadMoreText(remainingCount: Int, batchSize: Int = Self.pageSize) -> String {
        "\(min(remainingCount, batchSize))곡 더 보기"
    }

    static func canRestoreScroll(_ position: SongScrollPosition?, queryKey: SongListQueryKey) -> Bool {
        position?.queryKey == queryKey
    }

    static func restoredVisibleLimit(_ position: SongScrollPosition?, queryKey: SongListQueryKey, totalItems: Int) -> Int {
        let requested = canRestoreScroll(position, queryKey: queryKey)
            ? position?.visibleLimitAtCapture ?? pageSize
            : pageSize
        return clampedVisibleLimit(requested, totalItems: totalItems)
    }

    static func shouldShowScrollToTop(
        absoluteOffset: CGFloat,
        isLoading: Bool,
        isEmpty: Bool,
        isRestoring: Bool,
        threshold: CGFloat = 240
    ) -> Bool {
        !isLoading && !isEmpty && !isRestoring && absoluteOffset > threshold
    }

    static func summaryCounts(for allSongs: [SongCatalogItem], filteredSongs: [SongCatalogItem]) -> SongFacetSummary {
        SongFacetSummary(
            total: allSongs.count,
            original: allSongs.filter { $0.type == .original }.count,
            cover: allSongs.filter { $0.type == .cover }.count
        )
    }

    static func sortedSongs(_ songs: [SongCatalogItem], sortId: String) -> [SongCatalogItem] {
        songs.sorted { left, right in
            switch sortId {
            case "publishedAt_asc":
                return comparePublishedAt(left, right, newestFirst: false)
            case "title_asc":
                return compareTitle(left, right)
            case "member_asc":
                let memberOrder = memberDisplayText(left).localizedStandardCompare(memberDisplayText(right))
                if memberOrder != .orderedSame {
                    return memberOrder == .orderedAscending
                }
                return compareTitle(left, right)
            default:
                return comparePublishedAt(left, right, newestFirst: true)
            }
        }
    }

    private static func comparePublishedAt(_ left: SongCatalogItem, _ right: SongCatalogItem, newestFirst: Bool) -> Bool {
        switch (left.publishedAt, right.publishedAt) {
        case let (leftDate?, rightDate?) where leftDate != rightDate:
            return newestFirst ? leftDate > rightDate : leftDate < rightDate
        case (nil, _?):
            return false
        case (_?, nil):
            return true
        default:
            return compareTitle(left, right)
        }
    }

    private static func compareTitle(_ left: SongCatalogItem, _ right: SongCatalogItem) -> Bool {
        let titleOrder = left.title.localizedStandardCompare(right.title)
        if titleOrder != .orderedSame {
            return titleOrder == .orderedAscending
        }
        return left.id < right.id
    }

    static func recentSongs(_ songs: [SongCatalogItem], limit: Int = 5) -> [SongCatalogItem] {
        Array(sortedSongs(songs, sortId: "publishedAt_desc").prefix(max(0, limit)))
    }

    static func thumbnailUrlCandidates(for song: SongCatalogItem) -> [URL] {
        var urls: [URL] = []
        if let raw = song.thumbnailUrl,
           let url = URL(string: raw),
           url.scheme == "https" {
            urls.append(url)
        }
        let videoId = song.youtubeVideoId.trimmingCharacters(in: .whitespacesAndNewlines)
        if !videoId.isEmpty {
            for name in ["hqdefault", "mqdefault", "default"] {
                if let url = URL(string: "https://i.ytimg.com/vi/\(videoId)/\(name).jpg") {
                    urls.append(url)
                }
            }
        }
        return urls.reduce(into: [URL]()) { result, url in
            if !result.contains(url) {
                result.append(url)
            }
        }
    }
}

enum HubCalendarPolicy {
    static let staleWidgetText = "최근 동기화 필요"
    static let emptyWidgetText = "예정된 일정 없음"

    private static let statusRank: [HubEventStatus: Int] = [
        .closingSoon: 0,
        .open: 1,
        .upcoming: 2,
        .announced: 3,
        .cancelled: 4,
        .ended: 5
    ]

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy.MM.dd"
        return formatter
    }()

    static func areInDisplayOrder(_ lhs: HubCalendarEntry, _ rhs: HubCalendarEntry) -> Bool {
        let lhsRank = statusRank[lhs.status] ?? Int.max
        let rhsRank = statusRank[rhs.status] ?? Int.max
        if lhsRank != rhsRank {
            return lhsRank < rhsRank
        }

        let lhsDate = lhs.endsAt ?? lhs.startsAt ?? .distantFuture
        let rhsDate = rhs.endsAt ?? rhs.startsAt ?? .distantFuture
        if lhsDate != rhsDate {
            return lhsDate < rhsDate
        }

        return lhs.title.localizedCompare(rhs.title) == .orderedAscending
    }

    static func statusLabel(_ status: HubEventStatus) -> String {
        switch status {
        case .announced:
            return "공개"
        case .upcoming:
            return "예정"
        case .open:
            return "진행중"
        case .closingSoon:
            return "마감 임박"
        case .ended:
            return "종료"
        case .cancelled:
            return "취소"
        }
    }

    static func entryLabel(_ entry: HubCalendarEntry) -> String {
        entry.specialDayLabel ?? statusLabel(entry.status)
    }

    static func dateHeaderText(for date: Date, now: Date = Date()) -> String {
        let calendar = Calendar(identifier: .gregorian)
        if calendar.isDate(date, inSameDayAs: now) {
            return "오늘"
        }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now),
           calendar.isDate(date, inSameDayAs: tomorrow) {
            return "내일"
        }
        return dateFormatter.string(from: date)
    }

    static func isWidgetSnapshotStale(_ snapshot: HubCalendarWidgetSnapshot, now: Date) -> Bool {
        now >= snapshot.staleAfter
    }
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
    var isLive: Bool
    var notificationEnabled: Bool
    var realtimeEnabled: Bool
    var liveStartedAt: Date? = nil
    var liveTitle: String? = nil
    var liveCategory: String? = nil
    var liveViewerCount: Int? = nil
    var channelImageURL: URL? = nil
    var profileImageURL: URL? = nil
    var livePlatformURL: URL? = nil
    var liveLastCheckedAt: Date? = nil

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
        isLive: Bool,
        notificationEnabled: Bool,
        realtimeEnabled: Bool,
        liveStartedAt: Date? = nil,
        liveTitle: String? = nil,
        liveCategory: String? = nil,
        liveViewerCount: Int? = nil,
        channelImageURL: URL? = nil,
        profileImageURL: URL? = nil,
        livePlatformURL: URL? = nil,
        liveLastCheckedAt: Date? = nil
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
        self.isLive = isLive
        self.notificationEnabled = notificationEnabled
        self.realtimeEnabled = realtimeEnabled
        self.liveStartedAt = liveStartedAt
        self.liveTitle = liveTitle
        self.liveCategory = liveCategory
        self.liveViewerCount = liveViewerCount
        self.channelImageURL = channelImageURL
        self.profileImageURL = profileImageURL
        self.livePlatformURL = livePlatformURL
        self.liveLastCheckedAt = liveLastCheckedAt
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

    static func elapsedClockText(startedAt: Date?, now: Date = Date()) -> String? {
        guard let startedAt, startedAt <= now else { return nil }
        let elapsedSeconds = max(0, Int(now.timeIntervalSince(startedAt)))
        let hours = elapsedSeconds / 3600
        let minutes = (elapsedSeconds % 3600) / 60
        let seconds = elapsedSeconds % 60
        return String(format: "%d:%02d:%02d", hours, minutes, seconds)
    }

    static func viewerCountText(_ viewerCount: Int?) -> String? {
        guard let viewerCount, viewerCount >= 0 else { return nil }
        return NumberFormatter.localizedString(from: NSNumber(value: viewerCount), number: .decimal)
    }

    static func liveTitleText(_ title: String?) -> String {
        let trimmed = title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "방송 제목 확인 중" : trimmed
    }

    static func liveCategoryText(_ category: String?) -> String? {
        let trimmed = category?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }
}

struct GenerationFilter: Identifiable, Hashable {
    let id: String
    let displayName: String
    let notificationDefaultEnabled: Bool
}

struct HistoryFilterOption: Identifiable, Hashable {
    let id: String
    let displayName: String
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
        "최대한 실시간으로 알림 받기는 알림을 빠르게 보내도록 시도하는 기능입니다. 플랫폼, 운영체제 또는 네트워크 상태에 따라 늦어질 수 있습니다.",
        "배터리와 데이터 사용량이 늘어날 수 있습니다.",
        "사용자가 꺼둔 알림과 방해 금지 시간, 차단 키워드, 알림 빈도 제한은 그대로 적용됩니다."
    ]

    var globalEnabled = true
    var serviceAnnouncementsEnabled = true
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
        .hubEvent: true,
        .naverCafe: false
    ]
    var eventTypeEnabled: [NotificationEventType: Bool] = [
        .cafePost: false,
        .chzzkLiveStarted: true,
        .chzzkLiveEnded: true,
        .chzzkChat: false,
        .chzzkSubscription: true,
        .youtubeUpload: true,
        .youtubeLiveScheduled: false,
        .youtubeLiveStarted: false,
        .youtubeLiveEnded: false,
        .officialYoutubeUpload: true,
        .eventAnnounced: true,
        .eventSalesOpen: true,
        .eventDeadlineSoon: true,
        .eventMilestoneDue: true,
        .eventUpdated: false,
        .eventCancelled: true
    ]
    var combinationPreferences = [
        CombinationPreference(id: "generation_platform", scope: .generationPlatform, label: "분류별 플랫폼 설정", enabled: true),
        CombinationPreference(id: "generation_event_type", scope: .generationEventType, label: "분류별 알림 종류 설정", enabled: true),
        CombinationPreference(id: "member_platform", scope: .memberPlatform, label: "개별 대상의 플랫폼 설정", enabled: true),
        CombinationPreference(id: "member_event_type", scope: .memberEventType, label: "개별 대상의 알림 종류 설정", enabled: true)
    ]
    var quietHours = QuietHoursState()
    var keywordFilters = KeywordFilterState()
    var rateLimit = RateLimitState()

    var canEnableChzzkChatPush: Bool {
        chzzkChatEnabled && keywordFilters.hasExplicitFilters
    }
}
