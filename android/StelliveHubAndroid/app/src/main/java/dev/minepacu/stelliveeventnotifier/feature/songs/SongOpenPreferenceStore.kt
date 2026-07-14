package dev.minepacu.stelliveeventnotifier.feature.songs

import android.content.Context
import dev.minepacu.stelliveeventnotifier.core.datastore.PreferenceKeys

enum class SongOpenTarget(
    val storedValue: String,
    val displayName: String,
) {
    YOUTUBE("youtube", "YouTube"),
    YOUTUBE_MUSIC("youtube_music", "YouTube Music");

    val openButtonLabel: String
        get() = "$displayName\uc5d0\uc11c \uc5f4\uae30"

    companion object {
        fun fromStoredValue(value: String?): SongOpenTarget =
            entries.firstOrNull { it.storedValue == value } ?: YOUTUBE
    }
}

class SongOpenPreferenceStore(
    private val readStoredValue: () -> String?,
    private val writeStoredValue: (String) -> Unit,
) {
    constructor(context: Context) : this(
        readStoredValue = {
            context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
                .getString(PreferenceKeys.SONG_OPEN_TARGET, null)
        },
        writeStoredValue = { value ->
            context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(PreferenceKeys.SONG_OPEN_TARGET, value)
                .apply()
        },
    )

    fun read(): SongOpenTarget = SongOpenTarget.fromStoredValue(readStoredValue())

    fun write(target: SongOpenTarget) {
        writeStoredValue(target.storedValue)
    }

    private companion object {
        const val PREFERENCES_NAME = "hub_preferences"
    }
}
