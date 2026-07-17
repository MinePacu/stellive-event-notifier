import Foundation

enum ServiceAnnouncementType: String, Codable, CaseIterable {
    case general, incident, maintenance, versionUpdate = "version_update"
    var displayName: String { switch self { case .general: "일반 안내"; case .incident: "장애 및 복구"; case .maintenance: "예정된 점검"; case .versionUpdate: "앱 업데이트" } }
}

enum ServiceAnnouncementSeverity: String, Codable {
    case info, important, critical
    var displayName: String { switch self { case .info: "정보"; case .important: "중요"; case .critical: "긴급" } }
}

struct ServiceAnnouncement: Codable, Hashable, Identifiable {
    let id: String
    let type: ServiceAnnouncementType
    let severity: ServiceAnnouncementSeverity
    let title: String
    let summary: String
    let body: String
    let isPinned: Bool
    let targetPlatforms: [String]
    let minimumAppVersion: String?
    let maximumAppVersion: String?
    let appDeepLink: String?
    let externalUrl: String?
    let actionLabel: String?
    let publishedAt: Date
    let expiresAt: Date?
    let resolvedAt: Date?
    let archivedAt: Date?
    let attentionRevision: Int
    let revision: Int
    let updatedAt: Date
}

struct AnnouncementSummaryItem: Codable, Hashable {
    let id: String
    let attentionRevision: Int
    let publishedAt: Date
    let severity: ServiceAnnouncementSeverity
    let isPinned: Bool
}

struct AnnouncementsSummaryResponse: Codable, Equatable {
    let activeCount: Int
    let items: [AnnouncementSummaryItem]
    let pinned: ServiceAnnouncement?
    let generatedAt: Date
}

struct ServiceAnnouncementListResponse: Codable {
    let items: [ServiceAnnouncement]
    let nextCursor: String?
    let generatedAt: Date
}

enum AnnouncementPolicy {
    static func readKey(id: String, attentionRevision: Int) -> String { "\(id):\(attentionRevision)" }
    static func unread(_ items: [ServiceAnnouncement], readKeys: Set<String>) -> [ServiceAnnouncement] {
        items.filter { !readKeys.contains(readKey(id: $0.id, attentionRevision: $0.attentionRevision)) }
    }
    static func badgeText(_ count: Int) -> String? { count <= 0 ? nil : count <= 9 ? String(count) : "9+" }
    static func accessibilityLabel(_ count: Int) -> String { count <= 0 ? "공지, 읽지 않은 공지 없음" : "공지, 읽지 않은 공지 \(count)개" }
    static func homeAnnouncement(_ items: [ServiceAnnouncement]) -> ServiceAnnouncement? {
        items.filter { $0.severity == .critical || ($0.isPinned && $0.severity == .important) }
            .sorted { left, right in
                if (left.severity == .critical) != (right.severity == .critical) { return left.severity == .critical }
                return left.publishedAt > right.publishedAt
            }.first
    }
    static func initialReadKeys(_ items: [AnnouncementSummaryItem], firstSyncAt: Date) -> Set<String> {
        Set(items.filter { $0.publishedAt <= firstSyncAt && $0.severity != .critical && !$0.isPinned }
            .map { readKey(id: $0.id, attentionRevision: $0.attentionRevision) })
    }
    static func sorted(_ items: [ServiceAnnouncement]) -> [ServiceAnnouncement] {
        items.sorted { left, right in left.isPinned == right.isPinned ? left.publishedAt > right.publishedAt : left.isPinned }
    }
}

enum AnnouncementDeepLinkPolicy {
    static func id(from url: URL) -> String? {
        guard url.scheme == "stellivehub", url.host == "announcements" else { return nil }
        let id = url.pathComponents.dropFirst().first ?? ""
        return id.isEmpty ? nil : id
    }
}

@MainActor
final class AnnouncementReadStore: ObservableObject {
    @Published private(set) var readKeys: Set<String>
    private let defaults: UserDefaults
    private let readKeysKey = "announcement.readKeys.v1"
    private let firstSyncKey = "announcement.firstSyncAt.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.readKeys = Set(defaults.stringArray(forKey: readKeysKey) ?? [])
    }

    func initialize(summaryItems: [AnnouncementSummaryItem], now: Date = Date()) {
        guard defaults.object(forKey: firstSyncKey) == nil else { return }
        defaults.set(now, forKey: firstSyncKey)
        readKeys.formUnion(AnnouncementPolicy.initialReadKeys(summaryItems, firstSyncAt: now))
        persist()
    }

    func markRead(_ announcement: ServiceAnnouncement) {
        readKeys.insert(AnnouncementPolicy.readKey(id: announcement.id, attentionRevision: announcement.attentionRevision))
        persist()
    }

    func prune(activeItems: [ServiceAnnouncement]) {
        let ids = Set(activeItems.map(\.id))
        readKeys = readKeys.filter { ids.contains($0.split(separator: ":", maxSplits: 1).first.map(String.init) ?? "") }
        persist()
    }

    private func persist() { defaults.set(Array(readKeys).sorted(), forKey: readKeysKey) }
}
