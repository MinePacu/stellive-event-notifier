package dev.stellive.hub

import dev.stellive.hub.feature.home.MainUiPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class MainUiPolicyTest {
    @Test
    fun topBarRolesMatchBottomNavigationScreens() {
        assertEquals("활성 멤버와 공식 채널 상태", MainUiPolicy.topBarRole("home"))
        assertEquals("방송 상태와 실시간 best-effort", MainUiPolicy.topBarRole("live"))
        assertEquals("허용된 알림과 차단된 이벤트", MainUiPolicy.topBarRole("history"))
        assertEquals("전체, 카테고리, 플랫폼, 이벤트, 조합 설정", MainUiPolicy.topBarRole("settings"))
    }

    @Test
    fun homeStatusSummarySurfacesPolicyConstraintsBeforeFilters() {
        val summary = MainUiPolicy.homeStatusSummary()

        assertEquals("현재 CHZZK 방송 중", summary[0].label)
        assertEquals("upcoming 기본 알림", summary[1].label)
        assertEquals("공식 채널 이벤트 타입", summary[2].label)
        assertEquals("공식 YouTube 라이브 알림", summary[3].label)
        assertTrue(summary.any { it.value == "0" && it.label == "공식 YouTube 라이브 알림" })
    }

    @Test
    fun liveStatusTextShowsElapsedTimeWhenStartedAtExists() {
        val startedAt = Instant.parse("2026-06-02T09:00:00Z")
        val now = Instant.parse("2026-06-02T10:23:00Z")

        assertEquals("방송 중 · 1시간 23분 진행 중", MainUiPolicy.liveStatusText(true, startedAt, now))
        assertEquals("방송 중", MainUiPolicy.liveStatusText(true, null, now))
        assertEquals("오프라인", MainUiPolicy.liveStatusText(false, startedAt, now))
    }

    @Test
    fun realtimeDisclosureUsesRequiredPolicyText() {
        val lines = MainUiPolicy.realtimeDisclosureLines()

        assertEquals(3, lines.size)
        assertTrue(lines[0].contains("플랫폼/OS/네트워크"))
        assertTrue(lines[1].contains("배터리와 데이터"))
        assertTrue(lines[2].contains("rate limit"))
    }
}
