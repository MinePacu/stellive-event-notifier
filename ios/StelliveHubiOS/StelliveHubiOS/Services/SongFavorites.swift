import Foundation
import Combine

protocol SongFavoritesRepository {
    func load() -> Set<String>
    func save(_ identifiers: Set<String>)
}

final class UserDefaultsSongFavoritesRepository: SongFavoritesRepository {
    static let storageKey = "songFavoriteIdsV1"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> Set<String> {
        Set((defaults.stringArray(forKey: Self.storageKey) ?? []).filter(Self.isValidIdentifier))
    }

    func save(_ identifiers: Set<String>) {
        defaults.set(identifiers.filter(Self.isValidIdentifier).sorted(), forKey: Self.storageKey)
    }

    static func isValidIdentifier(_ value: String) -> Bool {
        let prefix = value.hasPrefix("youtube:") ? "youtube:" : (value.hasPrefix("song:") ? "song:" : nil)
        guard let prefix else { return false }
        return value == value.trimmingCharacters(in: .whitespacesAndNewlines) &&
            !value.dropFirst(prefix.count).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

@MainActor
final class SongFavoritesStore: ObservableObject {
    @Published private(set) var identifiers: Set<String>
    private let repository: SongFavoritesRepository

    init(repository: SongFavoritesRepository = UserDefaultsSongFavoritesRepository()) {
        self.repository = repository
        identifiers = repository.load()
        repository.save(identifiers)
    }

    func contains(_ song: SongCatalogItem) -> Bool {
        IOSSongPagePolicy.favoriteIdentifier(for: song).map(identifiers.contains) ?? false
    }

    func toggle(_ song: SongCatalogItem) {
        guard let identifier = IOSSongPagePolicy.favoriteIdentifier(for: song) else { return }
        if !identifiers.insert(identifier).inserted { identifiers.remove(identifier) }
        repository.save(identifiers)
    }
}
