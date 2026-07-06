package dev.minepacu.stelliveeventnotifier.core.notification

import dev.minepacu.stelliveeventnotifier.core.model.NotificationEventType

enum class NotificationDeliveryLevel(val wireName: String) {
    IMMEDIATE_PUSH("immediate_push"),
    SUMMARY_PUSH("summary_push"),
    IN_APP_HISTORY_ONLY("in_app_history_only");

    companion object {
        fun fromWireName(value: String?): NotificationDeliveryLevel? =
            entries.firstOrNull { it.wireName == value }
    }
}

data class NotificationPayload(
    val eventId: String,
    val memberId: String,
    val generationId: String,
    val source: String,
    val eventType: NotificationEventType,
    val title: String,
    val body: String,
    val appDeepLink: String,
    val platformUrl: String?,
    val deliveryLevel: NotificationDeliveryLevel,
    val summaryGroupId: String?
) {
    companion object {
        fun fromData(data: Map<String, String>): NotificationPayload? {
            val eventType = NotificationEventType.entries.firstOrNull { it.wireName == data["eventType"] } ?: return null
            return NotificationPayload(
                eventId = data["eventId"]?.takeIf { it.isNotBlank() } ?: return null,
                memberId = data["memberId"]?.takeIf { it.isNotBlank() } ?: return null,
                generationId = data["generationId"]?.takeIf { it.isNotBlank() } ?: return null,
                source = data["source"]?.takeIf { it.isNotBlank() } ?: return null,
                eventType = eventType,
                title = data["title"]?.takeIf { it.isNotBlank() } ?: return null,
                body = data["body"] ?: "",
                appDeepLink = data["appDeepLink"]?.takeIf { it.isNotBlank() } ?: return null,
                platformUrl = data["platformUrl"]?.takeIf { it.isNotBlank() },
                deliveryLevel = NotificationDeliveryLevel.fromWireName(data["deliveryLevel"]) ?: NotificationDeliveryLevel.IMMEDIATE_PUSH,
                summaryGroupId = data["summaryGroupId"]?.takeIf { it.isNotBlank() }
            )
        }
    }
}
