import XCTest
@testable import StelliveHubiOS

@MainActor
final class SongDiscoveryStoreTests: XCTestCase {
    func testInitializesRestoresAndAcknowledgesOnlySelectedPage() {
        let suite = "SongDiscoveryStoreTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let repository = UserDefaultsSongDiscoveryRepository(defaults: defaults)
        let first = song("first", published: "2020-01-01T00:00:00Z", added: "2026-07-02T00:00:00Z")
        let second = song("second", published: "2026-07-03T00:00:00Z")
        let store = SongDiscoveryStore(repository: repository)
        store.initialize(serverTime: "2026-07-01T00:00:00Z", catalog: [first, second], authoritative: false)
        XCTAssertFalse(store.state.initialized)
        store.initialize(serverTime: "2026-07-01T00:00:00Z", catalog: [first, second], authoritative: true)
        XCTAssertTrue(store.isNew(first))
        XCTAssertTrue(store.isNew(second))
        store.acknowledge([first], catalog: [first, second])
        XCTAssertFalse(store.isNew(first))
        XCTAssertTrue(store.isNew(second))
        XCTAssertEqual(SongDiscoveryStore(repository: repository).state, store.state)
    }

    func testOldJsonWithoutCatalogAddedAtDecodesAndUsesPublishedAt() throws {
        let json = #"{"id":"legacy","youtubeVideoId":"legacy","title":"Legacy","type":"cover","publishedAt":"2026-07-02T00:00:00Z","youtubeUrl":"https://youtube.com/watch?v=legacy"}"#.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(SongCatalogItem.self, from: json)
        XCTAssertNil(decoded.catalogAddedAt)
        XCTAssertEqual(SongIdentity.identifier(for: decoded), "youtube:legacy")
    }

    private func song(_ id: String, published: String? = nil, added: String? = nil) -> SongCatalogItem {
        let formatter = ISO8601DateFormatter()
        return SongCatalogItem(
            id: id, youtubeVideoId: id, title: id, type: .cover,
            publishedAt: published.flatMap(formatter.date(from:)),
            catalogAddedAt: added.flatMap(formatter.date(from:)),
            youtubeUrl: "https://youtube.com/watch?v=\(id)"
        )
    }
}
