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

object ReservationPresentationPolicy {
    fun kindLabel(kind: ReservationKind): String = when (kind) {
        ReservationKind.TICKET -> "티켓 예매"
        ReservationKind.PURCHASE -> "상품 구매"
        ReservationKind.RESERVATION -> "일반 예약"
    }

    fun inProgressLabel(kind: ReservationKind): String = when (kind) {
        ReservationKind.TICKET -> "티켓 예매 진행 중"
        ReservationKind.PURCHASE -> "상품 구매 진행 중"
        ReservationKind.RESERVATION -> "예약 진행 중"
    }

    fun addActionLabel(kind: ReservationKind): String = when (kind) {
        ReservationKind.TICKET -> "예매 내역에 추가"
        ReservationKind.PURCHASE -> "구매 내역에 추가"
        ReservationKind.RESERVATION -> "예약 내역에 추가"
    }

    fun detailLinkLabel(kind: ReservationKind): String = when (kind) {
        ReservationKind.TICKET -> "예매 상세 링크"
        ReservationKind.PURCHASE -> "구매 상세 링크"
        ReservationKind.RESERVATION -> "예약 상세 링크"
    }

    fun referenceNumberLabel(kind: ReservationKind): String = when (kind) {
        ReservationKind.TICKET -> "예매번호"
        ReservationKind.PURCHASE -> "주문번호"
        ReservationKind.RESERVATION -> "예약번호"
    }

    fun statusLabel(kind: ReservationKind, status: ReservationStatus): String = when (status) {
        ReservationStatus.PENDING_CONFIRMATION -> "확인 필요"
        ReservationStatus.REFUNDED -> "환불 완료"
        ReservationStatus.CONFIRMED -> when (kind) {
            ReservationKind.TICKET -> "예매 완료"
            ReservationKind.PURCHASE -> "구매 완료"
            ReservationKind.RESERVATION -> "예약 완료"
        }
        ReservationStatus.CANCELLED -> when (kind) {
            ReservationKind.TICKET -> "예매 취소"
            ReservationKind.PURCHASE -> "구매 취소"
            ReservationKind.RESERVATION -> "예약 취소"
        }
        ReservationStatus.COMPLETED -> when (kind) {
            ReservationKind.PURCHASE -> "처리 완료"
            ReservationKind.TICKET, ReservationKind.RESERVATION -> "이용 완료"
        }
    }

    fun systemShortcutLabel(drafts: List<ReservationDraft>): String = when (drafts.size) {
        0 -> "진행 중인 내역 없음"
        1 -> when (drafts.single().kind) {
            ReservationKind.TICKET -> "예매 내역 추가"
            ReservationKind.PURCHASE -> "구매 내역 추가"
            ReservationKind.RESERVATION -> "예약 내역 추가"
        }
        else -> "진행 내역 ${drafts.size}건 확인"
    }
}

object ReservationTileStatePolicy {
    fun presentation(activeDrafts: List<ReservationDraft>): ReservationTilePresentation =
        ReservationTilePresentation(
            state = if (activeDrafts.isEmpty()) ReservationTileState.UNAVAILABLE else ReservationTileState.ACTIVE,
            label = ReservationPresentationPolicy.systemShortcutLabel(activeDrafts),
        )
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
