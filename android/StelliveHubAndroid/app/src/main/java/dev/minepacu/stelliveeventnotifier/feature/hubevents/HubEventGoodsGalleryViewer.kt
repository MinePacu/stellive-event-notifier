package dev.minepacu.stelliveeventnotifier.feature.hubevents

import android.app.Dialog
import android.content.Context
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.util.AttributeSet
import android.view.Gravity
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.GestureDetector
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.widget.AppCompatImageView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.PagerSnapHelper
import androidx.recyclerview.widget.RecyclerView
import coil.dispose
import coil.load
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventImage

/**
 * Full-screen viewer for the official MD list gallery: dark background, close and notice buttons, a
 * "{altText} · n / N" title, horizontal paging, pinch-zoom per page, page dots and a source caption.
 * A plain [Dialog] is used because the app is View-based and the viewer owns no state worth restoring.
 * Images are streamed by Coil only (memory + its normal HTTP cache); nothing is saved to storage or gallery.
 */
internal class HubEventGoodsGalleryViewer(
    private val activity: MainActivity,
    private val event: HubEvent,
    private val images: List<HubEventImage>,
) {
    private var dialog: Dialog? = null

    fun show(startIndex: Int) {
        if (images.isEmpty() || activity.isFinishing || dialog?.isShowing == true) return
        val start = startIndex.coerceIn(0, images.lastIndex)
        val shown = Dialog(activity, android.R.style.Theme_Black_NoTitleBar)
        dialog = shown
        shown.setContentView(buildContent(shown, start))
        shown.window?.apply {
            setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT)
            WindowCompat.setDecorFitsSystemWindows(this, false)
        }
        val observer = object : DefaultLifecycleObserver {
            override fun onDestroy(owner: LifecycleOwner) {
                shown.dismiss()
            }
        }
        activity.lifecycle.addObserver(observer)
        shown.setOnDismissListener {
            activity.lifecycle.removeObserver(observer)
            dialog = null
        }
        shown.show()
    }

    private fun buildContent(shown: Dialog, start: Int): View {
        val background = activity.color(R.color.hub_surface_dark)
        val onDark = Color.WHITE
        val mutedOnDark = Color.argb(179, 255, 255, 255)
        var current = start

        val title = TextView(activity).apply {
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setTextColor(onDark)
            maxLines = 1
        }
        val caption = TextView(activity).apply {
            textSize = 12f
            gravity = Gravity.CENTER
            setTextColor(mutedOnDark)
        }
        val dots = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        val dotViews = images.indices.map {
            View(activity).also { dot ->
                dots.addView(dot, LinearLayout.LayoutParams(activity.dp(6), activity.dp(6)).apply {
                    marginStart = activity.dp(3)
                    marginEnd = activity.dp(3)
                })
            }
        }
        val noticeButton = iconButton("↗", "공식 공지 열기, 외부 링크", onDark) {
            activity.openExternalUrl(HubEventGoodsGalleryPolicy.noticeUrl(event, images[current]))
        }

        fun bindPage(index: Int) {
            current = index
            val image = images[index]
            title.text = HubEventGoodsGalleryPolicy.viewerTitle(image, index, images.size)
            caption.text = HubEventGoodsGalleryPolicy.viewerSourceCaption(image)
            dotViews.forEachIndexed { i, dot ->
                dot.background = activity.rounded(if (i == index) onDark else Color.argb(90, 255, 255, 255), activity.dp(3))
            }
            noticeButton.visibility =
                if (HubEventGoodsGalleryPolicy.noticeUrl(event, image) != null) View.VISIBLE else View.INVISIBLE
        }

        val displayMetrics = activity.resources.displayMetrics
        val adapter = PageAdapter(
            images = images,
            maxWidthPx = displayMetrics.widthPixels * 2,
            maxHeightPx = displayMetrics.heightPixels * 2,
            textColor = mutedOnDark,
        )
        val layoutManager = LinearLayoutManager(activity, LinearLayoutManager.HORIZONTAL, false)
        val pager = RecyclerView(activity).apply {
            this.layoutManager = layoutManager
            this.adapter = adapter
            overScrollMode = View.OVER_SCROLL_NEVER
            setHasFixedSize(true)
            layoutManager.scrollToPosition(start)
        }
        val snapHelper = PagerSnapHelper().also { it.attachToRecyclerView(pager) }
        pager.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrollStateChanged(recyclerView: RecyclerView, newState: Int) {
                if (newState != RecyclerView.SCROLL_STATE_IDLE) return
                val view = snapHelper.findSnapView(layoutManager) ?: return
                val position = layoutManager.getPosition(view)
                if (position in images.indices && position != current) bindPage(position)
            }
        })

        val topBar = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(iconButton("✕", "닫기", onDark) { shown.dismiss() }, LinearLayout.LayoutParams(activity.dp(48), activity.dp(48)))
            addView(title, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(noticeButton, LinearLayout.LayoutParams(activity.dp(48), activity.dp(48)))
        }
        val bottomBar = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(activity.dp(16), activity.dp(10), activity.dp(16), activity.dp(10))
            addView(dots)
            addView(caption, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = activity.dp(8) })
        }
        bindPage(start)

        return LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(background)
            addView(topBar, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, activity.dp(48)))
            addView(pager, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
            addView(bottomBar, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ))
            ViewCompat.setOnApplyWindowInsetsListener(this) { view, insets ->
                val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                WindowInsetsCompat.CONSUMED
            }
        }
    }

    private fun iconButton(label: String, description: String, color: Int, onClick: () -> Unit): TextView =
        TextView(activity).apply {
            text = label
            textSize = 20f
            gravity = Gravity.CENTER
            setTextColor(color)
            contentDescription = description
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
        }

    /** One page per image. The full image is requested only when the page is bound (visible or about to be). */
    private class PageAdapter(
        private val images: List<HubEventImage>,
        private val maxWidthPx: Int,
        private val maxHeightPx: Int,
        private val textColor: Int,
    ) : RecyclerView.Adapter<PageAdapter.Holder>() {

        class Holder(val root: FrameLayout, val image: ZoomImageView, val status: TextView) : RecyclerView.ViewHolder(root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
            val context = parent.context
            val image = ZoomImageView(context)
            val status = TextView(context).apply {
                textSize = 13f
                gravity = Gravity.CENTER
                setTextColor(textColor)
            }
            val root = FrameLayout(context).apply {
                layoutParams = RecyclerView.LayoutParams(
                    RecyclerView.LayoutParams.MATCH_PARENT,
                    RecyclerView.LayoutParams.MATCH_PARENT,
                )
                addView(status, FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.CENTER,
                ))
                addView(image, FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                ))
            }
            return Holder(root, image, status)
        }

        override fun getItemCount(): Int = images.size

        override fun onBindViewHolder(holder: Holder, position: Int) {
            holder.status.text = "불러오는 중…"
            holder.image.contentDescription = images[position].altText ?: "공식 MD 리스트 이미지 ${position + 1}"
            // Bounded decode size: at most 2x the screen in each dimension, so tall PNGs are downsampled
            // instead of decoded at full resolution, while pinch-zoom still has extra detail.
            holder.image.load(images[position].url) {
                size(maxWidthPx, maxHeightPx)
                listener(
                    onSuccess = { _, _ -> holder.status.visibility = View.GONE },
                    onError = { _, _ ->
                        holder.status.visibility = View.VISIBLE
                        holder.status.text = "이미지를 불러오지 못했어요.\n오른쪽 위 버튼으로 공식 공지를 열어 확인하세요."
                    },
                )
            }
        }

        override fun onViewRecycled(holder: Holder) {
            holder.image.dispose()
            holder.image.setImageDrawable(null)
            holder.status.visibility = View.VISIBLE
        }
    }
}

