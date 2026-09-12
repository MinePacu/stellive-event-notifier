package dev.minepacu.stelliveeventnotifier.feature.announcements

import android.content.Intent
import android.net.Uri
import com.google.android.material.card.MaterialCardView
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncement
import androidx.lifecycle.lifecycleScope
import dev.minepacu.stelliveeventnotifier.feature.home.HubScreen
import kotlinx.coroutines.launch

/**
 * Owns all Announcements-screen (list + detail) VIEW-BUILDING and state-transition logic that
 * previously lived directly on [MainActivity], following the same extraction shape as
 * [dev.minepacu.stelliveeventnotifier.feature.settings.SettingsScreenController],
 * [dev.minepacu.stelliveeventnotifier.feature.songs.SongsScreenController], and
 * [dev.minepacu.stelliveeventnotifier.feature.goodsevents.GoodsEventsScreenController].
 *
 * Dependency-injection choice: takes the concrete [MainActivity], matching every prior extraction -
 * Announcements view-building is entangled with generic Activity-wide UI-atom helpers
 * (color/dp/compactEventCard/...) and the screen-navigation stack.
 *
 * State ownership: all Announcements session/UI state (`announcementsSummary`, `announcementItems`,
 * `announcementNextCursor`, `announcementReadKeys`, `announcementReadStore`, `selectedAnnouncementId`)
 * stays on [MainActivity] as `internal` fields, exactly like prior extractions kept their state
 * behind - `loadServerBootstrap()` and `handleAppDeepLink()` (Activity-wide bootstrap/deep-link
 * plumbing) still read/write several of these directly from MainActivity itself.
 *
 * `updateAnnouncementAction()` (top-bar badge upkeep) stays on MainActivity, bumped to `internal`,
 * and is called back into from `markAnnouncementRead()` here - it is Activity chrome
 * (`updateNavigationChrome()` calls it directly), the same way the Reservations pending-count badge
 * stayed inline on MainActivity's `updateNavigationChrome()` despite `ReservationsScreenController`
 * existing separately.
 *
 * Home boundary: `announcementCard()` is also shown at the top of the Home screen (the single
 * "중요 공지" callout) - since it is fundamentally Announcements-domain rendering, it is bumped to
 * `internal` and `HomeScreenController` calls back into
 * `activity.announcementsScreenController.announcementCard(...)` rather than duplicating it, the
 * same call-back shape already used for `songsScreenController.songCard(...)`.
 *
 * Shared-helper decisions: generic/stateful UI atoms also used elsewhere (`compactEventCard`,
 * `sectionLabel`, `screenTitle`, `screenCopy`, `startScreen`, `pushScreen`, `refreshScreenWhenIdle`,
 * `openExternalUrl`) stay on MainActivity (visibility bumped to `internal` where still `private`)
 * and are called back into here, instead of being duplicated.
 */
internal class AnnouncementsScreenController(private val activity: MainActivity) {

    internal fun renderAnnouncements() {
        activity.startScreen("announcements", "공지사항", "앱 서비스 운영 안내와 장애·점검·업데이트 소식입니다.")
        if (activity.announcementItems.isEmpty()) {
            activity.binding.contentList.addView(activity.compactEventCard("공지 확인 중", "서버에서 최신 공지를 불러오고 있습니다.", emptyList()))
            loadAnnouncements(reset = true)
            return
        }
        val sorted = AnnouncementPolicy.sorted(activity.announcementItems)
        val pinned = sorted.filter { it.isPinned }
        val recent = sorted.filterNot { it.isPinned }
        if (pinned.isNotEmpty()) {
            activity.binding.contentList.addView(activity.sectionLabel("고정 공지"))
            pinned.forEach { activity.binding.contentList.addView(announcementCard(it, showBody = false)) }
        }
        activity.binding.contentList.addView(activity.sectionLabel("최근 공지"))
        recent.forEach { activity.binding.contentList.addView(announcementCard(it, showBody = false)) }
        activity.announcementNextCursor?.let {
            activity.binding.contentList.addView(activity.compactEventCard("더 불러오기", "이전 공지를 이어서 확인합니다.", emptyList()).apply {
                isClickable = true
                isFocusable = true
                setOnClickListener { loadAnnouncements(reset = false) }
            })
        }
    }

