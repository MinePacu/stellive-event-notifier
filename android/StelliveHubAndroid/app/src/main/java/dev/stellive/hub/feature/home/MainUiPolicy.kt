package dev.stellive.hub.feature.home

import dev.stellive.hub.core.model.NotificationSettingState
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
        else -> "홈"
    }

    fun topBarRole(screenId: String): String = when (screenId) {
        "live" -> "방송 상태와 실시간 best-effort"
        "history" -> "허용된 알림과 차단된 이벤트"
        "settings" -> "전체, 카테고리, 플랫폼, 이벤트, 조합 설정"
        else -> "활성 멤버와 공식 채널 상태"
    }

    fun topBarTitleStartInsetDp(canGoBack: Boolean): Int =
        if (canGoBack) 0 else ROOT_TOP_BAR_TITLE_START_INSET_DP

    fun realtimeDisclosureLines(): List<String> = NotificationSettingState.REALTIME_DISCLOSURE_LINES

    fun homeStatusSummary(): List<StatusSummaryItem> = listOf(
        StatusSummaryItem("1", "현재 CHZZK 방송 중"),
        StatusSummaryItem("OFF", "upcoming 기본 알림"),
        StatusSummaryItem("2", "공식 채널 이벤트 타입"),
        StatusSummaryItem("0", "공식 YouTube 라이브 알림")
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
