package dev.stellive.hub.feature.home

import dev.stellive.hub.core.device.DeviceIdStore
import dev.stellive.hub.core.model.NotificationSettingState
import dev.stellive.hub.core.network.BootstrapResponseDto
import dev.stellive.hub.core.network.HubApiClient
import dev.stellive.hub.core.network.HubNetworkResult
import dev.stellive.hub.core.network.LiveStatusDto
import dev.stellive.hub.core.network.RegisterDeviceRequestDto
import dev.stellive.hub.core.network.RegisterDeviceResponseDto
import java.time.Instant

class ServerHubRepository(
    private val remoteDataSource: RemoteDataSource,
    private val deviceIdStore: DeviceIdStore,
    private val fallback: MockHubRepository,
) : HubRepository {
    override suspend fun bootstrap(): HubDataState {
        val deviceId = deviceIdStore.getDeviceId()
        val response = remoteDataSource.bootstrap(deviceId)
        if (response is HubNetworkResult.Success) {
            if (response.value.device == null) {
                registerDevice()
            }
            return fallback.bootstrap().mergeLiveStatus(response.value.liveStatus)
        }
        return fallback.bootstrap().copy(liveStatusSourceLabel = "서버 연결 실패 · 앱 내 목업")
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

    private fun HubDataState.mergeLiveStatus(liveStatus: List<LiveStatusDto>): HubDataState {
        if (liveStatus.isEmpty()) return copy(liveStatusSourceLabel = "서버 연결됨 · 라이브 폴링 꺼짐/데이터 없음")
    val liveStatusByMemberId = liveStatus.associateBy { it.memberId }
    return copy(
        liveStatusSourceLabel = "서버 liveStatus",
        members = members.map { member ->
                val status = liveStatusByMemberId[member.id] ?: return@map member.copy(isLive = false, liveStartedAt = null)
                member.copy(
                    isLive = status.isLive,
                    liveStartedAt = status.startedAt?.let(::parseInstantOrNull),
                )
            }
        )
    }

    private fun parseInstantOrNull(value: String): Instant? =
        runCatching { Instant.parse(value) }.getOrNull()

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
