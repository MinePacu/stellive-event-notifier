package dev.stellive.hub.feature.home

import dev.stellive.hub.core.model.NotificationEventType
import dev.stellive.hub.core.model.NotificationPlatform
import dev.stellive.hub.core.model.NotificationSettingState
import dev.stellive.hub.core.model.ActiveStatus
import dev.stellive.hub.core.model.CatalogRole
import dev.stellive.hub.core.model.HubMember
import dev.stellive.hub.core.model.HubEventCategory
import dev.stellive.hub.core.model.HubEventParticipationMode
import dev.stellive.hub.core.model.HubEventStatus
import dev.stellive.hub.core.model.SongCatalogItem
import dev.stellive.hub.core.model.SongType
import kotlin.math.roundToInt
import dev.stellive.hub.ui.components.TopFilterGroup
import dev.stellive.hub.ui.components.TopFilterOption
import java.text.Collator
import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class StatusSummaryItem(
    val value: String,
    val label: String
)

data class HomeHubEventsAction(
    val title: String,
    val body: String,
    val pills: List<String>
)

data class MainNavigationItem(
    val screenId: String,
    val label: String
)

data class SongFilterOption(
    val id: String,
    val label: String
)

data class SongDisplayText(
    val title: String,
    val subtitle: String,
)

data class LoadingPresentation(
    val title: String,
    val body: String,
    val chipLabel: String,
)

data class SettingsHubRow(
    val screenId: String,
    val title: String,
    val body: String,
    val value: String
)

data class SettingsPolicyRow(
    val title: String,
    val body: String?,
    val checked: Boolean?
)

data class SettingsCardSpacing(
    val contentVerticalPaddingDp: Int,
    val rowVerticalPaddingDp: Int,
    val bottomMarginDp: Int,
)

object MainUiPolicy {
    const val SONG_PAGE_SIZE = 20
    const val SONG_THUMBNAIL_ASPECT_RATIO = 16f / 9f
    const val SONG_FILTER_SEGMENT_SPACING_DP = 12
    private val songPremiereZoneId: ZoneId = ZoneId.of("Asia/Seoul")
    private val songPremiereDateTimeFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("M월 d일 HH:mm", Locale.KOREAN).withZone(songPremiereZoneId)
    private val songTextCollator: Collator = Collator.getInstance(Locale.KOREAN).apply {
        strength = Collator.PRIMARY
    }

    val settingsCardSpacing = SettingsCardSpacing(
        contentVerticalPaddingDp = 10,
        rowVerticalPaddingDp = 6,
        bottomMarginDp = 8,
    )

    private const val TOP_BAR_ACTION_ICON_INSET_DP = 10
    private const val LIVE_CLOCK_REFRESH_DELAY_MILLIS = 1_000L

    fun primaryNavigationItems(): List<MainNavigationItem> = listOf(
        MainNavigationItem("home", "홈"),
        MainNavigationItem("live", "라이브"),
        MainNavigationItem("songs", "노래"),
        MainNavigationItem("goods_events", "굿즈/행사")
    )

    fun liveClockRefreshDelayMillis(screenId: String, hasLiveMembers: Boolean): Long? =
        if (hasLiveMembers && screenId in setOf("home", "live")) LIVE_CLOCK_REFRESH_DELAY_MILLIS else null

    fun showsSettingsTopBarAction(screenId: String, canGoBack: Boolean): Boolean =
        !canGoBack && screenId in primaryNavigationItems().map { it.screenId }

    fun showsTopBarText(screenId: String): Boolean =
        screenId == "goods_event_detail" || screenId == "history" || screenId == "settings" || screenId.startsWith("settings_")

    fun goodsEventDetailTopBarTitle(eventTitle: String): String = ""

    fun goodsEventDetailTopBarRole(): String = ""

    fun topBarTitle(screenId: String): String = when (screenId) {
        "live" -> "라이브"
        "songs" -> "노래"
        "song_search" -> "노래 검색"
        "song_member_filter" -> "노래 멤버 선택"
        "history" -> "기록"
        "settings" -> "설정"
        "settings_delivery" -> "전달 방식"
        "settings_targets" -> "대상별 알림"
        "settings_platforms" -> "플랫폼별 알림"
        "settings_event_types" -> "이벤트 타입"
        "settings_hub_events" -> "굿즈/행사"
        "settings_advanced" -> "고급 설정"
        "goods_events" -> "굿즈/행사"
        "goods_event_detail" -> ""
        else -> "홈"
    }

