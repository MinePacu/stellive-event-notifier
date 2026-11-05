import Foundation

// MARK: - Lenient wire decoding

/// One goods item as it appears on the wire. Decoding is lenient: only a non-blank `id` and `name`
/// are mandatory (otherwise the item is skipped); every other field that is missing or malformed
/// decodes to `nil` instead of failing the whole event.
struct HubEventGoodsItemResponse: Codable, Equatable {
    let id: String
    let scheduleItemId: String?
    let name: String
    let groupLabel: String?
    let memberIds: [String]
    let priceKrw: Int?
    let priceNote: String?
    let salesChannel: String?
    let purchaseLimit: Int?
    let limitNote: String?
    let isBonus: Bool
    let purchaseUrl: String?
    let image: HubEventImage?
    let sortOrder: Int
    let createdAt: String?
    let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, scheduleItemId, name, groupLabel, memberIds, priceKrw, priceNote, salesChannel
        case purchaseLimit, limitNote, isBonus, purchaseUrl, image, sortOrder, createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawId = try container.decode(String.self, forKey: .id)
        let rawName = try container.decode(String.self, forKey: .name)
        guard !rawId.trimmed.isEmpty, !rawName.trimmed.isEmpty else {
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "goods item requires id and name")
            )
        }
        id = rawId
        name = rawName
        scheduleItemId = try? container.decodeIfPresent(String.self, forKey: .scheduleItemId)
        groupLabel = try? container.decodeIfPresent(String.self, forKey: .groupLabel)
        memberIds = (try? container.decodeIfPresent([String].self, forKey: .memberIds)) ?? []
        priceKrw = try? container.decodeIfPresent(Int.self, forKey: .priceKrw)
        priceNote = try? container.decodeIfPresent(String.self, forKey: .priceNote)
        salesChannel = try? container.decodeIfPresent(String.self, forKey: .salesChannel)
        purchaseLimit = try? container.decodeIfPresent(Int.self, forKey: .purchaseLimit)
        limitNote = try? container.decodeIfPresent(String.self, forKey: .limitNote)
        isBonus = (try? container.decodeIfPresent(Bool.self, forKey: .isBonus)) ?? false
        purchaseUrl = try? container.decodeIfPresent(String.self, forKey: .purchaseUrl)
        image = try? container.decodeIfPresent(HubEventImage.self, forKey: .image)
        sortOrder = (try? container.decodeIfPresent(Int.self, forKey: .sortOrder)) ?? 0
        createdAt = try? container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try? container.decodeIfPresent(String.self, forKey: .updatedAt)
    }

    /// Applies the client-side sanity rules shared with Android: negative price, limit < 1 and
    /// non-https purchase URLs are dropped; an unknown sales channel becomes `nil`.
    func toDomain() -> HubEventGoodsItem {
        HubEventGoodsItem(
            id: id,
            scheduleItemId: scheduleItemId?.trimmed.nilIfEmpty,
            name: name.trimmed,
            groupLabel: groupLabel?.trimmed.nilIfEmpty,
            memberIds: memberIds,
            priceKrw: priceKrw.flatMap { $0 >= 0 ? $0 : nil },
            priceNote: priceNote?.trimmed.nilIfEmpty,
            salesChannel: salesChannel.flatMap(HubEventGoodsSalesChannel.init(rawValue:)),
            purchaseLimit: purchaseLimit.flatMap { $0 >= 1 ? $0 : nil },
            limitNote: limitNote?.trimmed.nilIfEmpty,
            isBonus: isBonus,
            purchaseUrl: HubEventGoodsPolicy.httpsURL(purchaseUrl)?.absoluteString,
            image: image,
            sortOrder: sortOrder,
            createdAt: createdAt.flatMap(Self.parseDate),
            updatedAt: updatedAt.flatMap(Self.parseDate)
        )
    }

    private static func parseDate(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}

