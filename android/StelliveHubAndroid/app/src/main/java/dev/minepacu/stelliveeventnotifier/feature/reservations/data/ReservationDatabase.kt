package dev.minepacu.stelliveeventnotifier.feature.reservations.data

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Delete
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Upsert
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow

@Dao
interface ReservationDao {
    @Query("SELECT * FROM reservation_records ORDER BY confirmedAtEpochMs DESC, id ASC")
    fun observeAll(): Flow<List<ReservationRecordEntity>>

    @Query("SELECT * FROM reservation_records WHERE id = :id LIMIT 1")
    suspend fun get(id: String): ReservationRecordEntity?

    @Query("SELECT * FROM reservation_records WHERE sourceSessionId = :sessionId LIMIT 1")
    suspend fun getBySourceSession(sessionId: String): ReservationRecordEntity?

    @Query("SELECT COUNT(*) FROM reservation_records WHERE reservationDetailUrl = :url AND id != :excludingId")
    suspend fun countByDetailUrl(url: String, excludingId: String): Int

    @Query("SELECT * FROM reservation_records WHERE reservationDetailUrl = :url AND id != :excludingId ORDER BY confirmedAtEpochMs DESC LIMIT 1")
    suspend fun findByDetailUrl(url: String, excludingId: String): ReservationRecordEntity?

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
    version = 2,
    exportSchema = true,
)
abstract class ReservationDatabase : RoomDatabase() {
    abstract fun reservationDao(): ReservationDao
    abstract fun reservationDraftDao(): ReservationDraftDao
}

object ReservationMigrations {
    /** v2 adds the snapshot time precision and timezone; existing rows keep NULL and read as datetime/Asia/Seoul. */
    val MIGRATION_1_2 = object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE reservation_drafts ADD COLUMN snapshotTimePrecision TEXT")
            db.execSQL("ALTER TABLE reservation_drafts ADD COLUMN snapshotTimezone TEXT")
            db.execSQL("ALTER TABLE reservation_records ADD COLUMN snapshotTimePrecision TEXT")
            db.execSQL("ALTER TABLE reservation_records ADD COLUMN snapshotTimezone TEXT")
        }
    }
}
