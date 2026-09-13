import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let sharedStore = try? ReservationSharedStore()
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
        let drafts: [ReservationDraft]
        do {
            guard let sharedStore else { throw ReservationError.sharedContainerUnavailable }
            drafts = ReservationDraftPolicy.active(try sharedStore.loadState().drafts)
        } catch {
            presentMessage(title: "내역을 불러올 수 없습니다", message: error.localizedDescription)
            return
        }
        guard !drafts.isEmpty else {
            presentMessage(title: "진행 중인 예약·구매 내역이 없습니다", message: "먼저 앱에서 티켓·구매·예약 링크를 열어 주세요.")
            return
        }
        if drafts.count == 1 {
            confirm(draft: drafts[0])
            return
        }
        let alert = UIAlertController(title: "추가할 내역 선택", message: "공유한 링크를 저장할 내역을 선택해 주세요.", preferredStyle: .actionSheet)
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

    private func confirm(
        draft: ReservationDraft,
        allowsSensitiveURL: Bool = false,
        allowsDuplicateURL: Bool = false
    ) {
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
        if !allowsDuplicateURL,
           let sharedURL,
           let sharedStore,
           let state = try? sharedStore.loadState(),
           state.records.contains(where: { $0.reservationDetailURL == sharedURL }) {
            let alert = UIAlertController(
                title: "같은 링크가 이미 있습니다",
                message: "다른 내역에 같은 상세 링크가 연결되어 있습니다. 그래도 저장할까요?",
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "그래도 저장", style: .default) { [weak self] _ in
                self?.confirm(draft: draft, allowsSensitiveURL: true, allowsDuplicateURL: true)
            })
            alert.addAction(UIAlertAction(title: "취소", style: .cancel) { [weak self] _ in self?.complete() })
            present(alert, animated: true)
            return
        }
        do {
            guard let sharedStore else { throw ReservationError.sharedContainerUnavailable }
            _ = try sharedStore.confirm(
                sessionID: draft.sessionID,
                detailURL: sharedURL,
                linkSource: .browserShare,
                now: Date()
            )
            presentMessage(
                title: "\(ReservationPresentationPolicy.addActionLabel(draft.kind))했습니다",
                message: draft.eventSnapshot.title
            )
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