/// `goodsItems` array that drops undecodable elements (and tolerates a non-array value) instead of
/// failing the surrounding event.
struct LenientGoodsItemList: Codable, Equatable {
    let items: [HubEventGoodsItemResponse]

    private struct Element: Decodable {
        let value: HubEventGoodsItemResponse?
        init(from decoder: Decoder) throws {
            value = try? HubEventGoodsItemResponse(from: decoder)
        }
    }

    init(items: [HubEventGoodsItemResponse]) {
        self.items = items
    }

    init(from decoder: Decoder) throws {
        guard
            let container = try? decoder.singleValueContainer(),
            let elements = try? container.decode([Element].self)
        else {
            items = []
            return
        }
        items = elements.compactMap(\.value)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(items)
    }
}

// MARK: - Presentation policy

enum HubEventGoodsPolicy {
    static let collapseThreshold = 8
    static let defaultMaxQuantity = 99
    static let otherGroupLabel = "기타"
    static let maxInlineMemberNames = 3

    struct Group: Equatable, Identifiable {
        /// `nil` for the trailing "기타" group of items without a `groupLabel`.
        let label: String?
        let items: [HubEventGoodsItem]
        var id: String { label.map { "label:\($0)" } ?? "other" }
        var title: String { label ?? HubEventGoodsPolicy.otherGroupLabel }
    }

    struct Presentation: Equatable {
        let groups: [Group]
        /// Items matching the member filter (before collapsing).
        let totalCount: Int
        let visibleCount: Int
        let isCollapsed: Bool
        let memberFilterIds: [String]
        let selectedMemberId: String?
        var showsMemberFilter: Bool { memberFilterIds.count >= 2 }
        var showsExpandToggle: Bool { totalCount > HubEventGoodsPolicy.collapseThreshold }
    }

    static func sorted(_ items: [HubEventGoodsItem]) -> [HubEventGoodsItem] {
        items.sorted { left, right in
            left.sortOrder == right.sortOrder ? left.id < right.id : left.sortOrder < right.sortOrder
        }
    }

    static func httpsURL(_ rawValue: String?) -> URL? {
        guard
            let value = rawValue?.trimmed, !value.isEmpty,
            let components = URLComponents(string: value),
            components.scheme?.lowercased() == "https",
            let host = components.host, !host.isEmpty,
            let url = components.url
        else { return nil }
        return url
    }

    /// Distinct member ids in order of first appearance (sortOrder order).
    static func distinctMemberIds(_ items: [HubEventGoodsItem]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []
        for item in sorted(items) {
            for memberId in item.memberIds where seen.insert(memberId).inserted {
                result.append(memberId)
            }
        }
        return result
    }

    static func groups(_ items: [HubEventGoodsItem]) -> [Group] {
        var order: [String] = []
        var buckets: [String: [HubEventGoodsItem]] = [:]
        var others: [HubEventGoodsItem] = []
        for item in sorted(items) {
            if let label = item.groupLabel?.trimmed.nilIfEmpty {
                if buckets[label] == nil { order.append(label) }
                buckets[label, default: []].append(item)
            } else {
                others.append(item)
            }
        }
        var result = order.map { Group(label: $0, items: buckets[$0] ?? []) }
        if !others.isEmpty { result.append(Group(label: nil, items: others)) }
        return result
    }

    static func presentation(
        items: [HubEventGoodsItem],
        memberFilterId: String?,
        isExpanded: Bool
    ) -> Presentation {
        let memberIds = distinctMemberIds(items)
        let selected = memberFilterId.flatMap { memberIds.contains($0) && memberIds.count >= 2 ? $0 : nil }
        let filtered = selected.map { id in items.filter { $0.memberIds.contains(id) } } ?? items
        let allGroups = groups(filtered)
        let collapsed = !isExpanded && filtered.count > collapseThreshold
        guard collapsed else {
            return Presentation(
                groups: allGroups,
                totalCount: filtered.count,
                visibleCount: filtered.count,
                isCollapsed: false,
                memberFilterIds: memberIds,
                selectedMemberId: selected
            )
        }
        var remaining = collapseThreshold
        var visible: [Group] = []
        for group in allGroups where remaining > 0 {
            let slice = Array(group.items.prefix(remaining))
            remaining -= slice.count
            visible.append(Group(label: group.label, items: slice))
        }
        return Presentation(
            groups: visible,
            totalCount: filtered.count,
            visibleCount: collapseThreshold,
            isCollapsed: true,
            memberFilterIds: memberIds,
            selectedMemberId: selected
        )
    }

