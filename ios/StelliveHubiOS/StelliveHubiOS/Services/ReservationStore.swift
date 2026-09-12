import ActivityKit
import Foundation

@MainActor
final class ReservationStore: ObservableObject {
    @Published private(set) var records: [ReservationRecord]
    @Published private(set) var drafts: [ReservationDraft]
    @Published private(set) var lastErrorMessage: String?
    @Published private(set) var externallyOpenedSessionIDs = Set<UUID>()
    @Published private(set) var lastDeletedRecord: ReservationRecord?

    private let sharedStore: ReservationSharedStore?
    private let now: () -> Date

    init(sharedStore: ReservationSharedStore? = nil, now: @escaping () -> Date = Date.init) {
        let resolvedStore: ReservationSharedStore?
        var initialState = ReservationStateV1()
        var initialError: String?
        if let sharedStore {
            resolvedStore = sharedStore
        } else {
            do {
                resolvedStore = try ReservationSharedStore()
            } catch {
                resolvedStore = nil
                initialError = error.localizedDescription
            }
        }
        if let resolvedStore {
            do {
                initialState = try resolvedStore.pruneExpiredDrafts(now: now())
            } catch {
                initialError = error.localizedDescription
            }
        }
        self.sharedStore = resolvedStore
        self.now = now
        records = initialState.records
        drafts = ReservationDraftPolicy.active(initialState.drafts, now: now())
        lastErrorMessage = initialError
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
        do {
            guard let sharedStore else { throw ReservationError.sharedContainerUnavailable }
            let state = try sharedStore.pruneExpiredDrafts(now: now())
            records = state.records
            drafts = ReservationDraftPolicy.active(state.drafts, now: now())
            lastErrorMessage = nil
        } catch {
            lastErrorMessage = error.localizedDescription
        }
        let remainingSessionIDs = Set(drafts.map(\.sessionID))
        previousSessionIDs.subtracting(remainingSessionIDs).forEach(ReservationActivityCoordinator.end)
    }

    @discardableResult
    func begin(event: HubEvent, scheduleItem: HubEventScheduleItem?, link: HubEventLink) throws -> ReservationDraft? {
        guard let kind = ReservationActionPolicy.kind(
            for: link.kind,
            scheduleCancelled: scheduleItem?.cancelledAt != nil
        ) else { return nil }
        guard let actionURL = ReservationURLPolicy.validatedURL(link.url), let host = actionURL.host else {
            throw ReservationError.invalidURL
        }
        let current = now()
        let candidate = ReservationDraft(
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
        guard let sharedStore else { throw ReservationError.sharedContainerUnavailable }
        let draft = try sharedStore.upsertDraft(candidate)
        let state = try sharedStore.loadState()
        records = state.records
        drafts = ReservationDraftPolicy.active(state.drafts, now: current)
        lastErrorMessage = nil
        externallyOpenedSessionIDs.insert(draft.sessionID)
        return draft
    }

    @discardableResult
    func confirm(
        sessionID: UUID,
        detailURL: String?,
        linkSource: ReservationLinkSource,
        allowsSensitiveURL: Bool = false
    ) throws -> ReservationRecord {
        let normalizedURL: String?
        if let value = ReservationTextPolicy.nonEmpty(detailURL) {
            guard let url = ReservationURLPolicy.validatedURL(value) else { throw ReservationError.invalidURL }
            if ReservationURLPolicy.containsSensitiveQuery(value), !allowsSensitiveURL {
                throw ReservationError.sensitiveURLRequiresConfirmation
            }
            normalizedURL = url.absoluteString
        } else {
            normalizedURL = nil
        }
        guard let sharedStore else { throw ReservationError.sharedContainerUnavailable }
        let record = try sharedStore.confirm(
            sessionID: sessionID,
            detailURL: normalizedURL,
            linkSource: linkSource,
            now: now()
        )
        let state = try sharedStore.loadState()
        records = state.records
        drafts = ReservationDraftPolicy.active(state.drafts, now: now())
        lastErrorMessage = nil
        ReservationActivityCoordinator.end(sessionID: sessionID)
        return record
    }

    func update(_ record: ReservationRecord) throws {
        var updated = record
        updated.updatedAt = now()
        guard let sharedStore else { throw ReservationError.sharedContainerUnavailable }
        try sharedStore.updateRecord(updated)
        try reloadOrThrow()
    }

    @discardableResult
    func delete(id: UUID) throws -> ReservationRecord? {
        guard let sharedStore else { throw ReservationError.sharedContainerUnavailable }
        let deleted = try sharedStore.deleteRecord(id: id)
        try reloadOrThrow()
        lastDeletedRecord = deleted
        return deleted
    }

    func restore(_ record: ReservationRecord) throws {
        guard let sharedStore else { throw ReservationError.sharedContainerUnavailable }
        try sharedStore.restoreRecord(record)
        try reloadOrThrow()
        if lastDeletedRecord?.id == record.id { lastDeletedRecord = nil }
    }

    func record(id: UUID) -> ReservationRecord? { records.first { $0.id == id } }
    func draft(sessionID: UUID?) -> ReservationDraft? {
        guard let sessionID else { return activeDrafts.count == 1 ? activeDrafts[0] : nil }
        return activeDrafts.first { $0.sessionID == sessionID }
    }

    func duplicateDetailURL(_ rawValue: String?, excluding id: UUID? = nil) -> ReservationRecord? {
        guard let normalized = ReservationURLPolicy.validatedURL(rawValue)?.absoluteString else { return nil }
        return records.first { $0.id != id && $0.reservationDetailURL == normalized }
    }

    func clearErrorMessage() { lastErrorMessage = nil }

    func reportBestEffortError() {
        lastErrorMessage = String(localized: "reservation_error_recording_failed")
    }

    func clearDeletedRecord() { lastDeletedRecord = nil }

    private func reloadOrThrow() throws {
        guard let sharedStore else { throw ReservationError.sharedContainerUnavailable }
        let state = try sharedStore.loadState()
        records = state.records
        drafts = ReservationDraftPolicy.active(state.drafts, now: now())
        lastErrorMessage = nil
    }
}

enum ReservationActivityCoordinator {
    @MainActor
    static func start(for draft: ReservationDraft, draftCount: Int) throws {
        guard #available(iOS 16.1, *), ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attributes = ReservationActivityAttributes(sessionID: draft.sessionID)
        let state = ReservationActivityAttributes.ContentState(
            title: draft.eventSnapshot.title,
            kind: draft.kind,
            providerHost: draft.providerHost,
            openedAt: draft.openedAt,
            draftCount: draftCount
        )
        _ = try Activity.request(attributes: attributes, contentState: state, pushType: nil)
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
