package dev.stellive.hub.core.notification

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class StelliveFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // TODO: Send token to /v1/devices/token after device registration is wired.
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        // TODO: Persist payload to Room and route tapAction to app deep link or platform URL.
    }
}

