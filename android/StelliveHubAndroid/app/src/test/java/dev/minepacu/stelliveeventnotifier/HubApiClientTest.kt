package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.network.BootstrapResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.HubApi
import dev.minepacu.stelliveeventnotifier.core.network.HubApiClient
import dev.minepacu.stelliveeventnotifier.core.network.HubCalendarDayDto
import dev.minepacu.stelliveeventnotifier.core.network.HubCalendarEntryDto
import dev.minepacu.stelliveeventnotifier.core.network.HubCalendarFetchResult
import dev.minepacu.stelliveeventnotifier.core.network.HubCalendarResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.HubEventDto
import dev.minepacu.stelliveeventnotifier.core.network.HubEventsListResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.HubNetworkResult
import dev.minepacu.stelliveeventnotifier.core.network.MusicCatalogItemDto
import dev.minepacu.stelliveeventnotifier.core.network.MusicListResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.MusicMemberSummaryDto
import dev.minepacu.stelliveeventnotifier.core.network.MobileConfigDto
import dev.minepacu.stelliveeventnotifier.core.network.PreferencesResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.RegisterDeviceRequestDto
import dev.minepacu.stelliveeventnotifier.core.network.RegisterDeviceResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.SongCatalogItemDto
import dev.minepacu.stelliveeventnotifier.core.network.SongFacetSummaryDto
import dev.minepacu.stelliveeventnotifier.core.network.SongFacetsResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.SongFilterCountDto
import dev.minepacu.stelliveeventnotifier.core.network.SongListResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.SongThumbnailDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdateDeviceTokenRequestDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdateDeviceTokenResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdatePreferencesRequestDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdatePreferencesResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.ServiceAnnouncementDto
import dev.minepacu.stelliveeventnotifier.core.network.ServiceAnnouncementListResponseDto
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
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
    fun preferenceConflictPreservesHttp409AsDedicatedFailureCode() = runTest {
        val conflict = HttpException(
            Response.error<PreferencesResponseDto>(409, "{}".toResponseBody()),
        )
        val client = HubApiClient(api = FakeHubApi(failure = conflict))

        val result = client.updatePreferences(
            UpdatePreferencesRequestDto(
                deviceId = "device-1",
                preferences = emptyList(),
                expectedRevision = 4,
            ),
        )

        assertTrue(result is HubNetworkResult.Failure)
        assertEquals("preference_conflict", (result as HubNetworkResult.Failure).code)
    }

    @Test
    fun preferenceDtosUseRevisionContractWithClientTimestamp() {
        val request = UpdatePreferencesRequestDto(
            deviceId = "device-1",
            preferences = emptyList(),
            expectedRevision = 12,
            clientUpdatedAt = "2026-08-13T00:00:00Z",
        )

        val requestJson = HubApiClient.moshi()
            .adapter(UpdatePreferencesRequestDto::class.java)
            .toJson(request)
        val response = HubApiClient.moshi()
            .adapter(PreferencesResponseDto::class.java)
            .fromJson(
                """{"deviceId":"device-1","preferences":[],"updatedAt":"2026-08-11T00:00:00Z","revision":12}""",
            )

        assertTrue(requestJson.contains("\"expectedRevision\":12"))
        assertTrue(requestJson.contains("clientUpdatedAt"))
        assertEquals(12, response?.revision)
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
        val calendarFetch = (calendar as HubNetworkResult.Success).value as HubCalendarFetchResult.Fresh
        assertEquals("server-event", calendarFetch.response.days.single().entries.single().eventId)
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
                  "scheduleMode": "timeline",
                  "scheduleItems": [{
                    "id": "legacy-item",
                    "kind": "custom",
                    "label": "레거시 라벨",
                    "startsAt": "2026-06-20T01:00:00.000Z",
                    "timePrecision": "datetime",
                    "timezone": "Asia/Seoul",
                    "notificationEligible": true,
                    "isPrimary": true,
                    "sortOrder": 0
                  }],
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
        assertEquals(null, decoded?.items?.single()?.scheduleItems?.single()?.title)
        assertEquals("레거시 라벨", decoded?.items?.single()?.scheduleItems?.single()?.label)
        assertEquals(emptyList<String>(), decoded?.items?.single()?.tags)
    }

    @Test
    fun hubEventDtoTagsDecodeMissingEmptyAndFutureValuesSafely() {
        val json = """
            {
              "items": [
                {"id": "missing", "title": "태그 없음"},
                {"id": "empty", "title": "빈 태그", "tags": []},
                {"id": "tagged", "title": "앨범", "tags": ["album", "future_tag"]}
              ]
            }
        """.trimIndent()

        val decoded = HubApiClient.moshi().adapter(HubEventsListResponseDto::class.java).fromJson(json)

        assertEquals(emptyList<String>(), decoded?.items?.first { it.id == "missing" }?.tags)
        assertEquals(emptyList<String>(), decoded?.items?.first { it.id == "empty" }?.tags)
        assertEquals(listOf("album", "future_tag"), decoded?.items?.first { it.id == "tagged" }?.tags)
    }

    @Test
    fun announcementListAndDetailDtosDecodePublicServerShape() {
        val itemJson = """
            {
              "id":"notice-1","type":"maintenance","severity":"important",
              "title":"점검 안내","summary":"서비스 점검 예정","body":"01시부터 점검합니다.",
              "isPinned":true,"targetPlatforms":["android"],"publishedAt":"2026-07-16T00:00:00.000Z",
              "attentionRevision":2,"revision":3,"updatedAt":"2026-07-16T01:00:00.000Z"
            }
        """.trimIndent()
        val list = HubApiClient.moshi().adapter(ServiceAnnouncementListResponseDto::class.java)
            .fromJson("""{"items":[$itemJson],"nextCursor":"notice-0","generatedAt":"2026-07-16T02:00:00.000Z"}""")
        val detail = HubApiClient.moshi().adapter(ServiceAnnouncementDto::class.java).fromJson(itemJson)

        assertEquals("maintenance", list?.items?.single()?.type)
        assertEquals(2, detail?.attentionRevision)
        assertEquals(list?.items?.single()?.id, detail?.id)
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
                      "displayTitle": "서버 행사 세부 일정",
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
        assertEquals("서버 행사 세부 일정", decoded?.days?.single()?.entries?.single()?.displayTitle)
        assertEquals(emptyList<String>(), decoded?.days?.single()?.entries?.single()?.tags)
    }

    @Test
    fun songClientReturnsListAndFacetResponses() = runTest {
        val client = HubApiClient(
            api = FakeHubApi(
                songsResponse = SongListResponseDto(
                    items = listOf(
                        SongCatalogItemDto(
                            id = "song-1",
                            youtubeVideoId = "abc123",
                            title = "별빛 항로",
                            memberId = "akane-lize",
                            memberName = "아카네 리제",
                            generationId = "gen2",
                            generationName = "2기생",
                            type = "original",
                            sourceUrl = "https://www.youtube.com/watch?v=abc123",
                            thumbnail = SongThumbnailDto("https://i.ytimg.com/vi/abc123/mqdefault.jpg", 320, 180),
                            publishedAt = "2026-06-21T12:00:00.000Z",
                        ),
                    ),
                ),
                songFacetsResponse = SongFacetsResponseDto(
                    summary = SongFacetSummaryDto(total = 1, original = 1, cover = 0),
                    generationFilters = listOf(SongFilterCountDto("gen2", "2기생", "gen2", 1)),
                ),
            ),
        )

        val list = client.songs(generationId = "gen2", type = "original")
        val facets = client.songFacets(generationId = "gen2")

        assertEquals("song-1", (list as HubNetworkResult.Success).value.items.single().id)
        assertEquals(1, (facets as HubNetworkResult.Success).value.summary.original)
    }

    @Test
    fun songAndMusicDtosDecodePremiereMetadata() {
        val songsJson = """
            {
              "items": [
                {
                  "id": "song-1",
                  "youtubeVideoId": "abc123",
                  "title": "물떼새",
                  "memberId": "aokumo-rin",
                  "memberName": "아오쿠모 린",
                  "generationId": "gen3",
                  "generationName": "3기생",
                  "type": "cover",
                  "sourceUrl": "https://www.youtube.com/watch?v=abc123",
                  "publishedAt": "2026-06-27T18:21:27.000Z",
                  "premiere": {
                    "classification": "assumed",
                    "state": "scheduled",
                    "scheduledStartAt": "2026-06-28T08:00:00.000Z",
                    "actualStartAt": null,
                    "actualEndAt": null
                  }
                }
              ],
              "nextCursor": null
            }
        """.trimIndent()
        val musicJson = """
            {
              "items": [
                {
                  "id": "music-1",
                  "youtubeVideoId": "abc123",
                  "title": "물떼새",
                  "type": "cover",
                  "publishedAt": "2026-06-27T18:21:27.000Z",
                  "members": [],
                  "youtubeUrl": "https://www.youtube.com/watch?v=abc123",
                  "premiere": {
                    "classification": "assumed",
                    "state": "live",
                    "scheduledStartAt": "2026-06-28T08:00:00.000Z",
                    "actualStartAt": "2026-06-28T08:00:02.000Z",
                    "actualEndAt": null
                  }
                }
              ],
              "nextCursor": null
            }
        """.trimIndent()

        val songs = HubApiClient.moshi().adapter(SongListResponseDto::class.java).fromJson(songsJson)
        val music = HubApiClient.moshi().adapter(MusicListResponseDto::class.java).fromJson(musicJson)

        assertEquals("scheduled", songs?.items?.single()?.premiere?.state)
        assertEquals("2026-06-28T08:00:00.000Z", songs?.items?.single()?.premiere?.scheduledStartAt)
        assertEquals("live", music?.items?.single()?.premiere?.state)
        assertEquals("2026-06-28T08:00:02.000Z", music?.items?.single()?.premiere?.actualStartAt)
    }

    @Test
    fun musicClientReturnsOfficialMusicResponse() = runTest {
        val fakeApi = FakeHubApi(
            musicResponse = MusicListResponseDto(
                items = listOf(
                    MusicCatalogItemDto(
                        id = "video-1",
                        youtubeVideoId = "video-1",
                        title = "Collab Cover",
                        type = "cover",
                        publishedAt = "2026-06-23T00:00:00.000Z",
                        thumbnailUrl = "https://img.youtube.com/vi/video-1/hqdefault.jpg",
                        duration = "PT3M",
                        durationSeconds = 180,
                        members = listOf(
                            MusicMemberSummaryDto(
                                id = "yuzuha-riko",
                                nameKo = "유즈하 리코",
                                nameEn = "Yuzuha Riko",
                                role = "MAIN",
                            ),
                            MusicMemberSummaryDto(
                                id = "neneko-mashiro",
                                nameKo = "네네코 마시로",
                                nameEn = "Neneko Mashiro",
                                role = "COLLAB",
                            ),
                        ),
                        youtubeUrl = "https://www.youtube.com/watch?v=video-1",
                        sourcePlaylistId = "playlist-cover",
                    ),
                ),
            ),
        )
        val client = HubApiClient(api = fakeApi)

        val result = client.music(type = "cover", limit = 30, sort = "publishedAt_desc", refresh = true)

        assertTrue(result is HubNetworkResult.Success)
        val response = (result as HubNetworkResult.Success).value
        assertEquals("cover", fakeApi.lastMusicType)
        assertEquals(30, fakeApi.lastMusicLimit)
        assertEquals("publishedAt_desc", fakeApi.lastMusicSort)
        assertEquals(true, fakeApi.lastMusicRefresh)
        assertEquals(listOf("유즈하 리코", "네네코 마시로"), response.items.single().members.map { it.nameKo })
    }

    private class FakeHubApi(
        private val bootstrapResponse: BootstrapResponseDto? = null,
        private val hubEventsResponse: HubEventsListResponseDto = HubEventsListResponseDto(),
        private val hubEventResponse: HubEventDto = HubEventDto(id = "event", title = "event"),
        private val calendarResponse: HubCalendarResponseDto = HubCalendarResponseDto(
            timezone = "Asia/Seoul",
            generatedAt = "2026-06-18T00:00:00.000Z",
        ),
        private val songsResponse: SongListResponseDto = SongListResponseDto(),
        private val songFacetsResponse: SongFacetsResponseDto = SongFacetsResponseDto(
            summary = SongFacetSummaryDto(total = 0, original = 0, cover = 0),
        ),
        private val musicResponse: MusicListResponseDto = MusicListResponseDto(),
        private val failure: Throwable? = null,
    ) : HubApi {
        var lastMusicType: String? = null
        var lastMusicLimit: Int? = null
        var lastMusicSort: String? = null
        var lastMusicRefresh: Boolean? = null

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

        override suspend fun preferences(deviceId: String): PreferencesResponseDto {
            failure?.let { throw it }
            return PreferencesResponseDto(
                deviceId = deviceId,
                preferences = emptyList(),
                updatedAt = "2026-06-11T03:00:00.000Z",
                revision = 0,
            )
        }

        override suspend fun updatePreferences(
            request: UpdatePreferencesRequestDto,
        ): UpdatePreferencesResponseDto {
            failure?.let { throw it }
            return UpdatePreferencesResponseDto(
                deviceId = request.deviceId,
                preferences = request.preferences,
                updatedAt = "2026-06-11T03:00:00.000Z",
                revision = request.expectedRevision + 1,
            )
        }

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

        override suspend fun announcements(platform: String, appVersion: String?, includeArchived: Boolean, cursor: String?, limit: Int): ServiceAnnouncementListResponseDto =
            ServiceAnnouncementListResponseDto()

        override suspend fun announcement(id: String, platform: String, appVersion: String?): ServiceAnnouncementDto =
            ServiceAnnouncementDto(id, "general", "info", "공지", "요약", "본문", publishedAt = "2026-07-16T00:00:00Z", updatedAt = "2026-07-16T00:00:00Z")

        override suspend fun hubEventsCalendar(
            from: String,
            to: String,
            timezone: String,
            ifModifiedSince: String?,
        ): Response<HubCalendarResponseDto> {
            failure?.let { throw it }
            return Response.success(calendarResponse)
        }

        override suspend fun songs(
            generationId: String?,
            memberId: String?,
            type: String?,
            q: String?,
            cursor: String?,
            limit: Int?,
        ): SongListResponseDto {
            failure?.let { throw it }
            return songsResponse
        }

        override suspend fun songFacets(
            generationId: String?,
            memberId: String?,
            type: String?,
            q: String?,
        ): SongFacetsResponseDto {
            failure?.let { throw it }
            return songFacetsResponse
        }

        override suspend fun music(
            type: String?,
            cursor: String?,
            limit: Int?,
            sort: String?,
            refresh: Boolean?,
        ): MusicListResponseDto {
            failure?.let { throw it }
            lastMusicType = type
            lastMusicLimit = limit
            lastMusicSort = sort
            lastMusicRefresh = refresh
            return musicResponse
        }

        override suspend fun musicDetail(id: String): MusicCatalogItemDto {
            failure?.let { throw it }
            return requireNotNull(musicResponse.items.firstOrNull { it.id == id } ?: musicResponse.items.firstOrNull())
        }

        override suspend fun memberMusic(
            memberId: String,
            type: String?,
            cursor: String?,
            limit: Int?,
            sort: String?,
            refresh: Boolean?,
        ): MusicListResponseDto {
            failure?.let { throw it }
            lastMusicType = type
            lastMusicLimit = limit
            lastMusicSort = sort
            lastMusicRefresh = refresh
            return musicResponse
        }
    }
}
