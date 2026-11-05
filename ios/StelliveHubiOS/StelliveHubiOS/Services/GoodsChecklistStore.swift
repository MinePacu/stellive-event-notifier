import Combine
import Foundation

/// Device-local purchase checklist: eventId -> goodsItemId -> quantity (>= 1). Never sent to the server.
typealias GoodsChecklistState = [String: [String: Int]]

protocol GoodsChecklistRepository {
    func load() -> GoodsChecklistState
    func save(_ state: GoodsChecklistState)
}

final class UserDefaultsGoodsChecklistRepository: GoodsChecklistRepository {
    static let storageKey = "goodsPurchaseChecklistV1"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> GoodsChecklistState {
        guard let raw = defaults.dictionary(forKey: Self.storageKey) else { return [:] }
        var state: GoodsChecklistState = [:]
        for (eventId, value) in raw {
            guard let entries = value as? [String: Any] else { continue }
            let quantities = entries.compactMapValues { ($0 as? Int).flatMap { $0 >= 1 ? $0 : nil } }
            if !quantities.isEmpty { state[eventId] = quantities }
        }
        return state
    }

    func save(_ state: GoodsChecklistState) {
        defaults.set(state, forKey: Self.storageKey)
    }
}

enum GoodsChecklistPolicy {
    /// Reconciles one event's checklist with a fresh, authoritative goods list.
    /// - Drops entries whose item is gone (everything when `items` is empty) or became a bonus item.
    /// - Clamps quantities to a lowered `purchaseLimit`.
    static func pruned(_ quantities: [String: Int], freshItems items: [HubEventGoodsItem]) -> [String: Int] {
        let byId = Dictionary(items.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var result: [String: Int] = [:]
        for (itemId, quantity) in quantities {
            guard let item = byId[itemId], HubEventGoodsPolicy.isCheckable(item), quantity >= 1 else { continue }
            result[itemId] = HubEventGoodsPolicy.clampedQuantity(quantity, for: item)
        }
        return result
    }
}

@MainActor
final class GoodsChecklistStore: ObservableObject {
    @Published private(set) var state: GoodsChecklistState
    private let repository: GoodsChecklistRepository

    init(repository: GoodsChecklistRepository = UserDefaultsGoodsChecklistRepository()) {
        self.repository = repository
        state = repository.load()
    }

    func quantities(eventId: String) -> [String: Int] {
        state[eventId] ?? [:]
    }

    func quantity(eventId: String, itemId: String) -> Int? {
        state[eventId]?[itemId]
    }

    func isChecked(eventId: String, itemId: String) -> Bool {
        quantity(eventId: eventId, itemId: itemId) != nil
    }

    func checkedCount(eventId: String) -> Int {
        state[eventId]?.count ?? 0
    }

    /// Checking sets quantity 1 (an existing quantity is kept). Bonus items are not checkable.
    func setChecked(_ checked: Bool, eventId: String, item: HubEventGoodsItem) {
        var entries = state[eventId] ?? [:]
        if checked {
            guard HubEventGoodsPolicy.isCheckable(item), entries[item.id] == nil else { return }
            entries[item.id] = 1
        } else {
            guard entries.removeValue(forKey: item.id) != nil else { return }
        }
        commit(eventId: eventId, entries: entries)
    }

    /// Only adjusts an item that is already checked; the value is clamped to [1, purchaseLimit ?? 99].
    func setQuantity(_ quantity: Int, eventId: String, item: HubEventGoodsItem) {
        var entries = state[eventId] ?? [:]
        guard entries[item.id] != nil else { return }
        let clamped = HubEventGoodsPolicy.clampedQuantity(quantity, for: item)
        guard entries[item.id] != clamped else { return }
        entries[item.id] = clamped
        commit(eventId: eventId, entries: entries)
    }

    func clear(eventId: String) {
        guard state[eventId] != nil else { return }
        commit(eventId: eventId, entries: [:])
    }

    /// Call only with a list from a successful (HTTP 200, decoded) detail fetch — never with
    /// cached, mock or failed-fetch data.
    func prune(eventId: String, freshItems: [HubEventGoodsItem]) {
        guard let existing = state[eventId] else { return }
        let pruned = GoodsChecklistPolicy.pruned(existing, freshItems: freshItems)
        guard pruned != existing else { return }
        commit(eventId: eventId, entries: pruned)
    }

    private func commit(eventId: String, entries: [String: Int]) {
        if entries.isEmpty {
            state.removeValue(forKey: eventId)
        } else {
            state[eventId] = entries
        }
        repository.save(state)
    }
}
