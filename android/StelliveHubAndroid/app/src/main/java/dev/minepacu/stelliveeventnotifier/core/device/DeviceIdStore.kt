package dev.minepacu.stelliveeventnotifier.core.device

import android.content.Context

class DeviceIdStore(
    private val storage: Storage,
) {
    constructor(context: Context) : this(
        SharedPreferencesStorage(
            context.applicationContext.getSharedPreferences("hub_device", Context.MODE_PRIVATE),
        ),
    )

    fun getDeviceId(): String? = storage.getString(KEY_DEVICE_ID)

    fun saveDeviceId(deviceId: String) {
        storage.putString(KEY_DEVICE_ID, deviceId)
    }

    interface Storage {
        fun getString(key: String): String?
        fun putString(key: String, value: String)
    }

    class InMemoryStorage : Storage {
        private val values = mutableMapOf<String, String>()

        override fun getString(key: String): String? = values[key]

        override fun putString(key: String, value: String) {
            values[key] = value
        }
    }

    private class SharedPreferencesStorage(
        private val preferences: android.content.SharedPreferences,
    ) : Storage {
        override fun getString(key: String): String? = preferences.getString(key, null)

        override fun putString(key: String, value: String) {
            preferences.edit().putString(key, value).apply()
        }
    }

    companion object {
        private const val KEY_DEVICE_ID = "device_id"
    }
}
