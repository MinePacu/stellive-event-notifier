package dev.minepacu.stelliveeventnotifier.feature.songs

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.Instant

data class SongDiscoveryStateV1(
    val initialized: Boolean = false,
    val baselineAt: Instant? = null,
    val acknowledgedIds: Set<String> = emptySet(),
)

object SongDiscoveryPolicy {
    fun effectiveAddedAt(song: SongCatalogItem): Instant? =
        song.catalogAddedAt ?: song.publishedAt.takeUnless { it == Instant.EPOCH }

    fun isNew(song: SongCatalogItem, state: SongDiscoveryStateV1): Boolean {
        val identifier = SongIdentity.identifier(song) ?: return false
        val addedAt = effectiveAddedAt(song) ?: return false
        val baseline = state.baselineAt ?: return false
        return state.initialized && addedAt > baseline && identifier !in state.acknowledgedIds
    }

    fun fallbackBaseline(catalog: List<SongCatalogItem>): Instant? =
        catalog.mapNotNull(::effectiveAddedAt).maxOrNull()
}

interface SongDiscoveryRepository {
    val state: Flow<SongDiscoveryStateV1>
    suspend fun initialize(serverTime: Instant?, catalog: List<SongCatalogItem>, authoritative: Boolean)
    suspend fun acknowledge(songs: List<SongCatalogItem>, catalog: List<SongCatalogItem>)
}

private val Context.songDiscoveryDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "song_discovery.preferences_pb",
)

class DataStoreSongDiscoveryRepository(private val dataStore: DataStore<Preferences>) : SongDiscoveryRepository {
    constructor(context: Context) : this(context.applicationContext.songDiscoveryDataStore)

    override val state: Flow<SongDiscoveryStateV1> = dataStore.data.map(::decode)

    override suspend fun initialize(serverTime: Instant?, catalog: List<SongCatalogItem>, authoritative: Boolean) {
        if (!authoritative) return
        dataStore.edit { preferences ->
            if (preferences[INITIALIZED] == true) return@edit
            val baseline = serverTime ?: SongDiscoveryPolicy.fallbackBaseline(catalog) ?: return@edit
            preferences[INITIALIZED] = true
            preferences[BASELINE_AT] = baseline.toString()
        }
    }

    override suspend fun acknowledge(songs: List<SongCatalogItem>, catalog: List<SongCatalogItem>) {
        dataStore.edit { preferences ->
            val current = decode(preferences)
            if (!current.initialized) return@edit
            val acknowledged = current.acknowledgedIds.toMutableSet()
            songs.filter { SongDiscoveryPolicy.isNew(it, current) }
                .mapNotNull(SongIdentity::identifier)
                .forEach(acknowledged::add)
            val remaining = catalog.filter { SongDiscoveryPolicy.isNew(it, current.copy(acknowledgedIds = acknowledged)) }
            if (remaining.isEmpty()) {
                val latest = catalog.mapNotNull(SongDiscoveryPolicy::effectiveAddedAt).maxOrNull()
                if (latest != null && (current.baselineAt == null || latest > current.baselineAt)) {
                    preferences[BASELINE_AT] = latest.toString()
                    val catalogIds = catalog.mapNotNull(SongIdentity::identifier).toSet()
                    acknowledged.removeAll(catalogIds)
                }
            }
            preferences[ACKNOWLEDGED_IDS] = acknowledged
        }
    }

    private fun decode(preferences: Preferences) = SongDiscoveryStateV1(
        initialized = preferences[INITIALIZED] == true,
        baselineAt = preferences[BASELINE_AT]?.let { runCatching { Instant.parse(it) }.getOrNull() },
        acknowledgedIds = preferences[ACKNOWLEDGED_IDS].orEmpty().filterTo(linkedSetOf()) {
            (it.startsWith("youtube:") || it.startsWith("song:")) && it.substringAfter(':').isNotBlank()
        },
    )

    companion object {
        private val INITIALIZED = booleanPreferencesKey("song_discovery_v1_initialized")
        private val BASELINE_AT = stringPreferencesKey("song_discovery_v1_baseline_at")
        private val ACKNOWLEDGED_IDS = stringSetPreferencesKey("song_discovery_v1_acknowledged_ids")
    }
}
