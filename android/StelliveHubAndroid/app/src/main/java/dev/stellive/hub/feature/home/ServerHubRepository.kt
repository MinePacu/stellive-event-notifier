package dev.stellive.hub.feature.home

import dev.stellive.hub.core.device.DeviceIdStore
import dev.stellive.hub.core.model.HubCalendarDay
import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubCalendarEntryKind
import dev.stellive.hub.core.model.HubCalendarSpecialDayKind
import dev.stellive.hub.core.model.HubEvent
import dev.stellive.hub.core.model.HubEventCategory
import dev.stellive.hub.core.model.HubEventImage
import dev.stellive.hub.core.model.HubEventImagePolicyState
import dev.stellive.hub.core.model.HubEventParticipationMode
import dev.stellive.hub.core.model.HubEventSourceType
import dev.stellive.hub.core.model.HubEventStatus
import dev.stellive.hub.core.model.NotificationSettingState
import dev.stellive.hub.core.model.SongCatalogItem
import dev.stellive.hub.core.model.SongFacetSummary
import dev.stellive.hub.core.model.SongFacets
import dev.stellive.hub.core.model.SongFilterCount
import dev.stellive.hub.core.model.SongListResult
import dev.stellive.hub.core.model.SongMemberSummary
import dev.stellive.hub.core.model.SongThumbnail
import dev.stellive.hub.core.model.SongType
import dev.stellive.hub.core.model.YoutubePremiereMetadata
import dev.stellive.hub.core.network.BootstrapResponseDto
import dev.stellive.hub.core.network.HubCalendarEntryDto
import dev.stellive.hub.core.network.HubCalendarResponseDto
import dev.stellive.hub.core.network.HubEventDto
import dev.stellive.hub.core.network.HubApiClient
import dev.stellive.hub.core.network.HubNetworkResult
import dev.stellive.hub.core.network.LiveStatusDto
import dev.stellive.hub.core.network.MusicCatalogItemDto
import dev.stellive.hub.core.network.MusicListResponseDto
import dev.stellive.hub.core.network.RegisterDeviceRequestDto
import dev.stellive.hub.core.network.RegisterDeviceResponseDto
import dev.stellive.hub.core.network.SongCatalogItemDto
import dev.stellive.hub.core.network.SongFacetsResponseDto
import dev.stellive.hub.core.network.SongFilterCountDto
import dev.stellive.hub.core.network.SongListResponseDto
import dev.stellive.hub.core.network.YoutubePremiereMetadataDto
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val builtInHubEventFilters = setOf("all", "goods", "ticketing", "offline", "closing")

