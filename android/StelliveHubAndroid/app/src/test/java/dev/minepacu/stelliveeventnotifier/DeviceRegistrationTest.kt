package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.device.DeviceIdStore
import dev.minepacu.stelliveeventnotifier.core.device.PushTokenSyncer
import dev.minepacu.stelliveeventnotifier.core.network.HubNetworkResult
import dev.minepacu.stelliveeventnotifier.core.network.UpdateDeviceTokenRequestDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdateDeviceTokenResponseDto
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

    @Test
    fun pushTokenSyncerSendsTokenWhenDeviceIdExists() = runTest {
        val deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()).apply {
            saveDeviceId("device-1")
        }
        val api = RecordingTokenApi()
        val syncer = PushTokenSyncer(
            deviceIdStore = deviceIdStore,
            pendingTokenStore = PushTokenSyncer.InMemoryPendingTokenStore(),
            tokenApi = api,
        )

        syncer.syncToken("current-fcm-token")

        assertEquals("device-1", api.lastRequest?.deviceId)
        assertEquals("current-fcm-token", api.lastRequest?.token)
    }

    @Test
    fun pushTokenSyncerKeepsFailedTokenPendingForRetry() = runTest {
        val deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()).apply {
            saveDeviceId("device-1")
        }
        val pendingStore = PushTokenSyncer.InMemoryPendingTokenStore()
        val syncer = PushTokenSyncer(
            deviceIdStore = deviceIdStore,
            pendingTokenStore = pendingStore,
            tokenApi = RecordingTokenApi(succeeds = false),
        )

        syncer.syncToken("retry-fcm-token")

        assertEquals("retry-fcm-token", pendingStore.loadPendingToken())
    }

    @Test
    fun pushTokenSyncerClearsMatchingPendingTokenAfterSuccessfulSend() = runTest {
        val deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()).apply {
            saveDeviceId("device-1")
        }
        val pendingStore = PushTokenSyncer.InMemoryPendingTokenStore().apply {
            savePendingToken("current-fcm-token")
        }
        val syncer = PushTokenSyncer(
            deviceIdStore = deviceIdStore,
            pendingTokenStore = pendingStore,
            tokenApi = RecordingTokenApi(),
        )

        syncer.syncToken("current-fcm-token")

        assertNull(pendingStore.loadPendingToken())
    }

    @Test
    fun flushPendingTokenKeepsTokenWhenApiUpdateFails() = runTest {
        val deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()).apply {
            saveDeviceId("device-1")
        }
        val pendingStore = PushTokenSyncer.InMemoryPendingTokenStore().apply {
            savePendingToken("retry-fcm-token")
        }
        val syncer = PushTokenSyncer(
            deviceIdStore = deviceIdStore,
            pendingTokenStore = pendingStore,
            tokenApi = RecordingTokenApi(succeeds = false),
        )

        syncer.flushPendingToken()

        assertEquals("retry-fcm-token", pendingStore.loadPendingToken())
    }

    private class RecordingTokenApi(
        private val succeeds: Boolean = true,
    ) : PushTokenSyncer.TokenApi {
        var lastRequest: UpdateDeviceTokenRequestDto? = null

        override suspend fun updateDeviceToken(
            request: UpdateDeviceTokenRequestDto,
        ): HubNetworkResult<UpdateDeviceTokenResponseDto> {
            lastRequest = request
            if (!succeeds) return HubNetworkResult.Failure(code = "network_error")
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
