package dev.minepacu.stelliveeventnotifier.feature.announcements

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncement
import dev.minepacu.stelliveeventnotifier.core.model.AnnouncementSummaryItem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.Instant

private val Context.announcementReadDataStore: DataStore<Preferences> by preferencesDataStore(name = "announcement_reads.preferences_pb")

class AnnouncementReadStore(private val dataStore: DataStore<Preferences>) {
    constructor(context: Context) : this(context.applicationContext.announcementReadDataStore)

    val readKeys: Flow<Set<String>> = dataStore.data.map { it[READ_KEYS].orEmpty() }

    suspend fun markRead(announcement: ServiceAnnouncement) {
        dataStore.edit { preferences ->
            preferences[READ_KEYS] = preferences[READ_KEYS].orEmpty() + AnnouncementPolicy.readKey(announcement.id, announcement.attentionRevision)
        }
    }

    suspend fun initialize(items: List<ServiceAnnouncement>, now: Instant = Instant.now()) {
        dataStore.edit { preferences ->
            if (preferences[FIRST_SYNC_AT] != null) return@edit
            preferences[FIRST_SYNC_AT] = now.toEpochMilli()
            preferences[READ_KEYS] = preferences[READ_KEYS].orEmpty() + AnnouncementPolicy.initialReadKeys(items, now)
        }
    }

    suspend fun initializeSummary(items: List<AnnouncementSummaryItem>, now: Instant = Instant.now()) {
        dataStore.edit { preferences ->
            if (preferences[FIRST_SYNC_AT] != null) return@edit
            preferences[FIRST_SYNC_AT] = now.toEpochMilli()
            preferences[READ_KEYS] = preferences[READ_KEYS].orEmpty() + AnnouncementPolicy.initialSummaryReadKeys(items, now)
        }
    }

    suspend fun prune(activeItems: List<ServiceAnnouncement>) {
        val activeIds = activeItems.mapTo(hashSetOf()) { it.id }
        dataStore.edit { preferences ->
            preferences[READ_KEYS] = preferences[READ_KEYS].orEmpty().filterTo(linkedSetOf()) { key -> key.substringBefore(':') in activeIds }
        }
    }

    companion object {
        internal val READ_KEYS = stringSetPreferencesKey("announcement_read_keys_v1")
        internal val FIRST_SYNC_AT = longPreferencesKey("announcement_first_sync_at_v1")
    }
}
