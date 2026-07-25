package dev.minepacu.stelliveeventnotifier.feature.reservations.domain

import java.time.Instant
import java.util.UUID

enum class ReservationKind { TICKET, PURCHASE, RESERVATION }

enum class ReservationStatus { PENDING_CONFIRMATION, CONFIRMED, CANCELLED, REFUNDED, COMPLETED }

enum class ReservationLinkSource { APP_INPUT, BROWSER_SHARE, SYSTEM_SHORTCUT }

data class ReservationEventSnapshot(
    val title: String,
    val category: String,
    val startsAt: Instant? = null,
    val endsAt: Instant? = null,
    val venueName: String? = null,
    val venueAddress: String? = null,
    val sourceLabel: String,
    val imageUrl: String? = null,
)

data class ReservationDraft(
    val sessionId: UUID,
    val eventId: String,
    val scheduleItemId: String?,
    val kind: ReservationKind,
    val eventSnapshot: ReservationEventSnapshot,
    val originalActionUrl: String,
    val providerHost: String,
    val openedAt: Instant,
    val expiresAt: Instant,
    val attemptCount: Int,
)

data class ReservationRecord(
    val id: UUID,
    val sourceSessionId: UUID?,
    val eventId: String?,
    val scheduleItemId: String?,
    val kind: ReservationKind,
    val status: ReservationStatus,
    val eventSnapshot: ReservationEventSnapshot,
    val originalActionUrl: String?,
    val reservationDetailUrl: String?,
    val providerHistoryUrl: String?,
    val linkSource: ReservationLinkSource?,
    val displayTitleOverride: String?,
    val startsAtOverride: Instant?,
    val endsAtOverride: Instant?,
    val venueOverride: String?,
    val optionText: String?,
    val quantity: Int?,
    val referenceNumber: String?,
    val note: String?,
    val openedAt: Instant?,
    val confirmedAt: Instant,
    val createdAt: Instant,
    val updatedAt: Instant,
    val schemaVersion: Int = 1,
) {
    val displayTitle: String get() = displayTitleOverride?.takeIf(String::isNotBlank) ?: eventSnapshot.title
    val effectiveStartsAt: Instant? get() = startsAtOverride ?: eventSnapshot.startsAt
    val effectiveEndsAt: Instant? get() = endsAtOverride ?: eventSnapshot.endsAt
    val effectiveVenue: String? get() = venueOverride?.takeIf(String::isNotBlank) ?: eventSnapshot.venueName
    val preferredOpenUrl: String? get() = reservationDetailUrl ?: providerHistoryUrl ?: originalActionUrl
}
