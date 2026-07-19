package dev.minepacu.stelliveeventnotifier.feature.home

import dev.minepacu.stelliveeventnotifier.BuildConfig
import dev.minepacu.stelliveeventnotifier.core.device.DeviceIdStore
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarDay
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntry
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntryKind
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarSpecialDayKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventImage
import dev.minepacu.stelliveeventnotifier.core.model.HubEventImagePolicyState
import dev.minepacu.stelliveeventnotifier.core.model.HubEventParticipationMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleItem
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventSourceType
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.core.model.HubEventTimePrecision
import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.core.model.AnnouncementSummaryItem
import dev.minepacu.stelliveeventnotifier.core.model.AnnouncementsSummary
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncement
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncementListResult
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncementSeverity
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncementType
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.core.model.SongFacetSummary
import dev.minepacu.stelliveeventnotifier.core.model.SongFacets
import dev.minepacu.stelliveeventnotifier.core.model.SongFilterCount
import dev.minepacu.stelliveeventnotifier.core.model.SongListResult
import dev.minepacu.stelliveeventnotifier.core.model.SongMemberSummary
import dev.minepacu.stelliveeventnotifier.core.model.SongSourcePlaylist
import dev.minepacu.stelliveeventnotifier.core.model.SongThumbnail
import dev.minepacu.stelliveeventnotifier.core.model.SongType
import dev.minepacu.stelliveeventnotifier.core.model.YoutubePremiereMetadata
import dev.minepacu.stelliveeventnotifier.core.network.BootstrapResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.ServiceAnnouncementDto
import dev.minepacu.stelliveeventnotifier.core.network.ServiceAnnouncementListResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.HubCalendarEntryDto
import dev.minepacu.stelliveeventnotifier.core.network.HubCalendarResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.HubEventDto
import dev.minepacu.stelliveeventnotifier.core.network.HubApiClient
import dev.minepacu.stelliveeventnotifier.core.network.HubNetworkResult
import dev.minepacu.stelliveeventnotifier.core.network.LiveStatusDto
import dev.minepacu.stelliveeventnotifier.core.network.MemberDto
import dev.minepacu.stelliveeventnotifier.core.network.MusicCatalogItemDto
import dev.minepacu.stelliveeventnotifier.core.network.MusicListResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.PreferenceDto
import dev.minepacu.stelliveeventnotifier.core.network.PreferencesResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.RegisterDeviceRequestDto
import dev.minepacu.stelliveeventnotifier.core.network.RegisterDeviceResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdatePreferencesRequestDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdatePreferencesResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.SongCatalogItemDto
import dev.minepacu.stelliveeventnotifier.core.network.SongFacetsResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.SongFilterCountDto
import dev.minepacu.stelliveeventnotifier.core.network.SongListResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.YoutubePremiereMetadataDto
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

private val builtInHubEventFilters = setOf("all", "goods", "ticketing", "offline", "closing")

