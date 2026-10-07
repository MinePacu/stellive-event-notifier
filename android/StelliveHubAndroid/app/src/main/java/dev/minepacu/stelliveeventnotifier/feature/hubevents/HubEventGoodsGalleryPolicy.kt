package dev.minepacu.stelliveeventnotifier.feature.hubevents

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsListImage
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsListImageKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsListLayout
import dev.minepacu.stelliveeventnotifier.core.model.HubEventImage
import dev.minepacu.stelliveeventnotifier.core.model.HubEventImagePolicyState
import dev.minepacu.stelliveeventnotifier.core.network.HubEventGoodsGalleryImageDto
import java.net.URI

/** Which parts of the goods section render for a given (goods items x gallery images) combination. */
enum class HubEventGoodsSectionMode {
    /** No goods items and no gallery images: the whole section is hidden. */
    HIDDEN,

    /** Goods items only (pre-gallery behaviour). */
    ITEMS_ONLY,

    /** Gallery strip on top of the goods list and checklist. */
    GALLERY_WITH_ITEMS,

    /** Image-only notice: gallery plus a "goods list not registered yet" note. */
    GALLERY_ONLY,
}

/**
 * Pure rules for the "공식 MD 리스트" gallery. The gallery is shown only when the server sends
 * `goodsListImages`; when the server kill switch removes the field every function here yields "hidden".
 */
object HubEventGoodsGalleryPolicy {
    const val MAX_IMAGES = 20
    const val SECTION_TITLE = "공식 MD 리스트"
    const val BONUS_SECTION_TITLE = "특전"
    const val DEFAULT_SOURCE_LABEL = "공식 공지"
    const val EMPTY_ITEMS_NOTICE = "상품 목록은 아직 등록되지 않았어요.\n위 MD 리스트 이미지에서 확인하세요."
    const val PURCHASE_BUTTON_LABEL = "구매 페이지 ↗"
    const val NOTICE_LINK_SUFFIX = "공식 공지 ↗"
    const val COLLAPSED_TITLE = "공식 MD 리스트 이미지"
    const val EXPAND_CONTROL_LABEL = "보기 ⌄"
    const val COLLAPSE_CONTROL_LABEL = "접기 ⌃"
    const val COLLAPSED_THUMBNAIL_COUNT = 3
    const val SETTING_TOGGLE_TITLE = "굿즈 MD 리스트 이미지 펼쳐서 보기"
    const val SETTING_TOGGLE_BODY =
        "켜면 상품 목록이 있는 행사도 공식 MD 리스트 이미지를 펼친 채로 보여줍니다. 이 기기에만 저장되며, 다음에 상세 화면을 열 때부터 적용됩니다."

    /** One strip in the gallery card. The viewer pages within a row's images only. */
    data class Row(
        /** `null` for the single-layout row that mixes both kinds. */
        val kind: HubEventGoodsListImageKind?,
        val title: String,
        val images: List<HubEventGoodsListImage>,
    )

    /** Maps DTO entries to domain images, dropping null/incomplete/undisplayable ones. Order is preserved. */
    fun fromDtos(dtos: List<HubEventGoodsGalleryImageDto?>?): List<HubEventGoodsListImage> =
        sanitize(
            dtos.orEmpty().mapNotNull { dto ->
                dto ?: return@mapNotNull null
                val state = HubEventImagePolicyState.entries
                    .firstOrNull { it.apiValue == dto.policyState } ?: return@mapNotNull null
                HubEventGoodsListImage(
                    image = HubEventImage(
                        policyState = state,
                        url = dto.url?.trim()?.takeIf(String::isNotEmpty),
                        sourceLabel = dto.sourceLabel?.trim()?.takeIf(String::isNotEmpty),
                        sourceUrl = dto.sourceUrl?.trim()?.takeIf(String::isNotEmpty),
                        altText = dto.altText?.trim()?.takeIf(String::isNotEmpty),
                    ),
                    kind = HubEventGoodsListImageKind.fromApiValue(dto.kind),
                )
            },
        )

    /** Applies the existing image display policy plus a host check, keeping order and capping at [MAX_IMAGES]. */
    fun sanitize(images: List<HubEventGoodsListImage>): List<HubEventGoodsListImage> =
        images
            .filter { HubEventImagePolicy.canDisplay(it.image) && hasHost(it.image.url) }
            .map { it.copy(image = it.image.copy(url = it.image.url?.trim())) }
            .take(MAX_IMAGES)

    fun displayableImages(event: HubEvent): List<HubEventGoodsListImage> = sanitize(event.goodsListImages)

    /**
     * split: an "공식 MD 리스트" row (md) then a "특전" row (bonus), empty rows omitted.
     * single: one "공식 MD 리스트" row with every image in notice order.
     */
    fun rows(images: List<HubEventGoodsListImage>, layout: HubEventGoodsListLayout): List<Row> {
        if (images.isEmpty()) return emptyList()
        return when (layout) {
            HubEventGoodsListLayout.SINGLE -> listOf(Row(null, SECTION_TITLE, images))
            HubEventGoodsListLayout.SPLIT -> {
                val md = images.filter { it.kind == HubEventGoodsListImageKind.MD }
                val bonus = images.filter { it.kind == HubEventGoodsListImageKind.BONUS }
                listOfNotNull(
                    md.takeIf { it.isNotEmpty() }?.let { Row(HubEventGoodsListImageKind.MD, SECTION_TITLE, it) },
                    bonus.takeIf { it.isNotEmpty() }?.let { Row(HubEventGoodsListImageKind.BONUS, BONUS_SECTION_TITLE, it) },
                )
            }
        }
    }

