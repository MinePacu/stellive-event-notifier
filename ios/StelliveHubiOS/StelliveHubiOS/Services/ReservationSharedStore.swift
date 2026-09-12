import Foundation

struct ReservationStateV1: Codable, Equatable {
    static let currentSchemaVersion = 1

    var schemaVersion: Int = currentSchemaVersion
    var revision: Int = 0
    var records: [ReservationRecord] = []
    var drafts: [ReservationDraft] = []
}

struct ReservationSharedStore {
    static let appGroupIdentifier = "group.dev.minepacu.stelliveeventnotifier"
    static let stateFileName = "reservation-state-v1.json"
    static let legacyRecordsFileName = "reservations-v1.json"
    static let legacyDraftsFileName = "reservation-drafts-v1.json"

    private let directoryURL: URL
    private let fileManager: FileManager
    private let beforeAtomicReplace: (() throws -> Void)?

    init(
        directoryURL: URL? = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier
        ),
        fileManager: FileManager = .default,
        beforeAtomicReplace: (() throws -> Void)? = nil
    ) throws {
        guard let directoryURL else { throw ReservationError.sharedContainerUnavailable }
        self.directoryURL = directoryURL
        self.fileManager = fileManager
        self.beforeAtomicReplace = beforeAtomicReplace
        try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        try excludeFromBackup(directoryURL)
        for legacyURL in [legacyRecordsURL, legacyDraftsURL] where fileManager.fileExists(atPath: legacyURL.path) {
            try? excludeFromBackup(legacyURL)
        }
    }

    func loadState() throws -> ReservationStateV1 {
        if !fileManager.fileExists(atPath: stateURL.path) {
            return try transaction { state in state }
        }
        var coordinationError: NSError?
        var result: Result<ReservationStateV1, Error>?
        NSFileCoordinator(filePresenter: nil).coordinate(
            readingItemAt: stateURL,
            options: [],
            error: &coordinationError
        ) { coordinatedURL in
            result = Result { try decodeState(at: coordinatedURL) }
        }
        if let coordinationError { throw coordinationError }
        return try result?.get() ?? { throw ReservationError.sharedContainerUnavailable }()
    }

    @discardableResult
    func transaction<Value>(_ mutation: (inout ReservationStateV1) throws -> Value) throws -> Value {
        var coordinationError: NSError?
        var result: Result<Value, Error>?
        NSFileCoordinator(filePresenter: nil).coordinate(
            writingItemAt: stateURL,
            options: .forReplacing,
            error: &coordinationError
        ) { coordinatedURL in
            result = Result {
                var state = try loadStateForTransaction(at: coordinatedURL)
                let value = try mutation(&state)
                state.schemaVersion = ReservationStateV1.currentSchemaVersion
                state.revision += 1
                try writeAtomically(state, to: coordinatedURL)
                return value
            }
        }
        if let coordinationError { throw coordinationError }
        return try result?.get() ?? { throw ReservationError.sharedContainerUnavailable }()
    }

    func upsertDraft(_ candidate: ReservationDraft) throws -> ReservationDraft {
        try transaction { state in
            if let index = state.drafts.firstIndex(where: {
                $0.eventID == candidate.eventID &&
                    $0.scheduleItemID == candidate.scheduleItemID &&
                    $0.originalActionURL == candidate.originalActionURL
            }) {
                state.drafts[index].openedAt = candidate.openedAt
                state.drafts[index].expiresAt = candidate.expiresAt
                state.drafts[index].attemptCount += 1
                return state.drafts[index]
            }
            state.drafts.append(candidate)
            return candidate
        }
    }

    func confirm(
        sessionID: UUID,
        detailURL: String?,
        linkSource: ReservationLinkSource,
        now: Date
    ) throws -> ReservationRecord {
        try transaction { state in
            if let existing = state.records.first(where: { $0.sourceSessionID == sessionID }) {
                state.drafts.removeAll { $0.sessionID == sessionID }
                return existing
            }
            guard let draft = state.drafts.first(where: { $0.sessionID == sessionID }) else {
                throw ReservationError.draftNotFound
            }
            let record = ReservationRecord(
                id: UUID(), sourceSessionID: draft.sessionID, eventID: draft.eventID,
                scheduleItemID: draft.scheduleItemID, kind: draft.kind, status: .confirmed,
                eventSnapshot: draft.eventSnapshot, originalActionURL: draft.originalActionURL,
                reservationDetailURL: detailURL, providerHistoryURL: nil, linkSource: linkSource,
                displayTitleOverride: nil, startsAtOverride: nil, endsAtOverride: nil,
                venueOverride: nil, optionText: nil, quantity: nil, referenceNumber: nil, note: nil,
                openedAt: draft.openedAt, confirmedAt: now, createdAt: now, updatedAt: now,
                schemaVersion: 1
            )
            state.records.append(record)
            state.drafts.removeAll { $0.sessionID == sessionID }
            return record
        }
    }

    func updateRecord(_ record: ReservationRecord) throws {
        try transaction { state in
            guard let index = state.records.firstIndex(where: { $0.id == record.id }) else { return }
            state.records[index] = record
        }
    }

    @discardableResult
    func deleteRecord(id: UUID) throws -> ReservationRecord? {
        try transaction { state in
            guard let index = state.records.firstIndex(where: { $0.id == id }) else { return nil }
            return state.records.remove(at: index)
        }
    }

    func restoreRecord(_ record: ReservationRecord) throws {
        try transaction { state in
            guard !state.records.contains(where: { $0.id == record.id }) else { return }
            state.records.append(record)
        }
    }

    func deleteDraft(sessionID: UUID) throws {
        try transaction { state in state.drafts.removeAll { $0.sessionID == sessionID } }
    }

    func pruneExpiredDrafts(now: Date) throws -> ReservationStateV1 {
        try transaction { state in
            state.drafts.removeAll { $0.expiresAt <= now }
            return state
        }
    }

    private var stateURL: URL { directoryURL.appendingPathComponent(Self.stateFileName) }
    private var legacyRecordsURL: URL { directoryURL.appendingPathComponent(Self.legacyRecordsFileName) }
    private var legacyDraftsURL: URL { directoryURL.appendingPathComponent(Self.legacyDraftsFileName) }

    private func loadStateForTransaction(at coordinatedURL: URL) throws -> ReservationStateV1 {
        guard fileManager.fileExists(atPath: coordinatedURL.path) else { return try migrateLegacyState() }
        return try decodeState(at: coordinatedURL)
    }

    private func decodeState(at url: URL) throws -> ReservationStateV1 {
        do {
            let state = try decoder.decode(ReservationStateV1.self, from: Data(contentsOf: url))
            guard state.schemaVersion == ReservationStateV1.currentSchemaVersion else {
                throw CocoaError(.coderReadCorrupt)
            }
            return state
        } catch {
            let backup = try preserveCorruptedFile(at: url)
            throw ReservationError.corruptedData(backupFileName: backup.lastPathComponent)
        }
    }

    private func migrateLegacyState() throws -> ReservationStateV1 {
        let records: [ReservationRecord] = try decodeLegacy([ReservationRecord].self, at: legacyRecordsURL) ?? []
        let drafts: [ReservationDraft] = try decodeLegacy([ReservationDraft].self, at: legacyDraftsURL) ?? []
        return ReservationStateV1(records: records, drafts: drafts)
    }

    private func decodeLegacy<Value: Decodable>(_ type: Value.Type, at url: URL) throws -> Value? {
        guard fileManager.fileExists(atPath: url.path) else { return nil }
        do {
            return try decoder.decode(type, from: Data(contentsOf: url))
        } catch {
            let backup = try preserveCorruptedFile(at: url)
            throw ReservationError.corruptedData(backupFileName: backup.lastPathComponent)
        }
    }

    private func writeAtomically(_ state: ReservationStateV1, to destinationURL: URL) throws {
        let temporaryURL = directoryURL.appendingPathComponent(".reservation-state-\(UUID().uuidString).tmp")
        defer { try? fileManager.removeItem(at: temporaryURL) }
        try encoder.encode(state).write(to: temporaryURL)
        try excludeFromBackup(temporaryURL)
        try beforeAtomicReplace?()
        if fileManager.fileExists(atPath: destinationURL.path) {
            _ = try fileManager.replaceItemAt(destinationURL, withItemAt: temporaryURL)
        } else {
            try fileManager.moveItem(at: temporaryURL, to: destinationURL)
        }
        try excludeFromBackup(destinationURL)
    }

    private func preserveCorruptedFile(at sourceURL: URL) throws -> URL {
        let name = sourceURL.deletingPathExtension().lastPathComponent
        let backupURL = directoryURL.appendingPathComponent("\(name).corrupt-\(UUID().uuidString).json")
        if !fileManager.fileExists(atPath: backupURL.path) {
            try fileManager.copyItem(at: sourceURL, to: backupURL)
        }
        try excludeFromBackup(backupURL)
        return backupURL
    }

    private var encoder: JSONEncoder {
        let value = JSONEncoder()
        value.dateEncodingStrategy = .iso8601
        value.outputFormatting = [.sortedKeys]
        return value
    }

    private var decoder: JSONDecoder {
        let value = JSONDecoder()
        value.dateDecodingStrategy = .iso8601
        return value
    }

    private func excludeFromBackup(_ url: URL) throws {
        var mutableURL = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try mutableURL.setResourceValues(values)
    }
}
