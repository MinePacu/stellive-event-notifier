package dev.stellive.hub.feature.hubevents

import dev.stellive.hub.core.model.HubEvent
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class HubEventDetailRow(
    val label: String,
    val value: String,
)

object HubEventDetailFormatting {
    const val SummaryLabel = "핵심 안내"
    const val NoticeText = "일정, 장소, 판매/입장 조건은 공식 공지 변경에 따라 달라질 수 있습니다. 앱은 확인용 요약만 제공하므로 참여 전 반드시 출처 링크에서 최신 공지를 확인하세요."

    private val dateTimeFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("yyyy.MM.dd (E) HH:mm", Locale.KOREAN)

    fun rows(event: HubEvent, zoneId: ZoneId = ZoneId.systemDefault()): List<HubEventDetailRow> =
        buildList {
            event.venueName?.takeIf { it.isNotBlank() }?.let {
                add(HubEventDetailRow("장소", it))
            }
            add(HubEventDetailRow("시작", event.startsAt?.let { formatDateTime(it, zoneId) } ?: "미정"))
            add(HubEventDetailRow("기간", periodText(event, zoneId)))
            add(HubEventDetailRow("참여 방식", event.participationMode.displayName))
            add(HubEventDetailRow("분류", event.category.displayName))
            add(HubEventDetailRow("출처", event.sourceLabel))
        }

    fun periodText(event: HubEvent, zoneId: ZoneId = ZoneId.systemDefault()): String {
        val startsAt = event.startsAt
        val endsAt = event.endsAt
        return when {
            startsAt != null && endsAt != null ->
                "${formatDateTime(startsAt, zoneId)} - ${formatDateTime(endsAt, zoneId)}"
            startsAt != null -> "${formatDateTime(startsAt, zoneId)} 시작"
            else -> "미정"
        }
    }

    fun formatDateTime(instant: java.time.Instant, zoneId: ZoneId = ZoneId.systemDefault()): String =
        dateTimeFormatter.format(instant.atZone(zoneId))
}
