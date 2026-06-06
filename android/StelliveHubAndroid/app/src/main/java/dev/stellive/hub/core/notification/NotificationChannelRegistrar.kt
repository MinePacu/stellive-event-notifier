package dev.stellive.hub.core.notification

import android.app.NotificationChannel
import android.app.NotificationChannelGroup
import android.app.NotificationManager
import android.content.Context
import android.os.Build

class NotificationChannelRegistrar(
    private val context: Context
) {
    fun register() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val groups = NotificationChannels.groups.map { NotificationChannelGroup(it.id, it.displayName) }
        manager.createNotificationChannelGroups(groups)
        val channels = NotificationChannels.channels.map { definition ->
            NotificationChannel(definition.id, definition.displayName, definition.importance).apply {
                description = definition.description
                group = definition.groupId
            }
        }
        manager.createNotificationChannels(channels)
    }
}
