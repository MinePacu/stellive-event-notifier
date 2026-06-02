package dev.stellive.hub.core.network

interface HubApi {
    suspend fun registerDevice(deviceId: String, platform: String = "android")
    suspend fun updateFcmToken(deviceId: String, token: String)
}

