import SwiftUI
import UniformTypeIdentifiers

enum ReservationRoute: Hashable {
    case list
    case detail(UUID)
    case edit(UUID)
    case quickAdd(sessionID: UUID?)
}

struct ReservationSummaryCard: View {
    @EnvironmentObject private var store: ReservationStore

    var body: some View {
        NavigationLink(value: ReservationRoute.list) {
            HStack(spacing: 14) {
                Image(systemName: "ticket")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.teal)
                    .frame(width: 42, height: 42)
                    .background(Color.teal.opacity(0.12), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text("내 예약·구매")
                        .font(.headline)
                    Text(summary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 5)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("내 예약 및 구매, \(summary)")
    }

    private var summary: String {
        let pending = store.pendingCount
        let upcoming = store.upcomingRecords.count
        if let date = store.upcomingRecords.first?.effectiveStartsAt {
            return "확인 필요 \(pending)개 · 다가오는 예약 \(upcoming)개 · \(date.formatted(.dateTime.month().day()))"
        }
        return "확인 필요 \(pending)개 · 다가오는 예약 \(upcoming)개"
    }
}

struct ReservationsView: View {
    @EnvironmentObject private var store: ReservationStore
    @State private var errorMessage: String?

    var body: some View {
        List {
            if !store.activeDrafts.isEmpty {
                Section("확인 필요") {
                    ForEach(store.activeDrafts) { draft in
                        NavigationLink(value: ReservationRoute.quickAdd(sessionID: draft.sessionID)) {
                            ReservationDraftRow(draft: draft)
                        }
                    }
                }
            }
            if !store.upcomingRecords.isEmpty {
                Section("다가오는 예약") {
                    ForEach(store.upcomingRecords) { record in
                        NavigationLink(value: ReservationRoute.detail(record.id)) {
                            ReservationRecordRow(record: record)
                        }
                    }
                }
            }
            if !store.pastRecords.isEmpty {
                Section("지난 내역") {
                    ForEach(store.pastRecords) { record in
                        NavigationLink(value: ReservationRoute.detail(record.id)) {
                            ReservationRecordRow(record: record)
                        }
                    }
                }
            }
            if store.activeDrafts.isEmpty && store.records.isEmpty {
                ReservationEmptyState(
                    title: "저장된 예약이 없습니다",
                    message: "굿즈·행사의 티켓, 구매 또는 예약 링크를 열면 여기에서 완료 내역을 추가할 수 있습니다."
                )
                .listRowBackground(Color.clear)
            }
        }
        .navigationTitle("내 예약·구매")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if let deleted = store.lastDeletedRecord {
                HStack(spacing: 12) {
                    Text("예약을 삭제했습니다.").font(.subheadline)
                    Spacer()
                    Button("실행 취소") {
                        do { try store.restore(deleted) } catch { errorMessage = error.localizedDescription }
                    }
                    .font(.subheadline.weight(.semibold))
                    Button { store.clearDeletedRecord() } label: {
                        Image(systemName: "xmark").frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("삭제 안내 닫기")
                }
                .padding(.leading, 16)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .padding(.horizontal, 12)
            }
        }
        .alert("처리할 수 없습니다", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("확인") {} } message: { Text(errorMessage ?? "") }
    }
}

private struct ReservationDraftRow: View {
    let draft: ReservationDraft

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(draft.eventSnapshot.title).font(.headline)
            Text("확인 필요 · \(draft.providerHost)")
                .font(.subheadline)
                .foregroundStyle(.orange)
            Text("\(draft.openedAt.formatted(date: .abbreviated, time: .shortened))에 링크를 열었습니다.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 3)
    }
}

private struct ReservationRecordRow: View {
    let record: ReservationRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(record.displayTitle).font(.headline)
            Text([record.status.displayName, record.eventSnapshot.sourceLabel].joined(separator: " · "))
                .font(.subheadline)
                .foregroundStyle(record.status == .confirmed ? Color.teal : Color.secondary)
            if let date = record.effectiveStartsAt {
                Text(date.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if record.reservationDetailURL != nil {
                Label("예약 상세 링크 있음", systemImage: "link")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 3)
    }
}

struct ReservationDetailView: View {
    let reservationID: UUID
    @EnvironmentObject private var store: ReservationStore
    @EnvironmentObject private var serverStore: ServerHubStore
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @State private var showsDeleteConfirmation = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let record = store.record(id: reservationID) {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(record.displayTitle).font(.title3.bold())
                            Text(record.status.displayName)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.teal)
                            if let date = record.effectiveStartsAt {
                                Label(date.formatted(date: .long, time: .shortened), systemImage: "calendar")
                            }
                            if let venue = record.effectiveVenue {
                                Label(venue, systemImage: "mappin.and.ellipse")
                            }
                            if ReservationDisplayPolicy.officialEventChanged(record: record, latestEvent: latestEvent(for: record)) {
                                Label("공식 일정 변경됨", systemImage: "exclamationmark.triangle")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.orange)
                            }
                            if latestEvent(for: record)?.status == .cancelled {
                                Text("공식 행사가 취소되었습니다. 사용자의 예약 상태는 자동으로 변경하지 않습니다.")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            }
                        }
                        .padding(.vertical, 6)
                    }
                    if record.preferredURL != nil {
                        Section {
                            Button("예약 열기", systemImage: "arrow.up.right") {
                                if let url = record.preferredURL { openURL(url) }
                            }
                        }
                    }
                    Section("예약 정보") {
                        detailRow("종류", record.kind.displayName)
                        detailRow("수량", record.quantity.map(String.init))
                        detailRow("옵션", record.optionText)
                        detailRow("예약번호", record.referenceNumber)
                        detailRow("메모", record.note)
                    }
                    Section("처음 기록한 정보") {
                        detailRow("출처", record.eventSnapshot.sourceLabel)
                        detailRow("연결 행사", record.eventID)
                        detailRow("연결 일정", record.scheduleItemID)
                        detailRow("추가일", record.createdAt.formatted(date: .abbreviated, time: .shortened))
                    }
                    Section {
                        NavigationLink("수정", value: ReservationRoute.edit(record.id))
                        Button("예약 삭제", role: .destructive) { showsDeleteConfirmation = true }
                    }
                }
            } else {
                ReservationEmptyState(title: "예약을 찾을 수 없습니다", message: nil)
            }
        }
        .navigationTitle("예약 상세")
        .navigationBarTitleDisplayMode(.inline)
        .alert("예약을 삭제할까요?", isPresented: $showsDeleteConfirmation) {
            Button("삭제", role: .destructive) {
                do { _ = try store.delete(id: reservationID); dismiss() }
                catch { errorMessage = error.localizedDescription }
            }
            Button("취소", role: .cancel) {}
        }
        .alert("삭제할 수 없습니다", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("확인") {} } message: { Text(errorMessage ?? "") }
        .onChange(of: store.records) { records in
            if !records.contains(where: { $0.id == reservationID }) { dismiss() }
        }
    }

    private func latestEvent(for record: ReservationRecord) -> HubEvent? {
        guard let eventID = record.eventID else { return nil }
        return serverStore.cachedHubEvent(id: eventID)
    }

    @ViewBuilder
    private func detailRow(_ title: String, _ value: String?) -> some View {
        if let value = ReservationTextPolicy.nonEmpty(value) {
            LabeledContent(title, value: value)
        }
    }
}

