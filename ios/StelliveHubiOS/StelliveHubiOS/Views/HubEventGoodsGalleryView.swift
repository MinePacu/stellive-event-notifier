import SwiftUI

/// Goods section body when the event has official MD list images: the gallery card on top, then the existing
/// checklist section when goods items exist. Without gallery images it is exactly the pre-gallery section.
struct HubEventGoodsGallerySectionView: View {
    let event: HubEvent

    var body: some View {
        let images = HubEventGoodsGalleryPolicy.displayableImages(event)
        let mode = HubEventGoodsGalleryPolicy.sectionMode(for: event)
        if HubEventGoodsGalleryPolicy.showsGallery(mode) {
            VStack(alignment: .leading, spacing: 10) {
                HubEventGoodsGalleryView(
                    event: event,
                    images: images,
                    showsEmptyItemsNotice: HubEventGoodsGalleryPolicy.showsEmptyItemsNotice(mode),
                    isCollapsible: HubEventGoodsGalleryPolicy.showsChecklist(mode)
                )
                if HubEventGoodsGalleryPolicy.showsChecklist(mode) {
                    HubEventGoodsSectionView(eventId: event.id, items: event.goodsItems)
                }
            }
        } else {
            HubEventGoodsSectionView(eventId: event.id, items: event.goodsItems)
        }
    }
}

/// "공식 MD 리스트" card: one or two thumbnail strips (split layout), a notice link and a source caption.
struct HubEventGoodsGalleryView: View {
    let event: HubEvent
    let images: [HubEventGoodsListImage]
    let showsEmptyItemsNotice: Bool
    /// True when goods items exist: the gallery may collapse into one compact row. Image-only notices stay expanded.
    let isCollapsible: Bool

    @Environment(\.openURL) private var openURL
    @State private var viewerRequest: ViewerRequest?
    @State private var isExpanded: Bool

    init(event: HubEvent, images: [HubEventGoodsListImage], showsEmptyItemsNotice: Bool, isCollapsible: Bool) {
        self.event = event
        self.images = images
        self.showsEmptyItemsNotice = showsEmptyItemsNotice
        self.isCollapsible = isCollapsible
        // Per-view state only: the user setting decides the starting point, expansion itself is never persisted.
        _isExpanded = State(initialValue: HubEventGoodsGalleryPolicy.initiallyExpanded(
            hasGoodsItems: isCollapsible,
            expandedByDefault: HubEventGoodsGalleryPolicy.expandedByDefaultSetting()
        ))
    }

    private struct ViewerRequest: Identifiable {
        let id = UUID()
        let images: [HubEventImage]
        let startIndex: Int
    }

    private var rows: [HubEventGoodsGalleryPolicy.Row] {
        HubEventGoodsGalleryPolicy.rows(images: images, layout: event.goodsListLayout)
    }

    private var noticeURL: URL? {
        HubEventGoodsGalleryPolicy.noticeURL(imageSourceUrl: nil, eventSourceUrl: event.sourceUrl)
    }

    private var showsCollapsedRow: Bool {
        isCollapsible && !isExpanded
    }

