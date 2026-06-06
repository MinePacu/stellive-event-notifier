package dev.stellive.hub.core.notification

enum class NotificationPermissionPromptMoment {
    APP_LAUNCH,
    DELIVERY_SETTINGS_TOGGLE,
    GLOBAL_NOTIFICATION_TOGGLE,
    REALTIME_SETTING_TOGGLE
}

object NotificationPermissionPromptPolicy {
    fun shouldRequest(
        moment: NotificationPermissionPromptMoment,
        alreadyGranted: Boolean,
        alreadyRequested: Boolean
    ): Boolean {
        if (alreadyGranted || alreadyRequested) return false;
        return moment == NotificationPermissionPromptMoment.DELIVERY_SETTINGS_TOGGLE ||
            moment == NotificationPermissionPromptMoment.GLOBAL_NOTIFICATION_TOGGLE ||
            moment == NotificationPermissionPromptMoment.REALTIME_SETTING_TOGGLE
    }
}
