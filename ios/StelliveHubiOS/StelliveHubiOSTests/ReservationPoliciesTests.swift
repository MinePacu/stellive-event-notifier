import XCTest
@testable import StelliveHubiOS

final class ReservationPoliciesTests: XCTestCase {
    func testReservationActionsIncludeOnlyTicketPurchaseAndReservation() {
        XCTAssertEqual(ReservationActionPolicy.kind(for: .ticket), .ticket)
        XCTAssertEqual(ReservationActionPolicy.kind(for: .purchase), .purchase)
        XCTAssertEqual(ReservationActionPolicy.kind(for: .reservation), .reservation)
        XCTAssertNil(ReservationActionPolicy.kind(for: .source))
        XCTAssertNil(ReservationActionPolicy.kind(for: .ticket, scheduleCancelled: true))
    }

    func testURLPolicyRejectsHTTPAndDetectsSensitiveQuery() {
        XCTAssertNil(ReservationURLPolicy.validatedURL("http://example.com/order"))
        XCTAssertNotNil(ReservationURLPolicy.validatedURL(" https://example.com/order "))
        XCTAssertTrue(ReservationURLPolicy.containsSensitiveQuery("https://example.com/order?token=private"))
        XCTAssertFalse(ReservationURLPolicy.containsSensitiveQuery("https://example.com/order?id=1"))
    }

    func testShareParserUsesFirstHTTPSURL() {
        XCTAssertEqual(
            ReservationURLPolicy.firstSharedHTTPSURL(in: "결제 완료 https://example.com/one 다음 https://example.com/two")?.absoluteString,
            "https://example.com/one"
        )
    }

    func testDraftSelectionRequiresChoiceForMultipleDrafts() {
        let first = makeDraft(id: UUID(), openedAt: Date(timeIntervalSince1970: 10))
        let second = makeDraft(id: UUID(), openedAt: Date(timeIntervalSince1970: 20))
        XCTAssertEqual(
            ReservationDraftPolicy.selection(from: [first, second], now: Date(timeIntervalSince1970: 30)),
            .choose([second.sessionID, first.sessionID])
        )
    }

    func testReservationDeepLinks() {
        XCTAssertEqual(ReservationDeepLinkPolicy.route(from: URL(string: "stellivehub://reservations")), .list)
        let id = UUID()
        XCTAssertEqual(
            ReservationDeepLinkPolicy.route(from: URL(string: "stellivehub://reservations/\(id.uuidString)/edit")),
            .edit(id)
        )
        XCTAssertEqual(
            ReservationDeepLinkPolicy.route(from: URL(string: "stellivehub://reservations/new?sessionId=\(id.uuidString)")),
            .quickAdd(sessionID: id)
        )
    }

    func testDisplayOverridesPreferUserValues() {
        var record = makeRecord()
        XCTAssertEqual(record.displayTitle, "행사")
        record.displayTitleOverride = "내 예약"
        XCTAssertEqual(record.displayTitle, "내 예약")
    }

    func testExternalLinkPolicyOpensBeforeBestEffortRecordingFailure() {
        var calls: [String] = []
        ReservationExternalLinkPolicy.openFailOpen(
            openExternal: { calls.append("open") },
            recordBestEffort: { calls.append("record"); throw StubError.expected },
            onRecordingFailure: { calls.append("failure") }
        )
        XCTAssertEqual(calls, ["open", "record", "failure"])
    }

    func testReturnPromptRequiresTenSecondsAndPromptsOnce() {
        let now = Date(timeIntervalSince1970: 100)
        let draft = makeDraft(id: UUID(), openedAt: now.addingTimeInterval(-10))
        XCTAssertEqual(
            ReservationReturnPromptPolicy.decision(
                drafts: [draft],
                externallyOpenedSessionIDs: [draft.sessionID],
                promptedSessionIDs: [],
                now: now
            ),
            .single(draft.sessionID)
        )
        XCTAssertEqual(
            ReservationReturnPromptPolicy.decision(
                drafts: [draft],
                externallyOpenedSessionIDs: [draft.sessionID],
                promptedSessionIDs: [draft.sessionID],
                now: now
            ),
            .none
        )
    }

    func testSharedStoreMigratesLegacyFilesIntoOneStateFile() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let draft = makeDraft(id: UUID(), openedAt: Date(timeIntervalSince1970: 10))
        let record = makeRecord()
        try encoder.encode([draft]).write(to: directory.appendingPathComponent(ReservationSharedStore.legacyDraftsFileName))
        try encoder.encode([record]).write(to: directory.appendingPathComponent(ReservationSharedStore.legacyRecordsFileName))

        let sharedStore = try ReservationSharedStore(directoryURL: directory)
        let state = try sharedStore.loadState()

