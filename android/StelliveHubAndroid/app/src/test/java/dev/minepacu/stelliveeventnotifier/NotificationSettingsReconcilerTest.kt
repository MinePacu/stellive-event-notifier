package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.core.network.HubNetworkResult
import dev.minepacu.stelliveeventnotifier.feature.home.PreferenceSyncConflictException
import dev.minepacu.stelliveeventnotifier.feature.home.PreferenceSyncResult
import dev.minepacu.stelliveeventnotifier.feature.home.RemoteGlobalPreferences
import dev.minepacu.stelliveeventnotifier.feature.settings.DebouncedSettingsSync
import dev.minepacu.stelliveeventnotifier.feature.settings.NotificationSettingsReconciler
import dev.minepacu.stelliveeventnotifier.feature.settings.NotificationSettingsReconciler.SyncOutcome
import dev.minepacu.stelliveeventnotifier.feature.settings.NotificationSettingsStore
import dev.minepacu.stelliveeventnotifier.feature.settings.SETTINGS_SYNC_DEBOUNCE_MS
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class NotificationSettingsReconcilerTest {
    private val base = NotificationSettingState()
    private val store = NotificationSettingsStore(NotificationSettingsStore.InMemoryStorage())
    private val remote = FakeRemote()
    private var deviceId: String? = "device-1"
    private val reconciler = NotificationSettingsReconciler(store, remote) { deviceId }

    @Test
    fun toggleStoresValueAndMarksDirty() {
        assertFalse(store.load().dirty)

        reconciler.saveLocal(reconciler.effective(base).copy(globalEnabled = false))

        val stored = store.load()
        assertFalse(stored.globalEnabled)
        assertTrue(stored.serviceAnnouncementsEnabled)
        assertTrue(stored.dirty)
        assertFalse(reconciler.effective(base).globalEnabled)
    }

    @Test
    fun successfulSyncClearsDirty() = runTest {
        val settings = toggle(globalEnabled = false)
        remote.pushResults += PreferenceSyncResult.Pushed

        assertEquals(SyncOutcome.SYNCED, reconciler.sync(settings))

        assertEquals(listOf(settings), remote.pushed)
        assertFalse(store.load().dirty)
        assertFalse(store.load().globalEnabled)
    }

    @Test
    fun failedSyncKeepsLocalValueAndDirty() = runTest {
        val settings = toggle(globalEnabled = false)
        remote.pushResults += PreferenceSyncResult.Failed

        assertEquals(SyncOutcome.KEPT_LOCAL, reconciler.sync(settings))

        assertEquals(NotificationSettingsStore.Snapshot(false, true, true), store.load())
    }

    @Test
    fun toggleDuringInFlightSyncKeepsDirty() = runTest {
        val sent = toggle(globalEnabled = false)
        remote.onPush = { reconciler.saveLocal(sent.copy(serviceAnnouncementsEnabled = false)) }

        reconciler.sync(sent)

        assertEquals(NotificationSettingsStore.Snapshot(false, false, true), store.load())
    }

    @Test
    fun conflictPullsServerRuleAndClearsDirty() = runTest {
        val settings = toggle(globalEnabled = false)
        remote.pushError = PreferenceSyncConflictException()
        remote.fetchResult = HubNetworkResult.Success(RemoteGlobalPreferences(true, false))

        assertEquals(SyncOutcome.CONFLICT, reconciler.sync(settings))

        assertEquals(NotificationSettingsStore.Snapshot(true, false, false), store.load())
    }

    @Test
    fun conflictWithUnreachableServerKeepsDirty() = runTest {
        val settings = toggle(globalEnabled = false)
        remote.pushError = PreferenceSyncConflictException()
        remote.fetchResult = HubNetworkResult.Failure(code = "rate_limited")

        assertEquals(SyncOutcome.CONFLICT, reconciler.sync(settings))

        assertEquals(NotificationSettingsStore.Snapshot(false, true, true), store.load())
    }

    @Test
    fun staleUpdateAdoptsServerRuleAndClearsDirty() = runTest {
        val settings = toggle(globalEnabled = false)
        remote.pushResults += PreferenceSyncResult.ServerNewer(RemoteGlobalPreferences(true, false))

        assertEquals(SyncOutcome.SERVER_APPLIED, reconciler.sync(settings))

        assertEquals(NotificationSettingsStore.Snapshot(true, false, false), store.load())
    }

    @Test
    fun launchWithDirtyStorePushesLocalValues() = runTest {
        val settings = toggle(globalEnabled = false)
        remote.pushResults += PreferenceSyncResult.Pushed

        assertEquals(SyncOutcome.SYNCED, reconciler.reconcileOnLaunch(base))

        assertEquals(listOf(settings), remote.pushed)
        assertEquals(0, remote.fetchCalls)
        assertFalse(store.load().dirty)
    }

    @Test
    fun launchWithCleanStorePullsServerGlobalRule() = runTest {
        remote.fetchResult = HubNetworkResult.Success(RemoteGlobalPreferences(false, false))

        assertEquals(SyncOutcome.SERVER_APPLIED, reconciler.reconcileOnLaunch(base))

        assertEquals(NotificationSettingsStore.Snapshot(false, false, false), store.load())
        assertTrue(remote.pushed.isEmpty())
    }

    @Test
    fun launchWithoutServerGlobalRuleKeepsDefaultsAndSendsNothing() = runTest {
        remote.fetchResult = HubNetworkResult.Success(null)

        assertEquals(SyncOutcome.KEPT_LOCAL, reconciler.reconcileOnLaunch(base))

        assertEquals(NotificationSettingsStore.Snapshot(true, true, false), store.load())
        assertTrue(remote.pushed.isEmpty())
    }

    @Test
    fun launchOfflineKeepsLocalValues() = runTest {
        reconciler.saveLocal(toggle(globalEnabled = false))
        store.markSynced()
        remote.fetchResult = HubNetworkResult.Failure(throwableType = "IOException")

        assertEquals(SyncOutcome.KEPT_LOCAL, reconciler.reconcileOnLaunch(base))

        assertEquals(NotificationSettingsStore.Snapshot(false, true, false), store.load())
    }

    @Test
    fun launchOfflineWithDirtyStoreStaysDirty() = runTest {
        reconciler.saveLocal(toggle(globalEnabled = false))
        remote.pushResults += PreferenceSyncResult.Failed

        assertEquals(SyncOutcome.KEPT_LOCAL, reconciler.reconcileOnLaunch(base))

        assertEquals(NotificationSettingsStore.Snapshot(false, true, true), store.load())
    }

    @Test
    fun missingDeviceIdDoesNothingRemoteAndKeepsDirty() = runTest {
        deviceId = null
        val settings = toggle(globalEnabled = false)

        assertEquals(SyncOutcome.KEPT_LOCAL, reconciler.sync(settings))
        assertEquals(SyncOutcome.KEPT_LOCAL, reconciler.reconcileOnLaunch(base))

        assertTrue(remote.pushed.isEmpty())
        assertEquals(0, remote.fetchCalls)
        assertEquals(NotificationSettingsStore.Snapshot(false, true, true), store.load())
    }

    @Test
    fun quickToggleOfBothSwitchesSendsOnePutWithBothNewValues() = runTest {
        val sync = DebouncedSettingsSync(this) { reconciler.sync(it) }
        remote.pushResults += PreferenceSyncResult.Pushed

        // The UI re-reads the effective state on every click, as the settings screen does.
        val afterGlobal = reconciler.effective(base).copy(globalEnabled = false)
        reconciler.saveLocal(afterGlobal)
        sync.submit(afterGlobal)
        advanceTimeBy(SETTINGS_SYNC_DEBOUNCE_MS / 2)
        val afterAnnouncements = reconciler.effective(base).copy(serviceAnnouncementsEnabled = false)
        reconciler.saveLocal(afterAnnouncements)
        sync.submit(afterAnnouncements)
        advanceTimeBy(SETTINGS_SYNC_DEBOUNCE_MS)
        runCurrent()

        assertEquals(1, remote.pushed.size)
        assertFalse(remote.pushed.single().globalEnabled)
        assertFalse(remote.pushed.single().serviceAnnouncementsEnabled)
        assertEquals(NotificationSettingsStore.Snapshot(false, false, false), store.load())
    }

    private fun toggle(globalEnabled: Boolean): NotificationSettingState =
        reconciler.effective(base).copy(globalEnabled = globalEnabled).also(reconciler::saveLocal)

    private class FakeRemote : NotificationSettingsReconciler.Remote {
        val pushed = mutableListOf<NotificationSettingState>()
        val pushResults = ArrayDeque<PreferenceSyncResult>()
        var pushError: PreferenceSyncConflictException? = null
        var onPush: () -> Unit = {}
        var fetchResult: HubNetworkResult<RemoteGlobalPreferences?> = HubNetworkResult.Success(null)
        var fetchCalls = 0

        override suspend fun push(settings: NotificationSettingState): PreferenceSyncResult {
            pushed += settings
            onPush()
            pushError?.let { throw it }
            return pushResults.removeFirstOrNull() ?: PreferenceSyncResult.Pushed
        }

        override suspend fun fetchGlobal(): HubNetworkResult<RemoteGlobalPreferences?> {
            fetchCalls += 1
            return fetchResult
        }
    }
}
