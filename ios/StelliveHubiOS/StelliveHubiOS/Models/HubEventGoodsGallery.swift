import Foundation

// "공식 MD 리스트" image gallery: lenient wire decoding and pure presentation rules.
//
// Rollback note: the gallery renders only when the server sends `goodsListImages`. When the server kill switch
// (HUB_EVENT_GOODS_GALLERY_ENABLED=false) removes the field, every function here yields "hidden / items only" and the
// pre-gallery UI is shown unchanged. The small domain types live in HubModels.swift because the widget target
// compiles that file but not this one.

// MARK: - Wire decoding

/// One `goodsListImages` entry: the shared `HubEventImage` fields plus the gallery-only `kind`.
struct HubEventGoodsGalleryImageResponse: Codable, Equatable {
    let image: HubEventImage
    let kind: HubEventGoodsListImageKind

    private enum CodingKeys: String, CodingKey {
        case kind
    }

    init(image: HubEventImage, kind: HubEventGoodsListImageKind = .md) {
        self.image = image
        self.kind = kind
    }

    /// Throws when the entry is not an object or its image fields are unusable; the list wrapper drops such entries.
    /// An absent, non-string or unknown `kind` is `md`.
    init(from decoder: Decoder) throws {
        image = try HubEventImage(from: decoder)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawKind = (try? container.decodeIfPresent(String.self, forKey: .kind)) ?? nil
        kind = rawKind.flatMap(HubEventGoodsListImageKind.init(rawValue:)) ?? .md
    }

    func encode(to encoder: Encoder) throws {
        try image.encode(to: encoder)
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(kind.rawValue, forKey: .kind)
    }
}

/// `goodsListImages` array that drops undecodable or non-object elements (and tolerates a non-array value) instead of
/// failing the surrounding event.
struct LenientGoodsGalleryImageList: Codable, Equatable {
    let images: [HubEventGoodsGalleryImageResponse]

    private struct Element: Decodable {
        let value: HubEventGoodsGalleryImageResponse?
        init(from decoder: Decoder) throws {
            value = try? HubEventGoodsGalleryImageResponse(from: decoder)
        }
    }

    init(images: [HubEventGoodsGalleryImageResponse]) {
        self.images = images
    }

    init(from decoder: Decoder) throws {
        guard
            let container = try? decoder.singleValueContainer(),
            let elements = try? container.decode([Element].self)
        else {
            images = []
            return
        }
        images = elements.compactMap(\.value)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(images)
    }
}

/// `goodsListLayout` that never fails the event: absent, non-string or unknown values fall back to `split`.
struct LenientGoodsListLayout: Codable, Equatable {
    let layout: HubEventGoodsListLayout

    init(layout: HubEventGoodsListLayout) {
        self.layout = layout
    }

    init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? nil
        layout = raw.flatMap(HubEventGoodsListLayout.init(rawValue:)) ?? .split
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(layout.rawValue)
    }
}

// MARK: - Presentation policy

/// Which parts of the goods section render for a given (goods items x gallery images) combination.
enum HubEventGoodsSectionMode: Equatable {
    /// No goods items and no gallery images: the whole section is hidden.
    case hidden
    /// Goods items only (pre-gallery behaviour).
    case itemsOnly
    /// Gallery on top of the goods list and checklist.
    case galleryWithItems
    /// Image-only notice: gallery plus a "goods list not registered yet" note.
    case galleryOnly
}

enum HubEventGoodsGalleryPolicy {
    static let maxImages = 20
    static let mdSectionTitle = "공식 MD 리스트"
    static let bonusSectionTitle = "특전"
    static let defaultSourceLabel = "공식 공지"
    static let noticeLinkSuffix = "공식 공지 ↗"
    static let emptyItemsNotice = "상품 목록은 아직 등록되지 않았어요.\n위 MD 리스트 이미지에서 확인하세요."
    static let purchaseButtonLabel = "구매 페이지 ↗"

    /// One strip in the gallery card. The viewer pages within a row's images only.
    struct Row: Equatable, Identifiable {
        /// `nil` for the single-layout row that mixes both kinds.
        let kind: HubEventGoodsListImageKind?
        let title: String
        let images: [HubEventGoodsListImage]
        var id: String { kind?.rawValue ?? "all" }
    }

