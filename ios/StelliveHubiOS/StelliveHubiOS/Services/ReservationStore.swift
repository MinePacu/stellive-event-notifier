import ActivityKit
import Foundation

enum ReservationStoreError: LocalizedError {
    case sharedContainerUnavailable
    case draftNotFound
    case invalidURL
    case sensitiveURLRequiresConfirmation

    var errorDescription: String? {
        switch self {
        case .sharedContainerUnavailable: "예약 저장 공간을 열 수 없습니다."
        case .draftNotFound: "앱에서 예매 링크를 먼저 열어 주세요."
        case .invalidURL: "호스트가 있는 HTTPS 링크를 입력해 주세요."
        case .sensitiveURLRequiresConfirmation: "인증 정보가 포함될 수 있는 링크입니다. 저장 여부를 확인해 주세요."
        }
    }
}

struct ReservationSharedStore {
    static let appGroupIdentifier = "group.dev.minepacu.stelliveeventnotifier"
    private let directoryURL: URL
    private let coordinator = NSFileCoordinator(filePresenter: nil)
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(directoryURL: URL? = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier
    )) throws {
        guard let directoryURL else { throw ReservationStoreError.sharedContainerUnavailable }
        self.directoryURL = directoryURL
        encoder = JSONEncoder()
        decoder = JSONDecoder()
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        try excludeFromBackup(directoryURL)
    }

    func loadRecords() -> [ReservationRecord] { load([ReservationRecord].self, from: recordsURL) ?? [] }
    func loadDrafts() -> [ReservationDraft] { load([ReservationDraft].self, from: draftsURL) ?? [] }
    func saveRecords(_ records: [ReservationRecord]) throws { try save(records, to: recordsURL) }
    func saveDrafts(_ drafts: [ReservationDraft]) throws { try save(drafts, to: draftsURL) }

    private var recordsURL: URL { directoryURL.appendingPathComponent("reservations-v1.json") }
    private var draftsURL: URL { directoryURL.appendingPathComponent("reservation-drafts-v1.json") }

    private func load<Value: Decodable>(_ type: Value.Type, from url: URL) -> Value? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        var coordinationError: NSError?
        var value: Value?
        coordinator.coordinate(readingItemAt: url, options: [], error: &coordinationError) { coordinatedURL in
            guard let data = try? Data(contentsOf: coordinatedURL) else { return }
            value = try? decoder.decode(type, from: data)
        }
        return value
    }

    private func save<Value: Encodable>(_ value: Value, to url: URL) throws {
        let data = try encoder.encode(value)
        var coordinationError: NSError?
        var writeError: Error?
        coordinator.coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { coordinatedURL in
            do {
                try data.write(to: coordinatedURL, options: .atomic)
                try excludeFromBackup(coordinatedURL)
            } catch {
                writeError = error
            }
        }
        if let coordinationError { throw coordinationError }
        if let writeError { throw writeError }
    }

    private func excludeFromBackup(_ url: URL) throws {
        var mutableURL = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try mutableURL.setResourceValues(values)
    }
}

@MainActor
final class ReservationStore: ObservableObject {
    @Published private(set) var records: [ReservationRecord]
    @Published private(set) var drafts: [ReservationDraft]
    @Published private(set) var lastErrorMessage: String?

    private let sharedStore: ReservationSharedStore?
    private let now: () -> Date

    init(sharedStore: ReservationSharedStore? = try? ReservationSharedStore(), now: @escaping () -> Date = Date.init) {
        self.sharedStore = sharedStore
        self.now = now
        records = sharedStore?.loadRecords() ?? []
        drafts = ReservationDraftPolicy.active(sharedStore?.loadDrafts() ?? [], now: now())
        persistDrafts()
    }

    var activeDrafts: [ReservationDraft] { ReservationDraftPolicy.active(drafts, now: now()) }
    var pendingCount: Int { activeDrafts.count }

    var upcomingRecords: [ReservationRecord] {
        records.filter { $0.status == .confirmed && ($0.effectiveStartsAt ?? .distantFuture) >= now() }
            .sorted { ($0.effectiveStartsAt ?? .distantFuture) < ($1.effectiveStartsAt ?? .distantFuture) }
    }

    var pastRecords: [ReservationRecord] {
        records.filter { record in
            record.status != .confirmed || (record.effectiveStartsAt.map { $0 < now() } ?? false)
        }.sorted { ($0.effectiveStartsAt ?? $0.updatedAt) > ($1.effectiveStartsAt ?? $1.updatedAt) }
    }

    func reload() {
        let previousSessionIDs = Set(drafts.map(\.sessionID))
        records = sharedStore?.loadRecords() ?? records
        drafts = ReservationDraftPolicy.active(sharedStore?.loadDrafts() ?? drafts, now: now())
        let remainingSessionIDs = Set(drafts.map(\.sessionID))
        previousSessionIDs.subtracting(remainingSessionIDs).forEach(ReservationActivityCoordinator.end)
        persistDrafts()
    }

