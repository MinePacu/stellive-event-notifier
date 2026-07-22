package dev.minepacu.stelliveeventnotifier.feature.reservations.data

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Delete
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface ReservationDao {
    @Query("SELECT * FROM reservation_records ORDER BY confirmedAtEpochMs DESC, id ASC")
    fun observeAll(): Flow<List<ReservationRecordEntity>>

    @Query("SELECT * FROM reservation_records WHERE id = :id LIMIT 1")
    suspend fun get(id: String): ReservationRecordEntity?

    @Query("SELECT * FROM reservation_records WHERE sourceSessionId = :sessionId LIMIT 1")
    suspend fun getBySourceSession(sessionId: String): ReservationRecordEntity?

    @Upsert suspend fun upsert(record: ReservationRecordEntity)
    @Delete suspend fun delete(record: ReservationRecordEntity)
}

@Dao
interface ReservationDraftDao {
    @Query("SELECT * FROM reservation_drafts ORDER BY openedAtEpochMs DESC")
    fun observeAll(): Flow<List<ReservationDraftEntity>>

    @Query("SELECT * FROM reservation_drafts WHERE sessionId = :sessionId LIMIT 1")
    suspend fun get(sessionId: String): ReservationDraftEntity?

    @Query("SELECT * FROM reservation_drafts WHERE eventId = :eventId AND ((scheduleItemId IS NULL AND :scheduleItemId IS NULL) OR scheduleItemId = :scheduleItemId) AND originalActionUrl = :url LIMIT 1")
    suspend fun findMatching(eventId: String, scheduleItemId: String?, url: String): ReservationDraftEntity?

    @Upsert suspend fun upsert(draft: ReservationDraftEntity)
    @Delete suspend fun delete(draft: ReservationDraftEntity)
    @Query("DELETE FROM reservation_drafts WHERE expiresAtEpochMs <= :nowEpochMs") suspend fun deleteExpired(nowEpochMs: Long)
}

@Database(
    entities = [ReservationRecordEntity::class, ReservationDraftEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class ReservationDatabase : RoomDatabase() {
    abstract fun reservationDao(): ReservationDao
    abstract fun reservationDraftDao(): ReservationDraftDao
}
