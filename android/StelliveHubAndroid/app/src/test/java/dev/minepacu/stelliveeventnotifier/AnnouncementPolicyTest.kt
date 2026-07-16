package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncement
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncementSeverity
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncementType
import dev.minepacu.stelliveeventnotifier.feature.announcements.AnnouncementDeepLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.announcements.AnnouncementPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant

class AnnouncementPolicyTest {
    private fun item(id: String, severity: ServiceAnnouncementSeverity = ServiceAnnouncementSeverity.INFO, pinned: Boolean = false, publishedAt: String = "2026-07-16T00:00:00Z", attention: Int = 1) =
        ServiceAnnouncement(id, ServiceAnnouncementType.GENERAL, severity, id, "요약", "본문", pinned, listOf("android", "ios"), publishedAt = Instant.parse(publishedAt), attentionRevision = attention, revision = 1, updatedAt = Instant.parse(publishedAt))

    @Test fun readKeyAndAttentionRevisionControlUnreadState() {
        val notice = item("a", attention = 2)
        assertEquals(1, AnnouncementPolicy.unread(listOf(notice), setOf("a:1")).size)
        assertEquals(0, AnnouncementPolicy.unread(listOf(notice), setOf("a:2")).size)
    }

    @Test fun badgeCapsAtNinePlusAndIncludesAccessibleCount() {
        assertNull(AnnouncementPolicy.badgeText(0))
        assertEquals("9", AnnouncementPolicy.badgeText(9))
        assertEquals("9+", AnnouncementPolicy.badgeText(10))
        assertEquals("공지, 읽지 않은 공지 12개", AnnouncementPolicy.accessibilityLabel(12))
    }

    @Test fun homePriorityAndFirstSyncPolicyAreStable() {
        val old = item("old", publishedAt = "2026-07-01T00:00:00Z")
        val pinned = item("pinned", ServiceAnnouncementSeverity.IMPORTANT, pinned = true, publishedAt = "2026-07-02T00:00:00Z")
        val critical = item("critical", ServiceAnnouncementSeverity.CRITICAL, publishedAt = "2026-07-03T00:00:00Z")
        assertEquals("critical", AnnouncementPolicy.homeAnnouncement(listOf(pinned, critical))?.id)
        assertEquals(setOf("old:1"), AnnouncementPolicy.initialReadKeys(listOf(old, pinned, critical), Instant.parse("2026-07-16T00:00:00Z")))
    }

    @Test fun parsesAnnouncementDeepLinksOnly() {
        assertEquals("notice-1", AnnouncementDeepLinkPolicy.idFromAppDeepLink("stellivehub://announcements/notice-1"))
        assertNull(AnnouncementDeepLinkPolicy.idFromAppDeepLink("stellivehub://hub-events/notice-1"))
    }
}
