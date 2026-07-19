package dev.minepacu.stelliveeventnotifier.feature.hubevents

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleItem
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventTimePrecision
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.net.URI

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

data class HubEventScheduleTimelineItem(
    val schedule: HubEventScheduleItem,
    val timingText: String,
    val stateText: String,
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
            if (showsParentPeriod(event)) {
                add(HubEventDetailRow("시작", event.startsAt?.let { formatDateTime(it, zoneId) } ?: "미정"))
                add(HubEventDetailRow("기간", periodText(event, zoneId)))
            }
            add(HubEventDetailRow("참여 방식", event.participationMode.displayName))
            add(HubEventDetailRow("분류", event.category.displayName))
            add(HubEventDetailRow("출처", event.sourceLabel))
        }

    fun timeline(
        event: HubEvent,
        now: Instant = Instant.now(),
    ): List<HubEventScheduleTimelineItem> =
        event.scheduleItems
            .sortedWith(compareBy<HubEventScheduleItem> { it.startsAt }.thenBy { it.sortOrder }.thenBy { it.id })
            .map { item ->
                val zoneId = runCatching { ZoneId.of(item.timezone) }.getOrDefault(ZoneId.of("Asia/Seoul"))
                HubEventScheduleTimelineItem(
                    schedule = item,
                    timingText = schedulePeriodText(item, zoneId),
                    stateText = scheduleStateText(item, now, zoneId),
                )
            }

    fun activeScheduleItems(event: HubEvent): List<HubEventScheduleItem> =
        event.scheduleItems.filter { it.cancelledAt == null }

    fun hasTimelineSchedule(event: HubEvent): Boolean =
        event.scheduleMode == HubEventScheduleMode.TIMELINE || activeScheduleItems(event).size >= 2

    fun showsParentPeriod(event: HubEvent): Boolean = !hasTimelineSchedule(event)

    fun nextScheduleItem(event: HubEvent, now: Instant = Instant.now()): HubEventScheduleItem? =
        activeScheduleItems(event)
            .filter { it.endsAt?.let { end -> end >= now } ?: (it.startsAt >= now) }
            .minWithOrNull(compareBy<HubEventScheduleItem> { it.startsAt }.thenBy { it.sortOrder }.thenBy { it.id })

    fun scheduleActionUrl(item: HubEventScheduleItem): String? =
        sequenceOf(item.actionUrl, item.sourceUrl)
            .mapNotNull { candidate -> candidate?.trim()?.takeIf(::isHttpsUrl) }
            .firstOrNull()

    fun scheduleActionLabel(kind: HubEventScheduleKind): String = when (kind) {
        HubEventScheduleKind.SALES_OPEN -> "구매/예약 페이지"
        HubEventScheduleKind.TICKET_OPEN -> "티켓 페이지"
        HubEventScheduleKind.CONTENT_REVEAL -> "콘텐츠"
        HubEventScheduleKind.ANNOUNCEMENT -> "공지"
        HubEventScheduleKind.DEADLINE -> "상세 보기"
        HubEventScheduleKind.MAIN_WINDOW,
        HubEventScheduleKind.RELEASE,
        HubEventScheduleKind.CUSTOM -> "상세 보기"
    }

    fun scheduleKindLabel(kind: HubEventScheduleKind): String = when (kind) {
        HubEventScheduleKind.MAIN_WINDOW -> "행사 기간"
        HubEventScheduleKind.ANNOUNCEMENT -> "공지"
        HubEventScheduleKind.SALES_OPEN -> "판매 시작"
        HubEventScheduleKind.TICKET_OPEN -> "예매 시작"
        HubEventScheduleKind.CONTENT_REVEAL -> "콘텐츠 공개"
        HubEventScheduleKind.RELEASE -> "출시"
        HubEventScheduleKind.DEADLINE -> "마감"
        HubEventScheduleKind.CUSTOM -> "일정"
    }

    fun displayTitle(item: HubEventScheduleItem): String =
        item.title?.trim()?.takeIf(String::isNotEmpty)
            ?: item.label.trim().takeIf(String::isNotEmpty)
            ?: scheduleKindLabel(item.kind)

    fun scheduleDescription(item: HubEventScheduleItem): String? =
        item.description?.trim()?.takeIf(String::isNotEmpty)

    private fun isHttpsUrl(value: String): Boolean = runCatching {
        val uri = URI(value)
        uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank()
    }.getOrDefault(false)

    private fun schedulePeriodText(item: HubEventScheduleItem, zoneId: ZoneId): String {
        if (item.timePrecision == HubEventTimePrecision.DATE) {
            val start = item.startsAt.atZone(zoneId).toLocalDate().toString()
            val end = item.endsAt?.atZone(zoneId)?.toLocalDate()?.toString()
            return if (end != null && end != start) "$start - $end" else start
        }
        return item.endsAt?.let { "${formatDateTime(item.startsAt, zoneId)} - ${formatDateTime(it, zoneId)}" }
            ?: formatDateTime(item.startsAt, zoneId)
    }

    private fun scheduleStateText(item: HubEventScheduleItem, now: Instant, zoneId: ZoneId): String {
        if (item.cancelledAt != null) return "취소"
        if (item.timePrecision == HubEventTimePrecision.DATE) {
            val today = now.atZone(zoneId).toLocalDate()
            val start = item.startsAt.atZone(zoneId).toLocalDate()
            val end = item.endsAt?.atZone(zoneId)?.toLocalDate() ?: start
            return when {
                today < start -> "예정"
                today > end -> "완료"
                else -> "진행"
            }
        }
        return when {
            now < item.startsAt -> "예정"
            item.endsAt != null && now < item.endsAt -> "진행"
            item.endsAt == null && now == item.startsAt -> "진행"
            else -> "완료"
        }
    }

    fun heroSubtitleLines(
        event: HubEvent,
        zoneId: ZoneId = ZoneId.systemDefault(),
        now: Instant = Instant.now(),
    ): List<String> {
        val venue = event.venueName?.takeIf { it.isNotBlank() } ?: event.sourceLabel
        val period = if (hasTimelineSchedule(event)) {
            nextScheduleItem(event, now)?.let { item ->
                val itemZone = runCatching { ZoneId.of(item.timezone) }.getOrDefault(zoneId)
                "다음 일정 · ${displayTitle(item)} · ${schedulePeriodText(item, itemZone)}"
            } ?: "예정된 세부 일정이 없습니다."
        } else {
            periodText(event, zoneId)
        }
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