class ServerHubRepository(
    private val remoteDataSource: RemoteDataSource,
    private val deviceIdStore: DeviceIdStore,
    private val fallback: MockHubRepository,
) : HubRepository {
    private companion object {
        const val MUSIC_PAGE_LIMIT = 100
        const val MUSIC_MAX_PAGES = 10
        const val MUSIC_MAX_ITEMS = 1000
    }

    private val eventCache = linkedMapOf<String, HubEvent>()
    private var calendarCache: List<HubCalendarDay> = emptyList()
    private var songCache: SongListResult? = null
    private var songFacetCache: SongFacets? = null

    override suspend fun bootstrap(): HubDataState {
        val deviceId = deviceIdStore.getDeviceId()
        val response = remoteDataSource.bootstrap(deviceId)
        if (response is HubNetworkResult.Success) {
            if (response.value.device == null) {
                registerDevice()
            }
            return fallback.bootstrap().mergeLiveStatus(response.value.liveStatus)
        }
        return fallback.bootstrap().copy(liveStatusSourceLabel = "서버 연결 실패 · 앱 내 목업")
    }

    override suspend fun updatePreferences(settings: NotificationSettingState): HubDataState =
        fallback.updatePreferences(settings)

    override suspend fun hubEvents(filterId: String, from: LocalDate?, to: LocalDate?): List<HubEvent> {
        val response = remoteDataSource.hubEvents(
            generationId = filterId.takeUnless { it in builtInHubEventFilters },
            from = from?.format(DateTimeFormatter.ISO_LOCAL_DATE),
            to = to?.format(DateTimeFormatter.ISO_LOCAL_DATE),
            limit = 100,
        )
        if (response is HubNetworkResult.Success) {
            val events = response.value.items.mapNotNull { it.toHubEventOrNull() }
            if (events.isNotEmpty()) {
                eventCache.clear()
                events.forEach { eventCache[it.id] = it }
                return events
            }
        }
        return eventCache.values.takeIf { it.isNotEmpty() }?.toList() ?: fallback.hubEvents(filterId, from, to)
    }

    override suspend fun hubEventDetail(id: String): HubEvent? {
        val response = remoteDataSource.hubEvent(id)
        if (response is HubNetworkResult.Success) {
            val event = response.value.toHubEventOrNull() ?: return eventCache[id]
            eventCache[id] = event
            return event
        }
        return eventCache[id]
    }

    override suspend fun hubCalendarDays(from: LocalDate, to: LocalDate, timezone: String): List<HubCalendarDay> {
        val response = remoteDataSource.hubEventsCalendar(
            from = from.format(DateTimeFormatter.ISO_LOCAL_DATE),
            to = to.format(DateTimeFormatter.ISO_LOCAL_DATE),
            timezone = timezone,
        )
        if (response is HubNetworkResult.Success) {
            val days = response.value.toCalendarDays()
            calendarCache = days
            return days
        }
        return calendarCache.takeIf { it.isNotEmpty() } ?: fallback.hubCalendarDays(from, to, timezone)
    }

    override suspend fun songs(
        generationId: String?,
        memberId: String?,
        type: String?,
        query: String?,
        cursor: String?,
    ): SongListResult {
        val normalizedType = type?.takeUnless { it == "all" }
        val result = fetchAllMusicPages(memberId = memberId, type = normalizedType)
        if (result != null) {
            songCache = result
            return result
        }
        return songCache ?: fallback.songs(generationId, memberId, type, query, cursor)
    }

    override suspend fun recentSongs(limit: Int): List<SongCatalogItem> {
        return when (
            val result = remoteDataSource.music(
                type = null,
                cursor = null,
                limit = limit,
                sort = "publishedAt_desc",
            )
        ) {
            is HubNetworkResult.Success -> result.value.items.mapNotNull { it.toSongCatalogItemOrNull() }
            is HubNetworkResult.Failure -> MainUiPolicy.recentSongs(
                songCache?.items ?: fallback.songs().items,
                limit,
            )
        }
    }

    private suspend fun fetchAllMusicPages(
        memberId: String?,
        type: String?,
    ): SongListResult? {
        val items = mutableListOf<SongCatalogItem>()
        val seen = linkedSetOf<String>()
        var nextCursor: String? = null
        repeat(MUSIC_MAX_PAGES) {
            val response = if (!memberId.isNullOrBlank() && memberId != "all") {
                remoteDataSource.memberMusic(
                    memberId = memberId,
                    type = type,
                    cursor = nextCursor,
                    limit = MUSIC_PAGE_LIMIT,
                    sort = "publishedAt_desc",
                )
            } else {
                remoteDataSource.music(
                    type = type,
                    cursor = nextCursor,
                    limit = MUSIC_PAGE_LIMIT,
                    sort = "publishedAt_desc",
                )
            }
            if (response !is HubNetworkResult.Success) {
                return if (items.isNotEmpty()) SongListResult(items = items.take(MUSIC_MAX_ITEMS)) else null
            }
            val page = response.value.toSongListResult()
            page.items.forEach { song ->
                val key = song.youtubeVideoId.ifBlank { song.id }
                if (seen.add(key)) items += song
            }
            if (page.nextCursor.isNullOrBlank() || items.size >= MUSIC_MAX_ITEMS) {
                return SongListResult(items = items.take(MUSIC_MAX_ITEMS))
            }
            nextCursor = page.nextCursor
        }
        return SongListResult(items = items.take(MUSIC_MAX_ITEMS))
    }

    override suspend fun songFacets(
        generationId: String?,
        memberId: String?,
        type: String?,
        query: String?,
    ): SongFacets {
        val response = remoteDataSource.songFacets(generationId = generationId, memberId = memberId, type = type, q = query)
        if (response is HubNetworkResult.Success) {
            val facets = response.value.toSongFacets()
            songFacetCache = facets
            return facets
        }
        return songFacetCache ?: fallback.songFacets(generationId, memberId, type, query)
    }

    private suspend fun registerDevice() {
        val response = remoteDataSource.registerDevice(
            RegisterDeviceRequestDto(
                deviceId = deviceIdStore.getDeviceId(),
                platform = "android",
            ),
        )
        if (response is HubNetworkResult.Success) {
            deviceIdStore.saveDeviceId(response.value.deviceId)
        }
    }

    private fun HubDataState.mergeLiveStatus(liveStatus: List<LiveStatusDto>): HubDataState {
        if (liveStatus.isEmpty()) return copy(liveStatusSourceLabel = "서버 연결됨 · 라이브 폴링 꺼짐/데이터 없음")
    val liveStatusByMemberId = liveStatus.associateBy { it.memberId }
    return copy(
        liveStatusSourceLabel = "서버 liveStatus",
        members = members.map { member ->
            val status = liveStatusByMemberId[member.id] ?: return@map member.copy(
                isLive = false,
                liveStartedAt = null,
                liveTitle = null,
                        liveViewerCount = null,
                        livePlatformUrl = null,
                        liveLastCheckedAt = null,
                        channelImageUrl = null,
                    )
                member.copy(
                    isLive = status.isLive,
                liveStartedAt = status.startedAt?.let(::parseInstantOrNull),
                liveTitle = status.title,
                    liveViewerCount = status.viewerCount,
                    livePlatformUrl = status.platformUrl,
                    liveLastCheckedAt = parseInstantOrNull(status.lastCheckedAt),
                    channelImageUrl = status.channelImageUrl,
                )
            }
        )
    }

    private fun parseInstantOrNull(value: String): Instant? =
        runCatching { Instant.parse(value) }.getOrNull()

    private fun HubEventDto.toHubEventOrNull(): HubEvent? {
        val category = category?.toEnum<HubEventCategory>() ?: return null
        val mode = participationMode?.toEnum<HubEventParticipationMode>() ?: return null
        val status = status?.toEnum<HubEventStatus>() ?: return null
        val generationId = generationId ?: return null
        val sourceUrl = sourceUrl ?: return null
        val sourceLabel = sourceLabel ?: return null
        val sourceType = sourceType?.toEnum<HubEventSourceType>() ?: return null
        val updatedAt = updatedAt?.let(::parseInstantOrNull) ?: Instant.EPOCH
        return HubEvent(
            id = id,
            category = category,
            participationMode = mode,
            status = status,
            title = title,
            summary = summary,
            memberId = memberId,
            generationId = generationId,
            sourceUrl = sourceUrl,
            sourceLabel = sourceLabel,
            sourceType = sourceType,
            announcedAt = announcedAt?.let(::parseInstantOrNull),
            startsAt = startsAt?.let(::parseInstantOrNull),
            endsAt = endsAt?.let(::parseInstantOrNull),
            purchaseUrl = purchaseUrl,
            ticketUrl = ticketUrl,
            venueName = venueName,
            venueAddress = venueAddress,
            image = image?.let {
                HubEventImage(
                    policyState = it.policyState.toImagePolicyState(),
                    url = it.url,
                    sourceLabel = it.sourceLabel,
                    sourceUrl = it.sourceUrl,
                    altText = it.altText,
                )
            },
            notificationEligible = notificationEligible,
            updatedAt = updatedAt,
        )
    }

    private fun HubCalendarResponseDto.toCalendarDays(): List<HubCalendarDay> =
        days.map { day -> HubCalendarDay(date = day.date, entries = day.entries.mapNotNull { it.toCalendarEntryOrNull() }) }

private fun SongListResponseDto.toSongListResult(): SongListResult =
    SongListResult(
        items = items.mapNotNull { it.toSongCatalogItemOrNull() },
        nextCursor = nextCursor,
    )

private fun MusicListResponseDto.toSongListResult(): SongListResult =
    SongListResult(
        items = items.mapNotNull { it.toSongCatalogItemOrNull() },
        nextCursor = nextCursor,
    )

private fun MusicCatalogItemDto.toSongCatalogItemOrNull(): SongCatalogItem? {
    val type = SongType.fromApiValue(type) ?: return null
    val publishedAt = publishedAt?.let(::parseInstantOrNull) ?: Instant.EPOCH
    return SongCatalogItem(
        id = id,
        youtubeVideoId = youtubeVideoId,
        title = title,
        type = type,
        publishedAt = publishedAt,
        thumbnailUrl = thumbnailUrl,
        duration = duration,
        durationSeconds = durationSeconds,
        isInstrumental = isInstrumental,
        specialFlags = specialFlags,
        classificationStatus = classificationStatus,
        members = members.map {
            SongMemberSummary(
                id = it.id,
                nameKo = it.nameKo,
                nameEn = it.nameEn,
                role = it.role,
            )
        },
        youtubeUrl = youtubeUrl,
        sourcePlaylistId = sourcePlaylistId,
        premiere = premiere.toYoutubePremiereMetadataOrNull(),
    )
}

private fun SongCatalogItemDto.toSongCatalogItemOrNull(): SongCatalogItem? {
        val type = SongType.fromApiValue(type) ?: return null
        val publishedAt = parseInstantOrNull(publishedAt) ?: return null
        return SongCatalogItem(
            id = id,
            youtubeVideoId = youtubeVideoId,
            title = title,
            memberId = memberId,
            memberName = memberName,
            generationId = generationId,
            generationName = generationName,
            type = type,
            sourceUrl = sourceUrl,
            thumbnail = thumbnail?.let {
                SongThumbnail(url = it.url, width = it.width, height = it.height)
            },
            publishedAt = publishedAt,
            premiere = premiere.toYoutubePremiereMetadataOrNull(),
        )
    }

private fun YoutubePremiereMetadataDto?.toYoutubePremiereMetadataOrNull(): YoutubePremiereMetadata? {
    if (this == null) return null
    return YoutubePremiereMetadata(
        classification = classification,
        state = state,
        scheduledStartAt = scheduledStartAt?.let(::parseInstantOrNull),
        actualStartAt = actualStartAt?.let(::parseInstantOrNull),
        actualEndAt = actualEndAt?.let(::parseInstantOrNull),
    )
}

    private fun SongFacetsResponseDto.toSongFacets(): SongFacets =
        SongFacets(
            summary = SongFacetSummary(
                total = summary.total,
                original = summary.original,
                cover = summary.cover,
            ),
            generationFilters = generationFilters.map { it.toSongFilterCount() },
            memberFilters = memberFilters.map { it.toSongFilterCount() },
            typeFilters = typeFilters.map { it.toSongFilterCount() },
        )

    private fun SongFilterCountDto.toSongFilterCount(): SongFilterCount =
        SongFilterCount(id = id, label = label, generationId = generationId, count = count)

    private fun HubCalendarEntryDto.toCalendarEntryOrNull(): HubCalendarEntry? {
        val kind = entryKind?.toEnum<HubCalendarEntryKind>() ?: HubCalendarEntryKind.HUB_EVENT
        val calendarEventId = eventId ?: if (kind == HubCalendarEntryKind.HUB_EVENT) return null else id
        return HubCalendarEntry(
            id = id,
            eventId = calendarEventId,
            entryKind = kind,
            specialDayKind = specialDayKind?.toEnum<HubCalendarSpecialDayKind>(),
            specialDayLabel = specialDayLabel,
            title = title,
            category = category?.toEnum<HubEventCategory>() ?: HubEventCategory.ONLINE_GOODS,
            status = status?.toEnum<HubEventStatus>() ?: HubEventStatus.ANNOUNCED,
            participationMode = participationMode?.toEnum<HubEventParticipationMode>() ?: HubEventParticipationMode.ONLINE,
            generationId = generationId ?: "official",
            memberId = memberId,
            startsAt = startsAt?.let(::parseInstantOrNull),
            endsAt = endsAt?.let(::parseInstantOrNull),
            displayDate = displayDate,
            displayTimeText = displayTimeText,
            sourceLabel = sourceLabel,
            appDeepLink = appDeepLink.orEmpty(),
            platformUrl = platformUrl,
        )
    }

    private inline fun <reified T : Enum<T>> String.toEnum(): T? =
        runCatching { enumValueOf<T>(replace('-', '_').uppercase(Locale.US)) }.getOrNull()

    private fun String.toImagePolicyState(): HubEventImagePolicyState =
        HubEventImagePolicyState.entries.firstOrNull { it.apiValue == this } ?: HubEventImagePolicyState.VERIFY_REQUIRED

    interface RemoteDataSource {
        suspend fun bootstrap(deviceId: String?): HubNetworkResult<BootstrapResponseDto>
        suspend fun registerDevice(request: RegisterDeviceRequestDto): HubNetworkResult<RegisterDeviceResponseDto>
        suspend fun hubEvents(
            generationId: String? = null,
            from: String? = null,
            to: String? = null,
            limit: Int? = null,
        ): HubNetworkResult<dev.stellive.hub.core.network.HubEventsListResponseDto>
        suspend fun hubEvent(id: String): HubNetworkResult<HubEventDto>
        suspend fun hubEventsCalendar(from: String, to: String, timezone: String): HubNetworkResult<HubCalendarResponseDto>
        suspend fun songs(
            generationId: String? = null,
            memberId: String? = null,
            type: String? = null,
            q: String? = null,
        cursor: String? = null,
        limit: Int? = null,
    ): HubNetworkResult<SongListResponseDto>

    suspend fun music(
        type: String? = null,
        cursor: String? = null,
        limit: Int? = null,
        sort: String? = null,
    ): HubNetworkResult<MusicListResponseDto>

    suspend fun memberMusic(
        memberId: String,
        type: String? = null,
        cursor: String? = null,
        limit: Int? = null,
        sort: String? = null,
    ): HubNetworkResult<MusicListResponseDto>

    suspend fun songFacets(
        generationId: String? = null,
        memberId: String? = null,
            type: String? = null,
            q: String? = null,
        ): HubNetworkResult<SongFacetsResponseDto>
    }

    class HubApiRemoteDataSource(
        private val client: HubApiClient,
    ) : RemoteDataSource {
        override suspend fun bootstrap(deviceId: String?): HubNetworkResult<BootstrapResponseDto> =
            client.bootstrap(deviceId = deviceId)

        override suspend fun registerDevice(
            request: RegisterDeviceRequestDto,
        ): HubNetworkResult<RegisterDeviceResponseDto> = client.registerDevice(request)

    override suspend fun hubEvents(
        generationId: String?,
        from: String?,
        to: String?,
        limit: Int?,
    ): HubNetworkResult<dev.stellive.hub.core.network.HubEventsListResponseDto> =
        client.hubEvents(generationId = generationId, from = from, to = to, limit = limit)

        override suspend fun hubEvent(id: String): HubNetworkResult<HubEventDto> = client.hubEvent(id)

        override suspend fun hubEventsCalendar(
            from: String,
            to: String,
            timezone: String,
        ): HubNetworkResult<HubCalendarResponseDto> = client.hubEventsCalendar(from = from, to = to, timezone = timezone)

    override suspend fun songs(
        generationId: String?,
        memberId: String?,
        type: String?,
        q: String?,
        cursor: String?,
        limit: Int?,
    ): HubNetworkResult<SongListResponseDto> =
        client.songs(generationId = generationId, memberId = memberId, type = type, q = q, cursor = cursor, limit = limit)

    override suspend fun music(
        type: String?,
        cursor: String?,
        limit: Int?,
        sort: String?,
    ): HubNetworkResult<MusicListResponseDto> =
        client.music(type = type, cursor = cursor, limit = limit, sort = sort)

    override suspend fun memberMusic(
        memberId: String,
        type: String?,
        cursor: String?,
        limit: Int?,
        sort: String?,
    ): HubNetworkResult<MusicListResponseDto> =
        client.memberMusic(memberId = memberId, type = type, cursor = cursor, limit = limit, sort = sort)

    override suspend fun songFacets(
        generationId: String?,
            memberId: String?,
            type: String?,
            q: String?,
        ): HubNetworkResult<SongFacetsResponseDto> =
            client.songFacets(generationId = generationId, memberId = memberId, type = type, q = q)
    }
}
