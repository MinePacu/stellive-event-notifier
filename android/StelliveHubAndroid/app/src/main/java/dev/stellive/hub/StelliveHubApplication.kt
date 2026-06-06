package dev.stellive.hub

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import dev.stellive.hub.core.notification.NotificationChannelRegistrar

@HiltAndroidApp
class StelliveHubApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationChannelRegistrar(this).register()
    }
}
