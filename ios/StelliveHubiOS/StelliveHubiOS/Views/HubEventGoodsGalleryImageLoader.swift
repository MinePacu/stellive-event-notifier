import ImageIO
import UIKit

/// Downsampling loader for the official MD list gallery. Official list pages are very tall PNGs, so a plain
/// `AsyncImage` would decode them at full resolution. This loader downloads the bytes, then decodes a bounded
/// thumbnail with ImageIO. Images live only in an in-memory `NSCache`; the session is ephemeral (no URL disk cache)
/// and nothing is written to disk or the photo library.
final class HubEventGoodsGalleryImageLoader: @unchecked Sendable {
    static let shared = HubEventGoodsGalleryImageLoader()

    /// How large the decoded bitmap should be, in pixels.
    enum Sizing: Equatable {
        /// Cover `target` (aspect fill), e.g. a top-aligned thumbnail.
        case fill(CGSize)
        /// Fit inside `bound` (aspect fit), e.g. the full-screen viewer.
        case fit(CGSize)
    }

    static let maxPixelSizeCap = 8192
    private static let maxDownloadBytes = 40 * 1024 * 1024

    private let cache = NSCache<NSString, UIImage>()
    private let session: URLSession

    init(session: URLSession? = nil) {
        cache.totalCostLimit = 96 * 1024 * 1024
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.urlCache = nil
            configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
            configuration.timeoutIntervalForRequest = 20
            configuration.timeoutIntervalForResource = 60
            self.session = URLSession(configuration: configuration)
        }
    }

    /// Longest side (pixels) to hand to `kCGImageSourceThumbnailMaxPixelSize`. Never upscales the source.
    static func maxPixelSize(source: CGSize, sizing: Sizing) -> Int {
        guard source.width > 0, source.height > 0 else { return 1 }
        let scale: CGFloat
        switch sizing {
        case .fill(let target):
            scale = max(target.width / source.width, target.height / source.height)
        case .fit(let bound):
            scale = min(bound.width / source.width, bound.height / source.height)
        }
        let bounded = min(max(scale, 0), 1)
        let longest = (max(source.width, source.height) * bounded).rounded(.up)
        return min(max(Int(longest), 1), maxPixelSizeCap)
    }

    /// Returns nil on any failure (non-https, HTTP error, oversized payload, undecodable data, cancellation).
    func image(for url: URL, sizing: Sizing) async -> UIImage? {
        guard url.scheme?.lowercased() == "https" else { return nil }
        let key = Self.cacheKey(url: url, sizing: sizing) as NSString
        if let cached = cache.object(forKey: key) { return cached }

        guard
            let (data, response) = try? await session.data(from: url),
            let http = response as? HTTPURLResponse,
            (200..<300).contains(http.statusCode),
            data.count <= Self.maxDownloadBytes,
            !Task.isCancelled
        else {
            return nil
        }
        let decoded = await Task.detached(priority: .userInitiated) {
            Self.decode(data: data, sizing: sizing)
        }.value
        guard let decoded else { return nil }
        cache.setObject(decoded, forKey: key, cost: Int(decoded.size.width * decoded.scale * decoded.size.height * decoded.scale * 4))
        return decoded
    }

    private static func cacheKey(url: URL, sizing: Sizing) -> String {
        switch sizing {
        case .fill(let size): "fill:\(Int(size.width))x\(Int(size.height)):\(url.absoluteString)"
        case .fit(let size): "fit:\(Int(size.width))x\(Int(size.height)):\(url.absoluteString)"
        }
    }

    private static func decode(data: Data, sizing: Sizing) -> UIImage? {
        let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
        guard
            let source = CGImageSourceCreateWithData(data as CFData, sourceOptions),
            let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let width = properties[kCGImagePropertyPixelWidth] as? Int,
            let height = properties[kCGImagePropertyPixelHeight] as? Int
        else {
            return nil
        }
        let maxPixel = maxPixelSize(source: CGSize(width: width, height: height), sizing: sizing)
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
