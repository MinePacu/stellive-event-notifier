package dev.minepacu.stelliveeventnotifier.feature.hubevents

import android.graphics.Matrix
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import coil.load
import coil.size.Scale
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventGoodsListImage
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardStyle

/**
 * "공식 MD 리스트" card shown on top of the goods section. Expanded: one row (single layout) or an MD row and a
 * bonus row (split layout), each with a count and a horizontal thumbnail strip, then one source caption; the notice
 * link appears once, on the first row. With [showEmptyItemsNotice] it also carries the "goods list not registered
 * yet" note and the purchase button (image-only notices). When the event has goods items the card can collapse into
 * one compact row; the starting state follows the local "expanded by default" setting and expansion is never
 * persisted. Thumbnails are loaded by Coil at thumbnail size only; nothing is saved.
 */
internal class HubEventGoodsGalleryView(private val activity: MainActivity) {

    fun build(
        event: HubEvent,
        images: List<HubEventGoodsListImage>,
        showEmptyItemsNotice: Boolean,
    ): View? {
        if (images.isEmpty()) return null
        val hasGoodsItems = event.goodsItems.isNotEmpty()
        val rows = HubEventGoodsGalleryPolicy.rows(images, event.goodsListLayout)
        val noticeUrl = HubEventGoodsGalleryPolicy.noticeUrl(event)
        val viewers = rows.associateWith { HubEventGoodsGalleryViewer(activity, event, HubEventGoodsGalleryPolicy.viewerImages(it)) }
        // Per-view state only: the setting decides the starting point, expansion itself is never persisted.
        var expanded = HubEventGoodsGalleryPolicy.initiallyExpanded(
            hasGoodsItems = hasGoodsItems,
            expandedByDefault = activity.goodsGalleryPreferenceStore.readExpandedByDefault(),
        )
        return activity.baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(10) }
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(activity.dp(14), activity.dp(12), activity.dp(14), activity.dp(12))
            }
            addView(content)
            lateinit var render: () -> Unit
            render = {
                content.removeAllViews()
                if (hasGoodsItems && !expanded) {
                    content.addView(collapsedRow(images, event) {
                        expanded = true
                        render()
                    })
                } else {
                    rows.forEachIndexed { rowIndex, row ->
                        content.addView(
                            rowView(row, viewers.getValue(row), if (rowIndex == 0) noticeUrl else null),
                            LinearLayout.LayoutParams(
                                LinearLayout.LayoutParams.MATCH_PARENT,
                                LinearLayout.LayoutParams.WRAP_CONTENT,
                            ).apply { if (rowIndex > 0) topMargin = activity.dp(8) },
                        )
                    }
                    content.addView(TextView(context).apply {
                        text = HubEventGoodsGalleryPolicy.stripCaption(images)
                        textSize = 12f
                        setTextColor(activity.color(R.color.hub_text_muted))
                        setPadding(0, activity.dp(6), 0, 0)
                    })
                    if (showEmptyItemsNotice) content.addView(emptyItemsNotice(event))
                    if (hasGoodsItems) {
                        content.addView(
                            activity.detailActionButton(HubEventGoodsGalleryPolicy.COLLAPSE_CONTROL_LABEL, primary = false) {
                                expanded = false
                                render()
                            }.apply { contentDescription = "공식 MD 리스트 이미지 접기" },
                            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, activity.dp(44)).apply {
                                topMargin = activity.dp(10)
                            },
                        )
                    }
                }
            }
            render()
        }
    }

    private fun rowView(
        row: HubEventGoodsGalleryPolicy.Row,
        viewer: HubEventGoodsGalleryViewer,
        noticeUrl: String?,
    ): View = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        addView(headerRow(row.title, row.images.size, noticeUrl, includesNoticeLink = noticeUrl != null))
        addView(thumbnailStrip(row, viewer))
    }

    /** Compact row: up to three overlapping mini thumbnails, title, subtitle and a trailing "보기 ⌄". */
    private fun collapsedRow(images: List<HubEventGoodsListImage>, event: HubEvent, onExpand: () -> Unit): View {
        val subtitle = HubEventGoodsGalleryPolicy.collapsedSubtitle(images, event.goodsListLayout)
        return LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = activity.dp(48)
            isClickable = true
            isFocusable = true
            contentDescription = "${HubEventGoodsGalleryPolicy.COLLAPSED_TITLE}, $subtitle, 펼쳐서 보기"
            setOnClickListener { onExpand() }
            val shown = images.take(HubEventGoodsGalleryPolicy.COLLAPSED_THUMBNAIL_COUNT)
            val step = MINI_STEP_DP
            addView(FrameLayout(context).apply {
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
                // Added in reverse so the first image is drawn on top.
                shown.indices.reversed().forEach { index ->
                    addView(
                        thumbnail(shown[index], label = "", contentDescription = null, widthDp = MINI_WIDTH_DP, heightDp = MINI_HEIGHT_DP, radiusDp = 6, onClick = null),
                        FrameLayout.LayoutParams(activity.dp(MINI_WIDTH_DP), activity.dp(MINI_HEIGHT_DP)).apply {
                            marginStart = activity.dp(index * step)
                        },
                    )
                }
            }, LinearLayout.LayoutParams(
                activity.dp(MINI_WIDTH_DP + (shown.size - 1).coerceAtLeast(0) * step),
                activity.dp(MINI_HEIGHT_DP),
            ).apply { marginEnd = activity.dp(12) })
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(context).apply {
                    text = HubEventGoodsGalleryPolicy.COLLAPSED_TITLE
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(activity.color(R.color.hub_text))
                })
                addView(TextView(context).apply {
                    text = subtitle
                    textSize = 12f
                    setTextColor(activity.color(R.color.hub_text_muted))
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(TextView(context).apply {
                text = HubEventGoodsGalleryPolicy.EXPAND_CONTROL_LABEL
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(activity.color(R.color.hub_primary))
                setPadding(activity.dp(8), 0, 0, 0)
            })
        }
    }

    private fun headerRow(title: String, count: Int, noticeUrl: String?, includesNoticeLink: Boolean): View =
        LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(TextView(context).apply {
                text = title
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(activity.color(R.color.hub_text))
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(TextView(context).apply {
                text = HubEventGoodsGalleryPolicy.countLabel(count, includesNoticeLink = includesNoticeLink && noticeUrl != null)
                textSize = 12f
                gravity = Gravity.CENTER_VERTICAL or Gravity.END
                setTextColor(activity.color(if (noticeUrl != null) R.color.hub_primary else R.color.hub_text_muted))
                if (noticeUrl != null) {
                    isClickable = true
                    isFocusable = true
                    contentDescription = "${count}장, 공식 공지 열기, 외부 링크"
                    setOnClickListener { activity.openExternalUrl(noticeUrl) }
                }
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, activity.dp(44)))
        }

    private fun thumbnailStrip(row: HubEventGoodsGalleryPolicy.Row, viewer: HubEventGoodsGalleryViewer): View =
        HorizontalScrollView(activity).apply {
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            addView(LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                row.images.forEachIndexed { index, entry ->
                    val label = HubEventGoodsGalleryPolicy.thumbnailLabel(entry, index)
                    addView(
                        thumbnail(
                            entry,
                            label = label,
                            contentDescription = HubEventGoodsGalleryPolicy.thumbnailContentDescription(row.title, label, index, row.images.size),
                            widthDp = THUMB_WIDTH_DP,
                            heightDp = THUMB_HEIGHT_DP,
                            radiusDp = 10,
                            onClick = { viewer.show(index) },
                        ),
                        LinearLayout.LayoutParams(activity.dp(THUMB_WIDTH_DP), activity.dp(THUMB_HEIGHT_DP)).apply {
                            marginEnd = activity.dp(8)
                        },
                    )
                }
            })
        }

    /** A rounded fixed-size tile; [onClick] null makes it a decorative (non-interactive) mini thumbnail. */
    private fun thumbnail(
        entry: HubEventGoodsListImage,
        label: String,
        contentDescription: String?,
        widthDp: Int,
        heightDp: Int,
        radiusDp: Int,
        onClick: (() -> Unit)?,
    ): View {
        val image = entry.image
        return FrameLayout(activity).apply {
            background = activity.rounded(
                fill = activity.color(R.color.hub_surface),
                radius = activity.dp(radiusDp),
                stroke = activity.color(R.color.hub_line),
            )
            clipToOutline = true
            if (onClick != null) {
                isClickable = true
                isFocusable = true
                this.contentDescription = contentDescription
                setOnClickListener { onClick() }
            }
            val labelView = TextView(context).apply {
                text = label
                textSize = 11f
                maxLines = 2
                gravity = Gravity.CENTER
                setTextColor(activity.color(R.color.hub_text_muted))
                setPadding(activity.dp(4), 0, activity.dp(4), activity.dp(6))
            }
            addView(labelView, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM,
            ))
            val imageView = ImageView(context).apply {
                // MATRIX + top alignment: official list images are tall pages, so show the top of the page.
                scaleType = ImageView.ScaleType.MATRIX
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            addView(imageView, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            ))
            // Coil resolves the target size from the (fixed) ImageView bounds, so the bitmap is decoded at
            // thumbnail size rather than full resolution. Error leaves the placeholder label visible.
            imageView.load(image.url) {
                scale(Scale.FILL)
                listener(
                    onSuccess = { _, _ ->
                        imageView.drawable?.let { applyTopCrop(imageView, it) }
                        labelView.visibility = View.GONE
                    },
                    onError = { _, _ -> labelView.alpha = 0.6f },
                )
            }
        }
    }

    private fun applyTopCrop(view: ImageView, drawable: Drawable) {
        val vw = view.width.toFloat()
        val vh = view.height.toFloat()
        val dw = drawable.intrinsicWidth.toFloat()
        val dh = drawable.intrinsicHeight.toFloat()
        if (vw <= 0f || vh <= 0f || dw <= 0f || dh <= 0f) {
            view.scaleType = ImageView.ScaleType.CENTER_CROP
            return
        }
        val scale = maxOf(vw / dw, vh / dh)
        view.imageMatrix = Matrix().apply {
            setScale(scale, scale)
            postTranslate((vw - dw * scale) / 2f, 0f)
        }
    }

    private fun emptyItemsNotice(event: HubEvent): View = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        addView(activity.divider().apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                activity.dp(1),
            ).apply { topMargin = activity.dp(12) }
        })
        addView(TextView(context).apply {
            text = HubEventGoodsGalleryPolicy.EMPTY_ITEMS_NOTICE
            textSize = 13f
            setTextColor(activity.color(R.color.hub_text_muted))
            setLineSpacing(0f, 1.2f)
            setPadding(0, activity.dp(12), 0, 0)
        })
        HubEventGoodsGalleryPolicy.safePurchaseUrl(event)?.let { url ->
            addView(
                activity.detailActionButton(HubEventGoodsGalleryPolicy.PURCHASE_BUTTON_LABEL, primary = false) {
                    activity.openExternalUrl(url)
                }.apply {
                    contentDescription = "구매 페이지, 외부 링크 열기"
                    setPadding(activity.dp(18), 0, activity.dp(18), 0)
                },
                LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, activity.dp(44)).apply {
                    topMargin = activity.dp(12)
                },
            )
        }
    }

    private companion object {
        const val THUMB_WIDTH_DP = 62
        const val THUMB_HEIGHT_DP = 84
        const val MINI_WIDTH_DP = 30
        const val MINI_HEIGHT_DP = 40
        const val MINI_STEP_DP = 14
    }
}
