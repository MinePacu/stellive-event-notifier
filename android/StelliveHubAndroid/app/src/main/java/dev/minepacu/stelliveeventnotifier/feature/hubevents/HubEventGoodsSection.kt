package dev.minepacu.stelliveeventnotifier.feature.hubevents

import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import com.google.android.material.checkbox.MaterialCheckBox
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsItem
import dev.minepacu.stelliveeventnotifier.core.model.HubMember
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardStyle
import kotlinx.coroutines.launch

/**
 * "굿즈" section of the hub event detail screen. Rendered only when the event has goods items.
 * Checklist state comes from [MainActivity.goodsChecklistStore]; every change is written to the store and
 * the section re-renders itself from the store's flow, so the surrounding screen keeps its scroll position.
 */
internal class HubEventGoodsSection(private val activity: MainActivity) {

    fun build(event: HubEvent, fullScreen: Boolean): View? {
        if (event.goodsItems.isEmpty()) return null
        val members = activity.serverMembers ?: activity.repository.members
        val root = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                if (fullScreen) {
                    leftMargin = activity.dp(18)
                    rightMargin = activity.dp(18)
                }
            }
        }
        val body = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        root.addView(activity.sectionLabel("굿즈"))
        root.addView(body)

        var quantities: Map<String, Int> = activity.goodsChecklistSnapshot[event.id].orEmpty()
        var memberFilterId: String? = null
        var expanded = false

        fun render() {
            body.removeAllViews()
            body.addView(summaryCard(event, quantities))
            if (HubEventGoodsPolicy.showsMemberFilter(event.goodsItems)) {
                body.addView(memberFilterRow(event.goodsItems, members, memberFilterId) { selected ->
                    memberFilterId = selected
                    render()
                })
            }
            val presentation = HubEventGoodsPolicy.present(event.goodsItems, memberFilterId, expanded)
            presentation.groups.forEach { group ->
                body.addView(groupTitle(group.label))
                body.addView(groupCard(event, group.items, members, quantities))
            }
            presentation.toggleLabel?.let { label ->
                body.addView(
                    activity.detailActionButton(label, primary = false) {
                        expanded = !expanded
                        render()
                    }.apply { contentDescription = if (expanded) "굿즈 목록 접기" else "굿즈 목록 전체 보기" },
                    LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, activity.dp(44)).apply {
                        bottomMargin = activity.dp(10)
                    },
                )
            }
        }

        val listener: (Map<String, Map<String, Int>>) -> Unit = { snapshot ->
            val next = snapshot[event.id].orEmpty()
            if (next != quantities) {
                quantities = next
                render()
            }
        }
        root.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) {
                activity.goodsChecklistListener = listener
                listener(activity.goodsChecklistSnapshot)
            }

            override fun onViewDetachedFromWindow(v: View) {
                if (activity.goodsChecklistListener === listener) activity.goodsChecklistListener = null
            }
        })
        render()
        return root
    }

    private fun summaryCard(event: HubEvent, quantities: Map<String, Int>): View {
        val summary = HubEventGoodsPolicy.summary(event.goodsItems, quantities)
        return activity.baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(10) }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(activity.dp(14), activity.dp(10), activity.dp(8), activity.dp(10))
                addView(TextView(context).apply {
                    text = summary.text
                    setTextColor(activity.color(R.color.hub_text))
                    textSize = 14f
                    typeface = Typeface.DEFAULT_BOLD
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                if (summary.selectedCount > 0) {
                    addView(TextView(context).apply {
                        text = "체크리스트 비우기"
                        gravity = Gravity.CENTER
                        textSize = 12f
                        setTextColor(activity.color(R.color.hub_primary))
                        setPadding(activity.dp(8), 0, activity.dp(8), 0)
                        isClickable = true
                        isFocusable = true
                        contentDescription = "이 행사의 구매 체크리스트 비우기"
                        setOnClickListener { activity.lifecycleScope.launch { activity.goodsChecklistStore.clear(event.id) } }
                    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, activity.dp(44)))
                }
            })
        }
    }

    private fun memberFilterRow(
        items: List<HubEventGoodsItem>,
        members: List<HubMember>,
        selectedId: String?,
        onSelected: (String?) -> Unit,
    ): View = HorizontalScrollView(activity).apply {
        isHorizontalScrollBarEnabled = false
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { bottomMargin = activity.dp(8) }
        addView(LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            val options = listOf<String?>(null) + HubEventGoodsPolicy.memberIds(items)
            options.forEach { memberId ->
                val label = memberId?.let { HubEventGoodsPolicy.memberFilterLabel(it, members) } ?: "전체"
                addView(
                    activity.filterSegmentView(memberId ?: "all", label, memberId == selectedId) { onSelected(memberId) }.apply {
                        contentDescription = "$label 굿즈 보기${if (memberId == selectedId) ", 선택됨" else ""}"
                    },
                    LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, activity.dp(40)).apply {
                        marginEnd = activity.dp(6)
                    },
                )
            }
        })
    }

    private fun groupTitle(label: String): View = TextView(activity).apply {
        text = label
        textSize = 12f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(activity.color(R.color.hub_text_muted))
        setPadding(activity.dp(2), activity.dp(6), activity.dp(2), activity.dp(6))
    }

    private fun groupCard(
        event: HubEvent,
        items: List<HubEventGoodsItem>,
        members: List<HubMember>,
        quantities: Map<String, Int>,
    ): View = activity.baseCard(HubCardStyle.COMPACT).apply {
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { bottomMargin = activity.dp(10) }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            items.forEachIndexed { index, item ->
                if (index > 0) addView(activity.divider())
                addView(itemRow(event, item, members, quantities[item.id]))
            }
        })
    }

    private fun itemRow(
        event: HubEvent,
        item: HubEventGoodsItem,
        members: List<HubMember>,
        quantity: Int?,
    ): View = LinearLayout(activity).apply {
        orientation = LinearLayout.HORIZONTAL
        setPadding(activity.dp(8), activity.dp(8), activity.dp(14), activity.dp(10))

        val checkSlot = LinearLayout(context).apply { gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL }
        if (HubEventGoodsPolicy.isCheckable(item)) {
            checkSlot.addView(MaterialCheckBox(context).apply {
                isChecked = quantity != null
                contentDescription = "${item.name} 구매 목록에 담기"
                setOnClickListener { activity.lifecycleScope.launch { activity.goodsChecklistStore.toggle(event.id, item) } }
            }, LinearLayout.LayoutParams(activity.dp(44), activity.dp(44)))
        }
        addView(checkSlot, LinearLayout.LayoutParams(activity.dp(44), LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = activity.dp(2)
        })

        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(context).apply {
                text = item.name
                setTextColor(activity.color(R.color.hub_text))
                textSize = 14f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(0, activity.dp(8), 0, 0)
            })
            HubEventGoodsPolicy.memberNames(item, members)?.let { names ->
                addView(secondaryText(names, topDp = 3))
            }
            addView(TextView(context).apply {
                text = HubEventGoodsPolicy.priceText(item)
                setTextColor(activity.color(R.color.hub_text))
                textSize = 13f
                setPadding(0, activity.dp(4), 0, 0)
            })
            HubEventGoodsPolicy.secondaryText(item)?.let { addView(secondaryText(it, topDp = 2)) }
            HubEventGoodsPolicy.chipLabels(item).takeIf { it.isNotEmpty() }?.let { addView(activity.pillRow(it)) }
            if (quantity != null) addView(quantityStepper(event, item, HubEventGoodsPolicy.clampQuantity(item, quantity)))
            HubEventGoodsPolicy.safePurchaseUrl(item)?.let { url ->
                addView(
                    activity.detailActionButton("구매 링크", primary = false) { activity.openExternalUrl(url) }.apply {
                        contentDescription = "${item.name} 구매 링크, 외부 링크 열기"
                    },
                    LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, activity.dp(44)).apply {
                        topMargin = activity.dp(8)
                    },
                )
            }
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    }

    private fun secondaryText(text: String, topDp: Int): TextView = TextView(activity).apply {
        this.text = text
        setTextColor(activity.color(R.color.hub_text_muted))
        textSize = 12f
        setPadding(0, activity.dp(topDp), 0, 0)
    }

    private fun quantityStepper(event: HubEvent, item: HubEventGoodsItem, quantity: Int): View {
        val max = HubEventGoodsPolicy.maxQuantity(item)
        fun stepButton(label: String, description: String, enabled: Boolean, target: Int) = TextView(activity).apply {
            text = label
            gravity = Gravity.CENTER
            textSize = 18f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(activity.color(R.color.hub_text))
            background = activity.rounded(activity.color(R.color.hub_surface), activity.dp(12), activity.color(R.color.hub_line))
            alpha = if (enabled) 1f else 0.4f
            contentDescription = description
            isEnabled = enabled
            if (enabled) {
                setOnClickListener {
                    activity.lifecycleScope.launch { activity.goodsChecklistStore.setQuantity(event.id, item, target) }
                }
            }
        }
        return LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, activity.dp(8), 0, 0)
            addView(stepButton("−", "수량 줄이기", quantity > 1, quantity - 1), LinearLayout.LayoutParams(activity.dp(44), activity.dp(44)))
            addView(TextView(context).apply {
                text = "${quantity}개"
                gravity = Gravity.CENTER
                textSize = 14f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(activity.color(R.color.hub_text))
                contentDescription = "수량 ${quantity}개"
            }, LinearLayout.LayoutParams(activity.dp(56), activity.dp(44)))
            addView(stepButton("+", "수량 늘리기", quantity < max, quantity + 1), LinearLayout.LayoutParams(activity.dp(44), activity.dp(44)))
        }
    }
}
