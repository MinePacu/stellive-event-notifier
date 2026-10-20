import XCTest
@testable import StelliveHubiOS

@MainActor
final class GoodsChecklistStoreTests: XCTestCase {
    private var suite = ""
    private var defaults: UserDefaults!
    private var repository: UserDefaultsGoodsChecklistRepository!

    override func setUp() {
        super.setUp()
        suite = "GoodsChecklistStoreTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suite)
        repository = UserDefaultsGoodsChecklistRepository(defaults: defaults)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suite)
        super.tearDown()
    }

    private func item(_ id: String, limit: Int? = nil, bonus: Bool = false, price: Int? = 1_000) -> HubEventGoodsItem {
        HubEventGoodsItem(id: id, name: "굿즈 \(id)", priceKrw: price, purchaseLimit: limit, isBonus: bonus)
    }

    func testCheckSetsQuantityOneAndUncheckRemoves() {
        let store = GoodsChecklistStore(repository: repository)
        let a = item("a")
        store.setChecked(true, eventId: "e1", item: a)
        XCTAssertEqual(store.quantity(eventId: "e1", itemId: "a"), 1)
        XCTAssertTrue(store.isChecked(eventId: "e1", itemId: "a"))
        store.setChecked(false, eventId: "e1", item: a)
        XCTAssertNil(store.quantity(eventId: "e1", itemId: "a"))
        XCTAssertNil(store.state["e1"], "empty event entries are removed")
    }

    func testCheckingAgainKeepsExistingQuantity() {
        let store = GoodsChecklistStore(repository: repository)
        let a = item("a")
        store.setChecked(true, eventId: "e1", item: a)
        store.setQuantity(4, eventId: "e1", item: a)
        store.setChecked(true, eventId: "e1", item: a)
        XCTAssertEqual(store.quantity(eventId: "e1", itemId: "a"), 4)
    }

    func testQuantityClampsToLimitAndDefaultMax() {
        let store = GoodsChecklistStore(repository: repository)
        let limited = item("limited", limit: 3)
        let open = item("open")
        store.setChecked(true, eventId: "e1", item: limited)
        store.setChecked(true, eventId: "e1", item: open)
        store.setQuantity(10, eventId: "e1", item: limited)
        store.setQuantity(1_000, eventId: "e1", item: open)
        XCTAssertEqual(store.quantity(eventId: "e1", itemId: "limited"), 3)
        XCTAssertEqual(store.quantity(eventId: "e1", itemId: "open"), 99)
        store.setQuantity(0, eventId: "e1", item: limited)
        XCTAssertEqual(store.quantity(eventId: "e1", itemId: "limited"), 1)
    }

    func testSetQuantityIgnoredWhenNotChecked() {
        let store = GoodsChecklistStore(repository: repository)
        store.setQuantity(3, eventId: "e1", item: item("a"))
        XCTAssertNil(store.quantity(eventId: "e1", itemId: "a"))
    }

    func testBonusItemIsNotCheckable() {
        let store = GoodsChecklistStore(repository: repository)
        store.setChecked(true, eventId: "e1", item: item("bonus", bonus: true))
        XCTAssertNil(store.quantity(eventId: "e1", itemId: "bonus"))
        XCTAssertEqual(store.checkedCount(eventId: "e1"), 0)
    }

    func testClearOnlyAffectsThatEvent() {
        let store = GoodsChecklistStore(repository: repository)
        store.setChecked(true, eventId: "e1", item: item("a"))
        store.setChecked(true, eventId: "e2", item: item("a"))
        store.clear(eventId: "e1")
        XCTAssertEqual(store.checkedCount(eventId: "e1"), 0)
        XCTAssertEqual(store.checkedCount(eventId: "e2"), 1)
    }

    func testPrunedRemovesMissingItemsBonusAndClampsLoweredLimit() {
        let store = GoodsChecklistStore(repository: repository)
        for id in ["gone", "keep", "nowBonus", "limited"] {
            store.setChecked(true, eventId: "e1", item: item(id))
        }
        store.setQuantity(5, eventId: "e1", item: item("limited"))
        store.setChecked(true, eventId: "e2", item: item("other-event"))

        store.prune(eventId: "e1", freshItems: [
            item("keep"),
            item("nowBonus", bonus: true),
            item("limited", limit: 2),
            item("brandNew"),
        ])

        XCTAssertEqual(store.quantities(eventId: "e1"), ["keep": 1, "limited": 2])
        XCTAssertEqual(store.quantities(eventId: "e2"), ["other-event": 1], "other events are untouched")
    }

    func testPruneWithEmptyFreshListRemovesAllEntriesForEvent() {
        let store = GoodsChecklistStore(repository: repository)
        store.setChecked(true, eventId: "e1", item: item("a"))
        store.prune(eventId: "e1", freshItems: [])
        XCTAssertNil(store.state["e1"])
    }

    func testPersistenceAcrossStoreReinit() {
        let first = GoodsChecklistStore(repository: repository)
        first.setChecked(true, eventId: "e1", item: item("a"))
        first.setQuantity(3, eventId: "e1", item: item("a"))
        first.setChecked(true, eventId: "e1", item: item("b"))

        let restored = GoodsChecklistStore(repository: UserDefaultsGoodsChecklistRepository(defaults: defaults))
        XCTAssertEqual(restored.quantities(eventId: "e1"), ["a": 3, "b": 1])

        restored.clear(eventId: "e1")
        let afterClear = GoodsChecklistStore(repository: UserDefaultsGoodsChecklistRepository(defaults: defaults))
        XCTAssertEqual(afterClear.state, [:])
    }

    func testRepositoryDropsInvalidStoredEntries() {
        defaults.set(
            ["e1": ["a": 2, "zero": 0, "neg": -1, "text": "x"], "e2": "notADict", "e3": [String: Int]()],
            forKey: UserDefaultsGoodsChecklistRepository.storageKey
        )
        XCTAssertEqual(repository.load(), ["e1": ["a": 2]])
    }

    // MARK: - ServerHubStore prune rules (fresh vs non-fresh)

    private func makeServerStore(
        checklist: GoodsChecklistStore,
        handler: @escaping (URLRequest) throws -> (HTTPURLResponse, Data)
    ) -> ServerHubStore {
        GoodsStubURLProtocol.handler = handler
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [GoodsStubURLProtocol.self]
        let client = HubAPIClient(
            baseURL: URL(string: "https://example.invalid")!,
            session: URLSession(configuration: configuration)
        )
        return ServerHubStore(
            api: client,
            deviceIDStore: DeviceIDStore(defaults: defaults, secureStore: InMemorySecureValueStore()),
            fallback: MockHubStore(),
            goodsChecklist: checklist
        )
    }

    private func eventJSON(goods: String) -> String {
        """
        {"id":"e1","category":"offline_popup","participationMode":"offline","status":"open","title":"팝업",
         "generationId":"official","sourceUrl":"https://example.com/e","sourceLabel":"공식","sourceType":"official",
         "notificationEligible":true,"updatedAt":"2026-06-18T00:00:00.000Z"\(goods)}
        """
    }

    private func seededChecklist() -> GoodsChecklistStore {
        let checklist = GoodsChecklistStore(repository: repository)
        checklist.setChecked(true, eventId: "e1", item: item("keep"))
        checklist.setChecked(true, eventId: "e1", item: item("gone"))
        return checklist
    }

    func testFreshDetailFetchPrunesChecklist() async {
        let checklist = seededChecklist()
        let store = makeServerStore(checklist: checklist) { _ in
            goodsResponse(200, self.eventJSON(goods: #","goodsItems":[{"id":"keep","name":"유지","sortOrder":0}]"#))
        }
        let event = await store.loadHubEventDetail(id: "e1")
        XCTAssertEqual(event?.goodsItems.map(\.id), ["keep"])
        XCTAssertEqual(checklist.quantities(eventId: "e1"), ["keep": 1])
    }

    func testFreshDetailWithoutGoodsClearsChecklist() async {
        let checklist = seededChecklist()
        let store = makeServerStore(checklist: checklist) { _ in goodsResponse(200, self.eventJSON(goods: "")) }
        _ = await store.loadHubEventDetail(id: "e1")
        XCTAssertEqual(checklist.checkedCount(eventId: "e1"), 0)
    }

    func testNetworkFailureAndServerErrorDoNotPrune() async {
        let checklist = seededChecklist()
        let failing = makeServerStore(checklist: checklist) { _ in throw URLError(.notConnectedToInternet) }
        _ = await failing.loadHubEventDetail(id: "e1")
        XCTAssertEqual(checklist.checkedCount(eventId: "e1"), 2)

        let serverError = makeServerStore(checklist: checklist) { _ in goodsResponse(500, "{}") }
        _ = await serverError.loadHubEventDetail(id: "e1")
        XCTAssertEqual(checklist.checkedCount(eventId: "e1"), 2)
    }

    func testCachedDetailAfterFailureDoesNotPrune() async {
        let checklist = seededChecklist()
        var online = true
        let store = makeServerStore(checklist: checklist) { _ in
            if online {
                return goodsResponse(200, self.eventJSON(goods: #","goodsItems":[{"id":"keep","name":"유지"},{"id":"gone","name":"사라질"}]"#))
            }
            throw URLError(.timedOut)
        }
        _ = await store.loadHubEventDetail(id: "e1")
        XCTAssertEqual(checklist.checkedCount(eventId: "e1"), 2)
        online = false
        let cached = await store.loadHubEventDetail(id: "e1")
        XCTAssertEqual(cached?.goodsItems.count, 2)
        XCTAssertEqual(checklist.checkedCount(eventId: "e1"), 2)
    }

    func testMockFallbackNeverPrunes() {
        let checklist = seededChecklist()
        let store = makeServerStore(checklist: checklist) { _ in goodsResponse(500, "{}") }
        _ = store.hubEvents(for: "all")
        XCTAssertEqual(checklist.checkedCount(eventId: "e1"), 2)
    }
}

private final class GoodsStubURLProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        do {
            let (response, data) = try Self.handler?(request) ?? goodsResponse(500, "{}")
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private func goodsResponse(_ statusCode: Int, _ body: String) -> (HTTPURLResponse, Data) {
    let url = URL(string: "https://example.invalid")!
    let response = HTTPURLResponse(
        url: url, statusCode: statusCode, httpVersion: nil, headerFields: ["content-type": "application/json"]
    )!
    return (response, Data(body.utf8))
}
