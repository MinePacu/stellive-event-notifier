package dev.stellive.hub.feature.home

import dev.stellive.hub.core.model.ActiveStatus
import dev.stellive.hub.core.model.CatalogRole
import dev.stellive.hub.core.model.DeliveryMode
import dev.stellive.hub.core.model.GenerationFilter
import dev.stellive.hub.core.model.HistoryFilterOption
import dev.stellive.hub.core.model.HubCalendarDay
import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubCalendarWidgetSnapshot
import dev.stellive.hub.core.model.HubEvent
import dev.stellive.hub.core.model.HubEventCategory
import dev.stellive.hub.core.model.HubEventParticipationMode
import dev.stellive.hub.core.model.HubEventSourceType
import dev.stellive.hub.core.model.HubEventStatus
import dev.stellive.hub.core.model.HubMember
import dev.stellive.hub.core.model.NotificationEventType
import dev.stellive.hub.core.model.NotificationHistoryItem
import dev.stellive.hub.feature.calendar.HubCalendarDeepLinkPolicy
import dev.stellive.hub.feature.calendar.CalendarUiPolicy
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import dev.stellive.hub.core.model.NotificationSettingState

class MockHubRepository : HubRepository {
    private val calendarZone = ZoneId.of("Asia/Seoul")
    private val calendarDateFormatter = DateTimeFormatter.ISO_LOCAL_DATE
    private val calendarTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")

    val filters = listOf(
        GenerationFilter("all", "전체", true),
        GenerationFilter("gen1", "1기생", true),
        GenerationFilter("gen2", "2기생", true),
        GenerationFilter("gen3", "3기생", true),
        GenerationFilter("gamja", "감자", true),
        GenerationFilter("official", "기타", true),
        GenerationFilter("gen4-upcoming", "upcoming", false)
    )

    val members = listOf(
        HubMember("ayatsuno-yuni", "아야츠노 유니", "Ayatsuno Yuni", "gen1", "1기생", "Everys", CatalogRole.MEMBER, chzzkChannelId = "45e71a76e949e16a34764deb962f9d9f", youtubeHandle = "@ayatsunoyuni", xHandle = "AyatsunoYuni", isPerson = true, isLive = true, realtimeEnabled = true, liveStartedAt = Instant.parse("2026-06-02T09:00:00Z")),
        HubMember("sakihane-huya", "사키하네 후야", "Sakihane Huya", "gen1", "1기생", "Everys", CatalogRole.MEMBER, chzzkChannelId = "36ddb9bb4f17593b60f1b63cec86611d", youtubeHandle = "@Sakihanechannel", xHandle = "verify_required", isPerson = true),
        HubMember("shirayuki-hina", "시라유키 히나", "Shirayuki Hina", "gen2", "2기생", "Universe", CatalogRole.MEMBER, chzzkChannelId = "b044e3a3b9259246bc92e863e7d3f3b8", isPerson = true),
        HubMember("neneko-mashiro", "네네코 마시로", "Neneko Mashiro", "gen2", "2기생", "Universe", CatalogRole.MEMBER, chzzkChannelId = "4515b179f86b67b4981e16190817c580", isPerson = true),
        HubMember("akane-lize", "아카네 리제", "Akane Lize", "gen2", "2기생", "Universe", CatalogRole.MEMBER, chzzkChannelId = "4325b1d5bbc321fad3042306646e2e50", isPerson = true),
        HubMember("arahashi-tabi", "아라하시 타비", "Arahashi Tabi", "gen2", "2기생", "Universe", CatalogRole.MEMBER, chzzkChannelId = "a6c4ddb09cdb160478996007bff35296", isPerson = true),
        HubMember("tenko-shibuki", "텐코 시부키", "Tenko Shibuki", "gen3", "3기생", "Cliche", CatalogRole.MEMBER, chzzkChannelId = "64d76089fba26b180d9c9e48a32600d9", xHandle = "TenkoShibuki", isPerson = true),
        HubMember("aokumo-rin", "아오쿠모 린", "Aokumo Rin", "gen3", "3기생", "Cliche", CatalogRole.MEMBER, chzzkChannelId = "516937b5f85cbf2249ce31b0ad046b0f", xHandle = "AokumoRin", isPerson = true),
        HubMember("hanako-nana", "하나코 나나", "Hanako Nana", "gen3", "3기생", "Cliche", CatalogRole.MEMBER, chzzkChannelId = "4d812b586ff63f8a2946e64fa860bbf5", xHandle = "HanakoNana_", isPerson = true),
        HubMember("yuzuha-riko", "유즈하 리코", "Yuzuha Riko", "gen3", "3기생", "Cliche", CatalogRole.MEMBER, chzzkChannelId = "8fd39bb8de623317de90654718638b10", xHandle = "YuzuhaRiko", isPerson = true),
        HubMember("gangzi", "강지", "Gangzi", "gamja", "감자", "감자", CatalogRole.REPRESENTATIVE, roleLabel = "스텔라이브 대표", chzzkChannelId = "b5ed5db484d04faf4d150aedd362f34b", youtubeHandle = "@GANGZI1", xHandle = "GANGZIIII", isPerson = true),
        HubMember("stellive-official", "스텔라이브 공식", "Stellive Official", "official", "기타", "공식 채널", CatalogRole.OFFICIAL_CHANNEL, roleLabel = "스텔라이브 공식 채널", youtubeHandle = "@stellive_official", xHandle = "StelLive_kr", isPerson = false, realtimeEnabled = true),
        HubMember("gen4-placeholder", "4기생 placeholder", "Generation 4 Placeholder", "gen4-upcoming", "4기생", "upcoming", CatalogRole.PLACEHOLDER, activeStatus = ActiveStatus.UPCOMING, isPerson = false, notificationEnabled = false)
    )

