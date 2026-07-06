import XCTest
@testable import StelliveHubiOS

@MainActor
final class ServerLiveStatusMappingTests: XCTestCase {
    override func tearDown() {
        ServerLiveStatusStubURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testBootstrapAppliesServerLiveStatusToFallbackStore() async throws {
        let store = MockHubStore()
        let defaults = UserDefaults(suiteName: "ServerLiveStatusMappingTests")!
        defaults.removePersistentDomain(forName: "ServerLiveStatusMappingTests")
        let serverStore = ServerHubStore(
            api: makeClient { request in
                if request.url?.path == "/v1/devices/register" {
                    return jsonResponse(
                        statusCode: 200,
                        body: """
                        {
                          "deviceId": "device-created",
                          "registered": true,
                          "serverTime": "2026-06-11T03:00:00.000Z"
                        }
                        """
                    )
                }

                return jsonResponse(
                    statusCode: 200,
                    body: """
                    {
                      "config": {
                        "unofficialProject": true,
                        "catalogVersion": "seed-2026-06-01",
                        "officialYoutubeLiveExcluded": true,
                        "xNotificationsEnabled": false,
                        "xDisabledReason": "x_notifications_dropped_for_mvp",
                        "hubCalendarEnabled": true,
                        "foregroundRealtimeEnabled": false
                      },
                      "preferences": [],
                      "catalog": {
                        "generations": [],
                        "members": [
                          {
                            "id": "ayatsuno-yuni",
                            "profileImageUrl": "https://yt.example/yuni.jpg"
                          },
                          {
                            "id": "sakihane-huya",
                            "profileImageUrl": "https://yt.example/huya.jpg"
                          }
                        ]
                      },
                      "liveStatus": [
                        {
                          "memberId": "ayatsuno-yuni",
                          "generationId": "gen1",
                          "platform": "chzzk",
                          "isLive": true,
                          "title": "Live title",
                      "viewerCount": 123,
                      "startedAt": "2026-06-11T03:00:00.000Z",
                      "channelImageUrl": "https://img.example/yuni.jpg",
                      "platformUrl": "https://chzzk.naver.com/live/chzzk-channel-id",
                          "lastCheckedAt": "2026-06-11T03:01:00.000Z",
                          "sourceVerificationState": "verified"
                        },
                        {
                          "memberId": "sakihane-huya",
                          "generationId": "gen1",
                          "platform": "chzzk",
                          "isLive": true,
                          "title": null,
                          "viewerCount": 456,
                          "startedAt": "2026-06-11T03:00:00.000Z",
                          "channelImageUrl": "https://img.example/huya.jpg",
                          "platformUrl": "https://chzzk.naver.com/live/unverified-channel",
                          "lastCheckedAt": "2026-06-11T03:02:00.000Z",
                          "sourceVerificationState": "verify_required"
                        }
                      ],
                      "hubEventsSummary": {
                        "openCount": 0,
                        "upcomingCount": 0,
                        "closingSoonCount": 0,
                        "preview": []
                      },
                      "serverTime": "2026-06-11T03:00:00.000Z"
                    }
                    """
                )
            },
            deviceIDStore: DeviceIDStore(defaults: defaults, key: "deviceID"),
            fallback: store
        )

        let result = await serverStore.bootstrap()
        let yuni = try XCTUnwrap(result.members.first { $0.id == "ayatsuno-yuni" })

        XCTAssertTrue(yuni.isLive)
        XCTAssertEqual(yuni.liveStartedAt, ISO8601DateFormatter.withFractionalSeconds.date(from: "2026-06-11T03:00:00.000Z"))
        XCTAssertEqual(yuni.liveTitle, "Live title")
        XCTAssertEqual(yuni.liveViewerCount, 123)
        XCTAssertEqual(yuni.channelImageURL, URL(string: "https://img.example/yuni.jpg"))
        XCTAssertEqual(yuni.profileImageURL, URL(string: "https://yt.example/yuni.jpg"))
        XCTAssertEqual(yuni.livePlatformURL, URL(string: "https://chzzk.naver.com/live/chzzk-channel-id"))
        XCTAssertEqual(yuni.liveLastCheckedAt, ISO8601DateFormatter.withFractionalSeconds.date(from: "2026-06-11T03:01:00.000Z"))

        let huya = try XCTUnwrap(result.members.first { $0.id == "sakihane-huya" })
        XCTAssertFalse(huya.isLive)
        XCTAssertNil(huya.liveStartedAt)
        XCTAssertNil(huya.liveTitle)
        XCTAssertNil(huya.liveViewerCount)
        XCTAssertEqual(huya.channelImageURL, URL(string: "https://img.example/huya.jpg"))
        XCTAssertEqual(huya.profileImageURL, URL(string: "https://yt.example/huya.jpg"))
        XCTAssertNil(huya.livePlatformURL)
        XCTAssertEqual(huya.liveLastCheckedAt, ISO8601DateFormatter.withFractionalSeconds.date(from: "2026-06-11T03:02:00.000Z"))
    }

    func testLiveStatusFormattersMatchMockup() {
        let now = ISO8601DateFormatter.withFractionalSeconds.date(from: "2026-06-15T11:03:00.000Z")!

        XCTAssertEqual(
            LiveStatusFormatter.elapsedClockText(
                startedAt: ISO8601DateFormatter.withFractionalSeconds.date(from: "2026-06-15T09:40:00.000Z"),
                now: now
            ),
            "1:23:00"
        )
        XCTAssertEqual(
            LiveStatusFormatter.elapsedClockText(
                startedAt: ISO8601DateFormatter.withFractionalSeconds.date(from: "2026-06-15T10:45:00.000Z"),
                now: now
            ),
            "0:18:00"
        )
        XCTAssertNil(LiveStatusFormatter.elapsedClockText(startedAt: nil, now: now))
        XCTAssertEqual(LiveStatusFormatter.viewerCountText(1234), "1,234")
        XCTAssertNil(LiveStatusFormatter.viewerCountText(nil))
        XCTAssertEqual(LiveStatusFormatter.liveTitleText(" "), "방송 제목 확인 중")
        XCTAssertEqual(LiveStatusFormatter.liveTitleText("유니랑 밤 산책 게임하고 노래 조금"), "유니랑 밤 산책 게임하고 노래 조금")
    }

    func testOrderedLiveMembersUsesPriorityThenCatalogOrder() {
        let members = MockHubStore().members
            .filter { $0.chzzkChannelId != nil }
            .prefix(4)
            .map { member in
                var updated = member
                updated.isLive = true
                return updated
            }

        let ordered = LiveMemberOrderingPolicy.orderedLiveMembers(
            Array(members),
            priorityMemberIDs: [members[2].id, members[0].id]
        )

        XCTAssertEqual(ordered.map(\.id), [members[2].id, members[0].id, members[1].id, members[3].id])
    }

    func testHomePreviewShowsTopThreeAndReportsOverflow() {
        let members = MockHubStore().members
            .filter { $0.chzzkChannelId != nil }
            .prefix(4)
            .map { member in
                var updated = member
                updated.isLive = true
                return updated
            }

        let preview = LiveMemberOrderingPolicy.homeLivePreview(Array(members), priorityMemberIDs: [])

        XCTAssertEqual(preview.map(\.id), members.prefix(3).map(\.id))
        XCTAssertTrue(LiveMemberOrderingPolicy.hasHomeLiveOverflow(Array(members)))
    }

    private func makeClient(
        handler: @escaping (URLRequest) throws -> (HTTPURLResponse, Data)
    ) -> HubAPIClient {
        ServerLiveStatusStubURLProtocol.requestHandler = handler
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ServerLiveStatusStubURLProtocol.self]
        return HubAPIClient(
            baseURL: URL(string: "https://example.invalid")!,
            session: URLSession(configuration: configuration)
        )
    }
}

private final class ServerLiveStatusStubURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        do {
            let (response, data) = try Self.requestHandler?(request) ?? jsonResponse(statusCode: 500, body: "{}")
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private func jsonResponse(statusCode: Int, body: String) -> (HTTPURLResponse, Data) {
    let url = URL(string: "https://example.invalid")!
    let response = HTTPURLResponse(
        url: url,
        statusCode: statusCode,
        httpVersion: nil,
        headerFields: ["content-type": "application/json"]
    )!
    return (response, Data(body.utf8))
}

private extension ISO8601DateFormatter {
    static var withFractionalSeconds: ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }
}
