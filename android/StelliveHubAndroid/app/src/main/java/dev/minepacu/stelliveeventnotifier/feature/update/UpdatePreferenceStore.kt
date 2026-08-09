package dev.minepacu.stelliveeventnotifier.feature.update

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.androidUpdateDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "android_updates.preferences_pb",
)

class UpdatePreferenceStore(private val dataStore: DataStore<Preferences>) {
    constructor(context: Context) : this(context.applicationContext.androidUpdateDataStore)

    suspend fun shouldRunAutomaticCheck(nowEpochMillis: Long): Boolean =
        AndroidUpdatePolicy.shouldRunAutomaticCheck(
            lastCheckEpochMillis = dataStore.data.first()[LAST_AUTOMATIC_CHECK_AT],
            nowEpochMillis = nowEpochMillis,
        )

    suspend fun markAutomaticCheck(nowEpochMillis: Long) {
        dataStore.edit { preferences ->
            preferences[LAST_AUTOMATIC_CHECK_AT] = nowEpochMillis
        }
    }

    suspend fun isDismissed(versionCode: Long): Boolean =
        dataStore.data.first()[DISMISSED_VERSION_CODE] == versionCode

    suspend fun dismiss(versionCode: Long) {
        dataStore.edit { preferences ->
            preferences[DISMISSED_VERSION_CODE] = versionCode
        }
    }

    companion object {
        internal val LAST_AUTOMATIC_CHECK_AT = longPreferencesKey("last_automatic_check_at_v1")
        internal val DISMISSED_VERSION_CODE = longPreferencesKey("dismissed_version_code_v1")
    }
}