    fun topBarRole(screenId: String): String = when (screenId) {
        "live" -> "방송 상태와 CHZZK 대상 현황"
        "songs" -> "YouTube 업로드 곡 탐색"
        "song_search" -> "제목 또는 멤버"
        "song_member_filter" -> "노래 목록을 멤버별로 좁혀 봅니다"
        "history" -> "허용된 알림 기록과 정책 제외 항목"
        "settings" -> "알림 대상과 전송 정책"
        "settings_delivery" -> "알림 전달과 제한"
        "settings_targets" -> "카테고리와 개별 항목"
        "settings_platforms" -> "플랫폼별 허용 여부"
        "settings_event_types" -> "이벤트 종류별 허용 여부"
        "settings_hub_events" -> "공식 출처 굿즈와 행사"
        "settings_advanced" -> "조합 예외 규칙"
        "goods_events" -> "공식 출처의 기간성 굿즈와 행사"
        "goods_event_detail" -> ""
        else -> "라이브 현황과 최근 알림"
    }

    fun topBarTitleStartInsetDp(canGoBack: Boolean): Int =
        TOP_BAR_ACTION_ICON_INSET_DP

    fun realtimeDisclosureLines(): List<String> = NotificationSettingState.REALTIME_DISCLOSURE_LINES

    fun hubEventStatusRank(status: HubEventStatus): Int = when (status) {
        HubEventStatus.CLOSING_SOON -> 0
        HubEventStatus.OPEN -> 1
        HubEventStatus.UPCOMING -> 2
        HubEventStatus.ANNOUNCED -> 3
        HubEventStatus.CANCELLED -> 4
        HubEventStatus.ENDED -> 5
    }

    fun homeStatusSummary(liveCount: Int, recentCount: Int, closingSoonCount: Int): List<StatusSummaryItem> = listOf(
        StatusSummaryItem(liveCount.toString(), "지금 라이브"),
        StatusSummaryItem(recentCount.toString(), "최근 알림"),
        StatusSummaryItem(closingSoonCount.toString(), "마감 임박")
    )

    fun homeSummaryCardsVisible(): Boolean = false

    fun goodsEventsSummaryCardsVisible(): Boolean = false

    fun songGenerationFilters(): List<SongFilterOption> = listOf(
        SongFilterOption("all", "전체"),
        SongFilterOption("gen1", "1기생"),
        SongFilterOption("gen2", "2기생"),
        SongFilterOption("gen3", "3기생")
    )

    fun songTypeFilters(): List<SongFilterOption> = listOf(
        SongFilterOption("all", "전체"),
        SongFilterOption("original", "오리지널"),
        SongFilterOption("cover", "커버")
    )

    fun songSortOptions(): List<SongFilterOption> = listOf(
        SongFilterOption("publishedAt_desc", "최신순"),
        SongFilterOption("publishedAt_asc", "오래된순"),
        SongFilterOption("title_asc", "제목순"),
        SongFilterOption("member_asc", "멤버순")
    )

    fun songTopFilterGroups(
        selectedGenerationId: String,
        selectedType: String,
        selectedSortId: String = "publishedAt_desc",
    ): List<TopFilterGroup> = listOf(
        TopFilterGroup(
            id = "generation",
            options = songGenerationFilters().map { TopFilterOption(it.id, it.label) },
            selectedId = selectedGenerationId,
        ),
        TopFilterGroup(
            id = "type",
            options = songTypeFilters().map { TopFilterOption(it.id, it.label) },
            selectedId = selectedType,
        ),
        TopFilterGroup(
            id = "sort",
            options = songSortOptions().map { TopFilterOption(it.id, it.label) },
            selectedId = selectedSortId,
        ),
    )

    fun liveTopFilterGroups(selectedId: String): List<TopFilterGroup> = listOf(
        TopFilterGroup(
            id = "status",
            options = listOf(
                TopFilterOption("live", "방송 중"),
                TopFilterOption("all", "전체"),
                TopFilterOption("offline", "오프라인"),
            ),
            selectedId = selectedId,
        ),
    )

    fun goodsEventsTopFilterGroups(selectedId: String): List<TopFilterGroup> = listOf(
        TopFilterGroup(
            id = "category",
            options = listOf(
                TopFilterOption("all", "전체"),
                TopFilterOption("goods", "굿즈"),
                TopFilterOption("ticketing", "티켓"),
                TopFilterOption("offline", "오프라인"),
                TopFilterOption("closing", "마감 임박"),
            ),
            selectedId = selectedId,
        ),
    )

