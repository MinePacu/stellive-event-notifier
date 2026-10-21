import XCTest
@testable import StelliveHubiOS

final class HubEventGoodsGalleryTests: XCTestCase {
    // MARK: - Helpers

    private func decodeEvent(images: String? = nil, layout: String? = nil, goods: String? = nil, purchaseUrl: String? = nil) throws -> HubEventResponse {
        var extra = ""
        if let images { extra += #","goodsListImages":\#(images)"# }
        if let layout { extra += #","goodsListLayout":\#(layout)"# }
        if let goods { extra += #","goodsItems":\#(goods)"# }
        if let purchaseUrl { extra += #","purchaseUrl":"\#(purchaseUrl)""# }
        let json = """
        {"id":"event-1","category":"offline_popup","participationMode":"offline","status":"open",
         "title":"팝업","generationId":"official","sourceUrl":"https://stellive.me/notice/1","sourceLabel":"공식",
         "sourceType":"official","notificationEligible":true,"updatedAt":"2026-06-18T00:00:00.000Z"\(extra)}
        """
        return try JSONDecoder().decode(HubEventResponse.self, from: Data(json.utf8))
    }

    private func entry(_ path: String, kind: String? = nil, extra: String = "") -> String {
        let kindField = kind.map { #","kind":"\#($0)""# } ?? ""
        return #"{"policyState":"official_runtime_url","url":"https://stellive.me/img/\#(path).png"\#(kindField)\#(extra)}"#
    }

    /// Same mapping `HubEventResponse.toHubEvent()` applies (that method is private to ServerHubStore.swift).
    private func images(_ response: HubEventResponse) -> [HubEventGoodsListImage] {
        HubEventGoodsGalleryPolicy.domainImages(from: response.goodsListImages)
    }

    private func layout(_ response: HubEventResponse) -> HubEventGoodsListLayout {
        response.goodsListLayout?.layout ?? .split
    }

    /// End to end: wire JSON -> HubAPIClient -> ServerHubStore.loadHubEventDetail -> HubEvent.
    @MainActor
    private func loadEvent(images: String? = nil, layout: String? = nil, goods: String? = nil) async throws -> HubEvent {
        var extra = ""
        if let images { extra += #","goodsListImages":\#(images)"# }
        if let layout { extra += #","goodsListLayout":\#(layout)"# }
        if let goods { extra += #","goodsItems":\#(goods)"# }
        let json = """
        {"id":"e1","category":"offline_popup","participationMode":"offline","status":"open","title":"팝업",
         "generationId":"official","sourceUrl":"https://stellive.me/notice/1","sourceLabel":"공식","sourceType":"official",
         "notificationEligible":true,"updatedAt":"2026-06-18T00:00:00.000Z"\(extra)}
        """
        GalleryStubURLProtocol.body = json
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [GalleryStubURLProtocol.self]
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "HubEventGoodsGalleryTests-\(UUID().uuidString)"))
        let store = ServerHubStore(
            api: HubAPIClient(baseURL: URL(string: "https://example.invalid")!, session: URLSession(configuration: configuration)),
            deviceIDStore: DeviceIDStore(defaults: defaults, secureStore: InMemorySecureValueStore()),
            fallback: MockHubStore()
        )
        let event = await store.loadHubEventDetail(id: "e1")
        return try XCTUnwrap(event)
    }

    private func image(_ url: String, kind: HubEventGoodsListImageKind = .md, alt: String? = nil, label: String? = nil, state: HubEventImagePolicyState = .officialRuntimeUrl) -> HubEventGoodsListImage {
        HubEventGoodsListImage(
            image: HubEventImage(policyState: state, url: url, sourceLabel: label, sourceUrl: nil, altText: alt),
            kind: kind
        )
    }

    // MARK: - Decoding

    func testAbsentFieldsDecodeAsEmptyAndSplit() throws {
        let response = try decodeEvent()
        XCTAssertNil(response.goodsListImages)
        XCTAssertNil(response.goodsListLayout)
        XCTAssertTrue(images(response).isEmpty)
        XCTAssertEqual(layout(response), .split)
    }

    @MainActor
    func testStoreMapsAbsentFieldsToPreGalleryEvent() async throws {
        let event = try await loadEvent()
        XCTAssertTrue(event.goodsListImages.isEmpty)
        XCTAssertEqual(event.goodsListLayout, .split)
        XCTAssertEqual(HubEventGoodsGalleryPolicy.sectionMode(for: event), .hidden)
    }

    @MainActor
    func testStoreMapsGalleryKindAndLayoutEndToEnd() async throws {
        let raw = "[\(entry("a", kind: "bonus")), 42, \(entry("b")), {\"policyState\":\"blocked\"}]"
        let event = try await loadEvent(images: raw, layout: "\"single\"", goods: #"[{"id":"g1","name":"스탠드"}]"#)
        XCTAssertEqual(event.goodsListImages.map(\.kind), [.bonus, .md])
        XCTAssertEqual(event.goodsListLayout, .single)
        XCTAssertEqual(event.goodsItems.count, 1)
        XCTAssertEqual(HubEventGoodsGalleryPolicy.sectionMode(for: event), .galleryWithItems)

        let imageOnly = try await loadEvent(images: raw, layout: "\"bogus\"")
        XCTAssertEqual(imageOnly.goodsListLayout, .split)
        XCTAssertEqual(HubEventGoodsGalleryPolicy.sectionMode(for: imageOnly), .galleryOnly)

        let itemsOnly = try await loadEvent(goods: #"[{"id":"g1","name":"스탠드"}]"#)
        XCTAssertEqual(HubEventGoodsGalleryPolicy.sectionMode(for: itemsOnly), .itemsOnly)
    }

    func testEmptyArrayDecodesEmpty() throws {
        XCTAssertTrue(images(try decodeEvent(images: "[]")).isEmpty)
    }

    func testNonArrayValueDoesNotFailEvent() throws {
        XCTAssertTrue(images(try decodeEvent(images: #"{"a":1}"#)).isEmpty)
        XCTAssertTrue(images(try decodeEvent(images: "\"oops\"")).isEmpty)
        XCTAssertTrue(images(try decodeEvent(images: "null")).isEmpty)
    }

    func testOrderIsPreserved() throws {
        let list = images(try decodeEvent(images: "[\(entry("a")),\(entry("b")),\(entry("c"))]"))
        XCTAssertEqual(list.map(\.image.url), [
            "https://stellive.me/img/a.png", "https://stellive.me/img/b.png", "https://stellive.me/img/c.png",
        ])
    }

    func testMalformedAndNonObjectEntriesAreDroppedWithoutFailingEvent() throws {
        let raw = """
        [\(entry("ok1")), 42, "text", null, [1,2], {"policyState":"bogus_state","url":"https://stellive.me/x.png"},
         {"url":"https://stellive.me/no-state.png"}, {"policyState":"official_runtime_url","url":5}, \(entry("ok2"))]
        """
        let list = images(try decodeEvent(images: raw))
        XCTAssertEqual(list.map(\.image.url), ["https://stellive.me/img/ok1.png", "https://stellive.me/img/ok2.png"])
    }

    func testNonDisplayableEntriesAreDropped() throws {
        let raw = """
        [{"policyState":"official_runtime_url","url":"http://stellive.me/insecure.png"},
         {"policyState":"blocked","url":"https://stellive.me/blocked.png"},
         {"policyState":"verify_required","url":"https://stellive.me/verify.png"},
         {"policyState":"none","url":"https://stellive.me/none.png"},
         {"policyState":"official_runtime_url"},
         {"policyState":"official_runtime_url","url":"not a url"},
         \(entry("kept"))]
        """
        XCTAssertEqual(images(try decodeEvent(images: raw)).map(\.image.url), ["https://stellive.me/img/kept.png"])
    }

    func testHostAllowlist() throws {
        func state(_ url: String) -> String { #"{"policyState":"official_runtime_url","url":"\#(url)"}"# }
        let raw = """
        [\(state("https://stellive.me/a.png")), \(state("https://cdn.stellive.me/b.png")),
         \(state("https://pbs.twimg.com/media/c.jpg")), \(state("https://STELLIVE.ME/d.png")),
         \(state("https://evil.com/e.png")), \(state("https://stellive.me.evil.com/f.png")),
         \(state("https://notstellive.me/g.png")), \(state("https://twimg.com/h.png")),
         \(state("https://abs.twimg.com/i.png"))]
        """
        XCTAssertEqual(images(try decodeEvent(images: raw)).compactMap(\.image.url), [
            "https://stellive.me/a.png", "https://cdn.stellive.me/b.png",
            "https://pbs.twimg.com/media/c.jpg", "https://STELLIVE.ME/d.png",
        ])
    }

    func testThirdPartyAllowedStateIsDisplayableWhenHostAllowed() throws {
        let raw = #"[{"policyState":"third_party_allowed","url":"https://pbs.twimg.com/media/x.jpg"}]"#
        XCTAssertEqual(images(try decodeEvent(images: raw)).count, 1)
    }

    func testCapsAtTwentyAfterFiltering() throws {
        let bad = #"{"policyState":"blocked","url":"https://stellive.me/blocked.png"}"#
        let entries = [bad] + (0..<25).map { entry("img\($0)") }
        let list = images(try decodeEvent(images: "[\(entries.joined(separator: ","))]"))
        XCTAssertEqual(list.count, 20)
        XCTAssertEqual(list.first?.image.url, "https://stellive.me/img/img0.png")
        XCTAssertEqual(list.last?.image.url, "https://stellive.me/img/img19.png")
    }

    func testUrlAndTextAreTrimmedAndBlankTextBecomesNil() throws {
        let raw = #"[{"policyState":"official_runtime_url","url":"  https://stellive.me/a.png ","sourceLabel":"  ","altText":" MD 1 "}]"#
        let item = try XCTUnwrap(images(try decodeEvent(images: raw)).first)
        XCTAssertEqual(item.image.url, "https://stellive.me/a.png")
        XCTAssertNil(item.image.sourceLabel)
        XCTAssertEqual(item.image.altText, "MD 1")
    }

    func testGoodsItemsAndGalleryDecodeIndependently() throws {
        let response = try decodeEvent(images: "[\(entry("a"))]", goods: #"[{"id":"g1","name":"스탠드"}]"#)
        XCTAssertEqual(response.goodsItems?.items.count, 1)
        XCTAssertEqual(images(response).count, 1)
    }

    func testEncodeRoundTripKeepsKind() throws {
        let response = try decodeEvent(images: "[\(entry("a", kind: "bonus"))]", layout: "\"single\"")
        let data = try JSONEncoder().encode(response)
        XCTAssertEqual(try JSONDecoder().decode(HubEventResponse.self, from: data), response)
    }

    // MARK: - kind / layout

    func testKindDecoding() throws {
        let raw = """
        [\(entry("a")), \(entry("b", kind: "md")), \(entry("c", kind: "bonus")), \(entry("d", kind: "weird")),
         {"policyState":"official_runtime_url","url":"https://stellive.me/img/e.png","kind":7},
         {"policyState":"official_runtime_url","url":"https://stellive.me/img/f.png","kind":null}]
        """
        XCTAssertEqual(images(try decodeEvent(images: raw)).map(\.kind), [.md, .md, .bonus, .md, .md, .md])
    }

    func testLayoutFallback() throws {
        XCTAssertEqual(layout(try decodeEvent(layout: "\"split\"")), .split)
        XCTAssertEqual(layout(try decodeEvent(layout: "\"single\"")), .single)
        XCTAssertEqual(layout(try decodeEvent(layout: "\"grid\"")), .split)
        XCTAssertEqual(layout(try decodeEvent(layout: "3")), .split)
        XCTAssertEqual(layout(try decodeEvent(layout: "null")), .split)
        XCTAssertEqual(layout(try decodeEvent(layout: "{}")), .split)
    }

    // MARK: - Section mode

    func testSectionModeMatrix() {
        typealias Policy = HubEventGoodsGalleryPolicy
        XCTAssertEqual(Policy.sectionMode(hasGoodsItems: true, imageCount: 3), .galleryWithItems)
        XCTAssertEqual(Policy.sectionMode(hasGoodsItems: false, imageCount: 3), .galleryOnly)
        XCTAssertEqual(Policy.sectionMode(hasGoodsItems: true, imageCount: 0), .itemsOnly)
        XCTAssertEqual(Policy.sectionMode(hasGoodsItems: false, imageCount: 0), .hidden)

        XCTAssertTrue(Policy.showsGallery(.galleryWithItems))
        XCTAssertTrue(Policy.showsGallery(.galleryOnly))
        XCTAssertFalse(Policy.showsGallery(.itemsOnly))
        XCTAssertFalse(Policy.showsGallery(.hidden))
        XCTAssertTrue(Policy.showsChecklist(.galleryWithItems))
        XCTAssertTrue(Policy.showsChecklist(.itemsOnly))
        XCTAssertFalse(Policy.showsChecklist(.galleryOnly))
        XCTAssertFalse(Policy.showsChecklist(.hidden))
        XCTAssertTrue(Policy.showsEmptyItemsNotice(.galleryOnly))
        XCTAssertFalse(Policy.showsEmptyItemsNotice(.galleryWithItems))
    }

    @MainActor
    func testDisplayableImagesReappliesClientRules() async throws {
        var event = try await loadEvent()
        event.goodsListImages = [image("https://evil.com/a.png"), image("https://stellive.me/a.png")]
        XCTAssertEqual(HubEventGoodsGalleryPolicy.displayableImages(event).count, 1)
    }

    @MainActor
    func testDetailNoticeAddsImageSourceReasonOnlyWithGallery() async throws {
        var event = try await loadEvent()
        event.goodsListImages = []
        XCTAssertEqual(HubEventGoodsGalleryPolicy.detailNoticeText(for: event), HubEventDetailFormatting.noticeText)
        event.goodsListImages = [image("https://stellive.me/a.png")]
        let text = HubEventGoodsGalleryPolicy.detailNoticeText(for: event)
        XCTAssertTrue(text.hasPrefix(HubEventDetailFormatting.noticeText))
        XCTAssertTrue(text.hasSuffix(HubEventGoodsGalleryPolicy.imageSourceNotice))
        XCTAssertTrue(HubEventGoodsGalleryPolicy.imageSourceNotice.contains("이용약관"))
    }

    // MARK: - Rows / viewer sequence

    func testSplitRowsGroupByKindAndKeepOrder() {
        let list = [
            image("https://stellive.me/1.png", kind: .md),
            image("https://stellive.me/2.png", kind: .bonus),
            image("https://stellive.me/3.png", kind: .md),
            image("https://stellive.me/4.png", kind: .bonus),
        ]
        let rows = HubEventGoodsGalleryPolicy.rows(images: list, layout: .split)
        XCTAssertEqual(rows.map(\.title), ["공식 MD 리스트", "특전"])
        XCTAssertEqual(rows[0].images.map(\.image.url), ["https://stellive.me/1.png", "https://stellive.me/3.png"])
        XCTAssertEqual(rows[1].images.map(\.image.url), ["https://stellive.me/2.png", "https://stellive.me/4.png"])
    }

    func testSplitHidesEmptyRows() {
        let mdOnly = [image("https://stellive.me/1.png", kind: .md)]
        XCTAssertEqual(HubEventGoodsGalleryPolicy.rows(images: mdOnly, layout: .split).map(\.title), ["공식 MD 리스트"])
        let bonusOnly = [image("https://stellive.me/1.png", kind: .bonus)]
        XCTAssertEqual(HubEventGoodsGalleryPolicy.rows(images: bonusOnly, layout: .split).map(\.title), ["특전"])
        XCTAssertTrue(HubEventGoodsGalleryPolicy.rows(images: [], layout: .split).isEmpty)
        XCTAssertTrue(HubEventGoodsGalleryPolicy.rows(images: [], layout: .single).isEmpty)
    }

    func testSingleLayoutIsOneRowWithAllImagesInOrder() {
        let list = [
            image("https://stellive.me/1.png", kind: .md),
            image("https://stellive.me/2.png", kind: .bonus),
            image("https://stellive.me/3.png", kind: .md),
        ]
        let rows = HubEventGoodsGalleryPolicy.rows(images: list, layout: .single)
        XCTAssertEqual(rows.count, 1)
        XCTAssertEqual(rows[0].title, "공식 MD 리스트")
        XCTAssertEqual(rows[0].images, list)
    }

    func testViewerSequenceIsTheTappedRowsImages() {
        let list = [
            image("https://stellive.me/1.png", kind: .md, alt: "MD A"),
            image("https://stellive.me/2.png", kind: .bonus, alt: "특전 A"),
            image("https://stellive.me/3.png", kind: .bonus, alt: "특전 B"),
        ]
        let split = HubEventGoodsGalleryPolicy.rows(images: list, layout: .split)
        let bonusSequence = split[1].images.map(\.image)
        XCTAssertEqual(bonusSequence.count, 2)
        XCTAssertEqual(HubEventGoodsGalleryPolicy.viewerTitle(bonusSequence[1], index: 1, total: bonusSequence.count), "특전 B · 2 / 2")
        let single = HubEventGoodsGalleryPolicy.rows(images: list, layout: .single)[0].images.map(\.image)
        XCTAssertEqual(HubEventGoodsGalleryPolicy.viewerTitle(single[1], index: 1, total: single.count), "특전 A · 2 / 3")
    }

    // MARK: - Collapse / expand

    func testInitialExpandedStateMatrix() {
        typealias Policy = HubEventGoodsGalleryPolicy
        XCTAssertFalse(Policy.initiallyExpanded(hasGoodsItems: true, expandedByDefault: false))
        XCTAssertTrue(Policy.initiallyExpanded(hasGoodsItems: true, expandedByDefault: true))
        XCTAssertTrue(Policy.initiallyExpanded(hasGoodsItems: false, expandedByDefault: false))
        XCTAssertTrue(Policy.initiallyExpanded(hasGoodsItems: false, expandedByDefault: true))
    }

    func testExpandedByDefaultSettingDefaultsToOffAndIsLocalDefaultsBacked() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "HubEventGoodsGalleryTests-\(UUID().uuidString)"))
        XCTAssertFalse(HubEventGoodsGalleryPolicy.expandedByDefaultSetting(defaults: defaults))
        defaults.set(true, forKey: HubEventGoodsGalleryPolicy.expandedByDefaultKey)
        XCTAssertTrue(HubEventGoodsGalleryPolicy.expandedByDefaultSetting(defaults: defaults))
        defaults.set(false, forKey: HubEventGoodsGalleryPolicy.expandedByDefaultKey)
        XCTAssertFalse(HubEventGoodsGalleryPolicy.expandedByDefaultSetting(defaults: defaults))
        XCTAssertEqual(HubEventGoodsGalleryPolicy.expandedByDefaultKey, "goods_gallery_expanded_by_default")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.settingToggleTitle, "굿즈 MD 리스트 이미지 펼쳐서 보기")
    }

    func testCollapsedSubtitleAndLabels() {
        let list = (0..<7).map { _ in image("https://stellive.me/m.png", kind: .md) }
            + (0..<2).map { _ in image("https://stellive.me/b.png", kind: .bonus) }
        XCTAssertEqual(HubEventGoodsGalleryPolicy.collapsedSubtitle(images: list, layout: .split), "MD 7장 · 특전 2장")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.collapsedSubtitle(images: list, layout: .single), "9장")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.collapsedSubtitle(images: Array(list.prefix(7)), layout: .split), "MD 7장")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.collapsedSubtitle(images: Array(list.suffix(2)), layout: .split), "특전 2장")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.collapsedTitle, "공식 MD 리스트 이미지")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.expandControlLabel, "보기 ⌄")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.collapseControlLabel, "접기 ⌃")
    }

    func testOnlyItemModesAreCollapsible() {
        // The view passes showsChecklist(mode) as isCollapsible: image-only notices never collapse.
        XCTAssertTrue(HubEventGoodsGalleryPolicy.showsChecklist(.galleryWithItems))
        XCTAssertFalse(HubEventGoodsGalleryPolicy.showsChecklist(.galleryOnly))
    }

    // MARK: - Labels

    func testThumbnailLabelFallbacks() {
        XCTAssertEqual(HubEventGoodsGalleryPolicy.thumbnailLabel(image("https://stellive.me/1.png", alt: "MD 리스트 1"), index: 0), "MD 리스트 1")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.thumbnailLabel(image("https://stellive.me/1.png", alt: "  "), index: 2), "MD 3")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.thumbnailLabel(image("https://stellive.me/1.png"), index: 0), "MD 1")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.thumbnailLabel(image("https://stellive.me/1.png", kind: .bonus), index: 1), "특전 2")
    }

