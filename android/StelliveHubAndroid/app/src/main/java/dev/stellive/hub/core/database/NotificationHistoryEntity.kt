package dev.stellive.hub.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "notification_history")
data class NotificationHistoryEntity(
    @PrimaryKey val id: String,
    val eventId: String,
    val title: String,
    val body: String,
    val source: String,
    val eventType: String,
    val deliveryMode: String,
    val deliveredAt: Long
)