    fun goodsEventMatchesFilter(
        filterId: String,
        category: HubEventCategory,
        status: HubEventStatus,
        participationMode: HubEventParticipationMode,
    ): Boolean = when (filterId) {
        "goods" -> category == HubEventCategory.ONLINE_GOODS || category == HubEventCategory.ONLINE_COLLAB
        "ticketing" -> category == HubEventCategory.TICKETING
        "offline" -> participationMode == HubEventParticipationMode.OFFLINE ||
            participationMode == HubEventParticipationMode.HYBRID
        "closing" -> status == HubEventStatus.CLOSING_SOON
        else -> true
    }

    fun songExternalUrl(rawUrl: String?): String? {
        val trimmed = rawUrl?.trim().orEmpty()
        return trimmed.takeIf { it.startsWith("https://") || it.startsWith("http://") }
    }

    fun songMemberFilters(members: List<HubMember>): List<SongFilterOption> =
        listOf(SongFilterOption("all", "전체")) + members
            .filter { it.catalogRole == CatalogRole.MEMBER }
            .filter { it.generationId in setOf("gen1", "gen2", "gen3") }
            .map { SongFilterOption(it.id, it.koreanName.ifBlank { it.englishName }) }

    fun songMatchesMember(song: SongCatalogItem, selectedMemberId: String): Boolean {
        if (selectedMemberId == "all") return true
        return song.members.any { it.id == selectedMemberId }
    }

    fun songMemberFilterLabel(members: List<HubMember>, selectedMemberId: String): String =
        if (selectedMemberId == "all") {
            "전체"
        } else {
            members.firstOrNull { it.id == selectedMemberId }?.koreanName?.takeIf { it.isNotBlank() }
                ?: selectedMemberId
        }

    fun canClearSongMemberFilter(selectedMemberId: String): Boolean = selectedMemberId != "all"

    fun songMemberFilterSummary(
        members: List<HubMember>,
        selectedMemberId: String,
        visibleCount: Int,
    ): String = "${songMemberFilterLabel(members, selectedMemberId)} · ${visibleCount}곡"

    fun normalizedSongQuery(query: String): String = query.trim()

    fun recentSongs(songs: List<SongCatalogItem>, limit: Int = 5): List<SongCatalogItem> =
        sortSongs(songs, "publishedAt_desc")
            .take(limit.coerceAtLeast(0))

    fun songSortLabel(sortId: String): String =
        songSortOptions().firstOrNull { it.id == sortId }?.label ?: "최신순"

    fun serverConnectionLabel(sourceLabel: String): String = when {
        sourceLabel.contains("실패") || sourceLabel.contains("목업") -> "오프라인"
        sourceLabel.contains("데이터 없음") || sourceLabel.contains("캐시") -> "캐시 표시 중"
        else -> "서버 연결됨"
    }

    fun homeRecentSongsLoadingPresentation(): LoadingPresentation = LoadingPresentation(
        title = "최근 곡 확인 중",
        body = "서버에서 최신 오리지널곡과 커버곡을 불러오고 있습니다.",
        chipLabel = "노래",
    )

    fun goodsEventsLoadingPresentation(): LoadingPresentation = LoadingPresentation(
        title = "굿즈/행사 불러오는 중",
        body = "서버에서 게시된 굿즈/행사 목록과 캘린더를 가져오고 있습니다.",
        chipLabel = "굿즈/행사",
    )

    fun hubEventDetailLoadingPresentation(): LoadingPresentation = LoadingPresentation(
        title = "상세 정보 불러오는 중",
        body = "서버에서 선택한 굿즈/행사 상세 정보를 가져오고 있습니다.",
        chipLabel = "상세",
    )

    fun songsLoadingPresentation(): LoadingPresentation = LoadingPresentation(
        title = "노래 목록 불러오는 중",
        body = "서버 캐시에서 오리지널곡과 커버곡 목록을 가져오고 있습니다.",
        chipLabel = "노래",
    )

    fun songSearchLoadingPresentation(): LoadingPresentation = LoadingPresentation(
        title = "검색 준비 중",
        body = "검색할 노래 목록을 서버에서 불러오고 있습니다.",
        chipLabel = "검색",
    )

    fun songSearchTransitionLoadingPresentation(): LoadingPresentation = LoadingPresentation(
        title = "노래 검색 여는 중",
        body = "검색 화면을 준비하고 있습니다.",
        chipLabel = "검색",
    )

