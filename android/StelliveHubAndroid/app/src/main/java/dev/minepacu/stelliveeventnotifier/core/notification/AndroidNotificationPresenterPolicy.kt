package dev.minepacu.stelliveeventnotifier.core.notification

import kotlin.math.abs

object AndroidNotificationPresenterPolicy {
    fun shouldShowSystemNotification(payload: NotificationPayload): Boolean =
        payload.deliveryLevel != NotificationDeliveryLevel.IN_APP_HISTORY_ONLY

    fun channelIdFor(payload: NotificationPayload?): String =
        payload?.eventType
            ?.let(NotificationChannels::channelFor)
            ?.id
            ?: NotificationChannels.HUB_EVENTS

    fun notificationId(topicKey: String): Int = abs(topicKey.hashCode())

    fun updatedBody(recentPayloads: List<NotificationPayload>): String =
        recentPayloads.takeLast(2).joinToString(separator = "\n") { payload ->
            if (payload.body.isBlank()) payload.title else "${payload.title}: ${payload.body}"
        }
}