    val hubEvents = listOf(
        HubEvent(
            id = "closing-official-goods",
            category = HubEventCategory.ONLINE_GOODS,
            participationMode = HubEventParticipationMode.ONLINE,
            status = HubEventStatus.CLOSING_SOON,
            title = "공식 굿즈 예약 마감 임박",
            summary = "공식 출처의 온라인 굿즈 예약이 곧 마감됩니다.",
            generationId = "official",
            sourceUrl = "https://stellive.example/events/closing-official-goods",
            sourceLabel = "스텔라이브 공식",
            sourceType = HubEventSourceType.OFFICIAL,
            announcedAt = Instant.parse("2026-06-01T00:00:00Z"),
            startsAt = Instant.parse("2026-06-02T00:00:00Z"),
            endsAt = Instant.parse("2026-06-05T12:00:00Z"),
            purchaseUrl = "https://stellive.example/buy/closing-official-goods",
            updatedAt = Instant.parse("2026-06-03T00:00:00Z")
        ),
        HubEvent(
            id = "open-gen3-goods",
            category = HubEventCategory.ONLINE_COLLAB,
            participationMode = HubEventParticipationMode.ONLINE,
            status = HubEventStatus.OPEN,
            title = "3기생 콜라보 굿즈 진행 중",
            summary = "3기생과 함께하는 공식 콜라보 굿즈가 진행 중입니다.",
            generationId = "gen3",
            sourceUrl = "https://stellive.example/events/open-gen3-goods",
            sourceLabel = "공식 콜라보",
            sourceType = HubEventSourceType.OFFICIAL_COLLAB,
            announcedAt = Instant.parse("2026-06-01T01:00:00Z"),
            startsAt = Instant.parse("2026-06-02T03:00:00Z"),
            endsAt = Instant.parse("2026-06-10T12:00:00Z"),
            ticketUrl = "https://stellive.example/tickets/open-gen3-goods",
            updatedAt = Instant.parse("2026-06-03T01:00:00Z")
        ),
        HubEvent(
            id = "upcoming-offline-popup",
            category = HubEventCategory.OFFLINE_POPUP,
            participationMode = HubEventParticipationMode.OFFLINE,
            status = HubEventStatus.UPCOMING,
            title = "오프라인 팝업 예정",
            summary = "오프라인 팝업 행사가 곧 공개됩니다.",
            generationId = "official",
            sourceUrl = "https://stellive.example/events/upcoming-offline-popup",
            sourceLabel = "공식 콜라보",
            sourceType = HubEventSourceType.OFFICIAL_COLLAB,
            announcedAt = Instant.parse("2026-06-01T02:00:00Z"),
            startsAt = Instant.parse("2026-06-12T00:00:00Z"),
            venueName = "서울 팝업 스페이스",
            venueAddress = "서울특별시",
            updatedAt = Instant.parse("2026-06-03T02:00:00Z")
        )
    )

    private val hubEventComparator = compareBy<HubEvent>(
        { MainUiPolicy.hubEventStatusRank(it.status) },
        { it.endsAt ?: it.startsAt ?: it.updatedAt },
        { it.id }
    )

    val hubEventsSummary = dev.stellive.hub.core.model.HubEventsSummary(
        openCount = hubEvents.count { it.status == HubEventStatus.OPEN },
        upcomingCount = hubEvents.count { it.status == HubEventStatus.UPCOMING },
        closingSoonCount = hubEvents.count { it.status == HubEventStatus.CLOSING_SOON },
        preview = hubEvents.sortedWith(hubEventComparator).take(3)
    )

    val settings = NotificationSettingState()

    val history = listOf(
        NotificationHistoryItem("h3", "마감 임박", "스텔라이브 공식 굿즈 예약 마감 임박", "hub-event:closing-official-goods", "굿즈/행사", "event_deadline_soon", DeliveryMode.STANDARD, null),
        NotificationHistoryItem("h1", "방송 시작", "아야츠노 유니 CHZZK 방송 시작", "ayatsuno-yuni", "아야츠노 유니", "chzzk_live_started", DeliveryMode.REALTIME_BEST_EFFORT, 1800),
        NotificationHistoryItem("h2", "공식 업로드", "스텔라이브 공식 YouTube 업로드", "stellive-official", "스텔라이브 공식", "official_youtube_upload", DeliveryMode.REALTIME_BEST_EFFORT, 2400)
    )

