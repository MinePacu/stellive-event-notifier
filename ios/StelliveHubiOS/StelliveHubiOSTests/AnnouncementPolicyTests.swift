import XCTest
@testable import StelliveHubiOS

final class AnnouncementPolicyTests: XCTestCase {
    private func item(_ id: String, severity: ServiceAnnouncementSeverity = .info, pinned: Bool = false, attention: Int = 1, date: Date = Date(timeIntervalSince1970: 100)) -> ServiceAnnouncement {
        ServiceAnnouncement(id: id, type: .general, severity: severity, title: id, summary: "요약", body: "본문", isPinned: pinned, targetPlatforms: ["ios"], minimumAppVersion: nil, maximumAppVersion: nil, appDeepLink: nil, externalUrl: nil, actionLabel: nil, publishedAt: date, expiresAt: nil, resolvedAt: nil, archivedAt: nil, attentionRevision: attention, revision: 1, updatedAt: date)
    }

    func testReadKeyBadgeAndAttentionRevision() {
        XCTAssertEqual(AnnouncementPolicy.readKey(id: "a", attentionRevision: 2), "a:2")
        XCTAssertEqual(AnnouncementPolicy.unread([item("a", attention: 2)], readKeys: ["a:1"]).count, 1)
        XCTAssertEqual(AnnouncementPolicy.badgeText(10), "9+")
    }

    func testHomeAndFirstSyncPolicy() {
        let critical = item("critical", severity: .critical)
        let pinned = item("pinned", severity: .important, pinned: true)
        let normal = AnnouncementSummaryItem(id: "old", attentionRevision: 1, publishedAt: Date(timeIntervalSince1970: 1), severity: .info, isPinned: false)
        XCTAssertEqual(AnnouncementPolicy.homeAnnouncement([pinned, critical])?.id, "critical")
        XCTAssertEqual(AnnouncementPolicy.initialReadKeys([normal], firstSyncAt: Date(timeIntervalSince1970: 2)), ["old:1"])
    }

    func testDeepLinkParsing() {
        XCTAssertEqual(AnnouncementDeepLinkPolicy.id(from: URL(string: "stellivehub://announcements/notice-1")!), "notice-1")
        XCTAssertNil(AnnouncementDeepLinkPolicy.id(from: URL(string: "stellivehub://hub-events/notice-1")!))
    }

    func testSafeAppDeepLinkAcceptsOnlyRecognizedAppRoutes() {
        XCTAssertNotNil(AnnouncementDeepLinkPolicy.safeAppDeepLink("stellivehub://announcements/notice-1"))
        XCTAssertNotNil(AnnouncementDeepLinkPolicy.safeAppDeepLink("stellivehub://hub-events/event-1"))
        XCTAssertNotNil(AnnouncementDeepLinkPolicy.safeAppDeepLink("stellivehub://reservations"))
        XCTAssertNil(AnnouncementDeepLinkPolicy.safeAppDeepLink(nil))
        XCTAssertNil(AnnouncementDeepLinkPolicy.safeAppDeepLink("stellivehub://unknown/x"))
        XCTAssertNil(AnnouncementDeepLinkPolicy.safeAppDeepLink("tel:112"))
        XCTAssertNil(AnnouncementDeepLinkPolicy.safeAppDeepLink("https://example.com/announcements/x"))
        XCTAssertNil(AnnouncementDeepLinkPolicy.safeAppDeepLink("otherapp://announcements/x"))
    }

    func testHttpsURLRejectsNonHttpsAndHostless() {
        XCTAssertEqual(HubEventLinkPolicy.httpsURL(from: "https://chzzk.naver.com/live/x"), URL(string: "https://chzzk.naver.com/live/x"))
        XCTAssertNil(HubEventLinkPolicy.httpsURL(from: nil))
        XCTAssertNil(HubEventLinkPolicy.httpsURL(from: ""))
        XCTAssertNil(HubEventLinkPolicy.httpsURL(from: "http://example.com"))
        XCTAssertNil(HubEventLinkPolicy.httpsURL(from: "javascript:alert(1)"))
        XCTAssertNil(HubEventLinkPolicy.httpsURL(from: "tel:112"))
        XCTAssertNil(HubEventLinkPolicy.httpsURL(from: "https://"))
    }
}
