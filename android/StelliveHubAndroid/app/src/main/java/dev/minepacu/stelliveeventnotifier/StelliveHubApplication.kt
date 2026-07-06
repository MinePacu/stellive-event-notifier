package dev.minepacu.stelliveeventnotifier

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationChannelRegistrar

@HiltAndroidApp
class StelliveHubApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationChannelRegistrar(this).register()
    }
}
