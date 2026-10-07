package dev.minepacu.stelliveeventnotifier.feature.hubevents

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
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
    const val DEFAULT_SOURCE_LABEL = "공식 공지"
    const val EMPTY_ITEMS_NOTICE = "상품 목록은 아직 등록되지 않았어요.\n위 MD 리스트 이미지에서 확인하세요."
    const val PURCHASE_BUTTON_LABEL = "구매 페이지 ↗"
    const val NOTICE_LINK_SUFFIX = "공식 공지 ↗"

    /** Maps DTO entries to domain images, dropping null/incomplete/undisplayable ones. Order is preserved. */
    fun fromDtos(dtos: List<HubEventGoodsGalleryImageDto?>?): List<HubEventImage> =
        sanitize(
            dtos.orEmpty().mapNotNull { dto ->
                dto ?: return@mapNotNull null
                val state = HubEventImagePolicyState.entries
                    .firstOrNull { it.apiValue == dto.policyState } ?: return@mapNotNull null
                HubEventImage(
                    policyState = state,
                    url = dto.url?.trim()?.takeIf(String::isNotEmpty),
                    sourceLabel = dto.sourceLabel?.trim()?.takeIf(String::isNotEmpty),
                    sourceUrl = dto.sourceUrl?.trim()?.takeIf(String::isNotEmpty),
                    altText = dto.altText?.trim()?.takeIf(String::isNotEmpty),
                )
            },
        )

    /** Applies the existing image display policy plus a host check, keeping order and capping at [MAX_IMAGES]. */
    fun sanitize(images: List<HubEventImage>): List<HubEventImage> =
        images
            .filter { HubEventImagePolicy.canDisplay(it) && hasHost(it.url) }
            .map { it.copy(url = it.url?.trim()) }
            .take(MAX_IMAGES)

    fun displayableImages(event: HubEvent): List<HubEventImage> = sanitize(event.goodsListImages)

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

    /** Header's right side, e.g. "9장 · 공식 공지 ↗". */
    fun countLabel(imageCount: Int): String = "${imageCount}장 · $NOTICE_LINK_SUFFIX"

    /** Thumbnail placeholder label: the image's altText, otherwise "MD n" (1-based). */
    fun thumbnailLabel(image: HubEventImage, index: Int): String =
        image.altText?.trim()?.takeIf(String::isNotEmpty) ?: "MD ${index + 1}"

    /** Caption below the strip: uses the first image that names a source. */
    fun stripCaption(images: List<HubEventImage>): String =
        "출처: ${sourceLabel(images.firstNotNullOfOrNull { it.sourceLabel?.trim()?.takeIf(String::isNotEmpty) })} · 눌러서 크게 보기"

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

    fun thumbnailContentDescription(label: String, index: Int, total: Int): String =
        "공식 MD 리스트 $label, ${index + 1}번째 중 ${total}장, 눌러서 크게 보기"

    private fun safeHttpsUrl(url: String?): String? =
        url?.trim()?.takeIf { it.startsWith("https://", ignoreCase = true) && hasHost(it) }

    private fun hasHost(url: String?): Boolean {
        val trimmed = url?.trim().orEmpty()
        return runCatching { !URI(trimmed).host.isNullOrBlank() }.getOrDefault(false)
    }
}
