import Foundation

struct NotificationSummaryText: Equatable {
    let title: String
    let body: String
}

enum NotificationSummaryTextPolicy {
    static func text(for payloads: [NotificationPayload]) -> NotificationSummaryText? {
        guard let first = payloads.first else { return nil }
        guard payloads.count > 1 else {
            return NotificationSummaryText(title: first.title, body: first.body)
        }

        if payloads.allSatisfy({ $0.source == .hubEvent }) {
            return NotificationSummaryText(title: "굿즈/행사 업데이트 \(payloads.count)건", body: payloads.map(\.title).joined(separator: ", "))
        }
        if payloads.allSatisfy({ $0.memberId == "stellive-official" }) {
            return NotificationSummaryText(title: "공식 채널 새 소식 \(payloads.count)건", body: payloads.map(\.title).joined(separator: ", "))
        }
        return NotificationSummaryText(title: "새 알림 \(payloads.count)건", body: payloads.map(\.title).joined(separator: ", "))
    }
}
