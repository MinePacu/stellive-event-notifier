package dev.minepacu.stelliveeventnotifier.feature.settings

import android.content.Context
import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.feature.home.RemoteGlobalPreferences

/**
 * Local copy of the server-synced notification toggles (global on/off and service
 * announcements) plus a [Snapshot.dirty] flag marking a change the server has not
 * acknowledged yet.
 */
class NotificationSettingsStore(
    private val storage: Storage,
) {
    constructor(context: Context) : this(
        SharedPreferencesStorage(
            context.applicationContext.getSharedPreferences("hub_notification_settings", Context.MODE_PRIVATE),
        ),
    )

    data class Snapshot(
        val globalEnabled: Boolean,
        val serviceAnnouncementsEnabled: Boolean,
        val dirty: Boolean,
    )

    fun load(): Snapshot {
        val defaults = NotificationSettingState()
        return Snapshot(
            globalEnabled = storage.getBoolean(KEY_GLOBAL_ENABLED) ?: defaults.globalEnabled,
            serviceAnnouncementsEnabled = storage.getBoolean(KEY_SERVICE_ANNOUNCEMENTS_ENABLED)
                ?: defaults.serviceAnnouncementsEnabled,
            dirty = storage.getBoolean(KEY_DIRTY) ?: false,
        )
    }

    /** Applies the stored toggles on top of [base], which supplies every other setting. */
    fun overlay(base: NotificationSettingState): NotificationSettingState {
        val stored = load()
        return base.copy(
            globalEnabled = stored.globalEnabled,
            serviceAnnouncementsEnabled = stored.serviceAnnouncementsEnabled,
        )
    }

    /** Records a user change that still has to reach the server. */
    fun saveLocalChange(globalEnabled: Boolean, serviceAnnouncementsEnabled: Boolean) {
        storage.putBooleans(
            mapOf(
                KEY_GLOBAL_ENABLED to globalEnabled,
                KEY_SERVICE_ANNOUNCEMENTS_ENABLED to serviceAnnouncementsEnabled,
                KEY_DIRTY to true,
            ),
        )
    }

    /** Clears the dirty flag when the stored state still satisfies [onlyIf]. */
    fun markSynced(onlyIf: (Snapshot) -> Boolean = { true }): Boolean {
        val current = load()
        if (!onlyIf(current)) return false
        storage.putBooleans(mapOf(KEY_DIRTY to false))
        return true
    }

    /** Overwrites the local toggles with the server's and clears the dirty flag when the stored state still satisfies [onlyIf]. */
    fun applyServer(remote: RemoteGlobalPreferences, onlyIf: (Snapshot) -> Boolean = { true }): Boolean {
        if (!onlyIf(load())) return false
        storage.putBooleans(
            mapOf(
                KEY_GLOBAL_ENABLED to remote.globalEnabled,
                KEY_SERVICE_ANNOUNCEMENTS_ENABLED to remote.serviceAnnouncementsEnabled,
                KEY_DIRTY to false,
            ),
        )
        return true
    }

    interface Storage {
        fun getBoolean(key: String): Boolean?
        fun putBooleans(values: Map<String, Boolean>)
    }

    class InMemoryStorage : Storage {
        private val values = mutableMapOf<String, Boolean>()

        override fun getBoolean(key: String): Boolean? = values[key]

        override fun putBooleans(values: Map<String, Boolean>) {
            this.values.putAll(values)
        }
    }

    private class SharedPreferencesStorage(
        private val preferences: android.content.SharedPreferences,
    ) : Storage {
        override fun getBoolean(key: String): Boolean? =
            if (preferences.contains(key)) preferences.getBoolean(key, false) else null

        override fun putBooleans(values: Map<String, Boolean>) {
            preferences.edit().apply { values.forEach { (key, value) -> putBoolean(key, value) } }.apply()
        }
    }

    companion object {
        private const val KEY_GLOBAL_ENABLED = "global_enabled"
        private const val KEY_SERVICE_ANNOUNCEMENTS_ENABLED = "service_announcements_enabled"
        private const val KEY_DIRTY = "dirty"
    }
}
