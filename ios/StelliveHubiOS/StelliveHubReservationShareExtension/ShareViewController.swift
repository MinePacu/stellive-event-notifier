import UIKit
import UniformTypeIdentifiers

private enum ShareReservationError: LocalizedError {
    case sharedContainerUnavailable

    var errorDescription: String? { "예약 저장 공간을 열 수 없습니다." }
}

final class ShareViewController: UIViewController {
    private let writer = ShareReservationWriter()
    private var sharedURL: String?

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        loadSharedURL()
    }

    private func loadSharedURL() {
        let providers = extensionContext?.inputItems
            .compactMap { $0 as? NSExtensionItem }
            .flatMap { $0.attachments ?? [] } ?? []
        load(from: providers, index: 0)
    }

    private func load(from providers: [NSItemProvider], index: Int) {
        guard index < providers.count else {
            presentDraftSelection(sharedURL: nil)
            return
        }
        let provider = providers[index]
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.url.identifier) { [weak self] item, _ in
                DispatchQueue.main.async {
                    let value = (item as? URL)?.absoluteString ?? (item as? String)
                    if let url = ReservationURLPolicy.validatedURL(value) {
                        self?.presentDraftSelection(sharedURL: url.absoluteString)
                    } else {
                        self?.load(from: providers, index: index + 1)
                    }
                }
            }
            return
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { [weak self] item, _ in
                DispatchQueue.main.async {
                    if let url = ReservationURLPolicy.firstSharedHTTPSURL(in: item as? String) {
                        self?.presentDraftSelection(sharedURL: url.absoluteString)
                    } else {
                        self?.load(from: providers, index: index + 1)
                    }
                }
            }
            return
        }
        load(from: providers, index: index + 1)
    }

    private func presentDraftSelection(sharedURL: String?) {
        self.sharedURL = sharedURL
        let drafts = writer.activeDrafts()
        guard !drafts.isEmpty else {
            presentMessage(title: "진행 중인 예약이 없습니다", message: "먼저 앱에서 예매·구매 링크를 열어 주세요.")
            return
        }
        if drafts.count == 1 {
            confirm(draft: drafts[0])
            return
        }
        let alert = UIAlertController(title: "예약 대상 선택", message: "공유한 링크를 저장할 예약을 선택해 주세요.", preferredStyle: .actionSheet)
        drafts.forEach { draft in
            alert.addAction(UIAlertAction(title: draft.eventSnapshot.title, style: .default) { [weak self] _ in
                self?.confirm(draft: draft)
            })
        }
        alert.addAction(UIAlertAction(title: "취소", style: .cancel) { [weak self] _ in self?.complete() })
        if let popover = alert.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        }
        present(alert, animated: true)
    }

    private func confirm(draft: ReservationDraft, allowsSensitiveURL: Bool = false) {
        if ReservationURLPolicy.containsSensitiveQuery(sharedURL), !allowsSensitiveURL {
            let alert = UIAlertController(
                title: "민감한 링크일 수 있습니다",
                message: "인증 정보가 포함된 링크일 수 있습니다. 백업에서 제외되는 로컬 저장소에 저장할까요?",
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "저장", style: .default) { [weak self] _ in
                self?.confirm(draft: draft, allowsSensitiveURL: true)
            })
            alert.addAction(UIAlertAction(title: "취소", style: .cancel) { [weak self] _ in self?.complete() })
            present(alert, animated: true)
            return
        }
        do {
            try writer.confirm(draft: draft, detailURL: sharedURL)
            presentMessage(title: "예약에 추가했습니다", message: draft.eventSnapshot.title)
        } catch {
            presentMessage(title: "추가할 수 없습니다", message: error.localizedDescription)
        }
    }

    private func presentMessage(title: String, message: String?) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "확인", style: .default) { [weak self] _ in self?.complete() })
        present(alert, animated: true)
    }

    private func complete() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}

private struct ShareReservationWriter {
    private static let appGroupIdentifier = "group.dev.minepacu.stelliveeventnotifier"
    private let coordinator = NSFileCoordinator(filePresenter: nil)
    private let encoder: JSONEncoder = {
        let value = JSONEncoder(); value.dateEncodingStrategy = .iso8601; return value
    }()
    private let decoder: JSONDecoder = {
        let value = JSONDecoder(); value.dateDecodingStrategy = .iso8601; return value
    }()

    func activeDrafts(now: Date = Date()) -> [ReservationDraft] {
        read([ReservationDraft].self, from: draftsURL)?.filter { $0.expiresAt > now }.sorted { $0.openedAt > $1.openedAt } ?? []
    }

    func confirm(draft: ReservationDraft, detailURL: String?) throws {
        var records = read([ReservationRecord].self, from: recordsURL) ?? []
        if records.contains(where: { $0.sourceSessionID == draft.sessionID }) { return }
        var drafts = read([ReservationDraft].self, from: draftsURL) ?? []
        let now = Date()
        records.append(ReservationRecord(
            id: UUID(), sourceSessionID: draft.sessionID, eventID: draft.eventID,
            scheduleItemID: draft.scheduleItemID, kind: draft.kind, status: .confirmed,
            eventSnapshot: draft.eventSnapshot, originalActionURL: draft.originalActionURL,
            reservationDetailURL: detailURL, providerHistoryURL: nil, linkSource: .browserShare,
            displayTitleOverride: nil, startsAtOverride: nil, endsAtOverride: nil, venueOverride: nil,
            optionText: nil, quantity: nil, referenceNumber: nil, note: nil,
            openedAt: draft.openedAt, confirmedAt: now, createdAt: now, updatedAt: now, schemaVersion: 1
        ))
        drafts.removeAll { $0.sessionID == draft.sessionID }
        try write(records, to: recordsURL)
        try write(drafts, to: draftsURL)
    }

    private var directoryURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier)
    }
    private var recordsURL: URL? { directoryURL?.appendingPathComponent("reservations-v1.json") }
    private var draftsURL: URL? { directoryURL?.appendingPathComponent("reservation-drafts-v1.json") }

    private func read<Value: Decodable>(_ type: Value.Type, from url: URL?) -> Value? {
        guard let url, FileManager.default.fileExists(atPath: url.path) else { return nil }
        var error: NSError?
        var value: Value?
        coordinator.coordinate(readingItemAt: url, options: [], error: &error) { coordinatedURL in
            guard let data = try? Data(contentsOf: coordinatedURL) else { return }
            value = try? decoder.decode(type, from: data)
        }
        return value
    }

    private func write<Value: Encodable>(_ value: Value, to url: URL?) throws {
        guard let url else { throw ShareReservationError.sharedContainerUnavailable }
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
