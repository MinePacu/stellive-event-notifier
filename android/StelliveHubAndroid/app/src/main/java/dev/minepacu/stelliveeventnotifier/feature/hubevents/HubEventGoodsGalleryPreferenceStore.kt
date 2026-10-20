package dev.minepacu.stelliveeventnotifier.feature.hubevents

import android.content.Context
import dev.minepacu.stelliveeventnotifier.core.datastore.PreferenceKeys

/**
 * Local-only display preference: whether events that have goods items start with the official MD list gallery
 * expanded. Default false (collapsed). Never sent to the server. Same SharedPreferences pattern as
 * `SongOpenPreferenceStore`.
 */
class HubEventGoodsGalleryPreferenceStore(
    private val readStoredValue: () -> Boolean?,
    private val writeStoredValue: (Boolean) -> Unit,
) {
    constructor(context: Context) : this(
        readStoredValue = {
            context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
                .takeIf { it.contains(PreferenceKeys.GOODS_GALLERY_EXPANDED_BY_DEFAULT) }
                ?.getBoolean(PreferenceKeys.GOODS_GALLERY_EXPANDED_BY_DEFAULT, false)
        },
        writeStoredValue = { value ->
            context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(PreferenceKeys.GOODS_GALLERY_EXPANDED_BY_DEFAULT, value)
                .apply()
        },
    )

    /** Absent means false (collapsed). */
    fun readExpandedByDefault(): Boolean = readStoredValue() ?: false

    fun writeExpandedByDefault(value: Boolean) {
        writeStoredValue(value)
    }

    private companion object {
        const val PREFERENCES_NAME = "hub_preferences"
    }
}
