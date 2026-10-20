package dev.minepacu.stelliveeventnotifier.feature.hubevents

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsItem
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsSalesChannel
import dev.minepacu.stelliveeventnotifier.core.model.HubMember
import java.util.Locale

data class HubEventGoodsGroup(val label: String, val items: List<HubEventGoodsItem>)

data class HubEventGoodsPresentation(
    val groups: List<HubEventGoodsGroup>,
    /** Number of items matching the member filter (before collapsing). */
    val totalCount: Int,
    /** "전체 보기 (N)" / "접기" when the list is longer than the collapse limit, otherwise null. */
    val toggleLabel: String?,
)

data class HubEventGoodsChecklistSummary(
    val selectedCount: Int,
    val totalKrw: Long,
    val includesUnpriced: Boolean,
) {
    val text: String
        get() = buildString {
            append("선택 ").append(selectedCount).append("개 · 예상 합계 ")
            append(HubEventGoodsPolicy.formatKrw(totalKrw))
            if (includesUnpriced) append(" (가격 미정 포함)")
        }
}

object HubEventGoodsPolicy {
    const val COLLAPSE_LIMIT = 8
    const val DEFAULT_MAX_QUANTITY = 99
    const val OTHER_GROUP_LABEL = "기타"
    private const val MEMBER_NAME_LIMIT = 3

    // region Grouping / filtering / collapsing

    private val displayOrder = compareBy<HubEventGoodsItem> { it.sortOrder }.thenBy { it.id }

    /** Distinct member ids in display order. */
    fun memberIds(items: List<HubEventGoodsItem>): List<String> =
        items.sortedWith(displayOrder).flatMap { it.memberIds }.distinct()

    fun showsMemberFilter(items: List<HubEventGoodsItem>): Boolean = memberIds(items).size >= 2

    fun filterByMember(items: List<HubEventGoodsItem>, memberId: String?): List<HubEventGoodsItem> =
        if (memberId == null) items else items.filter { memberId in it.memberIds }

    /**
     * Groups by groupLabel in order of each group's first item; items keep sortOrder within a group.
     * Items without a label (or labelled "기타") form the trailing "기타" group.
     */
    fun groups(items: List<HubEventGoodsItem>): List<HubEventGoodsGroup> {
        val sorted = items.sortedWith(displayOrder)
        val labelled = LinkedHashMap<String, MutableList<HubEventGoodsItem>>()
        val other = mutableListOf<HubEventGoodsItem>()
        sorted.forEach { item ->
            val label = item.groupLabel?.trim()?.takeIf { it.isNotEmpty() && it != OTHER_GROUP_LABEL }
            if (label == null) other += item else labelled.getOrPut(label) { mutableListOf() } += item
        }
        return buildList {
            labelled.forEach { (label, groupItems) -> add(HubEventGoodsGroup(label, groupItems)) }
            if (other.isNotEmpty()) add(HubEventGoodsGroup(OTHER_GROUP_LABEL, other))
        }
    }

    fun present(
        items: List<HubEventGoodsItem>,
        memberFilterId: String? = null,
        expanded: Boolean = false,
    ): HubEventGoodsPresentation {
        val filtered = filterByMember(items, memberFilterId)
        val allGroups = groups(filtered)
        val collapsible = filtered.size > COLLAPSE_LIMIT
        val visibleGroups = if (collapsible && !expanded) {
            var remaining = COLLAPSE_LIMIT
            allGroups.mapNotNull { group ->
                if (remaining <= 0) return@mapNotNull null
                val taken = group.items.take(remaining)
                remaining -= taken.size
                group.copy(items = taken)
            }
        } else {
            allGroups
        }
        val toggleLabel = when {
            !collapsible -> null
            expanded -> "접기"
            else -> "전체 보기 (${filtered.size})"
        }
        return HubEventGoodsPresentation(visibleGroups, filtered.size, toggleLabel)
    }

    // endregion

    // region Row formatting

