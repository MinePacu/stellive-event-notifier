import XCTest
@testable import StelliveHubiOS

final class NotificationLoadReductionPolicyTests: XCTestCase {
    private func payload(
        eventId: String = "event-1",
        memberId: String = "ayatsuno-yuni",
        source: NotificationPlatform = .chzzk,
        eventType: NotificationEventType = .chzzkLiveStarted,
        title: String = "방송 시작",
        body: String = "라이브가 시작되었습니다.",
        summaryGroupId: String? = nil,
        supersedesEventIds: [String] = []
    ) -> NotificationPayload {
        NotificationPayload(
            eventId: eventId,
            memberId: memberId,
            generationId: "gen1",
            source: source,
            eventType: eventType,
            title: title,
            body: body,
            appDeepLink: "stellivehub://events/\(eventId)",
            platformUrl: "https://example.com",
            deliveryLevel: .immediatePush,
            summaryGroupId: summaryGroupId,
            supersedesEventIds: supersedesEventIds
        )
    }

    func testPayloadParsesRequiredFieldsAndDefaultsDeliveryLevel() {
        let parsed = NotificationPayload.from(data: [
            "eventId": "event-1",
            "memberId": "ayatsuno-yuni",
            "generationId": "gen1",
            "source": "chzzk",
            "eventType": "chzzk_live_started",
            "title": "방송 시작",
            "body": "본문",
            "appDeepLink": "stellivehub://events/event-1"
        ])

        XCTAssertEqual(parsed?.deliveryLevel, .immediatePush)
        XCTAssertNil(NotificationPayload.from(data: ["eventId": "event-1"]))
    }

    func testPayloadParsesServerPushDataShape() {
        let parsed = NotificationPayload.from(data: [
            "eventId": "hub_event:event-1:event_sales_open:2026-06-12T00:00:00.000Z",
            "memberId": "stellive-official",
            "generationId": "official",
            "source": "hub_event",
            "eventType": "event_sales_open",
            "title": "굿즈/행사 신청이 시작됐어요",
            "body": "공식 굿즈 판매",
            "appDeepLink": "stellivehub://hub-events/event-1",
            "platformUrl": "https://example.com/source",
            "deliveryLevel": "summary_push",
            "summaryGroupId": "official-upload-window",
            "supersedesEventIds": "event-old,event-older"
        ])

        XCTAssertEqual(parsed?.deliveryLevel, .summaryPush)
        XCTAssertEqual(parsed?.title, "굿즈/행사 신청이 시작됐어요")
        XCTAssertEqual(parsed?.summaryGroupId, "official-upload-window")
        XCTAssertEqual(parsed?.supersedesEventIds, ["event-old", "event-older"])
    }

    func testPushRegistrationCoordinatorSyncsFcmToken() async {
        let api = CapturingPushTokenAPI()
        let defaults = UserDefaults.standard
        let deviceIDKey = "test.deviceID.\(UUID().uuidString)"
        let pendingTokenKey = "test.pendingPushToken.\(UUID().uuidString)"
        let store = DeviceIDStore(defaults: defaults, key: deviceIDKey)
        store.saveDeviceID("device-1")
        let syncer = PushTokenSyncer(deviceIDStore: store, api: api, defaults: defaults, pendingTokenKey: pendingTokenKey)
        let coordinator = PushRegistrationCoordinator(syncToken: syncer.syncToken)

        await coordinator.didReceiveFcmRegistrationToken("fcm-token-1")

        XCTAssertEqual(api.lastRequest?.deviceId, "device-1")
        XCTAssertEqual(api.lastRequest?.provider, "apns_via_fcm")
        XCTAssertEqual(api.lastRequest?.token, "fcm-token-1")
    }

    func testThreadIdentifierGroupsSameTopic() {
        let first = payload(eventId: "event-1")
        let second = payload(eventId: "event-2")
        let different = payload(eventId: "event-3", source: .youtube, eventType: .youtubeUpload)

        XCTAssertEqual(NotificationThreadPolicy.threadIdentifier(for: first), NotificationThreadPolicy.threadIdentifier(for: second))
        XCTAssertNotEqual(NotificationThreadPolicy.threadIdentifier(for: first), NotificationThreadPolicy.threadIdentifier(for: different))
    }

    func testThreadIdentifierUsesSummaryAndHubEventKeys() {
        XCTAssertEqual(NotificationThreadPolicy.threadIdentifier(for: payload(summaryGroupId: "official-window")), "summary:official-window")
        XCTAssertEqual(
            NotificationThreadPolicy.threadIdentifier(for: payload(memberId: "hub-event:closing-official-goods", source: .hubEvent)),
            "hub_event:closing-official-goods"
        )
    }

    func testCollapseIdentifierReplacesLiveAndHubEventState() {
        XCTAssertEqual(NotificationCollapsePolicy.collapseIdentifier(for: payload()), "live:ayatsuno-yuni:chzzk")
        XCTAssertEqual(
            NotificationCollapsePolicy.collapseIdentifier(
                for: payload(memberId: "hub-event:closing-official-goods", source: .hubEvent, eventType: .eventCancelled)
            ),
            "hub_event:closing-official-goods"
        )
    }

    func testSummaryTextUsesReaderFriendlyLabels() {
        let text = NotificationSummaryTextPolicy.text(for: [
            payload(eventId: "official-1", memberId: "stellive-official", source: .youtube, eventType: .officialYoutubeUpload, title: "업로드 1"),
            payload(eventId: "official-2", memberId: "stellive-official", source: .youtube, eventType: .officialYoutubeUpload, title: "업로드 2")
        ])

        XCTAssertEqual(text?.title, "공식 채널 새 소식 2건")
        XCTAssertFalse(text?.title.contains("official_youtube_upload") ?? true)
    }

    func testCleanupRemovesSupersededAndOlderCollapseNotifications() {
        let service = DeliveredNotificationCleanupService(center: FakeDeliveredNotificationCenter())
        let incoming = payload(eventId: "event-new", supersedesEventIds: ["event-old"])

        let identifiers = service.identifiersToRemove(
            from: [
                DeliveredNotificationRecord(identifier: "old-id", eventId: "event-old", collapseIdentifier: "live:ayatsuno-yuni:chzzk"),
                DeliveredNotificationRecord(identifier: "new-id", eventId: "event-new", collapseIdentifier: "live:ayatsuno-yuni:chzzk"),
                DeliveredNotificationRecord(identifier: "other-id", eventId: "event-other", collapseIdentifier: "other")
            ],
            incoming: incoming
        )

        XCTAssertEqual(identifiers, ["old-id"])
    }
}

private final class FakeDeliveredNotificationCenter: DeliveredNotificationCenter {
    func deliveredNotifications() async -> [DeliveredNotificationRecord] { [] }
    func removeDeliveredNotifications(withIdentifiers identifiers: [String]) {}
}

private final class CapturingPushTokenAPI: PushTokenAPI {
    var lastRequest: UpdateDeviceTokenRequest?

    func updateDeviceToken(_ request: UpdateDeviceTokenRequest) async throws -> UpdateDeviceTokenResponse {
        lastRequest = request
        return UpdateDeviceTokenResponse(updated: true, tokenStatus: "active", serverTime: "2026-07-07T00:00:00.000Z")
    }
}