    static func countLabel(for event: HubEvent) -> String? {
        let count = max(event.goodsItems.count, event.goodsCount ?? 0)
        return count > 0 ? "굿즈 \(count)종" : nil
    }

    /// Resolves ids through `names`; unknown ids are skipped. More than three names collapse to "A, B, C 외 N명".
    static func memberSummary(memberIds: [String], names: [String: String]) -> String? {
        var seen = Set<String>()
        let resolved = memberIds.compactMap { id -> String? in
            guard seen.insert(id).inserted, let name = names[id]?.trimmed, !name.isEmpty else { return nil }
            return name
        }
        guard !resolved.isEmpty else { return nil }
        guard resolved.count > maxInlineMemberNames else { return resolved.joined(separator: ", ") }
        let shown = resolved.prefix(maxInlineMemberNames).joined(separator: ", ")
        return "\(shown) 외 \(resolved.count - maxInlineMemberNames)명"
    }

    static func formatWon(_ amount: Int) -> String {
        let digits = String(abs(amount))
        var grouped = ""
        for (index, character) in digits.reversed().enumerated() {
            if index > 0, index % 3 == 0 { grouped.append(",") }
            grouped.append(character)
        }
        return "\(amount < 0 ? "-" : "")\(String(grouped.reversed()))원"
    }

    static func priceText(_ item: HubEventGoodsItem) -> String {
        if let price = item.priceKrw { return formatWon(price) }
        if let note = item.priceNote?.trimmed.nilIfEmpty { return note }
        return "가격 미정"
    }

    /// Secondary lines under the row: limit note, and the price note when a numeric price is shown.
    static func secondaryNotes(_ item: HubEventGoodsItem) -> [String] {
        var notes: [String] = []
        if item.priceKrw != nil, let note = item.priceNote?.trimmed.nilIfEmpty { notes.append(note) }
        if let note = item.limitNote?.trimmed.nilIfEmpty { notes.append(note) }
        return notes
    }

    static func purchaseLimitChip(_ item: HubEventGoodsItem) -> String? {
        item.purchaseLimit.map { "1인 \($0)개" }
    }

    static func isCheckable(_ item: HubEventGoodsItem) -> Bool { !item.isBonus }

    static func maxQuantity(_ item: HubEventGoodsItem) -> Int {
        item.purchaseLimit ?? defaultMaxQuantity
    }

    static func clampedQuantity(_ quantity: Int, for item: HubEventGoodsItem) -> Int {
        min(max(quantity, 1), max(1, maxQuantity(item)))
    }

    struct ChecklistSummary: Equatable {
        let selectedCount: Int
        let total: Int
        let includesUnpriced: Bool

        var text: String {
            var result = "선택 \(selectedCount)개 · 예상 합계 \(HubEventGoodsPolicy.formatWon(total))"
            if includesUnpriced { result += " (가격 미정 포함)" }
            return result
        }
    }

    /// `quantities` maps goodsItemId → quantity for the event. Entries not matching a checkable item are ignored.
    static func summary(items: [HubEventGoodsItem], quantities: [String: Int]) -> ChecklistSummary {
        var count = 0
        var total = 0
        var unpriced = false
        for item in items where isCheckable(item) {
            guard let quantity = quantities[item.id], quantity >= 1 else { continue }
            count += 1
            if let price = item.priceKrw {
                total += price * quantity
            } else {
                unpriced = true
            }
        }
        return ChecklistSummary(selectedCount: count, total: total, includesUnpriced: unpriced)
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
