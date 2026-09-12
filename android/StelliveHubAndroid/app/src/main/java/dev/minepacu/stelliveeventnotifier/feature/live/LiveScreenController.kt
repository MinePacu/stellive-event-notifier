package dev.minepacu.stelliveeventnotifier.feature.live

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.text.TextUtils
import android.view.DragEvent
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.card.MaterialCardView
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.datastore.PreferenceKeys
import dev.minepacu.stelliveeventnotifier.core.model.HubMember
import dev.minepacu.stelliveeventnotifier.feature.home.LiveMemberOrderingPolicy
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardStyle
import java.time.Instant

/**
 * Owns all Live-screen (member list + live-status filter + drag reorder) VIEW-BUILDING and
 * state-transition logic that previously lived directly on [MainActivity], following the same
 * extraction shape as [dev.minepacu.stelliveeventnotifier.feature.settings.SettingsScreenController],
 * [dev.minepacu.stelliveeventnotifier.feature.songs.SongsScreenController], and
 * [dev.minepacu.stelliveeventnotifier.feature.goodsevents.GoodsEventsScreenController].
 *
 * Dependency-injection choice: takes the concrete [MainActivity], matching every prior extraction -
 * Live view-building is entangled with generic Activity-wide UI-atom helpers (color/dp/rounded/
 * baseCard/...), the live-clock ticking mechanism, and the screen-navigation stack.
 *
 * State ownership: all Live session/UI state (`selectedLiveStatusFilter`, `liveMemberPriorityIds`,
 * `draggingLiveMemberId`) stays on [MainActivity] as `internal` fields, exactly like prior
 * extractions kept their state behind - `liveMemberPriorityIds` is also read by
 * `HomeScreenController` (for the home live-preview ordering), and `readLiveMemberPriorityIds()`
 * (restoring it in `onCreate`) stays on MainActivity itself.
 *
 * `LiveDragPayload` moved here (as a private top-level type) since nothing outside this Live
 * drag-reorder cluster referenced it - same treatment GoodsEvents gave its own detail-only types.
 *
 * Home/Live boundary: `liveMemberRow()` is shown by BOTH the Home screen (a short live preview)
 * and this Live screen (the full, reorderable list) - since the row and its entire drag/chip/clock
 * subtree is fundamentally "the Live screen's row", this controller stays its owner and is bumped
 * to `internal`; `HomeScreenController` calls back into `activity.liveScreenController.liveMemberRow(...)`
 * rather than duplicating it, the same call-back shape already used for
 * `songsScreenController.songCard(...)` and `activity.hubEventCard(...)`.
 *
 * Shared-helper decisions: generic/stateful UI atoms also used elsewhere (`compactEventCard`,
 * `serverStatusStrip`, `filterPanel`, `baseCard`, `startScreen`, `memberAvatar`, `statusBadge`,
 * `registerLiveClockTextView`, `navigateToRoot`, `color`, `dp`, `rounded`) stay on MainActivity
 * (visibility bumped to `internal` where still `private`) and are called back into here, instead of
 * being duplicated. `registerLiveClockTextView`/the live-clock `Handler` ticking machinery stays on
 * MainActivity untouched because it is wired directly into `onResume`/`onPause`/`onDestroy`
 * Activity-lifecycle callbacks, not because it is Live-specific.
 */
internal class LiveScreenController(private val activity: MainActivity) {

    private data class LiveDragPayload(
        val memberId: String,
        val fromIndex: Int,
    )

    internal fun renderLive() {
        activity.startScreen(
            screenId = "live",
            title = activity.getString(R.string.live_title),
            role = "Foreground 상태 갱신은 화면 표시용입니다. 백그라운드 알림은 서버 중심 푸시로 처리합니다."
        )
        activity.binding.contentList.addView(activity.filterPanel(MainUiPolicy.liveTopFilterGroups(activity.selectedLiveStatusFilter)) { _, optionId ->
            activity.selectedLiveStatusFilter = optionId
            renderLive()
        })
        activity.binding.contentList.addView(activity.serverStatusStrip())
        val members = liveStatusFilteredMembersForUi()
        if (members.isEmpty()) {
            activity.binding.contentList.addView(activity.compactEventCard("조건에 맞는 멤버 없음", "다른 라이브 상태 필터를 선택해 확인할 수 있습니다.", listOf("필터")))
        } else {
            members.forEach { member ->
                activity.binding.contentList.addView(liveMemberRow(member, reorderable = true))
            }
        }
    }

    private fun chzzkMembersForUi(): List<HubMember> =
        LiveMemberOrderingPolicy.orderedChzzkTargets(activity.serverMembers ?: activity.repository.members, activity.liveMemberPriorityIds)

    internal fun liveStatusFilteredMembersForUi(): List<HubMember> =
        chzzkMembersForUi()
            .filter {
                when (activity.selectedLiveStatusFilter) {
                    "live" -> it.isLive
                    "offline" -> !it.isLive
                    else -> true
                }
            }

