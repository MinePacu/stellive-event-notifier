package dev.minepacu.stelliveeventnotifier.core.notification

import android.app.NotificationManager
import dev.minepacu.stelliveeventnotifier.core.model.NotificationEventType

data class NotificationChannelGroupDefinition(
    val id: String,
    val displayName: String
)

data class NotificationChannelDefinition(
    val id: String,
    val groupId: String,
    val displayName: String,
    val description: String,
    val importance: Int,
    val eventTypes: Set<NotificationEventType>
)

object NotificationChannels {
    const val GROUP_LIVE = "stellive_group_live"
    const val GROUP_PLATFORM_ACTIVITY = "stellive_group_platform_activity"
    const val GROUP_OFFICIAL = "stellive_group_official"
    const val GROUP_HUB_EVENTS = "stellive_group_hub_events"
    const val GROUP_LOW_NOISE = "stellive_group_low_noise"

    const val CAFE_POSTS = "stellive_cafe_posts"
    const val CHZZK_LIVE = "stellive_chzzk_live"
    const val CHZZK_CHAT = "stellive_chzzk_chat"
    const val CHZZK_SUBSCRIPTION = "stellive_chzzk_subscription"
    const val YOUTUBE = "stellive_youtube"
    const val OFFICIAL_YOUTUBE = "stellive_official_youtube"
    const val HUB_EVENTS = "stellive_hub_events"

    val groups = listOf(
        NotificationChannelGroupDefinition(GROUP_LIVE, "라이브"),
        NotificationChannelGroupDefinition(GROUP_PLATFORM_ACTIVITY, "플랫폼 활동"),
        NotificationChannelGroupDefinition(GROUP_OFFICIAL, "공식 채널"),
        NotificationChannelGroupDefinition(GROUP_HUB_EVENTS, "굿즈/행사"),
        NotificationChannelGroupDefinition(GROUP_LOW_NOISE, "낮은 소음")
    )

    val channels = listOf(
        NotificationChannelDefinition(
            id = CHZZK_LIVE,
            groupId = GROUP_LIVE,
            displayName = "CHZZK 방송",
            description = "방송 시작과 종료 알림",
            importance = NotificationManager.IMPORTANCE_DEFAULT,
            eventTypes = setOf(NotificationEventType.CHZZK_LIVE_STARTED, NotificationEventType.CHZZK_LIVE_ENDED)
        ),
        NotificationChannelDefinition(
            id = YOUTUBE,
            groupId = GROUP_PLATFORM_ACTIVITY,
            displayName = "YouTube 업로드",
            description = "멤버 YouTube 업로드 알림",
            importance = NotificationManager.IMPORTANCE_DEFAULT,
            eventTypes = setOf(NotificationEventType.YOUTUBE_UPLOAD)
        ),
        NotificationChannelDefinition(
            id = OFFICIAL_YOUTUBE,
            groupId = GROUP_OFFICIAL,
            displayName = "공식 YouTube 업로드",
            description = "스텔라이브 공식 YouTube 업로드 알림",
            importance = NotificationManager.IMPORTANCE_DEFAULT,
            eventTypes = setOf(NotificationEventType.OFFICIAL_YOUTUBE_UPLOAD)
        ),
        NotificationChannelDefinition(
            id = HUB_EVENTS,
            groupId = GROUP_HUB_EVENTS,
            displayName = "굿즈/행사",
            description = "굿즈/행사 공개, 판매, 마감, 취소 알림",
            importance = NotificationManager.IMPORTANCE_DEFAULT,
            eventTypes = setOf(
                NotificationEventType.EVENT_ANNOUNCED,
                NotificationEventType.EVENT_SALES_OPEN,
                NotificationEventType.EVENT_DEADLINE_SOON,
                NotificationEventType.EVENT_UPDATED,
                NotificationEventType.EVENT_CANCELLED
            )
        ),
        NotificationChannelDefinition(
            id = CHZZK_CHAT,
            groupId = GROUP_LOW_NOISE,
            displayName = "CHZZK 채팅",
            description = "명시적 필터가 있을 때만 사용하는 채팅 알림",
            importance = NotificationManager.IMPORTANCE_LOW,
            eventTypes = setOf(NotificationEventType.CHZZK_CHAT)
        ),
        NotificationChannelDefinition(
            id = CHZZK_SUBSCRIPTION,
            groupId = GROUP_LOW_NOISE,
            displayName = "CHZZK 구독",
            description = "CHZZK 구독 관련 알림",
            importance = NotificationManager.IMPORTANCE_LOW,
            eventTypes = setOf(NotificationEventType.CHZZK_SUBSCRIPTION)
        ),
        NotificationChannelDefinition(
            id = CAFE_POSTS,
            groupId = GROUP_LOW_NOISE,
            displayName = "카페 게시글",
            description = "공식 허용 경로가 확인된 경우에만 사용하는 카페 게시글 알림",
            importance = NotificationManager.IMPORTANCE_LOW,
            eventTypes = setOf(NotificationEventType.CAFE_POST)
        )
    )

    fun channelFor(eventType: NotificationEventType): NotificationChannelDefinition? =
        channels.firstOrNull { eventType in it.eventTypes }
}
