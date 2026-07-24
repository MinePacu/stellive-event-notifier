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

enum class ReservationHelpTone {
    NORMAL,
    INFO,
    WARNING,
    SECURITY,
    DANGER,
}

enum class ReservationHelpSectionId {
    PENDING_DRAFT,
    LINKLESS_ADD,
    LIST_GROUPS,
    LOCAL_STORAGE,
    DETAIL_ACTIONS,
    LINK_PRIORITY,
    USER_OVERRIDES,
    OFFICIAL_EVENT,
    DELETE_WARNING,
}

data class ReservationHelpStep(
    val number: Int,
    val title: String,
    val body: String,
)

data class ReservationHelpSection(
    val id: ReservationHelpSectionId,
    val tone: ReservationHelpTone,
    val title: String,
    val body: String,
    val points: List<String> = emptyList(),
)

data class ReservationHelpContent(
    val title: String,
    val summary: String,
    val steps: List<ReservationHelpStep> = emptyList(),
    val sections: List<ReservationHelpSection>,
)

object ReservationHelpPolicy {
    fun content(page: ReservationHelpPage): ReservationHelpContent = when (page) {
        ReservationHelpPage.LIST -> ReservationHelpContent(
            title = "내 예약·구매 도움말",
            summary = "링크를 열 때 생기는 확인 필요 항목은 임시 기록입니다. 앱은 외부 서비스의 실제 완료 여부를 자동으로 확인하지 않으며, 내역으로 추가한 정보는 이 기기에 저장합니다.",
            steps = listOf(
                ReservationHelpStep(
                    number = 1,
                    title = "굿즈·행사에서 링크 열기",
                    body = "티켓·구매·예약 링크를 엽니다.",
                ),
                ReservationHelpStep(
                    number = 2,
                    title = "외부 페이지에서 진행",
                    body = "외부 서비스에서 예매·결제·예약을 진행합니다.",
                ),
                ReservationHelpStep(
                    number = 3,
                    title = "앱으로 돌아와 내역 추가",
                    body = "확인 필요 항목을 내역에 추가합니다. 상세 링크를 찾지 못했다면 링크 없이 추가할 수 있습니다.",
                ),
            ),
            sections = listOf(
                ReservationHelpSection(
                    id = ReservationHelpSectionId.PENDING_DRAFT,
                    tone = ReservationHelpTone.WARNING,
                    title = "확인 필요는 임시 항목입니다",
                    body = "링크를 열면 확인 필요 항목이 생기며 최대 2시간 동안 유지된 뒤 자동으로 정리됩니다. 앱은 외부 서비스에서 예매·결제·예약이 실제로 완료됐는지 자동 확인하지 않습니다.",
                    points = listOf("앱 복귀 안내가 보이지 않아도 내 예약·구매의 확인 필요에서 직접 추가할 수 있습니다."),
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.LINKLESS_ADD,
                    tone = ReservationHelpTone.INFO,
                    title = "상세 링크가 없어도 추가할 수 있습니다",
                    body = "외부 페이지에서 상세 링크를 찾지 못했다면 링크 없이 추가를 선택해 상태와 필요한 정보를 직접 기록하세요.",
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.LIST_GROUPS,
                    tone = ReservationHelpTone.NORMAL,
                    title = "예정된 내역과 지난 내역",
                    body = "예매 완료·구매 완료·예약 완료 상태이고 일정이 남은 항목은 예정된 내역에 표시됩니다. 취소·환불·이용 완료 상태이거나 일정이 지난 항목은 지난 내역에 표시됩니다.",
                    points = listOf("지난 내역에는 내역을 저장한 시각을 표시합니다."),
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.LOCAL_STORAGE,
                    tone = ReservationHelpTone.SECURITY,
                    title = "내역은 이 기기에만 저장됩니다",
                    body = "정식 내역은 서버로 전송되지 않고 이 기기에만 저장됩니다. 예약 데이터는 백업 대상에서 제외되므로 앱을 삭제하거나 기기를 변경하면 복구되지 않을 수 있습니다.",
                    points = listOf("예매·주문·예약번호와 민감한 링크를 다른 사람과 공유하지 마세요."),
                ),
            ),
        )
        ReservationHelpPage.DETAIL -> ReservationHelpContent(
            title = "내역 상세 도움말",
            summary = "이 화면에서 저장한 정보를 확인하고 수정하거나 내역 링크를 다시 열 수 있습니다.",
            sections = listOf(
                ReservationHelpSection(
                    id = ReservationHelpSectionId.DETAIL_ACTIONS,
                    tone = ReservationHelpTone.INFO,
                    title = "이 화면에서 할 수 있는 일",
                    body = "저장한 내역을 확인하고 필요한 정보를 직접 관리할 수 있습니다.",
                    points = listOf(
                        "내역 링크 열기로 상세 내역 확인",
                        "상태·일정·장소 수정",
                        "옵션·수량·예매/주문/예약번호·메모 기록",
                    ),
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.LINK_PRIORITY,
                    tone = ReservationHelpTone.NORMAL,
                    title = "내역 링크 사용 순서",
                    body = "상세 링크가 있으면 그 링크를 우선 엽니다. 상세 링크가 없으면 제공사 내역 URL 또는 처음 열었던 링크를 사용할 수 있습니다.",
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.USER_OVERRIDES,
                    tone = ReservationHelpTone.INFO,
                    title = "직접 수정한 정보가 먼저 표시됩니다",
                    body = "직접 수정한 제목·일정·장소는 저장 당시 공식 정보보다 우선 표시됩니다. 옵션·수량·번호·메모도 수정해 기록할 수 있습니다.",
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.OFFICIAL_EVENT,
                    tone = ReservationHelpTone.WARNING,
                    title = "공식 정보는 내 내역을 자동 변경하지 않습니다",
                    body = "연결된 공식 행사의 정보가 변경되거나 행사가 취소되어도 예매 완료·구매 완료·예약 완료 같은 내역 상태와 직접 수정한 값은 자동으로 바뀌지 않습니다.",
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.DELETE_WARNING,
                    tone = ReservationHelpTone.DANGER,
                    title = "내역 삭제는 외부 취소가 아닙니다",
                    body = "앱에서 내역을 삭제해도 외부 서비스의 실제 예매·주문·예약은 취소되지 않습니다. 취소가 필요하면 해당 외부 서비스에서 별도로 진행하세요.",
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
