import SwiftUI
import UIKit
import UniformTypeIdentifiers

private enum ReservationHelpListFocus: String {
    case pending
    case upcoming
}

private extension Notification.Name {
    static let reservationHelpListFocusRequested = Notification.Name("reservationHelpListFocusRequested")
}

enum ReservationRoute: Hashable {
    case list
    case detail(UUID)
    case edit(UUID)
    case quickAdd(sessionID: UUID?)
    case listHelp
    case detailHelp(UUID)
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
            return "확인 필요 \(pending)개 · 예정된 내역 \(upcoming)개 · \(date.formatted(.dateTime.month().day()))"
        }
        return "확인 필요 \(pending)개 · 예정된 내역 \(upcoming)개"
    }
}

struct ReservationsView: View {
    @EnvironmentObject private var store: ReservationStore
    @State private var errorMessage: String?

    var body: some View {
        ScrollViewReader { proxy in
            List {
                if !store.activeDrafts.isEmpty {
                    Section("확인 필요") {
                        ForEach(store.activeDrafts) { draft in
                            NavigationLink(value: ReservationRoute.quickAdd(sessionID: draft.sessionID)) {
                                ReservationDraftRow(draft: draft)
                            }
                        }
                    }
                    .id(ReservationHelpListFocus.pending.rawValue)
                }
                if !store.upcomingRecords.isEmpty {
                    Section("예정된 내역") {
                        ForEach(store.upcomingRecords) { record in
                            NavigationLink(value: ReservationRoute.detail(record.id)) {
                                ReservationRecordRow(record: record, section: .upcoming)
                            }
                        }
                    }
                    .id(ReservationHelpListFocus.upcoming.rawValue)
                }
                if !store.pastRecords.isEmpty {
                    Section("지난 내역") {
                        ForEach(store.pastRecords) { record in
                            NavigationLink(value: ReservationRoute.detail(record.id)) {
                                ReservationRecordRow(record: record, section: .past)
                            }
                        }
                    }
                }
                if store.activeDrafts.isEmpty && store.records.isEmpty {
                    ReservationEmptyState(
                        title: "저장된 내역이 없습니다",
                        message: "굿즈·행사의 티켓, 구매 또는 예약 링크를 열면 여기에서 완료 내역을 추가할 수 있습니다."
                    )
                    .listRowBackground(Color.clear)
                    NavigationLink(value: ReservationRoute.listHelp) {
                        Label("사용 방법 보기", systemImage: "questionmark.circle")
                            .font(.body.weight(.semibold))
                    }
                    .accessibilityLabel("내 예약 및 구매 사용 방법 보기")
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .reservationHelpListFocusRequested)) { note in
                guard let target = note.object as? String else { return }
                withAnimation { proxy.scrollTo(target, anchor: .top) }
            }
        }
        .navigationTitle("내 예약·구매")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                NavigationLink(value: ReservationRoute.listHelp) {
                    Image(systemName: "questionmark.circle")
                }
                .accessibilityLabel("내 예약 및 구매 도움말")
            }
        }
        .safeAreaInset(edge: .bottom) {
            if let deleted = store.lastDeletedRecord {
                HStack(spacing: 12) {
                    Text("내역을 삭제했습니다.").font(.subheadline)
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
            Text("\(ReservationPresentationPolicy.inProgressLabel(draft.kind)) · \(draft.providerHost)")
                .font(.subheadline)
                .foregroundStyle(.orange)
            Text("\(draft.openedAt.formatted(date: .abbreviated, time: .shortened))에 링크를 열었습니다.")
                .font(.caption)
                .foregroundStyle(.secondary)
            if let expiry = ReservationDraftExpiryPresentationPolicy.presentation(expiresAt: draft.expiresAt) {
                Label(expiry.localizedText, systemImage: "clock")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
            }
        }
        .padding(.vertical, 3)
    }
}

