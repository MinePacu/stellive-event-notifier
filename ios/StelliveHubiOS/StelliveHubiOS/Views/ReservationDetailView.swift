import SwiftUI

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
                                .foregroundStyle(ReservationPresentationPolicy.statusColor(record.status))
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
