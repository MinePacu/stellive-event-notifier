import SwiftUI

enum ReservationHelpListFocus: String {
    case pending
    case upcoming
}

extension Notification.Name {
    static let reservationHelpListFocusRequested = Notification.Name("reservationHelpListFocusRequested")
}

extension View {
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

extension ReservationDraftExpiryPresentation {
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

struct ReservationEmptyState: View {
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
