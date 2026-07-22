import ActivityKit
import AppIntents
import Foundation

struct CompleteReservationIntent: AppIntent {
    static var title: LocalizedStringResource = "예약 완료만 기록"
    static var description = IntentDescription("현재 진행 중인 예약을 링크 없이 이 기기에 기록합니다.")
    static var openAppWhenRun = false

    @Parameter(title: "예약 세션") var sessionID: String

    init() {}
    init(sessionID: UUID) { self.sessionID = sessionID.uuidString }

    func perform() async throws -> some IntentResult {
        guard let id = UUID(uuidString: sessionID) else { return .result() }
        try ReservationIntentWriter().confirm(sessionID: id)
        if #available(iOSApplicationExtension 16.1, *) {
            for activity in Activity<ReservationActivityAttributes>.activities where activity.attributes.sessionID == id {
                await activity.end(dismissalPolicy: .immediate)
            }
        }
        return .result()
    }
}

private struct ReservationIntentWriter {
    private static let appGroupIdentifier = "group.dev.minepacu.stelliveeventnotifier"
    private let coordinator = NSFileCoordinator(filePresenter: nil)
    private let encoder: JSONEncoder = {
        let value = JSONEncoder(); value.dateEncodingStrategy = .iso8601; return value
    }()
    private let decoder: JSONDecoder = {
        let value = JSONDecoder(); value.dateDecodingStrategy = .iso8601; return value
    }()

    func confirm(sessionID: UUID) throws {
        guard let directory = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier
        ) else { return }
        let recordsURL = directory.appendingPathComponent("reservations-v1.json")
        let draftsURL = directory.appendingPathComponent("reservation-drafts-v1.json")
        var records = read([ReservationRecord].self, from: recordsURL) ?? []
        if records.contains(where: { $0.sourceSessionID == sessionID }) { return }
        var drafts = read([ReservationDraft].self, from: draftsURL) ?? []
        guard let draft = drafts.first(where: { $0.sessionID == sessionID }) else { return }
        let now = Date()
        records.append(ReservationRecord(
            id: UUID(), sourceSessionID: draft.sessionID, eventID: draft.eventID,
            scheduleItemID: draft.scheduleItemID, kind: draft.kind, status: .confirmed,
            eventSnapshot: draft.eventSnapshot, originalActionURL: draft.originalActionURL,
            reservationDetailURL: nil, providerHistoryURL: nil, linkSource: .liveActivity,
            displayTitleOverride: nil, startsAtOverride: nil, endsAtOverride: nil, venueOverride: nil,
            optionText: nil, quantity: nil, referenceNumber: nil, note: nil,
            openedAt: draft.openedAt, confirmedAt: now, createdAt: now, updatedAt: now, schemaVersion: 1
        ))
        drafts.removeAll { $0.sessionID == sessionID }
        try write(records, to: recordsURL)
        try write(drafts, to: draftsURL)
    }

    private func read<Value: Decodable>(_ type: Value.Type, from url: URL) -> Value? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        var coordinationError: NSError?
        var value: Value?
        coordinator.coordinate(readingItemAt: url, options: [], error: &coordinationError) { coordinatedURL in
            guard let data = try? Data(contentsOf: coordinatedURL) else { return }
            value = try? decoder.decode(type, from: data)
        }
        return value
    }

    private func write<Value: Encodable>(_ value: Value, to url: URL) throws {
        let data = try encoder.encode(value)
        var coordinationError: NSError?
        var writeError: Error?
        coordinator.coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { coordinatedURL in
            do {
                try data.write(to: coordinatedURL, options: .atomic)
                var mutableURL = coordinatedURL
                var values = URLResourceValues(); values.isExcludedFromBackup = true
                try mutableURL.setResourceValues(values)
            } catch { writeError = error }
        }
        if let coordinationError { throw coordinationError }
        if let writeError { throw writeError }
    }
}