    fun songThumbnailHeightDp(widthDp: Int): Int = (widthDp / SONG_THUMBNAIL_ASPECT_RATIO).roundToInt()

    fun songDisplayText(song: SongCatalogItem, catalogMembers: List<HubMember> = emptyList()): SongDisplayText {
        val parsed = parsedSongTitle(song)
        return SongDisplayText(
            title = parsed.title.ifBlank { song.title.trim() },
            subtitle = songSubtitleDisplayText(song, parsed.artistNames, catalogMembers),
        )
    }

    fun songTitleDisplayText(song: SongCatalogItem): String = songDisplayText(song).title

    fun songMemberDisplayText(song: SongCatalogItem, catalogMembers: List<HubMember> = emptyList()): String =
        songDisplayText(song, catalogMembers).subtitle

    private data class ParsedSongTitle(
        val title: String,
        val artistNames: List<String>,
    )

    private fun parsedSongTitle(song: SongCatalogItem): ParsedSongTitle {
        val normalizedRawTitle = removeLeadingMediaTags(song.title).trim()
        return when (song.type) {
            SongType.COVER -> parsedCoverSongTitle(normalizedRawTitle)
            SongType.ORIGINAL -> parsedOriginalSongTitle(normalizedRawTitle)
        }
    }

    private fun parsedCoverSongTitle(normalizedRawTitle: String): ParsedSongTitle {
        val delimiter = lastCoverPerformerDelimiter(normalizedRawTitle)
            ?: return ParsedSongTitle(cleanSongTitle(normalizedRawTitle), emptyList())
        val left = normalizedRawTitle.substring(0, delimiter.first).trim()
        val right = normalizedRawTitle.substring(delimiter.first + delimiter.second.length).trim()
        return ParsedSongTitle(
            title = cleanSongTitle(left),
            artistNames = artistNamesFromSegment(right),
        )
    }

    private fun parsedOriginalSongTitle(normalizedRawTitle: String): ParsedSongTitle {
        val quotedTitle = firstQuotedTitle(normalizedRawTitle)
        val delimiter = lastTopLevelDelimiter(normalizedRawTitle, listOf(" | ", "|"))
        return when {
            quotedTitle != null -> ParsedSongTitle(
                title = cleanSongTitle(quotedTitle),
                artistNames = delimiter?.let {
                    artistNamesFromSegment(normalizedRawTitle.substring(0, it.first).trim())
                }.orEmpty(),
            )
            delimiter != null -> {
                val left = normalizedRawTitle.substring(0, delimiter.first).trim()
                val right = normalizedRawTitle.substring(delimiter.first + delimiter.second.length).trim()
                ParsedSongTitle(
                    title = cleanSongTitle(right),
                    artistNames = artistNamesFromSegment(left),
                )
            }
            else -> ParsedSongTitle(cleanSongTitle(normalizedRawTitle), emptyList())
        }
    }

    private fun lastCoverPerformerDelimiter(value: String): Pair<Int, String>? =
        topLevelDelimiters(value, listOf("|", "ㅣ", " / "))
            .asReversed()
            .firstOrNull { delimiter ->
                val right = value.substring(delimiter.first + delimiter.second.length).trim()
                looksLikeCoverPerformerSegment(right)
            }

    private fun looksLikeCoverPerformerSegment(segment: String): Boolean =
        Regex("\\b(3D\\s+Live\\s+Cover|Live\\s+Cover|Cover|covered\\s+by)\\b|【\\s*COVER\\s*】|커버", RegexOption.IGNORE_CASE)
            .containsMatchIn(segment)

    private fun lastTopLevelDelimiter(value: String, delimiters: List<String>): Pair<Int, String>? =
        topLevelDelimiters(value, delimiters).lastOrNull()

    private fun topLevelDelimiters(value: String, delimiters: List<String>): List<Pair<Int, String>> {
        val result = mutableListOf<Pair<Int, String>>()
        var roundDepth = 0
        var squareDepth = 0
        var japaneseDepth = 0
        var index = 0
        while (index < value.length) {
            when (value[index]) {
                '(' -> roundDepth++
                ')' -> roundDepth = (roundDepth - 1).coerceAtLeast(0)
                '[' -> squareDepth++
                ']' -> squareDepth = (squareDepth - 1).coerceAtLeast(0)
                '【', '「', '『' -> japaneseDepth++
                '】', '」', '』' -> japaneseDepth = (japaneseDepth - 1).coerceAtLeast(0)
            }
            if (roundDepth == 0 && squareDepth == 0 && japaneseDepth == 0) {
                val delimiter = delimiters.firstOrNull { value.startsWith(it, index) }
                if (delimiter != null) {
                    result += index to delimiter
                    index += delimiter.length
                    continue
                }
            }
            index++
        }
        return result
    }

