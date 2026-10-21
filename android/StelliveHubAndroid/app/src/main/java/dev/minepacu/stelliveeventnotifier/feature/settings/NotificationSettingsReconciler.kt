package dev.minepacu.stelliveeventnotifier.feature.settings

import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.core.network.HubNetworkResult
import dev.minepacu.stelliveeventnotifier.feature.home.PreferenceSyncConflictException
import dev.minepacu.stelliveeventnotifier.feature.home.PreferenceSyncResult
import dev.minepacu.stelliveeventnotifier.feature.home.RemoteNotificationPreferences

/**
 * Keeps the locally stored notification settings and the server's client-owned preference
 * rules consistent: local changes are marked dirty until the server accepts them, and a
 * clean launch adopts the server's rules.
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
        suspend fun fetchRemote(): HubNetworkResult<RemoteNotificationPreferences?>
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
        store.saveLocalChange(settings)
    }

    /** Sends [settings] to the server and updates the store with the result. */
    suspend fun sync(settings: NotificationSettingState): SyncOutcome {
        if (deviceId() == null) return SyncOutcome.KEPT_LOCAL
        // A toggle made while the request was in flight must keep its dirty flag.
        val unchanged = { stored: NotificationSettingsStore.Snapshot -> stored.settings.syncedFields() == settings.syncedFields() }
        val result = try {
            remote.push(settings)
        } catch (_: PreferenceSyncConflictException) {
            (remote.fetchRemote() as? HubNetworkResult.Success)?.value?.let { store.applyServer(it, unchanged) }
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

    /**
     * Pushes unsynced local values; otherwise adopts the server's rules, except when the server holds
     * no generation/member/platform/event-type rule yet (old app build or new device), where the
     * local values are pushed once instead.
     */
    suspend fun reconcileOnLaunch(base: NotificationSettingState): SyncOutcome {
        if (deviceId() == null) return SyncOutcome.KEPT_LOCAL
        if (store.load().dirty) return sync(effective(base))
        val fetched = remote.fetchRemote() as? HubNetworkResult.Success ?: return SyncOutcome.KEPT_LOCAL
        val serverRule = fetched.value
        if (serverRule == null || !serverRule.hasOwnedScopedRules) return sync(effective(base))
        // A toggle made while the request was in flight is dirty and must not be overwritten.
        return if (store.applyServer(serverRule) { !it.dirty }) SyncOutcome.SERVER_APPLIED else SyncOutcome.KEPT_LOCAL
    }
}

private fun NotificationSettingState.syncedFields() = listOf(
    globalEnabled, serviceAnnouncementsEnabled, quietHours, keywordFilters, rateLimit,
    generationEnabled, memberEnabled, platformEnabled, eventTypeEnabled,
)
