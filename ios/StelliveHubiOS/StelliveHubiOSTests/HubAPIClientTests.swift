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
                  "startsAt": "2026-06-13T01:00:00.000Z",
                  "endsAt": "2026-06-13T14:59:00.000Z",
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

    func testHubEventsListAndDetailSendExpectedPathsAndDecodeResponses() async throws {
        var seenPaths: [String] = []
        let client = makeClient { request in
            seenPaths.append(request.url?.path ?? "")
            if request.url?.path == "/v1/hub-events" {
                let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)
                let queryItems = Dictionary(uniqueKeysWithValues: (components?.queryItems ?? []).map { ($0.name, $0.value) })
                XCTAssertEqual(queryItems["generationId"], "official")
                XCTAssertEqual(queryItems["limit"], "10")
                return jsonResponse(statusCode: 200, body: """
                    {
                      "items": [{
                        "id": "event-1",
                        "category": "online_goods",
                        "participationMode": "online",
                        "status": "open",
                        "title": "서버 굿즈",
                        "generationId": "official",
                        "sourceUrl": "https://example.com/event-1",
                        "sourceLabel": "공식 공지",
                        "sourceType": "official",
                        "notificationEligible": true,
                        "updatedAt": "2026-06-18T00:00:00.000Z"
                      }],
                      "nextCursor": null
                    }
                    """)
            }
            return jsonResponse(statusCode: 200, body: """
                {
                  "id": "event-1",
                  "category": "online_goods",
                  "participationMode": "online",
                  "status": "open",
                  "title": "서버 굿즈",
                  "generationId": "official",
                  "startsAt": "2026-06-13T01:00:00.000Z",
                  "endsAt": "2026-06-13T14:59:00.000Z",
                  "sourceUrl": "https://example.com/event-1",
                  "sourceLabel": "공식 공지",
                  "sourceType": "official",
                  "notificationEligible": true,
                  "updatedAt": "2026-06-18T00:00:00.000Z"
                }
                """)
        }

        let list = try await client.hubEvents(generationId: "official", limit: 10)
        let detail = try await client.hubEvent(id: "event-1")

        XCTAssertEqual(seenPaths, ["/v1/hub-events", "/v1/hub-events/event-1"])
        XCTAssertEqual(list.items.first?.id, "event-1")
        XCTAssertEqual(detail.id, "event-1")
    }

    func testSongsListAndFacetsSendExpectedPathsAndDecodeResponses() async throws {
        var seenPaths: [String] = []
        let client = makeClient { request in
            seenPaths.append(request.url?.path ?? "")
            let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)
            let queryItems = Dictionary(uniqueKeysWithValues: (components?.queryItems ?? []).map { ($0.name, $0.value) })
            if request.url?.path == "/v1/songs" {
                XCTAssertEqual(queryItems["generationId"], "gen2")
                XCTAssertEqual(queryItems["memberId"], "akane-lize")
                XCTAssertEqual(queryItems["type"], "original")
                XCTAssertEqual(queryItems["q"], "별빛")
                return jsonResponse(statusCode: 200, body: """
                    {
                      "items": [{
                        "id": "song-1",
                        "youtubeVideoId": "abc123",
                        "title": "별빛 항로",
                        "memberId": "akane-lize",
                        "memberName": "아카네 리제",
                        "generationId": "gen2",
                        "generationName": "2기생",
                        "type": "original",
                        "sourceUrl": "https://www.youtube.com/watch?v=abc123",
                        "thumbnail": {"url": "https://i.ytimg.com/vi/abc123/mqdefault.jpg", "width": 320, "height": 180},
                        "publishedAt": "2026-06-21T12:00:00.000Z",
                        "premiere": {
                          "classification": "assumed",
                          "state": "scheduled",
                          "scheduledStartAt": "2026-06-28T08:00:00.000Z",
                          "actualStartAt": null,
                          "actualEndAt": null
                        }
                      }],
                      "nextCursor": null
                    }
                    """)
            }
            return jsonResponse(statusCode: 200, body: """
                {
                  "summary": {"total": 1, "original": 1, "cover": 0},
                  "generationFilters": [{"id": "gen2", "label": "2기생", "generationId": "gen2", "count": 1}],
                  "memberFilters": [],
                  "typeFilters": []
                }
                """)
        }

        let songs = try await client.songs(generationId: "gen2", memberId: "akane-lize", type: "original", q: "별빛")
        let facets = try await client.songFacets(generationId: "gen2")

        XCTAssertEqual(seenPaths, ["/v1/songs", "/v1/songs/facets"])
        XCTAssertEqual(songs.items.first?.id, "song-1")
        XCTAssertEqual(songs.items.first?.thumbnail?.width, 320)
        XCTAssertEqual(songs.items.first?.premiere?.state, "scheduled")
        XCTAssertEqual(songs.items.first?.premiere?.scheduledStartAt, Date(timeIntervalSince1970: 1782633600))
        XCTAssertEqual(facets.summary.original, 1)
    }

    func testMusicListUsesOfficialMusicEndpointAndDecodesMembers() async throws {
        let client = makeClient { request in
            XCTAssertEqual(request.url?.path, "/v1/music")
            let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)
            let queryItems = Dictionary(uniqueKeysWithValues: (components?.queryItems ?? []).map { ($0.name, $0.value) })
            XCTAssertEqual(queryItems["type"], "cover")
            XCTAssertEqual(queryItems["limit"], "30")
            XCTAssertEqual(queryItems["sort"], "publishedAt_desc")
            return jsonResponse(statusCode: 200, body: """
            {
              "items": [{
                "id": "video-1",
                "youtubeVideoId": "video-1",
                "title": "Collab Cover",
                "type": "cover",
                "publishedAt": "2026-06-23T00:00:00.000Z",
                "thumbnailUrl": "https://img.youtube.com/vi/video-1/hqdefault.jpg",
                "duration": "PT3M",
                "durationSeconds": 180,
                "isInstrumental": false,
                "specialFlags": [],
                "classificationStatus": "AUTO_CLASSIFIED",
                "members": [
                  { "id": "yuzuha-riko", "nameKo": "유즈하 리코", "nameEn": "Yuzuha Riko", "role": "MAIN" },
                  { "id": "neneko-mashiro", "nameKo": "네네코 마시로", "nameEn": "Neneko Mashiro", "role": "COLLAB" }
                ],
                "youtubeUrl": "https://www.youtube.com/watch?v=video-1",
                "sourcePlaylistId": "playlist-cover",
                "premiere": {
                  "classification": "assumed",
                  "state": "live",
                  "scheduledStartAt": "2026-06-28T08:00:00.000Z",
                  "actualStartAt": "2026-06-28T08:00:02.000Z",
                  "actualEndAt": null
                }
              }],
              "nextCursor": null
            }
            """)
        }

        let response = try await client.music(type: "cover", limit: 30, sort: "publishedAt_desc")

        XCTAssertEqual(response.items.first?.members.map(\.nameKo), ["유즈하 리코", "네네코 마시로"])
        XCTAssertEqual(response.items.first?.youtubeUrl, "https://www.youtube.com/watch?v=video-1")
        XCTAssertEqual(response.items.first?.premiere?.state, "live")
        XCTAssertEqual(response.items.first?.premiere?.actualStartAt, Date(timeIntervalSince1970: 1782633602))
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

