import Foundation

enum SongLinkPolicy {
    private static let allowedHosts: Set<String> = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]
    private static let videoIDPattern = try! NSRegularExpression(pattern: "^[A-Za-z0-9_-]{11}$")
    private static let playlistIDPattern = try! NSRegularExpression(pattern: "^[A-Za-z0-9_-]{10,}$")
    static let unavailableReason = "유효한 YouTube HTTPS 링크가 없어 사용할 수 없습니다"

    static func videoURL(for song: SongCatalogItem) -> URL? {
        let videoID = song.youtubeVideoId.trimmingCharacters(in: .whitespacesAndNewlines)
        if matches(videoID, pattern: videoIDPattern) {
            return URL(string: "https://www.youtube.com/watch?v=\(videoID)")
        }
        return validatedYouTubeURL(song.youtubeUrl) ?? validatedYouTubeURL(song.sourceUrl)
    }

    static func validatedYouTubeURL(_ rawValue: String?) -> URL? {
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
        return components.url
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
