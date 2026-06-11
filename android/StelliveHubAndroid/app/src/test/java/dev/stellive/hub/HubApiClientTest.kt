package dev.stellive.hub

import dev.stellive.hub.core.network.BootstrapResponseDto
import dev.stellive.hub.core.network.HubApi
import dev.stellive.hub.core.network.HubApiClient
import dev.stellive.hub.core.network.HubNetworkResult
import dev.stellive.hub.core.network.MobileConfigDto
import dev.stellive.hub.core.network.PreferencesResponseDto
import dev.stellive.hub.core.network.RegisterDeviceRequestDto
import dev.stellive.hub.core.network.RegisterDeviceResponseDto
import dev.stellive.hub.core.network.UpdateDeviceTokenRequestDto
import dev.stellive.hub.core.network.UpdateDeviceTokenResponseDto
import dev.stellive.hub.core.network.UpdatePreferencesRequestDto
import dev.stellive.hub.core.network.UpdatePreferencesResponseDto
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class HubApiClientTest {
    @Test
    fun bootstrapReturnsSuccessFromApi() = runTest {
        val client = HubApiClient(
            api = FakeHubApi(
                bootstrapResponse = BootstrapResponseDto(
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
                    catalog = null,
                    preferences = emptyList(),
                    liveStatus = emptyList(),
                    hubEventsSummary = null,
                    hubCalendarWidgetSnapshot = null,
                    serverTime = "2026-06-11T03:00:00.000Z",
                ),
            ),
        )

        val result = client.bootstrap(deviceId = null)

        assertTrue(result is HubNetworkResult.Success)
        assertEquals("seed-2026-06-01", (result as HubNetworkResult.Success).value.config.catalogVersion)
    }

    @Test
    fun tokenUpdateFailureDoesNotExposeTokenValue() = runTest {
        val token = "secret-fcm-token"
        val client = HubApiClient(api = FakeHubApi(failure = IOException("network failed")))

        val result = client.updateDeviceToken(
            UpdateDeviceTokenRequestDto(
                deviceId = "device-1",
                platform = "android",
                provider = "fcm",
                token = token,
                appVersion = "0.1.0",
                locale = "ko-KR",
                timezone = "Asia/Seoul",
            ),
        )

        assertTrue(result is HubNetworkResult.Failure)
        assertFalse(result.toString().contains(token))
    }

    private class FakeHubApi(
        private val bootstrapResponse: BootstrapResponseDto? = null,
        private val failure: Throwable? = null,
    ) : HubApi {
        override suspend fun bootstrap(
            deviceId: String?,
            platform: String,
            appVersion: String?,
            locale: String?,
            timezone: String?,
        ): BootstrapResponseDto {
            failure?.let { throw it }
            return requireNotNull(bootstrapResponse)
        }

        override suspend fun registerDevice(request: RegisterDeviceRequestDto): RegisterDeviceResponseDto =
            RegisterDeviceResponseDto(
                deviceId = request.deviceId ?: "device-1",
                registered = true,
                serverTime = "2026-06-11T03:00:00.000Z",
            )

        override suspend fun updateDeviceToken(
            request: UpdateDeviceTokenRequestDto,
        ): UpdateDeviceTokenResponseDto {
            failure?.let { throw it }
            return UpdateDeviceTokenResponseDto(
                updated = true,
                tokenStatus = "active",
                serverTime = "2026-06-11T03:00:00.000Z",
            )
        }

        override suspend fun preferences(deviceId: String): PreferencesResponseDto =
            PreferencesResponseDto(
                deviceId = deviceId,
                preferences = emptyList(),
                updatedAt = "2026-06-11T03:00:00.000Z",
            )

        override suspend fun updatePreferences(
            request: UpdatePreferencesRequestDto,
        ): UpdatePreferencesResponseDto =
            UpdatePreferencesResponseDto(
                deviceId = request.deviceId,
                preferences = request.preferences,
                updatedAt = request.clientUpdatedAt,
            )
    }
}
