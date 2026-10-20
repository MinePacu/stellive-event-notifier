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
                          "liveCategory": "Just Chatting",
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
                          "liveCategory": "Talk",
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
        XCTAssertEqual(yuni.liveCategory, "Just Chatting")
        XCTAssertEqual(yuni.liveViewerCount, 123)
        XCTAssertEqual(yuni.channelImageURL, URL(string: "https://img.example/yuni.jpg"))
        XCTAssertEqual(yuni.profileImageURL, URL(string: "https://yt.example/yuni.jpg"))
        XCTAssertEqual(yuni.livePlatformURL, URL(string: "https://chzzk.naver.com/live/chzzk-channel-id"))
        XCTAssertEqual(yuni.liveLastCheckedAt, ISO8601DateFormatter.withFractionalSeconds.date(from: "2026-06-11T03:01:00.000Z"))

        let huya = try XCTUnwrap(result.members.first { $0.id == "sakihane-huya" })
        XCTAssertFalse(huya.isLive)
        XCTAssertNil(huya.liveStartedAt)
        XCTAssertNil(huya.liveTitle)
        XCTAssertNil(huya.liveCategory)
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
        XCTAssertEqual(LiveStatusFormatter.liveCategoryText("  Just Chatting  "), "Just Chatting")
        XCTAssertNil(LiveStatusFormatter.liveCategoryText(" "))
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

final class LiveStatusHealthPolicyTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    private func iso(_ offset: TimeInterval) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: now.addingTimeInterval(offset))
    }

    private func health(_ state: LiveStatusHealthResponse.State, lastOK: TimeInterval? = nil) -> LiveStatusHealthResponse {
        .init(state: state, lastSuccessfulAt: lastOK.map(iso))
    }

    private func label(_ h: LiveStatusHealthResponse?, empty: Bool = true, serverTime: String? = nil) -> String {
        LiveStatusHealthPolicy.sourceLabel(isLiveListEmpty: empty, health: h, serverTime: serverTime, now: now)
    }

    func testAbsentHealthKeepsLegacyLabels() {
        XCTAssertEqual(label(nil), "서버 연결됨 · 라이브 폴링 꺼짐/데이터 없음")
        XCTAssertEqual(label(nil, empty: false), "서버 liveStatus")
        XCTAssertNil(LiveStatusHealthPolicy.notice(health: nil, serverTime: nil, now: now))
    }

    func testUnavailableAndDisabled() {
        XCTAssertEqual(label(health(.unavailable)), "서버 연결됨 · 라이브 상태 확인 불가")
        XCTAssertEqual(label(health(.disabled)), "서버 연결됨 · 라이브 수집 꺼짐")
        XCTAssertNotNil(LiveStatusHealthPolicy.notice(health: health(.unavailable), serverTime: nil, now: now))
        XCTAssertEqual(LiveStatusHealthPolicy.notice(health: health(.disabled), serverTime: nil, now: now), "라이브 상태 수집이 꺼져 있어요.")
    }

    func testOkAndRateLimitedFresh() {
        XCTAssertEqual(label(health(.ok, lastOK: -60), empty: false), "서버 liveStatus")
        XCTAssertEqual(label(health(.rateLimited)), "서버 연결됨 · 라이브 폴링 꺼짐/데이터 없음")
    }

    func testStaleBoundary() {
        XCTAssertNil(LiveStatusHealthPolicy.staleMinutes(health: health(.ok, lastOK: -300), serverTime: nil, now: now))
        XCTAssertEqual(LiveStatusHealthPolicy.staleMinutes(health: health(.ok, lastOK: -301), serverTime: nil, now: now), 5)
        XCTAssertEqual(label(health(.rateLimited, lastOK: -420)), "서버 연결됨 · 라이브 정보 지연 (7분 전 확인)")
        XCTAssertEqual(LiveStatusHealthPolicy.notice(health: health(.ok, lastOK: -420), serverTime: nil, now: now), "라이브 정보가 7분 전 기준이에요.")
    }

    func testServerTimeOverridesDeviceClock() {
        let h = health(.ok, lastOK: -600)
        // Server says only 1 minute after last success even though device clock is 10 minutes later.
        XCTAssertNil(LiveStatusHealthPolicy.staleMinutes(health: h, serverTime: iso(-540), now: now))
        XCTAssertEqual(LiveStatusHealthPolicy.staleMinutes(health: h, serverTime: nil, now: now), 10)
    }

    func testFractionalAndPlainSecondsParse() {
        XCTAssertNotNil(LiveStatusHealthPolicy.parseInstant("2026-10-20T03:23:58.345Z"))
        XCTAssertNotNil(LiveStatusHealthPolicy.parseInstant("2026-10-20T03:23:58Z"))
        XCTAssertNil(LiveStatusHealthPolicy.parseInstant("garbage"))
    }

    func testBootstrapDecodesHealthAndUnknownStateAsNil() throws {
        func decode(_ healthJSON: String) throws -> BootstrapResponse {
            let json = """
            {"config":{"unofficialProject":true,"catalogVersion":"v","officialYoutubeLiveExcluded":true,"hubCalendarEnabled":true},"liveStatusHealth":\(healthJSON)}
            """
            return try JSONDecoder().decode(BootstrapResponse.self, from: Data(json.utf8))
        }
        let ok = try decode(#"{"state":"rate_limited","lastSuccessfulAt":"2026-10-20T03:23:58.345Z"}"#)
        XCTAssertEqual(ok.liveStatusHealth?.state, .rateLimited)
        XCTAssertEqual(ok.liveStatusHealth?.lastSuccessfulAt, "2026-10-20T03:23:58.345Z")
        XCTAssertNil(try decode(#"{"state":"brand_new"}"#).liveStatusHealth)
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
