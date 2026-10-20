package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.feature.settings.DebouncedSettingsSync
import dev.minepacu.stelliveeventnotifier.feature.settings.SETTINGS_SYNC_DEBOUNCE_MS
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class DebouncedSettingsSyncTest {
    @Test
    fun rapidSubmitsSendOnlyTheLastSettingsOnce() = runTest {
        val sent = mutableListOf<NotificationSettingState>()
        val sync = DebouncedSettingsSync(this) { sent += it }
        val first = NotificationSettingState(globalEnabled = false)
        val last = NotificationSettingState(globalEnabled = true, serviceAnnouncementsEnabled = false)

        sync.submit(first)
        advanceTimeBy(SETTINGS_SYNC_DEBOUNCE_MS - 1)
        sync.submit(NotificationSettingState(globalEnabled = true))
        advanceTimeBy(SETTINGS_SYNC_DEBOUNCE_MS - 1)
        sync.submit(last)
        advanceTimeBy(SETTINGS_SYNC_DEBOUNCE_MS - 1)
        runCurrent()
        assertTrue(sent.isEmpty())

        advanceTimeBy(1)
        runCurrent()
        assertEquals(listOf(last), sent)
    }

    @Test
    fun flushSendsPendingSettingsWithoutWaitingAndOnlyOnce() = runTest {
        val sent = mutableListOf<NotificationSettingState>()
        val sync = DebouncedSettingsSync(this) { sent += it }
        val settings = NotificationSettingState(globalEnabled = false)

        sync.submit(settings)
        sync.flush()
        runCurrent()
        assertEquals(listOf(settings), sent)

        advanceTimeBy(SETTINGS_SYNC_DEBOUNCE_MS * 2)
        runCurrent()
        sync.flush()
        runCurrent()
        assertEquals(listOf(settings), sent)
    }

    @Test
    fun submitsSeparatedByMoreThanTheWindowAreSentSeparately() = runTest {
        val sent = mutableListOf<NotificationSettingState>()
        val sync = DebouncedSettingsSync(this) { sent += it }
        val a = NotificationSettingState(globalEnabled = false)
        val b = NotificationSettingState(globalEnabled = true)

        sync.submit(a)
        advanceTimeBy(SETTINGS_SYNC_DEBOUNCE_MS)
        runCurrent()
        sync.submit(b)
        advanceTimeBy(SETTINGS_SYNC_DEBOUNCE_MS)
        runCurrent()

        assertEquals(listOf(a, b), sent)
    }
}
