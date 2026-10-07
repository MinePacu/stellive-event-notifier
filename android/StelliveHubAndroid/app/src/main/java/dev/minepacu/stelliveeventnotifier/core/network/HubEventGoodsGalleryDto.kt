package dev.minepacu.stelliveeventnotifier.core.network

/**
 * One entry of `goodsListImages` on `GET /v1/hub-events/:id`. Every field is nullable so an entry with a missing
 * or unexpected field parses and is dropped by `HubEventGoodsGalleryPolicy.fromDtos` instead of failing the whole event.
 */
data class HubEventGoodsGalleryImageDto(
    val policyState: String? = null,
    val url: String? = null,
    val sourceLabel: String? = null,
    val sourceUrl: String? = null,
    val altText: String? = null,
)