private struct ReservationRecordRow: View {
    let record: ReservationRecord
    let section: ReservationListSectionKind

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(record.displayTitle).font(.headline)
            Text([ReservationPresentationPolicy.statusLabel(kind: record.kind, status: record.status), record.eventSnapshot.sourceLabel].joined(separator: " · "))
                .font(.subheadline)
                .foregroundStyle(record.status == .confirmed ? Color.teal : Color.secondary)
            if let timestampLabel = ReservationListPresentationPolicy.timestampLabel(
                record: record,
                section: section,
                format: { $0.formatted(date: .abbreviated, time: .shortened) }
            ) {
                Text(timestampLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if record.reservationDetailURL != nil {
                Label("\(ReservationPresentationPolicy.detailLinkLabel(record.kind)) 있음", systemImage: "link")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 3)
    }
}

private extension View {
    /// Shared delete-confirmation + error-alert pair used by reservation detail/edit screens.
    /// Presents "내역을 삭제할까요?" with 삭제/취소 actions; on 삭제 runs `onDelete`, and on
    /// failure surfaces `errorTitle` with the thrown error's localized description.
    func reservationDeleteAlert(
        isPresented: Binding<Bool>,
        errorTitle: String,
        errorMessage: Binding<String?>,
        onDelete: @escaping () throws -> Void
    ) -> some View {
        self
            .alert("내역을 삭제할까요?", isPresented: isPresented) {
                Button("삭제", role: .destructive) {
                    do { try onDelete() }
                    catch { errorMessage.wrappedValue = error.localizedDescription }
                }
                Button("취소", role: .cancel) {}
            }
            .alert(errorTitle, isPresented: Binding(
                get: { errorMessage.wrappedValue != nil },
                set: { if !$0 { errorMessage.wrappedValue = nil } }
            )) {
                Button("확인") {}
            } message: {
                Text(errorMessage.wrappedValue ?? "")
            }
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
                            Text(ReservationPresentationPolicy.statusLabel(kind: record.kind, status: record.status))
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
                                Text("공식 행사가 취소되었습니다. 사용자의 내역 상태는 자동으로 변경하지 않습니다.")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            }
                        }
                        .padding(.vertical, 6)
                    }
                    if record.preferredURL != nil {
                        Section {
                            Button("내역 링크 열기", systemImage: "arrow.up.right") {
                                if let url = record.preferredURL { openURL(url) }
                            }
                        }
                    }
                    Section("내역 정보") {
                        detailRow("종류", ReservationPresentationPolicy.kindLabel(record.kind))
                        detailRow("수량", record.quantity.map(String.init))
                        detailRow("옵션", record.optionText)
                        detailRow(ReservationPresentationPolicy.referenceNumberLabel(record.kind), record.referenceNumber)
                        detailRow("메모", record.note)
                    }
                    Section("처음 기록한 정보") {
                        detailRow("출처", record.eventSnapshot.sourceLabel)
                        detailRow("연결 행사", ReservationDisplayPolicy.linkedEventTitle(record: record))
                        detailRow(
                            "연결 일정",
                            ReservationDisplayPolicy.linkedScheduleLabel(
                                record: record,
                                format: { $0.formatted(date: .abbreviated, time: .shortened) }
                            )
                        )
                        detailRow("추가일", record.createdAt.formatted(date: .abbreviated, time: .shortened))
                    }
                    Section {
                        NavigationLink("수정", value: ReservationRoute.edit(record.id))
                        Button("내역 삭제", role: .destructive) { showsDeleteConfirmation = true }
                    }
                }
            } else {
                ReservationEmptyState(title: "내역을 찾을 수 없습니다", message: nil)
            }
        }
        .navigationTitle("내역 상세")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                NavigationLink(value: ReservationRoute.detailHelp(reservationID)) {
                    Image(systemName: "questionmark.circle")
                }
                .accessibilityLabel("내역 상세 도움말")
            }
        }
        .reservationDeleteAlert(
            isPresented: $showsDeleteConfirmation,
            errorTitle: "삭제할 수 없습니다",
            errorMessage: $errorMessage
        ) {
            _ = try store.delete(id: reservationID)
            dismiss()
        }
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

struct ReservationHelpView: View {
    let page: ReservationHelpPage
    var currentRecordID: UUID? = nil
    var existingRecordID: UUID? = nil
    @EnvironmentObject private var store: ReservationStore
    @Environment(\.dismiss) private var dismiss
    @State private var expandedFAQIDs: Set<ReservationHelpFAQID> = []

