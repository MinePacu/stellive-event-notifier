package dev.minepacu.stelliveeventnotifier.feature.settings

import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.core.network.HubNetworkResult
import dev.minepacu.stelliveeventnotifier.feature.home.PreferenceSyncConflictException
import dev.minepacu.stelliveeventnotifier.feature.home.PreferenceSyncResult
import dev.minepacu.stelliveeventnotifier.feature.home.RemoteGlobalPreferences

/**
 * Keeps the locally stored global toggles and the server's global preference rule
 * consistent: local changes are marked dirty until the server accepts them, and a
 * clean launch adopts the server's rule.
 */
internal class NotificationSettingsReconciler(
    private val store: NotificationSettingsStore,
    private val remote: Remote,
    private val deviceId: () -> String?,
) {
    interface Remote {
        /** May throw [PreferenceSyncConflictException] after a second consecutive conflict. */
        suspend fun push(settings: NotificationSettingState): PreferenceSyncResult

        /** Success(null) means the server has no global rule yet. */
        suspend fun fetchGlobal(): HubNetworkResult<RemoteGlobalPreferences?>
    }

    enum class SyncOutcome {
        /** The server accepted the local values. */
        SYNCED,

        /** The server's global rule replaced the local values. */
        SERVER_APPLIED,

        /** The local values stay and remain dirty (or were never dirty). */
        KEPT_LOCAL,

        /** Two conflicts in a row; the server's rule was pulled when reachable. */
        CONFLICT,
    }

    fun effective(base: NotificationSettingState): NotificationSettingState = store.overlay(base)

    /** Stores a user change synchronously and marks it as not yet synced. */
    fun saveLocal(settings: NotificationSettingState) {
        store.saveLocalChange(settings.globalEnabled, settings.serviceAnnouncementsEnabled)
    }

    /** Sends [settings] to the server and updates the store with the result. */
    suspend fun sync(settings: NotificationSettingState): SyncOutcome {
        if (deviceId() == null) return SyncOutcome.KEPT_LOCAL
        // A toggle made while the request was in flight must keep its dirty flag.
        val unchanged = { stored: NotificationSettingsStore.Snapshot ->
            stored.globalEnabled == settings.globalEnabled &&
                stored.serviceAnnouncementsEnabled == settings.serviceAnnouncementsEnabled
        }
        val result = try {
            remote.push(settings)
        } catch (_: PreferenceSyncConflictException) {
            (remote.fetchGlobal() as? HubNetworkResult.Success)?.value?.let { store.applyServer(it, unchanged) }
            return SyncOutcome.CONFLICT
        }
        return when (result) {
            PreferenceSyncResult.Pushed -> {
                store.markSynced(unchanged)
                SyncOutcome.SYNCED
            }
            is PreferenceSyncResult.ServerNewer -> {
                val serverRule = result.remote
                if (serverRule == null) {
                    store.markSynced(unchanged)
                    SyncOutcome.KEPT_LOCAL
                } else if (store.applyServer(serverRule, unchanged)) {
                    SyncOutcome.SERVER_APPLIED
                } else {
                    SyncOutcome.KEPT_LOCAL
                }
            }
            PreferenceSyncResult.Failed -> SyncOutcome.KEPT_LOCAL
        }
    }

    /** Pushes unsynced local values, otherwise adopts the server's global rule. */
    suspend fun reconcileOnLaunch(base: NotificationSettingState): SyncOutcome {
        if (deviceId() == null) return SyncOutcome.KEPT_LOCAL
        if (store.load().dirty) return sync(effective(base))
        val serverRule = (remote.fetchGlobal() as? HubNetworkResult.Success)?.value ?: return SyncOutcome.KEPT_LOCAL
        // A toggle made while the request was in flight is dirty and must not be overwritten.
        return if (store.applyServer(serverRule) { !it.dirty }) SyncOutcome.SERVER_APPLIED else SyncOutcome.KEPT_LOCAL
    }
}
