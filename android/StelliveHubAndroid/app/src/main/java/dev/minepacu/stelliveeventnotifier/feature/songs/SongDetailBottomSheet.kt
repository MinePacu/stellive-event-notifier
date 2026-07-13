package dev.minepacu.stelliveeventnotifier.feature.songs

import android.content.Context
import android.graphics.Typeface
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.google.android.material.bottomsheet.BottomSheetDialog
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy

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
        val spacing = dp(16)
        val body = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(spacing, spacing, spacing, dp(28))
        }
        body.addView(TextView(context).apply {
            text = MainUiPolicy.songTitleDisplayText(song)
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, 0, 0, dp(12))
            contentDescription = "곡 상세, $text"
        })
        SongDetailPolicy.rows(song).forEach { row ->
            body.addView(detailRow(row.label, row.value))
        }

        val url = SongLinkPolicy.videoUrl(song)
        body.addView(sectionTitle("동작"))
        body.addView(actionButton("YouTube 열기", url, onOpen))
        body.addView(actionButton("링크 공유", url, onShare))
        body.addView(actionButton("링크 복사", url, onCopy))
        body.addView(Button(context).apply {
            val favorite = isFavorite(song)
            text = if (favorite) "즐겨찾기 해제" else "즐겨찾기 추가"
            minHeight = dp(48)
            contentDescription = text
            setOnClickListener {
                onToggleFavorite(song)
                text = if (favorite) "즐겨찾기 추가" else "즐겨찾기 해제"
            }
        })

        if (song.members.isNotEmpty()) {
            body.addView(sectionTitle("관련 노래"))
            song.members.forEach { member ->
                body.addView(Button(context).apply {
                    text = "${member.nameKo} 참여곡 보기"
                    minHeight = dp(48)
                    setOnClickListener { onMemberFilter(member.id); dialog.dismiss() }
                })
            }
            if (song.members.size > 1) {
                body.addView(Button(context).apply {
                    text = "참여 멤버 모두 포함"
                    minHeight = dp(48)
                    setOnClickListener { onAllMembersFilter(song); dialog.dismiss() }
                })
            }
        }
        body.addView(Button(context).apply {
            text = "같은 종류 보기"
            minHeight = dp(48)
            setOnClickListener { onSameTypeFilter(song); dialog.dismiss() }
        })

        if (song.sourcePlaylists.isNotEmpty()) {
            body.addView(sectionTitle("원본 플레이리스트"))
            song.sourcePlaylists.forEach { playlist ->
                SongLinkPolicy.playlistUrl(playlist.youtubePlaylistId)?.let { playlistUrl ->
                    body.addView(Button(context).apply {
                        text = playlist.title + if (playlist.isPrimary) " · 기본" else ""
                        minHeight = dp(48)
                        contentDescription = "${playlist.title} 플레이리스트 열기"
                        setOnClickListener { onOpen(playlistUrl) }
                    })
                }
            }
        }

        dialog.setContentView(ScrollView(context).apply {
            addView(body, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        })
    }

    private fun detailRow(label: String, value: String) = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        setPadding(0, dp(6), 0, dp(6))
        addView(TextView(context).apply {
            text = label
            setTypeface(typeface, Typeface.BOLD)
        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 0.36f))
        addView(TextView(context).apply { text = value }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 0.64f))
    }

    private fun sectionTitle(title: String) = TextView(context).apply {
        text = title
        textSize = 16f
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(18), 0, dp(6))
    }

    private fun actionButton(label: String, url: String?, action: (String) -> Unit) = Button(context).apply {
        text = label
        minHeight = dp(48)
        isEnabled = url != null
        contentDescription = if (url == null) "$label, ${SongLinkPolicy.unavailableReason}" else label
        setOnClickListener { url?.let(action) }
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
}
