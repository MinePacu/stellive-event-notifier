package dev.minepacu.stelliveeventnotifier.core.notification

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dev.minepacu.stelliveeventnotifier.BuildConfig
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.device.PushTokenSyncer
import dev.minepacu.stelliveeventnotifier.core.network.HubApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import dev.minepacu.stelliveeventnotifier.feature.announcements.AnnouncementDeepLinkPolicy

class StelliveFirebaseMessagingService : FirebaseMessagingService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        serviceScope.launch {
            PushTokenSyncer(
                context = this@StelliveFirebaseMessagingService,
                apiClient = HubApiClient.create(baseUrl = defaultHubBaseUrl()),
            ).syncToken(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        if (showServiceAnnouncement(message)) return
        val payload = NotificationPayload.fromData(message.data)
        if (payload == null) {
            Log.d(TAG, "push_received result=ignored reason=invalid_payload")
            return
        }
        val channelId = AndroidNotificationPresenterPolicy.channelIdFor(payload)
        if (!AndroidNotificationPresenterPolicy.shouldShowSystemNotification(payload)) {
            Log.d(TAG, "push_received eventId=${payload.eventId} eventType=${payload.eventType.wireName} channel=$channelId result=history_only")
            return
        }
        if (!canPostNotifications()) {
            Log.d(TAG, "push_received eventId=${payload.eventId} eventType=${payload.eventType.wireName} channel=$channelId result=permission_blocked")
            return
        }
        NotificationManagerCompat.from(this).notify(
            AndroidNotificationPresenterPolicy.notificationId(NotificationTopicKey.forPayload(payload)),
            NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_launcher_placeholder)
                .setContentTitle(payload.title)
                .setContentText(payload.body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(payload.body.ifBlank { payload.title }))
                .setAutoCancel(true)
                .setContentIntent(contentIntent(payload))
                .build()
        )
        Log.d(TAG, "push_received eventId=${payload.eventId} eventType=${payload.eventType.wireName} channel=$channelId result=shown")
    }

    private fun showServiceAnnouncement(message: RemoteMessage): Boolean {
        val deepLink = message.data["appDeepLink"] ?: return false
        val announcementId = AnnouncementDeepLinkPolicy.idFromAppDeepLink(deepLink) ?: return false
        if (!canPostNotifications()) return true
        val title = message.notification?.title ?: "서비스 공지"
        val body = message.notification?.body.orEmpty()
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink), this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            announcementId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        NotificationManagerCompat.from(this).notify(
            announcementId.hashCode(),
            NotificationCompat.Builder(this, NotificationChannels.SERVICE_ANNOUNCEMENTS)
                .setSmallIcon(R.drawable.ic_launcher_placeholder)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build(),
        )
        return true
    }

    private fun defaultHubBaseUrl(): String = BuildConfig.HUB_BASE_URL

    private fun canPostNotifications(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun contentIntent(payload: NotificationPayload): PendingIntent {
        val target = payload.appDeepLink.takeIf { it.isNotBlank() }
        val intent = if (target != null) {
            Intent(Intent.ACTION_VIEW, Uri.parse(target), this, MainActivity::class.java)
        } else {
            Intent(this, MainActivity::class.java)
        }.apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        return PendingIntent.getActivity(
            this,
            AndroidNotificationPresenterPolicy.notificationId(payload.eventId),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    companion object {
        private const val TAG = "StelliveFcm"
    }
}
