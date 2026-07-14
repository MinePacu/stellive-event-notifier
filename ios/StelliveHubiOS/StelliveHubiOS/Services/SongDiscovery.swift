import Foundation
import Combine

struct SongDiscoveryStateV1: Codable, Equatable, Hashable {
    var initialized = false
    var baselineAt: Date?
    var acknowledgedIds: Set<String> = []
}

enum SongDiscoveryPolicy {
    static func effectiveAddedAt(_ song: SongCatalogItem) -> Date? { song.catalogAddedAt ?? song.publishedAt }

    static func isNew(_ song: SongCatalogItem, state: SongDiscoveryStateV1) -> Bool {
        guard state.initialized,
              let baseline = state.baselineAt,
              let addedAt = effectiveAddedAt(song),
              let identifier = SongIdentity.identifier(for: song)
        else { return false }
        return addedAt > baseline && !state.acknowledgedIds.contains(identifier)
    }

    static func fallbackBaseline(_ catalog: [SongCatalogItem]) -> Date? {
        catalog.compactMap(effectiveAddedAt).max()
    }
}

protocol SongDiscoveryRepository {
    func load() -> SongDiscoveryStateV1
    func save(_ state: SongDiscoveryStateV1)
}

final class UserDefaultsSongDiscoveryRepository: SongDiscoveryRepository {
    static let storageKey = "songDiscoveryStateV1"
    private let defaults: UserDefaults
    init(defaults: UserDefaults = .standard) { self.defaults = defaults }
    func load() -> SongDiscoveryStateV1 {
        guard let data = defaults.data(forKey: Self.storageKey),
              let state = try? JSONDecoder().decode(SongDiscoveryStateV1.self, from: data)
        else { return SongDiscoveryStateV1() }
        return state
    }
    func save(_ state: SongDiscoveryStateV1) {
        if let data = try? JSONEncoder().encode(state) { defaults.set(data, forKey: Self.storageKey) }
    }
}

@MainActor
final class SongDiscoveryStore: ObservableObject {
    @Published private(set) var state: SongDiscoveryStateV1
    private let repository: SongDiscoveryRepository

    init(repository: SongDiscoveryRepository = UserDefaultsSongDiscoveryRepository()) {
        self.repository = repository
        state = repository.load()
    }

    func initialize(serverTime: String?, catalog: [SongCatalogItem], authoritative: Bool) {
        guard authoritative, !state.initialized else { return }
        let parsedServerTime = serverTime.flatMap(ISO8601DateFormatter().date(from:))
        guard let baseline = parsedServerTime ?? SongDiscoveryPolicy.fallbackBaseline(catalog) else { return }
        state.initialized = true
        state.baselineAt = baseline
        repository.save(state)
    }

    func isNew(_ song: SongCatalogItem) -> Bool { SongDiscoveryPolicy.isNew(song, state: state) }

    func acknowledge(_ songs: [SongCatalogItem], catalog: [SongCatalogItem]) {
        songs.filter { SongDiscoveryPolicy.isNew($0, state: state) }
            .compactMap(SongIdentity.identifier)
            .forEach { state.acknowledgedIds.insert($0) }
        if !catalog.contains(where: { SongDiscoveryPolicy.isNew($0, state: state) }),
           let latest = SongDiscoveryPolicy.fallbackBaseline(catalog),
           state.baselineAt == nil || latest > state.baselineAt! {
            state.baselineAt = latest
            let catalogIds = Set(catalog.compactMap(SongIdentity.identifier))
            state.acknowledgedIds.subtract(catalogIds)
        }
        repository.save(state)
    }
}