        XCTAssertEqual(state.drafts, [draft])
        XCTAssertEqual(state.records, [record])
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent(ReservationSharedStore.stateFileName).path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent(ReservationSharedStore.legacyDraftsFileName).path))
    }

    func testConfirmationIsAtomicAndIdempotent() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let sharedStore = try ReservationSharedStore(directoryURL: directory)
        let draft = makeDraft(id: UUID(), openedAt: Date(timeIntervalSince1970: 10))
        _ = try sharedStore.upsertDraft(draft)

        let first = try sharedStore.confirm(
            sessionID: draft.sessionID,
            detailURL: "https://example.com/detail",
            linkSource: .appInput,
            now: Date(timeIntervalSince1970: 100)
        )
        let second = try sharedStore.confirm(
            sessionID: draft.sessionID,
            detailURL: "https://example.com/detail",
            linkSource: .appInput,
            now: Date(timeIntervalSince1970: 200)
        )
        let state = try sharedStore.loadState()

        XCTAssertEqual(first.id, second.id)
        XCTAssertEqual(state.records.count, 1)
        XCTAssertTrue(state.drafts.isEmpty)
    }

    func testFailedAtomicReplacementPreservesPreviousState() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let sharedStore = try ReservationSharedStore(directoryURL: directory)
        let draft = makeDraft(id: UUID(), openedAt: Date(timeIntervalSince1970: 10))
        _ = try sharedStore.upsertDraft(draft)
        let before = try sharedStore.loadState()
        let failingStore = try ReservationSharedStore(
            directoryURL: directory,
            beforeAtomicReplace: { throw StubError.expected }
        )

        XCTAssertThrowsError(try failingStore.transaction { $0.drafts.removeAll() })
        XCTAssertEqual(try sharedStore.loadState(), before)
    }

    func testConcurrentTransactionsDoNotLoseDrafts() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let sharedStore = try ReservationSharedStore(directoryURL: directory)
        let drafts = (0..<8).map { index in
            makeDraft(
                id: UUID(),
                openedAt: Date(timeIntervalSince1970: TimeInterval(index + 1)),
                eventID: "event-\(index)"
            )
        }
        let lock = NSLock()
        var errors: [Error] = []

        DispatchQueue.concurrentPerform(iterations: drafts.count) { index in
            do {
                _ = try sharedStore.upsertDraft(drafts[index])
            } catch {
                lock.lock()
                errors.append(error)
                lock.unlock()
            }
        }

        XCTAssertTrue(errors.isEmpty)
        XCTAssertEqual(try sharedStore.loadState().drafts.count, drafts.count)
    }

    func testMalformedStateIsPreservedAsCorruptBackup() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try Data("not-json".utf8).write(to: directory.appendingPathComponent(ReservationSharedStore.stateFileName))
        let sharedStore = try ReservationSharedStore(directoryURL: directory)

        XCTAssertThrowsError(try sharedStore.loadState())
        let files = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        XCTAssertTrue(files.contains { $0.hasPrefix("reservation-state-v1.corrupt-") })
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent(ReservationSharedStore.stateFileName).path))
    }

    @MainActor
    func testReservationStoreReloadsStateWrittenByAnotherTarget() throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let sharedStore = try ReservationSharedStore(directoryURL: directory)
        let appStore = ReservationStore(sharedStore: sharedStore, now: { Date(timeIntervalSince1970: 100) })
        let record = makeRecord()

        try sharedStore.restoreRecord(record)
        appStore.reload()

        XCTAssertEqual(appStore.records, [record])
    }

    private func makeDraft(id: UUID, openedAt: Date, eventID: String = "event") -> ReservationDraft {
        ReservationDraft(
            sessionID: id,
            eventID: eventID,
            scheduleItemID: nil,
            kind: .ticket,
            eventSnapshot: ReservationEventSnapshot(
                title: "행사", category: "ticketing", startsAt: nil, endsAt: nil,
                venueName: nil, venueAddress: nil, sourceLabel: "공식", imageURL: nil
            ),
            originalActionURL: "https://example.com/order/\(eventID)",
            providerHost: "example.com",
            openedAt: openedAt,
            expiresAt: Date(timeIntervalSince1970: 10_000),
            attemptCount: 1
        )
    }

    private func makeRecord() -> ReservationRecord {
        let now = Date(timeIntervalSince1970: 100)
        return ReservationRecord(
            id: UUID(), sourceSessionID: nil, eventID: "event", scheduleItemID: nil,
            kind: .ticket, status: .confirmed,
            eventSnapshot: ReservationEventSnapshot(
                title: "행사", category: "ticketing", startsAt: now, endsAt: nil,
                venueName: "장소", venueAddress: nil, sourceLabel: "공식", imageURL: nil
            ),
            originalActionURL: "https://example.com", reservationDetailURL: nil,
            providerHistoryURL: nil, linkSource: .appInput, displayTitleOverride: nil,
            startsAtOverride: nil, endsAtOverride: nil, venueOverride: nil, optionText: nil,
            quantity: nil, referenceNumber: nil, note: nil, openedAt: nil,
            confirmedAt: now, createdAt: now, updatedAt: now, schemaVersion: 1
        )
    }

    private func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    }

    private var encoder: JSONEncoder {
        let value = JSONEncoder()
        value.dateEncodingStrategy = .iso8601
        return value
    }

    private enum StubError: Error { case expected }
}
