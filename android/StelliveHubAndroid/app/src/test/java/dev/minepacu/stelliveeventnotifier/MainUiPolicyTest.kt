package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import dev.minepacu.stelliveeventnotifier.core.model.NotificationPlatform
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant

class MainUiPolicyTest {
    @Test
    fun topBarRolesMatchBottomNavigationScreens() {
        assertEquals("라이브 현황과 최근 알림", MainUiPolicy.topBarRole("home"))
        assertEquals("방송 상태와 CHZZK 대상 현황", MainUiPolicy.topBarRole("live"))
        assertEquals("YouTube 업로드 곡 탐색", MainUiPolicy.topBarRole("songs"))
        assertEquals("허용된 알림 기록과 정책 제외 항목", MainUiPolicy.topBarRole("history"))
        assertEquals("알림 대상과 전송 정책", MainUiPolicy.topBarRole("settings"))
        assertEquals("", MainUiPolicy.topBarTitle("goods_event_detail"))
        assertEquals("", MainUiPolicy.topBarRole("goods_event_detail"))
    }

    @Test
    fun primaryNavigationMovesSettingsToTopBarAndAddsHubEventsTab() {
        val navigationItems = MainUiPolicy.primaryNavigationItems()

        assertEquals(listOf("home", "live", "songs", "goods_events"), navigationItems.map { it.screenId })
        assertEquals(listOf("홈", "라이브", "노래", "굿즈/행사"), navigationItems.map { it.label })
        assertFalse(navigationItems.any { it.screenId == "settings" })
        assertFalse(navigationItems.any { it.screenId == "history" })
        assertTrue(MainUiPolicy.showsSettingsTopBarAction("home", canGoBack = false))
        assertTrue(MainUiPolicy.showsSettingsTopBarAction("songs", canGoBack = false))
        assertTrue(MainUiPolicy.showsSettingsTopBarAction("goods_events", canGoBack = false))
        assertFalse(MainUiPolicy.showsSettingsTopBarAction("settings", canGoBack = false))
        assertFalse(MainUiPolicy.showsSettingsTopBarAction("goods_event_detail", canGoBack = true))
    }

    @Test
    fun settingsCardsUseCompactVerticalSpacing() {
        val spacing = MainUiPolicy.settingsCardSpacing

        assertEquals(10, spacing.contentVerticalPaddingDp)
        assertEquals(6, spacing.rowVerticalPaddingDp)
        assertEquals(8, spacing.bottomMarginDp)
    }

