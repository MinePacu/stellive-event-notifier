import Foundation

enum ReservationKind: String, Codable, CaseIterable, Hashable {
    case ticket
    case purchase
    case reservation

    var displayName: String {
        switch self {
        case .ticket: "티켓"
        case .purchase: "구매"
        case .reservation: "예약"
        }
    }
}

enum ReservationStatus: String, Codable, CaseIterable, Hashable {
    case pendingConfirmation
    case confirmed
    case cancelled
    case refunded
    case completed

    var displayName: String {
        switch self {
        case .pendingConfirmation: "확인 필요"
        case .confirmed: "예약 완료"
        case .cancelled: "취소"
        case .refunded: "환불"
        case .completed: "이용 완료"
        }
    }
}

enum ReservationLinkSource: String, Codable, Hashable {
    case appInput
    case browserShare
    case liveActivity
    case control
}

struct ReservationEventSnapshot: Codable, Hashable {
    let title: String
    let category: String
    let startsAt: Date?
    let endsAt: Date?
    let venueName: String?
    let venueAddress: String?
    let sourceLabel: String
    let imageURL: String?
}

struct ReservationDraft: Codable, Identifiable, Hashable {
    var id: UUID { sessionID }
    let sessionID: UUID
    let eventID: String
    let scheduleItemID: String?
    let kind: ReservationKind
    let eventSnapshot: ReservationEventSnapshot
    let originalActionURL: String
    let providerHost: String
    var openedAt: Date
    var expiresAt: Date
    var attemptCount: Int
}

struct ReservationRecord: Codable, Identifiable, Hashable {
    let id: UUID
    let sourceSessionID: UUID?
    let eventID: String?
    let scheduleItemID: String?
    var kind: ReservationKind
    var status: ReservationStatus
    let eventSnapshot: ReservationEventSnapshot
    let originalActionURL: String?
    var reservationDetailURL: String?
    var providerHistoryURL: String?
    var linkSource: ReservationLinkSource?
    var displayTitleOverride: String?
    var startsAtOverride: Date?
    var endsAtOverride: Date?
    var venueOverride: String?
    var optionText: String?
    var quantity: Int?
    var referenceNumber: String?
    var note: String?
    let openedAt: Date?
    let confirmedAt: Date
    let createdAt: Date
    var updatedAt: Date
    let schemaVersion: Int

    var displayTitle: String {
        ReservationTextPolicy.nonEmpty(displayTitleOverride) ?? eventSnapshot.title
    }

    var effectiveStartsAt: Date? { startsAtOverride ?? eventSnapshot.startsAt }
    var effectiveEndsAt: Date? { endsAtOverride ?? eventSnapshot.endsAt }
    var effectiveVenue: String? { ReservationTextPolicy.nonEmpty(venueOverride) ?? eventSnapshot.venueName }

    var preferredURL: URL? {
        [reservationDetailURL, providerHistoryURL, originalActionURL]
            .compactMap { ReservationURLPolicy.validatedURL($0) }
            .first
    }
}

enum ReservationTextPolicy {
    static func nonEmpty(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

enum ReservationURLPolicy {
    static let maximumLength = 4_096
    private static let sensitiveKeys = Set(["token", "auth", "session", "signature", "code"])

    static func validatedURL(_ rawValue: String?) -> URL? {
        guard let value = ReservationTextPolicy.nonEmpty(rawValue), value.count <= maximumLength,
              let components = URLComponents(string: value),
              components.scheme?.lowercased() == "https",
              components.host?.isEmpty == false,
              let url = components.url
        else { return nil }
        return url
    }

    static func containsSensitiveQuery(_ rawValue: String?) -> Bool {
        guard let url = validatedURL(rawValue),
              let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
        else { return false }
        return items.contains { sensitiveKeys.contains($0.name.lowercased()) }
    }

    static func firstSharedHTTPSURL(in text: String?) -> URL? {
        guard let text else { return nil }
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let range = NSRange(text.startIndex..., in: text)
        return detector?.matches(in: text, range: range)
            .compactMap(\.url)
            .first(where: { validatedURL($0.absoluteString) != nil })
    }
}

enum ReservationDraftSelection: Equatable {
    case none
    case selected(UUID)
    case choose([UUID])
}

enum ReservationDraftPolicy {
    static func active(_ drafts: [ReservationDraft], now: Date = Date()) -> [ReservationDraft] {
        drafts.filter { $0.expiresAt > now }.sorted { $0.openedAt > $1.openedAt }
    }

    static func selection(from drafts: [ReservationDraft], requested: UUID? = nil, now: Date = Date()) -> ReservationDraftSelection {
        let activeDrafts = active(drafts, now: now)
        if let requested, activeDrafts.contains(where: { $0.sessionID == requested }) { return .selected(requested) }
        switch activeDrafts.count {
        case 0: return .none
        case 1: return .selected(activeDrafts[0].sessionID)
        default: return .choose(activeDrafts.map(\.sessionID))
        }
    }
}
