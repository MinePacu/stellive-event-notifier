package dev.minepacu.stelliveeventnotifier.feature.settings

import android.content.Context
import dev.minepacu.stelliveeventnotifier.core.model.KeywordFilterState
import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.core.model.QuietHoursState
import dev.minepacu.stelliveeventnotifier.core.model.RateLimitState
import dev.minepacu.stelliveeventnotifier.feature.home.RemoteNotificationPreferences

/**
 * Local copy of the server-synced notification settings (global and service-announcement
 * toggles, quiet hours, keyword filters, rate limit and the generation, member, platform and
 * event-type toggles) plus a [Snapshot.dirty] flag marking a change the server has not
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

    /** [settings] is the stored values over the model defaults. */
    data class Snapshot(
        val settings: NotificationSettingState,
        val dirty: Boolean,
    ) {
        val globalEnabled: Boolean get() = settings.globalEnabled
        val serviceAnnouncementsEnabled: Boolean get() = settings.serviceAnnouncementsEnabled
    }

    fun load(): Snapshot = Snapshot(
        settings = overlay(NotificationSettingState()),
        dirty = storage.getBoolean(KEY_DIRTY) ?: false,
    )

    /** Applies the stored values on top of [base], which supplies every other setting and any value never stored. */
    fun overlay(base: NotificationSettingState): NotificationSettingState = base.copy(
        globalEnabled = storage.getBoolean(KEY_GLOBAL_ENABLED) ?: base.globalEnabled,
        serviceAnnouncementsEnabled = storage.getBoolean(KEY_SERVICE_ANNOUNCEMENTS_ENABLED)
            ?: base.serviceAnnouncementsEnabled,
        quietHours = QuietHoursState(
            enabled = storage.getBoolean(KEY_QUIET_ENABLED) ?: base.quietHours.enabled,
            start = storage.getString(KEY_QUIET_START) ?: base.quietHours.start,
            end = storage.getString(KEY_QUIET_END) ?: base.quietHours.end,
            timezone = storage.getString(KEY_QUIET_TIMEZONE) ?: base.quietHours.timezone,
        ),
        keywordFilters = KeywordFilterState(
            allowlistText = storage.getString(KEY_KEYWORD_ALLOWLIST) ?: base.keywordFilters.allowlistText,
            blocklistText = storage.getString(KEY_KEYWORD_BLOCKLIST) ?: base.keywordFilters.blocklistText,
        ),
        rateLimit = RateLimitState(
            storage.getInt(KEY_RATE_LIMIT) ?: base.rateLimit.maxNotificationsPerMinute,
        ),
        generationEnabled = base.generationEnabled.mapValues { (id, value) ->
            storage.getBoolean(PREFIX_GENERATION + id) ?: value
        },
        memberEnabled = base.memberEnabled.mapValues { (id, value) ->
            storage.getBoolean(PREFIX_MEMBER + id) ?: value
        },
        platformEnabled = base.platformEnabled.mapValues { (platform, value) ->
            storage.getBoolean(PREFIX_PLATFORM + platform.wireName) ?: value
        },
        eventTypeEnabled = base.eventTypeEnabled.mapValues { (type, value) ->
            storage.getBoolean(PREFIX_EVENT_TYPE + type.wireName) ?: value
        },
    )

    /** Records a user change that still has to reach the server. */
    fun saveLocalChange(settings: NotificationSettingState) {
        storage.put(
            toValues(settings) +
                settings.generationEnabled.mapKeys { PREFIX_GENERATION + it.key } +
                settings.memberEnabled.mapKeys { PREFIX_MEMBER + it.key } +
                settings.platformEnabled.mapKeys { PREFIX_PLATFORM + it.key.wireName } +
                settings.eventTypeEnabled.mapKeys { PREFIX_EVENT_TYPE + it.key.wireName } +
                (KEY_DIRTY to true),
        )
    }

    /** Clears the dirty flag when the stored state still satisfies [onlyIf]. */
    fun markSynced(onlyIf: (Snapshot) -> Boolean = { true }): Boolean {
        val current = load()
        if (!onlyIf(current)) return false
        storage.put(mapOf(KEY_DIRTY to false))
        return true
    }

    /**
     * Overwrites the local values with those the server holds and clears the dirty flag when the
     * stored state still satisfies [onlyIf]. Values the server lacks (or names this app does not
     * know) keep their local value.
     */
    fun applyServer(remote: RemoteNotificationPreferences, onlyIf: (Snapshot) -> Boolean = { true }): Boolean {
        if (!onlyIf(load())) return false
        val defaults = NotificationSettingState()
        val values = mutableMapOf<String, Any>(
            KEY_GLOBAL_ENABLED to remote.globalEnabled,
            KEY_SERVICE_ANNOUNCEMENTS_ENABLED to remote.serviceAnnouncementsEnabled,
            KEY_DIRTY to false,
        )
        remote.quietHours?.let { values += quietHoursValues(it) }
        remote.keywordFilters?.let { values += keywordValues(it) }
        remote.maxNotificationsPerMinute?.let { values[KEY_RATE_LIMIT] = it }
        remote.generationEnabled.filterKeys { it in defaults.generationEnabled }
            .forEach { (id, enabled) -> values[PREFIX_GENERATION + id] = enabled }
        remote.memberEnabled.filterKeys { it in defaults.memberEnabled }
            .forEach { (id, enabled) -> values[PREFIX_MEMBER + id] = enabled }
        remote.platformEnabled.forEach { (platform, enabled) -> values[PREFIX_PLATFORM + platform.wireName] = enabled }
        remote.eventTypeEnabled.forEach { (type, enabled) -> values[PREFIX_EVENT_TYPE + type.wireName] = enabled }
        storage.put(values)
        return true
    }

    private fun toValues(settings: NotificationSettingState): Map<String, Any> =
        mapOf<String, Any>(
            KEY_GLOBAL_ENABLED to settings.globalEnabled,
            KEY_SERVICE_ANNOUNCEMENTS_ENABLED to settings.serviceAnnouncementsEnabled,
            KEY_RATE_LIMIT to settings.rateLimit.maxNotificationsPerMinute,
        ) + quietHoursValues(settings.quietHours) + keywordValues(settings.keywordFilters)

    private fun quietHoursValues(quietHours: QuietHoursState): Map<String, Any> = mapOf(
        KEY_QUIET_ENABLED to quietHours.enabled,
        KEY_QUIET_START to quietHours.start,
        KEY_QUIET_END to quietHours.end,
        KEY_QUIET_TIMEZONE to quietHours.timezone,
    )

    private fun keywordValues(filters: KeywordFilterState): Map<String, Any> = mapOf(
        KEY_KEYWORD_ALLOWLIST to filters.allowlistText,
        KEY_KEYWORD_BLOCKLIST to filters.blocklistText,
    )

    interface Storage {
        fun getBoolean(key: String): Boolean?
        fun getString(key: String): String?
        fun getInt(key: String): Int?

        /** Values are Boolean, String or Int. */
        fun put(values: Map<String, Any>)
    }

    class InMemoryStorage : Storage {
        private val values = mutableMapOf<String, Any>()

        override fun getBoolean(key: String): Boolean? = values[key] as? Boolean
        override fun getString(key: String): String? = values[key] as? String
        override fun getInt(key: String): Int? = values[key] as? Int

        override fun put(values: Map<String, Any>) {
            this.values.putAll(values)
        }
    }

    private class SharedPreferencesStorage(
        private val preferences: android.content.SharedPreferences,
    ) : Storage {
        override fun getBoolean(key: String): Boolean? =
            if (preferences.contains(key)) preferences.getBoolean(key, false) else null

        override fun getString(key: String): String? = preferences.getString(key, null)

        override fun getInt(key: String): Int? =
            if (preferences.contains(key)) preferences.getInt(key, 0) else null

        override fun put(values: Map<String, Any>) {
            preferences.edit().apply {
                values.forEach { (key, value) ->
                    when (value) {
                        is Boolean -> putBoolean(key, value)
                        is String -> putString(key, value)
                        is Int -> putInt(key, value)
                    }
                }
            }.apply()
        }
    }

    companion object {
        private const val KEY_GLOBAL_ENABLED = "global_enabled"
        private const val KEY_SERVICE_ANNOUNCEMENTS_ENABLED = "service_announcements_enabled"
        private const val KEY_DIRTY = "dirty"
        private const val KEY_QUIET_ENABLED = "quiet_hours_enabled"
        private const val KEY_QUIET_START = "quiet_hours_start"
        private const val KEY_QUIET_END = "quiet_hours_end"
        private const val KEY_QUIET_TIMEZONE = "quiet_hours_timezone"
        private const val KEY_KEYWORD_ALLOWLIST = "keywords_allowlist"
        private const val KEY_KEYWORD_BLOCKLIST = "keywords_blocklist"
        private const val KEY_RATE_LIMIT = "max_notifications_per_minute"
        private const val PREFIX_GENERATION = "generation."
        private const val PREFIX_MEMBER = "member."
        private const val PREFIX_PLATFORM = "platform."
        private const val PREFIX_EVENT_TYPE = "event_type."
    }
}