struct ReservationEditView: View {
    let reservationID: UUID
    @EnvironmentObject private var store: ReservationStore
    @Environment(\.dismiss) private var dismiss
    @State private var draft: ReservationRecord?
    @State private var initialRecord: ReservationRecord?
    @State private var showsDeleteConfirmation = false
    @State private var showsDiscardConfirmation = false
    @State private var showsSensitiveConfirmation = false
    @State private var showsDuplicateConfirmation = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            if let binding = Binding($draft) {
                Section("표시") {
                    TextField("행사 제목", text: optionalText(binding.displayTitleOverride))
                    Picker("상태", selection: binding.status) {
                        ForEach(ReservationStatus.allCases, id: \.self) { Text($0.displayName).tag($0) }
                    }
                    DatePicker("날짜와 시간", selection: optionalDate(binding.startsAtOverride, fallback: binding.wrappedValue.eventSnapshot.startsAt ?? Date()))
                    TextField("장소", text: optionalText(binding.venueOverride))
                }
                Section("링크") {
                    TextField("예약 상세 URL", text: optionalText(binding.reservationDetailURL))
                        .textInputAutocapitalization(.never).keyboardType(.URL)
                    TextField("제공사 내역 URL", text: optionalText(binding.providerHistoryURL))
                        .textInputAutocapitalization(.never).keyboardType(.URL)
                    if let original = binding.wrappedValue.originalActionURL {
                        LabeledContent("최초 링크", value: original).lineLimit(2)
                    }
                    Button("예약 링크만 삭제") {
                        draft?.reservationDetailURL = nil
                        draft?.providerHistoryURL = nil
                    }
                }
                Section("추가 정보") {
                    TextField("좌석 또는 상품 옵션", text: optionalText(binding.optionText))
                    TextField("수량", value: binding.quantity, format: .number).keyboardType(.numberPad)
                    TextField("예약번호", text: optionalText(binding.referenceNumber))
                    TextField("메모", text: optionalText(binding.note), axis: .vertical).lineLimit(3...8)
                }
                Section {
                    Button("공식 행사 정보로 되돌리기") {
                        draft?.displayTitleOverride = nil
                        draft?.startsAtOverride = nil
                        draft?.endsAtOverride = nil
                        draft?.venueOverride = nil
                    }
                    Button("예약 삭제", role: .destructive) { showsDeleteConfirmation = true }
                }
            }
        }
        .navigationTitle("예약 수정")
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
            let record = store.record(id: reservationID)
            draft = record
            initialRecord = record
        }
        .alert("예약을 삭제할까요?", isPresented: $showsDeleteConfirmation) {
            Button("삭제", role: .destructive) {
                do { _ = try store.delete(id: reservationID); dismiss() }
                catch { errorMessage = error.localizedDescription }
            }
            Button("취소", role: .cancel) {}
        }
        .alert("변경사항을 버릴까요?", isPresented: $showsDiscardConfirmation) {
            Button("버리기", role: .destructive) { dismiss() }
            Button("계속 수정", role: .cancel) {}
        }
        .alert("민감한 링크일 수 있습니다", isPresented: $showsSensitiveConfirmation) {
            Button("로컬에 저장") { save(allowsSensitiveURL: true, allowsDuplicateURL: false) }
            Button("취소", role: .cancel) {}
        } message: { Text("인증 정보가 포함될 수 있습니다. 이 기기에만 저장하며 백업 대상에서는 제외합니다.") }
        .alert("같은 링크가 이미 있습니다", isPresented: $showsDuplicateConfirmation) {
            Button("그래도 저장") { save(allowsSensitiveURL: true, allowsDuplicateURL: true) }
            Button("취소", role: .cancel) {}
        } message: { Text("다른 예약에 같은 상세 링크가 연결되어 있습니다.") }
        .alert("저장할 수 없습니다", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("확인") {} } message: { Text(errorMessage ?? "") }
    }

    private var hasUnsavedChanges: Bool { draft != nil && draft != initialRecord }

    private func save() { save(allowsSensitiveURL: false, allowsDuplicateURL: false) }

    private func save(allowsSensitiveURL: Bool, allowsDuplicateURL: Bool) {
        guard var draft else { return }
        for value in [draft.reservationDetailURL, draft.providerHistoryURL] {
            if ReservationTextPolicy.nonEmpty(value) != nil, ReservationURLPolicy.validatedURL(value) == nil {
                errorMessage = ReservationStoreError.invalidURL.localizedDescription
                return
            }
        }
        if let quantity = draft.quantity, quantity <= 0 {
            errorMessage = "수량은 1 이상으로 입력해 주세요."
            return
        }
        if !allowsSensitiveURL && [draft.reservationDetailURL, draft.providerHistoryURL].contains(where: ReservationURLPolicy.containsSensitiveQuery) {
            showsSensitiveConfirmation = true
            return
        }
        if !allowsDuplicateURL, store.duplicateDetailURL(draft.reservationDetailURL, excluding: draft.id) != nil {
            showsDuplicateConfirmation = true
            return
        }
        draft.displayTitleOverride = ReservationTextPolicy.nonEmpty(draft.displayTitleOverride)
        draft.venueOverride = ReservationTextPolicy.nonEmpty(draft.venueOverride)
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

    var body: some View {
        Form {
            if store.activeDrafts.isEmpty {
                ReservationEmptyState(
                    title: "진행 중인 예약이 없습니다",
                    message: "앱에서 예매 링크를 먼저 열어 주세요."
                )
            } else {
                Section("행사") {
                    if store.activeDrafts.count == 1, let draft = store.activeDrafts.first {
                        Text(draft.eventSnapshot.title)
                    } else {
                        Picker("예약 대상", selection: $selectedSessionID) {
                            Text("선택해 주세요").tag(UUID?.none)
                            ForEach(store.activeDrafts) { draft in
                                Text(draft.eventSnapshot.title).tag(Optional(draft.sessionID))
                            }
                        }
                    }
                }
                Section("예약 상세 링크") {
                    TextField("https://", text: $detailURL)
                        .textInputAutocapitalization(.never).keyboardType(.URL)
                    PasteButton(payloadType: String.self) { values in
                        guard let pastedURL = values.lazy.compactMap({ ReservationURLPolicy.firstSharedHTTPSURL(in: $0) }).first else {
                            errorMessage = "클립보드에서 유효한 HTTPS 링크를 찾지 못했습니다."
                            return
                        }
                        detailURL = pastedURL.absoluteString
                    }
                    .labelStyle(.titleAndIcon)
                    .accessibilityLabel("클립보드에서 예약 상세 링크 붙여넣기")
                    Text("결제 완료 또는 개별 예약 상세 페이지의 링크를 선택적으로 저장할 수 있습니다.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section {
                    Button("링크 없이 추가") { detailURL = ""; confirm(allowsSensitiveURL: false) }
                    Button("예약에 추가") { confirm(allowsSensitiveURL: false) }
                        .disabled(ReservationTextPolicy.nonEmpty(detailURL) == nil)
                }
            }
        }
        .navigationTitle("예약 완료로 추가")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            selectedSessionID = sessionID ?? (store.activeDrafts.count == 1 ? store.activeDrafts[0].sessionID : nil)
            detailURL = initialURL ?? ""
        }
        .alert("민감한 링크일 수 있습니다", isPresented: $requestsSensitiveConfirmation) {
            Button("로컬에 저장") { confirm(allowsSensitiveURL: true, allowsDuplicateURL: false) }
            Button("취소", role: .cancel) {}
        } message: {
            Text("인증 정보가 포함된 링크일 수 있습니다. 이 기기에만 저장하며 백업 대상에서는 제외합니다.")
        }
        .alert("같은 링크가 이미 있습니다", isPresented: $requestsDuplicateConfirmation) {
            Button("그래도 저장") { confirm(allowsSensitiveURL: true, allowsDuplicateURL: true) }
            Button("취소", role: .cancel) {}
        } message: {
            Text("다른 예약에 같은 상세 링크가 연결되어 있습니다.")
        }
        .alert("추가할 수 없습니다", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("확인") {} } message: { Text(errorMessage ?? "") }
    }

    private func confirm(allowsSensitiveURL: Bool, allowsDuplicateURL: Bool = false) {
        guard let id = selectedSessionID else {
            errorMessage = "예약 대상을 선택해 주세요."
            return
        }
        if !allowsDuplicateURL, store.duplicateDetailURL(detailURL) != nil {
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
        } catch ReservationStoreError.sensitiveURLRequiresConfirmation {
            requestsSensitiveConfirmation = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ReservationEmptyState: View {
    let title: String
    let message: String?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "ticket").font(.title).foregroundStyle(.secondary)
            Text(title).font(.headline)
            if let message {
                Text(message).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
}
