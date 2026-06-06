import Foundation

enum NotificationCollapsePolicy {
    static func collapseIdentifier(for payload: NotificationPayload) -> String? {
        switch payload.eventType {
        case .chzzkLiveStarted, .chzzkLiveEnded:
            return "live:\(payload.memberId):\(payload.source.rawValue)"
        case .eventAnnounced, .eventSalesOpen, .eventDeadlineSoon, .eventUpdated, .eventCancelled:
            return NotificationThreadPolicy.threadIdentifier(for: payload)
        case .officialXPost, .officialYoutubeUpload:
            return "official:\(payload.eventType.rawValue)"
        default:
            return payload.summaryGroupId.map { "summary:\($0)" }
        }
    }
}
