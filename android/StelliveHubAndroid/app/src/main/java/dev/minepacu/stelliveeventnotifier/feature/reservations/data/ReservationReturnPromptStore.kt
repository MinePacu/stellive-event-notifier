package dev.minepacu.stelliveeventnotifier.feature.reservations.data

import android.content.Context
import java.time.Instant
import java.util.UUID

/**
 * Survives process death so the return prompt still appears after the user comes back from a
 * browser that outlived this app's process.
 */
class ReservationReturnPromptStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun promptedAt(): Map<UUID, Instant> = preferences.all.mapNotNull { (key, value) ->
        if (!key.startsWith(PROMPTED_PREFIX) || value !is Long) return@mapNotNull null
        val sessionId = runCatching { UUID.fromString(key.removePrefix(PROMPTED_PREFIX)) }.getOrNull()
            ?: return@mapNotNull null
        sessionId to Instant.ofEpochMilli(value)
    }.toMap()

    fun markPrompted(sessionIds: Collection<UUID>, at: Instant) {
        preferences.edit().apply {
            sessionIds.forEach { putLong(PROMPTED_PREFIX + it, at.toEpochMilli()) }
        }.apply()
    }

    fun lastBackgroundedAt(): Instant? =
        if (preferences.contains(LAST_BACKGROUNDED)) Instant.ofEpochMilli(preferences.getLong(LAST_BACKGROUNDED, 0L)) else null

    fun setLastBackgroundedAt(at: Instant) {
        preferences.edit().putLong(LAST_BACKGROUNDED, at.toEpochMilli()).apply()
    }

    /** Drops entries for drafts that no longer exist. */
    fun retainOnly(activeSessionIds: Set<UUID>) {
        val stale = promptedAt().keys - activeSessionIds
        if (stale.isEmpty()) return
        preferences.edit().apply { stale.forEach { remove(PROMPTED_PREFIX + it) } }.apply()
    }

    private companion object {
        const val PREFERENCES = "reservation_return_prompt"
        const val PROMPTED_PREFIX = "prompted_"
        const val LAST_BACKGROUNDED = "last_backgrounded_at"
    }
}
