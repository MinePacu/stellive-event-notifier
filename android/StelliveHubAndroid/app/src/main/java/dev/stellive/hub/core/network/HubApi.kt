package dev.stellive.hub.core.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Query

interface HubApi {
    @GET("v1/bootstrap")
    suspend fun bootstrap(
        @Query("deviceId") deviceId: String?,
        @Query("platform") platform: String = "android",
        @Query("appVersion") appVersion: String? = null,
        @Query("locale") locale: String? = null,
        @Query("timezone") timezone: String? = null,
    ): BootstrapResponseDto

    @POST("v1/devices/register")
    suspend fun registerDevice(@Body request: RegisterDeviceRequestDto): RegisterDeviceResponseDto

    @PUT("v1/devices/token")
    suspend fun updateDeviceToken(@Body request: UpdateDeviceTokenRequestDto): UpdateDeviceTokenResponseDto

    @GET("v1/preferences")
    suspend fun preferences(@Query("deviceId") deviceId: String): PreferencesResponseDto

    @PUT("v1/preferences")
    suspend fun updatePreferences(@Body request: UpdatePreferencesRequestDto): UpdatePreferencesResponseDto
}
