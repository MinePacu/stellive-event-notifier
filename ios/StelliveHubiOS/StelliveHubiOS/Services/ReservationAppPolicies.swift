import Foundation

enum ReservationActionPolicy {
    static func kind(for linkKind: HubEventLinkKind, scheduleCancelled: Bool = false) -> ReservationKind? {
        guard !scheduleCancelled else { return nil }
        return switch linkKind {
        case .ticket: .ticket
        case .purchase: .purchase
        case .reservation: .reservation
        default: nil
        }
    }
}

enum ReservationDeepLinkPolicy {
    static func route(from url: URL?) -> ReservationRoute? {
        guard let url, url.scheme == "stellivehub", url.host == "reservations" else { return nil }
        let components = url.path.split(separator: "/").map(String.init)
        if components.isEmpty { return .list }
        if components[0] == "new" {
            let value = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "sessionId" }?.value
            return .quickAdd(sessionID: value.flatMap(UUID.init(uuidString:)))
        }
        guard let id = UUID(uuidString: components[0]) else { return nil }
        return components.dropFirst().first == "edit" ? .edit(id) : .detail(id)
    }
}

enum ReservationDisplayPolicy {
    static func officialEventChanged(record: ReservationRecord, latestEvent: HubEvent?) -> Bool {
        guard let latestEvent else { return false }
        return latestEvent.title != record.eventSnapshot.title ||
            latestEvent.startsAt != record.eventSnapshot.startsAt ||
            latestEvent.endsAt != record.eventSnapshot.endsAt ||
            latestEvent.venueName != record.eventSnapshot.venueName
    }
}

enum ReservationExternalLinkPolicy {
    static func openFailOpen(
        openExternal: () -> Void,
        recordBestEffort: () throws -> Void,
        onRecordingFailure: () -> Void
    ) {
        openExternal()
        do {
            try recordBestEffort()
        } catch {
            onRecordingFailure()
        }
    }
}

enum ReservationReturnPromptDecision: Equatable {
    case none
    case single(UUID)
    case multiple(Set<UUID>)
}

enum ReservationReturnPromptPolicy {
    static let minimumExternalDuration: TimeInterval = 10

    static func decision(
        drafts: [ReservationDraft],
        externallyOpenedSessionIDs: Set<UUID>,
        promptedSessionIDs: Set<UUID>,
        now: Date
    ) -> ReservationReturnPromptDecision {
        let eligible = ReservationDraftPolicy.active(drafts, now: now).filter {
            externallyOpenedSessionIDs.contains($0.sessionID) &&
                !promptedSessionIDs.contains($0.sessionID) &&
                now.timeIntervalSince($0.openedAt) >= minimumExternalDuration
        }
        switch eligible.count {
        case 0: return .none
        case 1: return .single(eligible[0].sessionID)
        default: return .multiple(Set(eligible.map(\.sessionID)))
        }
    }
}
