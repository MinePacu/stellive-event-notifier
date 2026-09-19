package dev.minepacu.stelliveeventnotifier

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.core.model.SongType
import dev.minepacu.stelliveeventnotifier.feature.songs.DataStoreSongDiscoveryRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.Instant

class SongDiscoveryRepositoryTest {
    @Test fun initializesOnlyAuthoritativeCatalogAcknowledgesPageAndRestores() = runTest {
        val file = File.createTempFile("song-discovery", ".preferences_pb").also { it.delete() }
        var scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        var repository = DataStoreSongDiscoveryRepository(PreferenceDataStoreFactory.create(scope = scope, produceFile = { file }))
        val baseline = Instant.parse("2026-07-01T00:00:00Z")
        val first = song("first", "2026-07-02T00:00:00Z")
        val second = song("second", "2026-07-03T00:00:00Z")
        repository.initialize(baseline, listOf(first, second), authoritative = false)
        assertFalse(repository.state.first().initialized)
        repository.initialize(baseline, listOf(first, second), authoritative = true)
        repository.acknowledge(listOf(first), listOf(first, second))
        assertEquals(setOf("youtube:first"), repository.state.first().acknowledgedIds)
        repository.acknowledge(listOf(second), listOf(first, second))
        assertEquals(Instant.parse("2026-07-03T00:00:00Z"), repository.state.first().baselineAt)
        scope.coroutineContext[Job]!!.cancelAndJoin()
        scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        repository = DataStoreSongDiscoveryRepository(PreferenceDataStoreFactory.create(scope = scope, produceFile = { file }))
        assertTrue(repository.state.first().initialized)
        scope.cancel()
        file.delete()
    }

    private fun song(id: String, added: String) = SongCatalogItem(
        id = id, youtubeVideoId = id, title = id, type = SongType.COVER,
        catalogAddedAt = Instant.parse(added),
    )
}
