package dev.minepacu.stelliveeventnotifier.feature.home

import android.graphics.Typeface
import android.widget.LinearLayout
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.chip.Chip
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.HubMember
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.feature.announcements.AnnouncementPolicy
import kotlinx.coroutines.launch

/**
 * Owns all Home-screen (dashboard) VIEW-BUILDING and state-transition logic that previously lived
 * directly on [MainActivity], following the same extraction shape as
 * [dev.minepacu.stelliveeventnotifier.feature.settings.SettingsScreenController],
 * [dev.minepacu.stelliveeventnotifier.feature.songs.SongsScreenController], and
 * [dev.minepacu.stelliveeventnotifier.feature.goodsevents.GoodsEventsScreenController].
 *
 * Dependency-injection choice: takes the concrete [MainActivity], matching every prior extraction -
 * Home view-building is entangled with generic Activity-wide UI-atom helpers (color/dp/
 * compactEventCard/...) and the screen-navigation stack.
 *
 * State ownership: `homeRecentSongs`/`isLoadingHomeRecentSongs`/`homeRecentSongsJob` stay on
 * [MainActivity] as `internal` fields, exactly like prior extractions kept their state behind.
 *
 * Home is a dashboard that previews three other screens' content rather than owning that content
 * itself, so it calls back into the sibling controllers that DO own it, the same call-back shape
 * already used for `songsScreenController.songCard(...)` and `activity.hubEventCard(...)`:
 * - `activity.announcementsScreenController.announcementCard(...)` for the "중요 공지" callout,
 * - `activity.liveScreenController.liveMemberRow(...)` for the "지금 라이브" preview rows,
 * - `activity.historyScreenController.historyEventCard(...)` for the "최근 알림" preview rows.
 * `activity.hubEventCard(...)` (for "마감 임박 굿즈/행사") stays on MainActivity itself, since
 * Reservations' detail screen also renders it directly (see GoodsEventsScreenController's own
 * doc comment on that boundary).
 *
 * Shared-helper decisions: generic/stateful UI atoms also used elsewhere (`compactEventCard`,
 * `sectionLabel`, `serverStatusStrip`, `loadingCard`, `startScreen`, `checkForAndroidUpdate`,
 * `navigateToRoot`, `color`, `dp`) stay on MainActivity (visibility bumped to `internal` where
 * still `private`) and are called back into here, instead of being duplicated.
 */
internal class HomeScreenController(private val activity: MainActivity) {

