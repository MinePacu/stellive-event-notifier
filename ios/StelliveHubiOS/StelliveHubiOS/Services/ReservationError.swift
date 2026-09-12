import Foundation

enum ReservationError: LocalizedError {
    case sharedContainerUnavailable
    case corruptedData(backupFileName: String)
    case draftNotFound
    case invalidURL
    case sensitiveURLRequiresConfirmation

    var errorDescription: String? {
        switch self {
        case .sharedContainerUnavailable: String(localized: "reservation_error_storage_unavailable")
        case .corruptedData: String(localized: "reservation_error_corrupted_data")
        case .draftNotFound: String(localized: "reservation_error_draft_missing")
        case .invalidURL: String(localized: "reservation_error_invalid_url")
        case .sensitiveURLRequiresConfirmation: String(localized: "reservation_error_sensitive_url")
        }
    }
}
