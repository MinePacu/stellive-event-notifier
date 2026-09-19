import SwiftUI

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
                    .foregroundStyle(Color.hubTealText)
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
                .foregroundStyle(ReservationPresentationPolicy.statusColor(record.status))
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
