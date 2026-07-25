package dev.minepacu.stelliveeventnotifier.feature.reservations

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import dev.minepacu.stelliveeventnotifier.feature.reservations.data.ReservationDatabase
import dev.minepacu.stelliveeventnotifier.feature.reservations.data.RoomReservationRepository
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEventSnapshot
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationLinkSource
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RoomReservationRepositoryTest {
    private lateinit var database: ReservationDatabase
    private lateinit var repository: RoomReservationRepository

    @Before fun setUp() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            ReservationDatabase::class.java,
        ).allowMainThreadQueries().build()
        repository = RoomReservationRepository(database)
    }

    @After fun tearDown() = database.close()

    @Test fun repeatedOpenReusesDraftAndIncrementsAttempt() = runTest {
        val now = Instant.parse("2026-07-22T00:00:00Z")
        val first = repository.begin("event", null, ReservationKind.TICKET, snapshot(), "https://example.com/order", now)
        val second = repository.begin("event", null, ReservationKind.TICKET, snapshot(), "https://example.com/order", now.plusSeconds(1))

        assertEquals(first.sessionId, second.sessionId)
        assertEquals(2, second.attemptCount)
    }

    @Test fun cleanupRemovesExpiredDraft() = runTest {
        val now = Instant.parse("2026-07-22T00:00:00Z")
        val draft = repository.begin("event", null, ReservationKind.TICKET, snapshot(), "https://example.com/order", now)

        repository.cleanupExpired(now.plus(Duration.ofHours(3)))

        assertNull(database.reservationDraftDao().get(draft.sessionId.toString()))
    }

    @Test fun confirmationAtomicallyMovesDraftAndIsIdempotent() = runTest {
        val now = Instant.parse("2026-07-22T00:00:00Z")
        val draft = repository.begin("event", null, ReservationKind.TICKET, snapshot(), "https://example.com/order", now)

        val first = repository.confirm(draft.sessionId, "https://example.com/detail", ReservationLinkSource.APP_INPUT, now = now)
        val second = repository.confirm(draft.sessionId, "https://example.com/detail", ReservationLinkSource.APP_INPUT, now = now.plusSeconds(1))

        assertEquals(first.id, second.id)
        assertNull(database.reservationDraftDao().get(draft.sessionId.toString()))
        assertTrue(repository.hasReservationDetailUrl("https://example.com/detail"))
        assertEquals(first.id, repository.findReservationByDetailUrl("https://example.com/detail")?.id)
        assertFalse(repository.hasReservationDetailUrl("https://example.com/detail", excludingId = first.id))
        assertNull(repository.findReservationByDetailUrl("https://example.com/detail", excludingId = first.id))
    }

    private fun snapshot() = ReservationEventSnapshot(
        title = "행사",
        category = "TICKETING",
        sourceLabel = "공식",
    )
}
