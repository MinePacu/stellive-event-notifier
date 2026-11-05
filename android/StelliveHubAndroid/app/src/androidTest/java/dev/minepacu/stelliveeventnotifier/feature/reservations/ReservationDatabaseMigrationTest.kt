package dev.minepacu.stelliveeventnotifier.feature.reservations

import android.content.Context
import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.minepacu.stelliveeventnotifier.core.model.HubEventTimePrecision
import dev.minepacu.stelliveeventnotifier.feature.reservations.data.ReservationDatabase
import dev.minepacu.stelliveeventnotifier.feature.reservations.data.ReservationMigrations
import dev.minepacu.stelliveeventnotifier.feature.reservations.data.RoomReservationRepository
import java.util.UUID
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ReservationDatabaseMigrationTest {
    private val databaseName = "reservation-migration-test.db"

    @get:Rule val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        ReservationDatabase::class.java,
    )

    @Test fun migrationFrom1To2KeepsRowsAndReadsMissingPrecisionAsDatetimeInSeoul() = runTest {
        val recordId = UUID.randomUUID().toString()
        val sessionId = UUID.randomUUID().toString()
        helper.createDatabase(databaseName, 1).apply {
            execSQL(
                "INSERT INTO reservation_records (id, kind, status, snapshotTitle, snapshotCategory, " +
                    "snapshotStartsAtEpochMs, snapshotSourceLabel, confirmedAtEpochMs, createdAtEpochMs, " +
                    "updatedAtEpochMs, schemaVersion) VALUES (?, 'TICKET', 'CONFIRMED', '행사', 'OFFLINE', " +
                    "1785571200000, '공식', 1784620800000, 1784620800000, 1784620800000, 1)",
                arrayOf(recordId),
            )
            execSQL(
                "INSERT INTO reservation_drafts (sessionId, eventId, kind, snapshotTitle, snapshotCategory, " +
                    "snapshotSourceLabel, originalActionUrl, providerHost, openedAtEpochMs, expiresAtEpochMs, " +
                    "attemptCount) VALUES (?, 'event', 'TICKET', '행사', 'OFFLINE', '공식', " +
                    "'https://example.com/order', 'example.com', 1784620800000, 4102444800000, 1)",
                arrayOf(sessionId),
            )
            close()
        }

        helper.runMigrationsAndValidate(databaseName, 2, true, ReservationMigrations.MIGRATION_1_2).apply {
            query("SELECT snapshotTimePrecision, snapshotTimezone FROM reservation_records WHERE id = ?", arrayOf(recordId)).use { cursor ->
                assertTrue(cursor.moveToFirst())
                assertTrue(cursor.isNull(0))
                assertTrue(cursor.isNull(1))
            }
            close()
        }

        val database = Room.databaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            ReservationDatabase::class.java,
            databaseName,
        ).addMigrations(ReservationMigrations.MIGRATION_1_2).build()
        try {
            val record = RoomReservationRepository(database).getRecord(UUID.fromString(recordId))
            assertNotNull(record)
            assertEquals("행사", record?.eventSnapshot?.title)
            assertEquals(HubEventTimePrecision.DATETIME, record?.eventSnapshot?.timePrecision)
            assertEquals("Asia/Seoul", record?.eventSnapshot?.timezone)
            assertNotNull(database.reservationDraftDao().get(sessionId))
        } finally {
            database.close()
        }
    }
}
