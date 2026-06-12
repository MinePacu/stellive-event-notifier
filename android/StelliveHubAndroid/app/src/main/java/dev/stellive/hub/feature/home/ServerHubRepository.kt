package dev.stellive.hub.feature.home

import dev.stellive.hub.core.device.DeviceIdStore
import dev.stellive.hub.core.model.NotificationSettingState
import dev.stellive.hub.core.network.BootstrapResponseDto
import dev.stellive.hub.core.network.HubApiClient
import dev.stellive.hub.core.network.HubNetworkResult
import dev.stellive.hub.core.network.RegisterDeviceRequestDto
import dev.stellive.hub.core.network.RegisterDeviceResponseDto

class ServerHubRepository(
    private val remoteDataSource: RemoteDataSource,
    private val deviceIdStore: DeviceIdStore,
    private val fallback: MockHubRepository,
) : HubRepository {
    override suspend fun bootstrap(): HubDataState {
        val deviceId = deviceIdStore.getDeviceId()
        val response = remoteDataSource.bootstrap(deviceId)
        if (response is HubNetworkResult.Success && response.value.device == null) {
            registerDevice()
        }
        return fallback.bootstrap()
    }

    override suspend fun updatePreferences(settings: NotificationSettingState): HubDataState =
        fallback.updatePreferences(settings)

    private suspend fun registerDevice() {
        val response = remoteDataSource.registerDevice(
            RegisterDeviceRequestDto(
                deviceId = deviceIdStore.getDeviceId(),
                platform = "android",
            ),
        )
        if (response is HubNetworkResult.Success) {
            deviceIdStore.saveDeviceId(response.value.deviceId)
        }
    }

    interface RemoteDataSource {
        suspend fun bootstrap(deviceId: String?): HubNetworkResult<BootstrapResponseDto>
        suspend fun registerDevice(request: RegisterDeviceRequestDto): HubNetworkResult<RegisterDeviceResponseDto>
    }

    class HubApiRemoteDataSource(
        private val client: HubApiClient,
    ) : RemoteDataSource {
        override suspend fun bootstrap(deviceId: String?): HubNetworkResult<BootstrapResponseDto> =
            client.bootstrap(deviceId = deviceId)

        override suspend fun registerDevice(
            request: RegisterDeviceRequestDto,
        ): HubNetworkResult<RegisterDeviceResponseDto> = client.registerDevice(request)
    }
}
