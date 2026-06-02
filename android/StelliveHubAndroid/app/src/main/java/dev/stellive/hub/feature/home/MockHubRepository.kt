package dev.stellive.hub.feature.home

import dev.stellive.hub.core.model.ActiveStatus
import dev.stellive.hub.core.model.CatalogRole
import dev.stellive.hub.core.model.DeliveryMode
import dev.stellive.hub.core.model.GenerationFilter
import dev.stellive.hub.core.model.HubMember
import dev.stellive.hub.core.model.NotificationHistoryItem
import dev.stellive.hub.core.model.NotificationSettingState
import java.time.Instant

class MockHubRepository {
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
        HubMember("shirayuki-hina", "시라유키 히나", "Shirayuki Hina", "gen2", "2기생", "Universe", CatalogRole.MEMBER, isPerson = true),
        HubMember("neneko-mashiro", "네네코 마시로", "Neneko Mashiro", "gen2", "2기생", "Universe", CatalogRole.MEMBER, isPerson = true),
        HubMember("akane-lize", "아카네 리제", "Akane Lize", "gen2", "2기생", "Universe", CatalogRole.MEMBER, isPerson = true),
        HubMember("arahashi-tabi", "아라하시 타비", "Arahashi Tabi", "gen2", "2기생", "Universe", CatalogRole.MEMBER, isPerson = true),
        HubMember("tenko-shibuki", "텐코 시부키", "Tenko Shibuki", "gen3", "3기생", "Cliche", CatalogRole.MEMBER, xHandle = "TenkoShibuki", isPerson = true),
        HubMember("aokumo-rin", "아오쿠모 린", "Aokumo Rin", "gen3", "3기생", "Cliche", CatalogRole.MEMBER, xHandle = "AokumoRin", isPerson = true),
        HubMember("hanako-nana", "하나코 나나", "Hanako Nana", "gen3", "3기생", "Cliche", CatalogRole.MEMBER, xHandle = "HanakoNana_", isPerson = true),
        HubMember("yuzuha-riko", "유즈하 리코", "Yuzuha Riko", "gen3", "3기생", "Cliche", CatalogRole.MEMBER, xHandle = "YuzuhaRiko", isPerson = true),
        HubMember("gangzi", "강지", "Gangzi", "gamja", "감자", "감자", CatalogRole.REPRESENTATIVE, roleLabel = "스텔라이브 대표", youtubeHandle = "@GANGZI1", xHandle = "GANGZIIII", isPerson = true),
        HubMember("stellive-official", "스텔라이브 공식", "Stellive Official", "official", "기타", "공식 채널", CatalogRole.OFFICIAL_CHANNEL, roleLabel = "스텔라이브 공식 채널", youtubeHandle = "@stellive_official", xHandle = "StelLive_kr", isPerson = false, realtimeEnabled = true),
        HubMember("gen4-placeholder", "4기생 placeholder", "Generation 4 Placeholder", "gen4-upcoming", "4기생", "upcoming", CatalogRole.PLACEHOLDER, activeStatus = ActiveStatus.UPCOMING, isPerson = false, notificationEnabled = false)
    )

    val settings = NotificationSettingState()

    val history = listOf(
        NotificationHistoryItem("h1", "방송 시작", "아야츠노 유니 CHZZK 방송 시작", "ayatsuno-yuni", "아야츠노 유니", "chzzk_live_started", DeliveryMode.REALTIME_BEST_EFFORT, 1800),
        NotificationHistoryItem("h2", "공식 업로드", "스텔라이브 공식 YouTube 업로드", "stellive-official", "스텔라이브 공식", "official_youtube_upload", DeliveryMode.REALTIME_BEST_EFFORT, 2400)
    )

    fun memberForHistory(item: NotificationHistoryItem): HubMember? =
        members.firstOrNull { it.id == item.memberId }
}