    @discardableResult
    func begin(event: HubEvent, scheduleItem: HubEventScheduleItem?, link: HubEventLink) throws -> ReservationDraft? {
        guard let kind = ReservationActionPolicy.kind(
            for: link.kind,
            scheduleCancelled: scheduleItem?.cancelledAt != nil
        ) else { return nil }
        guard let actionURL = ReservationURLPolicy.validatedURL(link.url), let host = actionURL.host else {
            throw ReservationStoreError.invalidURL
        }
        let current = now()
        if let index = drafts.firstIndex(where: {
            $0.eventID == event.id && $0.scheduleItemID == scheduleItem?.id && $0.originalActionURL == actionURL.absoluteString
        }) {
            drafts[index].openedAt = current
            drafts[index].expiresAt = current.addingTimeInterval(2 * 60 * 60)
            drafts[index].attemptCount += 1
            persistDrafts()
            return drafts[index]
        }
        let draft = ReservationDraft(
            sessionID: UUID(),
            eventID: event.id,
            scheduleItemID: scheduleItem?.id,
            kind: kind,
            eventSnapshot: ReservationEventSnapshot(
                title: event.title,
                category: event.category.rawValue,
                startsAt: scheduleItem?.startsAt ?? event.startsAt,
                endsAt: scheduleItem?.endsAt ?? event.endsAt,
                venueName: event.venueName,
                venueAddress: event.venueAddress,
                sourceLabel: event.sourceLabel,
                imageURL: HubEventImagePolicy.displayURL(for: event.image)?.absoluteString
            ),
            originalActionURL: actionURL.absoluteString,
            providerHost: host,
            openedAt: current,
            expiresAt: current.addingTimeInterval(2 * 60 * 60),
            attemptCount: 1
        )
        drafts.append(draft)
        persistDrafts()
        return draft
    }

    @discardableResult
    func confirm(
        sessionID: UUID,
        detailURL: String?,
        linkSource: ReservationLinkSource,
        allowsSensitiveURL: Bool = false
    ) throws -> ReservationRecord {
        if let existing = records.first(where: { $0.sourceSessionID == sessionID }) { return existing }
        guard let draft = drafts.first(where: { $0.sessionID == sessionID }) else {
            throw ReservationStoreError.draftNotFound
        }
        let normalizedURL: String?
        if let value = ReservationTextPolicy.nonEmpty(detailURL) {
            guard let url = ReservationURLPolicy.validatedURL(value) else { throw ReservationStoreError.invalidURL }
            if ReservationURLPolicy.containsSensitiveQuery(value), !allowsSensitiveURL {
                throw ReservationStoreError.sensitiveURLRequiresConfirmation
            }
            normalizedURL = url.absoluteString
        } else {
            normalizedURL = nil
        }
        let current = now()
        let record = ReservationRecord(
            id: UUID(), sourceSessionID: draft.sessionID, eventID: draft.eventID,
            scheduleItemID: draft.scheduleItemID, kind: draft.kind, status: .confirmed,
            eventSnapshot: draft.eventSnapshot, originalActionURL: draft.originalActionURL,
            reservationDetailURL: normalizedURL, providerHistoryURL: nil, linkSource: linkSource,
            displayTitleOverride: nil, startsAtOverride: nil, endsAtOverride: nil,
            venueOverride: nil, optionText: nil, quantity: nil, referenceNumber: nil, note: nil,
            openedAt: draft.openedAt, confirmedAt: current, createdAt: current, updatedAt: current,
            schemaVersion: 1
        )
        records.append(record)
        drafts.removeAll { $0.sessionID == sessionID }
        persistAll()
        ReservationActivityCoordinator.end(sessionID: sessionID)
        return record
    }

    func update(_ record: ReservationRecord) {
        guard let index = records.firstIndex(where: { $0.id == record.id }) else { return }
        var updated = record
        updated.updatedAt = now()
        records[index] = updated
        persistRecords()
    }

    func delete(id: UUID) {
        records.removeAll { $0.id == id }
        persistRecords()
    }

    func record(id: UUID) -> ReservationRecord? { records.first { $0.id == id } }
    func draft(sessionID: UUID?) -> ReservationDraft? {
        guard let sessionID else { return activeDrafts.count == 1 ? activeDrafts[0] : nil }
        return activeDrafts.first { $0.sessionID == sessionID }
    }

    private func persistAll() { persistRecords(); persistDrafts() }
    private func persistRecords() {
        do { try sharedStore?.saveRecords(records) } catch { lastErrorMessage = error.localizedDescription }
    }
    private func persistDrafts() {
        do { try sharedStore?.saveDrafts(drafts) } catch { lastErrorMessage = error.localizedDescription }
    }
}

enum ReservationActivityCoordinator {
    @MainActor
    static func start(for draft: ReservationDraft, draftCount: Int) {
        guard #available(iOS 16.1, *), ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attributes = ReservationActivityAttributes(sessionID: draft.sessionID)
        let state = ReservationActivityAttributes.ContentState(
            title: draft.eventSnapshot.title,
            providerHost: draft.providerHost,
            openedAt: draft.openedAt,
            draftCount: draftCount
        )
        _ = try? Activity.request(attributes: attributes, contentState: state, pushType: nil)
    }

    static func end(sessionID: UUID) {
        guard #available(iOS 16.1, *) else { return }
        Task {
            for activity in Activity<ReservationActivityAttributes>.activities where activity.attributes.sessionID == sessionID {
                await activity.end(dismissalPolicy: .immediate)
            }
        }
    }
}
