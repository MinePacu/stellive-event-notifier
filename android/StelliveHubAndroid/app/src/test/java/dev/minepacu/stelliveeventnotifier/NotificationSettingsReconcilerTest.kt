package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.KeywordFilterState
import dev.minepacu.stelliveeventnotifier.core.model.NotificationEventType
import dev.minepacu.stelliveeventnotifier.core.model.NotificationPlatform
import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.core.model.QuietHoursState
import dev.minepacu.stelliveeventnotifier.core.network.HubNetworkResult
import dev.minepacu.stelliveeventnotifier.feature.home.PreferenceSyncConflictException
import dev.minepacu.stelliveeventnotifier.feature.home.PreferenceSyncResult
import dev.minepacu.stelliveeventnotifier.feature.home.RemoteNotificationPreferences
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

        assertEquals(snapshot(false, true, true), store.load())
    }

    @Test
    fun toggleDuringInFlightSyncKeepsDirty() = runTest {
        val sent = toggle(globalEnabled = false)
        remote.onPush = { reconciler.saveLocal(sent.copy(serviceAnnouncementsEnabled = false)) }

        reconciler.sync(sent)

        assertEquals(snapshot(false, false, true), store.load())
    }

    @Test
    fun conflictPullsServerRuleAndClearsDirty() = runTest {
        val settings = toggle(globalEnabled = false)
        remote.pushError = PreferenceSyncConflictException()
        remote.fetchResult = HubNetworkResult.Success(RemoteNotificationPreferences(true, false))

        assertEquals(SyncOutcome.CONFLICT, reconciler.sync(settings))

        assertEquals(snapshot(true, false, false), store.load())
    }

    @Test
    fun conflictWithUnreachableServerKeepsDirty() = runTest {
        val settings = toggle(globalEnabled = false)
        remote.pushError = PreferenceSyncConflictException()
        remote.fetchResult = HubNetworkResult.Failure(code = "rate_limited")

        assertEquals(SyncOutcome.CONFLICT, reconciler.sync(settings))

        assertEquals(snapshot(false, true, true), store.load())
    }

    @Test
    fun staleUpdateAdoptsServerRuleAndClearsDirty() = runTest {
        val settings = toggle(globalEnabled = false)
        remote.pushResults += PreferenceSyncResult.ServerNewer(RemoteNotificationPreferences(true, false))

        assertEquals(SyncOutcome.SERVER_APPLIED, reconciler.sync(settings))

        assertEquals(snapshot(true, false, false), store.load())
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

    // Adoption now requires at least one owned scoped rule on the server; a global-only rule triggers a push instead.
    @Test
    fun launchWithCleanStorePullsServerRulesWhenScopedRulesExist() = runTest {
        remote.fetchResult = HubNetworkResult.Success(
            RemoteNotificationPreferences(false, false, generationEnabled = mapOf("gen1" to true)),
        )

        assertEquals(SyncOutcome.SERVER_APPLIED, reconciler.reconcileOnLaunch(base))

        assertEquals(snapshot(false, false, false), store.load())
        assertTrue(remote.pushed.isEmpty())
    }

    @Test
    fun launchWithCleanStoreAndGlobalOnlyServerPushesLocalValuesOnce() = runTest {
        remote.fetchResult = HubNetworkResult.Success(RemoteNotificationPreferences(false, false))

        assertEquals(SyncOutcome.SYNCED, reconciler.reconcileOnLaunch(base))

        assertEquals(listOf(reconciler.effective(base)), remote.pushed)
        assertEquals(snapshot(true, true, false), store.load())
    }

    @Test
    fun launchWithCleanStoreAndEmptyServerPushesLocalValues() = runTest {
        remote.fetchResult = HubNetworkResult.Success(null)

        assertEquals(SyncOutcome.SYNCED, reconciler.reconcileOnLaunch(base))

        assertEquals(listOf(reconciler.effective(base)), remote.pushed)
        assertEquals(snapshot(true, true, false), store.load())
    }

    @Test
    fun launchWithGlobalOnlyServerPushFailureStaysUnchangedLocally() = runTest {
        remote.fetchResult = HubNetworkResult.Success(RemoteNotificationPreferences(false, false))
        remote.pushResults += PreferenceSyncResult.Failed

        assertEquals(SyncOutcome.KEPT_LOCAL, reconciler.reconcileOnLaunch(base))

        assertEquals(snapshot(true, true, false), store.load())
    }

    @Test
    fun launchOfflineKeepsLocalValues() = runTest {
        reconciler.saveLocal(toggle(globalEnabled = false))
        store.markSynced()
        remote.fetchResult = HubNetworkResult.Failure(throwableType = "IOException")

        assertEquals(SyncOutcome.KEPT_LOCAL, reconciler.reconcileOnLaunch(base))

        assertEquals(snapshot(false, true, false), store.load())
    }

    @Test
    fun launchOfflineWithDirtyStoreStaysDirty() = runTest {
        reconciler.saveLocal(toggle(globalEnabled = false))
        remote.pushResults += PreferenceSyncResult.Failed

        assertEquals(SyncOutcome.KEPT_LOCAL, reconciler.reconcileOnLaunch(base))

        assertEquals(snapshot(false, true, true), store.load())
    }

    @Test
    fun missingDeviceIdDoesNothingRemoteAndKeepsDirty() = runTest {
        deviceId = null
        val settings = toggle(globalEnabled = false)

        assertEquals(SyncOutcome.KEPT_LOCAL, reconciler.sync(settings))
        assertEquals(SyncOutcome.KEPT_LOCAL, reconciler.reconcileOnLaunch(base))

        assertTrue(remote.pushed.isEmpty())
        assertEquals(0, remote.fetchCalls)
        assertEquals(snapshot(false, true, true), store.load())
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
        assertEquals(snapshot(false, false, false), store.load())
    }

    @Test
    fun quietHoursChangeStoresValueAndMarksDirty() {
        val quiet = QuietHoursState(enabled = true, start = "22:00", end = "07:30", timezone = "Asia/Tokyo")

        reconciler.saveLocal(reconciler.effective(base).copy(quietHours = quiet))

        assertTrue(store.load().dirty)
        assertEquals(quiet, reconciler.effective(base).quietHours)
    }

    @Test
    fun memberToggleStoresValueAndMarksDirty() {
        val member = base.memberEnabled.keys.first()

        reconciler.saveLocal(reconciler.effective(base).let { it.copy(memberEnabled = it.memberEnabled + (member to false)) })

        assertTrue(store.load().dirty)
        assertEquals(false, reconciler.effective(base).memberEnabled[member])
        assertEquals(base.memberEnabled.keys, reconciler.effective(base).memberEnabled.keys)
    }

    @Test
    fun memberToggleDuringInFlightSyncKeepsDirty() = runTest {
        val member = base.memberEnabled.keys.first()
        val sent = reconciler.effective(base).also(reconciler::saveLocal)
        remote.onPush = { reconciler.saveLocal(sent.copy(memberEnabled = sent.memberEnabled + (member to false))) }

        reconciler.sync(sent)

        assertTrue(store.load().dirty)
    }

    @Test
    fun adoptingServerRulesOverlaysDetailedSettingsAndIgnoresUnknownNames() = runTest {
        val member = base.memberEnabled.keys.first()
        val quiet = QuietHoursState(enabled = true, start = "01:00", end = "02:00", timezone = "Asia/Seoul")
        remote.fetchResult = HubNetworkResult.Success(
            RemoteNotificationPreferences(
                globalEnabled = true,
                serviceAnnouncementsEnabled = true,
                quietHours = quiet,
                keywordFilters = KeywordFilterState("a, b", "spoiler"),
                maxNotificationsPerMinute = 3,
                generationEnabled = mapOf("gen2" to false, "gen99" to false),
                memberEnabled = mapOf(member to false, "unknown-member" to false),
                platformEnabled = mapOf(NotificationPlatform.NAVER_CAFE to true),
                eventTypeEnabled = mapOf(NotificationEventType.EVENT_UPDATED to true),
            ),
        )

        assertEquals(SyncOutcome.SERVER_APPLIED, reconciler.reconcileOnLaunch(base))

        val adopted = reconciler.effective(base)
        assertEquals(quiet, adopted.quietHours)
        assertEquals(KeywordFilterState("a, b", "spoiler"), adopted.keywordFilters)
        assertEquals(3, adopted.rateLimit.maxNotificationsPerMinute)
        assertEquals(base.generationEnabled + ("gen2" to false), adopted.generationEnabled)
        assertEquals(base.memberEnabled + (member to false), adopted.memberEnabled)
        assertEquals(base.platformEnabled + (NotificationPlatform.NAVER_CAFE to true), adopted.platformEnabled)
        assertEquals(base.eventTypeEnabled + (NotificationEventType.EVENT_UPDATED to true), adopted.eventTypeEnabled)
        assertFalse(store.load().dirty)
    }

    // Moved off the launch path (which now pushes for a global-only server) onto the stale-update adoption path.
    @Test
    fun globalOnlyServerRuleLeavesLocalDetailedSettingsUntouched() = runTest {
        val member = base.memberEnabled.keys.first()
        val local = reconciler.effective(base).copy(
            quietHours = QuietHoursState(enabled = true),
            keywordFilters = KeywordFilterState("x", ""),
            memberEnabled = base.memberEnabled + (member to false),
        )
        reconciler.saveLocal(local)
        remote.pushResults += PreferenceSyncResult.ServerNewer(
            RemoteNotificationPreferences(globalEnabled = false, serviceAnnouncementsEnabled = true),
        )

        assertEquals(SyncOutcome.SERVER_APPLIED, reconciler.sync(local))

        assertEquals(local.copy(globalEnabled = false), reconciler.effective(base))
    }

    @Test
    fun legacyStoredToggleKeysStillLoad() {
        val storage = NotificationSettingsStore.InMemoryStorage().apply {
            put(mapOf("global_enabled" to false, "service_announcements_enabled" to false, "dirty" to true))
        }

        assertEquals(snapshot(false, false, true), NotificationSettingsStore(storage).load())
    }

    private fun snapshot(globalEnabled: Boolean, serviceAnnouncementsEnabled: Boolean, dirty: Boolean) =
        NotificationSettingsStore.Snapshot(
            NotificationSettingState(
                globalEnabled = globalEnabled,
                serviceAnnouncementsEnabled = serviceAnnouncementsEnabled,
            ),
            dirty,
        )

    private fun toggle(globalEnabled: Boolean): NotificationSettingState =
        reconciler.effective(base).copy(globalEnabled = globalEnabled).also(reconciler::saveLocal)

    private class FakeRemote : NotificationSettingsReconciler.Remote {
        val pushed = mutableListOf<NotificationSettingState>()
        val pushResults = ArrayDeque<PreferenceSyncResult>()
        var pushError: PreferenceSyncConflictException? = null
        var onPush: () -> Unit = {}
        var fetchResult: HubNetworkResult<RemoteNotificationPreferences?> = HubNetworkResult.Success(null)
        var fetchCalls = 0

        override suspend fun push(settings: NotificationSettingState): PreferenceSyncResult {
            pushed += settings
            onPush()
            pushError?.let { throw it }
            return pushResults.removeFirstOrNull() ?: PreferenceSyncResult.Pushed
        }

        override suspend fun fetchRemote(): HubNetworkResult<RemoteNotificationPreferences?> {
            fetchCalls += 1
            return fetchResult
        }
    }
}
