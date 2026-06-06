import Foundation

enum NotificationThreadPolicy {
    static func threadIdentifier(for payload: NotificationPayload) -> String {
        if let summaryGroupId = payload.summaryGroupId {
            return "summary:\(summaryGroupId)"
        }
        if payload.memberId.hasPrefix("hub-event:") {
            return "hub_event:\(payload.memberId.replacingOccurrences(of: "hub-event:", with: ""))"
        }
        return "\(payload.memberId):\(payload.source.rawValue):\(payload.eventType.rawValue)"
    }
}
