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
import dev.minepacu.stelliveeventnotifier.core.model.HubEventImage
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardStyle

/**
 * "공식 MD 리스트" card shown on top of the goods section: title, notice link, horizontal thumbnail strip and
 * a source caption. With [showEmptyItemsNotice] it also carries the "goods list not registered yet" note and the
 * purchase button (image-only notices). Thumbnails are loaded by Coil at thumbnail size only; nothing is saved.
 */
internal class HubEventGoodsGalleryView(private val activity: MainActivity) {

    fun build(
        event: HubEvent,
        images: List<HubEventImage>,
        showEmptyItemsNotice: Boolean,
    ): View? {
        if (images.isEmpty()) return null
        val noticeUrl = HubEventGoodsGalleryPolicy.noticeUrl(event)
        val viewer = HubEventGoodsGalleryViewer(activity, event, images)
        return activity.baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(10) }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(activity.dp(14), activity.dp(12), activity.dp(14), activity.dp(12))
                addView(headerRow(images.size, noticeUrl))
                addView(thumbnailStrip(images, viewer))
                addView(TextView(context).apply {
                    text = HubEventGoodsGalleryPolicy.stripCaption(images)
                    textSize = 12f
                    setTextColor(activity.color(R.color.hub_text_muted))
                    setPadding(0, activity.dp(6), 0, 0)
                })
                if (showEmptyItemsNotice) addView(emptyItemsNotice(event))
            })
        }
    }

    private fun headerRow(count: Int, noticeUrl: String?): View = LinearLayout(activity).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        addView(TextView(context).apply {
            text = HubEventGoodsGalleryPolicy.SECTION_TITLE
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(activity.color(R.color.hub_text))
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        addView(TextView(context).apply {
            text = HubEventGoodsGalleryPolicy.countLabel(count)
            textSize = 12f
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            setTextColor(activity.color(if (noticeUrl != null) R.color.hub_primary else R.color.hub_text_muted))
            if (noticeUrl != null) {
                isClickable = true
                isFocusable = true
                contentDescription = "공식 공지 열기, 외부 링크"
                setOnClickListener { activity.openExternalUrl(noticeUrl) }
            }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, activity.dp(44)))
    }

    private fun thumbnailStrip(images: List<HubEventImage>, viewer: HubEventGoodsGalleryViewer): View =
        HorizontalScrollView(activity).apply {
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            addView(LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                images.forEachIndexed { index, image ->
                    addView(
                        thumbnail(image, index, images.size) { viewer.show(index) },
                        LinearLayout.LayoutParams(activity.dp(THUMB_WIDTH_DP), activity.dp(THUMB_HEIGHT_DP)).apply {
                            marginEnd = activity.dp(8)
                        },
                    )
                }
            })
        }

    private fun thumbnail(image: HubEventImage, index: Int, total: Int, onClick: () -> Unit): View {
        val label = HubEventGoodsGalleryPolicy.thumbnailLabel(image, index)
        return FrameLayout(activity).apply {
            background = activity.rounded(
                fill = activity.color(R.color.hub_surface),
                radius = activity.dp(10),
                stroke = activity.color(R.color.hub_line),
            )
            clipToOutline = true
            isClickable = true
            isFocusable = true
            contentDescription = HubEventGoodsGalleryPolicy.thumbnailContentDescription(label, index, total)
            setOnClickListener { onClick() }
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
    }
}
