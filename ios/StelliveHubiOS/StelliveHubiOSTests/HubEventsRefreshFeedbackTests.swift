import XCTest
@testable import StelliveHubiOS

@MainActor
final class HubEventsRefreshFeedbackTests: XCTestCase {
    override func tearDown() {
        HubEventsRefreshStubURLProtocol.requestHandler = nil
        super.tearDown()
    }

    // MARK: Section titles

    func testFeedDayTitleUsesLocalizedKoreanDateInsteadOfRawISO() {
        XCTAssertEqual(HubEventsView.feedDayTitle(isoDay: "2026-09-07"), "9월 7일 (월)")
        XCTAssertEqual(HubEventsView.feedDayTitle(isoDay: "2026-09-10"), "9월 10일 (목)")
    }

    func testFeedDayTitleKeepsUnparsableKeyAsIs() {
        XCTAssertEqual(HubEventsView.feedDayTitle(isoDay: "not-a-date"), "not-a-date")
    }

    func testPeriodTitlesUseLocalizedKoreanDates() {
        // 2026-09-07 00:00 KST ... 2026-09-10 00:00 KST
        let start = Date(timeIntervalSince1970: 1_788_706_800)
        let end = Date(timeIntervalSince1970: 1_788_706_800 + 3 * 86_400)

        XCTAssertEqual(
            HubEventsView.calendarEventDateTitle(startsAt: start, endsAt: end),
            "9월 7일 (월)~9월 10일 (목)"
        )
        XCTAssertEqual(HubEventsView.calendarEventDateTitle(startsAt: start, endsAt: nil), "9월 7일 (월)")
        XCTAssertEqual(
            HubEventsView.calendarPeriodTitle(startsAt: start, endsAt: end),
            "9월 7일 (월)~9월 10일 (목)"
        )
        XCTAssertNil(HubEventsView.calendarPeriodTitle(startsAt: start, endsAt: start))
    }

    // MARK: Chip tap target

    func testFilterChipTapTargetMeetsHIGMinimum() {
        XCTAssertGreaterThanOrEqual(HubEventsView.filterChipMinTapHeight, 44)
    }

    // MARK: Refresh failure feedback

    func testHubEventsRefreshFailureSurfacesErrorMessageAndCanBeCleared() async {
        let store = makeStore { _ in jsonResponse(statusCode: 500, body: "{}") }

        await store.refreshHubEvents()

        XCTAssertNotNil(store.hubEventsRefreshErrorMessage)
        store.clearHubEventsRefreshError()
        XCTAssertNil(store.hubEventsRefreshErrorMessage)
    }

    func testCalendarRefreshFailureSurfacesErrorMessage() async {
        let store = makeStore { _ in jsonResponse(statusCode: 500, body: "{}") }

        await store.refreshCalendar(from: Date(), to: Date().addingTimeInterval(86_400))

        XCTAssertNotNil(store.hubEventsRefreshErrorMessage)
    }

    func testMonthNavigationCalendarFetchFailureDoesNotSurfaceErrorMessage() async {
        let store = makeStore { _ in jsonResponse(statusCode: 500, body: "{}") }

        await store.ensureCalendarLoaded(covering: Date())

        XCTAssertNil(store.hubEventsRefreshErrorMessage)
        XCTAssertFalse(store.calendarDays(for: "all").isEmpty, "falls back to the local calendar instead of going blank")
    }

    func testSuccessfulHubEventsRefreshClearsPreviousError() async {
        var shouldFail = true
        let store = makeStore { _ in
            shouldFail
                ? jsonResponse(statusCode: 500, body: "{}")
                : jsonResponse(statusCode: 200, body: #"{"items":[],"nextCursor":null}"#)
        }

        await store.refreshHubEvents()
        XCTAssertNotNil(store.hubEventsRefreshErrorMessage)

        shouldFail = false
        await store.refreshHubEvents()
        XCTAssertNil(store.hubEventsRefreshErrorMessage)
    }

    func testCancelledRefreshDoesNotSurfaceErrorMessage() async {
        let store = makeStore { _ in throw URLError(.cancelled) }

        await store.refreshHubEvents()
        await store.refreshCalendar(from: Date(), to: Date().addingTimeInterval(86_400))

        XCTAssertNil(store.hubEventsRefreshErrorMessage)
    }

    private func makeStore(
        handler: @escaping (URLRequest) throws -> (HTTPURLResponse, Data)
    ) -> ServerHubStore {
        HubEventsRefreshStubURLProtocol.requestHandler = handler
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [HubEventsRefreshStubURLProtocol.self]
        let client = HubAPIClient(
            baseURL: URL(string: "https://example.invalid")!,
            session: URLSession(configuration: configuration)
        )
        let defaults = UserDefaults(suiteName: "HubEventsRefreshFeedbackTests-\(UUID().uuidString)")!
        let deviceIDStore = DeviceIDStore(defaults: defaults)
        deviceIDStore.saveDeviceID("device-1")
        return ServerHubStore(api: client, deviceIDStore: deviceIDStore, fallback: MockHubStore())
    }
}

private final class HubEventsRefreshStubURLProtocol: URLProtocol {
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
