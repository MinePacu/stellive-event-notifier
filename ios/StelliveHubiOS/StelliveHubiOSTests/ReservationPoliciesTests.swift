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

    func testRecordedInformationUsesHumanReadableEventValuesInsteadOfInternalIDs() {
        let record = makeRecord(scheduleItemID: "internal-schedule-id")

        XCTAssertEqual(ReservationDisplayPolicy.linkedEventTitle(record: record), "행사")
        XCTAssertEqual(
            ReservationDisplayPolicy.linkedScheduleLabel(
                record: record,
                format: { "schedule:\($0.timeIntervalSince1970)" }
            ),
            "schedule:100.0"
        )
        XCTAssertNotEqual(ReservationDisplayPolicy.linkedEventTitle(record: record), record.eventID)
        XCTAssertNotEqual(
            ReservationDisplayPolicy.linkedScheduleLabel(record: record, format: { _ in "일정" }),
            record.scheduleItemID
        )
    }

    func testPresentationPolicyCoversEveryKindAndStatus() {
        let expected: [ReservationKind: [String]] = [
            .ticket: ["확인 필요", "예매 완료", "예매 취소", "환불 완료", "이용 완료"],
            .purchase: ["확인 필요", "구매 완료", "구매 취소", "환불 완료", "처리 완료"],
            .reservation: ["확인 필요", "예약 완료", "예약 취소", "환불 완료", "이용 완료"]
        ]
        for kind in ReservationKind.allCases {
            XCTAssertEqual(
                ReservationStatus.allCases.map { ReservationPresentationPolicy.statusLabel(kind: kind, status: $0) },
                expected[kind]
            )
        }
        XCTAssertNotEqual(ReservationPresentationPolicy.statusLabel(kind: .purchase, status: .completed), "이용 완료")
        XCTAssertNotEqual(ReservationPresentationPolicy.statusLabel(kind: .purchase, status: .completed), "배송 완료")
    }

    func testPresentationPolicyUsesKindSpecificActionsAndFields() {
        XCTAssertEqual(ReservationPresentationPolicy.addActionLabel(.ticket), "예매 내역에 추가")
        XCTAssertEqual(ReservationPresentationPolicy.addActionLabel(.purchase), "구매 내역에 추가")
        XCTAssertEqual(ReservationPresentationPolicy.addActionLabel(.reservation), "예약 내역에 추가")
        XCTAssertEqual(ReservationPresentationPolicy.detailLinkLabel(.ticket), "예매 상세 링크")
        XCTAssertEqual(ReservationPresentationPolicy.detailLinkLabel(.purchase), "구매 상세 링크")
        XCTAssertEqual(ReservationPresentationPolicy.detailLinkLabel(.reservation), "예약 상세 링크")
        XCTAssertEqual(ReservationPresentationPolicy.referenceNumberLabel(.ticket), "예매번호")
        XCTAssertEqual(ReservationPresentationPolicy.referenceNumberLabel(.purchase), "주문번호")
        XCTAssertEqual(ReservationPresentationPolicy.referenceNumberLabel(.reservation), "예약번호")
    }

    func testPastListUsesSavedTimeWhileUpcomingUsesScheduledTime() {
        var record = makeRecord()
        let scheduledAt = Date(timeIntervalSince1970: 1_000)
        record.startsAtOverride = scheduledAt

        XCTAssertEqual(
            ReservationListPresentationPolicy.timestampLabel(
                record: record,
                section: .upcoming,
                format: { "scheduled:\($0.timeIntervalSince1970)" }
            ),
            "scheduled:1000.0"
        )
        XCTAssertEqual(
            ReservationListPresentationPolicy.timestampLabel(
                record: record,
                section: .past,
                format: { "saved:\($0.timeIntervalSince1970)" }
            ),
            "저장 시각 · saved:100.0"
        )
    }

    func testEditPresentationPrefillsValuesFromStoredRecordAndEventSnapshot() {
        let end = Date(timeIntervalSince1970: 200)
        let base = makeRecord(eventEndsAt: end)

        let inherited = ReservationEditPresentationPolicy.initialValues(record: base)
        XCTAssertEqual(inherited.title, "행사")
        XCTAssertEqual(inherited.startsAt, Date(timeIntervalSince1970: 100))
        XCTAssertEqual(inherited.endsAt, end)
        XCTAssertEqual(inherited.venue, "장소")

        var overridden = base
        overridden.displayTitleOverride = "내 행사"
        overridden.startsAtOverride = Date(timeIntervalSince1970: 300)
        overridden.endsAtOverride = Date(timeIntervalSince1970: 400)
        overridden.venueOverride = "변경 장소"
        XCTAssertEqual(
            ReservationEditPresentationPolicy.initialValues(record: overridden),
            ReservationEditInitialValues(
                title: "내 행사",
                startsAt: Date(timeIntervalSince1970: 300),
                endsAt: Date(timeIntervalSince1970: 400),
                venue: "변경 장소"
            )
        )
    }

    func testEditPresentationAvoidsSavingDuplicateEventOverrides() {
        let end = Date(timeIntervalSince1970: 200)
        let base = makeRecord(eventEndsAt: end)
        let editable = ReservationEditPresentationPolicy.editableRecord(base)

        let inherited = ReservationEditPresentationPolicy.normalizedRecord(editable)
        XCTAssertNil(inherited.displayTitleOverride)
        XCTAssertNil(inherited.startsAtOverride)
        XCTAssertNil(inherited.endsAtOverride)
        XCTAssertNil(inherited.venueOverride)

        var changed = editable
        changed.displayTitleOverride = "수정 제목"
        changed.startsAtOverride = Date(timeIntervalSince1970: 300)
        changed.endsAtOverride = Date(timeIntervalSince1970: 400)
        changed.venueOverride = "수정 장소"
        let normalized = ReservationEditPresentationPolicy.normalizedRecord(changed)
        XCTAssertEqual(normalized.displayTitleOverride, "수정 제목")
        XCTAssertEqual(normalized.startsAtOverride, Date(timeIntervalSince1970: 300))
        XCTAssertEqual(normalized.endsAtOverride, Date(timeIntervalSince1970: 400))
        XCTAssertEqual(normalized.venueOverride, "수정 장소")
    }

    func testReservationHelpContentIsContextualForListAndDetail() {
        let list = ReservationHelpPolicy.content(.list)
        let detail = ReservationHelpPolicy.content(.detail)

        XCTAssertEqual(list.title, "내 예약·구매 도움말")
        XCTAssertTrue(list.sections.contains { $0.title == "확인 필요" })
        XCTAssertTrue(list.sections.contains { $0.title == "예정된 내역과 지난 내역" })
        XCTAssertEqual(detail.title, "내역 상세 도움말")
        XCTAssertTrue(detail.sections.contains { $0.title == "내역 링크" })
        XCTAssertTrue(detail.sections.contains { $0.title == "내역 삭제" })
    }

    func testSystemShortcutLabelsUseDraftCountAndKind() {
        let ticket = makeDraft(id: UUID(), openedAt: .distantPast, kind: .ticket)
        let purchase = makeDraft(id: UUID(), openedAt: .distantPast, kind: .purchase)
        let reservation = makeDraft(id: UUID(), openedAt: .distantPast, kind: .reservation)
        XCTAssertEqual(ReservationPresentationPolicy.systemShortcutLabel([]), "진행 중인 내역 없음")
        XCTAssertEqual(ReservationPresentationPolicy.systemShortcutLabel([ticket]), "예매 내역 추가")
        XCTAssertEqual(ReservationPresentationPolicy.systemShortcutLabel([purchase]), "구매 내역 추가")
        XCTAssertEqual(ReservationPresentationPolicy.systemShortcutLabel([reservation]), "예약 내역 추가")
        XCTAssertEqual(ReservationPresentationPolicy.systemShortcutLabel([ticket, purchase, reservation]), "진행 내역 3건 확인")
    }

    func testPersistedEnumRawValuesRemainStable() {
        XCTAssertEqual(ReservationKind.allCases.map(\.rawValue), ["ticket", "purchase", "reservation"])
        XCTAssertEqual(
            ReservationStatus.allCases.map(\.rawValue),
            ["pendingConfirmation", "confirmed", "cancelled", "refunded", "completed"]
        )
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

    private func makeDraft(
        id: UUID,
        openedAt: Date,
        eventID: String = "event",
        kind: ReservationKind = .ticket
    ) -> ReservationDraft {
        ReservationDraft(
            sessionID: id,
            eventID: eventID,
            scheduleItemID: nil,
            kind: kind,
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

    private func makeRecord(
        eventEndsAt: Date? = nil,
        scheduleItemID: String? = nil
    ) -> ReservationRecord {
        let now = Date(timeIntervalSince1970: 100)
        return ReservationRecord(
            id: UUID(), sourceSessionID: nil, eventID: "event", scheduleItemID: scheduleItemID,
            kind: .ticket, status: .confirmed,
            eventSnapshot: ReservationEventSnapshot(
                title: "행사", category: "ticketing", startsAt: now, endsAt: eventEndsAt,
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
