import Foundation

private let builtInHubEventFilters: Set<String> = ["all", "goods", "ticketing", "offline", "closing"]

struct MusicPageCollector {
    static let pageLimit = 100
    static let maxPages = 10
    static let maxItems = 1000

    static func collect(fetch: (String?, Int) async throws -> MusicListResponse) async throws -> [SongCatalogItem] {
        var cursor: String?
        var output: [SongCatalogItem] = []
        var seen = Set<String>()
        for _ in 0..<maxPages {
            let page = try await fetch(cursor, pageLimit)
            for item in page.items {
                let key = item.youtubeVideoId.isEmpty ? item.id : item.youtubeVideoId
                if seen.insert(key).inserted {
                    output.append(item)
                }
            }
            guard let next = page.nextCursor, !next.isEmpty, output.count < maxItems else {
                return Array(output.prefix(maxItems))
            }
            cursor = next
        }
        return Array(output.prefix(maxItems))
    }
}

@MainActor
final class ServerHubStore: ObservableObject {
    private let api: HubAPIClient
    private let deviceIDStore: DeviceIDStore
    private let fallback: MockHubStore
    @Published private(set) var serverHubEvents: [HubEvent] = []
    @Published private(set) var serverCalendarDays: [HubCalendarDay] = []
    @Published private(set) var serverSongs: [SongCatalogItem] = []
    @Published private(set) var recentCoverSongs: [SongCatalogItem] = []
    @Published private(set) var serverSongFacets: SongFacetsResponse?
    @Published private(set) var hubEventDetailCache: [String: HubEvent] = [:]

    init(
        api: HubAPIClient,
        deviceIDStore: DeviceIDStore = DeviceIDStore(),
        fallback: MockHubStore
    ) {
        self.api = api
        self.deviceIDStore = deviceIDStore
        self.fallback = fallback
    }

    func bootstrap() async -> MockHubStore {
        do {
            let response = try await api.bootstrap(deviceId: deviceIDStore.loadDeviceID())
    if deviceIDStore.loadDeviceID() == nil {
      try? await registerDevice()
    }
            fallback.applyBootstrap(response)
            try? HubCalendarWidgetStore.saveToSharedContainer(fallback.calendarWidgetSnapshot())
            return fallback
        } catch {
            fallback.markBootstrapFailed()
            return fallback
        }
    }

    private func registerDevice() async throws {
        let response = try await api.registerDevice(
            RegisterDeviceRequest(
                deviceId: deviceIDStore.loadDeviceID(),
                platform: "ios",
                appVersion: nil,
                locale: Locale.current.identifier,
                timezone: TimeZone.current.identifier,
                installationId: nil
            )
        )
        deviceIDStore.saveDeviceID(response.deviceId)
    }

    func refreshHubEvents(filter: String = "all", from: Date? = nil, to: Date? = nil) async {
        let formatter = Self.calendarDateFormatter
        do {
            let generationId = builtInHubEventFilters.contains(filter) ? nil : filter
            let response = try await api.hubEvents(
                generationId: generationId,
                from: from.map { formatter.string(from: $0) },
                to: to.map { formatter.string(from: $0) },
                limit: 100
            )
            let events = response.items.map { $0.toHubEvent() }
            serverHubEvents = events
            for event in events {
                hubEventDetailCache[event.id] = event
            }
        } catch {
            if serverHubEvents.isEmpty {
                serverHubEvents = fallback.hubEvents(for: filter)
            }
        }
    }

    func refreshCalendar(from: Date, to: Date, timezone: TimeZone = .current) async {
        let formatter = Self.calendarDateFormatter
        do {
            let response = try await api.hubEventsCalendar(
                from: formatter.string(from: from),
                to: formatter.string(from: to),
                timezone: timezone.identifier
            )
            serverCalendarDays = response.days
        } catch {
            if serverCalendarDays.isEmpty {
                serverCalendarDays = fallback.calendarDays(for: "all")
            }
        }
    }

    func refreshSongs(
        generationId: String? = nil,
        memberId: String? = nil,
        type: String? = nil,
        query: String? = nil,
        cursor: String? = nil
    ) async {
        do {
            let normalizedType = type == "all" ? nil : type
            let items = try await MusicPageCollector.collect { pageCursor, pageLimit in
                if let memberId, !memberId.isEmpty, memberId != "all" {
                    return try await api.memberMusic(memberId: memberId, type: normalizedType, cursor: pageCursor, limit: pageLimit)
                }
                return try await api.music(type: normalizedType, cursor: pageCursor, limit: pageLimit)
            }
            serverSongs = items
        } catch {
            if serverSongs.isEmpty {
                serverSongs = fallback.songs(generationId: generationId, memberId: memberId, type: type, query: query).items
            }
        }
    }

    func refreshRecentCoverSongs(limit: Int = 5) async {
        do {
            let response = try await api.music(type: "cover", cursor: nil, limit: limit)
            recentCoverSongs = IOSSongPagePolicy.recentCoverSongs(response.items, limit: limit)
        } catch {
            recentCoverSongs = IOSSongPagePolicy.recentCoverSongs(
                serverSongs.isEmpty ? fallback.songs(type: "cover").items : serverSongs,
                limit: limit
            )
        }
    }