/**
 * ImageView with pinch-zoom (1x to 4x), pan while zoomed and double-tap toggle. While zoomed it stops the parent
 * pager from intercepting touches, except when the pan is already at the horizontal edge so paging still works.
 */
internal class ZoomImageView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : AppCompatImageView(context, attrs) {

    private val matrixValues = FloatArray(9)
    private val drawMatrix = Matrix()
    private var fitScale = 1f
    private val rect = RectF()

    private val scaleDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            zoomBy(detector.scaleFactor, detector.focusX, detector.focusY)
            return true
        }
    })

    private val gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(e: MotionEvent): Boolean = true

        override fun onScroll(e1: MotionEvent?, e2: MotionEvent, distanceX: Float, distanceY: Float): Boolean {
            if (!isZoomed() || scaleDetector.isInProgress) return false
            val atEdge = (distanceX < 0 && rect.left >= -EDGE_SLOP) || (distanceX > 0 && rect.right <= width + EDGE_SLOP)
            parent?.requestDisallowInterceptTouchEvent(!atEdge)
            drawMatrix.postTranslate(-distanceX, -distanceY)
            applyMatrix()
            return true
        }

        override fun onDoubleTap(e: MotionEvent): Boolean {
            val target = if (isZoomed()) fitScale / currentScale() else DOUBLE_TAP_ZOOM
            zoomBy(target, e.x, e.y)
            parent?.requestDisallowInterceptTouchEvent(isZoomed())
            return true
        }
    })

    init {
        scaleType = ScaleType.MATRIX
    }

    override fun setImageDrawable(drawable: Drawable?) {
        super.setImageDrawable(drawable)
        resetToFit()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        resetToFit()
    }

    @Suppress("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (drawable == null) return false
        scaleDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN ->
                parent?.requestDisallowInterceptTouchEvent(isZoomed() || event.pointerCount > 1)
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> parent?.requestDisallowInterceptTouchEvent(false)
        }
        return true
    }

    private fun resetToFit() {
        val d = drawable
        if (d == null || width == 0 || height == 0 || d.intrinsicWidth <= 0 || d.intrinsicHeight <= 0) {
            imageMatrix = Matrix()
            fitScale = 1f
            return
        }
        val dw = d.intrinsicWidth.toFloat()
        val dh = d.intrinsicHeight.toFloat()
        fitScale = minOf(width / dw, height / dh)
        drawMatrix.reset()
        drawMatrix.postScale(fitScale, fitScale)
        drawMatrix.postTranslate((width - dw * fitScale) / 2f, (height - dh * fitScale) / 2f)
        applyMatrix()
    }

    private fun currentScale(): Float {
        drawMatrix.getValues(matrixValues)
        return matrixValues[Matrix.MSCALE_X]
    }

    private fun isZoomed(): Boolean = currentScale() > fitScale * 1.02f

    private fun zoomBy(factor: Float, focusX: Float, focusY: Float) {
        val current = currentScale()
        val target = (current * factor).coerceIn(fitScale, fitScale * MAX_ZOOM)
        val effective = target / current
        drawMatrix.postScale(effective, effective, focusX, focusY)
        applyMatrix()
    }

    private fun applyMatrix() {
        val d = drawable ?: return
        rect.set(0f, 0f, d.intrinsicWidth.toFloat(), d.intrinsicHeight.toFloat())
        drawMatrix.mapRect(rect)
        val dx = when {
            rect.width() <= width -> (width - rect.width()) / 2f - rect.left
            rect.left > 0f -> -rect.left
            rect.right < width -> width - rect.right
            else -> 0f
        }
        val dy = when {
            rect.height() <= height -> (height - rect.height()) / 2f - rect.top
            rect.top > 0f -> -rect.top
            rect.bottom < height -> height - rect.bottom
            else -> 0f
        }
        drawMatrix.postTranslate(dx, dy)
        rect.offset(dx, dy)
        imageMatrix = drawMatrix
    }

    private companion object {
        const val MAX_ZOOM = 4f
        const val DOUBLE_TAP_ZOOM = 2.5f
        const val EDGE_SLOP = 1f
    }
}