    internal fun renderHome() {
        activity.startScreen(
            screenId = "home",
            title = activity.getString(R.string.home_title),
            role = "지금 라이브, 최근 알림, 마감 임박 굿즈/행사를 확인합니다."
        )
        activity.binding.root.post {
            if (activity.navigationHistory.currentScreen == HubScreen.HOME) {
                activity.checkForAndroidUpdate(manual = false)
            }
        }
        val homeAnnouncement = AnnouncementPolicy.homeAnnouncement(
            (activity.announcementItems + listOfNotNull(activity.announcementsSummary.pinned)).distinctBy { it.id }
        )
        if (homeAnnouncement != null) {
            activity.binding.contentList.addView(activity.sectionLabel("중요 공지"))
            activity.binding.contentList.addView(activity.announcementsScreenController.announcementCard(homeAnnouncement, showBody = false))
        }
        activity.binding.contentList.addView(activity.sectionLabel("지금 라이브"))
        activity.binding.contentList.addView(activity.serverStatusStrip())
        if (liveMembersForUi().isEmpty()) {
            activity.binding.contentList.addView(
                activity.compactEventCard("현재 라이브 없음", "서버 갱신 기준으로 표시합니다.", listOf("대기"))
            )
        } else {
            LiveMemberOrderingPolicy.homeLivePreview(activity.serverMembers ?: activity.repository.members, activity.liveMemberPriorityIds)
                .forEach { activity.binding.contentList.addView(activity.liveScreenController.liveMemberRow(it)) }
            if (LiveMemberOrderingPolicy.hasHomeLiveOverflow(activity.serverMembers ?: activity.repository.members)) {
                activity.binding.contentList.addView(moreLiveMembersButton())
            }
        }
        activity.binding.contentList.addView(activity.sectionLabel("최근 곡"))
        when (val recentSongs = activity.homeRecentSongs) {
            null -> activity.binding.contentList.addView(
                activity.loadingCard(MainUiPolicy.homeRecentSongsLoadingPresentation())
            )
            emptyList<SongCatalogItem>() -> activity.binding.contentList.addView(
                activity.compactEventCard("최근 곡 없음", "등록된 곡이 없습니다.", listOf("노래"))
            )
            else -> recentSongs.forEach { activity.binding.contentList.addView(activity.songsScreenController.songCard(it)) }
        }
        activity.binding.contentList.addView(
            activity.compactEventCard("노래 전체 보기", "커버곡과 오리지널 곡 전체 목록으로 이동합니다.", listOf("전체")).apply {
                isClickable = true
                isFocusable = true
                setOnClickListener { activity.navigateToRoot(HubScreen.SONGS) }
            }
        )
        loadHomeRecentSongsIfNeeded()
        activity.binding.contentList.addView(activity.sectionLabel("최근 알림"))
        if (activity.repository.recentHistoryPreview.isEmpty()) {
            activity.binding.contentList.addView(
                activity.compactEventCard("최근 알림 없음", "허용된 알림이 도착하면 여기에 표시됩니다.", listOf("기록"))
            )
        } else {
            activity.repository.recentHistoryPreview.forEach {
                activity.binding.contentList.addView(
                    activity.historyScreenController.historyEventCard(
                        item = it,
                        member = activity.repository.memberForHistory(it)
                    )
                )
            }
        }
        activity.binding.contentList.addView(activity.sectionLabel("마감 임박 굿즈/행사"))
        val hubEventsListAction = MainUiPolicy.homeHubEventsListAction(activity.repository.closingSoonHubEvents.size)
        if (activity.repository.closingSoonHubEvents.isEmpty()) {
            activity.binding.contentList.addView(
                activity.compactEventCard(
                    hubEventsListAction.title,
                    hubEventsListAction.body,
                    hubEventsListAction.pills
                ).apply {
                    isClickable = true
                    isFocusable = true
                    setOnClickListener {
                        activity.navigateToRoot(HubScreen.GOODS_EVENTS)
                    }
                }
            )
        } else {
            activity.repository.closingSoonHubEvents.forEach {
                activity.binding.contentList.addView(activity.hubEventCard(it))
            }
            activity.binding.contentList.addView(
                activity.compactEventCard(
                    hubEventsListAction.title,
                    hubEventsListAction.body,
                    hubEventsListAction.pills
                ).apply {
                    isClickable = true
                    isFocusable = true
                    setOnClickListener {
                        activity.navigateToRoot(HubScreen.GOODS_EVENTS)
                    }
                }
            )
        }
    }

    private fun liveMembersForUi(): List<HubMember> =
        LiveMemberOrderingPolicy.orderedLiveMembers(activity.serverMembers ?: activity.repository.members, activity.liveMemberPriorityIds)

    private fun loadHomeRecentSongsIfNeeded() {
        if (activity.homeRecentSongs != null || activity.isLoadingHomeRecentSongs) return
        activity.isLoadingHomeRecentSongs = true
        activity.homeRecentSongsJob?.cancel()
        activity.homeRecentSongsJob = activity.lifecycleScope.launch {
            activity.homeRecentSongs = activity.serverRepository.recentSongs(limit = 5)
            activity.isLoadingHomeRecentSongs = false
            if (activity.navigationHistory.currentScreen == HubScreen.HOME) {
                activity.refreshScreenWhenIdle(HubScreen.HOME, ::renderHome)
            }
        }
    }

    private fun moreLiveMembersButton(): Chip =
        Chip(activity).apply {
            text = "더보기"
            isCheckable = false
            chipMinHeight = activity.dp(34).toFloat()
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            chipBackgroundColor = ContextCompat.getColorStateList(context, R.color.hub_surface)
            chipStrokeWidth = activity.dp(1).toFloat()
            chipStrokeColor = ContextCompat.getColorStateList(context, R.color.hub_line)
            setTextColor(activity.color(R.color.hub_text))
            setOnClickListener {
                activity.navigateToRoot(HubScreen.LIVE)
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                bottomMargin = activity.dp(10)
            }
        }
}
