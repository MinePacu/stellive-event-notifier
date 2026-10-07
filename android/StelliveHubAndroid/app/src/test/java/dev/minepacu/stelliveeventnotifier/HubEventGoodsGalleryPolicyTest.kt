package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsListImage
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsListImageKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsListLayout
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

    private fun entry(
        kind: HubEventGoodsListImageKind = HubEventGoodsListImageKind.MD,
        alt: String? = null,
        n: Int = 1,
    ) = HubEventGoodsListImage(image(url = "https://stellive.me/$n.png", alt = alt), kind)

    private fun event(
        purchaseUrl: String? = null,
        sourceUrl: String? = "https://stellive.me/notice/1",
        images: List<HubEventGoodsListImage> = emptyList(),
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
        ).map(::HubEventGoodsListImage)
        assertEquals(
            listOf("https://stellive.me/1.png", "https://pbs.twimg.com/4.png"),
            HubEventGoodsGalleryPolicy.displayableImages(event(images = mixed)).map { it.image.url },
        )
        val many = (1..30).map { HubEventGoodsListImage(image("https://stellive.me/$it.png")) }
        assertEquals(20, HubEventGoodsGalleryPolicy.sanitize(many).size)
    }

    @Test
    fun countAndThumbnailLabels() {
        assertEquals("9장 · 공식 공지 ↗", HubEventGoodsGalleryPolicy.countLabel(9, includesNoticeLink = true))
        assertEquals("2장", HubEventGoodsGalleryPolicy.countLabel(2, includesNoticeLink = false))
        assertEquals("MD 1", HubEventGoodsGalleryPolicy.thumbnailLabel(entry(), 0))
        assertEquals("MD 4", HubEventGoodsGalleryPolicy.thumbnailLabel(entry(alt = "  "), 3))
        assertEquals("특전 리스트", HubEventGoodsGalleryPolicy.thumbnailLabel(entry(alt = "특전 리스트"), 3))
        assertEquals("특전 1", HubEventGoodsGalleryPolicy.thumbnailLabel(entry(HubEventGoodsListImageKind.BONUS), 0))
        assertEquals("특전 3", HubEventGoodsGalleryPolicy.thumbnailLabel(entry(HubEventGoodsListImageKind.BONUS, alt = " "), 2))
        assertEquals("특전 포스터", HubEventGoodsGalleryPolicy.thumbnailLabel(entry(HubEventGoodsListImageKind.BONUS, alt = "특전 포스터"), 0))
    }

    @Test
    fun viewerTitleFormat() {
        assertEquals("MD 리스트 3 · 3 / 9", HubEventGoodsGalleryPolicy.viewerTitle(image(alt = "MD 리스트 3"), 2, 9))
        assertEquals("이미지 1 / 9", HubEventGoodsGalleryPolicy.viewerTitle(image(), 0, 9))
        assertEquals("이미지 2 / 2", HubEventGoodsGalleryPolicy.viewerTitle(image(alt = " "), 1, 2))
    }

    @Test
    fun sourceCaptionsFallBackToOfficialNotice() {
        assertEquals("출처: 공식 공지 · 눌러서 크게 보기", HubEventGoodsGalleryPolicy.stripCaption(listOf(image(), image(label = " ")).map(::HubEventGoodsListImage)))
        assertEquals(
            "출처: 스텔라이브 공지 · 눌러서 크게 보기",
            HubEventGoodsGalleryPolicy.stripCaption(listOf(image(), image(label = "스텔라이브 공지")).map(::HubEventGoodsListImage)),
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

    private val mdKind = HubEventGoodsListImageKind.MD
    private val bonusKind = HubEventGoodsListImageKind.BONUS

    // Notice order: md1, bonus2, md3, bonus4, md5.
    private val mixedEntries = listOf(
        entry(mdKind, n = 1), entry(bonusKind, n = 2), entry(mdKind, n = 3), entry(bonusKind, n = 4), entry(mdKind, n = 5),
    )

    @Test
    fun kindAndLayoutFallbacks() {
        assertEquals(HubEventGoodsListImageKind.MD, HubEventGoodsListImageKind.fromApiValue(null))
        assertEquals(HubEventGoodsListImageKind.MD, HubEventGoodsListImageKind.fromApiValue("md"))
        assertEquals(HubEventGoodsListImageKind.BONUS, HubEventGoodsListImageKind.fromApiValue("bonus"))
        assertEquals(HubEventGoodsListImageKind.MD, HubEventGoodsListImageKind.fromApiValue("BONUS2"))
        assertEquals(HubEventGoodsListLayout.SPLIT, HubEventGoodsListLayout.fromApiValue(null))
        assertEquals(HubEventGoodsListLayout.SINGLE, HubEventGoodsListLayout.fromApiValue("single"))
        assertEquals(HubEventGoodsListLayout.SPLIT, HubEventGoodsListLayout.fromApiValue("whatever"))
        assertEquals(HubEventGoodsListLayout.SPLIT, event().goodsListLayout)
    }

    @Test
    fun splitRowsGroupByKindKeepingOrderAndHideEmptyRows() {
        val rows = HubEventGoodsGalleryPolicy.rows(mixedEntries, HubEventGoodsListLayout.SPLIT)

        assertEquals(listOf("공식 MD 리스트", "특전"), rows.map { it.title })
        assertEquals(listOf(mdKind, bonusKind), rows.map { it.kind })
        assertEquals(listOf(1, 3, 5), rows[0].images.map { it.image.url!!.substringAfterLast('/').removeSuffix(".png").toInt() })
        assertEquals(listOf(2, 4), rows[1].images.map { it.image.url!!.substringAfterLast('/').removeSuffix(".png").toInt() })

        val mdOnly = HubEventGoodsGalleryPolicy.rows(listOf(entry(mdKind, n = 1)), HubEventGoodsListLayout.SPLIT)
        assertEquals(listOf("공식 MD 리스트"), mdOnly.map { it.title })
        val bonusOnly = HubEventGoodsGalleryPolicy.rows(listOf(entry(bonusKind, n = 1)), HubEventGoodsListLayout.SPLIT)
        assertEquals(listOf("특전"), bonusOnly.map { it.title })
        assertTrue(HubEventGoodsGalleryPolicy.rows(emptyList(), HubEventGoodsListLayout.SPLIT).isEmpty())
        assertTrue(HubEventGoodsGalleryPolicy.rows(emptyList(), HubEventGoodsListLayout.SINGLE).isEmpty())
    }

    @Test
    fun singleLayoutIsOneMdRowInNoticeOrder() {
        val rows = HubEventGoodsGalleryPolicy.rows(mixedEntries, HubEventGoodsListLayout.SINGLE)

        assertEquals(1, rows.size)
        assertEquals("공식 MD 리스트", rows[0].title)
        assertNull(rows[0].kind)
        assertEquals(mixedEntries, rows[0].images)
    }

    @Test
    fun viewerSequenceIsTheTappedRowOnly() {
        val split = HubEventGoodsGalleryPolicy.rows(mixedEntries, HubEventGoodsListLayout.SPLIT)
        val bonusSequence = HubEventGoodsGalleryPolicy.viewerImages(split[1])
        assertEquals(listOf("https://stellive.me/2.png", "https://stellive.me/4.png"), bonusSequence.map { it.url })
        // Opening the second bonus thumbnail (index 1) shows "2 / 2", not "4 / 5".
        assertEquals("이미지 2 / 2", HubEventGoodsGalleryPolicy.viewerTitle(bonusSequence[1], 1, bonusSequence.size))
        val mdSequence = HubEventGoodsGalleryPolicy.viewerImages(split[0])
        assertEquals("이미지 3 / 3", HubEventGoodsGalleryPolicy.viewerTitle(mdSequence[2], 2, mdSequence.size))

        val single = HubEventGoodsGalleryPolicy.rows(mixedEntries, HubEventGoodsListLayout.SINGLE)
        val all = HubEventGoodsGalleryPolicy.viewerImages(single[0])
        assertEquals(5, all.size)
        assertEquals("이미지 4 / 5", HubEventGoodsGalleryPolicy.viewerTitle(all[3], 3, all.size))
    }

    @Test
    fun collapsedSubtitleSplitAndSingle() {
        assertEquals("MD 3장 · 특전 2장", HubEventGoodsGalleryPolicy.collapsedSubtitle(mixedEntries, HubEventGoodsListLayout.SPLIT))
        assertEquals(
            "MD 2장",
            HubEventGoodsGalleryPolicy.collapsedSubtitle(listOf(entry(mdKind, n = 1), entry(mdKind, n = 2)), HubEventGoodsListLayout.SPLIT),
        )
        assertEquals(
            "특전 1장",
            HubEventGoodsGalleryPolicy.collapsedSubtitle(listOf(entry(bonusKind)), HubEventGoodsListLayout.SPLIT),
        )
        assertEquals("5장", HubEventGoodsGalleryPolicy.collapsedSubtitle(mixedEntries, HubEventGoodsListLayout.SINGLE))
        assertEquals("공식 MD 리스트 이미지", HubEventGoodsGalleryPolicy.COLLAPSED_TITLE)
        assertEquals("보기 ⌄", HubEventGoodsGalleryPolicy.EXPAND_CONTROL_LABEL)
        assertEquals("접기 ⌃", HubEventGoodsGalleryPolicy.COLLAPSE_CONTROL_LABEL)
    }

    @Test
    fun initialExpansionMatrix() {
        // hasGoodsItems x setting; image-only notices (no items) are always expanded.
        assertFalse(HubEventGoodsGalleryPolicy.initiallyExpanded(hasGoodsItems = true, expandedByDefault = false))
        assertTrue(HubEventGoodsGalleryPolicy.initiallyExpanded(hasGoodsItems = true, expandedByDefault = true))
        assertTrue(HubEventGoodsGalleryPolicy.initiallyExpanded(hasGoodsItems = false, expandedByDefault = false))
        assertTrue(HubEventGoodsGalleryPolicy.initiallyExpanded(hasGoodsItems = false, expandedByDefault = true))
    }
}
