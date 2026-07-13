package dev.minepacu.stelliveeventnotifier.feature.songs

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardFactory
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardStyle

class SongDetailBottomSheet(
    private val context: Context,
    private val isFavorite: (SongCatalogItem) -> Boolean,
    private val onOpen: (String) -> Unit,
    private val onShare: (String) -> Unit,
    private val onCopy: (String) -> Unit,
    private val onToggleFavorite: (SongCatalogItem) -> Unit,
    private val onMemberFilter: (String) -> Unit,
    private val onAllMembersFilter: (SongCatalogItem) -> Unit,
    private val onSameTypeFilter: (SongCatalogItem) -> Unit,
) {
    private val dialog = BottomSheetDialog(context)

    fun show(song: SongCatalogItem) {
        render(song)
        dialog.show()
    }

    fun update(song: SongCatalogItem) {
        if (dialog.isShowing) render(song)
    }

    private fun render(song: SongCatalogItem) {
        val body = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(32))
            setBackgroundColor(color(R.color.hub_surface))
        }
        body.addView(TextView(context).apply {
            text = "곡 상세"
            textSize = 13f
            setTextColor(color(R.color.hub_text_muted))
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, 0, 0, dp(6))
        })
        body.addView(TextView(context).apply {
            text = MainUiPolicy.songTitleDisplayText(song)
            textSize = 22f
            setTextColor(color(R.color.hub_text))
            setTypeface(typeface, Typeface.BOLD)
            includeFontPadding = false
            setPadding(0, 0, 0, dp(16))
            contentDescription = "곡 상세, " + text
        })
        body.addView(infoCard(song))

        val url = SongLinkPolicy.videoUrl(song)
        body.addView(sectionTitle("동작"))
        body.addView(primaryActionButton("YouTube 열기", url, onOpen))
        body.addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(secondaryActionButton("링크 공유", url, onShare), weightedButtonParams(endMargin = dp(5)))
            addView(secondaryActionButton("링크 복사", url, onCopy), weightedButtonParams(startMargin = dp(5)))
        })
        body.addView(secondaryActionButton(
            label = if (isFavorite(song)) "즐겨찾기 해제" else "즐겨찾기 추가",
            url = "favorite",
            action = {},
        ).apply {
            var favoriteState = isFavorite(song)
            updateFavoriteButton(this, favoriteState)
            setOnClickListener {
                onToggleFavorite(song)
                favoriteState = !favoriteState
                updateFavoriteButton(this, favoriteState)
            }
        })

        val relatedActions = mutableListOf<SheetAction>()
        song.members.forEach { member ->
            relatedActions += SheetAction(member.nameKo + " 참여곡 보기") {
                onMemberFilter(member.id)
                dialog.dismiss()
            }
        }
        if (song.members.size > 1) {
            relatedActions += SheetAction("참여 멤버 모두 포함") {
                onAllMembersFilter(song)
                dialog.dismiss()
            }
        }
        relatedActions += SheetAction("같은 종류 보기") {
            onSameTypeFilter(song)
            dialog.dismiss()
        }
        body.addView(sectionTitle("관련 노래"))
        body.addView(actionListCard(relatedActions))

        val playlistActions = song.sourcePlaylists.mapNotNull { playlist ->
            SongLinkPolicy.playlistUrl(playlist.youtubePlaylistId)?.let { playlistUrl ->
                SheetAction(
                    label = playlist.title + if (playlist.isPrimary) " · 기본" else "",
                    contentDescription = playlist.title + " 플레이리스트 열기",
                ) { onOpen(playlistUrl) }
            }
        }
        if (playlistActions.isNotEmpty()) {
            body.addView(sectionTitle("원본 플레이리스트"))
            body.addView(actionListCard(playlistActions))
        }

        dialog.setContentView(ScrollView(context).apply {
            setBackgroundColor(color(R.color.hub_surface))
            isFillViewport = true
            addView(body, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        })
    }

    private fun infoCard(song: SongCatalogItem): MaterialCardView =
        HubCardFactory(context).create(HubCardStyle.INTERACTIVE).apply {
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(10), dp(16), dp(10))
                SongDetailPolicy.rows(song).forEachIndexed { index, row ->
                    if (index > 0) addView(divider())
                    addView(detailRow(row.label, row.value))
                }
            })
        }

    private fun detailRow(label: String, value: String) = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.TOP
        minimumHeight = dp(48)
        setPadding(0, dp(12), 0, dp(12))
        addView(TextView(context).apply {
            text = label
            textSize = 13f
            setTextColor(color(R.color.hub_text_muted))
            setTypeface(typeface, Typeface.BOLD)
            includeFontPadding = false
        }, LinearLayout.LayoutParams(dp(112), ViewGroup.LayoutParams.WRAP_CONTENT))
        addView(TextView(context).apply {
            text = value
            textSize = 14f
            setTextColor(color(R.color.hub_text))
            includeFontPadding = false
        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    }

    private fun sectionTitle(title: String) = TextView(context).apply {
        text = title
        textSize = 14f
        setTextColor(color(R.color.hub_text_muted))
        setTypeface(typeface, Typeface.BOLD)
        setPadding(dp(2), dp(22), 0, dp(9))
        includeFontPadding = false
    }

    private fun primaryActionButton(label: String, url: String?, action: (String) -> Unit) =
        materialButton(label, primary = true).apply {
            isEnabled = url != null
            contentDescription = if (url == null) label + ", " + SongLinkPolicy.unavailableReason else label
            setOnClickListener { url?.let(action) }
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)).apply {
                bottomMargin = dp(10)
            }
        }

    private fun secondaryActionButton(label: String, url: String?, action: (String) -> Unit) =
        materialButton(label, primary = false).apply {
            isEnabled = url != null
            contentDescription = if (url == null) label + ", " + SongLinkPolicy.unavailableReason else label
            setOnClickListener { url?.let(action) }
        }

    private fun materialButton(label: String, primary: Boolean) = MaterialButton(context).apply {
        text = label
        textSize = 14f
        isAllCaps = false
        minHeight = dp(48)
        cornerRadius = dp(14)
        insetTop = 0
        insetBottom = 0
        setTextColor(color(if (primary) R.color.hub_on_primary else R.color.hub_text))
        backgroundTintList = ColorStateList.valueOf(color(if (primary) R.color.hub_primary else R.color.hub_card_surface_compact))
        strokeWidth = if (primary) 0 else dp(1)
        strokeColor = ColorStateList.valueOf(color(R.color.hub_line))
    }

    private fun weightedButtonParams(startMargin: Int = 0, endMargin: Int = 0) =
        LinearLayout.LayoutParams(0, dp(50), 1f).apply {
            marginStart = startMargin
            marginEnd = endMargin
            bottomMargin = dp(10)
        }

    private fun updateFavoriteButton(button: MaterialButton, favorite: Boolean) {
        button.text = if (favorite) "즐겨찾기 해제" else "즐겨찾기 추가"
        button.contentDescription = button.text
        button.layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50)).apply {
            bottomMargin = dp(2)
        }
    }

    private fun actionListCard(actions: List<SheetAction>): MaterialCardView =
        HubCardFactory(context).create(HubCardStyle.INTERACTIVE).apply {
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                actions.forEachIndexed { index, action ->
                    if (index > 0) addView(divider())
                    addView(LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.CENTER_VERTICAL
                        minimumHeight = dp(54)
                        isClickable = true
                        isFocusable = true
                        background = selectableItemBackground()
                        contentDescription = action.contentDescription
                        setPadding(dp(16), 0, dp(14), 0)
                        setOnClickListener { action.onClick() }
                        addView(TextView(context).apply {
                            text = action.label
                            textSize = 14f
                            setTextColor(color(R.color.hub_text))
                        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
                        addView(TextView(context).apply {
                            text = "›"
                            textSize = 22f
                            setTextColor(color(R.color.hub_text_subtle))
                            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                        })
                    })
                }
            })
        }

    private fun divider() = View(context).apply {
        setBackgroundColor(color(R.color.hub_line))
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)).apply {
            marginStart = dp(16)
        }
    }

    private fun color(id: Int): Int = ContextCompat.getColor(context, id)

    private fun selectableItemBackground(): Drawable? {
        val attributes = context.obtainStyledAttributes(intArrayOf(android.R.attr.selectableItemBackground))
        return attributes.getDrawable(0).also { attributes.recycle() }
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()

    private data class SheetAction(
        val label: String,
        val contentDescription: String = label,
        val onClick: () -> Unit,
    )
}
