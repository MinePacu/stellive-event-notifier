import XCTest
@testable import StelliveHubiOS

@MainActor
final class SongFavoritesStoreTests: XCTestCase {
    func testToggleDeduplicatesRemovesAndRestoresUnknownIdentifiersSorted() {
        let suite = "SongFavoritesStoreTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        defaults.set(["song:unknown", "", "broken", "youtube:video-1"], forKey: UserDefaultsSongFavoritesRepository.storageKey)

        let repository = UserDefaultsSongFavoritesRepository(defaults: defaults)
        let first = SongFavoritesStore(repository: repository)
        XCTAssertEqual(first.identifiers, ["song:unknown", "youtube:video-1"])
        first.toggle(song(id: "fallback", videoId: "video-2"))
        first.toggle(song(id: "fallback", videoId: "video-2"))
        first.toggle(song(id: "fallback", videoId: "video-2"))

        let restored = SongFavoritesStore(repository: repository)
        XCTAssertEqual(restored.identifiers, ["song:unknown", "youtube:video-1", "youtube:video-2"])
        XCTAssertEqual(defaults.stringArray(forKey: UserDefaultsSongFavoritesRepository.storageKey), restored.identifiers.sorted())
    }

    func testIdentifierPriorityEmptyIdentifiersAndFilterCombination() {
        let preferred = song(id: "fallback", videoId: "video")
        let fallback = song(id: "fallback", videoId: "")
        let invalid = song(id: " ", videoId: " ")
        XCTAssertEqual(IOSSongPagePolicy.favoriteIdentifier(for: preferred), "youtube:video")
        XCTAssertEqual(IOSSongPagePolicy.favoriteIdentifier(for: fallback), "song:fallback")
        XCTAssertNil(IOSSongPagePolicy.favoriteIdentifier(for: invalid))
        XCTAssertTrue(IOSSongPagePolicy.matchesLibrary(preferred, selectedLibraryId: "favorites", favorites: ["youtube:video"]))
        XCTAssertFalse(IOSSongPagePolicy.matchesLibrary(fallback, selectedLibraryId: "favorites", favorites: ["youtube:video"]))
        XCTAssertEqual(IOSSongPagePolicy.favoriteEmptyMessage(hasStoredFavorites: false), "즐겨찾기한 노래가 없습니다. 노래 카드의 별 버튼으로 추가해 보세요.")
        XCTAssertEqual(IOSSongPagePolicy.favoriteEmptyMessage(hasStoredFavorites: true), "현재 필터 조건에 맞는 즐겨찾기가 없습니다.")
    }

    private func song(id: String, videoId: String) -> SongCatalogItem {
        SongCatalogItem(id: id, youtubeVideoId: videoId, title: "Song", type: .cover, youtubeUrl: "https://youtube.com/watch?v=\(videoId)")
    }
}