    private fun firstQuotedTitle(value: String): String? {
        val patterns = listOf(
            Regex("‘([^’]+)’"),
            Regex("'([^']+)'"),
            Regex("“([^”]+)”"),
            Regex("\"([^\"]+)\""),
        )
        return patterns.firstNotNullOfOrNull { pattern ->
            pattern.find(value)?.groupValues?.getOrNull(1)?.trim()?.takeIf { it.isNotBlank() }
        }
    }

    private fun cleanSongTitle(value: String): String =
        deduplicateRepeatedTitle(
            trimWrappingQuotes(
                removeMusicVideoSuffix(removeLeadingMediaTags(value)).trim()
            ).replace(Regex("\\s+"), " ")
        )

    private fun removeLeadingMediaTags(value: String): String {
        var result = value.trim()
        val mediaTag = Regex("^\\[(4K|8K|MV|Official MV|Official Music Video)]\\s*", RegexOption.IGNORE_CASE)
        while (mediaTag.containsMatchIn(result)) {
            result = mediaTag.replace(result, "").trim()
        }
        return result
    }

    private fun removeMusicVideoSuffix(value: String): String =
        Regex("\\s*(Official\\s+)?(Music\\s+Video|MV)\\s*$", RegexOption.IGNORE_CASE)
            .replace(value, "")
            .trim()

    private fun trimWrappingQuotes(value: String): String =
        value.trim().trim('\'', '"', '‘', '’', '“', '”').trim()

    private fun deduplicateRepeatedTitle(value: String): String {
        val words = value.split(Regex("\\s+")).filter { it.isNotBlank() }
        if (words.size < 2 || words.size % 2 != 0) return value
        val midpoint = words.size / 2
        val left = words.take(midpoint).joinToString(" ")
        val right = words.drop(midpoint).joinToString(" ")
        return if (left.equals(right, ignoreCase = true)) left else value
    }

    private fun artistNamesFromSegment(segment: String): List<String> {
        val cleaned = trimWrappingQuotes(
            Regex("\\b(3D\\s+Live\\s+Cover|Live\\s+Cover|Cover|covered\\s+by)\\b|【\\s*COVER\\s*】|커버|\\b불러보았다\\b", RegexOption.IGNORE_CASE)
                .replace(segment, "")
                .let(::removeMusicVideoSuffix)
                .replace(Regex("\\s+"), " ")
                .trim()
        )
        if (cleaned.isBlank()) return emptyList()
        return cleaned
            .split(Regex("\\s*(?:&|＆|,|、|/|\\+|×|\\s+[xX]\\s+|\\s+and\\s+)\\s*"))
            .map { trimWrappingQuotes(it).replace(Regex("\\s+"), " ").trim() }
            .filter { it.isNotBlank() }
            .distinctBy { normalizedNameKey(it) }
    }

    private fun songSubtitleDisplayText(
        song: SongCatalogItem,
        parsedArtistNames: List<String>,
        catalogMembers: List<HubMember>,
    ): String {
        if (parsedArtistNames.any { normalizedNameKey(it) == normalizedNameKey("스텔라이브") }) {
            return "스텔라이브"
        }
        val memberNames = songMemberNames(song)
        val groupDisplayName = generationGroupDisplayName(song, catalogMembers)
        val baseNames = if (groupDisplayName != null) listOf(groupDisplayName) else memberNames
        val blockedArtistKeys = (memberNames + catalogMembers.flatMap { listOf(it.koreanName, it.englishName, it.unitName, it.generationName) })
            .map(::normalizedNameKey)
            .toSet()
        val externalNames = parsedArtistNames.filter { !isBlockedArtistName(it, blockedArtistKeys) }
        return (baseNames + externalNames)
            .filter { it.isNotBlank() }
            .distinctBy { normalizedNameKey(it) }
            .takeIf { it.isNotEmpty() }
            ?.joinToString(" · ")
            ?: song.memberName?.takeIf { it.isNotBlank() }
            ?: "스텔라이브"
    }

    private fun isBlockedArtistName(name: String, blockedArtistKeys: Set<String>): Boolean {
        val nameKey = normalizedNameKey(name)
        return blockedArtistKeys.any { blockedKey ->
            blockedKey.isNotBlank() && (nameKey == blockedKey || nameKey.contains(blockedKey) || blockedKey.contains(nameKey))
        }
    }

