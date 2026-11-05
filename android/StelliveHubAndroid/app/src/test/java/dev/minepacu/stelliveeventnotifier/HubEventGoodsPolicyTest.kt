package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.CatalogRole
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsItem
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsSalesChannel
import dev.minepacu.stelliveeventnotifier.core.model.HubEventParticipationMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventSourceType
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.core.model.HubMember
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventGoodsPolicy
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HubEventGoodsPolicyTest {
    private fun item(
        id: String,
        group: String? = null,
        sortOrder: Int = 0,
        members: List<String> = emptyList(),
        price: Int? = null,
        bonus: Boolean = false,
        limit: Int? = null,
        channel: HubEventGoodsSalesChannel? = HubEventGoodsSalesChannel.ONLINE,
        priceNote: String? = null,
        limitNote: String? = null,
    ) = HubEventGoodsItem(
        id = id, name = "굿즈 $id", groupLabel = group, memberIds = members, priceKrw = price,
        priceNote = priceNote, salesChannel = channel, purchaseLimit = limit, limitNote = limitNote,
        isBonus = bonus, sortOrder = sortOrder,
    )

    private fun member(id: String, name: String) = HubMember(
        id = id, koreanName = name, englishName = id, generationId = "gen1", generationName = "1기생",
        unitName = "u", catalogRole = CatalogRole.MEMBER, isPerson = true,
    )

    @Test
    fun groupsKeepSortOrderWithinGroupAndPutUnlabelledLast() {
        val groups = HubEventGoodsPolicy.groups(
            listOf(
                item("c", group = null, sortOrder = 0),
                item("b", group = "인쇄물", sortOrder = 2),
                item("a", group = "아크릴", sortOrder = 1),
                item("d", group = "인쇄물", sortOrder = 3),
                item("e", group = "  ", sortOrder = 4),
                item("f", group = "기타", sortOrder = 5),
            ),
        )

        assertEquals(listOf("아크릴", "인쇄물", "기타"), groups.map { it.label })
        assertEquals(listOf("b", "d"), groups[1].items.map { it.id })
        assertEquals(listOf("c", "e", "f"), groups[2].items.map { it.id })
    }

    @Test
    fun memberFilterAppearsOnlyForTwoOrMoreDistinctMembers() {
        assertFalse(HubEventGoodsPolicy.showsMemberFilter(listOf(item("a", members = listOf("m1")), item("b", members = listOf("m1")))))
        assertFalse(HubEventGoodsPolicy.showsMemberFilter(listOf(item("a"))))
        val items = listOf(item("a", sortOrder = 0, members = listOf("m2")), item("b", sortOrder = 1, members = listOf("m1", "m2")))
        assertTrue(HubEventGoodsPolicy.showsMemberFilter(items))
        assertEquals(listOf("m2", "m1"), HubEventGoodsPolicy.memberIds(items))
        assertEquals(listOf("b"), HubEventGoodsPolicy.filterByMember(items, "m1").map { it.id })
        assertEquals(listOf("a", "b"), HubEventGoodsPolicy.filterByMember(items, null).map { it.id })
    }

    @Test
    fun collapsesAboveEightItemsAcrossGroupsAndExpands() {
        val items = (1..10).map { item("i$it", group = if (it <= 5) "A" else "B", sortOrder = it) }

        val collapsed = HubEventGoodsPolicy.present(items, expanded = false)
        assertEquals(8, collapsed.groups.sumOf { it.items.size })
        assertEquals(listOf(5, 3), collapsed.groups.map { it.items.size })
        assertEquals("전체 보기 (10)", collapsed.toggleLabel)

        val expanded = HubEventGoodsPolicy.present(items, expanded = true)
        assertEquals(10, expanded.groups.sumOf { it.items.size })
        assertEquals("접기", expanded.toggleLabel)
    }

    @Test
    fun eightItemsOrFewerAreNotCollapsed() {
        val items = (1..8).map { item("i$it", sortOrder = it) }

        val presentation = HubEventGoodsPolicy.present(items)

        assertNull(presentation.toggleLabel)
        assertEquals(8, presentation.groups.sumOf { it.items.size })
    }

    @Test
    fun collapseCountUsesMemberFilteredItems() {
        val items = (1..12).map { item("i$it", sortOrder = it, members = listOf(if (it <= 9) "m1" else "m2")) }

        assertEquals("전체 보기 (9)", HubEventGoodsPolicy.present(items, memberFilterId = "m1").toggleLabel)
        assertNull(HubEventGoodsPolicy.present(items, memberFilterId = "m2").toggleLabel)
    }

    @Test
    fun priceFormattingUsesGroupingNotePlaceholder() {
        assertEquals("12,000원", HubEventGoodsPolicy.priceText(item("a", price = 12000)))
        assertEquals("1,234,567원", HubEventGoodsPolicy.priceText(item("a", price = 1234567)))
        assertEquals("0원", HubEventGoodsPolicy.priceText(item("a", price = 0)))
        assertEquals("현장 공개", HubEventGoodsPolicy.priceText(item("a", priceNote = "현장 공개")))
        assertEquals("가격 미정", HubEventGoodsPolicy.priceText(item("a")))
    }

    @Test
    fun secondaryTextShowsPriceNoteOnlyAlongsidePriceAndLimitNote() {
        assertEquals("세트 가격 · 1인 2개", HubEventGoodsPolicy.secondaryText(item("a", price = 5000, priceNote = "세트 가격", limitNote = "1인 2개")))
        assertNull(HubEventGoodsPolicy.secondaryText(item("a", priceNote = "현장 공개")))
        assertEquals("멤버당 1개", HubEventGoodsPolicy.secondaryText(item("a", priceNote = "현장 공개", limitNote = "멤버당 1개")))
    }

    @Test
    fun chipLabelsCoverChannelLimitAndBonus() {
        assertEquals(listOf("현장"), HubEventGoodsPolicy.chipLabels(item("a", channel = HubEventGoodsSalesChannel.ONSITE)))
        assertEquals(listOf("온라인", "1인 3개"), HubEventGoodsPolicy.chipLabels(item("a", limit = 3)))
        assertEquals(
            listOf("현장·온라인", "특전"),
            HubEventGoodsPolicy.chipLabels(item("a", channel = HubEventGoodsSalesChannel.BOTH, bonus = true)),
        )
        assertEquals(emptyList<String>(), HubEventGoodsPolicy.chipLabels(item("a", channel = null)))
    }

    @Test
    fun memberNamesResolveFromCatalogAndTruncate() {
        val catalog = listOf(member("m1", "가"), member("m2", "나"), member("m3", "다"), member("m4", "라"), member("m5", "마"))

        assertEquals("가, 나", HubEventGoodsPolicy.memberNames(item("a", members = listOf("m1", "m2", "unknown")), catalog))
        assertEquals("가, 나, 다 외 2명", HubEventGoodsPolicy.memberNames(item("a", members = listOf("m1", "m2", "m3", "m4", "m5")), catalog))
        assertNull(HubEventGoodsPolicy.memberNames(item("a", members = listOf("unknown")), catalog))
        assertNull(HubEventGoodsPolicy.memberNames(item("a"), catalog))
    }

    @Test
    fun purchaseUrlIsHttpsOnly() {
        assertEquals("https://shop.example/x", HubEventGoodsPolicy.safePurchaseUrl(item("a").copy(purchaseUrl = " https://shop.example/x ")))
        assertNull(HubEventGoodsPolicy.safePurchaseUrl(item("a").copy(purchaseUrl = "http://shop.example/x")))
        assertNull(HubEventGoodsPolicy.safePurchaseUrl(item("a").copy(purchaseUrl = "intent://x")))
        assertNull(HubEventGoodsPolicy.safePurchaseUrl(item("a")))
    }

    @Test
    fun goodsCountLabelUsesCountOrItemsAndHidesZero() {
        fun event(count: Int, items: List<HubEventGoodsItem> = emptyList()) = HubEvent(
            id = "e", category = HubEventCategory.ONLINE_GOODS, participationMode = HubEventParticipationMode.ONLINE,
            status = HubEventStatus.OPEN, title = "t", generationId = "official", sourceUrl = "https://x.example",
            sourceLabel = "s", sourceType = HubEventSourceType.OFFICIAL, updatedAt = Instant.EPOCH,
            goodsItems = items, goodsCount = count,
        )

        assertEquals("굿즈 32종", HubEventGoodsPolicy.goodsCountLabel(event(32)))
        assertEquals("굿즈 2종", HubEventGoodsPolicy.goodsCountLabel(event(0, listOf(item("a"), item("b")))))
        assertNull(HubEventGoodsPolicy.goodsCountLabel(event(0)))
    }

    @Test
    fun checklistRulesBonusNotCheckableAndQuantityLimits() {
        val bonus = item("bonus", bonus = true)
        val limited = item("limited", limit = 3)
        val unlimited = item("unlimited")

        assertFalse(HubEventGoodsPolicy.isCheckable(bonus))
        assertTrue(HubEventGoodsPolicy.isCheckable(limited))
        assertEquals(3, HubEventGoodsPolicy.maxQuantity(limited))
        assertEquals(99, HubEventGoodsPolicy.maxQuantity(unlimited))
        assertEquals(3, HubEventGoodsPolicy.clampQuantity(limited, 10))
        assertEquals(1, HubEventGoodsPolicy.clampQuantity(limited, 0))
        assertEquals(99, HubEventGoodsPolicy.clampQuantity(unlimited, 500))
    }

    @Test
    fun summarySumsPricedItemsFlagsUnpricedAndIgnoresBonusAndMissing() {
        val items = listOf(
            item("a", price = 12000),
            item("b", price = 3000, limit = 2),
            item("c"),
            item("bonus", price = 1000, bonus = true),
        )

        val priced = HubEventGoodsPolicy.summary(items, mapOf("a" to 1, "b" to 5, "gone" to 4, "bonus" to 1))
        assertEquals(2, priced.selectedCount)
        assertEquals(12000L + 3000L * 2, priced.totalKrw) // b clamped to purchaseLimit 2
        assertFalse(priced.includesUnpriced)
        assertEquals("선택 2개 · 예상 합계 18,000원", priced.text)

        val withUnpriced = HubEventGoodsPolicy.summary(items, mapOf("a" to 1, "c" to 2))
        assertEquals("선택 2개 · 예상 합계 12,000원 (가격 미정 포함)", withUnpriced.text)

        assertEquals("선택 0개 · 예상 합계 0원", HubEventGoodsPolicy.summary(items, emptyMap()).text)
    }

    @Test
    fun summaryDoesNotOverflowIntRange() {
        val summary = HubEventGoodsPolicy.summary(listOf(item("a", price = 2_000_000_000)), mapOf("a" to 99))

        assertEquals(198_000_000_000L, summary.totalKrw)
    }
}
