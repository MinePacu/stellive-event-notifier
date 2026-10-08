package dev.minepacu.stelliveeventnotifier.feature.settings

import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

internal const val SETTINGS_SYNC_DEBOUNCE_MS = 600L

/**
 * Coalesces rapid settings changes into a single remote sync of the latest state.
 * Each full preference PUT rewrites every rule on the server, so only the last
 * state in a burst is sent.
 */
internal class DebouncedSettingsSync(
    private val scope: CoroutineScope,
    private val debounceMs: Long = SETTINGS_SYNC_DEBOUNCE_MS,
    private val sync: suspend (NotificationSettingState) -> Unit,
) {
    private var job: Job? = null
    private var pending: NotificationSettingState? = null

    fun submit(settings: NotificationSettingState) {
        pending = settings
        job?.cancel()
        job = scope.launch {
            delay(debounceMs)
            sendPending()
        }
    }

    /** Sends a pending change now instead of waiting out the debounce window. */
    fun flush() {
        if (pending == null) return
        job?.cancel()
        job = scope.launch { sendPending() }
    }

    private suspend fun sendPending() {
        val settings = pending ?: return
        pending = null
        sync(settings)
    }
}