class ServerHubRepository(
    private val remoteDataSource: RemoteDataSource,
    private val deviceIdStore: DeviceIdStore,
    private val fallback: MockHubRepository,
    private val flushPendingPushToken: suspend () -> Unit = {},
) : HubRepository {
    private companion object {
        const val MUSIC_PAGE_LIMIT = 100
        const val MUSIC_MAX_PAGES = 10
        const val MUSIC_MAX_ITEMS = 1000
    }

    private val eventCache = linkedMapOf<String, HubEvent>()
    private var calendarCache: List<HubCalendarDay> = emptyList()
    private var songCache: SongListResult? = null
    private val songDetailCache = linkedMapOf<String, SongCatalogItem>()
    private var songFacetCache: SongFacets? = null

    override suspend fun bootstrap(): HubDataState {
        val deviceId = deviceIdStore.getDeviceId()
        val response = remoteDataSource.bootstrap(deviceId)
        if (response is HubNetworkResult.Success) {
            if (response.value.device == null) {
                registerDevice()
            }
            return fallback.bootstrap()
                .mergeCatalogProfileImages(response.value.effectiveCatalog.members)
                .mergeLiveStatus(response.value.liveStatus)
                .copy(announcementsSummary = response.value.announcementsSummary?.toModel() ?: AnnouncementsSummary())
        }
        return fallback.bootstrap().copy(liveStatusSourceLabel = "서버 연결 실패 · 앱 내 목업")
    }

    override suspend fun updatePreferences(settings: NotificationSettingState): HubDataState {
        val deviceId = deviceIdStore.getDeviceId()
        if (deviceId != null) {
            val current = remoteDataSource.preferences(deviceId)
            if (current is HubNetworkResult.Success) {
                val updatedAt = Instant.now().toString()
                val preserved = current.value.preferences.filterNot { it.scope == "global" }
                remoteDataSource.updatePreferences(
                    UpdatePreferencesRequestDto(
                        deviceId = deviceId,
                        preferences = preserved + PreferenceDto(
                            deviceId = deviceId,
                            scope = "global",
                            enabled = settings.globalEnabled,
                            explicitOverride = true,
                            tapAction = settings.tapAction.name.lowercase(Locale.US),
                            deliveryMode = settings.deliveryMode.name.lowercase(Locale.US),
                            serviceAnnouncementsEnabled = settings.serviceAnnouncementsEnabled,
                            updatedAt = updatedAt,
                        ),
                        clientUpdatedAt = updatedAt,
                    ),
                )
            }
        }
        return fallback.updatePreferences(settings)
    }

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

    override suspend fun announcements(cursor: String?): ServiceAnnouncementListResult {
        val response = remoteDataSource.announcements(cursor)
        return if (response is HubNetworkResult.Success) {
            ServiceAnnouncementListResult(response.value.items.mapNotNull { it.toModelOrNull() }, response.value.nextCursor)
        } else ServiceAnnouncementListResult(emptyList())
    }

    override suspend fun announcementDetail(id: String): ServiceAnnouncement? {
        val response = remoteDataSource.announcement(id)
        return if (response is HubNetworkResult.Success) response.value.toModelOrNull() else null
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
        val result = fetchAllMusicPages(memberId = null, type = null)
        if (result != null) {
            songCache = result
            return MainUiPolicy.recentSongs(result.items, limit)
        }
        return MainUiPolicy.recentSongs(
            songCache?.items ?: fallback.songs().items,
            limit,
        )
    }

    override suspend fun songDetail(id: String, fallback: SongCatalogItem): SongCatalogItem {
        val response = remoteDataSource.musicDetail(id)
        if (response is HubNetworkResult.Success) {
            response.value.toSongCatalogItemOrNull()?.let { detail ->
                songDetailCache[id] = detail
                return detail
            }
        }
        return songDetailCache[id] ?: fallback
    }

    private suspend fun fetchAllMusicPages(
        memberId: String?,
        type: String?,
    ): SongListResult? {
        val items = mutableListOf<SongCatalogItem>()
        val seen = linkedSetOf<String>()
        var nextCursor: String? = null
        var serverTime: Instant? = null
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
                return null
            }
            if (serverTime == null) serverTime = response.value.serverTime?.let(::parseInstantOrNull)
            val page = response.value.toSongListResult()
            page.items.forEach { song ->
                val key = song.youtubeVideoId.ifBlank { song.id }
                if (seen.add(key)) items += song
            }
            if (page.nextCursor.isNullOrBlank() || items.size >= MUSIC_MAX_ITEMS) {
                return SongListResult(
                    items = items.take(MUSIC_MAX_ITEMS),
                    serverTime = serverTime,
                    isAuthoritative = page.nextCursor.isNullOrBlank(),
                )
            }
            nextCursor = page.nextCursor
        }
        return SongListResult(items = items.take(MUSIC_MAX_ITEMS), serverTime = serverTime, isAuthoritative = false)
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
            runCatching { flushPendingPushToken() }
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
                        liveCategory = null,
                        liveViewerCount = null,
                        livePlatformUrl = null,
                        liveLastCheckedAt = null,
                        channelImageUrl = null,
                    )
                val displayLive = status.isLive && status.sourceVerificationState == "verified"
                member.copy(
                    isLive = displayLive,
                    liveStartedAt = status.startedAt?.let(::parseInstantOrNull)?.takeIf { displayLive },
                    liveTitle = status.title?.takeIf { displayLive },
                    liveCategory = MainUiPolicy.liveCategoryText(status.liveCategory)?.takeIf { displayLive },
                    liveViewerCount = status.viewerCount?.takeIf { displayLive },
                    livePlatformUrl = status.platformUrl?.takeIf { displayLive },
                    liveLastCheckedAt = parseInstantOrNull(status.lastCheckedAt),
                    channelImageUrl = status.channelImageUrl,
                )
            }
        )
    }

    private fun HubDataState.mergeCatalogProfileImages(membersFromServer: List<MemberDto>): HubDataState {
        if (membersFromServer.isEmpty()) return this
        val profileImageByMemberId = membersFromServer.associate { it.id to it.profileImageUrl }
        return copy(
            members = members.map { member ->
                member.copy(profileImageUrl = profileImageByMemberId[member.id] ?: member.profileImageUrl)
            },
        )
    }

    private fun parseInstantOrNull(value: String): Instant? =
        runCatching { Instant.parse(value) }.getOrNull()

    private fun parseScheduleInstantOrNull(value: String?): Instant? {
        if (value.isNullOrBlank()) return null
        return parseInstantOrNull(value)
            ?: runCatching { LocalDate.parse(value).atStartOfDay(ZoneOffset.UTC).toInstant() }.getOrNull()
    }

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
            scheduleMode = scheduleMode.toEnum<HubEventScheduleMode>() ?: HubEventScheduleMode.SINGLE_WINDOW,
            scheduleItems = scheduleItems.mapNotNull { item ->
                val itemId = item.id ?: return@mapNotNull null
                val itemKind = item.kind?.toEnum<HubEventScheduleKind>() ?: return@mapNotNull null
                val itemTitle = item.title?.trim()?.takeIf(String::isNotEmpty)
                val itemLabel = item.label?.trim()?.takeIf(String::isNotEmpty) ?: itemTitle.orEmpty()
                val itemStartsAt = parseScheduleInstantOrNull(item.startsAt) ?: return@mapNotNull null
                HubEventScheduleItem(
                    id = itemId,
                    kind = itemKind,
                    title = itemTitle,
                    label = itemLabel,
                    description = item.description?.trim()?.takeIf(String::isNotEmpty),
                    startsAt = itemStartsAt,
                    endsAt = parseScheduleInstantOrNull(item.endsAt),
                    timePrecision = item.timePrecision.toEnum<HubEventTimePrecision>() ?: HubEventTimePrecision.DATETIME,
                    timezone = item.timezone,
                    actionUrl = item.actionUrl,
                    sourceUrl = item.sourceUrl,
                    sourceLabel = item.sourceLabel,
                    notificationEligible = item.notificationEligible,
                    isPrimary = item.isPrimary,
                    sortOrder = item.sortOrder,
                    cancelledAt = parseScheduleInstantOrNull(item.cancelledAt),
                )
            }.sortedWith(compareBy<HubEventScheduleItem> { it.startsAt }.thenBy { it.sortOrder }),
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
        catalogAddedAt = catalogAddedAt?.let(::parseInstantOrNull),
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
        sourcePlaylists = sourcePlaylists.map {
            SongSourcePlaylist(
                youtubePlaylistId = it.youtubePlaylistId,
                title = it.title,
                type = it.type,
                youtubeUrl = it.youtubeUrl,
                isPrimary = it.isPrimary,
            )
        },
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
            catalogAddedAt = catalogAddedAt?.let(::parseInstantOrNull),
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
            scheduleItemId = scheduleItemId,
            scheduleKind = scheduleKind?.toEnum<HubEventScheduleKind>(),
            scheduleLabel = scheduleLabel,
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

    private fun dev.minepacu.stelliveeventnotifier.core.network.AnnouncementsSummaryDto.toModel(): AnnouncementsSummary =
        AnnouncementsSummary(
            activeCount = activeCount,
            items = items.mapNotNull { item ->
                val published = parseInstantOrNull(item.publishedAt) ?: return@mapNotNull null
                val severity = ServiceAnnouncementSeverity.entries.firstOrNull { it.apiValue == item.severity } ?: return@mapNotNull null
                AnnouncementSummaryItem(item.id, item.attentionRevision, published, severity, item.isPinned)
            },
            pinned = pinned?.toModelOrNull(),
            generatedAt = generatedAt?.let(::parseInstantOrNull),
        )

    private fun ServiceAnnouncementDto.toModelOrNull(): ServiceAnnouncement? {
        val published = parseInstantOrNull(publishedAt) ?: return null
        val updated = parseInstantOrNull(updatedAt) ?: return null
        val announcementType = ServiceAnnouncementType.entries.firstOrNull { it.apiValue == type } ?: return null
        val announcementSeverity = ServiceAnnouncementSeverity.entries.firstOrNull { it.apiValue == severity } ?: return null
        return ServiceAnnouncement(
            id = id, type = announcementType, severity = announcementSeverity, title = title, summary = summary,
            body = body, isPinned = isPinned, targetPlatforms = targetPlatforms,
            minimumAppVersion = minimumAppVersion, maximumAppVersion = maximumAppVersion,
            appDeepLink = appDeepLink, externalUrl = externalUrl, actionLabel = actionLabel,
            publishedAt = published, expiresAt = expiresAt?.let(::parseInstantOrNull), resolvedAt = resolvedAt?.let(::parseInstantOrNull),
            archivedAt = archivedAt?.let(::parseInstantOrNull), attentionRevision = attentionRevision, revision = revision, updatedAt = updated,
        )
    }

    private fun String.toImagePolicyState(): HubEventImagePolicyState =
        HubEventImagePolicyState.entries.firstOrNull { it.apiValue == this } ?: HubEventImagePolicyState.VERIFY_REQUIRED

    interface RemoteDataSource {
        suspend fun bootstrap(deviceId: String?): HubNetworkResult<BootstrapResponseDto>
        suspend fun registerDevice(request: RegisterDeviceRequestDto): HubNetworkResult<RegisterDeviceResponseDto>
        suspend fun preferences(deviceId: String): HubNetworkResult<PreferencesResponseDto>
        suspend fun updatePreferences(request: UpdatePreferencesRequestDto): HubNetworkResult<UpdatePreferencesResponseDto>
        suspend fun hubEvents(
            generationId: String? = null,
            from: String? = null,
            to: String? = null,
            limit: Int? = null,
        ): HubNetworkResult<dev.minepacu.stelliveeventnotifier.core.network.HubEventsListResponseDto>
        suspend fun hubEvent(id: String): HubNetworkResult<HubEventDto>
        suspend fun announcements(cursor: String? = null): HubNetworkResult<ServiceAnnouncementListResponseDto>
        suspend fun announcement(id: String): HubNetworkResult<ServiceAnnouncementDto>
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

    suspend fun musicDetail(id: String): HubNetworkResult<MusicCatalogItemDto> = HubNetworkResult.Failure(code = "not_supported")

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
            client.bootstrap(deviceId = deviceId, appVersion = BuildConfig.VERSION_NAME)

        override suspend fun registerDevice(
            request: RegisterDeviceRequestDto,
        ): HubNetworkResult<RegisterDeviceResponseDto> = client.registerDevice(request)

        override suspend fun preferences(deviceId: String): HubNetworkResult<PreferencesResponseDto> =
            client.preferences(deviceId)

        override suspend fun updatePreferences(
            request: UpdatePreferencesRequestDto,
        ): HubNetworkResult<UpdatePreferencesResponseDto> = client.updatePreferences(request)

    override suspend fun hubEvents(
        generationId: String?,
        from: String?,
        to: String?,
        limit: Int?,
    ): HubNetworkResult<dev.minepacu.stelliveeventnotifier.core.network.HubEventsListResponseDto> =
        client.hubEvents(generationId = generationId, from = from, to = to, limit = limit)

        override suspend fun hubEvent(id: String): HubNetworkResult<HubEventDto> = client.hubEvent(id)
        override suspend fun announcements(cursor: String?): HubNetworkResult<ServiceAnnouncementListResponseDto> =
            client.announcements(cursor = cursor, appVersion = BuildConfig.VERSION_NAME)
        override suspend fun announcement(id: String): HubNetworkResult<ServiceAnnouncementDto> =
            client.announcement(id, appVersion = BuildConfig.VERSION_NAME)

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

    override suspend fun musicDetail(id: String): HubNetworkResult<MusicCatalogItemDto> = client.musicDetail(id)

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
