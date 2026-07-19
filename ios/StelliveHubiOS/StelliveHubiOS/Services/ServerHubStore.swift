import Foundation

private let builtInHubEventFilters: Set<String> = ["all", "goods", "ticketing", "offline", "closing"]

struct MusicPageCollector {
    struct Result { let items: [SongCatalogItem]; let serverTime: String?; let complete: Bool }
    static let pageLimit = 100
    static let maxPages = 10
    static let maxItems = 1000

    static func collect(fetch: (String?, Int) async throws -> MusicListResponse) async throws -> Result {
        var cursor: String?
        var output: [SongCatalogItem] = []
        var seen = Set<String>()
        var serverTime: String?
        for _ in 0..<maxPages {
            let page = try await fetch(cursor, pageLimit)
            if serverTime == nil { serverTime = page.serverTime }
            for item in page.items {
                let key = item.youtubeVideoId.isEmpty ? item.id : item.youtubeVideoId
                if seen.insert(key).inserted {
                    output.append(item)
                }
            }
            guard let next = page.nextCursor, !next.isEmpty, output.count < maxItems else {
                return Result(
                    items: Array(output.prefix(maxItems)),
                    serverTime: serverTime,
                    complete: page.nextCursor?.isEmpty != false
                )
            }
            cursor = next
        }
        return Result(items: Array(output.prefix(maxItems)), serverTime: serverTime, complete: false)
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
    @Published private(set) var songCatalogServerTime: String?
    @Published private(set) var hasAuthoritativeSongCatalog = false
    @Published private(set) var recentSongs: [SongCatalogItem] = []
    @Published private(set) var serverSongFacets: SongFacetsResponse?
    @Published private(set) var hubEventDetailCache: [String: HubEvent] = [:]
    @Published private(set) var songDetailCache: [String: SongCatalogItem] = [:]
    @Published private(set) var isRefreshingHubEvents = false
    @Published private(set) var isRefreshingCalendar = false
    @Published private(set) var isRefreshingSongs = false
    @Published private(set) var isRefreshingRecentSongs = false
    @Published private(set) var loadingHubEventDetailIds: Set<String> = []
    @Published private(set) var loadingSongDetailIds: Set<String> = []
    @Published private(set) var announcementsSummary: AnnouncementsSummaryResponse?
    @Published private(set) var serviceAnnouncements: [ServiceAnnouncement] = []
    @Published private(set) var announcementNextCursor: String?
    @Published private(set) var announcementDetailCache: [String: ServiceAnnouncement] = [:]

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
            announcementsSummary = response.announcementsSummary
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

    func updatePreferences(_ settings: NotificationSettingsState) async {
        guard let deviceId = deviceIDStore.loadDeviceID() else { return }
        do {
            let current = try await api.preferences(deviceId: deviceId)
            let updatedAt = ISO8601DateFormatter().string(from: Date())
            let preserved = current.preferences.filter { $0.scope != "global" }
            let global = PreferenceResponse(
                deviceId: deviceId,
                scope: "global",
                enabled: settings.globalEnabled,
                explicitOverride: true,
                tapAction: settings.tapAction == .openApp ? "open_app" : "open_platform",
                deliveryMode: settings.realtimeEnabled ? "realtime_best_effort" : "standard",
                serviceAnnouncementsEnabled: settings.serviceAnnouncementsEnabled,
                updatedAt: updatedAt
            )
            _ = try await api.updatePreferences(
                UpdatePreferencesRequest(
                    deviceId: deviceId,
                    preferences: preserved + [global],
                    clientUpdatedAt: updatedAt
                )
            )
        } catch {
            // Local settings remain usable while the next change retries server synchronization.
        }
    }

    func refreshHubEvents(filter: String = "all", from: Date? = nil, to: Date? = nil) async {
        isRefreshingHubEvents = true
        defer { isRefreshingHubEvents = false }
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
        isRefreshingCalendar = true
        defer { isRefreshingCalendar = false }
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
        isRefreshingSongs = true
        defer { isRefreshingSongs = false }
        do {
            let normalizedType = type == "all" ? nil : type
            let result = try await MusicPageCollector.collect { pageCursor, pageLimit in
                if let memberId, !memberId.isEmpty, memberId != "all" {
                    return try await api.memberMusic(memberId: memberId, type: normalizedType, cursor: pageCursor, limit: pageLimit)
                }
                return try await api.music(type: normalizedType, cursor: pageCursor, limit: pageLimit)
            }
            if serverSongs != result.items { serverSongs = result.items }
            if songCatalogServerTime != result.serverTime { songCatalogServerTime = result.serverTime }
            if hasAuthoritativeSongCatalog != result.complete { hasAuthoritativeSongCatalog = result.complete }
        } catch {
            if serverSongs.isEmpty {
                serverSongs = fallback.songs(generationId: generationId, memberId: memberId, type: type, query: query).items
            }
        }
    }

    func refreshRecentSongs(limit: Int = 5) async {
        isRefreshingRecentSongs = true
        defer { isRefreshingRecentSongs = false }
        do {
            let result = try await MusicPageCollector.collect { pageCursor, pageLimit in
                try await api.music(type: nil, cursor: pageCursor, limit: pageLimit, sort: "publishedAt_desc")
            }
            if serverSongs != result.items { serverSongs = result.items }
            if songCatalogServerTime != result.serverTime { songCatalogServerTime = result.serverTime }
            if hasAuthoritativeSongCatalog != result.complete { hasAuthoritativeSongCatalog = result.complete }
            let refreshedRecentSongs = IOSSongPagePolicy.recentSongs(result.items, limit: limit)
            if recentSongs != refreshedRecentSongs { recentSongs = refreshedRecentSongs }
        } catch {
            recentSongs = IOSSongPagePolicy.recentSongs(
                serverSongs.isEmpty ? fallback.songs().items : serverSongs,
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
        loadingHubEventDetailIds.insert(id)
        defer { loadingHubEventDetailIds.remove(id) }
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

    func refreshAnnouncements(reset: Bool) async {
        do {
            let response = try await api.announcements(cursor: reset ? nil : announcementNextCursor)
            serviceAnnouncements = reset ? response.items : Array(Dictionary(uniqueKeysWithValues: (serviceAnnouncements + response.items).map { ($0.id, $0) }).values)
            serviceAnnouncements.sort { $0.publishedAt > $1.publishedAt }
            announcementNextCursor = response.nextCursor
            response.items.forEach { announcementDetailCache[$0.id] = $0 }
        } catch { }
    }

    func loadAnnouncementDetail(id: String) async -> ServiceAnnouncement? {
        do {
            let announcement = try await api.announcement(id: id)
            announcementDetailCache[id] = announcement
            if !serviceAnnouncements.contains(where: { $0.id == id }) { serviceAnnouncements.append(announcement) }
            return announcement
        } catch { return announcementDetailCache[id] }
    }

    func cachedAnnouncement(id: String) -> ServiceAnnouncement? {
        announcementDetailCache[id] ?? serviceAnnouncements.first(where: { $0.id == id }) ?? announcementsSummary?.pinned.flatMap { $0.id == id ? $0 : nil }
    }

    func loadSongDetail(id: String, fallback: SongCatalogItem) async -> SongCatalogItem {
        loadingSongDetailIds.insert(id)
        defer { loadingSongDetailIds.remove(id) }
        do {
            let detail = try await api.musicDetail(id: id)
            songDetailCache[id] = detail
            return detail
        } catch {
            return songDetailCache[id] ?? fallback
        }
    }

    func cachedSongDetail(id: String) -> SongCatalogItem? {
        songDetailCache[id]
    }

    func isLoadingSongDetail(id: String) -> Bool {
        loadingSongDetailIds.contains(id)
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

    func isLoadingHubEventDetail(id: String) -> Bool {
        loadingHubEventDetailIds.contains(id)
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

    var songCatalogItems: [SongCatalogItem] {
        serverSongs.isEmpty ? fallback.songs().items : serverSongs
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
            scheduleMode: scheduleMode ?? .singleWindow,
            scheduleItems: (scheduleItems ?? []).compactMap { item in
                guard let startsAt = Self.parseScheduleDate(item.startsAt) else { return nil }
                let title = item.title?.trimmingCharacters(in: .whitespacesAndNewlines)
                let description = item.description?.trimmingCharacters(in: .whitespacesAndNewlines)
                return HubEventScheduleItem(
                    id: item.id,
                    kind: item.kind,
                    title: title?.isEmpty == false ? title : nil,
                    label: item.label,
                    description: description?.isEmpty == false ? description : nil,
                    startsAt: startsAt,
                    endsAt: item.endsAt.flatMap(Self.parseScheduleDate),
                    timePrecision: item.timePrecision,
                    timezone: item.timezone,
                    actionUrl: item.actionUrl,
                    sourceUrl: item.sourceUrl,
                    sourceLabel: item.sourceLabel,
                    links: (item.links ?? []).enumerated().map { index, link in
                        HubEventLink(
                            id: link.id ?? "schedule:\(item.id):link:\(index)",
                            kind: link.kind,
                            label: link.label,
                            url: link.url,
                            sortOrder: link.sortOrder,
                            createdAt: link.createdAt.flatMap(Self.parseDate),
                            updatedAt: link.updatedAt.flatMap(Self.parseDate)
                        )
                    },
                    notificationEligible: item.notificationEligible,
                    isPrimary: item.isPrimary,
                    sortOrder: item.sortOrder,
                    cancelledAt: item.cancelledAt.flatMap(Self.parseDate),
                    createdAt: item.createdAt.flatMap(Self.parseDate)
                )
            }.sorted { left, right in
                left.startsAt == right.startsAt ? left.sortOrder < right.sortOrder : left.startsAt < right.startsAt
            },
            links: (links ?? []).enumerated().map { index, link in
                HubEventLink(
                    id: link.id ?? "event:\(id):link:\(index)",
                    kind: link.kind,
                    label: link.label,
                    url: link.url,
                    sortOrder: link.sortOrder,
                    createdAt: link.createdAt.flatMap(Self.parseDate),
                    updatedAt: link.updatedAt.flatMap(Self.parseDate)
                )
            },
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

    static func parseScheduleDate(_ value: String) -> Date? {
        if let date = parseDate(value) { return date }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }
}
