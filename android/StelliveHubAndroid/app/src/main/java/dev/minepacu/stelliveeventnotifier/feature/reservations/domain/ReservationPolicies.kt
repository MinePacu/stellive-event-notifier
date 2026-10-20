package dev.minepacu.stelliveeventnotifier.feature.reservations.domain

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventLinkKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleItem
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.core.model.HubEventTimePrecision
import java.net.URI
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object ReservationActionPolicy {
    fun kindFor(linkKind: HubEventLinkKind, cancelledAt: Instant? = null): ReservationKind? {
        if (cancelledAt != null) return null
        return when (linkKind) {
            HubEventLinkKind.TICKET -> ReservationKind.TICKET
            HubEventLinkKind.PURCHASE -> ReservationKind.PURCHASE
            HubEventLinkKind.RESERVATION -> ReservationKind.RESERVATION
            else -> null
        }
    }
}

data class ReservationURLValidation(
    val normalizedUrl: String?,
    val isSensitive: Boolean,
    val error: String? = null,
) {
    val isValid: Boolean get() = normalizedUrl != null && error == null
}

object ReservationURLPolicy {
    const val MaxLength = 4_096
    private val sensitiveKeys = setOf("token", "auth", "session", "signature", "code")
    private val urlRegex = Regex("https://[^\\s<>\\\"]+", RegexOption.IGNORE_CASE)

    fun validate(rawValue: String?): ReservationURLValidation {
        val value = rawValue?.trim().orEmpty()
        if (value.isEmpty()) return ReservationURLValidation(null, false, "URL을 입력해 주세요.")
        if (value.length > MaxLength) return ReservationURLValidation(null, false, "URL이 너무 깁니다.")
        val uri = runCatching { URI(value) }.getOrNull()
            ?: return ReservationURLValidation(null, false, "올바른 URL이 아닙니다.")
        if (!uri.scheme.equals("https", true) || uri.host.isNullOrBlank()) {
            return ReservationURLValidation(null, false, "HTTPS 주소만 저장할 수 있습니다.")
        }
        val sensitive = uri.rawQuery
            ?.split('&')
            ?.map { it.substringBefore('=').lowercase() }
            ?.any(sensitiveKeys::contains) == true
        return ReservationURLValidation(uri.toASCIIString(), sensitive)
    }

    fun firstHttpsUrl(sharedText: String?): String? = sharedText
        ?.let(urlRegex::find)
        ?.value
        ?.trimEnd('.', ',', ')', ']', '}')
        ?.let(::validate)
        ?.takeIf(ReservationURLValidation::isValid)
        ?.normalizedUrl
}

sealed interface ReservationDraftSelection {
    data object None : ReservationDraftSelection
    data class Selected(val draft: ReservationDraft) : ReservationDraftSelection
    data class Choose(val drafts: List<ReservationDraft>) : ReservationDraftSelection
}

object ReservationDraftPolicy {
    fun active(drafts: List<ReservationDraft>, now: Instant = Instant.now()): List<ReservationDraft> =
        drafts.filter { it.expiresAt.isAfter(now) }.sortedByDescending { it.openedAt }

    fun selection(drafts: List<ReservationDraft>, now: Instant = Instant.now()): ReservationDraftSelection =
        when (val active = active(drafts, now)) {
            emptyList<ReservationDraft>() -> ReservationDraftSelection.None
            else -> if (active.size == 1) ReservationDraftSelection.Selected(active.single()) else ReservationDraftSelection.Choose(active)
        }
}

enum class ReservationDraftExpiryKind {
    HOURS,
    MINUTES,
    SOON,
}

data class ReservationDraftExpiryPresentation(
    val kind: ReservationDraftExpiryKind,
    val value: Int? = null,
)

object ReservationDraftExpiryPresentationPolicy {
    fun presentation(expiresAt: Instant, now: Instant = Instant.now()): ReservationDraftExpiryPresentation? {
        val remainingSeconds = expiresAt.epochSecond - now.epochSecond
        if (remainingSeconds <= 0) return null
        if (remainingSeconds < 120) return ReservationDraftExpiryPresentation(ReservationDraftExpiryKind.SOON)
        val remainingMinutes = (remainingSeconds + 59) / 60
        if (remainingMinutes < 10) {
            return ReservationDraftExpiryPresentation(ReservationDraftExpiryKind.MINUTES, remainingMinutes.toInt())
        }
        if (remainingMinutes < 60) {
            val roundedMinutes = (((remainingMinutes + 4) / 5) * 5).toInt()
            return ReservationDraftExpiryPresentation(ReservationDraftExpiryKind.MINUTES, roundedMinutes)
        }
        val remainingHours = ((remainingSeconds + 3_599) / 3_600).toInt()
        return ReservationDraftExpiryPresentation(ReservationDraftExpiryKind.HOURS, remainingHours)
    }
}

data class ReservationQuickAddPresentation(
    val title: String,
    val screenTitle: ReservationQuickAddScreenTitle,
    val inProgressLabel: String,
    val primaryActionLabel: String,
    val detailLinkLabel: String,
    val expiry: ReservationDraftExpiryPresentation?,
)

enum class ReservationQuickAddScreenTitle {
    GENERIC,
    TICKET,
    PURCHASE,
    RESERVATION,
}

