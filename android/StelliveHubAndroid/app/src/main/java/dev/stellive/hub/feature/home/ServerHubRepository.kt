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
import dev.stellive.hub.core.network.BootstrapResponseDto
import dev.stellive.hub.core.network.HubCalendarEntryDto
import dev.stellive.hub.core.network.HubCalendarResponseDto
import dev.stellive.hub.core.network.HubEventDto
import dev.stellive.hub.core.network.HubApiClient
import dev.stellive.hub.core.network.HubNetworkResult
import dev.stellive.hub.core.network.LiveStatusDto
import dev.stellive.hub.core.network.RegisterDeviceRequestDto
import dev.stellive.hub.core.network.RegisterDeviceResponseDto
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

class ServerHubRepository(
    private val remoteDataSource: RemoteDataSource,
    private val deviceIdStore: DeviceIdStore,
    private val fallback: MockHubRepository,
) : HubRepository {
    private val eventCache = linkedMapOf<String, HubEvent>()
    private var calendarCache: List<HubCalendarDay> = emptyList()

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

    override suspend fun hubEvents(filterId: String): List<HubEvent> {
        val response = remoteDataSource.hubEvents(generationId = filterId.takeUnless { it == "all" }, limit = 100)
        if (response is HubNetworkResult.Success) {
            val events = response.value.items.mapNotNull { it.toHubEventOrNull() }
            if (events.isNotEmpty()) {
                eventCache.clear()
                events.forEach { eventCache[it.id] = it }
                return events
            }
        }
        return eventCache.values.takeIf { it.isNotEmpty() }?.toList() ?: fallback.hubEvents(filterId)
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
            limit: Int? = null,
        ): HubNetworkResult<dev.stellive.hub.core.network.HubEventsListResponseDto>
        suspend fun hubEvent(id: String): HubNetworkResult<HubEventDto>
        suspend fun hubEventsCalendar(from: String, to: String, timezone: String): HubNetworkResult<HubCalendarResponseDto>
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
            limit: Int?,
        ): HubNetworkResult<dev.stellive.hub.core.network.HubEventsListResponseDto> =
            client.hubEvents(generationId = generationId, limit = limit)

        override suspend fun hubEvent(id: String): HubNetworkResult<HubEventDto> = client.hubEvent(id)

        override suspend fun hubEventsCalendar(
            from: String,
            to: String,
            timezone: String,
        ): HubNetworkResult<HubCalendarResponseDto> = client.hubEventsCalendar(from = from, to = to, timezone = timezone)
    }
}
