package dev.stellive.hub

import dev.stellive.hub.core.device.DeviceIdStore
import dev.stellive.hub.core.network.BootstrapResponseDto
import dev.stellive.hub.core.network.HubCalendarResponseDto
import dev.stellive.hub.core.network.HubEventDto
import dev.stellive.hub.core.network.HubEventsListResponseDto
import dev.stellive.hub.core.network.HubNetworkResult
import dev.stellive.hub.core.network.LiveStatusDto
import dev.stellive.hub.core.network.MobileConfigDto
import dev.stellive.hub.core.network.RegisterDeviceRequestDto
import dev.stellive.hub.core.network.RegisterDeviceResponseDto
import dev.stellive.hub.feature.home.MockHubRepository
import dev.stellive.hub.feature.home.ServerHubRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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
        val yuni = state.members.first { it.id == "ayatsuno-yuni" }
        assertTrue(yuni.isLive)
        assertEquals("2026-06-11T03:00:00Z", yuni.liveStartedAt.toString())
        assertEquals("유니랑 밤 산책 게임하고 노래 조금", yuni.liveTitle)
        assertEquals(1234, yuni.liveViewerCount)
        assertEquals("https://chzzk.naver.com/live/chzzk-channel-id", yuni.livePlatformUrl)
        assertEquals("https://img.example/yuni.jpg", yuni.channelImageUrl)
        assertEquals("2026-06-11T03:01:00Z", yuni.liveLastCheckedAt.toString())
        val huya = state.members.first { it.id == "sakihane-huya" }
        assertFalse(huya.isLive)
        assertNull(huya.liveStartedAt)
        assertNull(huya.liveTitle)
        assertNull(huya.liveViewerCount)
        assertNull(huya.livePlatformUrl)
        assertNull(huya.liveLastCheckedAt)
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
                liveStatus = listOf(
                    LiveStatusDto(
                        memberId = "ayatsuno-yuni",
                        generationId = "gen1",
                    platform = "chzzk",
                    isLive = true,
                    title = "유니랑 밤 산책 게임하고 노래 조금",
                    viewerCount = 1234,
                    startedAt = "2026-06-11T03:00:00.000Z",
                    channelImageUrl = "https://img.example/yuni.jpg",
                    platformUrl = "https://chzzk.naver.com/live/chzzk-channel-id",
                        lastCheckedAt = "2026-06-11T03:01:00.000Z",
                        sourceVerificationState = "verified",
                    ),
                ),
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

        override suspend fun hubEvents(
            generationId: String?,
            limit: Int?,
        ): HubNetworkResult<HubEventsListResponseDto> =
            HubNetworkResult.Success(HubEventsListResponseDto())

        override suspend fun hubEvent(id: String): HubNetworkResult<HubEventDto> =
            HubNetworkResult.Failure("not_found", "not found")

        override suspend fun hubEventsCalendar(
            from: String,
            to: String,
            timezone: String,
        ): HubNetworkResult<HubCalendarResponseDto> =
            HubNetworkResult.Success(
                HubCalendarResponseDto(
                    timezone = timezone,
                    generatedAt = "2026-06-11T03:00:00.000Z",
                ),
            )
    }
}