    func testCountLabel() {
        XCTAssertEqual(HubEventGoodsGalleryPolicy.countLabel(imageCount: 9, includesNoticeLink: true), "9장 · 공식 공지 ↗")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.countLabel(imageCount: 2, includesNoticeLink: false), "2장")
    }

    func testStripCaptionUsesFirstNamedSourceOrDefault() {
        let named = [image("https://stellive.me/1.png"), image("https://stellive.me/2.png", label: " 스텔라이브 공지 ")]
        XCTAssertEqual(HubEventGoodsGalleryPolicy.stripCaption(named), "출처: 스텔라이브 공지 · 눌러서 크게 보기")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.stripCaption([image("https://stellive.me/1.png")]), "출처: 공식 공지 · 눌러서 크게 보기")
    }

    func testViewerTitleAndCaption() {
        let withAlt = image("https://stellive.me/1.png", alt: "MD 리스트 3", label: "공식").image
        XCTAssertEqual(HubEventGoodsGalleryPolicy.viewerTitle(withAlt, index: 2, total: 9), "MD 리스트 3 · 3 / 9")
        let without = image("https://stellive.me/1.png").image
        XCTAssertEqual(HubEventGoodsGalleryPolicy.viewerTitle(without, index: 0, total: 4), "이미지 1 / 4")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.viewerSourceCaption(withAlt), "출처: 공식")
        XCTAssertEqual(HubEventGoodsGalleryPolicy.viewerSourceCaption(without), "출처: 공식 공지")
    }

    // MARK: - URL rules

    func testNoticeURLPrefersImageSourceThenEventSource() {
        XCTAssertEqual(
            HubEventGoodsGalleryPolicy.noticeURL(imageSourceUrl: "https://stellive.me/n/1", eventSourceUrl: "https://stellive.me/n/2")?.absoluteString,
            "https://stellive.me/n/1"
        )
        XCTAssertEqual(
            HubEventGoodsGalleryPolicy.noticeURL(imageSourceUrl: "http://stellive.me/n/1", eventSourceUrl: "https://stellive.me/n/2")?.absoluteString,
            "https://stellive.me/n/2"
        )
        XCTAssertEqual(
            HubEventGoodsGalleryPolicy.noticeURL(imageSourceUrl: nil, eventSourceUrl: "https://stellive.me/n/2")?.absoluteString,
            "https://stellive.me/n/2"
        )
        XCTAssertNil(HubEventGoodsGalleryPolicy.noticeURL(imageSourceUrl: "javascript:alert(1)", eventSourceUrl: "http://stellive.me/n"))
        XCTAssertNil(HubEventGoodsGalleryPolicy.noticeURL(imageSourceUrl: nil, eventSourceUrl: nil))
        XCTAssertNil(HubEventGoodsGalleryPolicy.noticeURL(imageSourceUrl: "https://", eventSourceUrl: ""))
    }

    func testPurchaseURLRequiresHttps() {
        XCTAssertNotNil(HubEventGoodsGalleryPolicy.purchaseURL("https://shop.example.com/buy"))
        XCTAssertNil(HubEventGoodsGalleryPolicy.purchaseURL("http://shop.example.com/buy"))
        XCTAssertNil(HubEventGoodsGalleryPolicy.purchaseURL("ftp://shop.example.com"))
        XCTAssertNil(HubEventGoodsGalleryPolicy.purchaseURL(nil))
        XCTAssertNil(HubEventGoodsGalleryPolicy.purchaseURL("  "))
    }

    // MARK: - Loader sizing

    func testMaxPixelSizeFillTopAlignedThumbnail() {
        let target = CGSize(width: 186, height: 252)
        // Tall page: width drives the scale, so the longest side must stay tall enough to cover the width.
        XCTAssertEqual(HubEventGoodsGalleryImageLoader.maxPixelSize(source: CGSize(width: 1000, height: 6000), sizing: .fill(target)), 1116)
        // Wide image: height drives the scale.
        XCTAssertEqual(HubEventGoodsGalleryImageLoader.maxPixelSize(source: CGSize(width: 2000, height: 500), sizing: .fill(target)), 1008)
        // Never upscale.
        XCTAssertEqual(HubEventGoodsGalleryImageLoader.maxPixelSize(source: CGSize(width: 100, height: 120), sizing: .fill(target)), 120)
    }

    func testMaxPixelSizeFitBound() {
        let bound = CGSize(width: 2000, height: 4000)
        XCTAssertEqual(HubEventGoodsGalleryImageLoader.maxPixelSize(source: CGSize(width: 1000, height: 6000), sizing: .fit(bound)), 4000)
        XCTAssertEqual(HubEventGoodsGalleryImageLoader.maxPixelSize(source: CGSize(width: 800, height: 1200), sizing: .fit(bound)), 1200)
        XCTAssertEqual(HubEventGoodsGalleryImageLoader.maxPixelSize(source: .zero, sizing: .fit(bound)), 1)
        XCTAssertEqual(
            HubEventGoodsGalleryImageLoader.maxPixelSize(source: CGSize(width: 100, height: 100_000), sizing: .fit(CGSize(width: 1_000_000, height: 1_000_000))),
            HubEventGoodsGalleryImageLoader.maxPixelSizeCap
        )
    }
}

private final class GalleryStubURLProtocol: URLProtocol {
    static var body = "{}"

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(Self.body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
