package dev.stellive.hub.core.network

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class HubApiClient(
    private val api: HubApi,
) {
    suspend fun bootstrap(
        deviceId: String?,
        appVersion: String? = null,
        locale: String? = null,
        timezone: String? = null,
    ): HubNetworkResult<BootstrapResponseDto> = runCatchingNetwork {
        api.bootstrap(
            deviceId = deviceId,
            platform = "android",
            appVersion = appVersion,
            locale = locale,
            timezone = timezone,
        )
    }

    suspend fun registerDevice(
        request: RegisterDeviceRequestDto,
    ): HubNetworkResult<RegisterDeviceResponseDto> = runCatchingNetwork {
        api.registerDevice(request)
    }

    suspend fun updateDeviceToken(
        request: UpdateDeviceTokenRequestDto,
    ): HubNetworkResult<UpdateDeviceTokenResponseDto> = runCatchingNetwork {
        api.updateDeviceToken(request)
    }

    suspend fun preferences(deviceId: String): HubNetworkResult<PreferencesResponseDto> = runCatchingNetwork {
        api.preferences(deviceId)
    }

    suspend fun updatePreferences(
        request: UpdatePreferencesRequestDto,
    ): HubNetworkResult<UpdatePreferencesResponseDto> = runCatchingNetwork {
        api.updatePreferences(request)
    }

    private inline fun <T> runCatchingNetwork(block: () -> T): HubNetworkResult<T> =
        try {
            HubNetworkResult.Success(block())
        } catch (throwable: Throwable) {
            HubNetworkResult.Failure(
                code = "network_error",
                throwableType = throwable::class.java.simpleName,
            )
        }

    companion object {
        fun create(
            baseUrl: String,
            okHttpClient: OkHttpClient = OkHttpClient(),
        ): HubApiClient {
            val retrofit = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(okHttpClient)
                .addConverterFactory(MoshiConverterFactory.create())
                .build()
            return HubApiClient(retrofit.create(HubApi::class.java))
        }
    }
}
