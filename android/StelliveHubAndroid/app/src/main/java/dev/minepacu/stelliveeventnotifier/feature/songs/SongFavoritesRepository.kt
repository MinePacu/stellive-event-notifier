package dev.minepacu.stelliveeventnotifier.feature.songs

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

interface SongFavoritesRepository {
    val favorites: Flow<Set<String>>
    suspend fun toggle(identifier: String)
}

private val Context.songFavoritesDataStore: DataStore<Preferences> by preferencesDataStore(
    name = DataStoreSongFavoritesRepository.FILE_NAME,
)

class DataStoreSongFavoritesRepository(
    private val dataStore: DataStore<Preferences>,
) : SongFavoritesRepository {
    constructor(context: Context) : this(context.applicationContext.songFavoritesDataStore)

    override val favorites: Flow<Set<String>> = dataStore.data.map { preferences ->
        preferences[FAVORITES_KEY].orEmpty().filterTo(linkedSetOf(), ::isValidIdentifier)
    }

    override suspend fun toggle(identifier: String) {
        if (!isValidIdentifier(identifier)) return
        dataStore.edit { preferences ->
            val normalized = preferences[FAVORITES_KEY].orEmpty()
                .filterTo(linkedSetOf(), ::isValidIdentifier)
            if (!normalized.add(identifier)) normalized.remove(identifier)
            preferences[FAVORITES_KEY] = normalized
        }
    }

    companion object {
        internal const val FILE_NAME = "song_favorites.preferences_pb"
        internal val FAVORITES_KEY = stringSetPreferencesKey("song_favorite_ids_v1")

        fun isValidIdentifier(value: String): Boolean {
            val prefix = when {
                value.startsWith("youtube:") -> "youtube:"
                value.startsWith("song:") -> "song:"
                else -> return false
            }
            return value.removePrefix(prefix).isNotBlank() && value == value.trim()
        }
    }
}