    private fun songMemberNames(song: SongCatalogItem): List<String> =
        song.members
            .map { it.nameKo.ifBlank { it.nameEn.orEmpty() } }
            .filter { it.isNotBlank() }
            .distinctBy { normalizedNameKey(it) }

    private fun generationGroupDisplayName(song: SongCatalogItem, catalogMembers: List<HubMember>): String? {
        val songMemberIds = song.members.map { it.id }.toSet()
        if (songMemberIds.isEmpty() || catalogMembers.isEmpty()) return null
        val activeCatalogMembers = catalogMembers.filter {
            it.catalogRole == CatalogRole.MEMBER && it.activeStatus == ActiveStatus.ACTIVE
        }
        val songCatalogMembers = activeCatalogMembers.filter { it.id in songMemberIds }
        val generationId = songCatalogMembers.firstOrNull()?.generationId ?: return null
        if (songCatalogMembers.any { it.generationId != generationId }) return null
        val generationMembers = activeCatalogMembers.filter { it.generationId == generationId }
        if (generationMembers.isEmpty() || songMemberIds != generationMembers.map { it.id }.toSet()) return null
        val representative = generationMembers.first()
        val unitName = representative.unitName.takeIf { it.isNotBlank() }
        val generationName = representative.generationName.takeIf { it.isNotBlank() } ?: generationId
        return if (unitName != null && unitName != generationName) "$unitName ($generationName)" else generationName
    }

    private fun normalizedNameKey(value: String): String =
        value.lowercase(Locale.ROOT).replace(Regex("\\s+"), "")

    fun sortSongs(songs: List<SongCatalogItem>, sortId: String): List<SongCatalogItem> =
        songs.sortedWith(
            when (sortId) {
                "publishedAt_asc" -> compareBy<SongCatalogItem> { it.publishedAt == Instant.EPOCH }
                    .thenBy { it.publishedAt }
                    .thenComparator { left, right -> compareSongTitle(left, right) }
                "title_asc" -> Comparator { left, right -> compareSongTitle(left, right) }
                "member_asc" -> Comparator { left, right -> compareSongMember(left, right) }
                else -> compareBy<SongCatalogItem> { it.publishedAt == Instant.EPOCH }
                    .thenComparator { left, right -> right.publishedAt.compareTo(left.publishedAt) }
                    .thenComparator { left, right -> compareSongTitle(left, right) }
            }
        )

    private fun compareSongTitle(left: SongCatalogItem, right: SongCatalogItem): Int {
        val byTitle = songTextCollator.compare(left.title, right.title)
        return if (byTitle != 0) byTitle else left.id.compareTo(right.id)
    }

    private fun compareSongMember(left: SongCatalogItem, right: SongCatalogItem): Int {
        val byMember = songTextCollator.compare(songMemberDisplayText(left), songMemberDisplayText(right))
        return if (byMember != 0) byMember else compareSongTitle(left, right)
    }

    fun songPremiereStatusLabel(song: SongCatalogItem): String? = when (song.premiere?.state) {
        "scheduled" -> song.premiere.scheduledStartAt
            ?.let { "최초 공개 예정 · ${songPremiereDateTimeFormatter.format(it)}" }
            ?: "최초 공개 예정"
        "live" -> "최초 공개 중"
        else -> null
    }

    fun songMatchesGeneration(
        song: SongCatalogItem,
        selectedGenerationId: String,
        memberGenerationById: Map<String, String>,
    ): Boolean {
        if (selectedGenerationId == "all") return true
        return song.members.any { memberGenerationById[it.id] == selectedGenerationId }
    }

    fun songMatchesQuery(song: SongCatalogItem, query: String, catalogMembers: List<HubMember> = emptyList()): Boolean {
        if (query.isBlank()) return true
        val display = songDisplayText(song, catalogMembers)
        return display.title.contains(query, ignoreCase = true) ||
            display.subtitle.contains(query, ignoreCase = true)
    }

    fun songPageCount(totalItems: Int, pageSize: Int = SONG_PAGE_SIZE): Int {
        if (totalItems <= 0) return 1
        return ((totalItems - 1) / pageSize) + 1
    }

    fun coerceSongPage(page: Int, totalItems: Int, pageSize: Int = SONG_PAGE_SIZE): Int =
        page.coerceIn(1, songPageCount(totalItems, pageSize))