    var body: some View {
        let context = ReservationHelpContextPolicy.context(
            drafts: store.activeDrafts,
            records: store.records,
            currentRecordID: currentRecordID,
            existingRecordID: existingRecordID
        )
        let presentation = ReservationHelpPolicy.presentation(page, context: context)
        let content = presentation.content
        List {
            if let status = presentation.status, status.kind != .gettingStarted {
                Section {
                    ReservationHelpStatusRow(status: status)
                        .listRowBackground(status.tone.backgroundColor)
                    if let action = status.action {
                        helpAction(action, context: context)
                    }
                }
            }

            if !content.steps.isEmpty {
                Section {
                    ForEach(content.steps, id: \.number) { step in
                        ReservationHelpStepRow(step: step)
                    }
                } header: {
                    Text(String(localized: "reservation_help_steps_header"))
                } footer: {
                    Text(content.summary)
                }
            }

            ForEach(content.sections, id: \.id) { section in
                Section {
                    ReservationHelpSectionRow(section: section)
                        .listRowBackground(section.tone.backgroundColor)
                    if let action = section.action {
                        helpAction(action, context: context)
                    }
                }
            }

            if !content.faqs.isEmpty {
                Section(String(localized: "reservation_help_faq_header")) {
                    ForEach(content.faqs, id: \.id) { faq in
                        ReservationHelpFAQRow(
                            faq: faq,
                            isExpanded: Binding(
                                get: { expandedFAQIDs.contains(faq.id) },
                                set: { expanded in
                                    if expanded {
                                        expandedFAQIDs.insert(faq.id)
                                    } else {
                                        expandedFAQIDs.remove(faq.id)
                                    }
                                }
                            )
                        )
                        if expandedFAQIDs.contains(faq.id), let action = faq.action {
                            helpAction(action, context: context)
                        }
                    }
                }
            }
        }
        .navigationTitle(content.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func helpAction(_ action: ReservationHelpAction, context: ReservationHelpContext) -> some View {
        switch action {
        case .viewPending:
            Button {
                NotificationCenter.default.post(
                    name: .reservationHelpListFocusRequested,
                    object: ReservationHelpListFocus.pending.rawValue
                )
                dismiss()
            } label: {
                Label(action.localizedLabel, systemImage: action.systemImage)
            }
        case .viewUpcoming:
            Button {
                NotificationCenter.default.post(
                    name: .reservationHelpListFocusRequested,
                    object: ReservationHelpListFocus.upcoming.rawValue
                )
                dismiss()
            } label: {
                Label(action.localizedLabel, systemImage: action.systemImage)
            }
        case .addWithoutLink:
            NavigationLink(value: ReservationRoute.quickAdd(sessionID: context.firstDraftSessionID)) {
                Label(action.localizedLabel, systemImage: action.systemImage)
            }
        case .editCurrentRecord:
            if let id = context.currentRecordID {
                NavigationLink(value: ReservationRoute.edit(id)) {
                    Label(action.localizedLabel, systemImage: action.systemImage)
                }
            }
        case .viewExistingRecord:
            if let id = context.existingRecordID {
                NavigationLink(value: ReservationRoute.detail(id)) {
                    Label(action.localizedLabel, systemImage: action.systemImage)
                }
            }
        }
    }
}

private struct ReservationHelpStepRow: View {
    let step: ReservationHelpStep

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(step.number)")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Color(uiColor: .systemBackground))
                .frame(width: 32, height: 32)
                .background(Color.accentColor, in: Circle())
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(step.title)
                    .font(.headline)
                Text(step.body)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            String(
                format: String(localized: "reservation_help_step_accessibility_format"),
                step.number,
                step.title,
                step.body
            )
        )
    }
}

private struct ReservationHelpSectionRow: View {
    let section: ReservationHelpSection

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: section.tone.systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(section.tone.foregroundColor)
                .frame(width: 24, height: 24)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 7) {
                Text(section.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityLabel("\(section.tone.accessibilityName), \(section.title)")
                Text(section.body)
                    .font(.body)
                    .fixedSize(horizontal: false, vertical: true)
                ForEach(section.points, id: \.self) { point in
                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        Image(systemName: "circle.fill")
                            .font(.system(size: 5))
                            .accessibilityHidden(true)
                        Text(point)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .font(.subheadline)
                }
            }
        }
        .padding(.vertical, 5)
    }
}

