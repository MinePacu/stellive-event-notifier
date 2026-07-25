import ActivityKit
import Foundation

struct ReservationActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let title: String
        let kind: ReservationKind
        let providerHost: String
        let openedAt: Date
        let draftCount: Int
    }

    let sessionID: UUID
}
