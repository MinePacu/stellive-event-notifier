import SwiftUI

struct ReservationEditView: View {
    let reservationID: UUID
    @EnvironmentObject private var store: ReservationStore
    @Environment(\.dismiss) private var dismiss
    @State private var draft: ReservationRecord?
    @State private var initialRecord: ReservationRecord?
    @State private var showsDeleteConfirmation = false
    @State private var showsDetailLinkDeleteConfirmation = false
    @State private var showsDiscardConfirmation = false
    @State private var showsSensitiveConfirmation = false
    @State private var showsDuplicateConfirmation = false
    @State private var duplicateRecordID: UUID?
    @State private var existingRecordToOpen: UUID?
    @State private var errorMessage: String?

    var body: some View {
        Form {
            if let binding = Binding($draft) {
                Section("표시") {
                    TextField("행사 제목", text: optionalText(binding.displayTitleOverride))
                    Picker("상태", selection: binding.status) {
                        ForEach(ReservationStatus.allCases, id: \.self) {
                            Text(ReservationPresentationPolicy.statusLabel(kind: binding.wrappedValue.kind, status: $0)).tag($0)
                        }
                    }
                    DatePicker("시작 날짜와 시간", selection: optionalDate(binding.startsAtOverride, fallback: binding.wrappedValue.eventSnapshot.startsAt ?? Date()))
                    if let end = binding.wrappedValue.effectiveEndsAt {
                        DatePicker("종료 날짜와 시간", selection: optionalDate(binding.endsAtOverride, fallback: end))
                    }
                    TextField("장소", text: optionalText(binding.venueOverride))
                }
                Section("링크") {
                    TextField(ReservationPresentationPolicy.detailLinkLabel(binding.wrappedValue.kind), text: optionalText(binding.reservationDetailURL))
                        .textInputAutocapitalization(.never).keyboardType(.URL)
                    TextField("제공사 내역 URL", text: optionalText(binding.providerHistoryURL))
                        .textInputAutocapitalization(.never).keyboardType(.URL)
                    if let original = binding.wrappedValue.originalActionURL {
                        LabeledContent("최초 링크", value: original).lineLimit(2)
                    }
                    Button("상세 링크만 삭제", role: .destructive) {
                        showsDetailLinkDeleteConfirmation = true
                    }
                }
                Section("추가 정보") {
                    TextField("좌석 또는 상품 옵션", text: optionalText(binding.optionText))
                    TextField("수량", value: binding.quantity, format: .number).keyboardType(.numberPad)
                    TextField(ReservationPresentationPolicy.referenceNumberLabel(binding.wrappedValue.kind), text: optionalText(binding.referenceNumber))
                    TextField("메모", text: optionalText(binding.note), axis: .vertical).lineLimit(3...8)
                }
                Section {
                    Button("공식 행사 정보로 되돌리기") {
                        draft?.displayTitleOverride = draft?.eventSnapshot.title
                        draft?.startsAtOverride = draft?.eventSnapshot.startsAt
                        draft?.endsAtOverride = draft?.eventSnapshot.endsAt
                        draft?.venueOverride = draft?.eventSnapshot.venueName
                    }
                    Button("내역 삭제", role: .destructive) { showsDeleteConfirmation = true }
                }
            }
        }
        .navigationTitle("내역 수정")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(hasUnsavedChanges)
        .toolbar {
            if hasUnsavedChanges {
                ToolbarItem(placement: .cancellationAction) {
                    Button("뒤로") { showsDiscardConfirmation = true }
                }
            }
            ToolbarItem(placement: .confirmationAction) { Button("저장", action: save).disabled(draft == nil) }
        }
        .onAppear {
            let record = store.record(id: reservationID).map(ReservationEditPresentationPolicy.editableRecord)
            draft = record
            initialRecord = record
        }
        .reservationDeleteAlert(
            isPresented: $showsDeleteConfirmation,
            errorTitle: "저장할 수 없습니다",
            errorMessage: $errorMessage
        ) {
            _ = try store.delete(id: reservationID)
            dismiss()
        }
        .alert("상세 링크를 삭제할까요?", isPresented: $showsDetailLinkDeleteConfirmation) {
            Button("삭제", role: .destructive) { draft?.reservationDetailURL = nil }
            Button("취소", role: .cancel) {}
        }
        .alert("변경사항을 버릴까요?", isPresented: $showsDiscardConfirmation) {
            Button("버리기", role: .destructive) { dismiss() }
            Button("계속 수정", role: .cancel) {}
        }
        .alert("민감한 링크일 수 있습니다", isPresented: $showsSensitiveConfirmation) {
            Button(String(localized: "reservation_action_save_locally")) {
                save(allowsSensitiveURL: true, allowsDuplicateURL: false)
            }
            Button(String(localized: "reservation_action_cancel"), role: .cancel) {}
        } message: { Text(String(localized: "reservation_error_sensitive_explanation")) }
        .alert(String(localized: "reservation_error_duplicate_title"), isPresented: $showsDuplicateConfirmation) {
            if duplicateRecordID != nil {
                Button(String(localized: "reservation_action_view_existing")) {
                    existingRecordToOpen = duplicateRecordID
                }
            }
            Button(String(localized: "reservation_action_save_anyway")) {
                save(allowsSensitiveURL: true, allowsDuplicateURL: true)
            }
            Button(String(localized: "reservation_action_cancel"), role: .cancel) {}
        } message: { Text(String(localized: "reservation_error_duplicate_body")) }
        .navigationDestination(isPresented: Binding(
            get: { existingRecordToOpen != nil },
            set: { if !$0 { existingRecordToOpen = nil } }
        )) {
            if let id = existingRecordToOpen {
                ReservationDetailView(reservationID: id)
            }
        }
    }