    val liveMembers: List<HubMember> =
        members
            .filter { it.catalogRole != CatalogRole.OFFICIAL_CHANNEL && it.isLive }
            .sortedBy { it.koreanName }

    val recentHistoryPreview: List<NotificationHistoryItem> = history.take(3)

    val closingSoonHubEvents: List<HubEvent> =
        hubEvents
            .filter { it.status == HubEventStatus.CLOSING_SOON }
            .sortedWith(hubEventComparator)

    fun memberForHistory(item: NotificationHistoryItem): HubMember? =
        members.firstOrNull { it.id == item.memberId }

    fun historyEventTypeFilters(): List<HistoryFilterOption> =
        listOf(HistoryFilterOption("all", "전체")) +
            uniqueHistoryFilters { item ->
                HistoryFilterOption(
                    id = item.eventType,
                    displayName = NotificationEventType.entries.firstOrNull { it.wireName == item.eventType }?.displayName
                        ?: item.title
                )
            }

    fun historyMemberFilters(): List<HistoryFilterOption> =
        listOf(HistoryFilterOption("all", "전체")) +
            uniqueHistoryFilters { item ->
                HistoryFilterOption(item.memberId, item.memberName)
            }

    fun filteredHistory(eventTypeFilterId: String, memberFilterId: String): List<NotificationHistoryItem> =
        history.filter { item ->
            val matchesEventType = eventTypeFilterId == "all" || item.eventType == eventTypeFilterId
            val matchesMember = memberFilterId == "all" || item.memberId == memberFilterId
            matchesEventType && matchesMember
        }

    fun hubEventsForFilter(filter: String): List<HubEvent> {
        val filtered = when (filter.lowercase()) {
            "goods" -> hubEvents.filter {
                it.category == HubEventCategory.ONLINE_GOODS || it.category == HubEventCategory.ONLINE_COLLAB
            }
            "ticketing" -> hubEvents.filter { it.category == HubEventCategory.TICKETING }
            "offline" -> hubEvents.filter { it.participationMode.isOffline }
            "closing" -> hubEvents.filter { it.status == HubEventStatus.CLOSING_SOON }
            else -> hubEvents
        }

        return filtered.sortedWith(hubEventComparator)
    }

    fun calendarDaysForFilter(filter: String): List<HubCalendarDay> =
        hubEventsForFilter(filter)
            .map(::calendarEntryForEvent)
            .sortedWith(CalendarUiPolicy.entryComparator)
            .groupBy { it.displayDate }
            .toSortedMap()
            .map { (date, entries) -> HubCalendarDay(date = date, entries = entries) }

    fun calendarWidgetSnapshot(limit: Int = 5): HubCalendarWidgetSnapshot {
        val now = Instant.now()
        val entries = hubEventsForFilter("all")
            .map(::calendarEntryForEvent)
            .filter { it.status != HubEventStatus.ENDED && it.status != HubEventStatus.CANCELLED }
            .sortedWith(CalendarUiPolicy.entryComparator)
            .take(limit.coerceIn(1, 10))

        return HubCalendarWidgetSnapshot(
            generatedAt = now,
            timezone = calendarZone.id,
            entries = entries,
            staleAfter = now.plusSeconds(6 * 60 * 60)
        )
    }

    private fun calendarEntryForEvent(event: HubEvent): HubCalendarEntry {
        val displayInstant = event.startsAt ?: event.endsAt ?: event.updatedAt
        val displayDate = calendarDateFormatter.format(displayInstant.atZone(calendarZone))

        return HubCalendarEntry(
            id = "${event.id}:$displayDate",
            eventId = event.id,
            title = event.title,
            category = event.category,
            status = event.status,
            participationMode = event.participationMode,
            generationId = event.generationId,
            memberId = event.memberId,
            startsAt = event.startsAt,
            endsAt = event.endsAt,
            displayDate = displayDate,
            displayTimeText = calendarTimeText(event),
            sourceLabel = event.sourceLabel,
            appDeepLink = HubCalendarDeepLinkPolicy.appDeepLinkForEvent(event.id),
            platformUrl = event.purchaseUrl ?: event.ticketUrl ?: event.sourceUrl
        )
    }

    private fun calendarTimeText(event: HubEvent): String {
        val startsAt = event.startsAt
        val endsAt = event.endsAt
        return when {
            startsAt != null -> "${calendarTimeFormatter.format(startsAt.atZone(calendarZone))} 시작"
            endsAt != null -> "${calendarTimeFormatter.format(endsAt.atZone(calendarZone))} 마감"
            else -> "종일"
        }
    }

    private fun uniqueHistoryFilters(
        map: (NotificationHistoryItem) -> HistoryFilterOption
    ): List<HistoryFilterOption> {
        val seen = linkedSetOf<String>()

        return history.mapNotNull { item ->
            val option = map(item)
            if (seen.add(option.id)) option else null
        }
    }

    override suspend fun bootstrap(): HubDataState =
        HubDataState(
            filters = filters,
            members = members,
            settings = settings,
            hubEventsSummary = hubEventsSummary,
        )

    override suspend fun updatePreferences(settings: dev.stellive.hub.core.model.NotificationSettingState): HubDataState =
        bootstrap()
}