    func refreshSongFacets(
        generationId: String? = nil,
        memberId: String? = nil,
        type: String? = nil,
        query: String? = nil
    ) async {
        do {
            serverSongFacets = try await api.songFacets(generationId: generationId, memberId: memberId, type: type, q: query)
        } catch {
            if serverSongFacets == nil {
                serverSongFacets = fallback.songFacets(generationId: generationId, memberId: memberId, type: type, query: query)
            }
        }
    }

    func loadHubEventDetail(id: String) async -> HubEvent? {
        do {
            let event = try await api.hubEvent(id: id).toHubEvent()
            hubEventDetailCache[id] = event
            return event
        } catch HubAPIError.httpStatus(404) {
            return nil
        } catch {
            return hubEventDetailCache[id]
        }
    }

    func hubEvents(for filter: String) -> [HubEvent] {
        let events = serverHubEvents.isEmpty ? fallback.hubEvents(for: filter) : filteredServerHubEvents(for: filter)
        return events
    }

    func calendarDays(for filter: String) -> [HubCalendarDay] {
        let days = serverCalendarDays.isEmpty ? fallback.calendarDays(for: filter) : serverCalendarDays
        guard filter != "all" else { return days }
        let allowedEventIds = Set(hubEvents(for: filter).map(\.id))
        return days.compactMap { day in
            let entries = day.entries.filter { entry in
                entry.entryKind != .hubEvent || allowedEventIds.contains(entry.eventId)
            }
            return entries.isEmpty ? nil : HubCalendarDay(date: day.date, entries: entries)
        }
    }

    func cachedHubEvent(id: String) -> HubEvent? {
        hubEventDetailCache[id] ?? serverHubEvents.first(where: { $0.id == id })
    }

    func songs(generationId: String? = nil, memberId: String? = nil, type: String? = nil, query: String? = nil) -> SongListResponse {
        let source = serverSongs.isEmpty ? fallback.songs(generationId: generationId, memberId: memberId, type: type, query: query).items : serverSongs
        let memberGenerationById = Dictionary(uniqueKeysWithValues: fallback.members.map { ($0.id, $0.generationId) })
        let filtered = source.filter { song in
            let generationMatches = generationId == nil || generationId == "all" || IOSSongPagePolicy.matchesGeneration(song, selectedGenerationId: generationId ?? "all", memberGenerationById: memberGenerationById)
            let memberMatches = IOSSongPagePolicy.matchesMember(song, selectedMemberId: memberId ?? "all")
            let typeMatches = type == nil || type == "all" || song.type.rawValue == type
            let queryText = query ?? ""
            let queryMatches = queryText.isEmpty || song.title.localizedCaseInsensitiveContains(queryText) || IOSSongPagePolicy.memberDisplayText(song).localizedCaseInsensitiveContains(queryText)
            return generationMatches && memberMatches && typeMatches && queryMatches
        }
        return SongListResponse(items: filtered, nextCursor: nil)
    }

    func songFacets(generationId: String? = nil, memberId: String? = nil, type: String? = nil, query: String? = nil) -> SongFacetsResponse {
        serverSongFacets ?? fallback.songFacets(generationId: generationId, memberId: memberId, type: type, query: query)
    }

    private func filteredServerHubEvents(for filter: String) -> [HubEvent] {
        switch filter {
        case "all":
            return serverHubEvents
        case "goods":
            return serverHubEvents.filter { $0.category == .onlineGoods || $0.category == .onlineCollab }
        case "ticketing":
            return serverHubEvents.filter { $0.category == .ticketing }
        case "offline":
            return serverHubEvents.filter { $0.participationMode.isOffline }
        case "closing":
            return serverHubEvents.filter { $0.status == .closingSoon }
        default:
            return serverHubEvents.filter { $0.generationId == filter }
        }
    }

    private static let calendarDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

private extension HubEventResponse {
    func toHubEvent() -> HubEvent {
        HubEvent(
            id: id,
            category: category,
            participationMode: participationMode,
            status: status,
            title: title,
            summary: summary,
            memberId: memberId,
            generationId: generationId,
            sourceUrl: sourceUrl,
            sourceLabel: sourceLabel,
            sourceType: sourceType,
            announcedAt: announcedAt.flatMap(Self.parseDate),
            startsAt: startsAt.flatMap(Self.parseDate),
            endsAt: endsAt.flatMap(Self.parseDate),
            purchaseUrl: purchaseUrl,
            ticketUrl: ticketUrl,
            venueName: venueName,
            venueAddress: venueAddress,
            image: image,
            notificationEligible: notificationEligible,
            updatedAt: Self.parseDate(updatedAt) ?? Date(timeIntervalSince1970: 0)
        )
    }

    static func parseDate(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) {
            return date
        }
        return ISO8601DateFormatter().date(from: value)
    }
}
