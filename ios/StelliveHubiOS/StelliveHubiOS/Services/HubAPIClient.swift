import Foundation

struct MobileConfigResponse: Codable, Equatable {
    let unofficialProject: Bool
    let catalogVersion: String
    let officialYoutubeLiveExcluded: Bool
    let hubCalendarEnabled: Bool
    let foregroundRealtimeEnabled: Bool?
}

struct BootstrapResponse: Codable, Equatable {
    let config: MobileConfigResponse
    let catalog: BootstrapCatalogResponse?
    let generations: [GenerationResponse]
    let members: [MemberResponse]
    let preferences: [PreferenceResponse]
    let liveStatus: [LiveStatusResponse]
    let hubEventsSummary: HubEventsSummaryResponse?
    let hubCalendarWidgetSnapshot: HubCalendarWidgetSnapshot?
    let announcementsSummary: AnnouncementsSummaryResponse?
    let serverTime: String?

    var effectiveCatalog: BootstrapCatalogResponse {
        catalog ?? BootstrapCatalogResponse(generations: generations, members: members)
    }

    private enum CodingKeys: String, CodingKey {
        case config
        case catalog
        case generations
        case members
        case preferences
        case liveStatus
        case hubEventsSummary
        case hubCalendarWidgetSnapshot
        case announcementsSummary
        case serverTime
    }

    init(
        config: MobileConfigResponse,
        catalog: BootstrapCatalogResponse? = nil,
        generations: [GenerationResponse] = [],
        members: [MemberResponse] = [],
        preferences: [PreferenceResponse] = [],
        liveStatus: [LiveStatusResponse] = [],
        hubEventsSummary: HubEventsSummaryResponse? = nil,
        hubCalendarWidgetSnapshot: HubCalendarWidgetSnapshot? = nil,
        announcementsSummary: AnnouncementsSummaryResponse? = nil,
        serverTime: String? = nil
    ) {
        self.config = config
        self.catalog = catalog
        self.generations = generations
        self.members = members
        self.preferences = preferences
        self.liveStatus = liveStatus
        self.hubEventsSummary = hubEventsSummary
        self.hubCalendarWidgetSnapshot = hubCalendarWidgetSnapshot
        self.announcementsSummary = announcementsSummary
        self.serverTime = serverTime
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.config = try container.decode(MobileConfigResponse.self, forKey: .config)
        self.catalog = try container.decodeIfPresent(BootstrapCatalogResponse.self, forKey: .catalog)
        self.generations = try container.decodeIfPresent([GenerationResponse].self, forKey: .generations) ?? []
        self.members = try container.decodeIfPresent([MemberResponse].self, forKey: .members) ?? []
        self.preferences = try container.decodeIfPresent([PreferenceResponse].self, forKey: .preferences) ?? []
        self.liveStatus = try container.decodeIfPresent([LiveStatusResponse].self, forKey: .liveStatus) ?? []
        self.hubEventsSummary = try container.decodeIfPresent(HubEventsSummaryResponse.self, forKey: .hubEventsSummary)
        self.hubCalendarWidgetSnapshot = try container.decodeIfPresent(HubCalendarWidgetSnapshot.self, forKey: .hubCalendarWidgetSnapshot)
        self.announcementsSummary = try container.decodeIfPresent(AnnouncementsSummaryResponse.self, forKey: .announcementsSummary)
        self.serverTime = try container.decodeIfPresent(String.self, forKey: .serverTime)
    }
}

struct BootstrapCatalogResponse: Codable, Equatable {
    let generations: [GenerationResponse]
    let members: [MemberResponse]
}

struct GenerationResponse: Codable, Equatable {
    let id: String
    let displayName: String
}

struct MemberResponse: Codable, Equatable {
    let id: String
    let profileImageUrl: String?

    init(id: String, profileImageUrl: String? = nil) {
        self.id = id
        self.profileImageUrl = profileImageUrl
    }
}

struct PreferenceResponse: Codable, Equatable {
    let deviceId: String?
    let scope: String
    let enabled: Bool
    let explicitOverride: Bool
    let tapAction: String
    let deliveryMode: String
    let serviceAnnouncementsEnabled: Bool?
    let updatedAt: String
}

struct LiveStatusResponse: Codable, Equatable {
    let memberId: String
    let generationId: String
    let platform: String?
    let isLive: Bool
    let title: String?
    let liveCategory: String?
    let viewerCount: Int?
    let startedAt: String?
    let channelImageUrl: String?
    let platformUrl: String?
    let lastCheckedAt: String
    let sourceVerificationState: String
}

struct HubEventsSummaryResponse: Codable, Equatable {
    let openCount: Int
    let upcomingCount: Int
    let closingSoonCount: Int
}

struct HubCalendarResponse: Codable, Equatable {
    let timezone: String
    let from: String
    let to: String
    let days: [HubCalendarDay]
}

