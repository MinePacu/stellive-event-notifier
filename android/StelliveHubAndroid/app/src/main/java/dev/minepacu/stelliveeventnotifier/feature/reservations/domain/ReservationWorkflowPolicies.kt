package dev.minepacu.stelliveeventnotifier.feature.reservations.domain

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.time.Instant
import java.util.UUID

object ReservationExternalLinkPolicy {
    fun openFailOpen(
        openExternal: () -> Unit,
        recordBestEffort: () -> Unit,
        onRecordingFailure: () -> Unit,
    ) {
        openExternal()
        runCatching(recordBestEffort).onFailure { onRecordingFailure() }
    }
}

sealed interface ReservationDeepLinkRoute {
    data object ListRoute : ReservationDeepLinkRoute
    data class QuickAdd(val sessionId: UUID?) : ReservationDeepLinkRoute
    data class Detail(val reservationId: UUID) : ReservationDeepLinkRoute
    data class Edit(val reservationId: UUID) : ReservationDeepLinkRoute
}

object ReservationDeepLinkPolicy {
    fun route(rawValue: String?): ReservationDeepLinkRoute? {
        val uri = rawValue?.let { runCatching { URI(it) }.getOrNull() } ?: return null
        if (!uri.scheme.equals("stellivehub", true) || uri.host != "reservations") return null
        val segments = uri.path.orEmpty().split('/').filter(String::isNotBlank)
        if (segments.isEmpty()) return ReservationDeepLinkRoute.ListRoute
        if (segments.first() == "new") {
            val sessionId = queryValue(uri.rawQuery, "sessionId")?.let(::parseUUID)
            return ReservationDeepLinkRoute.QuickAdd(sessionId)
        }
        val id = parseUUID(segments.first()) ?: return null
        return if (segments.getOrNull(1) == "edit") {
            ReservationDeepLinkRoute.Edit(id)
        } else {
            ReservationDeepLinkRoute.Detail(id)
        }
    }

    private fun queryValue(rawQuery: String?, key: String): String? = rawQuery
        ?.split('&')
        ?.map { it.substringBefore('=') to it.substringAfter('=', "") }
        ?.firstOrNull { it.first == key }
        ?.second
        ?.let { URLDecoder.decode(it, StandardCharsets.UTF_8.name()) }

    private fun parseUUID(value: String): UUID? =
        runCatching { UUID.fromString(value) }.getOrNull()
}

object ReservationShareIntentParser {
    fun firstHttpsURL(sharedText: String?): String? = ReservationURLPolicy.firstHttpsUrl(sharedText)
}

enum class ReservationTileState { UNAVAILABLE, ACTIVE }

data class ReservationTilePresentation(val state: ReservationTileState, val label: String)

object ReservationTileStatePolicy {
    fun presentation(activeDraftCount: Int): ReservationTilePresentation = when (activeDraftCount) {
        0 -> ReservationTilePresentation(ReservationTileState.UNAVAILABLE, "진행 중인 예약 없음")
        1 -> ReservationTilePresentation(ReservationTileState.ACTIVE, "예약 완료로 추가")
        else -> ReservationTilePresentation(ReservationTileState.ACTIVE, "예약 ${activeDraftCount}건 확인")
    }
}

data class ReservationListSections(
    val upcoming: List<ReservationRecord>,
    val past: List<ReservationRecord>,
)

object ReservationListPolicy {
    fun sections(records: List<ReservationRecord>, now: Instant = Instant.now()): ReservationListSections {
        val upcoming = records
            .filter { it.status == ReservationStatus.CONFIRMED && (it.effectiveStartsAt?.isAfter(now) ?: true) }
            .sortedBy { it.effectiveStartsAt ?: Instant.MAX }
        return ReservationListSections(
            upcoming = upcoming,
            past = records.filterNot(upcoming::contains).sortedByDescending { it.effectiveStartsAt ?: it.updatedAt },
        )
    }
}

sealed interface ReservationReturnPromptDecision {
    data object None : ReservationReturnPromptDecision
    data class Single(val sessionId: UUID) : ReservationReturnPromptDecision
    data class Multiple(val sessionIds: Set<UUID>) : ReservationReturnPromptDecision
}

object ReservationReturnPromptPolicy {
    val minimumExternalDuration: Duration = Duration.ofSeconds(10)

    fun decision(
        drafts: List<ReservationDraft>,
        externallyOpenedSessionIds: Set<UUID>,
        promptedSessionIds: Set<UUID>,
        now: Instant = Instant.now(),
    ): ReservationReturnPromptDecision {
        val eligible = ReservationDraftPolicy.active(drafts, now).filter {
            it.sessionId in externallyOpenedSessionIds &&
                it.sessionId !in promptedSessionIds &&
                Duration.between(it.openedAt, now) >= minimumExternalDuration
        }
        return when (eligible.size) {
            0 -> ReservationReturnPromptDecision.None
            1 -> ReservationReturnPromptDecision.Single(eligible.single().sessionId)
            else -> ReservationReturnPromptDecision.Multiple(eligible.mapTo(mutableSetOf(), ReservationDraft::sessionId))
        }
    }
}
