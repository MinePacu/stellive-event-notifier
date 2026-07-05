package dev.minepacu.stelliveeventnotifier.core.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Path
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

    @GET("v1/hub-events")
    suspend fun hubEvents(
        @Query("category") category: String? = null,
        @Query("participationMode") participationMode: String? = null,
        @Query("status") status: String? = null,
        @Query("generationId") generationId: String? = null,
        @Query("memberId") memberId: String? = null,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("limit") limit: Int? = null,
    ): HubEventsListResponseDto

    @GET("v1/hub-events/{id}")
    suspend fun hubEvent(@Path("id") id: String): HubEventDto

    @GET("v1/hub-events/calendar")
    suspend fun hubEventsCalendar(
        @Query("from") from: String,
        @Query("to") to: String,
        @Query("timezone") timezone: String,
    ): HubCalendarResponseDto

    @GET("v1/songs")
    suspend fun songs(
        @Query("generationId") generationId: String? = null,
        @Query("memberId") memberId: String? = null,
        @Query("type") type: String? = null,
        @Query("q") q: String? = null,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int? = null,
    ): SongListResponseDto

    @GET("v1/songs/facets")
    suspend fun songFacets(
        @Query("generationId") generationId: String? = null,
        @Query("memberId") memberId: String? = null,
        @Query("type") type: String? = null,
        @Query("q") q: String? = null,
    ): SongFacetsResponseDto

    @GET("v1/music")
    suspend fun music(
        @Query("type") type: String? = null,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int? = null,
        @Query("sort") sort: String? = null,
    ): MusicListResponseDto

    @GET("v1/members/{id}/music")
    suspend fun memberMusic(
        @Path("id") memberId: String,
        @Query("type") type: String? = null,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int? = null,
        @Query("sort") sort: String? = null,
    ): MusicListResponseDto
}
