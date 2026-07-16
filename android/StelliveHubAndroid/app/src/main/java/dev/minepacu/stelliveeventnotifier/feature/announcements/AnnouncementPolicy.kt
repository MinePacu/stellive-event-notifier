package dev.minepacu.stelliveeventnotifier.feature.announcements

import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncement
import dev.minepacu.stelliveeventnotifier.core.model.AnnouncementSummaryItem
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncementSeverity
import java.time.Instant

object AnnouncementPolicy {
    fun readKey(id: String, attentionRevision: Int): String = "$id:$attentionRevision"

    fun unread(items: List<ServiceAnnouncement>, readKeys: Set<String>): List<ServiceAnnouncement> =
        items.filterNot { readKey(it.id, it.attentionRevision) in readKeys }

    fun badgeText(unreadCount: Int): String? = when {
        unreadCount <= 0 -> null
        unreadCount <= 9 -> unreadCount.toString()
        else -> "9+"
    }

    fun accessibilityLabel(unreadCount: Int): String =
        if (unreadCount <= 0) "공지, 읽지 않은 공지 없음" else "공지, 읽지 않은 공지 ${unreadCount}개"

    fun homeAnnouncement(items: List<ServiceAnnouncement>): ServiceAnnouncement? =
        items.asSequence()
            .filter { it.severity == ServiceAnnouncementSeverity.CRITICAL || (it.isPinned && it.severity == ServiceAnnouncementSeverity.IMPORTANT) }
            .sortedWith(compareByDescending<ServiceAnnouncement> { it.severity == ServiceAnnouncementSeverity.CRITICAL }.thenByDescending { it.publishedAt })
            .firstOrNull()

    fun initialReadKeys(items: List<ServiceAnnouncement>, firstSyncAt: Instant): Set<String> =
        items.asSequence()
            .filter { it.publishedAt <= firstSyncAt && it.severity != ServiceAnnouncementSeverity.CRITICAL && !it.isPinned }
            .map { readKey(it.id, it.attentionRevision) }
            .toSet()

    fun initialSummaryReadKeys(items: List<AnnouncementSummaryItem>, firstSyncAt: Instant): Set<String> =
        items.asSequence()
            .filter { it.publishedAt <= firstSyncAt && it.severity != ServiceAnnouncementSeverity.CRITICAL && !it.isPinned }
            .map { readKey(it.id, it.attentionRevision) }
            .toSet()

    fun sorted(items: List<ServiceAnnouncement>): List<ServiceAnnouncement> =
        items.sortedWith(compareByDescending<ServiceAnnouncement> { it.isPinned }.thenByDescending { it.publishedAt })
}

object AnnouncementDeepLinkPolicy {
    private const val PREFIX = "stellivehub://announcements/"
    fun idFromAppDeepLink(value: String?): String? = value
        ?.takeIf { it.startsWith(PREFIX) }
        ?.removePrefix(PREFIX)
        ?.substringBefore('?')
        ?.takeIf { it.isNotBlank() && '/' !in it }
}
