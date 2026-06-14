import XCTest

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
                      "liveStatus": [
                        {
                          "memberId": "ayatsuno-yuni",
                          "generationId": "gen1",
                          "platform": "chzzk",
                          "isLive": true,
                          "title": "Live title",
                          "viewerCount": 123,
                          "startedAt": "2026-06-11T03:00:00.000Z",
                          "platformUrl": "https://chzzk.naver.com/live/chzzk-channel-id",
                          "lastCheckedAt": "2026-06-11T03:01:00.000Z",
                          "sourceVerificationState": "verified"
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