struct HubEventsListResponse: Codable, Equatable {
    let items: [HubEventResponse]
    let nextCursor: String?
}

struct HubEventResponse: Codable, Equatable {
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
    let scheduleMode: HubEventScheduleMode?
    let scheduleItems: [HubEventScheduleItemResponse]?
    let links: [HubEventLinkResponse]?
    let announcedAt: String?
    let startsAt: String?
    let endsAt: String?
    let purchaseUrl: String?
    let ticketUrl: String?
    let venueName: String?
    let venueAddress: String?
    let image: HubEventImage?
    let notificationEligible: Bool
    let updatedAt: String
}

struct HubEventScheduleItemResponse: Codable, Equatable {
    let id: String
    let kind: HubEventScheduleKind
    let title: String?
    let label: String
    let description: String?
    let startsAt: String
    let endsAt: String?
    let timePrecision: HubEventTimePrecision
    let timezone: String
    let actionUrl: String?
    let sourceUrl: String?
    let sourceLabel: String?
    let links: [HubEventLinkResponse]?
    let notificationEligible: Bool
    let isPrimary: Bool
    let sortOrder: Int
    let cancelledAt: String?
    let createdAt: String?
}

struct HubEventLinkResponse: Codable, Equatable {
    let id: String?
    let kind: HubEventLinkKind
    let label: String?
    let url: String
    let sortOrder: Int
    let createdAt: String?
    let updatedAt: String?
}

struct RegisterDeviceRequest: Codable, Equatable {
    let deviceId: String?
    let platform: String
    let appVersion: String?
    let locale: String?
    let timezone: String?
    let installationId: String?
}

struct RegisterDeviceResponse: Codable, Equatable {
    let deviceId: String
    let registered: Bool
    let serverTime: String
}

struct UpdateDeviceTokenRequest: Codable, Equatable {
    let deviceId: String
    let platform: String
    let provider: String
    let token: String
    let appVersion: String?
    let locale: String?
    let timezone: String?
}

struct UpdateDeviceTokenResponse: Codable, Equatable {
    let updated: Bool
    let tokenStatus: String
    let serverTime: String
}

struct PreferencesResponse: Codable, Equatable {
    let deviceId: String
    let preferences: [PreferenceResponse]
    let updatedAt: String
    let conflict: String?
}

struct UpdatePreferencesRequest: Codable, Equatable {
    let deviceId: String
    let preferences: [PreferenceResponse]
    let clientUpdatedAt: String
}

struct UpdatePreferencesResponse: Codable, Equatable {
    let deviceId: String
    let preferences: [PreferenceResponse]
    let updatedAt: String
    let conflict: String?
}

enum HubAPIError: Error, Equatable {
    case invalidResponse
    case httpStatus(Int)
}