private struct ReservationHelpStatusRow: View {
    let status: ReservationHelpStatusPresentation

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: status.tone.systemImage)
                .foregroundStyle(status.tone.foregroundColor)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 5) {
                Text(status.title)
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                Text(status.body)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 5)
    }
}

private struct ReservationHelpFAQRow: View {
    let faq: ReservationHelpFAQ
    @Binding var isExpanded: Bool

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            Text(faq.answer)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.vertical, 6)
        } label: {
            Label {
                Text(faq.question)
                    .font(.body.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
            } icon: {
                Image(systemName: faq.tone.systemImage)
                    .foregroundStyle(faq.tone.foregroundColor)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityHint(
            isExpanded
                ? String(localized: "reservation_help_faq_collapse_hint")
                : String(localized: "reservation_help_faq_expand_hint")
        )
    }
}

private extension ReservationHelpAction {
    var localizedLabel: String {
        switch self {
        case .viewPending: return String(localized: "reservation_action_view_pending")
        case .addWithoutLink: return String(localized: "reservation_action_add_without_link")
        case .viewUpcoming: return String(localized: "reservation_action_view_upcoming")
        case .editCurrentRecord: return String(localized: "reservation_action_edit_record")
        case .viewExistingRecord: return String(localized: "reservation_action_view_existing")
        }
    }

    var systemImage: String {
        switch self {
        case .viewPending: return "clock"
        case .addWithoutLink: return "plus.circle"
        case .viewUpcoming: return "calendar"
        case .editCurrentRecord: return "pencil"
        case .viewExistingRecord: return "doc.text.magnifyingglass"
        }
    }
}

private extension ReservationHelpStatusPresentation {
    var title: String {
        switch kind {
        case .gettingStarted:
            return String(localized: "reservation_help_status_getting_started_title")
        case .pending:
            return String(localized: "reservation_help_status_pending_title")
        case .manageRecords:
            return String(localized: "reservation_help_status_manage_title")
        }
    }

    var body: String {
        switch kind {
        case .gettingStarted:
            return String(localized: "reservation_help_status_getting_started_body")
        case .pending:
            let expiryText = expiry?.localizedText ?? String(localized: "reservation_draft_expiry_soon")
            return String(
                format: String(localized: "reservation_help_status_pending_body_format"),
                activeDraftCount,
                expiryText
            )
        case .manageRecords:
            return String(localized: "reservation_help_status_manage_body")
        }
    }
}

private extension ReservationDraftExpiryPresentation {
    var localizedText: String {
        switch kind {
        case .hours:
            return String(format: String(localized: "reservation_draft_expiry_hours_format"), value ?? 1)
        case .minutes:
            return String(format: String(localized: "reservation_draft_expiry_minutes_format"), value ?? 1)
        case .soon:
            return String(localized: "reservation_draft_expiry_soon")
        }
    }
}

private extension ReservationHelpTone {
    var systemImage: String {
        switch self {
        case .normal: return "info.circle"
        case .info: return "info.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .security: return "lock.shield.fill"
        case .danger: return "trash.fill"
        }
    }

    var accessibilityName: String {
        switch self {
        case .normal: return String(localized: "reservation_help_tone_normal")
        case .info: return String(localized: "reservation_help_tone_info")
        case .warning: return String(localized: "reservation_help_tone_warning")
        case .security: return String(localized: "reservation_help_tone_security")
        case .danger: return String(localized: "reservation_help_tone_danger")
        }
    }

    var foregroundColor: Color {
        switch self {
        case .normal: return .secondary
        case .info, .security: return .accentColor
        case .warning: return .orange
        case .danger: return .red
        }
    }

    var backgroundColor: Color {
        switch self {
        case .normal: return Color.secondary.opacity(0.07)
        case .info, .security: return Color.accentColor.opacity(0.1)
        case .warning: return Color.orange.opacity(0.12)
        case .danger: return Color.red.opacity(0.12)
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
                    Button("상세 링크만 삭제") {
                        draft?.reservationDetailURL = nil
                        draft?.providerHistoryURL = nil
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
                    Button(selectedDraft.map { ReservationPresentationPolicy.addActionLabel($0.kind) } ?? "내역에 추가") {
                        confirm(allowsSensitiveURL: false)
                    }
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
