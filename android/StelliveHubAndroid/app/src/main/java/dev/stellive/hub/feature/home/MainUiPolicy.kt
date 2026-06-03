package dev.stellive.hub.feature.home

import dev.stellive.hub.core.model.NotificationSettingState
import dev.stellive.hub.core.model.HubEventStatus
import java.time.Duration
import java.time.Instant

data class StatusSummaryItem(
    val value: String,
    val label: String
)

object MainUiPolicy {
    private const val ROOT_TOP_BAR_TITLE_START_INSET_DP = 10

    fun topBarTitle(screenId: String): String = when (screenId) {
        "live" -> "라이브"
        "history" -> "기록"
        "settings" -> "설정"
        "goods_events" -> "굿즈/행사"
        else -> "홈"
    }

    fun topBarRole(screenId: String): String = when (screenId) {
        "live" -> "방송 상태와 실시간 best-effort"
        "history" -> "허용된 알림과 차단된 이벤트"
        "settings" -> "알림 대상과 전송 정책"
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
