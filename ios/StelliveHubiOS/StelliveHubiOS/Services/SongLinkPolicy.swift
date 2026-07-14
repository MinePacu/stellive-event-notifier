import Foundation
import Combine

enum SongOpenTarget: String, CaseIterable, Identifiable {
    case youtube
    case youtubeMusic = "youtube_music"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .youtube: "YouTube"
        case .youtubeMusic: "YouTube Music"
        }
    }

    var openButtonTitle: String { "\(displayName)에서 열기" }
}

@MainActor
final class SongOpenPreferenceStore: ObservableObject {
    static let preferenceKey = "song_open_target"

    @Published var target: SongOpenTarget {
        didSet { defaults.set(target.rawValue, forKey: Self.preferenceKey) }
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let storedValue = defaults.string(forKey: Self.preferenceKey)
        target = SongOpenTarget(rawValue: storedValue ?? "") ?? .youtube
        if storedValue != nil, SongOpenTarget(rawValue: storedValue ?? "") == nil {
            defaults.set(SongOpenTarget.youtube.rawValue, forKey: Self.preferenceKey)
        }
    }
}

enum SongLinkPolicy {
    private static let allowedHosts: Set<String> = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]
    private static let videoIDPattern = try! NSRegularExpression(pattern: "^[A-Za-z0-9_-]{11}$")
    private static let playlistIDPattern = try! NSRegularExpression(pattern: "^[A-Za-z0-9_-]{10,}$")
    static let unavailableReason = "유효한 YouTube HTTPS 링크가 없어 사용할 수 없습니다"

    static func videoURL(for song: SongCatalogItem, target: SongOpenTarget = .youtube) -> URL? {
        guard let videoID = videoID(for: song) else { return nil }
        switch target {
        case .youtube:
            return URL(string: "https://www.youtube.com/watch?v=\(videoID)")
        case .youtubeMusic:
            return URL(string: "https://music.youtube.com/watch?v=\(videoID)")
        }
    }

    private static func videoID(for song: SongCatalogItem) -> String? {
        let videoID = song.youtubeVideoId.trimmingCharacters(in: .whitespacesAndNewlines)
        if matches(videoID, pattern: videoIDPattern) {
            return videoID
        }
        return validatedVideoID(song.youtubeUrl) ?? validatedVideoID(song.sourceUrl)
    }

    static func validatedYouTubeURL(_ rawValue: String?) -> URL? {
        guard let rawValue,
              let url = URL(string: rawValue.trimmingCharacters(in: .whitespacesAndNewlines)),
              validatedVideoID(rawValue) != nil else { return nil }
        return url
    }

    private static func validatedVideoID(_ rawValue: String?) -> String? {
        guard let rawValue,
              let components = URLComponents(string: rawValue.trimmingCharacters(in: .whitespacesAndNewlines)),
              components.scheme?.lowercased() == "https",
              let host = components.host?.lowercased(),
              allowedHosts.contains(host) else { return nil }
        let videoID: String?
        if host == "youtu.be" {
            videoID = components.path.split(separator: "/").first.map(String.init)
        } else if components.path == "/watch" {
            videoID = components.queryItems?.first(where: { $0.name == "v" })?.value
        } else {
            videoID = ["/shorts/", "/live/", "/embed/"].compactMap { prefix in
                components.path.hasPrefix(prefix)
                    ? components.path.dropFirst(prefix.count).split(separator: "/").first.map(String.init)
                    : nil
            }.first
        }
        guard let videoID, matches(videoID, pattern: videoIDPattern) else { return nil }
        return videoID
    }

    static func playlistURL(id: String) -> URL? {
        let normalized = id.trimmingCharacters(in: .whitespacesAndNewlines)
        guard matches(normalized, pattern: playlistIDPattern) else { return nil }
        return URL(string: "https://www.youtube.com/playlist?list=\(normalized)")
    }

    private static func matches(_ value: String, pattern: NSRegularExpression) -> Bool {
        pattern.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)) != nil
    }
}