    private var hasUnsavedChanges: Bool { draft != nil && draft != initialRecord }

    private func save() { save(allowsSensitiveURL: false, allowsDuplicateURL: false) }

    private func save(allowsSensitiveURL: Bool, allowsDuplicateURL: Bool) {
        guard var draft else { return }
        for value in [draft.reservationDetailURL, draft.providerHistoryURL] {
            if ReservationTextPolicy.nonEmpty(value) != nil, ReservationURLPolicy.validatedURL(value) == nil {
                errorMessage = ReservationError.invalidURL.localizedDescription
                return
            }
        }
        if let quantity = draft.quantity, quantity <= 0 {
            errorMessage = String(localized: "reservation_error_quantity")
            return
        }
        if let startsAt = draft.startsAtOverride,
           let endsAt = draft.endsAtOverride,
           endsAt <= startsAt {
            errorMessage = String(localized: "reservation_error_end_time")
            return
        }
        if !allowsSensitiveURL && [draft.reservationDetailURL, draft.providerHistoryURL].contains(where: ReservationURLPolicy.containsSensitiveQuery) {
            showsSensitiveConfirmation = true
            return
        }
        if !allowsDuplicateURL,
           let duplicate = store.duplicateDetailURL(draft.reservationDetailURL, excluding: draft.id) {
            duplicateRecordID = duplicate.id
            showsDuplicateConfirmation = true
            return
        }
        draft = ReservationEditPresentationPolicy.normalizedRecord(draft)
        draft.optionText = ReservationTextPolicy.nonEmpty(draft.optionText)
        draft.referenceNumber = ReservationTextPolicy.nonEmpty(draft.referenceNumber)
        draft.note = ReservationTextPolicy.nonEmpty(draft.note)
        do {
            try store.update(draft)
            initialRecord = draft
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func optionalText(_ binding: Binding<String?>) -> Binding<String> {
        Binding(get: { binding.wrappedValue ?? "" }, set: { binding.wrappedValue = $0 })
    }

    private func optionalDate(_ binding: Binding<Date?>, fallback: Date) -> Binding<Date> {
        Binding(get: { binding.wrappedValue ?? fallback }, set: { binding.wrappedValue = $0 })
    }
}
