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

enum class ReservationListSectionKind {
    UPCOMING,
    PAST,
}

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

    fun timestampLabel(
        record: ReservationRecord,
        section: ReservationListSectionKind,
        format: (Instant) -> String,
    ): String? {
        val timestamp = when (section) {
            ReservationListSectionKind.UPCOMING -> record.effectiveStartsAt
            ReservationListSectionKind.PAST -> record.createdAt
        } ?: return null
        val formatted = format(timestamp)
        return when (section) {
            ReservationListSectionKind.UPCOMING -> formatted
            ReservationListSectionKind.PAST -> "저장 시각 · $formatted"
        }
    }
}

data class ReservationEditInitialValues(
    val title: String,
    val startsAt: Instant?,
    val endsAt: Instant?,
    val venue: String,
)

data class ReservationEditOverrides(
    val title: String?,
    val startsAt: Instant?,
    val endsAt: Instant?,
    val venue: String?,
)

object ReservationEditPresentationPolicy {
    fun initialValues(record: ReservationRecord): ReservationEditInitialValues =
        ReservationEditInitialValues(
            title = record.displayTitle,
            startsAt = record.effectiveStartsAt,
            endsAt = record.effectiveEndsAt,
            venue = record.effectiveVenue.orEmpty(),
        )

    fun overrides(
        record: ReservationRecord,
        title: String,
        startsAt: Instant?,
        endsAt: Instant?,
        venue: String,
    ): ReservationEditOverrides {
        val normalizedTitle = title.trim().takeIf(String::isNotEmpty)
        val normalizedVenue = venue.trim().takeIf(String::isNotEmpty)
        return ReservationEditOverrides(
            title = normalizedTitle?.takeUnless { it == record.eventSnapshot.title },
            startsAt = startsAt?.takeUnless { it == record.eventSnapshot.startsAt },
            endsAt = endsAt?.takeUnless { it == record.eventSnapshot.endsAt },
            venue = normalizedVenue?.takeUnless { it == record.eventSnapshot.venueName },
        )
    }
}

enum class ReservationHelpPage {
    LIST,
    DETAIL,
}

data class ReservationHelpSection(
    val title: String,
    val body: String,
    val points: List<String> = emptyList(),
)

data class ReservationHelpContent(
    val title: String,
    val summary: String,
    val sections: List<ReservationHelpSection>,
)

object ReservationHelpPolicy {
    fun content(page: ReservationHelpPage): ReservationHelpContent = when (page) {
        ReservationHelpPage.LIST -> ReservationHelpContent(
            title = "내 예약·구매 도움말",
            summary = "외부 서비스의 결제나 예약 완료 여부를 자동으로 확인하지 않으며, 사용자가 확인한 기록만 이 기기에 저장합니다.",
            sections = listOf(
                ReservationHelpSection(
                    title = "내역 추가",
                    body = "굿즈·행사에서 티켓·구매·예약 링크를 열면 확인 필요 항목이 생깁니다. 외부 작업을 마친 뒤 내역 추가를 선택하세요.",
                ),
                ReservationHelpSection(
                    title = "확인 필요",
                    body = "링크를 열었지만 아직 내역으로 저장하지 않은 임시 기록입니다. 외부 작업을 완료하지 않았다면 취소할 수 있습니다.",
                ),
                ReservationHelpSection(
                    title = "예정된 내역과 지난 내역",
                    body = "확정 상태이고 일정이 지나지 않은 기록은 예정된 내역에 표시됩니다. 취소·환불·완료 상태이거나 일정이 지난 기록은 지난 내역으로 분류됩니다.",
                    points = listOf("지난 내역에는 내역을 저장한 시각을 표시합니다."),
                ),
                ReservationHelpSection(
                    title = "저장과 보안",
                    body = "제목, 관련 링크, 예매·주문·예약번호와 메모는 기기에 저장됩니다. 민감한 링크나 번호를 다른 사람과 공유하지 마세요.",
                ),
            ),
        )
        ReservationHelpPage.DETAIL -> ReservationHelpContent(
            title = "내역 상세 도움말",
            summary = "상세 화면은 저장 당시 행사 정보와 사용자가 직접 수정한 내역 정보를 함께 보여줍니다.",
            sections = listOf(
                ReservationHelpSection(
                    title = "내역 상태",
                    body = "예매·구매·예약 상태는 사용자가 직접 관리합니다. 앱은 외부 서비스의 실제 처리 결과를 자동으로 검증하거나 변경하지 않습니다.",
                ),
                ReservationHelpSection(
                    title = "내역 링크",
                    body = "내역 링크 열기는 저장된 상세 링크, 제공사 내역 URL, 처음 열었던 링크 순서로 사용 가능한 주소를 엽니다.",
                ),
                ReservationHelpSection(
                    title = "연결된 공식 행사",
                    body = "저장 당시 행사와 현재 공식 행사 정보를 비교해 일정 변경이나 취소를 안내합니다. 공식 정보가 바뀌어도 내역 상태와 사용자 수정값은 자동으로 바뀌지 않습니다.",
                ),
                ReservationHelpSection(
                    title = "수정한 정보",
                    body = "직접 수정한 제목, 일정과 장소는 저장 당시 행사 정보보다 우선 표시됩니다. 관련 링크, 옵션, 수량, 번호와 메모도 수정할 수 있습니다.",
                ),
                ReservationHelpSection(
                    title = "내역 삭제",
                    body = "내역 삭제는 이 기기에 저장된 기록만 제거합니다. 외부 서비스의 예매·주문·예약을 취소하지 않습니다.",
                ),
            ),
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
