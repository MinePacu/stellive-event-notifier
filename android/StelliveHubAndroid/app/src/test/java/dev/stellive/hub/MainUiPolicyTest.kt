package dev.stellive.hub

import dev.stellive.hub.feature.home.MainUiPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class MainUiPolicyTest {
    @Test
    fun topBarRolesMatchBottomNavigationScreens() {
        assertEquals("라이브 현황과 최근 알림", MainUiPolicy.topBarRole("home"))
        assertEquals("방송 상태와 실시간 best-effort", MainUiPolicy.topBarRole("live"))
        assertEquals("허용된 알림과 차단된 이벤트", MainUiPolicy.topBarRole("history"))
        assertEquals("알림 대상과 전송 정책", MainUiPolicy.topBarRole("settings"))
        assertEquals("상세", MainUiPolicy.topBarTitle("goods_event_detail"))
        assertEquals("공식 출처와 일정 정보", MainUiPolicy.topBarRole("goods_event_detail"))
    }

    @Test
    fun topBarTitleStartInsetAlignsRootScreensWithContentPadding() {
        assertEquals(10, MainUiPolicy.topBarTitleStartInsetDp(canGoBack = false))
        assertEquals(0, MainUiPolicy.topBarTitleStartInsetDp(canGoBack = true))
    }

    @Test
    fun homeStatusSummarySurfacesCurrentStatus() {
        val summary = MainUiPolicy.homeStatusSummary(liveCount = 1, recentCount = 3, closingSoonCount = 1)

        assertEquals("1", summary[0].value)
        assertEquals("지금 라이브", summary[0].label)
        assertEquals("3", summary[1].value)
        assertEquals("최근 알림", summary[1].label)
        assertEquals("1", summary[2].value)
        assertEquals("마감 임박", summary[2].label)
    }

    @Test
    fun homeHubEventsListActionKeepsFullListReachableWhenClosingSoonExists() {
        val action = MainUiPolicy.homeHubEventsListAction(closingSoonCount = 1)

        assertEquals("굿즈/행사 전체 보기", action.title)
        assertEquals("진행 중과 예정 항목을 모두 확인합니다.", action.body)
        assertEquals(listOf("굿즈/행사", "전체"), action.pills)
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

    @Test
    fun settingsHubRowsSummarizeChildPages() {
        val rows = MainUiPolicy.settingsHubRows(
            deliveryMode = "STANDARD",
            enabledTargets = 15,
            totalTargets = 16,
            enabledPlatforms = 4,
            totalPlatforms = 5,
            enabledEventTypes = 12,
            totalEventTypes = 16,
            hubEventsEnabled = true,
            deadlineSoonEnabled = true
        )

        assertEquals(listOf("delivery", "targets", "platforms", "event_types", "hub_events", "advanced"), rows.map { it.screenId })
        assertEquals("표준", rows.first { it.screenId == "delivery" }.value)
        assertEquals("4/5", rows.first { it.screenId == "platforms" }.value)
        assertEquals("켜짐 · 마감 임박 ON", rows.first { it.screenId == "hub_events" }.value)
        assertFalse(rows.any { it.title == "CHZZK 채팅" })
    }

    @Test
    fun settingsChildRowsKeepPolicySensitiveDefaults() {
        val eventRows = MainUiPolicy.settingsEventTypeRows()
        val hubRows = MainUiPolicy.settingsHubEventRows(hubEventsEnabled = true, deadlineSoonEnabled = true)

        assertEquals(false, eventRows.first { it.title == "CHZZK 채팅" }.checked)
        assertEquals(false, eventRows.first { it.title == "YouTube 라이브 시작" }.checked)
        assertTrue(eventRows.first { it.title == "YouTube 라이브 시작" }.body.contains("공식 채널에는 적용하지 않음"))
        assertEquals(true, hubRows.first { it.title == "굿즈/행사 알림" }.checked)
        assertEquals(false, hubRows.first { it.title == "변경 알림" }.checked)
        assertTrue(MainUiPolicy.hubEventPolicyNotice().contains("대표/강지 이벤트"))
    }
}