    internal fun loadAnnouncements(reset: Boolean) {
        activity.lifecycleScope.launch {
            val page = activity.serverRepository.announcements(if (reset) null else activity.announcementNextCursor)
            activity.announcementItems = if (reset) page.items else (activity.announcementItems + page.items).distinctBy { it.id }
            activity.announcementNextCursor = page.nextCursor
            activity.announcementReadStore.initialize(activity.announcementItems)
            activity.binding.contentRefresh.isRefreshing = false
            if (activity.navigationHistory.currentScreen == HubScreen.ANNOUNCEMENTS) activity.refreshScreenWhenIdle(HubScreen.ANNOUNCEMENTS, ::renderAnnouncements)
        }
    }

    internal fun announcementCard(announcement: ServiceAnnouncement, showBody: Boolean): MaterialCardView {
        val unread = AnnouncementPolicy.readKey(announcement.id, announcement.attentionRevision) !in activity.announcementReadKeys
        val meta = mutableListOf(announcement.type.displayName, announcement.severity.displayName)
        if (unread) meta += "읽지 않음"
        if (announcement.resolvedAt != null) meta += "해결됨"
        meta += announcement.publishedAt.toString().take(10)
        return activity.compactEventCard(
            announcement.title,
            if (showBody) announcement.body else announcement.summary,
            meta,
        ).apply {
            isClickable = true
            isFocusable = true
            setOnClickListener {
                activity.selectedAnnouncementId = announcement.id
                markAnnouncementRead(announcement)
                activity.pushScreen(HubScreen.ANNOUNCEMENT_DETAIL)
            }
        }
    }

    private fun markAnnouncementRead(announcement: ServiceAnnouncement) {
        activity.announcementReadKeys = activity.announcementReadKeys + AnnouncementPolicy.readKey(announcement.id, announcement.attentionRevision)
        activity.updateAnnouncementAction()
        activity.lifecycleScope.launch { activity.announcementReadStore.markRead(announcement) }
    }

    internal fun renderAnnouncementDetail() {
        activity.startScreen("announcement_detail", "공지사항", "")
        val id = activity.selectedAnnouncementId
        val announcement = activity.announcementItems.firstOrNull { it.id == id } ?: activity.announcementsSummary.pinned?.takeIf { it.id == id }
        if (id == null) {
            activity.binding.contentList.addView(activity.compactEventCard("공지를 찾을 수 없습니다", "공지 목록에서 다시 선택해 주세요.", emptyList()))
            return
        }
        if (announcement == null) {
            activity.binding.contentList.addView(activity.compactEventCard("공지 불러오는 중", "상세 내용을 확인하고 있습니다.", emptyList()))
            activity.lifecycleScope.launch {
                activity.serverRepository.announcementDetail(id)?.let {
                    activity.announcementItems = (activity.announcementItems + it).distinctBy(ServiceAnnouncement::id)
                    markAnnouncementRead(it)
                    activity.refreshScreenWhenIdle(HubScreen.ANNOUNCEMENT_DETAIL, ::renderAnnouncementDetail)
                }
            }
            return
        }
        markAnnouncementRead(announcement)
        activity.binding.contentList.addView(activity.sectionLabel(announcement.type.displayName + " · " + announcement.severity.displayName))
        activity.binding.contentList.addView(activity.screenTitle(announcement.title))
        activity.binding.contentList.addView(activity.screenCopy("게시 ${announcement.publishedAt.toString().take(16).replace('T', ' ')} · 수정 ${announcement.updatedAt.toString().take(16).replace('T', ' ')}"))
        activity.binding.contentList.addView(activity.compactEventCard("", announcement.body, listOfNotNull(if (announcement.resolvedAt != null) "해결됨" else null)))
        if (!announcement.actionLabel.isNullOrBlank() && (!announcement.appDeepLink.isNullOrBlank() || !announcement.externalUrl.isNullOrBlank())) {
            activity.binding.contentList.addView(activity.compactEventCard(announcement.actionLabel, "관련 화면 또는 링크를 엽니다.", emptyList()).apply {
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    announcement.appDeepLink?.let { activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) }
                        ?: activity.openExternalUrl(announcement.externalUrl)
                }
            })
        }
        announcement.externalUrl?.let { url ->
            activity.binding.contentList.addView(activity.compactEventCard("외부 링크", url, emptyList()).apply {
                isClickable = true
                isFocusable = true
                setOnClickListener { activity.openExternalUrl(url) }
            })
        }
    }
}
