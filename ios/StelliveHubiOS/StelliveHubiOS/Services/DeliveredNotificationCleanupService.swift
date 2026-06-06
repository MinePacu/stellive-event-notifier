import Foundation
import UserNotifications

struct DeliveredNotificationRecord: Equatable {
    let identifier: String
    let eventId: String?
    let collapseIdentifier: String?
}

protocol DeliveredNotificationCenter {
    func deliveredNotifications() async -> [DeliveredNotificationRecord]
    func removeDeliveredNotifications(withIdentifiers identifiers: [String])
}

final class UserNotificationDeliveredCenter: DeliveredNotificationCenter {
    func deliveredNotifications() async -> [DeliveredNotificationRecord] {
        let notifications = await UNUserNotificationCenter.current().deliveredNotifications()
        return notifications.map { notification in
            let userInfo = notification.request.content.userInfo
            return DeliveredNotificationRecord(
                identifier: notification.request.identifier,
                eventId: userInfo["eventId"] as? String,
                collapseIdentifier: userInfo["collapseId"] as? String
            )
        }
    }

    func removeDeliveredNotifications(withIdentifiers identifiers: [String]) {
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: identifiers)
    }
}

final class DeliveredNotificationCleanupService {
    private let center: DeliveredNotificationCenter

    init(center: DeliveredNotificationCenter = UserNotificationDeliveredCenter()) {
        self.center = center
    }

    func cleanup(for payload: NotificationPayload) async {
        let delivered = await center.deliveredNotifications()
        let identifiers = identifiersToRemove(from: delivered, incoming: payload)
        if !identifiers.isEmpty {
            center.removeDeliveredNotifications(withIdentifiers: identifiers)
        }
    }

    func identifiersToRemove(from delivered: [DeliveredNotificationRecord], incoming payload: NotificationPayload) -> [String] {
        let collapseIdentifier = NotificationCollapsePolicy.collapseIdentifier(for: payload)
        return delivered.compactMap { record in
            if let eventId = record.eventId, payload.supersedesEventIds.contains(eventId) {
                return record.identifier
            }
            if let collapseIdentifier, record.collapseIdentifier == collapseIdentifier, record.eventId != payload.eventId {
                return record.identifier
            }
            return nil
        }
    }
}
