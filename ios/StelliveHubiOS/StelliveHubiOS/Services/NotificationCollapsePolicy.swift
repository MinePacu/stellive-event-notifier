import Foundation

enum NotificationCollapsePolicy {
    static func collapseIdentifier(for payload: NotificationPayload) -> String? {
        switch payload.eventType {
        case .chzzkLiveStarted, .chzzkLiveEnded:
            return "live:\(payload.memberId):\(payload.source.rawValue)"
        case .eventAnnounced, .eventSalesOpen, .eventDeadlineSoon, .eventMilestoneDue, .eventUpdated, .eventCancelled:
            return NotificationThreadPolicy.threadIdentifier(for: payload)
        case .officialYoutubeUpload:
            return "official:\(payload.eventType.rawValue)"
        case .serviceAnnouncement:
            return "service:\(payload.eventId)"
        default:
            return payload.summaryGroupId.map { "summary:\($0)" }
        }
    }
}
