package dev.stellive.hub.core.notification

object NotificationTopicKey {
    fun forPayload(payload: NotificationPayload): String {
        payload.summaryGroupId?.let { return "summary:$it" }
        if (payload.memberId.startsWith("hub-event:")) return "hub_event:${payload.memberId.removePrefix("hub-event:")}"
        return "${payload.memberId}:${payload.source}:${payload.eventType.wireName}"
    }
}
