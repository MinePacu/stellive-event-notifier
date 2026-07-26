package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.device.DeviceIdStore
import dev.minepacu.stelliveeventnotifier.core.network.BootstrapResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.BootstrapCatalogDto
import dev.minepacu.stelliveeventnotifier.core.network.HubCalendarResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.HubCalendarDayDto
import dev.minepacu.stelliveeventnotifier.core.network.HubCalendarEntryDto
import dev.minepacu.stelliveeventnotifier.core.network.HubEventDto
import dev.minepacu.stelliveeventnotifier.core.network.HubEventScheduleItemDto
import dev.minepacu.stelliveeventnotifier.core.network.HubEventsListResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.HubNetworkResult
import dev.minepacu.stelliveeventnotifier.core.network.LiveStatusDto
import dev.minepacu.stelliveeventnotifier.core.network.MemberDto
import dev.minepacu.stelliveeventnotifier.core.network.MusicCatalogItemDto
import dev.minepacu.stelliveeventnotifier.core.network.MusicListResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.MusicMemberSummaryDto
import dev.minepacu.stelliveeventnotifier.core.network.MusicSourcePlaylistDto
import dev.minepacu.stelliveeventnotifier.core.network.MobileConfigDto
import dev.minepacu.stelliveeventnotifier.core.network.PreferenceDto
import dev.minepacu.stelliveeventnotifier.core.network.PreferencesResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.RegisterDeviceRequestDto
import dev.minepacu.stelliveeventnotifier.core.network.RegisterDeviceResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdatePreferencesRequestDto
import dev.minepacu.stelliveeventnotifier.core.network.UpdatePreferencesResponseDto
import dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState
import dev.minepacu.stelliveeventnotifier.core.model.HubEventTag
import dev.minepacu.stelliveeventnotifier.core.network.SongCatalogItemDto
import dev.minepacu.stelliveeventnotifier.core.network.SongFacetSummaryDto
import dev.minepacu.stelliveeventnotifier.core.network.SongFacetsResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.SongFilterCountDto
import dev.minepacu.stelliveeventnotifier.core.network.SongListResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.SongThumbnailDto
import dev.minepacu.stelliveeventnotifier.core.network.YoutubePremiereMetadataDto
import dev.minepacu.stelliveeventnotifier.core.network.ServiceAnnouncementDto
import dev.minepacu.stelliveeventnotifier.core.network.ServiceAnnouncementListResponseDto
import dev.minepacu.stelliveeventnotifier.feature.home.MockHubRepository
import dev.minepacu.stelliveeventnotifier.feature.home.ServerHubRepository
import java.time.LocalDate
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ServerHubRepositoryTest {
    @Test
    fun updatePreferencesPreservesScopedRulesAndReplacesGlobalRule() = runTest {
        val remote = RecordingRemoteDataSource()
        val deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()).apply {
            saveDeviceId("device-1")
        }
        val repository = ServerHubRepository(remote, deviceIdStore, MockHubRepository())

        repository.updatePreferences(
            NotificationSettingState(globalEnabled = false, serviceAnnouncementsEnabled = false),
        )

        val sent = remote.lastUpdatePreferencesRequest!!
        assertEquals("device-1", sent.deviceId)
        assertEquals(listOf("member", "global"), sent.preferences.map { it.scope })
        assertFalse(sent.preferences.last().enabled)
        assertEquals(false, sent.preferences.last().serviceAnnouncementsEnabled)
    }

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
        assertEquals("Just Chatting", yuni.liveCategory)
        assertEquals(1234, yuni.liveViewerCount)
        assertEquals("https://chzzk.naver.com/live/chzzk-channel-id", yuni.livePlatformUrl)
        assertEquals("https://img.example/yuni.jpg", yuni.channelImageUrl)
        assertEquals("https://yt.example/yuni.jpg", yuni.profileImageUrl)
        assertEquals("2026-06-11T03:01:00Z", yuni.liveLastCheckedAt.toString())
        val huya = state.members.first { it.id == "sakihane-huya" }
        assertFalse(huya.isLive)
        assertNull(huya.liveStartedAt)
        assertNull(huya.liveTitle)
        assertNull(huya.liveCategory)
        assertNull(huya.liveViewerCount)
        assertNull(huya.livePlatformUrl)
        assertEquals("2026-06-11T03:02:00Z", huya.liveLastCheckedAt.toString())
        assertEquals("https://img.example/huya.jpg", huya.channelImageUrl)
        assertEquals("https://yt.example/huya.jpg", huya.profileImageUrl)
    }

    @Test
    fun hubEventsForwardsDateRange() = runTest {
        val remote = RecordingRemoteDataSource()
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        repository.hubEvents(
            filterId = "all",
            from = LocalDate.of(2026, 6, 1),
            to = LocalDate.of(2026, 9, 30),
        )

        assertEquals("2026-06-01", remote.lastHubEventsFrom)
        assertEquals("2026-09-30", remote.lastHubEventsTo)
    }

    @Test
    fun hubEventsDoesNotSendBuiltInFiltersAsGenerationId() = runTest {
        val remote = RecordingRemoteDataSource()
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        listOf("goods", "album", "ticketing", "offline", "closing").forEach { filterId ->
            repository.hubEvents(filterId = filterId, from = null, to = null)

            assertNull(remote.lastHubEventsGenerationId)
        }
    }

    @Test
    fun hubEventScheduleMappingNormalizesOptionalTitleAndDescription() = runTest {
        val remote = RecordingRemoteDataSource().apply {
            hubEventsResponse = HubEventsListResponseDto(
                items = listOf(
                    HubEventDto(
                        id = "event-1",
                        category = "online_goods",
                        participationMode = "online",
                        status = "upcoming",
                        title = "행사",
                        generationId = "official",
                        sourceUrl = "https://example.com/source",
                        sourceLabel = "공식 공지",
                        sourceType = "official",
                        scheduleMode = "timeline",
                        scheduleItems = listOf(
                            HubEventScheduleItemDto(
                                id = "item-1",
                                kind = "custom",
                                title = "  상세 제목  ",
                                label = "짧은 라벨",
                                description = "   ",
                                startsAt = "2026-07-20T01:00:00.000Z",
                            ),
                        ),
                        updatedAt = "2026-07-19T00:00:00.000Z",
                    ),
                ),
            )
        }
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val item = repository.hubEvents("all", null, null).single().scheduleItems.single()

        assertEquals("상세 제목", item.title)
        assertEquals("짧은 라벨", item.label)
        assertNull(item.description)
    }

    @Test
    fun hubEventTagMappingKeepsAlbumAndIgnoresUnknownValues() = runTest {
        val remote = RecordingRemoteDataSource().apply {
            hubEventsResponse = HubEventsListResponseDto(
                items = listOf(
                    HubEventDto(
                        id = "album-event",
                        category = "ticketing",
                        tags = listOf("album", "future_tag", "ALBUM"),
                        participationMode = "online",
                        status = "upcoming",
                        title = "앨범 예약",
                        generationId = "official",
                        sourceUrl = "https://example.com/source",
                        sourceLabel = "공식 공지",
                        sourceType = "official",
                        updatedAt = "2026-07-19T00:00:00.000Z",
                    ),
                    HubEventDto(
                        id = "plain-event",
                        category = "online_goods",
                        tags = emptyList(),
                        participationMode = "online",
                        status = "open",
                        title = "일반 굿즈",
                        generationId = "official",
                        sourceUrl = "https://example.com/plain",
                        sourceLabel = "공식 공지",
                        sourceType = "official",
                        updatedAt = "2026-07-19T00:00:00.000Z",
                    ),
                ),
            )
        }
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val events = repository.hubEvents("all", null, null).associateBy { it.id }

        assertEquals(listOf(HubEventTag.ALBUM), events.getValue("album-event").tags)
        assertEquals(emptyList<HubEventTag>(), events.getValue("plain-event").tags)
    }

    @Test
    fun hubCalendarTagMappingKeepsAlbumAndIgnoresUnknownValues() = runTest {
        val remote = RecordingRemoteDataSource().apply {
            hubCalendarResponse = HubCalendarResponseDto(
                timezone = "Asia/Seoul",
                days = listOf(
                    HubCalendarDayDto(
                        date = "2026-07-20",
                        entries = listOf(
                            HubCalendarEntryDto(
                                id = "album-event:2026-07-20",
                                eventId = "album-event",
                                entryKind = "hub_event",
                                tags = listOf("future_tag", "album"),
                                title = "앨범 예약",
                                category = "ticketing",
                                status = "upcoming",
                                participationMode = "online",
                                generationId = "official",
                                displayDate = "2026-07-20",
                                displayTimeText = "10:00 시작",
                                sourceLabel = "공식 공지",
                            ),
                        ),
                    ),
                ),
            )
        }
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val entries = repository.hubCalendarDays(
            from = LocalDate.of(2026, 7, 20),
            to = LocalDate.of(2026, 7, 20),
            timezone = "Asia/Seoul",
        ).single().entries

        assertEquals(listOf(HubEventTag.ALBUM), entries.single().tags)
    }

    @Test
    fun bootstrapRegistersDeviceWhenServerSnapshotHasNoDevice() = runTest {
        val deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage())
        val remote = RecordingRemoteDataSource()
        var flushCalls = 0
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = deviceIdStore,
            fallback = MockHubRepository(),
            flushPendingPushToken = { flushCalls += 1 },
        )

        repository.bootstrap()

        assertEquals(1, remote.registerCalls)
        assertEquals("device-created", deviceIdStore.getDeviceId())
        assertEquals(1, flushCalls)
    }

    @Test
    fun songsForwardsFiltersAndMapsServerDtos() = runTest {
        val remote = RecordingRemoteDataSource()
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val songs = repository.songs(
            type = "cover",
            cursor = "cursor-1",
        )

        assertEquals("cover", remote.lastMusicType)
        assertNull(remote.musicCursors.first())
        assertEquals(1, songs.items.size)
        assertEquals("video-1", songs.items.first().id)
        assertEquals("cover", songs.items.first().type.apiValue)
        assertEquals("https://img.youtube.com/vi/video-1/hqdefault.jpg", songs.items.first().thumbnailUrl)
    }

    @Test
    fun songsPreservePremiereMetadataFromOfficialMusicDtos() = runTest {
        val remote = RecordingRemoteDataSource().apply {
            musicResponses = ArrayDeque(listOf(
                MusicListResponseDto(
                    items = listOf(
                        MusicCatalogItemDto(
                            id = "video-1",
                            youtubeVideoId = "video-1",
                            title = "Premiere Cover",
                            type = "cover",
                            publishedAt = "2026-06-27T18:21:27.000Z",
                            members = listOf(
                                MusicMemberSummaryDto(
                                    id = "aokumo-rin",
                                    nameKo = "아오쿠모 린",
                                    nameEn = "Aokumo Rin",
                                    role = "MAIN",
                                    generationId = "gen3",
                                    generationName = "3기생",
                                    unitName = "Cliché",
                                ),
                            ),
                            generationId = "gen3",
                            generationName = "3기생",
                            youtubeUrl = "https://www.youtube.com/watch?v=video-1",
                            premiere = YoutubePremiereMetadataDto(
                                classification = "assumed",
                                state = "scheduled",
                                scheduledStartAt = "2026-06-28T08:00:00.000Z",
                            ),
                        ),
                    ),
                ),
            ))
        }
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val song = repository.songs(type = "cover").items.single()

        assertEquals("scheduled", song.premiere?.state)
        assertEquals("2026-06-28T08:00:00Z", song.premiere?.scheduledStartAt.toString())
        assertEquals("gen3", song.generationId)
        assertEquals("gen3", song.members.single().generationId)
        assertEquals("Cliché", song.members.single().unitName)
    }

    @Test
    fun songsFetchAllOfficialMusicPagesBeforeClientPagination() = runTest {
        val remote = RecordingRemoteDataSource().apply {
            musicResponses = ArrayDeque(listOf(
                officialMusicResponseForTest("video-1", nextCursor = "cursor-2"),
                officialMusicResponseForTest("video-1", "video-2", nextCursor = null),
            ))
        }
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val songs = repository.songs(type = "cover")

        assertEquals(listOf("video-1", "video-2"), songs.items.map { it.youtubeVideoId })
        assertNull(songs.nextCursor)
        assertEquals(listOf(null, "cursor-2"), remote.musicCursors)
        assertEquals(listOf(100, 100), remote.musicLimits)
    }

    @Test
    fun forcedSongRefreshSendsRefreshOnEveryPage() = runTest {
        val remote = RecordingRemoteDataSource().apply {
            musicResponses = ArrayDeque(listOf(
                officialMusicResponseForTest("video-1", nextCursor = "cursor-2"),
                officialMusicResponseForTest("video-2", nextCursor = null),
            ))
        }
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val songs = repository.songs(type = "cover", forceRefresh = true)

        assertEquals(listOf("video-1", "video-2"), songs.items.map { it.youtubeVideoId })
        assertEquals(listOf(true, true), remote.musicRefreshes)
    }

    @Test
    fun normalSongLoadUsesCacheAndFailedForceRefreshKeepsIt() = runTest {
        val remote = RecordingRemoteDataSource().apply {
            musicResponses += officialMusicResponseForTest("cached-video", nextCursor = null)
        }
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val initial = repository.songs(type = "cover")
        val cached = repository.songs(type = "cover")
        remote.failMusic = true
        var refreshFailed = false
        try {
            repository.songs(type = "cover", forceRefresh = true)
        } catch (_: dev.minepacu.stelliveeventnotifier.feature.home.SongRefreshFailedException) {
            refreshFailed = true
        }
        val retained = repository.songs(type = "cover")

        assertTrue(refreshFailed)
        assertEquals(listOf("cached-video"), initial.items.map { it.youtubeVideoId })
        assertEquals(initial, cached)
        assertEquals(initial, retained)
        assertEquals(listOf(false, true), remote.musicRefreshes)
    }

    @Test
    fun songsMapOfficialMusicCollaborationMembers() = runTest {
        val remote = RecordingRemoteDataSource()
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val songs = repository.songs(
            memberId = "yuzuha-riko",
            type = "cover",
        )

        assertEquals("yuzuha-riko", remote.lastMemberMusicMemberId)
        assertEquals("cover", remote.lastMemberMusicType)
        assertEquals(1, songs.items.size)
        assertEquals(listOf("유즈하 리코", "네네코 마시로"), songs.items.single().members.map { it.nameKo })
        assertEquals("https://www.youtube.com/watch?v=video-1", songs.items.single().youtubeUrl)
    }

    @Test
    fun recentSongsRequestsLatestItemsWithoutTypeFilter() = runTest {
        val remote = RecordingRemoteDataSource()
        fun musicResponse(vararg songs: Pair<String, String>, nextCursor: String?): MusicListResponseDto =
            MusicListResponseDto(
                items = songs.map { (videoId, publishedAt) ->
                    MusicCatalogItemDto(
                        id = videoId,
                        youtubeVideoId = videoId,
                        title = "Cover $videoId",
                        type = "cover",
                        publishedAt = publishedAt,
                        members = emptyList(),
                        youtubeUrl = "https://www.youtube.com/watch?v=$videoId",
                    )
                },
                nextCursor = nextCursor,
            )
        remote.musicResponses += musicResponse(
            "old" to "2026-04-01T00:00:00.000Z",
            nextCursor = "cursor-2",
        )
        remote.musicResponses += musicResponse(
            "newest" to "2026-06-29T00:00:00.000Z",
            "middle" to "2026-06-28T00:00:00.000Z",
            nextCursor = null,
        )
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val songs = repository.recentSongs(limit = 5)

        assertNull(remote.lastMusicType)
        assertEquals(listOf(null, "cursor-2"), remote.musicCursors)
        assertEquals(listOf(100, 100), remote.musicLimits)
        assertEquals("publishedAt_desc", remote.lastMusicSort)
        assertEquals(listOf("newest", "middle", "old"), songs.map { it.id })
    }

    @Test
    fun songFacetsMapServerFiltersWithoutGamjaOrOfficial() = runTest {
        val remote = RecordingRemoteDataSource()
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val facets = repository.songFacets()

        assertEquals(listOf("all", "gen1", "gen2", "gen3"), facets.generationFilters.map { it.id })
        assertFalse(facets.generationFilters.any { it.id == "gamja" || it.id == "official" })
        assertEquals(1, facets.summary.original)
        assertEquals(2, facets.summary.cover)
    }

    @Test
    fun songDetailEnhancesListFallbackWithSourcePlaylists() = runTest {
        val remote = RecordingRemoteDataSource()
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )
        val fallback = repository.songs().items.first()

        val detail = repository.songDetail(fallback.id, fallback)

        assertEquals("PL_PRIMARY_123", detail.sourcePlaylists.single().youtubePlaylistId)
        assertTrue(detail.sourcePlaylists.single().isPrimary)
    }

    private class RecordingRemoteDataSource : ServerHubRepository.RemoteDataSource {
        var bootstrapCalls = 0
        var registerCalls = 0
        var lastHubEventsGenerationId: String? = null
        var lastHubEventsFrom: String? = null
        var lastHubEventsTo: String? = null
        var hubEventsResponse = HubEventsListResponseDto()
        var hubCalendarResponse: HubCalendarResponseDto? = null
        var lastSongGenerationId: String? = null
        var lastSongMemberId: String? = null
        var lastSongType: String? = null
        var lastSongQuery: String? = null
        var lastSongCursor: String? = null
        var lastMusicType: String? = null
        var lastMusicCursor: String? = null
        var lastMusicSort: String? = null
        val musicCursors = mutableListOf<String?>()
        val musicLimits = mutableListOf<Int?>()
        val musicRefreshes = mutableListOf<Boolean>()
        var musicResponses = ArrayDeque<MusicListResponseDto>()
        var failMusic = false
        var lastMemberMusicMemberId: String? = null
        var lastMemberMusicType: String? = null
        var lastUpdatePreferencesRequest: UpdatePreferencesRequestDto? = null

        override suspend fun preferences(deviceId: String): HubNetworkResult<PreferencesResponseDto> =
            HubNetworkResult.Success(
                PreferencesResponseDto(
                    deviceId = deviceId,
                    preferences = listOf(
                        PreferenceDto(
                            deviceId = deviceId,
                            scope = "member",
                            memberId = "akane-lize",
                            enabled = true,
                            explicitOverride = true,
                            tapAction = "open_app",
                            deliveryMode = "standard",
                            updatedAt = "2026-07-06T00:00:00Z",
                        ),
                    ),
                    updatedAt = "2026-07-06T00:00:00Z",
                ),
            )

        override suspend fun updatePreferences(
            request: UpdatePreferencesRequestDto,
        ): HubNetworkResult<UpdatePreferencesResponseDto> {
            lastUpdatePreferencesRequest = request
            return HubNetworkResult.Success(
                UpdatePreferencesResponseDto(
                    deviceId = request.deviceId,
                    preferences = request.preferences,
                    updatedAt = request.clientUpdatedAt,
                ),
            )
        }

        override suspend fun bootstrap(deviceId: String?): HubNetworkResult<BootstrapResponseDto> {
            bootstrapCalls += 1
            return HubNetworkResult.Success(
                BootstrapResponseDto(
                    config = MobileConfigDto(
                        unofficialProject = true,
                        catalogVersion = "seed-2026-06-01",
                        officialYoutubeLiveExcluded = true,
                        hubCalendarEnabled = true,
                    foregroundRealtimeEnabled = false,
                ),
                catalog = BootstrapCatalogDto(
                    generations = emptyList(),
                    members = listOf(
                        MemberDto(
                            id = "ayatsuno-yuni",
                            koreanName = "아야츠노 유니",
                            englishName = "Ayatsuno Yuni",
                            generationId = "gen1",
                            generationName = "1기생",
                            unitName = "Everys",
                            catalogRole = "member",
                            activeStatus = "active",
                            isPerson = true,
                            profileImageUrl = "https://yt.example/yuni.jpg",
                        ),
                        MemberDto(
                            id = "sakihane-huya",
                            koreanName = "사키하네 후야",
                            englishName = "Sakihane Huya",
                            generationId = "gen1",
                            generationName = "1기생",
                            unitName = "Everys",
                            catalogRole = "member",
                            activeStatus = "active",
                            isPerson = true,
                            profileImageUrl = "https://yt.example/huya.jpg",
                        ),
                    ),
                ),
                device = null,
                liveStatus = listOf(
                    LiveStatusDto(
                        memberId = "ayatsuno-yuni",
                        generationId = "gen1",
                    platform = "chzzk",
                    isLive = true,
                    title = "유니랑 밤 산책 게임하고 노래 조금",
                    liveCategory = "Just Chatting",
                    viewerCount = 1234,
                    startedAt = "2026-06-11T03:00:00.000Z",
                    channelImageUrl = "https://img.example/yuni.jpg",
                    platformUrl = "https://chzzk.naver.com/live/chzzk-channel-id",
                        lastCheckedAt = "2026-06-11T03:01:00.000Z",
                        sourceVerificationState = "verified",
                    ),
                    LiveStatusDto(
                        memberId = "sakihane-huya",
                        generationId = "gen1",
                        platform = "chzzk",
                        isLive = true,
                        title = null,
                        liveCategory = "Talk",
                        viewerCount = 456,
                        startedAt = "2026-06-11T03:00:00.000Z",
                        channelImageUrl = "https://img.example/huya.jpg",
                        platformUrl = "https://chzzk.naver.com/live/unverified-channel",
                        lastCheckedAt = "2026-06-11T03:02:00.000Z",
                        sourceVerificationState = "verify_required",
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
            from: String?,
            to: String?,
            limit: Int?,
        ): HubNetworkResult<HubEventsListResponseDto> {
            lastHubEventsGenerationId = generationId
            lastHubEventsFrom = from
            lastHubEventsTo = to
            return HubNetworkResult.Success(hubEventsResponse)
        }

        override suspend fun hubEvent(id: String): HubNetworkResult<HubEventDto> =
            HubNetworkResult.Failure("not_found", "not found")

        override suspend fun hubEventsCalendar(
            from: String,
            to: String,
        timezone: String,
        ): HubNetworkResult<HubCalendarResponseDto> =
            HubNetworkResult.Success(
                hubCalendarResponse ?: HubCalendarResponseDto(
                    timezone = timezone,
                    generatedAt = "2026-06-11T03:00:00.000Z",
                ),
            )

        override suspend fun announcements(cursor: String?): HubNetworkResult<ServiceAnnouncementListResponseDto> =
            HubNetworkResult.Success(ServiceAnnouncementListResponseDto())

        override suspend fun announcement(id: String): HubNetworkResult<ServiceAnnouncementDto> =
            HubNetworkResult.Failure(code = "not_supported")

        override suspend fun songs(
            generationId: String?,
            memberId: String?,
            type: String?,
            q: String?,
            cursor: String?,
            limit: Int?,
        ): HubNetworkResult<SongListResponseDto> {
            lastSongGenerationId = generationId
            lastSongMemberId = memberId
            lastSongType = type
            lastSongQuery = q
            lastSongCursor = cursor
            return HubNetworkResult.Success(
                SongListResponseDto(
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
                            thumbnail = SongThumbnailDto(
                                url = "https://i.ytimg.com/vi/abc123/mqdefault.jpg",
                                width = 320,
                                height = 180,
                            ),
                            publishedAt = "2026-06-21T12:00:00.000Z",
                        ),
                    ),
                    nextCursor = "next-cursor",
                ),
            )
        }

        override suspend fun songFacets(
            generationId: String?,
            memberId: String?,
            type: String?,
            q: String?,
        ): HubNetworkResult<SongFacetsResponseDto> =
            HubNetworkResult.Success(
                SongFacetsResponseDto(
                    summary = SongFacetSummaryDto(total = 3, original = 1, cover = 2),
                    generationFilters = listOf(
                        SongFilterCountDto("all", "전체", null, 3),
                        SongFilterCountDto("gen1", "1기생", "gen1", 1),
                        SongFilterCountDto("gen2", "2기생", "gen2", 1),
                        SongFilterCountDto("gen3", "3기생", "gen3", 1),
                    ),
                    memberFilters = emptyList(),
                    typeFilters = emptyList(),
                ),
            )

        override suspend fun music(
            type: String?,
            cursor: String?,
            limit: Int?,
            sort: String?,
            refresh: Boolean,
        ): HubNetworkResult<MusicListResponseDto> {
            lastMusicType = type
            lastMusicCursor = cursor
            lastMusicSort = sort
            musicCursors += cursor
            musicLimits += limit
            musicRefreshes += refresh
            if (failMusic) return HubNetworkResult.Failure(code = "network_error")
            return HubNetworkResult.Success(musicResponses.removeFirstOrNull() ?: officialMusicResponse())
        }

        override suspend fun memberMusic(
            memberId: String,
            type: String?,
            cursor: String?,
            limit: Int?,
            sort: String?,
            refresh: Boolean,
        ): HubNetworkResult<MusicListResponseDto> {
            lastMemberMusicMemberId = memberId
            lastMemberMusicType = type
            musicRefreshes += refresh
            if (failMusic) return HubNetworkResult.Failure(code = "network_error")
            return HubNetworkResult.Success(officialMusicResponse())
        }

        override suspend fun musicDetail(id: String): HubNetworkResult<MusicCatalogItemDto> =
            HubNetworkResult.Success(
                officialMusicResponse().items.first().copy(
                    id = id,
                    sourcePlaylists = listOf(
                        MusicSourcePlaylistDto(
                            youtubePlaylistId = "PL_PRIMARY_123",
                            title = "Primary",
                            type = "cover",
                            youtubeUrl = "https://www.youtube.com/playlist?list=PL_PRIMARY_123",
                            isPrimary = true,
                        ),
                    ),
                ),
            )

        private fun officialMusicResponse(): MusicListResponseDto =
            MusicListResponseDto(
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
                nextCursor = "next-cursor",
            )

        fun officialMusicResponseForTest(
            vararg videoIds: String,
            nextCursor: String?,
        ): MusicListResponseDto = MusicListResponseDto(
            items = videoIds.map { videoId ->
                MusicCatalogItemDto(
                    id = videoId,
                    youtubeVideoId = videoId,
                    title = "Cover $videoId",
                    type = "cover",
                    publishedAt = "2026-06-23T00:00:00.000Z",
                    thumbnailUrl = "https://img.youtube.com/vi/$videoId/hqdefault.jpg",
                    members = listOf(
                        MusicMemberSummaryDto(
                            id = "yuzuha-riko",
                            nameKo = "유즈하 리코",
                            nameEn = "Yuzuha Riko",
                            role = "MAIN",
                        ),
                    ),
                    youtubeUrl = "https://www.youtube.com/watch?v=$videoId",
                    sourcePlaylistId = "playlist-cover",
                )
            },
            nextCursor = nextCursor,
        )
    }
}
