import XCTest
@testable import StelliveHubiOS

final class HubAPIClientTests: XCTestCase {
    override func tearDown() {
        StubURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testBootstrapSendsExpectedPathAndDecodesResponse() async throws {
        let client = makeClient { request in
            XCTAssertEqual(request.url?.path, "/v1/bootstrap")
            XCTAssertEqual(request.url?.query?.contains("deviceId=device-1"), true)
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
                  "liveStatus": [],
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
        }

        let response = try await client.bootstrap(deviceId: "device-1")

        XCTAssertEqual(response.config.catalogVersion, "seed-2026-06-01")
        XCTAssertEqual(response.serverTime, "2026-06-11T03:00:00.000Z")
    }

    func testHubEventsCalendarSendsExpectedPathAndDecodesResponse() async throws {
        let client = makeClient { request in
            XCTAssertEqual(request.url?.path, "/v1/hub-events/calendar")
            let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)
            let queryItems = Dictionary(uniqueKeysWithValues: (components?.queryItems ?? []).map { ($0.name, $0.value) })
            XCTAssertEqual(queryItems["from"], "2026-06-01")
            XCTAssertEqual(queryItems["to"], "2026-06-30")
            XCTAssertEqual(queryItems["timezone"], "Asia/Seoul")
            return jsonResponse(
                statusCode: 200,
                body: """
                {
                  "timezone": "Asia/Seoul",
                  "from": "2026-06-01",
                  "to": "2026-06-30",
                  "days": [
                    {
                      "date": "2026-06-13",
                      "entries": [
                        {
                          "id": "calendar-entry-1",
                          "eventId": "event-1",
                          "entryKind": "hub_event",
                          "specialDayKind": null,
                          "specialDayLabel": null,
                          "title": "온라인 굿즈 판매",
                          "category": "online_goods",
                          "status": "open",
                          "participationMode": "online",
                          "generationId": "official",
                          "memberId": null,
                          "startsAt": null,
                          "endsAt": null,
                          "displayDate": "2026-06-13",
                          "displayTimeText": "종일",
                          "sourceLabel": "Stellive Official",
                          "appDeepLink": "stellivehub://hub-events/event-1",
                          "platformUrl": "https://example.com/events/1"
                        }
                      ]
                    }
                  ]
                }
                """
            )
        }

        let response = try await client.hubEventsCalendar(
            from: "2026-06-01",
            to: "2026-06-30",
            timezone: "Asia/Seoul"
        )

        XCTAssertEqual(response.timezone, "Asia/Seoul")
        XCTAssertEqual(response.days.first?.date, "2026-06-13")
        XCTAssertEqual(response.days.first?.entries.first?.title, "온라인 굿즈 판매")
    }

    func testTokenUpdateErrorDoesNotExposeTokenValue() async {
        let token = "secret-apns-token"
        let client = makeClient { _ in
            jsonResponse(statusCode: 500, body: #"{"error":"server_unavailable"}"#)
        }

        do {
            _ = try await client.updateDeviceToken(
                UpdateDeviceTokenRequest(
                    deviceId: "device-1",
                    platform: "ios",
                    provider: "apns_via_fcm",
                    token: token,
                    appVersion: "0.1.0",
                    locale: "ko-KR",
                    timezone: "Asia/Seoul"
                )
            )
            XCTFail("Expected token update to fail")
        } catch {
            XCTAssertFalse(String(describing: error).contains(token))
        }
    }

    private func makeClient(
        handler: @escaping (URLRequest) throws -> (HTTPURLResponse, Data)
    ) -> HubAPIClient {
        StubURLProtocol.requestHandler = handler
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        return HubAPIClient(
            baseURL: URL(string: "https://example.invalid")!,
            session: URLSession(configuration: configuration)
        )
    }
}

private final class StubURLProtocol: URLProtocol {
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
