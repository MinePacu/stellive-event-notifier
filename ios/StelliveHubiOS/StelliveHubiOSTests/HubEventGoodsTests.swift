import XCTest
@testable import StelliveHubiOS

final class HubEventGoodsTests: XCTestCase {
    // MARK: - Decoding

    private func decodeEvent(goods: String? = nil, goodsCount: String? = nil) throws -> HubEventResponse {
        var extra = ""
        if let goods { extra += #","goodsItems":\#(goods)"# }
        if let goodsCount { extra += #","goodsCount":\#(goodsCount)"# }
        let json = """
        {"id":"event-1","category":"offline_popup","participationMode":"offline","status":"open",
         "title":"팝업","generationId":"official","sourceUrl":"https://example.com/e","sourceLabel":"공식",
         "sourceType":"official","notificationEligible":true,"updatedAt":"2026-06-18T00:00:00.000Z"\(extra)}
        """
        return try JSONDecoder().decode(HubEventResponse.self, from: Data(json.utf8))
    }

    func testEventWithoutGoodsFieldsDecodesEmpty() throws {
        let response = try decodeEvent()
        XCTAssertNil(response.goodsItems)
        XCTAssertNil(response.goodsCount)
    }

    func testGoodsCountDecodes() throws {
        XCTAssertEqual(try decodeEvent(goodsCount: "32").goodsCount, 32)
    }

    func testFullItemDecodesAllFields() throws {
        let response = try decodeEvent(goods: """
        [{"id":"g1","scheduleItemId":"s1","name":" 아크릴 스탠드 ","groupLabel":"스탠드","memberIds":["a","b"],
          "priceKrw":12000,"priceNote":"세트 별도","salesChannel":"both","purchaseLimit":3,"limitNote":"재고 한정",
          "isBonus":false,"purchaseUrl":"https://shop.example.com/g1",
          "image":{"policyState":"official_runtime_url","url":"https://img.example.com/a.png","altText":"스탠드"},
          "sortOrder":2,"createdAt":"2026-06-18T00:00:00.000Z","updatedAt":"2026-06-19T00:00:00Z"}]
        """)
        let items = try XCTUnwrap(response.goodsItems?.items)
        XCTAssertEqual(items.count, 1)
        let item = items[0].toDomain()
        XCTAssertEqual(item.id, "g1")
        XCTAssertEqual(item.scheduleItemId, "s1")
        XCTAssertEqual(item.name, "아크릴 스탠드")
        XCTAssertEqual(item.groupLabel, "스탠드")
        XCTAssertEqual(item.memberIds, ["a", "b"])
        XCTAssertEqual(item.priceKrw, 12_000)
        XCTAssertEqual(item.priceNote, "세트 별도")
        XCTAssertEqual(item.salesChannel, .both)
        XCTAssertEqual(item.purchaseLimit, 3)
        XCTAssertEqual(item.limitNote, "재고 한정")
        XCTAssertFalse(item.isBonus)
        XCTAssertEqual(item.purchaseUrl, "https://shop.example.com/g1")
        XCTAssertEqual(item.image?.policyState, .officialRuntimeUrl)
        XCTAssertEqual(item.sortOrder, 2)
        XCTAssertNotNil(item.createdAt)
        XCTAssertNotNil(item.updatedAt)
    }

    func testMinimalItemDecodesWithDefaults() throws {
        let response = try decodeEvent(goods: #"[{"id":"g1","name":"포스터"}]"#)
        let item = try XCTUnwrap(response.goodsItems?.items.first).toDomain()
        XCTAssertEqual(item.memberIds, [])
        XCTAssertNil(item.priceKrw)
        XCTAssertNil(item.salesChannel)
        XCTAssertNil(item.purchaseLimit)
        XCTAssertFalse(item.isBonus)
        XCTAssertNil(item.image)
        XCTAssertEqual(item.sortOrder, 0)
    }

    func testUnknownSalesChannelKeepsItemWithNilChannel() throws {
        let response = try decodeEvent(goods: #"[{"id":"g1","name":"포스터","salesChannel":"popup_only"}]"#)
        let item = try XCTUnwrap(response.goodsItems?.items.first).toDomain()
        XCTAssertEqual(item.name, "포스터")
        XCTAssertNil(item.salesChannel)
    }

    func testBadItemsAreSkippedWithoutFailingEvent() throws {
        let response = try decodeEvent(goods: """
        [{"id":"ok","name":"정상"},{"name":"id 없음"},{"id":"noname"},{"id":" ","name":"x"},{"id":"blank","name":"  "},
         "garbage",42,{"id":"ok2","name":"정상2","priceKrw":"oops","purchaseLimit":[1],"image":{"policyState":"weird"}}]
        """)
        let items = try XCTUnwrap(response.goodsItems?.items)
        XCTAssertEqual(items.map(\.id), ["ok", "ok2"])
        let second = items[1].toDomain()
        XCTAssertNil(second.priceKrw)
        XCTAssertNil(second.purchaseLimit)
        XCTAssertNil(second.image)
    }

    func testNonArrayGoodsItemsDecodesAsEmpty() throws {
        let response = try decodeEvent(goods: #"{"unexpected":true}"#)
        XCTAssertEqual(response.goodsItems?.items, [])
    }

    func testSanityRulesNegativePriceLimitAndUrl() throws {
        let response = try decodeEvent(goods: """
        [{"id":"a","name":"A","priceKrw":-1,"purchaseLimit":0,"purchaseUrl":"http://shop.example.com/a"},
         {"id":"b","name":"B","priceKrw":0,"purchaseLimit":1,"purchaseUrl":"javascript:alert(1)"},
         {"id":"c","name":"C","purchaseUrl":"https://shop.example.com/c"}]
        """)
        let items = try XCTUnwrap(response.goodsItems?.items).map { $0.toDomain() }
        XCTAssertNil(items[0].priceKrw)
        XCTAssertNil(items[0].purchaseLimit)
        XCTAssertNil(items[0].purchaseUrl)
        XCTAssertEqual(items[1].priceKrw, 0)
        XCTAssertEqual(items[1].purchaseLimit, 1)
        XCTAssertNil(items[1].purchaseUrl)
        XCTAssertEqual(items[2].purchaseUrl, "https://shop.example.com/c")
    }

    func testRoundTripEncodingOfResponseIsStable() throws {
        let response = try decodeEvent(goods: #"[{"id":"g1","name":"포스터","priceKrw":1000}]"#, goodsCount: "1")
        let data = try JSONEncoder().encode(response)
        XCTAssertEqual(try JSONDecoder().decode(HubEventResponse.self, from: data), response)
    }

    // MARK: - Sorting, grouping, filtering, collapsing

    private func item(
        _ id: String,
        group: String? = nil,
        members: [String] = [],
        sort: Int = 0,
        price: Int? = nil,
        note: String? = nil,
        limit: Int? = nil,
        bonus: Bool = false
    ) -> HubEventGoodsItem {
        HubEventGoodsItem(
            id: id, name: "굿즈 \(id)", groupLabel: group, memberIds: members, priceKrw: price,
            priceNote: note, purchaseLimit: limit, isBonus: bonus, sortOrder: sort
        )
    }

    func testSortedBySortOrderThenId() {
        let sorted = HubEventGoodsPolicy.sorted([item("c", sort: 1), item("b", sort: 0), item("a", sort: 1)])
        XCTAssertEqual(sorted.map(\.id), ["b", "a", "c"])
    }

    func testGroupsKeepFirstAppearanceOrderAndPutUnlabeledLast() {
        let groups = HubEventGoodsPolicy.groups([
            item("u1", sort: 0),
            item("s1", group: "스탠드", sort: 1),
            item("k1", group: "키링", sort: 2),
            item("s2", group: "스탠드", sort: 3),
            item("u2", sort: 4),
        ])
        XCTAssertEqual(groups.map(\.title), ["스탠드", "키링", "기타"])
        XCTAssertEqual(groups[0].items.map(\.id), ["s1", "s2"])
        XCTAssertEqual(groups[2].items.map(\.id), ["u1", "u2"])
        XCTAssertNil(groups[2].label)
    }

    func testBlankGroupLabelFallsIntoOther() {
        let groups = HubEventGoodsPolicy.groups([item("a", group: "  ")])
        XCTAssertEqual(groups.map(\.title), ["기타"])
    }

    func testMemberFilterShownOnlyForTwoOrMoreDistinctMembers() {
        let one = HubEventGoodsPolicy.presentation(items: [item("a", members: ["m1"]), item("b", members: ["m1"])], memberFilterId: nil, isExpanded: false)
        XCTAssertFalse(one.showsMemberFilter)
        let two = HubEventGoodsPolicy.presentation(items: [item("a", members: ["m1"]), item("b", members: ["m2", "m1"])], memberFilterId: nil, isExpanded: false)
        XCTAssertTrue(two.showsMemberFilter)
        XCTAssertEqual(two.memberFilterIds, ["m1", "m2"])
    }

    func testMemberFilterNarrowsItemsAndIgnoresStaleSelection() {
        let items = [item("a", members: ["m1"], sort: 0), item("b", members: ["m2"], sort: 1), item("c", members: ["m1", "m2"], sort: 2)]
        let filtered = HubEventGoodsPolicy.presentation(items: items, memberFilterId: "m1", isExpanded: false)
        XCTAssertEqual(filtered.groups.flatMap(\.items).map(\.id), ["a", "c"])
        XCTAssertEqual(filtered.selectedMemberId, "m1")
        let stale = HubEventGoodsPolicy.presentation(items: items, memberFilterId: "gone", isExpanded: false)
        XCTAssertNil(stale.selectedMemberId)
        XCTAssertEqual(stale.totalCount, 3)
    }

    func testCollapsesAboveEightItemsAndKeepsGroupOrder() {
        let items = (0..<10).map { item("i\($0)", group: $0 < 5 ? "A" : "B", sort: $0) }
        let collapsed = HubEventGoodsPolicy.presentation(items: items, memberFilterId: nil, isExpanded: false)
        XCTAssertTrue(collapsed.isCollapsed)
        XCTAssertTrue(collapsed.showsExpandToggle)
        XCTAssertEqual(collapsed.totalCount, 10)
        XCTAssertEqual(collapsed.groups.flatMap(\.items).count, 8)
        XCTAssertEqual(collapsed.groups.map(\.title), ["A", "B"])
        XCTAssertEqual(collapsed.groups[1].items.map(\.id), ["i5", "i6", "i7"])

        let expanded = HubEventGoodsPolicy.presentation(items: items, memberFilterId: nil, isExpanded: true)
        XCTAssertFalse(expanded.isCollapsed)
        XCTAssertTrue(expanded.showsExpandToggle)
        XCTAssertEqual(expanded.groups.flatMap(\.items).count, 10)
    }

    func testExactlyEightItemsIsNotCollapsed() {
        let items = (0..<8).map { item("i\($0)", sort: $0) }
        let presentation = HubEventGoodsPolicy.presentation(items: items, memberFilterId: nil, isExpanded: false)
        XCTAssertFalse(presentation.isCollapsed)
        XCTAssertFalse(presentation.showsExpandToggle)
    }

    func testCountLabelUsesItemsOrGoodsCount() {
        XCTAssertNil(HubEventGoodsPolicy.countLabel(for: event()))
        XCTAssertEqual(HubEventGoodsPolicy.countLabel(for: event(goodsCount: 32)), "굿즈 32종")
        XCTAssertEqual(HubEventGoodsPolicy.countLabel(for: event(items: [item("a"), item("b")])), "굿즈 2종")
        XCTAssertNil(HubEventGoodsPolicy.countLabel(for: event(goodsCount: 0)))
    }

    func testFeedCardPresentationAppendsGoodsChip() {
        XCTAssertEqual(HubEventFeedCardPresentation(event: event(goodsCount: 5)).secondaryTagLabels.last, "굿즈 5종")
        XCTAssertFalse(HubEventFeedCardPresentation(event: event()).secondaryTagLabels.contains { $0.hasPrefix("굿즈") })
    }

    // MARK: - Formatting

    func testMemberSummaryTruncatesAfterThree() {
        let names = ["a": "A", "b": "B", "c": "C", "d": "D", "e": "E"]
        XCTAssertEqual(HubEventGoodsPolicy.memberSummary(memberIds: ["a", "b"], names: names), "A, B")
        XCTAssertEqual(HubEventGoodsPolicy.memberSummary(memberIds: ["a", "b", "c"], names: names), "A, B, C")
        XCTAssertEqual(HubEventGoodsPolicy.memberSummary(memberIds: ["a", "b", "c", "d", "e"], names: names), "A, B, C 외 2명")
        XCTAssertEqual(HubEventGoodsPolicy.memberSummary(memberIds: ["a", "zzz", "a"], names: names), "A")
        XCTAssertNil(HubEventGoodsPolicy.memberSummary(memberIds: ["zzz"], names: names))
        XCTAssertNil(HubEventGoodsPolicy.memberSummary(memberIds: [], names: names))
    }

    func testWonFormattingAndPriceText() {
        XCTAssertEqual(HubEventGoodsPolicy.formatWon(0), "0원")
        XCTAssertEqual(HubEventGoodsPolicy.formatWon(900), "900원")
        XCTAssertEqual(HubEventGoodsPolicy.formatWon(12_000), "12,000원")
        XCTAssertEqual(HubEventGoodsPolicy.formatWon(1_234_567), "1,234,567원")
        XCTAssertEqual(HubEventGoodsPolicy.priceText(item("a", price: 12_000, note: "세트")), "12,000원")
        XCTAssertEqual(HubEventGoodsPolicy.priceText(item("a", note: "현장 공지")), "현장 공지")
        XCTAssertEqual(HubEventGoodsPolicy.priceText(item("a")), "가격 미정")
        XCTAssertEqual(HubEventGoodsPolicy.priceText(item("a", price: 0)), "0원")
    }

    func testSecondaryNotesAndChips() {
        var withBoth = item("a", price: 1000, note: "세트 가격", limit: 2)
        withBoth.limitNote = "행사당 1회"
        XCTAssertEqual(HubEventGoodsPolicy.secondaryNotes(withBoth), ["세트 가격", "행사당 1회"])
        XCTAssertEqual(HubEventGoodsPolicy.purchaseLimitChip(withBoth), "1인 2개")
        XCTAssertEqual(HubEventGoodsPolicy.secondaryNotes(item("b", note: "현장 공지")), [])
        XCTAssertNil(HubEventGoodsPolicy.purchaseLimitChip(item("c")))
        XCTAssertEqual(HubEventGoodsSalesChannel.onsite.displayName, "현장")
        XCTAssertEqual(HubEventGoodsSalesChannel.online.displayName, "온라인")
        XCTAssertEqual(HubEventGoodsSalesChannel.both.displayName, "현장·온라인")
    }

    func testHTTPSURLOnly() {
        XCTAssertNotNil(HubEventGoodsPolicy.httpsURL("https://shop.example.com/a"))
        XCTAssertNil(HubEventGoodsPolicy.httpsURL("http://shop.example.com/a"))
        XCTAssertNil(HubEventGoodsPolicy.httpsURL("javascript:alert(1)"))
        XCTAssertNil(HubEventGoodsPolicy.httpsURL("https://"))
        XCTAssertNil(HubEventGoodsPolicy.httpsURL(nil))
        XCTAssertNil(HubEventGoodsPolicy.httpsURL("  "))
    }

    // MARK: - Checklist summary

    func testSummaryTotalsPricedItemsOnly() {
        let items = [item("a", price: 12_000), item("b", price: 5_000), item("c")]
        let summary = HubEventGoodsPolicy.summary(items: items, quantities: ["a": 2, "b": 1])
        XCTAssertEqual(summary, .init(selectedCount: 2, total: 29_000, includesUnpriced: false))
        XCTAssertEqual(summary.text, "선택 2개 · 예상 합계 29,000원")
    }

    func testSummaryFlagsUnpricedChecked() {
        let items = [item("a", price: 12_000), item("c")]
        let summary = HubEventGoodsPolicy.summary(items: items, quantities: ["a": 1, "c": 3])
        XCTAssertEqual(summary.selectedCount, 2)
        XCTAssertEqual(summary.total, 12_000)
        XCTAssertEqual(summary.text, "선택 2개 · 예상 합계 12,000원 (가격 미정 포함)")
    }

    func testSummaryEmptyAndIgnoresUnknownAndBonusEntries() {
        let items = [item("a", price: 1_000), item("bonus", price: 500, bonus: true)]
        XCTAssertEqual(HubEventGoodsPolicy.summary(items: items, quantities: [:]).text, "선택 0개 · 예상 합계 0원")
        let stale = HubEventGoodsPolicy.summary(items: items, quantities: ["ghost": 2, "bonus": 1])
        XCTAssertEqual(stale.selectedCount, 0)
    }

    func testQuantityClamp() {
        XCTAssertEqual(HubEventGoodsPolicy.clampedQuantity(0, for: item("a")), 1)
        XCTAssertEqual(HubEventGoodsPolicy.clampedQuantity(500, for: item("a")), 99)
        XCTAssertEqual(HubEventGoodsPolicy.clampedQuantity(5, for: item("a", limit: 3)), 3)
        XCTAssertEqual(HubEventGoodsPolicy.clampedQuantity(2, for: item("a", limit: 3)), 2)
        XCTAssertEqual(HubEventGoodsPolicy.clampedQuantity(150, for: item("a", limit: 200)), 150)
    }

    // MARK: - Mock data

    @MainActor
    func testMockStoreSeedsGoodsOnOnePopupEvent() {
        let events = MockHubStore().hubEvents(for: "all").filter { !$0.goodsItems.isEmpty }
        XCTAssertEqual(events.count, 1)
        XCTAssertGreaterThanOrEqual(events[0].goodsItems.count, 2)
        XCTAssertTrue(events[0].goodsItems.allSatisfy { $0.image == nil })
    }

    private func event(items: [HubEventGoodsItem] = [], goodsCount: Int? = nil) -> HubEvent {
        HubEvent(
            id: "e1", category: .offlinePopup, participationMode: .offline, status: .open, title: "팝업",
            summary: nil, memberId: nil, generationId: "official", sourceUrl: "https://example.com",
            sourceLabel: "공식", sourceType: .official, announcedAt: nil, startsAt: nil, endsAt: nil,
            purchaseUrl: nil, ticketUrl: nil, venueName: nil, venueAddress: nil,
            goodsItems: items, goodsCount: goodsCount,
            notificationEligible: true, updatedAt: Date(timeIntervalSince1970: 0)
        )
    }
}