    // MARK: Sanitizing

    private static let allowedHosts: Set<String> = ["stellive.me", "pbs.twimg.com"]

    /// Host allowlist for gallery images: stellive.me, any *.stellive.me, and pbs.twimg.com.
    static func isAllowedHost(_ host: String?) -> Bool {
        guard let host = host?.lowercased(), !host.isEmpty else { return false }
        return allowedHosts.contains(host) || host.hasSuffix(".stellive.me")
    }

    static func sanitize(_ images: [HubEventGoodsListImage]) -> [HubEventGoodsListImage] {
        var result: [HubEventGoodsListImage] = []
        for entry in images {
            guard let cleaned = cleaned(entry) else { continue }
            result.append(cleaned)
            if result.count == maxImages { break }
        }
        return result
    }

    /// Maps decoded wire entries to domain images (displayable + allowed host, order kept, capped).
    static func domainImages(from list: LenientGoodsGalleryImageList?) -> [HubEventGoodsListImage] {
        sanitize((list?.images ?? []).map { HubEventGoodsListImage(image: $0.image, kind: $0.kind) })
    }

    static func displayableImages(_ event: HubEvent) -> [HubEventGoodsListImage] {
        sanitize(event.goodsListImages)
    }

    private static func cleaned(_ entry: HubEventGoodsListImage) -> HubEventGoodsListImage? {
        let image = entry.image
        let trimmedImage = HubEventImage(
            policyState: image.policyState,
            url: image.url?.trimmed.nilIfEmpty,
            sourceLabel: image.sourceLabel?.trimmed.nilIfEmpty,
            sourceUrl: image.sourceUrl?.trimmed.nilIfEmpty,
            altText: image.altText?.trimmed.nilIfEmpty
        )
        guard
            let url = HubEventImagePolicy.displayURL(for: trimmedImage),
            isAllowedHost(url.host)
        else {
            return nil
        }
        return HubEventGoodsListImage(image: trimmedImage, kind: entry.kind)
    }

    // MARK: Section mode

    static func sectionMode(hasGoodsItems: Bool, imageCount: Int) -> HubEventGoodsSectionMode {
        switch (hasGoodsItems, imageCount > 0) {
        case (true, true): .galleryWithItems
        case (true, false): .itemsOnly
        case (false, true): .galleryOnly
        case (false, false): .hidden
        }
    }

    static func sectionMode(for event: HubEvent) -> HubEventGoodsSectionMode {
        sectionMode(hasGoodsItems: !event.goodsItems.isEmpty, imageCount: displayableImages(event).count)
    }

    static func showsGallery(_ mode: HubEventGoodsSectionMode) -> Bool {
        mode == .galleryWithItems || mode == .galleryOnly
    }

    /// Checklist summary, filter and rows exist only when there are goods items.
    static func showsChecklist(_ mode: HubEventGoodsSectionMode) -> Bool {
        mode == .itemsOnly || mode == .galleryWithItems
    }

    static func showsEmptyItemsNotice(_ mode: HubEventGoodsSectionMode) -> Bool {
        mode == .galleryOnly
    }

    // MARK: Rows

    /// split: an "공식 MD 리스트" row (kind md) then a "특전" row (kind bonus), empty rows omitted.
    /// single: one "공식 MD 리스트" row with every image in notice order.
    static func rows(images: [HubEventGoodsListImage], layout: HubEventGoodsListLayout) -> [Row] {
        guard !images.isEmpty else { return [] }
        switch layout {
        case .single:
            return [Row(kind: nil, title: mdSectionTitle, images: images)]
        case .split:
            let md = images.filter { $0.kind == .md }
            let bonus = images.filter { $0.kind == .bonus }
            var rows: [Row] = []
            if !md.isEmpty { rows.append(Row(kind: .md, title: mdSectionTitle, images: md)) }
            if !bonus.isEmpty { rows.append(Row(kind: .bonus, title: bonusSectionTitle, images: bonus)) }
            return rows
        }
    }

    // MARK: Collapse / expand

