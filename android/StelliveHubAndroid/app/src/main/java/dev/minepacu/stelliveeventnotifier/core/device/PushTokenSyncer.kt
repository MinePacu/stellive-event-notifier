package dev.minepacu.stelliveeventnotifier.core.device

import android.content.Context
import dev.minepacu.stelliveeventnotifier.core.network.HubApiClient
import dev.minepacu.stelliveeventnotifier.core.network.HubNetworkResult
import dev.minepacu.stelliveeventnotifier.core.network.UpdateDeviceTokenRequestDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdateDeviceTokenResponseDto

class PushTokenSyncer(
    private val deviceIdStore: DeviceIdStore,
    private val pendingTokenStore: PendingTokenStore,
    private val tokenApi: TokenApi,
) {
    constructor(
        context: Context,
        apiClient: HubApiClient,
    ) : this(
        deviceIdStore = DeviceIdStore(context),
        pendingTokenStore = SharedPreferencesPendingTokenStore(context),
        tokenApi = object : TokenApi {
            override suspend fun updateDeviceToken(
                request: UpdateDeviceTokenRequestDto,
            ): HubNetworkResult<UpdateDeviceTokenResponseDto> = apiClient.updateDeviceToken(request)
        },
    )

    suspend fun syncToken(token: String) {
        val deviceId = deviceIdStore.getDeviceId()
        if (deviceId == null) {
            pendingTokenStore.savePendingToken(token)
            return
        }
        sendToken(deviceId, token)
    }

    suspend fun flushPendingToken() {
        val token = pendingTokenStore.loadPendingToken() ?: return
        val deviceId = deviceIdStore.getDeviceId() ?: return
        if (sendToken(deviceId, token)) {
            pendingTokenStore.clearPendingToken()
        }
    }

    private suspend fun sendToken(deviceId: String, token: String): Boolean {
        val result = tokenApi.updateDeviceToken(
            UpdateDeviceTokenRequestDto(
                deviceId = deviceId,
                platform = "android",
                provider = "fcm",
                token = token,
            ),
        )
        return result is HubNetworkResult.Success
    }

    interface TokenApi {
        suspend fun updateDeviceToken(
            request: UpdateDeviceTokenRequestDto,
        ): HubNetworkResult<UpdateDeviceTokenResponseDto>
    }

    interface PendingTokenStore {
        fun loadPendingToken(): String?
        fun savePendingToken(token: String)
        fun clearPendingToken()
    }

    class InMemoryPendingTokenStore : PendingTokenStore {
        private var token: String? = null

        override fun loadPendingToken(): String? = token

        override fun savePendingToken(token: String) {
            this.token = token
        }

        override fun clearPendingToken() {
            token = null
        }
    }

    private class SharedPreferencesPendingTokenStore(context: Context) : PendingTokenStore {
        private val preferences = context.applicationContext.getSharedPreferences(
            "hub_push_token",
            Context.MODE_PRIVATE,
        )

        override fun loadPendingToken(): String? = preferences.getString(KEY_PENDING_TOKEN, null)

        override fun savePendingToken(token: String) {
            preferences.edit().putString(KEY_PENDING_TOKEN, token).apply()
        }

        override fun clearPendingToken() {
            preferences.edit().remove(KEY_PENDING_TOKEN).apply()
        }
    }

    companion object {
        private const val KEY_PENDING_TOKEN = "pending_push_token"
    }
}