    internal fun liveMemberRow(member: HubMember, reorderable: Boolean = false): MaterialCardView =
        activity.baseCard(HubCardStyle.INTERACTIVE).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = activity.dp(10)
            }
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(activity.dp(13), activity.dp(13), activity.dp(13), activity.dp(13))
            }
            row.addView(activity.memberAvatar(member, activity.dp(42), showsLiveIndicator = true), LinearLayout.LayoutParams(activity.dp(42), activity.dp(42)))
            row.addView(liveMemberTextBlock(member), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = activity.dp(12)
                marginEnd = activity.dp(10)
            })
            row.addView(liveMemberStatusBlock(member))
            addView(row)
            if (reorderable) {
                attachLiveReorderHandlers(this, member)
            }
        }

    private fun attachLiveReorderHandlers(card: MaterialCardView, member: HubMember) {
        val orderedMembers = liveStatusFilteredMembersForUi()
        val currentIndex = orderedMembers.indexOfFirst { it.id == member.id }
        card.contentDescription = "${member.koreanName}, ${currentIndex + 1}번째, 길게 눌러 순서 변경"
        card.setOnLongClickListener {
            if (currentIndex == -1) return@setOnLongClickListener false
            activity.draggingLiveMemberId = member.id
            card.alpha = 0.84f
            val payload = ClipData.newPlainText("live-member-id", member.id)
            val shadow = View.DragShadowBuilder(card)
            card.startDragAndDrop(payload, shadow, LiveDragPayload(member.id, currentIndex), 0)
            card.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
            true
        }
        card.setOnDragListener { _, event ->
            when (event.action) {
                DragEvent.ACTION_DRAG_STARTED -> event.localState is LiveDragPayload
                DragEvent.ACTION_DRAG_ENTERED -> {
                    val payload = event.localState as? LiveDragPayload ?: return@setOnDragListener false
                    if (payload.memberId != member.id) {
                        card.alpha = 0.72f
                    }
                    true
                }
                DragEvent.ACTION_DRAG_EXITED -> {
                    card.alpha = if (activity.draggingLiveMemberId == member.id) 0.84f else 1f
                    true
                }
                DragEvent.ACTION_DROP -> {
                    val payload = event.localState as? LiveDragPayload ?: return@setOnDragListener false
                    if (payload.memberId != member.id && currentIndex != -1) {
                        moveLiveMember(payload.fromIndex, currentIndex)
                    }
                    true
                }
                DragEvent.ACTION_DRAG_ENDED -> {
                    card.alpha = 1f
                    activity.draggingLiveMemberId = null
                    true
                }
                else -> true
            }
        }
        card.accessibilityDelegate = object : View.AccessibilityDelegate() {
            override fun onInitializeAccessibilityNodeInfo(
                host: View,
                info: android.view.accessibility.AccessibilityNodeInfo,
            ) {
                super.onInitializeAccessibilityNodeInfo(host, info)
                info.addAction(
                    android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction(
                        android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD,
                        "위로 이동",
                    ),
                )
                info.addAction(
                    android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction(
                        android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_FORWARD,
                        "아래로 이동",
                    ),
                )
            }

            override fun performAccessibilityAction(host: View, action: Int, args: Bundle?): Boolean =
                when (action) {
                    android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD -> {
                        moveLiveMember(member, -1)
                        true
                    }
                    android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_FORWARD -> {
                        moveLiveMember(member, 1)
                        true
                    }
                    else -> super.performAccessibilityAction(host, action, args)
                }
        }
    }

    private fun liveMemberTextBlock(member: HubMember): LinearLayout = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        addView(TextView(context).apply {
            text = member.koreanName
            setTextColor(activity.color(R.color.hub_text))
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setLineSpacing(0f, 1.08f)
        })
        addView(TextView(context).apply {
            text = "${member.generationName} · ${member.unitName}"
            setTextColor(activity.color(R.color.hub_text_muted))
            textSize = 11f
            setPadding(0, activity.dp(3), 0, 0)
        })
        addView(TextView(context).apply {
            text = if (member.isLive) MainUiPolicy.liveTitleText(member.liveTitle) else MainUiPolicy.liveStatusText(member.isLive, member.liveStartedAt)
            setTextColor(if (member.isLive) activity.color(R.color.hub_text) else activity.color(R.color.hub_text_muted))
            textSize = if (member.isLive) 13f else 12f
            typeface = if (member.isLive) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
            setPadding(0, activity.dp(6), 0, 0)
            setLineSpacing(0f, 1.1f)
        })
        if (member.isLive) {
            liveSupplementaryChipGroup(member)?.let { group ->
                addView(group, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = activity.dp(6)
                })
            }
        }
    }

    private fun liveSupplementaryChipGroup(member: HubMember): ChipGroup? {
        val chips = buildList {
            MainUiPolicy.liveCategoryText(member.liveCategory)?.let { category ->
                add(liveCategoryChip(category))
            }
            member.livePlatformUrl?.takeIf { it.startsWith("https://") }?.let { url ->
                add(liveOpenLinkChip(url))
                if (activity.currentAdaptiveSpec.showAdjacentLiveAction) {
                    add(liveOpenAdjacentChip(url))
                }
            }
        }
        if (chips.isEmpty()) return null
        return ChipGroup(activity).apply {
            isSingleLine = false
            chipSpacingHorizontal = activity.dp(6)
            chipSpacingVertical = activity.dp(4)
            chips.forEach(::addView)
        }
    }

    private fun liveCategoryChip(category: String): Chip =
        Chip(activity).apply {
            text = category
            isCheckable = false
            isClickable = false
            isFocusable = false
            setEnsureMinTouchTargetSize(false)
            chipMinHeight = activity.dp(22).toFloat()
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            chipBackgroundColor = ContextCompat.getColorStateList(context, R.color.hub_card_surface_compact)
            setTextColor(activity.color(R.color.hub_text_muted))
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            maxWidth = activity.dp(140)
        }

    private fun liveOpenLinkChip(url: String): Chip =
        Chip(activity).apply {
            text = activity.getString(R.string.live_open_chzzk)
            isCheckable = false
            setEnsureMinTouchTargetSize(false)
            chipMinHeight = activity.dp(24).toFloat()
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            chipBackgroundColor = ContextCompat.getColorStateList(context, R.color.hub_success_soft)
            setTextColor(activity.color(R.color.hub_primary))
            setOnClickListener {
                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            }
        }

    private fun liveOpenAdjacentChip(url: String): Chip =
        Chip(activity).apply {
            text = activity.getString(R.string.live_open_split)
            isCheckable = false
            setEnsureMinTouchTargetSize(false)
            chipMinHeight = activity.dp(24).toFloat()
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            chipBackgroundColor = ContextCompat.getColorStateList(context, R.color.hub_card_surface_compact)
            setTextColor(activity.color(R.color.hub_text))
            setOnClickListener {
                openLiveUrlAdjacentOrFallback(url)
            }
        }

    private fun openLiveUrlAdjacentOrFallback(url: String) {
        val uri = Uri.parse(url)
        val adjacentIntent = Intent(Intent.ACTION_VIEW, uri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT)
        }

        runCatching {
            activity.startActivity(adjacentIntent)
        }.onFailure {
            activity.startActivity(Intent(Intent.ACTION_VIEW, uri))
        }
    }

    private fun liveMemberStatusBlock(member: HubMember): LinearLayout = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.END
        addView(activity.statusBadge(if (member.isLive) "LIVE" else "OFF", member.isLive))
        if (member.isLive) {
            MainUiPolicy.liveElapsedClockText(member.liveStartedAt)?.let { elapsed ->
                addView(liveSideMetricRow(R.drawable.ic_metric_clock, elapsed, activity.color(R.color.hub_text_muted), member.liveStartedAt))
            }
            MainUiPolicy.viewerCountText(member.liveViewerCount)?.let { viewers ->
                addView(liveSideMetricRow(R.drawable.ic_metric_viewers, viewers, activity.color(R.color.hub_primary)))
            }
        }
    }

    private fun liveSideMetricRow(iconResId: Int, value: String, valueColor: Int, liveStartedAt: Instant? = null): LinearLayout =
        LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            setPadding(0, activity.dp(5), 0, 0)
            addView(ImageView(context).apply {
                setImageResource(iconResId)
                setColorFilter(valueColor)
                contentDescription = null
            }, LinearLayout.LayoutParams(activity.dp(12), activity.dp(12)))
            val valueView = TextView(context).apply {
                text = value
                setTextColor(valueColor)
                textSize = 11f
                typeface = Typeface.DEFAULT_BOLD
            }
            addView(valueView, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                marginStart = activity.dp(4)
            })
            liveStartedAt?.let { activity.registerLiveClockTextView(it, valueView) }
        }

    private fun writeLiveMemberPriorityIds(ids: List<String>) {
        activity.liveMemberPriorityIds = ids
        activity.getSharedPreferences("hub_preferences", Context.MODE_PRIVATE)
            .edit()
            .putString(PreferenceKeys.LIVE_MEMBER_ORDER, ids.joinToString(","))
            .apply()
    }

    private fun moveLiveMember(fromIndex: Int, toIndex: Int) {
        val members = liveStatusFilteredMembersForUi()
        writeLiveMemberPriorityIds(
            LiveMemberOrderingPolicy.movedPriority(
                priorityMemberIds = activity.liveMemberPriorityIds,
                orderedMembers = members,
                fromIndex = fromIndex,
                toIndex = toIndex,
            ),
        )
        renderLive()
    }

    private fun moveLiveMember(member: HubMember, offset: Int) {
        val members = liveStatusFilteredMembersForUi()
        val index = members.indexOfFirst { it.id == member.id }
        if (index == -1) return
        moveLiveMember(index, index + offset)
    }
}
