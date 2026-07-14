package dev.minepacu.stelliveeventnotifier.feature.songs

import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import dev.minepacu.stelliveeventnotifier.feature.home.SongMemberFilterState
import dev.minepacu.stelliveeventnotifier.feature.home.SongMemberMatchMode
import java.time.Duration
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class SongDetailRow(val label: String, val value: String)

object SongDetailPolicy {
    private val dateFormatter = DateTimeFormatter.ofPattern("yyyy. M. d.", Locale.KOREAN)

    fun durationText(song: SongCatalogItem): String? = song.durationSeconds
        ?.takeIf { it >= 0 }
        ?.let(::formatDuration)
        ?: song.duration?.let { runCatching { Duration.parse(it).seconds.toInt() }.getOrNull() }
            ?.takeIf { it >= 0 }
            ?.let(::formatDuration)

    fun formatDuration(totalSeconds: Int): String {
        val hours = totalSeconds / 3600
        val minutes = (totalSeconds % 3600) / 60
        val seconds = totalSeconds % 60
        return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, seconds) else "%d:%02d".format(minutes, seconds)
    }

    fun classificationLabel(value: String?): String? = when (value?.uppercase()) {
        "AUTO_CLASSIFIED" -> "자동 분류"
        "MANUAL_CONFIRMED" -> "검토 완료"
        "NEEDS_REVIEW" -> "검토 필요"
        "MANUAL_EXCLUDED" -> "목록 제외"
        else -> value?.takeIf(String::isNotBlank)
    }

    fun specialFlagLabel(value: String): String? = when (value.lowercase()) {
        "short_or_preview" -> "쇼츠 또는 미리보기"
        "live_or_long_form" -> "라이브 또는 장편 영상"
        else -> value.replace('_', ' ').takeIf(String::isNotBlank)
    }

    fun rows(song: SongCatalogItem): List<SongDetailRow> = buildList {
        add(SongDetailRow("참여 멤버", MainUiPolicy.songMemberDisplayText(song)))
        add(SongDetailRow("종류", song.type.displayName))
        durationText(song)?.let { add(SongDetailRow("재생 시간", it)) }
        song.publishedAt.takeUnless { it == java.time.Instant.EPOCH }?.let {
            add(SongDetailRow("공개일", dateFormatter.format(it.atZone(ZoneId.systemDefault()))))
        }
        song.premiere?.let { premiere ->
            val assumed = if (premiere.classification == "assumed") " (추정)" else ""
            add(SongDetailRow("YouTube 최초 공개", premiereStateLabel(premiere.state) + assumed))
        }
        if (song.isInstrumental) add(SongDetailRow("반주곡", "예"))
        song.specialFlags.mapNotNull(::specialFlagLabel).takeIf(List<String>::isNotEmpty)?.let {
            add(SongDetailRow("특수 플래그", it.joinToString(", ")))
        }
        classificationLabel(song.classificationStatus)?.let { add(SongDetailRow("분류 상태", it)) }
    }

    fun memberFilter(memberId: String) = SongMemberFilterState(selectedMemberIds = setOf(memberId))

    fun allMembersFilter(song: SongCatalogItem) = SongMemberFilterState(
        selectedMemberIds = song.members.map { it.id }.filter(String::isNotBlank).toSet(),
        matchMode = SongMemberMatchMode.ALL,
    ).normalized()

    private fun premiereStateLabel(value: String) = when (value.lowercase()) {
        "scheduled" -> "예정"
        "live" -> "진행 중"
        "completed" -> "완료"
        else -> "정보 있음"
    }
}
