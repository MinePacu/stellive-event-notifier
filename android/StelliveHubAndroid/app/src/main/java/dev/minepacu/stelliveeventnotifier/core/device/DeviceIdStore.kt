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

    /** Server-issued per-device secret; kept in the same backup-excluded file as the device id. */
    fun getDeviceSecret(): String? = storage.getString(KEY_DEVICE_SECRET)

    fun saveDeviceId(deviceId: String) {
        // A secret belongs to one device id; never carry it over to a different id.
        if (storage.getString(KEY_DEVICE_ID) != deviceId) storage.remove(KEY_DEVICE_SECRET)
        storage.putString(KEY_DEVICE_ID, deviceId)
    }

    fun saveDeviceSecret(secret: String) {
        storage.putString(KEY_DEVICE_SECRET, secret)
    }

    fun clearCredentials() {
        storage.remove(KEY_DEVICE_ID)
        storage.remove(KEY_DEVICE_SECRET)
    }

    interface Storage {
        fun getString(key: String): String?
        fun putString(key: String, value: String)
        fun remove(key: String)
    }

    class InMemoryStorage : Storage {
        private val values = mutableMapOf<String, String>()

        override fun getString(key: String): String? = values[key]

        override fun putString(key: String, value: String) {
            values[key] = value
        }

        override fun remove(key: String) {
            values.remove(key)
        }
    }

    private class SharedPreferencesStorage(
        private val preferences: android.content.SharedPreferences,
    ) : Storage {
        override fun getString(key: String): String? = preferences.getString(key, null)

        override fun putString(key: String, value: String) {
            preferences.edit().putString(key, value).apply()
        }

        override fun remove(key: String) {
            preferences.edit().remove(key).apply()
        }
    }

    companion object {
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_DEVICE_SECRET = "device_secret"
    }
}