object ReservationQuickAddPresentationPolicy {
    fun presentation(draft: ReservationDraft, now: Instant = Instant.now()): ReservationQuickAddPresentation =
        ReservationQuickAddPresentation(
            title = draft.eventSnapshot.title,
            screenTitle = screenTitle(draft.kind),
            inProgressLabel = ReservationPresentationPolicy.inProgressLabel(draft.kind),
            primaryActionLabel = ReservationPresentationPolicy.addActionLabel(draft.kind),
            detailLinkLabel = ReservationPresentationPolicy.detailLinkLabel(draft.kind),
            expiry = ReservationDraftExpiryPresentationPolicy.presentation(draft.expiresAt, now),
        )

    fun screenTitle(kind: ReservationKind?): ReservationQuickAddScreenTitle = when (kind) {
        null -> ReservationQuickAddScreenTitle.GENERIC
        ReservationKind.TICKET -> ReservationQuickAddScreenTitle.TICKET
        ReservationKind.PURCHASE -> ReservationQuickAddScreenTitle.PURCHASE
        ReservationKind.RESERVATION -> ReservationQuickAddScreenTitle.RESERVATION
    }

    fun isPrimaryActionEnabled(rawUrl: String?): Boolean = ReservationURLPolicy.validate(rawUrl).isValid
}

object ReservationEditStatusPresentationPolicy {
    val displayOrder: List<ReservationStatus> = listOf(
        ReservationStatus.PENDING_CONFIRMATION,
        ReservationStatus.CONFIRMED,
        ReservationStatus.COMPLETED,
        ReservationStatus.CANCELLED,
        ReservationStatus.REFUNDED,
    )
}

data class ReservationScheduleWindow(
    val startsAt: Instant?,
    val endsAt: Instant?,
    val timePrecision: HubEventTimePrecision,
    val timezone: String,
)

object ReservationSchedulePolicy {
    /** Picks the official event window for a reservation snapshot; auxiliary items such as ticket open are never used. */
    fun window(event: HubEvent, scheduleItem: HubEventScheduleItem?): ReservationScheduleWindow? {
        val item = scheduleItem?.takeIf { it.kind == HubEventScheduleKind.MAIN_WINDOW }
            ?: event.scheduleItems.firstOrNull { it.isPrimary && it.cancelledAt == null }
        if (item != null) return ReservationScheduleWindow(item.startsAt, item.endsAt, item.timePrecision, item.timezone)
        if (event.startsAt == null && event.endsAt == null) return null
        return ReservationScheduleWindow(
            event.startsAt,
            event.endsAt,
            HubEventTimePrecision.DATETIME,
            ReservationEventSnapshot.DefaultTimezone,
        )
    }

    fun snapshot(event: HubEvent, scheduleItem: HubEventScheduleItem?, imageUrl: String?): ReservationEventSnapshot {
        val window = window(event, scheduleItem)
        return ReservationEventSnapshot(
            title = event.title,
            category = event.category.name,
            startsAt = window?.startsAt,
            endsAt = window?.endsAt,
            venueName = event.venueName,
            venueAddress = event.venueAddress,
            sourceLabel = event.sourceLabel,
            imageUrl = imageUrl,
            timePrecision = window?.timePrecision ?: HubEventTimePrecision.DATETIME,
            timezone = window?.timezone ?: ReservationEventSnapshot.DefaultTimezone,
        )
    }
}

object ReservationDisplayPolicy {
    fun officialEventChanged(record: ReservationRecord, latestEvent: HubEvent?): Boolean {
        if (latestEvent == null) return false
        val window = ReservationSchedulePolicy.window(latestEvent, linkedScheduleItem(record, latestEvent))
        val snapshot = record.eventSnapshot
        return latestEvent.title != snapshot.title ||
            window?.startsAt != snapshot.startsAt ||
            window?.endsAt != snapshot.endsAt ||
            latestEvent.venueName != snapshot.venueName
    }

    fun officialEventCancelled(record: ReservationRecord, latestEvent: HubEvent?): Boolean {
        if (latestEvent == null) return false
        if (latestEvent.status == HubEventStatus.CANCELLED) return true
        val item = linkedScheduleItem(record, latestEvent)
        return item?.kind == HubEventScheduleKind.MAIN_WINDOW && item.cancelledAt != null
    }

    private fun linkedScheduleItem(record: ReservationRecord, latestEvent: HubEvent): HubEventScheduleItem? =
        record.scheduleItemId?.let { id -> latestEvent.scheduleItems.firstOrNull { it.id == id } }
}

object ReservationDateFormat {
    private val dateOnlyPattern: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy. M. d.")

    /** Date-precision snapshot values are shown without a time, in the snapshot timezone. */
    fun label(instant: Instant, isDateOnly: Boolean, timezone: String, formatDateTime: (Instant) -> String): String =
        if (isDateOnly) dateOnlyPattern.withZone(zone(timezone)).format(instant) else formatDateTime(instant)

    fun zone(timezone: String): ZoneId =
        runCatching { ZoneId.of(timezone) }.getOrElse { ZoneId.of(ReservationEventSnapshot.DefaultTimezone) }
}
