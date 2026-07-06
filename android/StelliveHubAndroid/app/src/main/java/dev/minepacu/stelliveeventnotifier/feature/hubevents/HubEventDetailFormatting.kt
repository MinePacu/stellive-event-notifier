package dev.minepacu.stelliveeventnotifier.feature.hubevents

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class HubEventDetailRow(
    val label: String,
    val value: String,
)

data class HubEventHeroTag(
    val label: String,
    val tone: HubEventHeroTagTone,
)

enum class HubEventHeroTagTone {
    STATUS,
    CATEGORY,
    PARTICIPATION,
}

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

    fun heroSubtitleLines(event: HubEvent, zoneId: ZoneId = ZoneId.systemDefault()): List<String> {
        val venue = event.venueName?.takeIf { it.isNotBlank() } ?: event.sourceLabel
        val period = periodText(event, zoneId)
        return listOf(venue, period).distinct().filter { it.isNotBlank() }
    }

    fun heroTags(event: HubEvent): List<HubEventHeroTag> =
        listOf(
            HubEventHeroTag(event.status.displayName, HubEventHeroTagTone.STATUS),
            HubEventHeroTag(event.category.displayName, HubEventHeroTagTone.CATEGORY),
            HubEventHeroTag(event.participationMode.displayName, HubEventHeroTagTone.PARTICIPATION),
        ).distinctBy { it.label }

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

    fun linkActionLabel(category: HubEventCategory): String =
        when (category) {
            HubEventCategory.ONLINE_GOODS,
            HubEventCategory.ONLINE_COLLAB -> "구매 링크"
            HubEventCategory.OFFLINE_CONCERT,
            HubEventCategory.TICKETING -> "티켓 링크"
            else -> "예약 링크"
        }

    fun formatDateTime(instant: java.time.Instant, zoneId: ZoneId = ZoneId.systemDefault()): String =
        dateTimeFormatter.format(instant.atZone(zoneId))
}
