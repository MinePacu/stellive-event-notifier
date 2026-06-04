package dev.stellive.hub.feature.home

import dev.stellive.hub.core.model.NotificationEventType
import dev.stellive.hub.core.model.NotificationPlatform
import dev.stellive.hub.core.model.NotificationSettingState
import dev.stellive.hub.core.model.HubEventStatus
import java.time.Duration
import java.time.Instant

data class StatusSummaryItem(
    val value: String,
    val label: String
)

data class HomeHubEventsAction(
    val title: String,
    val body: String,
    val pills: List<String>
)

data class MainNavigationItem(
    val screenId: String,
    val label: String
)

data class SettingsHubRow(
    val screenId: String,
    val title: String,
    val body: String,
    val value: String
)

data class SettingsPolicyRow(
    val title: String,
    val body: String?,
    val checked: Boolean?
)

object MainUiPolicy {
    private const val ROOT_TOP_BAR_TITLE_START_INSET_DP = 10

    fun primaryNavigationItems(): List<MainNavigationItem> = listOf(
        MainNavigationItem("home", "홈"),
        MainNavigationItem("live", "라이브"),
        MainNavigationItem("history", "기록"),
        MainNavigationItem("goods_events", "굿즈/행사")
    )

    fun showsSettingsTopBarAction(screenId: String, canGoBack: Boolean): Boolean =
        !canGoBack && screenId in primaryNavigationItems().map { it.screenId }

    fun topBarTitle(screenId: String): String = when (screenId) {
        "live" -> "라이브"
        "history" -> "기록"
        "settings" -> "설정"
        "settings_delivery" -> "전달 방식"
        "settings_targets" -> "대상별 알림"
        "settings_platforms" -> "플랫폼별 알림"
        "settings_event_types" -> "이벤트 타입"
        "settings_hub_events" -> "굿즈/행사"
        "settings_advanced" -> "고급 설정"
        "goods_events" -> "굿즈/행사"
        "goods_event_detail" -> "상세"
        else -> "홈"
    }

    fun topBarRole(screenId: String): String = when (screenId) {
        "live" -> "방송 상태와 실시간 best-effort"
        "history" -> "허용된 알림과 차단된 이벤트"
        "settings" -> "알림 대상과 전송 정책"
        "settings_delivery" -> "알림 전달과 제한"
        "settings_targets" -> "카테고리와 개별 항목"
        "settings_platforms" -> "플랫폼별 허용 여부"
        "settings_event_types" -> "이벤트 종류별 허용 여부"
        "settings_hub_events" -> "공식 출처 굿즈와 행사"
        "settings_advanced" -> "조합 예외 규칙"
        "goods_events" -> "공식 출처의 기간성 굿즈와 행사"
        "goods_event_detail" -> "공식 출처와 일정 정보"
        else -> "라이브 현황과 최근 알림"
    }

    fun topBarTitleStartInsetDp(canGoBack: Boolean): Int =
        if (canGoBack) 0 else ROOT_TOP_BAR_TITLE_START_INSET_DP

    fun realtimeDisclosureLines(): List<String> = NotificationSettingState.REALTIME_DISCLOSURE_LINES

    fun hubEventStatusRank(status: HubEventStatus): Int = when (status) {
        HubEventStatus.CLOSING_SOON -> 0
        HubEventStatus.OPEN -> 1
        HubEventStatus.UPCOMING -> 2
        HubEventStatus.ANNOUNCED -> 3
        HubEventStatus.CANCELLED -> 4
        HubEventStatus.ENDED -> 5
    }

    fun homeStatusSummary(liveCount: Int, recentCount: Int, closingSoonCount: Int): List<StatusSummaryItem> = listOf(
        StatusSummaryItem(liveCount.toString(), "지금 라이브"),
        StatusSummaryItem(recentCount.toString(), "최근 알림"),
        StatusSummaryItem(closingSoonCount.toString(), "마감 임박")
    )

    fun homeSummaryCardsVisible(): Boolean = false

    fun homeHubEventsListAction(closingSoonCount: Int): HomeHubEventsAction =
        if (closingSoonCount > 0) {
            HomeHubEventsAction(
                title = "굿즈/행사 전체 보기",
                body = "진행 중과 예정 항목을 모두 확인합니다.",
                pills = listOf("굿즈/행사", "전체")
            )
        } else {
            HomeHubEventsAction(
                title = "마감 임박 항목 없음",
                body = "전체 굿즈/행사에서 예정과 진행 중 항목을 볼 수 있습니다.",
                pills = listOf("굿즈/행사")
            )
        }

    fun settingsHubRows(
        deliveryMode: String,
        enabledTargets: Int,
        totalTargets: Int,
        enabledPlatforms: Int,
        totalPlatforms: Int,
        enabledEventTypes: Int,
        totalEventTypes: Int,
        hubEventsEnabled: Boolean,
        deadlineSoonEnabled: Boolean
    ): List<SettingsHubRow> = listOf(
        SettingsHubRow(
            screenId = "delivery",
            title = "전달 방식",
            body = "표준, realtime_best_effort, 조용한 시간",
            value = if (deliveryMode == "REALTIME_BEST_EFFORT") "실시간 우선" else "표준"
        ),
        SettingsHubRow(
            screenId = "targets",
            title = "대상별 알림",
            body = "기수, 감자, 기타, 개별 항목",
            value = "$enabledTargets/$totalTargets"
        ),
        SettingsHubRow(
            screenId = "platforms",
            title = "플랫폼별 알림",
            body = "CHZZK, YouTube, X, 굿즈/행사",
            value = "$enabledPlatforms/$totalPlatforms"
        ),
        SettingsHubRow(
            screenId = "event_types",
            title = "이벤트 타입별 알림",
            body = "방송, 업로드, 공식, 굿즈/행사",
            value = "$enabledEventTypes/$totalEventTypes"
        ),
        SettingsHubRow(
            screenId = "hub_events",
            title = "굿즈/행사",
            body = "공식 출처 기준과 제외 대상",
            value = when {
                !hubEventsEnabled -> "꺼짐"
                deadlineSoonEnabled -> "켜짐 · 마감 임박 ON"
                else -> "켜짐"
            }
        ),
        SettingsHubRow(
            screenId = "advanced",
            title = "고급 조합 설정",
            body = "카테고리/개별 항목별 예외 규칙",
            value = "예외 규칙"
        )
    )