    fun songPageItems(
        songs: List<SongCatalogItem>,
        page: Int,
        pageSize: Int = SONG_PAGE_SIZE,
    ): List<SongCatalogItem> {
        val safePage = coerceSongPage(page, songs.size, pageSize)
        val fromIndex = (safePage - 1) * pageSize
        val toIndex = minOf(fromIndex + pageSize, songs.size)
        return songs.subList(fromIndex, toIndex)
    }

    fun homeHubEventsListAction(closingSoonCount: Int): HomeHubEventsAction =
        if (closingSoonCount > 0) {
            HomeHubEventsAction(
                title = "굿즈/행사 전체 보기",
                body = "진행 중과 예정 항목을 모두 확인합니다.",
                pills = listOf("굿즈/행사", "전체")
            )
        } else {
            HomeHubEventsAction(
                title = "마감 임박 항목 없음",
                body = "전체 굿즈/행사에서 예정과 진행 중 항목을 볼 수 있습니다.",
                pills = listOf("굿즈/행사")
            )
        }

    fun settingsHubRows(
        deliveryMode: String,
        enabledTargets: Int,
        totalTargets: Int,
        enabledPlatforms: Int,
        totalPlatforms: Int,
        enabledEventTypes: Int,
        totalEventTypes: Int,
        hubEventsEnabled: Boolean,
        deadlineSoonEnabled: Boolean
    ): List<SettingsHubRow> = listOf(
        SettingsHubRow(
            screenId = "delivery",
            title = "전달 방식",
            body = "표준, realtime_best_effort, 조용한 시간",
            value = if (deliveryMode == "REALTIME_BEST_EFFORT") "실시간 우선" else "표준"
        ),
        SettingsHubRow(
            screenId = "targets",
            title = "대상별 알림",
            body = "기수, 감자, 기타, 개별 항목",
            value = "$enabledTargets/$totalTargets"
        ),
        SettingsHubRow(
            screenId = "platforms",
            title = "플랫폼별 알림",
            body = "CHZZK, YouTube, X, 굿즈/행사",
            value = "$enabledPlatforms/$totalPlatforms"
        ),
        SettingsHubRow(
            screenId = "event_types",
            title = "이벤트 타입별 알림",
            body = "방송, 업로드, 공식, 굿즈/행사",
            value = "$enabledEventTypes/$totalEventTypes"
        ),
        SettingsHubRow(
            screenId = "hub_events",
            title = "굿즈/행사",
            body = "공식 출처 기준과 제외 대상",
            value = when {
                !hubEventsEnabled -> "꺼짐"
                deadlineSoonEnabled -> "켜짐 · 마감 임박 ON"
                else -> "켜짐"
            }
        ),
        SettingsHubRow(
            screenId = "history",
            title = "알림 기록",
            body = "허용된 알림과 정책 제외 항목을 확인합니다.",
            value = "보기"
        ),
        SettingsHubRow(
            screenId = "advanced",
            title = "고급 조합 설정",
            body = "카테고리/개별 항목별 예외 규칙",
            value = "예외 규칙"
        )
    )

    fun settingsEventTypeRows(settings: NotificationSettingState = NotificationSettingState()): List<SettingsPolicyRow> =
        NotificationEventType.entries.map { eventType ->
            SettingsPolicyRow(
                title = eventType.displayName,
                body = settingsEventTypePolicy(eventType),
                checked = settings.eventTypeEnabled[eventType] == true
            )
        }

    fun settingsHubEventRows(hubEventsEnabled: Boolean, deadlineSoonEnabled: Boolean): List<SettingsPolicyRow> = listOf(
        SettingsPolicyRow(
            title = "굿즈/행사 알림",
            body = "공식/멤버/공식 콜라보 출처가 있는 기간성 정보만 포함합니다.",
            checked = hubEventsEnabled
        ),
        SettingsPolicyRow(
            title = "온라인 굿즈",
            body = "한정 예약, 판매 시작, 마감 임박을 포함합니다.",
            checked = hubEventsEnabled
        ),
        SettingsPolicyRow(
            title = "오프라인 행사",
            body = "콘서트, 팝업, 공식 콜라보를 포함합니다.",
            checked = hubEventsEnabled
        ),
        SettingsPolicyRow(
            title = "마감 임박 우선 표시",
            body = "홈과 최근 알림에 우선 배치합니다.",
            checked = deadlineSoonEnabled
        ),
        SettingsPolicyRow(
            title = "변경 알림",
            body = "MVP에서는 기본 OFF입니다.",
            checked = false
        )
    )