@MainActor
final class ServerHubStoreTests: XCTestCase {
    override func tearDown() {
        StubURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testRefreshHubEventsCachesListAndDetailEntries() async {
        let store = makeStore { request in
            XCTAssertEqual(request.url?.path, "/v1/hub-events")
            return jsonResponse(statusCode: 200, body: """
                {
                  "items": [{
                    "id": "event-1",
                    "category": "online_goods",
                    "participationMode": "online",
                    "status": "open",
                    "title": "서버 굿즈",
                    "generationId": "official",
                    "sourceUrl": "https://example.com/event-1",
                    "sourceLabel": "공식 공지",
                    "sourceType": "official",
                    "notificationEligible": true,
                    "updatedAt": "2026-06-18T00:00:00.000Z"
                  }],
                  "nextCursor": null
                }
                """)
        }

        await store.refreshHubEvents(filter: "all")

        XCTAssertEqual(store.serverHubEvents.map(\.id), ["event-1"])
        XCTAssertEqual(store.cachedHubEvent(id: "event-1")?.title, "서버 굿즈")
    }

    func testRefreshHubEventsForwardsOptionalDateRange() async {
        let requestedFrom = DateComponents(
            calendar: Calendar(identifier: .gregorian),
            timeZone: TimeZone(secondsFromGMT: 0),
            year: 2026,
            month: 6,
            day: 14,
            hour: 12
        ).date!
        let requestedTo = DateComponents(
            calendar: Calendar(identifier: .gregorian),
            timeZone: TimeZone(secondsFromGMT: 0),
            year: 2026,
            month: 7,
            day: 15,
            hour: 12
        ).date!
        let store = makeStore { request in
            XCTAssertEqual(request.url?.path, "/v1/hub-events")
            let components = URLComponents(url: try XCTUnwrap(request.url), resolvingAgainstBaseURL: false)
            let queryItems = components?.queryItems ?? []

            XCTAssertEqual(queryItems.first(where: { $0.name == "from" })?.value, "2026-06-14")
            XCTAssertEqual(queryItems.first(where: { $0.name == "to" })?.value, "2026-07-15")

            return jsonResponse(statusCode: 200, body: #"{"items":[],"nextCursor":null}"#)
        }

        await store.refreshHubEvents(filter: "all", from: requestedFrom, to: requestedTo)
    }

    func testRefreshHubEventsDoesNotSendBuiltInFilterAsGenerationId() async {
        let store = makeStore { request in
            XCTAssertEqual(request.url?.path, "/v1/hub-events")
            let components = URLComponents(url: try XCTUnwrap(request.url), resolvingAgainstBaseURL: false)
            let queryItems = components?.queryItems ?? []

            XCTAssertNil(queryItems.first { $0.name == "generationId" })

            return jsonResponse(statusCode: 200, body: #"{"items":[]}"#)
        }

        await store.refreshHubEvents(filter: "goods")
    }

    func testRefreshRecentSongsRequestsLatestItemsWithoutTypeFilter() async {
        let store = makeStore { request in
            XCTAssertEqual(request.url?.path, "/v1/music")
            let components = URLComponents(url: try XCTUnwrap(request.url), resolvingAgainstBaseURL: false)
            let queryItems = components?.queryItems ?? []

            XCTAssertNil(queryItems.first { $0.name == "type" })
            XCTAssertEqual(queryItems.first(where: { $0.name == "limit" })?.value, "5")
            XCTAssertEqual(queryItems.first(where: { $0.name == "sort" })?.value, "publishedAt_desc")

            return jsonResponse(statusCode: 200, body: """
                {
                  "items": [{
                    "id": "music-1",
                    "youtubeVideoId": "music-1",
                    "title": "Original",
                    "type": "original",
                    "publishedAt": "2026-06-28T00:00:00.000Z",
                    "members": [],
                    "youtubeUrl": "https://www.youtube.com/watch?v=music-1"
                  }],
                  "nextCursor": null
                }
                """)
        }

        await store.refreshRecentSongs(limit: 5)

        XCTAssertEqual(store.recentSongs.map(\.id), ["music-1"])
    }

    func testDetail404ReturnsNilWithoutSynthesizingFallbackEvent() async {
        let store = makeStore { request in
            XCTAssertEqual(request.url?.path, "/v1/hub-events/missing")
            return jsonResponse(statusCode: 404, body: #"{"error":"hub_event_not_found"}"#)
        }

        let event = await store.loadHubEventDetail(id: "missing")

        XCTAssertNil(event)
        XCTAssertNil(store.cachedHubEvent(id: "missing"))
    }

    func testRefreshCalendarUsesServerCalendarDays() async {
        let store = makeStore { request in
            XCTAssertEqual(request.url?.path, "/v1/hub-events/calendar")
            return jsonResponse(statusCode: 200, body: """
                {
                  "timezone": "Asia/Seoul",
                  "from": "2026-06-01",
                  "to": "2026-06-30",
                  "days": [{
                    "date": "2026-06-18",
                    "entries": [{
                      "id": "event-1:2026-06-18",
                      "eventId": "event-1",
                      "entryKind": "hub_event",
                      "title": "서버 굿즈",
                      "category": "online_goods",
                      "status": "open",
                      "participationMode": "online",
                      "generationId": "official",
                      "displayDate": "2026-06-18",
                      "displayTimeText": "종일",
                      "sourceLabel": "공식 공지",
                      "appDeepLink": "stellivehub://hub-events/event-1",
                      "platformUrl": "https://example.com/event-1"
                    }]
                  }]
                }
                """)
        }

        await store.refreshCalendar(from: Date(timeIntervalSince1970: 1_781_740_800), to: Date(timeIntervalSince1970: 1_782_777_599), timezone: TimeZone(identifier: "Asia/Seoul")!)

        XCTAssertEqual(store.serverCalendarDays.first?.entries.first?.eventId, "event-1")
    }

    func testRefreshSongsUsesServerResponses() async {
        let store = makeStore { request in
            XCTAssertEqual(request.url?.path, "/v1/music")
            return jsonResponse(statusCode: 200, body: """
                {
                  "items": [{
                    "id": "song-1",
                    "youtubeVideoId": "abc123",
                    "title": "별빛 항로",
                    "type": "original",
                    "publishedAt": "2026-06-21T12:00:00.000Z",
                    "members": [
                      { "id": "akane-lize", "nameKo": "아카네 리제", "nameEn": "Akane Lize", "role": "MAIN" }
                    ],
                    "youtubeUrl": "https://www.youtube.com/watch?v=abc123"
                  }, {
                    "id": "song-2",
                    "youtubeVideoId": "def456",
                    "title": "유니 커버",
                    "type": "cover",
                    "publishedAt": "2026-06-20T12:00:00.000Z",
                    "members": [
                      { "id": "ayatsuno-yuni", "nameKo": "아야츠노 유니", "nameEn": "Ayatsuno Yuni", "role": "MAIN" }
                    ],
                    "youtubeUrl": "https://www.youtube.com/watch?v=def456"
                  }],
                  "nextCursor": null
                }
                """)
        }

        await store.refreshSongs(generationId: "all", type: "all")

        XCTAssertEqual(store.serverSongs.map(\.id), ["song-1", "song-2"])
        XCTAssertEqual(store.songs(generationId: "gen2", type: "original").items.first?.title, "별빛 항로")
        XCTAssertEqual(store.songs(memberId: "ayatsuno-yuni", type: "cover").items.first?.title, "유니 커버")
    }

    func testMusicPageCollectorFetchesAllPagesAndDedupes() async throws {
        var cursors: [String?] = []
        let items = try await MusicPageCollector.collect { cursor, limit in
            cursors.append(cursor)
            XCTAssertEqual(limit, 100)
            if cursor == nil {
                return MusicListResponse(
                    items: [song("video-1")],
                    nextCursor: "cursor-2"
                )
            }
            return MusicListResponse(
                items: [song("video-1"), song("video-2")],
                nextCursor: nil
            )
        }

        XCTAssertEqual(cursors, [nil, "cursor-2"])
        XCTAssertEqual(items.map(\.youtubeVideoId), ["video-1", "video-2"])
    }

    private func song(_ videoId: String) -> SongCatalogItem {
        SongCatalogItem(
            id: videoId,
            youtubeVideoId: videoId,
            title: "Cover \(videoId)",
            type: .cover,
            thumbnailUrl: "https://img.youtube.com/vi/\(videoId)/hqdefault.jpg",
            members: [
                MusicMemberSummary(
                    id: "yuzuha-riko",
                    nameKo: "유즈하 리코",
                    nameEn: "Yuzuha Riko",
                    role: "MAIN"
                ),
            ],
            youtubeUrl: "https://www.youtube.com/watch?v=\(videoId)"
        )
    }

    private func makeStore(
        handler: @escaping (URLRequest) throws -> (HTTPURLResponse, Data)
    ) -> ServerHubStore {
        StubURLProtocol.requestHandler = handler
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let client = HubAPIClient(
            baseURL: URL(string: "https://example.invalid")!,
            session: URLSession(configuration: configuration)
        )
        let defaults = UserDefaults(suiteName: "ServerHubStoreTests-\(UUID().uuidString)")!
        return ServerHubStore(
            api: client,
            deviceIDStore: DeviceIDStore(defaults: defaults),
            fallback: MockHubStore()
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
