package dev.minepacu.stelliveeventnotifier

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import dev.minepacu.stelliveeventnotifier.feature.songs.DataStoreSongFavoritesRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

class SongFavoritesRepositoryTest {
    @Test
    fun toggleDeduplicatesRemovesAndRestoresWhilePreservingUnknownIds() = runTest {
        val file = File.createTempFile("song-favorites", ".preferences_pb").also { it.delete() }
        var scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        var repository = DataStoreSongFavoritesRepository(
            PreferenceDataStoreFactory.create(scope = scope, produceFile = { file }),
        )

        repository.toggle("youtube:video-1")
        repository.toggle("youtube:video-1")
        repository.toggle("youtube:video-1")
        repository.toggle("song:catalog-only")
        repository.toggle("")
        assertEquals(setOf("youtube:video-1", "song:catalog-only"), repository.favorites.first())

        scope.coroutineContext[Job]!!.cancelAndJoin()
        scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        repository = DataStoreSongFavoritesRepository(
            PreferenceDataStoreFactory.create(scope = scope, produceFile = { file }),
        )
        assertEquals(setOf("youtube:video-1", "song:catalog-only"), repository.favorites.first())
        scope.cancel()
        file.delete()
    }
}
