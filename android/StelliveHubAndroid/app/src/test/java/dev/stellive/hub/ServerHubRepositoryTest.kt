package dev.stellive.hub

import dev.stellive.hub.core.device.DeviceIdStore
import dev.stellive.hub.core.network.BootstrapResponseDto
import dev.stellive.hub.core.network.HubCalendarResponseDto
import dev.stellive.hub.core.network.HubEventDto
import dev.stellive.hub.core.network.HubEventsListResponseDto
import dev.stellive.hub.core.network.HubNetworkResult
import dev.stellive.hub.core.network.LiveStatusDto
import dev.stellive.hub.core.network.MusicCatalogItemDto
import dev.stellive.hub.core.network.MusicListResponseDto
import dev.stellive.hub.core.network.MusicMemberSummaryDto
import dev.stellive.hub.core.network.MobileConfigDto
import dev.stellive.hub.core.network.RegisterDeviceRequestDto
import dev.stellive.hub.core.network.RegisterDeviceResponseDto
import dev.stellive.hub.core.network.SongCatalogItemDto
import dev.stellive.hub.core.network.SongFacetSummaryDto
import dev.stellive.hub.core.network.SongFacetsResponseDto
import dev.stellive.hub.core.network.SongFilterCountDto
import dev.stellive.hub.core.network.SongListResponseDto
import dev.stellive.hub.core.network.SongThumbnailDto
import dev.stellive.hub.core.network.YoutubePremiereMetadataDto
import dev.stellive.hub.feature.home.MockHubRepository
import dev.stellive.hub.feature.home.ServerHubRepository
import java.time.LocalDate
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

        listOf("goods", "ticketing", "offline", "closing").forEach { filterId ->
            repository.hubEvents(filterId = filterId, from = null, to = null)

            assertNull(remote.lastHubEventsGenerationId)
        }
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
                                ),
                            ),
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
    fun recentCoverSongsRequestsOnlyTheLatestRequestedItems() = runTest {
        val remote = RecordingRemoteDataSource()
        val repository = ServerHubRepository(
            remoteDataSource = remote,
            deviceIdStore = DeviceIdStore(DeviceIdStore.InMemoryStorage()),
            fallback = MockHubRepository(),
        )

        val songs = repository.recentCoverSongs(limit = 5)

        assertEquals("cover", remote.lastMusicType)
        assertEquals(5, remote.musicLimits.single())
        assertEquals("publishedAt_desc", remote.lastMusicSort)
        assertEquals(1, songs.size)
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

    private class RecordingRemoteDataSource : ServerHubRepository.RemoteDataSource {
        var bootstrapCalls = 0
        var registerCalls = 0
        var lastHubEventsGenerationId: String? = null
        var lastHubEventsFrom: String? = null
        var lastHubEventsTo: String? = null
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
        var musicResponses = ArrayDeque<MusicListResponseDto>()
        var lastMemberMusicMemberId: String? = null
        var lastMemberMusicType: String? = null

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
            from: String?,
            to: String?,
            limit: Int?,
        ): HubNetworkResult<HubEventsListResponseDto> {
            lastHubEventsGenerationId = generationId
            lastHubEventsFrom = from
            lastHubEventsTo = to
            return HubNetworkResult.Success(HubEventsListResponseDto())
        }

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
        ): HubNetworkResult<MusicListResponseDto> {
            lastMusicType = type
            lastMusicCursor = cursor
            lastMusicSort = sort
            musicCursors += cursor
            musicLimits += limit
            return HubNetworkResult.Success(musicResponses.removeFirstOrNull() ?: officialMusicResponse())
        }

        override suspend fun memberMusic(
            memberId: String,
            type: String?,
            cursor: String?,
            limit: Int?,
            sort: String?,
        ): HubNetworkResult<MusicListResponseDto> {
            lastMemberMusicMemberId = memberId
            lastMemberMusicType = type
            return HubNetworkResult.Success(officialMusicResponse())
        }

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
