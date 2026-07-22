package dev.minepacu.stelliveeventnotifier.feature.reservations.data

import androidx.room.withTransaction
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraft
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEventSnapshot
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationLinkSource
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationRecord
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationStatus
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationURLPolicy
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

@Singleton
class RoomReservationRepository @Inject constructor(
    private val database: ReservationDatabase,
) {
    val drafts: Flow<List<ReservationDraft>> = database.reservationDraftDao().observeAll().map { rows -> rows.map(ReservationDraftEntity::toDomain) }
    val records: Flow<List<ReservationRecord>> = database.reservationDao().observeAll().map { rows -> rows.map(ReservationRecordEntity::toDomain) }

    suspend fun begin(
        eventId: String,
        scheduleItemId: String?,
        kind: ReservationKind,
        snapshot: ReservationEventSnapshot,
        originalActionUrl: String,
        now: Instant = Instant.now(),
    ): ReservationDraft {
        val normalizedUrl = requireNotNull(ReservationURLPolicy.validate(originalActionUrl).normalizedUrl)
        val dao = database.reservationDraftDao()
        dao.deleteExpired(now.toEpochMilli())
        val existing = dao.findMatching(eventId, scheduleItemId, normalizedUrl)
        val entity = ReservationDraftEntity(
            sessionId = existing?.sessionId ?: UUID.randomUUID().toString(),
            eventId = eventId,
            scheduleItemId = scheduleItemId,
            kind = kind.name,
            snapshotTitle = snapshot.title,
            snapshotCategory = snapshot.category,
            snapshotStartsAtEpochMs = snapshot.startsAt?.toEpochMilli(),
            snapshotEndsAtEpochMs = snapshot.endsAt?.toEpochMilli(),
            snapshotVenueName = snapshot.venueName,
            snapshotVenueAddress = snapshot.venueAddress,
            snapshotSourceLabel = snapshot.sourceLabel,
            snapshotImageUrl = snapshot.imageUrl,
            originalActionUrl = normalizedUrl,
            providerHost = URI(normalizedUrl).host,
            openedAtEpochMs = now.toEpochMilli(),
            expiresAtEpochMs = now.plus(Duration.ofHours(2)).toEpochMilli(),
            attemptCount = (existing?.attemptCount ?: 0) + 1,
        )
        dao.upsert(entity)
        return entity.toDomain()
    }

    suspend fun confirm(
        sessionId: UUID,
        detailUrl: String?,
        linkSource: ReservationLinkSource,
        allowSensitiveUrl: Boolean = false,
        now: Instant = Instant.now(),
    ): ReservationRecord {
        val validation = detailUrl?.takeIf(String::isNotBlank)?.let(ReservationURLPolicy::validate)
        require(validation == null || validation.isValid) { validation?.error ?: "invalid_reservation_url" }
        require(validation?.isSensitive != true || allowSensitiveUrl) { "sensitive_reservation_url_confirmation_required" }
        return database.withTransaction {
            database.reservationDao().getBySourceSession(sessionId.toString())?.let { return@withTransaction it.toDomain() }
            val draftEntity = requireNotNull(database.reservationDraftDao().get(sessionId.toString())) { "reservation_draft_not_found" }
            val draft = draftEntity.toDomain()
            val record = ReservationRecordEntity(
                id = UUID.randomUUID().toString(), sourceSessionId = draft.sessionId.toString(), eventId = draft.eventId,
                scheduleItemId = draft.scheduleItemId, kind = draft.kind.name, status = ReservationStatus.CONFIRMED.name,
                snapshotTitle = draft.eventSnapshot.title, snapshotCategory = draft.eventSnapshot.category,
                snapshotStartsAtEpochMs = draft.eventSnapshot.startsAt?.toEpochMilli(), snapshotEndsAtEpochMs = draft.eventSnapshot.endsAt?.toEpochMilli(),
                snapshotVenueName = draft.eventSnapshot.venueName, snapshotVenueAddress = draft.eventSnapshot.venueAddress,
                snapshotSourceLabel = draft.eventSnapshot.sourceLabel, snapshotImageUrl = draft.eventSnapshot.imageUrl,
                originalActionUrl = draft.originalActionUrl, reservationDetailUrl = validation?.normalizedUrl,
                providerHistoryUrl = null, linkSource = linkSource.name, displayTitleOverride = null,
                startsAtOverrideEpochMs = null, endsAtOverrideEpochMs = null, venueOverride = null,
                optionText = null, quantity = null, referenceNumber = null, note = null,
                openedAtEpochMs = draft.openedAt.toEpochMilli(), confirmedAtEpochMs = now.toEpochMilli(),
                createdAtEpochMs = now.toEpochMilli(), updatedAtEpochMs = now.toEpochMilli(),
                effectiveStartsAtEpochMs = draft.eventSnapshot.startsAt?.toEpochMilli(), schemaVersion = 1,
            )
            database.reservationDao().upsert(record)
            database.reservationDraftDao().delete(draftEntity)
            record.toDomain()
        }
    }

    suspend fun getRecord(id: UUID): ReservationRecord? = database.reservationDao().get(id.toString())?.toDomain()

    suspend fun hasReservationDetailUrl(url: String, excludingId: UUID? = null): Boolean =
        database.reservationDao().countByDetailUrl(url, excludingId?.toString().orEmpty()) > 0

    suspend fun update(record: ReservationRecord) {
        database.reservationDao().upsert(record.toEntity())
    }

    suspend fun delete(record: ReservationRecord) {
        database.reservationDao().delete(record.toEntity())
    }

    suspend fun deleteDraft(draft: ReservationDraft) {
        database.reservationDraftDao().get(draft.sessionId.toString())?.let { database.reservationDraftDao().delete(it) }
    }

    suspend fun cleanupExpired(now: Instant = Instant.now()) {
        database.reservationDraftDao().deleteExpired(now.toEpochMilli())
    }
}

private fun ReservationRecord.toEntity() = ReservationRecordEntity(
    id = id.toString(), sourceSessionId = sourceSessionId?.toString(), eventId = eventId, scheduleItemId = scheduleItemId,
    kind = kind.name, status = status.name, snapshotTitle = eventSnapshot.title, snapshotCategory = eventSnapshot.category,
    snapshotStartsAtEpochMs = eventSnapshot.startsAt?.toEpochMilli(), snapshotEndsAtEpochMs = eventSnapshot.endsAt?.toEpochMilli(),
    snapshotVenueName = eventSnapshot.venueName, snapshotVenueAddress = eventSnapshot.venueAddress,
    snapshotSourceLabel = eventSnapshot.sourceLabel, snapshotImageUrl = eventSnapshot.imageUrl,
    originalActionUrl = originalActionUrl, reservationDetailUrl = reservationDetailUrl, providerHistoryUrl = providerHistoryUrl,
    linkSource = linkSource?.name, displayTitleOverride = displayTitleOverride, startsAtOverrideEpochMs = startsAtOverride?.toEpochMilli(),
    endsAtOverrideEpochMs = endsAtOverride?.toEpochMilli(), venueOverride = venueOverride, optionText = optionText,
    quantity = quantity, referenceNumber = referenceNumber, note = note, openedAtEpochMs = openedAt?.toEpochMilli(),
    confirmedAtEpochMs = confirmedAt.toEpochMilli(), createdAtEpochMs = createdAt.toEpochMilli(), updatedAtEpochMs = updatedAt.toEpochMilli(),
    effectiveStartsAtEpochMs = effectiveStartsAt?.toEpochMilli(), schemaVersion = schemaVersion,
)
