package dev.stellive.hub

import dev.stellive.hub.core.device.DeviceIdStore
import dev.stellive.hub.core.network.BootstrapResponseDto
import dev.stellive.hub.core.network.HubNetworkResult
import dev.stellive.hub.core.network.MobileConfigDto
import dev.stellive.hub.core.network.RegisterDeviceRequestDto
import dev.stellive.hub.core.network.RegisterDeviceResponseDto
import dev.stellive.hub.feature.home.MockHubRepository
import dev.stellive.hub.feature.home.ServerHubRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ServerHubRepositoryTest {
    @Test
    fun bootstrapCallsServerBeforeUsingFallbackData() = runTest {
        val remote = RecordingRemoteDataSource()
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val state = repository.bootstrap()

        assertEquals(1, remote.bootstrapCalls)
        assertTrue(state.filters.isNotEmpty())
    }

    @Test
    fun bootstrapRegistersDeviceWhenServerSnapshotHasNoDevice() = runTest {
        val deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage())
        val remote = RecordingRemoteDataSource()
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = deviceIdStore,
            fallback = MockHubRepository(),
        )

        repository.bootstrap()

        assertEquals(1, remote.registerCalls)
        assertEquals("device-created", deviceIdStore.getDeviceId())
    }

    private class RecordingRemoteDataSource : ServerHubRepository.RemoteDataSource {
        var bootstrapCalls = 0
        var registerCalls = 0

        override suspend fun bootstrap(deviceId: String?): HubNetworkResult<BootstrapResponseDto> {
            bootstrapCalls += 1
            return HubNetworkResult.Success(
                BootstrapResponseDto(
                    config = MobileConfigDto(
                        unofficialProject = true,
                        catalogVersion = "seed-2026-06-01",
                        officialYoutubeLiveExcluded = true,
                        xNotificationsEnabled = false,
                        xDisabledReason = "x_notifications_dropped_for_mvp",
                        hubCalendarEnabled = true,
                        foregroundRealtimeEnabled = false,
                    ),
                    device = null,
                    serverTime = "2026-06-11T03:00:00.000Z",
                ),
            )
        }

        override suspend fun registerDevice(
            request: RegisterDeviceRequestDto,
        ): HubNetworkResult<RegisterDeviceResponseDto> {
            registerCalls += 1
            return HubNetworkResult.Success(
                RegisterDeviceResponseDto(
                    deviceId = "device-created",
                    registered = true,
                    serverTime = "2026-06-11T03:00:00.000Z",
                ),
            )
        }
    }
}
