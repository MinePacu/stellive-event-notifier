import Foundation

enum NotificationDeliveryLevel: String, Codable {
    case immediatePush = "immediate_push"
    case summaryPush = "summary_push"
    case inAppHistoryOnly = "in_app_history_only"
}

struct NotificationPayload: Equatable {
    let eventId: String
    let memberId: String
    let generationId: String
    let source: NotificationPlatform
    let eventType: NotificationEventType
    let title: String
    let body: String
    let appDeepLink: String
    let platformUrl: String?
    let deliveryLevel: NotificationDeliveryLevel
    let summaryGroupId: String?
    let supersedesEventIds: [String]

    static func from(data: [String: String]) -> NotificationPayload? {
        guard
            let eventId = nonEmpty(data["eventId"]),
            let memberId = nonEmpty(data["memberId"]),
            let generationId = nonEmpty(data["generationId"]),
            let sourceValue = nonEmpty(data["source"]),
            let source = NotificationPlatform(rawValue: sourceValue),
            let eventTypeValue = nonEmpty(data["eventType"]),
            let eventType = NotificationEventType(rawValue: eventTypeValue),
            let title = nonEmpty(data["title"]),
            let appDeepLink = nonEmpty(data["appDeepLink"])
        else {
            return nil
        }

        return NotificationPayload(
            eventId: eventId,
            memberId: memberId,
            generationId: generationId,
            source: source,
            eventType: eventType,
            title: title,
            body: data["body"] ?? "",
            appDeepLink: appDeepLink,
            platformUrl: nonEmpty(data["platformUrl"]),
            deliveryLevel: NotificationDeliveryLevel(rawValue: data["deliveryLevel"] ?? "") ?? .immediatePush,
            summaryGroupId: nonEmpty(data["summaryGroupId"]),
            supersedesEventIds: data["supersedesEventIds"]?
                .split(separator: ",")
                .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty } ?? []
        )
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }
}
