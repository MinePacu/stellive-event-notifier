package dev.minepacu.stelliveeventnotifier.core.network

import okhttp3.OkHttpClient
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
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

    suspend fun hubEvents(
        category: String? = null,
        participationMode: String? = null,
        status: String? = null,
        generationId: String? = null,
        memberId: String? = null,
        from: String? = null,
        to: String? = null,
        limit: Int? = null,
    ): HubNetworkResult<HubEventsListResponseDto> = runCatchingNetwork {
        api.hubEvents(
            category = category,
            participationMode = participationMode,
            status = status,
            generationId = generationId,
            memberId = memberId,
            from = from,
            to = to,
            limit = limit,
        )
    }

    suspend fun hubEvent(id: String): HubNetworkResult<HubEventDto> = runCatchingNetwork {
        api.hubEvent(id)
    }

    suspend fun hubEventsCalendar(
        from: String,
        to: String,
    timezone: String,
    ): HubNetworkResult<HubCalendarResponseDto> = runCatchingNetwork {
        api.hubEventsCalendar(from = from, to = to, timezone = timezone)
    }

    suspend fun songs(
        generationId: String? = null,
        memberId: String? = null,
        type: String? = null,
        q: String? = null,
        cursor: String? = null,
        limit: Int? = null,
    ): HubNetworkResult<SongListResponseDto> = runCatchingNetwork {
        api.songs(
            generationId = generationId,
            memberId = memberId,
            type = type,
            q = q,
            cursor = cursor,
            limit = limit,
        )
    }

    suspend fun songFacets(
        generationId: String? = null,
        memberId: String? = null,
        type: String? = null,
        q: String? = null,
    ): HubNetworkResult<SongFacetsResponseDto> = runCatchingNetwork {
        api.songFacets(generationId = generationId, memberId = memberId, type = type, q = q)
    }

    suspend fun music(
        type: String? = null,
        cursor: String? = null,
        limit: Int? = null,
        sort: String? = "publishedAt_desc",
    ): HubNetworkResult<MusicListResponseDto> =
        runCatchingNetwork { api.music(type = type, cursor = cursor, limit = limit, sort = sort) }

    suspend fun musicDetail(id: String): HubNetworkResult<MusicCatalogItemDto> =
        runCatchingNetwork { api.musicDetail(id) }

    suspend fun memberMusic(
        memberId: String,
        type: String? = null,
        cursor: String? = null,
        limit: Int? = null,
        sort: String? = "publishedAt_desc",
    ): HubNetworkResult<MusicListResponseDto> =
        runCatchingNetwork { api.memberMusic(memberId = memberId, type = type, cursor = cursor, limit = limit, sort = sort) }

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
                .addConverterFactory(MoshiConverterFactory.create(moshi()))
                .build()
            return HubApiClient(retrofit.create(HubApi::class.java))
        }

        fun moshi(): Moshi = Moshi.Builder()
            .addLast(KotlinJsonAdapterFactory())
            .build()
    }
}
