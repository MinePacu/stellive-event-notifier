import Foundation

@MainActor
final class ServerHubStore: ObservableObject {
    private let api: HubAPIClient
    private let deviceIDStore: DeviceIDStore
    private let fallback: MockHubStore
    @Published private(set) var serverHubEvents: [HubEvent] = []
    @Published private(set) var serverCalendarDays: [HubCalendarDay] = []
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
            let generationId = filter == "all" ? nil : filter
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
