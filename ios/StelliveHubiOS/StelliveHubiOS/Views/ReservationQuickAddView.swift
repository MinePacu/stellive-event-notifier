import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct ReservationQuickAddView: View {
    let sessionID: UUID?
    var initialURL: String? = nil
    @EnvironmentObject private var store: ReservationStore
    @Environment(\.dismiss) private var dismiss
    @State private var selectedSessionID: UUID?
    @State private var detailURL = ""
    @State private var errorMessage: String?
    @State private var requestsSensitiveConfirmation = false
    @State private var requestsDuplicateConfirmation = false
    @State private var requestsPasteResolution = false
    @State private var duplicateRecordID: UUID?
    @State private var existingRecordToOpen: UUID?

    var body: some View {
        Form {
            if store.activeDrafts.isEmpty {
                ReservationEmptyState(
                    title: "진행 중인 예약·구매 내역이 없습니다",
                    message: "앱에서 티켓·구매·예약 링크를 먼저 열어 주세요."
                )
            } else {
                Section("행사") {
                    if store.activeDrafts.count == 1, let draft = store.activeDrafts.first {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(ReservationPresentationPolicy.inProgressLabel(draft.kind))
                                .font(.subheadline.weight(.semibold))
                            Text(draft.eventSnapshot.title)
                        }
                    } else {
                        Picker("추가할 내역", selection: $selectedSessionID) {
                            Text("선택해 주세요").tag(UUID?.none)
                            ForEach(store.activeDrafts) { draft in
                                Text(draft.eventSnapshot.title).tag(Optional(draft.sessionID))
                            }
                        }
                    }
                }
                Section(selectedDraft.map { ReservationPresentationPolicy.detailLinkLabel($0.kind) } ?? "상세 링크") {
                    TextField("https://", text: $detailURL)
                        .textInputAutocapitalization(.never).keyboardType(.URL)
                    PasteButton(payloadType: String.self) { values in
                        guard let pastedURL = values.lazy.compactMap({ ReservationURLPolicy.firstSharedHTTPSURL(in: $0) }).first else {
                            requestsPasteResolution = true
                            return
                        }
                        detailURL = pastedURL.absoluteString
                    }
                    .labelStyle(.titleAndIcon)
                    .accessibilityLabel("클립보드에서 상세 내역 링크 붙여넣기")
                    Text("결제 또는 예약 완료 후 제공되는 개별 상세 페이지의 링크를 선택적으로 저장할 수 있습니다. 앱에서 완료 여부를 자동 검증하지 않습니다.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section {
                    Button("링크 없이 추가") { detailURL = ""; confirm(allowsSensitiveURL: false) }
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity)
                        .listRowBackground(Color.clear)
                    Button(selectedDraft.map { ReservationPresentationPolicy.addActionLabel($0.kind) } ?? "내역에 추가") {
                        confirm(allowsSensitiveURL: false)
                    }
                        .buttonStyle(.borderedProminent)
                        .frame(maxWidth: .infinity)
                        .listRowBackground(Color.clear)
                        .disabled(ReservationTextPolicy.nonEmpty(detailURL) == nil)
                }
            }
        }
        .navigationTitle(selectedDraft.map { ReservationPresentationPolicy.addActionLabel($0.kind) } ?? "내역에 추가")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            selectedSessionID = sessionID ?? (store.activeDrafts.count == 1 ? store.activeDrafts[0].sessionID : nil)
            detailURL = initialURL ?? ""
        }
        .alert("민감한 링크일 수 있습니다", isPresented: $requestsSensitiveConfirmation) {
            Button(String(localized: "reservation_action_save_locally")) {
                confirm(allowsSensitiveURL: true, allowsDuplicateURL: false)
            }
            Button(String(localized: "reservation_action_cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "reservation_error_sensitive_explanation"))
        }
        .alert(String(localized: "reservation_error_duplicate_title"), isPresented: $requestsDuplicateConfirmation) {
            if duplicateRecordID != nil {
                Button(String(localized: "reservation_action_view_existing")) {
                    existingRecordToOpen = duplicateRecordID
                }
            }
            Button(String(localized: "reservation_action_save_anyway")) {
                confirm(allowsSensitiveURL: true, allowsDuplicateURL: true)
            }
            Button(String(localized: "reservation_action_cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "reservation_error_duplicate_body"))
        }
        .alert(String(localized: "reservation_error_paste_title"), isPresented: $requestsPasteResolution) {
            Button(String(localized: "reservation_action_retry_paste"), action: retryPaste)
            Button(String(localized: "reservation_action_add_without_link")) {
                detailURL = ""
                confirm(allowsSensitiveURL: false)
            }
            Button(String(localized: "reservation_action_cancel"), role: .cancel) {}
        } message: {
            Text(String(localized: "reservation_error_paste_body"))
        }
        .alert("추가할 수 없습니다", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("확인") {} } message: { Text(errorMessage ?? "") }
        .navigationDestination(isPresented: Binding(
            get: { existingRecordToOpen != nil },
            set: { if !$0 { existingRecordToOpen = nil } }
        )) {
            if let id = existingRecordToOpen {
                ReservationDetailView(reservationID: id)
            }
        }
    }

    private func confirm(allowsSensitiveURL: Bool, allowsDuplicateURL: Bool = false) {
        guard let id = selectedSessionID else {
            errorMessage = String(localized: "reservation_error_select_draft")
            return
        }
        if !allowsDuplicateURL, let duplicate = store.duplicateDetailURL(detailURL) {
            duplicateRecordID = duplicate.id
            requestsDuplicateConfirmation = true
            return
        }
        do {
            _ = try store.confirm(
                sessionID: id,
                detailURL: detailURL,
                linkSource: .appInput,
                allowsSensitiveURL: allowsSensitiveURL
            )
            dismiss()
        } catch ReservationError.sensitiveURLRequiresConfirmation {
            requestsSensitiveConfirmation = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private var selectedDraft: ReservationDraft? {
        guard let selectedSessionID else { return nil }
        return store.activeDrafts.first { $0.sessionID == selectedSessionID }
    }

    private func retryPaste() {
        guard let value = UIPasteboard.general.string,
              let pastedURL = ReservationURLPolicy.firstSharedHTTPSURL(in: value) else {
            DispatchQueue.main.async { requestsPasteResolution = true }
            return
        }
        detailURL = pastedURL.absoluteString
    }
}
