import SwiftUI
import UIKit

/// Full-screen viewer for one gallery sequence: dark background, close and notice buttons, "{altText} · n / N" title,
/// horizontal paging, pinch-zoom (1x to 4x, double-tap toggle), page dots and a source caption.
/// Only the visible page is loaded (pages further than one step away are released); nothing is saved.
struct HubEventGoodsGalleryViewer: View {
    let images: [HubEventImage]
    let eventSourceUrl: String

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var index: Int

    init(images: [HubEventImage], startIndex: Int, eventSourceUrl: String) {
        self.images = images
        self.eventSourceUrl = eventSourceUrl
        _index = State(initialValue: images.isEmpty ? 0 : min(max(startIndex, 0), images.count - 1))
    }

    private var current: HubEventImage? {
        images.indices.contains(index) ? images[index] : nil
    }

    private var noticeURL: URL? {
        HubEventGoodsGalleryPolicy.noticeURL(imageSourceUrl: current?.sourceUrl, eventSourceUrl: eventSourceUrl)
    }

    var body: some View {
        ZStack {
            Color(red: 0.11, green: 0.11, blue: 0.12).ignoresSafeArea()
            VStack(spacing: 0) {
                topBar
                TabView(selection: $index) {
                    ForEach(Array(images.enumerated()), id: \.offset) { offset, image in
                        GalleryViewerPage(image: image, position: offset, currentIndex: index)
                            .tag(offset)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                bottomBar
            }
        }
        .preferredColorScheme(.dark)
    }

    private var topBar: some View {
        HStack(spacing: 0) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 48, height: 48)
            }
            .accessibilityLabel("닫기")
            Text(current.map { HubEventGoodsGalleryPolicy.viewerTitle($0, index: index, total: images.count) } ?? "")
                .font(.subheadline.weight(.bold))
                .lineLimit(1)
                .frame(maxWidth: .infinity)
            Button {
                if let noticeURL { openURL(noticeURL) }
            } label: {
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 48, height: 48)
            }
            .opacity(noticeURL == nil ? 0 : 1)
            .disabled(noticeURL == nil)
            .accessibilityLabel("공식 공지 열기, 외부 링크")
        }
        .foregroundStyle(.white)
    }

    private var bottomBar: some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                ForEach(images.indices, id: \.self) { dot in
                    Circle()
                        .fill(dot == index ? Color.white : Color.white.opacity(0.35))
                        .frame(width: 6, height: 6)
                }
            }
            .accessibilityHidden(true)
            Text(current.map(HubEventGoodsGalleryPolicy.viewerSourceCaption) ?? "")
                .font(.caption)
                .foregroundStyle(Color.white.opacity(0.7))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}

/// One page. The full image is requested only while this page is the current one; far pages drop their bitmap.
private struct GalleryViewerPage: View {
    let image: HubEventImage
    let position: Int
    let currentIndex: Int

    @Environment(\.displayScale) private var displayScale
    @State private var loaded: UIImage?
    @State private var failed = false

    private var isCurrent: Bool { position == currentIndex }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                if let loaded {
                    ZoomableImageView(image: loaded)
                        .accessibilityLabel(image.altText ?? "공식 MD 리스트 이미지 \(position + 1)")
                } else if failed {
                    Text("이미지를 불러오지 못했어요.\n오른쪽 위 버튼으로 공식 공지를 열어 확인하세요.")
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Color.white.opacity(0.7))
                        .padding(24)
                } else {
                    ProgressView()
                        .tint(.white)
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .task(id: isCurrent) {
                guard isCurrent, loaded == nil, let url = HubEventImagePolicy.displayURL(for: image) else { return }
                failed = false
                // Bounded decode: at most 2x the screen in each dimension, so tall PNGs are downsampled while
                // pinch-zoom still has extra detail.
                let bound = CGSize(
                    width: geometry.size.width * displayScale * 2,
                    height: geometry.size.height * displayScale * 2
                )
                let result = await HubEventGoodsGalleryImageLoader.shared.image(for: url, sizing: .fit(bound))
                guard !Task.isCancelled else { return }
                loaded = result
                failed = result == nil
            }
            .onChange(of: currentIndex) { newValue in
                if abs(newValue - position) > 1 { loaded = nil }
            }
        }
    }
}

/// UIScrollView-backed zoom (1x to 4x, pan while zoomed, double-tap toggle). At 1x the scroll view has nothing to
/// scroll, so the surrounding pager keeps receiving horizontal swipes.
private struct ZoomableImageView: UIViewRepresentable {
    let image: UIImage

    func makeUIView(context: Context) -> ZoomScrollView {
        ZoomScrollView()
    }

    func updateUIView(_ view: ZoomScrollView, context: Context) {
        view.display(image)
    }
}

private final class ZoomScrollView: UIScrollView, UIScrollViewDelegate {
    private static let doubleTapZoom: CGFloat = 2.5

    private let imageView = UIImageView()
    private var shownImage: UIImage?
    private var laidOutSize: CGSize = .zero

    override init(frame: CGRect) {
        super.init(frame: frame)
        delegate = self
        minimumZoomScale = 1
        maximumZoomScale = 4
        bouncesZoom = true
        showsHorizontalScrollIndicator = false
        showsVerticalScrollIndicator = false
        contentInsetAdjustmentBehavior = .never
        imageView.contentMode = .scaleAspectFit
        addSubview(imageView)
        let doubleTap = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTap(_:)))
        doubleTap.numberOfTapsRequired = 2
        addGestureRecognizer(doubleTap)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func display(_ image: UIImage) {
        guard shownImage !== image else { return }
        shownImage = image
        imageView.image = image
        resetLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        if bounds.size != laidOutSize { resetLayout() }
        var frame = imageView.frame
        frame.origin.x = contentSize.width < bounds.width ? (bounds.width - contentSize.width) / 2 : 0
        frame.origin.y = contentSize.height < bounds.height ? (bounds.height - contentSize.height) / 2 : 0
        imageView.frame = frame
    }

    private func resetLayout() {
        laidOutSize = bounds.size
        zoomScale = 1
        guard let image = shownImage, image.size.width > 0, image.size.height > 0, bounds.width > 0, bounds.height > 0 else {
            imageView.frame = .zero
            contentSize = .zero
            return
        }
        let scale = min(bounds.width / image.size.width, bounds.height / image.size.height)
        let fitted = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        imageView.frame = CGRect(origin: .zero, size: fitted)
        contentSize = fitted
        contentOffset = .zero
        setNeedsLayout()
    }

    func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }

    func scrollViewDidZoom(_ scrollView: UIScrollView) { setNeedsLayout() }

    @objc private func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
        if zoomScale > minimumZoomScale + 0.01 {
            setZoomScale(minimumZoomScale, animated: true)
            return
        }
        let point = gesture.location(in: imageView)
        let width = bounds.width / Self.doubleTapZoom
        let height = bounds.height / Self.doubleTapZoom
        zoom(to: CGRect(x: point.x - width / 2, y: point.y - height / 2, width: width, height: height), animated: true)
    }
}