    fun settingsEventTypeRows(settings: NotificationSettingState = NotificationSettingState()): List<SettingsPolicyRow> =
        NotificationEventType.entries.map { eventType ->
            SettingsPolicyRow(
                title = eventType.displayName,
                body = settingsEventTypePolicy(eventType),
                checked = settings.eventTypeEnabled[eventType] == true
            )
        }

    fun settingsHubEventRows(hubEventsEnabled: Boolean, deadlineSoonEnabled: Boolean): List<SettingsPolicyRow> = listOf(
        SettingsPolicyRow(
            title = "굿즈/행사 알림",
            body = "공식/멤버/공식 콜라보 출처가 있는 기간성 정보만 포함합니다.",
            checked = hubEventsEnabled
        ),
        SettingsPolicyRow(
            title = "온라인 굿즈",
            body = "한정 예약, 판매 시작, 마감 임박을 포함합니다.",
            checked = hubEventsEnabled
        ),
        SettingsPolicyRow(
            title = "오프라인 행사",
            body = "콘서트, 팝업, 공식 콜라보를 포함합니다.",
            checked = hubEventsEnabled
        ),
        SettingsPolicyRow(
            title = "마감 임박 우선 표시",
            body = "홈과 최근 알림에 우선 배치합니다.",
            checked = deadlineSoonEnabled
        ),
        SettingsPolicyRow(
            title = "변경 알림",
            body = "MVP에서는 기본 OFF입니다.",
            checked = false
        )
    )

    fun settingsPlatformPolicy(platform: NotificationPlatform): String? = when (platform) {
        NotificationPlatform.NAVER_CAFE ->
            "공식 API와 약관을 우선합니다. 무단 수집이나 로그인 쿠키 수집은 사용하지 않습니다."
        NotificationPlatform.HUB_EVENT ->
            "공식 출처가 있는 기간성 굿즈, 티켓, 오프라인 행사만 포함합니다."
        else -> null
    }

    fun settingsPlatformCommonNotice(): String =
        "플랫폼 OFF이면 해당 플랫폼 이벤트 푸시를 차단합니다."

    fun settingsEventTypePolicy(eventType: NotificationEventType): String? = when (eventType) {
        NotificationEventType.CHZZK_CHAT,
        NotificationEventType.YOUTUBE_LIVE_SCHEDULED,
        NotificationEventType.YOUTUBE_LIVE_STARTED,
        NotificationEventType.YOUTUBE_LIVE_ENDED,
        NotificationEventType.OFFICIAL_YOUTUBE_UPLOAD -> null
        NotificationEventType.CAFE_POST -> "무단 수집, 로그인 쿠키 수집, 비공개 접근 우회 없이 공식 경로만 사용합니다."
        NotificationEventType.EVENT_ANNOUNCED -> "공식/멤버/공식 콜라보 출처가 있는 기간성 정보만 포함합니다."
        NotificationEventType.EVENT_SALES_OPEN -> "굿즈, 티켓, 오프라인 행사의 예약/판매 시작 알림입니다."
        NotificationEventType.EVENT_DEADLINE_SOON -> "예약/판매 종료가 가까운 항목을 홈과 알림에 우선 표시합니다."
        NotificationEventType.EVENT_UPDATED -> "굿즈/행사 변경 알림이며 MVP에서는 기본 OFF입니다."
        NotificationEventType.EVENT_CANCELLED -> "공식 출처의 취소 안내만 전송합니다."
        else -> null
    }

    fun settingsEventTypeCommonNotices(): List<String> = listOf(
        "사용자 설정, 조용한 시간, 차단 키워드, rate limit은 계속 적용됩니다.",
        "공식 채널에는 YouTube 라이브 예정/시작/종료를 적용하지 않으며, 공식 YouTube는 업로드 알림만 지원합니다."
    )

    fun hubEventPolicyNotice(): String =
        "대표/강지 이벤트, 팬 주최 이벤트, 루틴 방송/라이브/업로드는 MVP 굿즈/행사 피드에 포함하지 않습니다."

    fun liveStatusText(isLive: Boolean, startedAt: Instant?, now: Instant = Instant.now()): String {
        if (!isLive) return "오프라인"
        if (startedAt == null || startedAt.isAfter(now)) return "방송 중"

        val elapsedMinutes = Duration.between(startedAt, now).toMinutes()
        val hours = elapsedMinutes / 60
        val minutes = elapsedMinutes % 60
        val elapsedText = when {
            elapsedMinutes < 1 -> "방금 시작"
            hours > 0L -> "${hours}시간 ${minutes}분"
            else -> "${minutes}분"
        }
        return "방송 중 · ${elapsedText} 진행 중"
    }
}
