import Foundation

enum HubCalendarWidgetStore {
    static let appGroupIdentifier = "group.dev.stellive.hub"

    private static let fileName = "hub-calendar-widget-snapshot.json"

    static func snapshotURL(in containerURL: URL) -> URL {
        containerURL.appendingPathComponent(fileName, isDirectory: false)
    }

    static func save(_ snapshot: HubCalendarWidgetSnapshot, in containerURL: URL) throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(snapshot)
        try data.write(to: snapshotURL(in: containerURL), options: [.atomic])
    }

    static func load(from containerURL: URL) throws -> HubCalendarWidgetSnapshot? {
        let url = snapshotURL(in: containerURL)
        guard FileManager.default.fileExists(atPath: url.path) else {
            return nil
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(HubCalendarWidgetSnapshot.self, from: Data(contentsOf: url))
    }

    static func sharedContainerURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
    }

    static func saveToSharedContainer(_ snapshot: HubCalendarWidgetSnapshot) throws {
        guard let containerURL = sharedContainerURL() else {
            return
        }
        try save(snapshot, in: containerURL)
    }

    static func loadFromSharedContainer() throws -> HubCalendarWidgetSnapshot? {
        guard let containerURL = sharedContainerURL() else {
            return nil
        }
        return try load(from: containerURL)
    }
}