    var body: some View {
        Group {
            if showsCollapsedRow {
                collapsedRow
            } else {
                expandedContent
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(17)
        .background(HubEventDetailColors.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .fullScreenCover(item: $viewerRequest) { request in
            HubEventGoodsGalleryViewer(
                images: request.images,
                startIndex: request.startIndex,
                eventSourceUrl: event.sourceUrl
            )
        }
    }

    private var expandedContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { rowIndex, row in
                rowView(row, includesNoticeLink: rowIndex == 0)
            }
            Text(HubEventGoodsGalleryPolicy.stripCaption(images))
                .font(.caption)
                .foregroundStyle(HubEventDetailColors.muted)
            if showsEmptyItemsNotice {
                emptyItemsNotice
            }
            if isCollapsible {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { isExpanded = false }
                } label: {
                    Text(HubEventGoodsGalleryPolicy.collapseControlLabel)
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("공식 MD 리스트 이미지 접기")
            }
        }
    }

    private var collapsedRow: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { isExpanded = true }
        } label: {
            HStack(spacing: 12) {
                stackedThumbnails
                VStack(alignment: .leading, spacing: 2) {
                    Text(HubEventGoodsGalleryPolicy.collapsedTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(HubEventDetailColors.text)
                    Text(HubEventGoodsGalleryPolicy.collapsedSubtitle(images: images, layout: event.goodsListLayout))
                        .font(.caption)
                        .foregroundStyle(HubEventDetailColors.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(HubEventGoodsGalleryPolicy.expandControlLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.indigo)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(HubEventGoodsGalleryPolicy.collapsedTitle), \(HubEventGoodsGalleryPolicy.collapsedSubtitle(images: images, layout: event.goodsListLayout)), 펼쳐서 보기")
    }

    /// Up to three overlapping mini thumbnails, first image on top.
    private var stackedThumbnails: some View {
        let shown = Array(images.prefix(HubEventGoodsGalleryPolicy.collapsedThumbnailCount))
        let step: CGFloat = 14
        return ZStack(alignment: .leading) {
            ForEach(Array(shown.enumerated()).reversed(), id: \.offset) { index, entry in
                GalleryTile(image: entry.image, label: "", size: CGSize(width: 30, height: 40), cornerRadius: 6)
                    .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(HubEventDetailColors.card, lineWidth: 1.5))
                    .offset(x: CGFloat(index) * step)
            }
        }
        .frame(width: 30 + CGFloat(max(shown.count - 1, 0)) * step, height: 40, alignment: .leading)
        .accessibilityHidden(true)
    }

    private func rowView(_ row: HubEventGoodsGalleryPolicy.Row, includesNoticeLink: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(row.title)
                    .font(.headline)
                    .foregroundStyle(HubEventDetailColors.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                countView(row, includesNoticeLink: includesNoticeLink)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(row.images.enumerated()), id: \.offset) { index, entry in
                        let label = HubEventGoodsGalleryPolicy.thumbnailLabel(entry, index: index)
                        GalleryThumbnail(
                            image: entry.image,
                            label: label,
                            accessibilityText: HubEventGoodsGalleryPolicy.thumbnailAccessibilityLabel(
                                title: row.title,
                                label: label,
                                index: index,
                                total: row.images.count
                            )
                        ) {
                            viewerRequest = ViewerRequest(images: row.images.map(\.image), startIndex: index)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func countView(_ row: HubEventGoodsGalleryPolicy.Row, includesNoticeLink: Bool) -> some View {
        let linkURL = includesNoticeLink ? noticeURL : nil
        let text = HubEventGoodsGalleryPolicy.countLabel(
            imageCount: row.images.count,
            includesNoticeLink: linkURL != nil
        )
        if let linkURL {
            Button { openURL(linkURL) } label: {
                Text(text)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.indigo)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(row.images.count)장, 공식 공지 열기, 외부 링크")
        } else {
            Text(text)
                .font(.caption)
                .foregroundStyle(HubEventDetailColors.muted)
        }
    }

    private var emptyItemsNotice: some View {
        VStack(alignment: .leading, spacing: 12) {
            Divider()
            Text(HubEventGoodsGalleryPolicy.emptyItemsNotice)
                .font(.subheadline)
                .foregroundStyle(HubEventDetailColors.muted)
                .lineSpacing(3)
            if let purchaseURL = HubEventGoodsGalleryPolicy.purchaseURL(event.purchaseUrl) {
                Button { openURL(purchaseURL) } label: {
                    Text(HubEventGoodsGalleryPolicy.purchaseButtonLabel)
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("구매 페이지, 외부 링크 열기")
            }
        }
    }
}

private enum GalleryThumbnailMetrics {
    static let width: CGFloat = 62
    static let height: CGFloat = 84
}

/// Rounded 62x84 thumbnail button.
private struct GalleryThumbnail: View {
    let image: HubEventImage
    let label: String
    let accessibilityText: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            GalleryTile(
                image: image,
                label: label,
                size: CGSize(width: GalleryThumbnailMetrics.width, height: GalleryThumbnailMetrics.height),
                cornerRadius: 10
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityText)
    }
}

/// Shows the top of the (tall) list page, downsampled to its size; the label stays when the image is missing.
private struct GalleryTile: View {
    let image: HubEventImage
    let label: String
    let size: CGSize
    let cornerRadius: CGFloat

    @Environment(\.displayScale) private var displayScale
    @State private var loaded: UIImage?

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(Color(.tertiarySystemFill))
            if let loaded {
                Image(uiImage: loaded)
                    .resizable()
                    .scaledToFill()
                    .frame(width: size.width, height: size.height, alignment: .top)
                    .clipped()
            } else if !label.isEmpty {
                Text(label)
                    .font(.caption2)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .foregroundStyle(HubEventDetailColors.muted)
                    .padding(.horizontal, 4)
            }
        }
        .frame(width: size.width, height: size.height)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(HubEventDetailColors.line.opacity(0.6), lineWidth: 0.5)
        )
        .task(id: image.url) {
            guard let url = HubEventImagePolicy.displayURL(for: image) else { return }
            let target = CGSize(width: size.width * displayScale, height: size.height * displayScale)
            loaded = await HubEventGoodsGalleryImageLoader.shared.image(for: url, sizing: .fill(target))
        }
    }
}
