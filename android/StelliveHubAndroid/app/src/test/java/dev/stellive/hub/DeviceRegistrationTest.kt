package dev.stellive.hub

import dev.stellive.hub.core.device.DeviceIdStore
import dev.stellive.hub.core.device.PushTokenSyncer
import dev.stellive.hub.core.network.HubNetworkResult
import dev.stellive.hub.core.network.UpdateDeviceTokenRequestDto
import dev.stellive.hub.core.network.UpdateDeviceTokenResponseDto
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DeviceRegistrationTest {
    @Test
    fun deviceIdStoreSavesAndLoadsDeviceId() {
        val store = DeviceIdStore(DeviceIdStore.InMemoryStorage())

        assertNull(store.getDeviceId())
        store.saveDeviceId("device-1")

        assertEquals("device-1", store.getDeviceId())
    }

    @Test
    fun pushTokenSyncerStoresPendingTokenUntilDeviceIdExists() = runTest {
        val deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage())
        val pendingStore = PushTokenSyncer.InMemoryPendingTokenStore()
        val api = RecordingTokenApi()
        val syncer = PushTokenSyncer(
            deviceIdStore = deviceIdStore,
            pendingTokenStore = pendingStore,
            tokenApi = api,
        )

        syncer.syncToken("pending-fcm-token")

        assertEquals("pending-fcm-token", pendingStore.loadPendingToken())
        assertNull(api.lastRequest)

        deviceIdStore.saveDeviceId("device-1")
        syncer.flushPendingToken()

        assertNull(pendingStore.loadPendingToken())
        assertEquals("device-1", api.lastRequest?.deviceId)
        assertEquals("fcm", api.lastRequest?.provider)
    }

    private class RecordingTokenApi : PushTokenSyncer.TokenApi {
        var lastRequest: UpdateDeviceTokenRequestDto? = null

        override suspend fun updateDeviceToken(
            request: UpdateDeviceTokenRequestDto,
        ): HubNetworkResult<UpdateDeviceTokenResponseDto> {
            lastRequest = request
            return HubNetworkResult.Success(
                UpdateDeviceTokenResponseDto(
                    updated = true,
                    tokenStatus = "active",
                    serverTime = "2026-06-11T03:00:00.000Z",
                ),
            )
        }
    }
}
