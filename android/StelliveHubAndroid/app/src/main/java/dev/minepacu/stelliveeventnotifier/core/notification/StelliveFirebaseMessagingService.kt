package dev.minepacu.stelliveeventnotifier.core.notification

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dev.minepacu.stelliveeventnotifier.BuildConfig
import dev.minepacu.stelliveeventnotifier.core.device.PushTokenSyncer
import dev.minepacu.stelliveeventnotifier.core.network.HubApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

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
        // TODO: Persist payload to Room and route tapAction to app deep link or platform URL.
    }

    private fun defaultHubBaseUrl(): String = BuildConfig.HUB_BASE_URL
}
