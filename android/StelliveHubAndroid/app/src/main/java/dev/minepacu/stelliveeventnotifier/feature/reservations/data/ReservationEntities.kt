package dev.minepacu.stelliveeventnotifier.feature.reservations.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraft
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEventSnapshot
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationLinkSource
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationRecord
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationStatus
import java.time.Instant
import java.util.UUID

@Entity(
    tableName = "reservation_drafts",
    indices = [Index("eventId"), Index("expiresAtEpochMs"), Index("openedAtEpochMs")],
)
data class ReservationDraftEntity(
    @PrimaryKey val sessionId: String,
    val eventId: String,
    val scheduleItemId: String?,
    val kind: String,
    val snapshotTitle: String,
    val snapshotCategory: String,
    val snapshotStartsAtEpochMs: Long?,
    val snapshotEndsAtEpochMs: Long?,
    val snapshotVenueName: String?,
    val snapshotVenueAddress: String?,
    val snapshotSourceLabel: String,
    val snapshotImageUrl: String?,
    val originalActionUrl: String,
    val providerHost: String,
    val openedAtEpochMs: Long,
    val expiresAtEpochMs: Long,
    val attemptCount: Int,
)

@Entity(
    tableName = "reservation_records",
    indices = [Index("status"), Index("eventId"), Index("scheduleItemId"), Index("confirmedAtEpochMs"), Index("effectiveStartsAtEpochMs")],
)
data class ReservationRecordEntity(
    @PrimaryKey val id: String,
    val sourceSessionId: String?,
    val eventId: String?,
    val scheduleItemId: String?,
    val kind: String,
    val status: String,
    val snapshotTitle: String,
    val snapshotCategory: String,
    val snapshotStartsAtEpochMs: Long?,
    val snapshotEndsAtEpochMs: Long?,
    val snapshotVenueName: String?,
    val snapshotVenueAddress: String?,
    val snapshotSourceLabel: String,
    val snapshotImageUrl: String?,
    val originalActionUrl: String?,
    val reservationDetailUrl: String?,
    val providerHistoryUrl: String?,
    val linkSource: String?,
    val displayTitleOverride: String?,
    val startsAtOverrideEpochMs: Long?,
    val endsAtOverrideEpochMs: Long?,
    val venueOverride: String?,
    val optionText: String?,
    val quantity: Int?,
    val referenceNumber: String?,
    val note: String?,
    val openedAtEpochMs: Long?,
    val confirmedAtEpochMs: Long,
    val createdAtEpochMs: Long,
    val updatedAtEpochMs: Long,
    val effectiveStartsAtEpochMs: Long?,
    val schemaVersion: Int,
)

internal fun ReservationDraftEntity.toDomain() = ReservationDraft(
    sessionId = UUID.fromString(sessionId), eventId = eventId, scheduleItemId = scheduleItemId,
    kind = ReservationKind.valueOf(kind), eventSnapshot = snapshot(), originalActionUrl = originalActionUrl,
    providerHost = providerHost, openedAt = Instant.ofEpochMilli(openedAtEpochMs),
    expiresAt = Instant.ofEpochMilli(expiresAtEpochMs), attemptCount = attemptCount,
)

internal fun ReservationRecordEntity.toDomain() = ReservationRecord(
    id = UUID.fromString(id), sourceSessionId = sourceSessionId?.let(UUID::fromString), eventId = eventId,
    scheduleItemId = scheduleItemId, kind = ReservationKind.valueOf(kind), status = ReservationStatus.valueOf(status),
    eventSnapshot = snapshot(), originalActionUrl = originalActionUrl, reservationDetailUrl = reservationDetailUrl,
    providerHistoryUrl = providerHistoryUrl, linkSource = linkSource?.let(ReservationLinkSource::valueOf),
    displayTitleOverride = displayTitleOverride, startsAtOverride = startsAtOverrideEpochMs?.let(Instant::ofEpochMilli),
    endsAtOverride = endsAtOverrideEpochMs?.let(Instant::ofEpochMilli), venueOverride = venueOverride,
    optionText = optionText, quantity = quantity, referenceNumber = referenceNumber, note = note,
    openedAt = openedAtEpochMs?.let(Instant::ofEpochMilli), confirmedAt = Instant.ofEpochMilli(confirmedAtEpochMs),
    createdAt = Instant.ofEpochMilli(createdAtEpochMs), updatedAt = Instant.ofEpochMilli(updatedAtEpochMs), schemaVersion = schemaVersion,
)

private fun ReservationDraftEntity.snapshot() = ReservationEventSnapshot(
    snapshotTitle, snapshotCategory, snapshotStartsAtEpochMs?.let(Instant::ofEpochMilli),
    snapshotEndsAtEpochMs?.let(Instant::ofEpochMilli), snapshotVenueName, snapshotVenueAddress,
    snapshotSourceLabel, snapshotImageUrl,
)

private fun ReservationRecordEntity.snapshot() = ReservationEventSnapshot(
    snapshotTitle, snapshotCategory, snapshotStartsAtEpochMs?.let(Instant::ofEpochMilli),
    snapshotEndsAtEpochMs?.let(Instant::ofEpochMilli), snapshotVenueName, snapshotVenueAddress,
    snapshotSourceLabel, snapshotImageUrl,
)