    fun settingsPlatformPolicy(platform: NotificationPlatform): String? = when (platform) {
        NotificationPlatform.NAVER_CAFE ->
            "공식 API와 약관을 우선합니다. 무단 수집이나 로그인 쿠키 수집은 사용하지 않습니다."
        NotificationPlatform.HUB_EVENT ->
            "공식 출처가 있는 기간성 굿즈, 티켓, 오프라인 행사만 포함합니다."
        else -> null
    }

    fun settingsPlatformCommonNotice(): String =
        "플랫폼 OFF이면 해당 플랫폼 이벤트 푸시를 차단합니다."

    fun debugServerConnectionLogs(debugModeEnabled: Boolean, logs: List<String>): List<String> =
        if (debugModeEnabled) logs else emptyList()

    fun settingsEventTypePolicy(eventType: NotificationEventType): String? = when (eventType) {
        NotificationEventType.CHZZK_CHAT,
        NotificationEventType.YOUTUBE_LIVE_SCHEDULED,
        NotificationEventType.YOUTUBE_LIVE_STARTED,
        NotificationEventType.YOUTUBE_LIVE_ENDED,
        NotificationEventType.OFFICIAL_YOUTUBE_UPLOAD -> null
        NotificationEventType.CAFE_POST -> "무단 수집, 로그인 쿠키 수집, 비공개 접근 우회 없이 공식 경로만 사용합니다."
        NotificationEventType.EVENT_ANNOUNCED -> "공식/멤버/공식 콜라보 출처가 있는 기간성 정보만 포함합니다."
        NotificationEventType.EVENT_SALES_OPEN -> "굿즈, 티켓, 오프라인 행사의 예약/판매 시작 알림입니다."
        NotificationEventType.EVENT_DEADLINE_SOON -> "예약/판매 종료가 가까운 항목을 홈과 알림에 우선 표시합니다."
        NotificationEventType.EVENT_UPDATED -> "굿즈/행사 변경 알림이며 MVP에서는 기본 OFF입니다."
        NotificationEventType.EVENT_CANCELLED -> "공식 출처의 취소 안내만 전송합니다."
        else -> null
    }

    fun settingsEventTypeCommonNotices(): List<String> = listOf(
        "사용자 설정, 조용한 시간, 차단 키워드, rate limit은 계속 적용됩니다.",
        "공식 채널에는 YouTube 라이브 예정/시작/종료를 적용하지 않으며, 공식 YouTube는 업로드 알림만 지원합니다."
    )

    fun hubEventPolicyNotice(): String =
        "대표/강지 이벤트, 팬 주최 이벤트, 루틴 방송/라이브/업로드는 MVP 굿즈/행사 피드에 포함하지 않습니다."

    fun historyPolicyNotice(): String =
        "공식 YouTube 라이브 예정, 시작, 종료 이벤트는 생성하지 않아 기록에 나타나지 않습니다."

    fun liveStatusText(isLive: Boolean, startedAt: Instant?, now: Instant = Instant.now()): String {
        if (!isLive) return "오프라인"
        if (startedAt == null || startedAt.isAfter(now)) return "방송 중"

        val elapsedMinutes = Duration.between(startedAt, now).toMinutes()
        val hours = elapsedMinutes / 60
        val minutes = elapsedMinutes % 60
        val elapsedText = when {
            elapsedMinutes < 1 -> "방금 시작"
            hours > 0L -> "${hours}시간 ${minutes}분"
            else -> "${minutes}분"
        }
        return "방송 중 · ${elapsedText} 진행 중"
    }

    fun liveElapsedClockText(startedAt: Instant?, now: Instant = Instant.now()): String? {
        if (startedAt == null || startedAt.isAfter(now)) return null
        val elapsedSeconds = Duration.between(startedAt, now).seconds.coerceAtLeast(0)
        val hours = elapsedSeconds / 3600
        val minutes = (elapsedSeconds % 3600) / 60
        val seconds = elapsedSeconds % 60
        return "%d:%02d:%02d".format(Locale.US, hours, minutes, seconds)
    }

    fun viewerCountText(viewerCount: Int?): String? =
        viewerCount?.takeIf { it >= 0 }?.let { NumberFormat.getIntegerInstance(Locale.KOREA).format(it) }

    fun liveTitleText(title: String?): String =
        title?.trim()?.takeIf { it.isNotEmpty() } ?: "방송 제목 확인 중"
}