    /// Local-only preference (never sent to the server): events with goods items start expanded when true.
    static let expandedByDefaultKey = "goods_gallery_expanded_by_default"
    static let collapsedTitle = "공식 MD 리스트 이미지"
    static let expandControlLabel = "보기 ⌄"
    static let collapseControlLabel = "접기 ⌃"
    static let collapsedThumbnailCount = 3
    static let settingToggleTitle = "굿즈 MD 리스트 이미지 펼쳐서 보기"

    /// The user setting; absent means false (collapsed).
    static func expandedByDefaultSetting(defaults: UserDefaults = .standard) -> Bool {
        defaults.bool(forKey: expandedByDefaultKey)
    }

    /// Starting state of a gallery view. Image-only notices (no goods items) are always expanded.
    static func initiallyExpanded(hasGoodsItems: Bool, expandedByDefault: Bool) -> Bool {
        !hasGoodsItems || expandedByDefault
    }

    /// Collapsed row subtitle: split "MD 7장 · 특전 2장" (empty kinds omitted), single "9장".
    static func collapsedSubtitle(images: [HubEventGoodsListImage], layout: HubEventGoodsListLayout) -> String {
        switch layout {
        case .single:
            return "\(images.count)장"
        case .split:
            let md = images.filter { $0.kind == .md }.count
            let bonus = images.filter { $0.kind == .bonus }.count
            var parts: [String] = []
            if md > 0 { parts.append("MD \(md)장") }
            if bonus > 0 { parts.append("특전 \(bonus)장") }
            return parts.joined(separator: " · ")
        }
    }

    // MARK: Labels

    /// Row header's right side. The notice link is shown once per card, on the first row.
    static func countLabel(imageCount: Int, includesNoticeLink: Bool) -> String {
        includesNoticeLink ? "\(imageCount)장 · \(noticeLinkSuffix)" : "\(imageCount)장"
    }

    /// Thumbnail placeholder label: the image's altText, otherwise "MD n" (bonus images: "특전 n"), 1-based.
    static func thumbnailLabel(_ entry: HubEventGoodsListImage, index: Int) -> String {
        if let alt = entry.image.altText?.trimmed.nilIfEmpty { return alt }
        return entry.kind == .bonus ? "특전 \(index + 1)" : "MD \(index + 1)"
    }

    /// Caption below the strips: the first image that names a source.
    static func stripCaption(_ images: [HubEventGoodsListImage]) -> String {
        let label = images.lazy.compactMap { $0.image.sourceLabel?.trimmed.nilIfEmpty }.first
        return "출처: \(sourceLabel(label)) · 눌러서 크게 보기"
    }

    /// Viewer title: "{altText} · n / N" or "이미지 n / N". `index` is 0-based; N is the viewer sequence length.
    static func viewerTitle(_ image: HubEventImage, index: Int, total: Int) -> String {
        let position = "\(index + 1) / \(total)"
        if let alt = image.altText?.trimmed.nilIfEmpty { return "\(alt) · \(position)" }
        return "이미지 \(position)"
    }

    static func viewerSourceCaption(_ image: HubEventImage) -> String {
        "출처: \(sourceLabel(image.sourceLabel))"
    }

    static func sourceLabel(_ label: String?) -> String {
        label?.trimmed.nilIfEmpty ?? defaultSourceLabel
    }

    static func thumbnailAccessibilityLabel(title: String, label: String, index: Int, total: Int) -> String {
        "\(title) \(label), \(total)장 중 \(index + 1)번째, 눌러서 크게 보기"
    }

    // MARK: URLs

    /// Notice URL: the image's own source if https, otherwise the event's source.
    static func noticeURL(imageSourceUrl: String?, eventSourceUrl: String?) -> URL? {
        httpsURL(imageSourceUrl) ?? httpsURL(eventSourceUrl)
    }

    static func purchaseURL(_ purchaseUrl: String?) -> URL? {
        httpsURL(purchaseUrl)
    }

    private static func httpsURL(_ raw: String?) -> URL? {
        guard
            let trimmed = raw?.trimmed.nilIfEmpty,
            let url = URL(string: trimmed),
            url.scheme?.lowercased() == "https",
            let host = url.host,
            !host.isEmpty
        else {
            return nil
        }
        return url
    }
}