    /** Starting state of a gallery view. Image-only notices (no goods items) are always expanded. */
    fun initiallyExpanded(hasGoodsItems: Boolean, expandedByDefault: Boolean): Boolean =
        !hasGoodsItems || expandedByDefault

    /** Collapsed row subtitle: split "MD 7장 · 특전 2장" (empty kinds omitted), single "9장". */
    fun collapsedSubtitle(images: List<HubEventGoodsListImage>, layout: HubEventGoodsListLayout): String =
        when (layout) {
            HubEventGoodsListLayout.SINGLE -> "${images.size}장"
            HubEventGoodsListLayout.SPLIT -> {
                val md = images.count { it.kind == HubEventGoodsListImageKind.MD }
                val bonus = images.count { it.kind == HubEventGoodsListImageKind.BONUS }
                listOfNotNull(
                    "MD ${md}장".takeIf { md > 0 },
                    "특전 ${bonus}장".takeIf { bonus > 0 },
                ).joinToString(" · ")
            }
        }

    fun sectionMode(hasGoodsItems: Boolean, imageCount: Int): HubEventGoodsSectionMode = when {
        hasGoodsItems && imageCount > 0 -> HubEventGoodsSectionMode.GALLERY_WITH_ITEMS
        hasGoodsItems -> HubEventGoodsSectionMode.ITEMS_ONLY
        imageCount > 0 -> HubEventGoodsSectionMode.GALLERY_ONLY
        else -> HubEventGoodsSectionMode.HIDDEN
    }

    fun showsGallery(mode: HubEventGoodsSectionMode): Boolean =
        mode == HubEventGoodsSectionMode.GALLERY_WITH_ITEMS || mode == HubEventGoodsSectionMode.GALLERY_ONLY

    /** Checklist summary, filter and rows exist only when there are goods items. */
    fun showsChecklist(mode: HubEventGoodsSectionMode): Boolean =
        mode == HubEventGoodsSectionMode.ITEMS_ONLY || mode == HubEventGoodsSectionMode.GALLERY_WITH_ITEMS

    fun showsEmptyItemsNotice(mode: HubEventGoodsSectionMode): Boolean = mode == HubEventGoodsSectionMode.GALLERY_ONLY

    /** Row header's right side, e.g. "9장 · 공식 공지 ↗". The notice link is shown once per card, on the first row. */
    fun countLabel(imageCount: Int, includesNoticeLink: Boolean): String =
        if (includesNoticeLink) "${imageCount}장 · $NOTICE_LINK_SUFFIX" else "${imageCount}장"

    /** Thumbnail placeholder label: the image's altText, otherwise "MD n" (bonus images: "특전 n"), 1-based. */
    fun thumbnailLabel(entry: HubEventGoodsListImage, index: Int): String =
        entry.image.altText?.trim()?.takeIf(String::isNotEmpty)
            ?: if (entry.kind == HubEventGoodsListImageKind.BONUS) "특전 ${index + 1}" else "MD ${index + 1}"

    /** Caption below the strip: uses the first image that names a source. */
    fun stripCaption(images: List<HubEventGoodsListImage>): String =
        "출처: ${sourceLabel(images.firstNotNullOfOrNull { it.image.sourceLabel?.trim()?.takeIf(String::isNotEmpty) })} · 눌러서 크게 보기"

    /** The viewer pages within the tapped row's images only (every image in single layout). */
    fun viewerImages(row: Row): List<HubEventImage> = row.images.map { it.image }

    /**
     * Viewer title format: "{altText} · n / N" (e.g. "MD 리스트 3 · 3 / 9"); without altText "이미지 n / N".
     * `index` is 0-based, the displayed position is 1-based.
     */
    fun viewerTitle(image: HubEventImage, index: Int, total: Int): String {
        val alt = image.altText?.trim()?.takeIf(String::isNotEmpty)
        val position = "${index + 1} / $total"
        return if (alt != null) "$alt · $position" else "이미지 $position"
    }

    fun viewerSourceCaption(image: HubEventImage): String = "출처: ${sourceLabel(image.sourceLabel)}"

    fun sourceLabel(label: String?): String = label?.trim()?.takeIf(String::isNotEmpty) ?: DEFAULT_SOURCE_LABEL

    /** Notice URL for the "open notice" actions: the image's own source if https, otherwise the event's source. */
    fun noticeUrl(event: HubEvent, image: HubEventImage? = null): String? =
        safeHttpsUrl(image?.sourceUrl) ?: safeHttpsUrl(event.sourceUrl)

    fun safePurchaseUrl(event: HubEvent): String? = safeHttpsUrl(event.purchaseUrl)

    fun thumbnailContentDescription(title: String, label: String, index: Int, total: Int): String =
        "$title $label, ${total}장 중 ${index + 1}번째, 눌러서 크게 보기"

    private fun safeHttpsUrl(url: String?): String? =
        url?.trim()?.takeIf { it.startsWith("https://", ignoreCase = true) && hasHost(it) }

    private fun hasHost(url: String?): Boolean {
        val trimmed = url?.trim().orEmpty()
        return runCatching { !URI(trimmed).host.isNullOrBlank() }.getOrDefault(false)
    }
}
