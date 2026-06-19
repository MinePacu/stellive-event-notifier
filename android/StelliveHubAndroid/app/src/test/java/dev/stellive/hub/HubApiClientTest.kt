package dev.stellive.hub

import dev.stellive.hub.core.network.BootstrapResponseDto
import dev.stellive.hub.core.network.HubApi
import dev.stellive.hub.core.network.HubApiClient
import dev.stellive.hub.core.network.HubCalendarDayDto
import dev.stellive.hub.core.network.HubCalendarEntryDto
import dev.stellive.hub.core.network.HubCalendarResponseDto
import dev.stellive.hub.core.network.HubEventDto
import dev.stellive.hub.core.network.HubEventsListResponseDto
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
    fun bootstrapDtoDecodesRealServerShapeWithMissingOptionalFields() {
        val json = """
            {
              "config": {
                "unofficialProject": true,
                "catalogVersion": "seed-2026-06-01",
                "officialYoutubeLiveExcluded": true,
                "xNotificationsEnabled": false,
                "xDisabledReason": "x_notifications_dropped_for_mvp",
                "hubCalendarEnabled": true
              },
              "generations": [{"id":"gen1","displayName":"1기생","sortOrder":1,"type":"member","notificationDefaultEnabled":true}],
              "members": [],
              "preferences": [],
              "liveStatus": [],
              "hubEventsSummary": {"openCount":1,"upcomingCount":0,"closingSoonCount":0}
            }
        """.trimIndent()

        val decoded = HubApiClient.moshi().adapter(BootstrapResponseDto::class.java).fromJson(json)

        assertEquals("seed-2026-06-01", decoded?.config?.catalogVersion)
        assertEquals(false, decoded?.config?.foregroundRealtimeEnabled ?: false)
        assertEquals(1, decoded?.effectiveCatalog?.generations?.size)
        assertEquals(0, decoded?.liveStatus?.size)
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

    @Test
    fun hubEventsClientReturnsListDetailAndCalendarResponses() = runTest {
        val event = HubEventDto(
            id = "server-event",
            category = "online_goods",
            participationMode = "online",
            status = "open",
            title = "서버 굿즈",
            generationId = "official",
            sourceUrl = "https://example.com/event",
            sourceLabel = "공식 공지",
            sourceType = "official",
            updatedAt = "2026-06-18T00:00:00.000Z",
        )
        val client = HubApiClient(
            api = FakeHubApi(
                hubEventsResponse = HubEventsListResponseDto(items = listOf(event)),
                hubEventResponse = event,
                calendarResponse = HubCalendarResponseDto(
                    timezone = "Asia/Seoul",
                    generatedAt = "2026-06-18T00:00:00.000Z",
                    days = listOf(
                        HubCalendarDayDto(
                            date = "2026-06-18",
                            entries = listOf(
                                HubCalendarEntryDto(
                                    id = "server-event:2026-06-18",
                                    eventId = "server-event",
                                    entryKind = "hub_event",
                                    title = "서버 굿즈",
                                    category = "online_goods",
                                    status = "open",
                                    participationMode = "online",
                                    generationId = "official",
                                    displayDate = "2026-06-18",
                                    displayTimeText = "종일",
                                    sourceLabel = "공식 공지",
                                    appDeepLink = "stellivehub://hub-events/server-event",
                                    platformUrl = "https://example.com/event",
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        )

        val list = client.hubEvents(limit = 10)
        val detail = client.hubEvent("server-event")
        val calendar = client.hubEventsCalendar(from = "2026-06-01", to = "2026-06-30", timezone = "Asia/Seoul")

        assertEquals("server-event", (list as HubNetworkResult.Success).value.items.single().id)
        assertEquals("server-event", (detail as HubNetworkResult.Success).value.id)
        assertEquals("server-event", (calendar as HubNetworkResult.Success).value.days.single().entries.single().eventId)
    }

    @Test
    fun hubEventDtosDecodePublicServerShape() {
        val json = """
            {
              "items": [
                {
                  "id": "server-event",
                  "category": "online_goods",
                  "participationMode": "online",
                  "status": "open",
                  "title": "서버 굿즈",
                  "generationId": "official",
                  "sourceUrl": "https://example.com/event",
                  "sourceLabel": "공식 공지",
                  "sourceType": "official",
                  "image": {"policyState": "official_runtime_url", "url": "https://example.com/event.jpg"},
                  "notificationEligible": true,
                  "updatedAt": "2026-06-18T00:00:00.000Z"
                }
              ]
            }
        """.trimIndent()

        val decoded = HubApiClient.moshi().adapter(HubEventsListResponseDto::class.java).fromJson(json)

        assertEquals("server-event", decoded?.items?.single()?.id)
        assertEquals("official_runtime_url", decoded?.items?.single()?.image?.policyState)
    }

    @Test
    fun hubCalendarDtosDecodePublicServerShapeWithoutGeneratedAt() {
        val json = """
            {
              "timezone": "Asia/Seoul",
              "from": "2026-07-10",
              "to": "2026-07-12",
              "days": [
                {
                  "date": "2026-07-11",
                  "entries": [
                    {
                      "id": "server-event:2026-07-11",
                      "eventId": "server-event",
                      "entryKind": "hub_event",
                      "title": "서버 행사",
                      "category": "offline_concert",
                      "status": "upcoming",
                      "participationMode": "offline",
                      "generationId": "official",
                      "startsAt": "2026-07-11T09:00:00.000Z",
                      "endsAt": "2026-07-11T14:00:00.000Z",
                      "displayDate": "2026-07-11",
                      "displayTimeText": "18:00 시작",
                      "sourceLabel": "공식 공지",
                      "appDeepLink": "stellivehub://hub-events/server-event",
                      "platformUrl": "https://example.com/event"
                    }
                  ]
                }
              ]
            }
        """.trimIndent()

        val decoded = HubApiClient.moshi().adapter(HubCalendarResponseDto::class.java).fromJson(json)

        assertEquals("Asia/Seoul", decoded?.timezone)
        assertEquals("server-event", decoded?.days?.single()?.entries?.single()?.eventId)
    }

    private class FakeHubApi(
        private val bootstrapResponse: BootstrapResponseDto? = null,
        private val hubEventsResponse: HubEventsListResponseDto = HubEventsListResponseDto(),
        private val hubEventResponse: HubEventDto = HubEventDto(id = "event", title = "event"),
        private val calendarResponse: HubCalendarResponseDto = HubCalendarResponseDto(
            timezone = "Asia/Seoul",
            generatedAt = "2026-06-18T00:00:00.000Z",
        ),
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

        override suspend fun hubEvents(
            category: String?,
            participationMode: String?,
            status: String?,
            generationId: String?,
            memberId: String?,
            from: String?,
            to: String?,
            limit: Int?,
        ): HubEventsListResponseDto {
            failure?.let { throw it }
            return hubEventsResponse
        }

        override suspend fun hubEvent(id: String): HubEventDto {
            failure?.let { throw it }
            return hubEventResponse
        }

        override suspend fun hubEventsCalendar(
            from: String,
            to: String,
            timezone: String,
        ): HubCalendarResponseDto {
            failure?.let { throw it }
            return calendarResponse
        }
    }
}