    fun formatKrw(amount: Long): String = String.format(Locale.US, "%,d원", amount)

    /** Primary price text: formatted price, else the price note, else "가격 미정". */
    fun priceText(item: HubEventGoodsItem): String =
        item.priceKrw?.let { formatKrw(it.toLong()) } ?: item.priceNote ?: "가격 미정"

    /** Secondary line: price note (only when a price is shown) and purchase-limit note. */
    fun secondaryText(item: HubEventGoodsItem): String? =
        listOfNotNull(item.priceNote.takeIf { item.priceKrw != null }, item.limitNote)
            .joinToString(" · ")
            .ifEmpty { null }

    fun channelLabel(channel: HubEventGoodsSalesChannel?): String? = when (channel) {
        HubEventGoodsSalesChannel.ONSITE -> "현장"
        HubEventGoodsSalesChannel.ONLINE -> "온라인"
        HubEventGoodsSalesChannel.BOTH -> "현장·온라인"
        null -> null
    }

    /** List-row chip text, e.g. "굿즈 32종"; null when the server reported no goods. */
    fun goodsCountLabel(event: HubEvent): String? =
        maxOf(event.goodsCount, event.goodsItems.size).takeIf { it > 0 }?.let { "굿즈 ${it}종" }

    fun limitLabel(item: HubEventGoodsItem): String? = item.purchaseLimit?.let { "1인 ${it}개" }

    fun chipLabels(item: HubEventGoodsItem): List<String> = listOfNotNull(
        channelLabel(item.salesChannel),
        limitLabel(item),
        "특전".takeIf { item.isBonus },
    )

    /** Resolves member ids to display names via the catalog; unknown ids are dropped. */
    fun memberNames(item: HubEventGoodsItem, members: List<HubMember>): String? {
        val byId = members.associateBy { it.id }
        val names = item.memberIds.mapNotNull { id -> byId[id]?.let { it.koreanName.ifBlank { it.englishName } } }
        if (names.isEmpty()) return null
        return if (names.size > MEMBER_NAME_LIMIT) {
            names.take(MEMBER_NAME_LIMIT).joinToString(", ") + " 외 ${names.size - MEMBER_NAME_LIMIT}명"
        } else {
            names.joinToString(", ")
        }
    }

    fun memberFilterLabel(memberId: String, members: List<HubMember>): String =
        members.firstOrNull { it.id == memberId }?.let { it.koreanName.ifBlank { it.englishName } } ?: memberId

    /** The purchase URL when it passes the https-only policy. */
    fun safePurchaseUrl(item: HubEventGoodsItem): String? =
        item.purchaseUrl?.trim()?.takeIf { it.startsWith("https://", ignoreCase = true) }

    // endregion

    // region Checklist rules

    /** Bonus items (특전) are given, not purchased, so they cannot be checked. */
    fun isCheckable(item: HubEventGoodsItem): Boolean = !item.isBonus

    fun maxQuantity(item: HubEventGoodsItem): Int = item.purchaseLimit?.coerceAtLeast(1) ?: DEFAULT_MAX_QUANTITY

    fun clampQuantity(item: HubEventGoodsItem, quantity: Int): Int = quantity.coerceIn(1, maxQuantity(item))

    /**
     * [stored] maps goodsItemId -> quantity. Only checkable items that still exist count; quantities are
     * clamped to the current purchase limit. Unpriced items are excluded from the sum and flagged.
     */
    fun summary(items: List<HubEventGoodsItem>, stored: Map<String, Int>): HubEventGoodsChecklistSummary {
        var count = 0
        var total = 0L
        var unpriced = false
        items.forEach { item ->
            val quantity = stored[item.id]?.takeIf { isCheckable(item) } ?: return@forEach
            count += 1
            val price = item.priceKrw
            if (price == null) unpriced = true else total += price.toLong() * clampQuantity(item, quantity)
        }
        return HubEventGoodsChecklistSummary(count, total, unpriced)
    }

    // endregion
}
