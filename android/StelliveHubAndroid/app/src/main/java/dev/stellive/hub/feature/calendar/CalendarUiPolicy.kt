package dev.stellive.hub.feature.calendar

import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubCalendarWidgetSnapshot
import dev.stellive.hub.core.model.HubEventStatus
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter

object CalendarUiPolicy {
    const val staleWidgetText = "최근 동기화 필요"
    const val emptyWidgetText = "예정된 일정 없음"

    private val normalDateFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy.MM.dd")

    private val statusRank = mapOf(
        HubEventStatus.CLOSING_SOON to 0,
        HubEventStatus.OPEN to 1,
        HubEventStatus.UPCOMING to 2,
        HubEventStatus.ANNOUNCED to 3,
        HubEventStatus.CANCELLED to 4,
        HubEventStatus.ENDED to 5
    )

    val entryComparator: Comparator<HubCalendarEntry> = compareBy<HubCalendarEntry>(
        { statusRank[it.status] ?: Int.MAX_VALUE },
        { it.endsAt ?: it.startsAt ?: Instant.MAX },
        { it.title }
    )

    fun statusLabel(status: HubEventStatus): String = when (status) {
        HubEventStatus.ANNOUNCED -> "공개"
        HubEventStatus.UPCOMING -> "예정"
        HubEventStatus.OPEN -> "진행중"
        HubEventStatus.CLOSING_SOON -> "마감 임박"
        HubEventStatus.ENDED -> "종료"
        HubEventStatus.CANCELLED -> "취소"
    }

    fun entryLabel(entry: HubCalendarEntry): String = entry.specialDayLabel ?: statusLabel(entry.status)

    fun dateHeaderText(date: LocalDate, now: LocalDate = LocalDate.now()): String = when (date) {
        now -> "오늘"
        now.plusDays(1) -> "내일"
        else -> normalDateFormatter.format(date)
    }

    fun timeWindowText(entry: HubCalendarEntry): String = entry.displayTimeText

    fun isWidgetSnapshotStale(snapshot: HubCalendarWidgetSnapshot, now: Instant): Boolean =
        !now.isBefore(snapshot.staleAfter)
}