final class HubAPIClient {
    private let baseURL: URL
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private static let iso8601WithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        self.encoder = JSONEncoder()
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            if let date = Self.iso8601WithFractionalSeconds.date(from: value) ?? Self.iso8601.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO8601 date: \(value)")
        }
    }

    func bootstrap(deviceId: String?) async throws -> BootstrapResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/bootstrap"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "deviceId", value: deviceId),
            URLQueryItem(name: "platform", value: "ios"),
            URLQueryItem(name: "appVersion", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String),
        ].filter { $0.value != nil }
        return try await send(URLRequest(url: components.url!), responseType: BootstrapResponse.self)
    }

    func hubEventsCalendar(from: String, to: String, timezone: String) async throws -> HubCalendarResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/hub-events/calendar"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "from", value: from),
            URLQueryItem(name: "to", value: to),
            URLQueryItem(name: "timezone", value: timezone)
        ]
        return try await send(URLRequest(url: components.url!), responseType: HubCalendarResponse.self)
    }

    func hubEvents(
        category: String? = nil,
        participationMode: String? = nil,
        status: String? = nil,
        generationId: String? = nil,
        memberId: String? = nil,
        from: String? = nil,
        to: String? = nil,
        limit: Int? = nil
    ) async throws -> HubEventsListResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/hub-events"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "category", value: category),
            URLQueryItem(name: "participationMode", value: participationMode),
            URLQueryItem(name: "status", value: status),
            URLQueryItem(name: "generationId", value: generationId),
            URLQueryItem(name: "memberId", value: memberId),
            URLQueryItem(name: "from", value: from),
            URLQueryItem(name: "to", value: to),
            URLQueryItem(name: "limit", value: limit.map(String.init))
        ].filter { $0.value != nil }
        return try await send(URLRequest(url: components.url!), responseType: HubEventsListResponse.self)
    }

    func hubEvent(id: String) async throws -> HubEventResponse {
        try await send(URLRequest(url: baseURL.appendingPathComponent("v1/hub-events/\(id)")), responseType: HubEventResponse.self)
    }

    func announcements(cursor: String? = nil, limit: Int = 20) async throws -> ServiceAnnouncementListResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/announcements"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "platform", value: "ios"),
            URLQueryItem(name: "appVersion", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String),
            URLQueryItem(name: "cursor", value: cursor),
            URLQueryItem(name: "limit", value: String(limit))
        ].filter { $0.value != nil }
        return try await send(URLRequest(url: components.url!), responseType: ServiceAnnouncementListResponse.self)
    }

    func announcement(id: String) async throws -> ServiceAnnouncement {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/announcements/\(id)"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "platform", value: "ios"),
            URLQueryItem(name: "appVersion", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String)
        ]
        return try await send(URLRequest(url: components.url!), responseType: ServiceAnnouncement.self)
    }

    func songs(
        generationId: String? = nil,
        memberId: String? = nil,
        type: String? = nil,
        q: String? = nil,
        cursor: String? = nil,
        limit: Int? = nil
    ) async throws -> SongListResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/songs"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "generationId", value: generationId),
            URLQueryItem(name: "memberId", value: memberId),
            URLQueryItem(name: "type", value: type),
            URLQueryItem(name: "q", value: q),
            URLQueryItem(name: "cursor", value: cursor),
            URLQueryItem(name: "limit", value: limit.map(String.init))
        ].filter { $0.value != nil }
        return try await send(URLRequest(url: components.url!), responseType: SongListResponse.self)
    }

    func songFacets(
        generationId: String? = nil,
        memberId: String? = nil,
        type: String? = nil,
        q: String? = nil
    ) async throws -> SongFacetsResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/songs/facets"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "generationId", value: generationId),
            URLQueryItem(name: "memberId", value: memberId),
            URLQueryItem(name: "type", value: type),
            URLQueryItem(name: "q", value: q)
        ].filter { $0.value != nil }
        return try await send(URLRequest(url: components.url!), responseType: SongFacetsResponse.self)
    }

    func music(
        type: String? = nil,
        cursor: String? = nil,
        limit: Int? = nil,
        sort: String? = "publishedAt_desc"
    ) async throws -> MusicListResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/music"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "type", value: type),
            URLQueryItem(name: "cursor", value: cursor),
            URLQueryItem(name: "limit", value: limit.map(String.init)),
            URLQueryItem(name: "sort", value: sort)
        ].filter { $0.value != nil }
        return try await send(URLRequest(url: components.url!), responseType: MusicListResponse.self)
    }

    func musicDetail(id: String) async throws -> SongCatalogItem {
        let url = baseURL.appendingPathComponent("v1/music/\(id)")
        return try await send(URLRequest(url: url), responseType: SongCatalogItem.self)
    }

    func memberMusic(
        memberId: String,
        type: String? = nil,
        cursor: String? = nil,
        limit: Int? = nil,
        sort: String? = "publishedAt_desc"
    ) async throws -> MusicListResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/members/\(memberId)/music"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "type", value: type),
            URLQueryItem(name: "cursor", value: cursor),
            URLQueryItem(name: "limit", value: limit.map(String.init)),
            URLQueryItem(name: "sort", value: sort)
        ].filter { $0.value != nil }
        return try await send(URLRequest(url: components.url!), responseType: MusicListResponse.self)
    }

    func registerDevice(_ request: RegisterDeviceRequest) async throws -> RegisterDeviceResponse {
        try await sendJSON(path: "v1/devices/register", method: "POST", body: request, responseType: RegisterDeviceResponse.self)
    }

    func updateDeviceToken(_ request: UpdateDeviceTokenRequest) async throws -> UpdateDeviceTokenResponse {
        try await sendJSON(path: "v1/devices/token", method: "PUT", body: request, responseType: UpdateDeviceTokenResponse.self)
    }

    func preferences(deviceId: String) async throws -> PreferencesResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/preferences"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "deviceId", value: deviceId)]
        return try await send(URLRequest(url: components.url!), responseType: PreferencesResponse.self)
    }

    func updatePreferences(_ request: UpdatePreferencesRequest) async throws -> UpdatePreferencesResponse {
        try await sendJSON(path: "v1/preferences", method: "PUT", body: request, responseType: UpdatePreferencesResponse.self)
    }

    private func sendJSON<RequestBody: Encodable, ResponseBody: Decodable>(
        path: String,
        method: String,
        body: RequestBody,
        responseType: ResponseBody.Type
    ) async throws -> ResponseBody {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try encoder.encode(body)
        return try await send(request, responseType: responseType)
    }

    private func send<ResponseBody: Decodable>(
        _ request: URLRequest,
        responseType: ResponseBody.Type
    ) async throws -> ResponseBody {
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw HubAPIError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw HubAPIError.httpStatus(httpResponse.statusCode)
        }
        return try decoder.decode(responseType, from: data)
    }
}