    @Test
    fun topBarTitleStartInsetAlignsRootScreensWithChromePadding() {
        assertEquals(10, MainUiPolicy.topBarTitleStartInsetDp(canGoBack = false))
        assertEquals(10, MainUiPolicy.topBarTitleStartInsetDp(canGoBack = true))
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
    fun homeSummaryCardsAreDisabled() {
        assertFalse(MainUiPolicy.homeSummaryCardsVisible())
    }

    @Test
    fun liveAndGoodsEventTopFiltersKeepExistingIds() {
        val live = MainUiPolicy.liveTopFilterGroups("all").single()
        val goods = MainUiPolicy.goodsEventsTopFilterGroups("all").single()

        assertEquals(listOf("live", "all", "offline"), live.options.map { it.id })
        assertEquals(listOf("all", "goods", "ticketing", "offline", "closing"), goods.options.map { it.id })
        assertEquals("all", live.selectedId)
        assertEquals("all", goods.selectedId)
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
    fun liveClockRefreshRunsOnlyOnHomeAndLiveWhenThereAreLiveMembers() {
        assertEquals(1_000L, MainUiPolicy.liveClockRefreshDelayMillis("home", hasLiveMembers = true))
        assertEquals(1_000L, MainUiPolicy.liveClockRefreshDelayMillis("live", hasLiveMembers = true))
        assertEquals(null, MainUiPolicy.liveClockRefreshDelayMillis("history", hasLiveMembers = true))
        assertEquals(null, MainUiPolicy.liveClockRefreshDelayMillis("home", hasLiveMembers = false))
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

        assertEquals(listOf("delivery", "targets", "platforms", "event_types", "hub_events", "history", "advanced"), rows.map { it.screenId })
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
        assertNull(eventRows.first { it.title == "CHZZK 채팅" }.body)
        assertNull(eventRows.first { it.title == "YouTube 라이브 시작" }.body)
        assertTrue(MainUiPolicy.settingsEventTypeCommonNotices().any { it.contains("공식 채널에는 YouTube 라이브 예정/시작/종료") })
        assertTrue(MainUiPolicy.settingsEventTypeCommonNotices().any { it.contains("조용한 시간") })
        assertEquals(true, hubRows.first { it.title == "굿즈/행사 알림" }.checked)
        assertEquals(false, hubRows.first { it.title == "변경 알림" }.checked)
        assertTrue(MainUiPolicy.hubEventPolicyNotice().contains("대표/강지 이벤트"))
    }

    @Test
    fun settingsSharedPlatformPolicyIsShownOncePerSection() {
        assertNull(MainUiPolicy.settingsPlatformPolicy(NotificationPlatform.CHZZK))
        assertNull(MainUiPolicy.settingsPlatformPolicy(NotificationPlatform.YOUTUBE))
        assertEquals(
            "공식 API와 약관을 우선합니다. 무단 수집이나 로그인 쿠키 수집은 사용하지 않습니다.",
            MainUiPolicy.settingsPlatformPolicy(NotificationPlatform.NAVER_CAFE)
        )
        assertEquals(
            "공식 출처가 있는 기간성 굿즈, 티켓, 오프라인 행사만 포함합니다.",
            MainUiPolicy.settingsPlatformPolicy(NotificationPlatform.HUB_EVENT)
        )
        assertTrue(MainUiPolicy.settingsPlatformCommonNotice().contains("플랫폼 OFF"))
    }

    @Test
    fun livePageFormattersMatchServerUiMockup() {
        val now = Instant.parse("2026-06-15T11:03:00Z")

        assertEquals(
            "1:23:00",
            MainUiPolicy.liveElapsedClockText(Instant.parse("2026-06-15T09:40:00Z"), now),
        )
        assertEquals(
            "0:18:00",
            MainUiPolicy.liveElapsedClockText(Instant.parse("2026-06-15T10:45:00Z"), now),
        )
        assertNull(MainUiPolicy.liveElapsedClockText(null, now))
        assertEquals("1,234", MainUiPolicy.viewerCountText(1234))
        assertNull(MainUiPolicy.viewerCountText(null))
        assertEquals("방송 제목 확인 중", MainUiPolicy.liveTitleText(" "))
        assertEquals("유니랑 밤 산책 게임하고 노래 조금", MainUiPolicy.liveTitleText("유니랑 밤 산책 게임하고 노래 조금"))
    }

    @Test
    fun debugServerConnectionLogsOnlyRenderWhenDebugModeIsEnabled() {
        val logs = listOf(
            "bootstrap: 서버 연결됨 · 라이브 폴링 꺼짐/데이터 없음",
            "device: registration skipped"
        )

        assertTrue(MainUiPolicy.debugServerConnectionLogs(debugModeEnabled = false, logs = logs).isEmpty())
        assertEquals(logs, MainUiPolicy.debugServerConnectionLogs(debugModeEnabled = true, logs = logs))
    }

    @Test
    fun serverConnectionLabelDistinguishesConnectedCachedAndOffline() {
        assertEquals("서버 연결됨", MainUiPolicy.serverConnectionLabel("서버 liveStatus"))
        assertEquals("캐시 표시 중", MainUiPolicy.serverConnectionLabel("서버 연결됨 · 라이브 폴링 꺼짐/데이터 없음"))
        assertEquals("오프라인", MainUiPolicy.serverConnectionLabel("서버 연결 실패 · 앱 내 목업"))
    }

    @Test
    fun loadingPresentationsSeparateLoadingCopyFromEmptyStateCopy() {
        val presentations = listOf(
            MainUiPolicy.homeRecentSongsLoadingPresentation(),
            MainUiPolicy.goodsEventsLoadingPresentation(),
            MainUiPolicy.hubEventDetailLoadingPresentation(),
            MainUiPolicy.songsLoadingPresentation(),
            MainUiPolicy.songSearchLoadingPresentation(),
            MainUiPolicy.songSearchTransitionLoadingPresentation(),
        )

        assertEquals("최근 곡 확인 중", presentations[0].title)
        assertEquals("굿즈/행사 불러오는 중", presentations[1].title)
        assertEquals("상세 정보 불러오는 중", presentations[2].title)
        assertEquals("노래 목록 불러오는 중", presentations[3].title)
        assertEquals("검색 준비 중", presentations[4].title)
        assertEquals("노래 검색 여는 중", presentations[5].title)
        assertNotEquals(MainUiPolicy.songSearchLoadingPresentation().body, MainUiPolicy.songSearchTransitionLoadingPresentation().body)
        assertTrue(presentations.all { it.body.isNotBlank() && it.chipLabel.isNotBlank() })
        assertFalse(presentations.any { it.title.contains("없음") || it.body.contains("없습니다") })
    }

    @Test
    fun policyNoticesMatchScreenResponsibilities() {
        assertTrue(MainUiPolicy.hubEventPolicyNotice().contains("팬 주최 이벤트"))
        assertTrue(MainUiPolicy.historyPolicyNotice().contains("공식 YouTube 라이브 예정, 시작, 종료"))
    }
}
