package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventImage
import dev.minepacu.stelliveeventnotifier.core.model.HubEventImagePolicyState
import dev.minepacu.stelliveeventnotifier.core.model.HubEventParticipationMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventSourceType
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventGoodsGalleryPolicy
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventGoodsSectionMode
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HubEventGoodsGalleryPolicyTest {
    private fun image(
        url: String? = "https://stellive.me/a.png",
        state: HubEventImagePolicyState = HubEventImagePolicyState.OFFICIAL_RUNTIME_URL,
        alt: String? = null,
        label: String? = null,
        source: String? = null,
    ) = HubEventImage(state, url = url, sourceLabel = label, sourceUrl = source, altText = alt)

    private fun event(
        purchaseUrl: String? = null,
        sourceUrl: String? = "https://stellive.me/notice/1",
        images: List<HubEventImage> = emptyList(),
    ) = HubEvent(
        id = "e", category = HubEventCategory.ONLINE_GOODS, participationMode = HubEventParticipationMode.ONLINE,
        status = HubEventStatus.OPEN, title = "t", generationId = "official", sourceUrl = sourceUrl ?: "",
        sourceLabel = "s", sourceType = HubEventSourceType.OFFICIAL, updatedAt = Instant.EPOCH,
        purchaseUrl = purchaseUrl, goodsListImages = images,
    )

    @Test
    fun sectionVisibilityMatrix() {
        assertEquals(HubEventGoodsSectionMode.HIDDEN, HubEventGoodsGalleryPolicy.sectionMode(false, 0))
        assertEquals(HubEventGoodsSectionMode.ITEMS_ONLY, HubEventGoodsGalleryPolicy.sectionMode(true, 0))
        assertEquals(HubEventGoodsSectionMode.GALLERY_WITH_ITEMS, HubEventGoodsGalleryPolicy.sectionMode(true, 3))
        assertEquals(HubEventGoodsSectionMode.GALLERY_ONLY, HubEventGoodsGalleryPolicy.sectionMode(false, 3))
    }

    @Test
    fun modeFlagsMatchTheMatrix() {
        val expected = mapOf(
            HubEventGoodsSectionMode.HIDDEN to Triple(false, false, false),
            HubEventGoodsSectionMode.ITEMS_ONLY to Triple(false, true, false),
            HubEventGoodsSectionMode.GALLERY_WITH_ITEMS to Triple(true, true, false),
            HubEventGoodsSectionMode.GALLERY_ONLY to Triple(true, false, true),
        )
        expected.forEach { (mode, flags) ->
            assertEquals("gallery $mode", flags.first, HubEventGoodsGalleryPolicy.showsGallery(mode))
            assertEquals("checklist $mode", flags.second, HubEventGoodsGalleryPolicy.showsChecklist(mode))
            assertEquals("notice $mode", flags.third, HubEventGoodsGalleryPolicy.showsEmptyItemsNotice(mode))
        }
    }

    @Test
    fun killSwitchRemovedFieldMeansNothingToRender() {
        // Server kill switch omits goodsListImages -> empty list -> hidden gallery, unchanged items behaviour.
        val e = event()
        assertTrue(HubEventGoodsGalleryPolicy.displayableImages(e).isEmpty())
        assertEquals(HubEventGoodsSectionMode.HIDDEN, HubEventGoodsGalleryPolicy.sectionMode(false, HubEventGoodsGalleryPolicy.displayableImages(e).size))
    }

    @Test
    fun displayableImagesDefensivelyFilterAndCap() {
        val mixed = listOf(
            image("https://stellive.me/1.png"),
            image("http://stellive.me/2.png"),
            image("https://stellive.me/3.png", HubEventImagePolicyState.BLOCKED),
            image(null),
            image("https://"),
            image("https://pbs.twimg.com/4.png", HubEventImagePolicyState.THIRD_PARTY_ALLOWED),
        )
        assertEquals(
            listOf("https://stellive.me/1.png", "https://pbs.twimg.com/4.png"),
            HubEventGoodsGalleryPolicy.displayableImages(event(images = mixed)).map { it.url },
        )
        val many = (1..30).map { image("https://stellive.me/$it.png") }
        assertEquals(20, HubEventGoodsGalleryPolicy.sanitize(many).size)
    }

    @Test
    fun countAndThumbnailLabels() {
        assertEquals("9장 · 공식 공지 ↗", HubEventGoodsGalleryPolicy.countLabel(9))
        assertEquals("MD 1", HubEventGoodsGalleryPolicy.thumbnailLabel(image(), 0))
        assertEquals("MD 4", HubEventGoodsGalleryPolicy.thumbnailLabel(image(alt = "  "), 3))
        assertEquals("특전 리스트", HubEventGoodsGalleryPolicy.thumbnailLabel(image(alt = "특전 리스트"), 3))
    }

    @Test
    fun viewerTitleFormat() {
        assertEquals("MD 리스트 3 · 3 / 9", HubEventGoodsGalleryPolicy.viewerTitle(image(alt = "MD 리스트 3"), 2, 9))
        assertEquals("이미지 1 / 9", HubEventGoodsGalleryPolicy.viewerTitle(image(), 0, 9))
        assertEquals("이미지 2 / 2", HubEventGoodsGalleryPolicy.viewerTitle(image(alt = " "), 1, 2))
    }

    @Test
    fun sourceCaptionsFallBackToOfficialNotice() {
        assertEquals("출처: 공식 공지 · 눌러서 크게 보기", HubEventGoodsGalleryPolicy.stripCaption(listOf(image(), image(label = " "))))
        assertEquals(
            "출처: 스텔라이브 공지 · 눌러서 크게 보기",
            HubEventGoodsGalleryPolicy.stripCaption(listOf(image(), image(label = "스텔라이브 공지"))),
        )
        assertEquals("출처: 공식 공지", HubEventGoodsGalleryPolicy.viewerSourceCaption(image()))
        assertEquals("출처: X 공지", HubEventGoodsGalleryPolicy.viewerSourceCaption(image(label = " X 공지 ")))
    }

    @Test
    fun noticeUrlPrefersImageSourceThenEventAndRequiresHttps() {
        val e = event(sourceUrl = "https://stellive.me/notice/1")
        assertEquals("https://stellive.me/notice/9", HubEventGoodsGalleryPolicy.noticeUrl(e, image(source = "https://stellive.me/notice/9")))
        assertEquals("https://stellive.me/notice/1", HubEventGoodsGalleryPolicy.noticeUrl(e, image(source = "http://insecure.example")))
        assertEquals("https://stellive.me/notice/1", HubEventGoodsGalleryPolicy.noticeUrl(e))
        assertNull(HubEventGoodsGalleryPolicy.noticeUrl(event(sourceUrl = "http://x.example")))
    }

    @Test
    fun purchaseButtonOnlyForHttpsPurchaseUrl() {
        assertEquals("https://shop.example/x", HubEventGoodsGalleryPolicy.safePurchaseUrl(event(purchaseUrl = " https://shop.example/x ")))
        assertNull(HubEventGoodsGalleryPolicy.safePurchaseUrl(event(purchaseUrl = "http://shop.example/x")))
        assertNull(HubEventGoodsGalleryPolicy.safePurchaseUrl(event(purchaseUrl = null)))
        assertFalse(HubEventGoodsGalleryPolicy.EMPTY_ITEMS_NOTICE.isBlank())
    }
}
