package dev.minepacu.stelliveeventnotifier.feature.reservations.domain

import androidx.annotation.StringRes
import dev.minepacu.stelliveeventnotifier.R
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

enum class ReservationHelpAction {
    VIEW_PENDING,
    ADD_WITHOUT_LINK,
    VIEW_UPCOMING,
    EDIT_CURRENT_RECORD,
    VIEW_EXISTING_RECORD,
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

enum class ReservationHelpFaqId {
    RETURN_PROMPT_MISSING,
    DETAIL_LINK_MISSING,
    DUPLICATE_LINK,
    SENSITIVE_LINK,
    OFFICIAL_EVENT_CANCELLED,
}

data class ReservationHelpStep(
    val number: Int,
    @StringRes val titleRes: Int,
    @StringRes val bodyRes: Int,
)

data class ReservationHelpSection(
    val id: ReservationHelpSectionId,
    val tone: ReservationHelpTone,
    @StringRes val titleRes: Int,
    @StringRes val bodyRes: Int,
    val pointResIds: List<Int> = emptyList(),
    val action: ReservationHelpAction? = null,
)

data class ReservationHelpFaq(
    val id: ReservationHelpFaqId,
    val tone: ReservationHelpTone,
    @StringRes val questionRes: Int,
    @StringRes val answerRes: Int,
    val action: ReservationHelpAction? = null,
)

data class ReservationHelpContent(
    @StringRes val titleRes: Int,
    @StringRes val summaryRes: Int,
    val steps: List<ReservationHelpStep> = emptyList(),
    val sections: List<ReservationHelpSection>,
    val faqs: List<ReservationHelpFaq> = emptyList(),
)

data class ReservationHelpContext(
    val activeDraftCount: Int,
    val earliestDraftExpiresAt: Instant?,
    val firstDraftSessionId: UUID?,
    val hasRecords: Boolean,
    val hasUpcomingRecords: Boolean,
    val currentRecordId: UUID? = null,
    val existingRecordId: UUID? = null,
)

object ReservationHelpContextPolicy {
    fun context(
        drafts: List<ReservationDraft>,
        records: List<ReservationRecord>,
        currentRecordId: UUID? = null,
        existingRecordId: UUID? = null,
        now: Instant = Instant.now(),
    ): ReservationHelpContext {
        val activeDrafts = ReservationDraftPolicy.active(drafts, now)
        val upcoming = ReservationListPolicy.sections(records, now).upcoming
        val earliest = activeDrafts.minByOrNull(ReservationDraft::expiresAt)
        return ReservationHelpContext(
            activeDraftCount = activeDrafts.size,
            earliestDraftExpiresAt = earliest?.expiresAt,
            firstDraftSessionId = earliest?.sessionId,
            hasRecords = records.isNotEmpty(),
            hasUpcomingRecords = upcoming.isNotEmpty(),
            currentRecordId = currentRecordId?.takeIf { id -> records.any { it.id == id } },
            existingRecordId = existingRecordId?.takeIf { id -> records.any { it.id == id } },
        )
    }
}

enum class ReservationHelpStatusKind {
    GETTING_STARTED,
    PENDING,
    MANAGE_RECORDS,
}

data class ReservationHelpStatusPresentation(
    val kind: ReservationHelpStatusKind,
    val tone: ReservationHelpTone,
    val activeDraftCount: Int = 0,
    val expiry: ReservationDraftExpiryPresentation? = null,
    val action: ReservationHelpAction? = null,
)

data class ReservationHelpPresentation(
    val content: ReservationHelpContent,
    val status: ReservationHelpStatusPresentation?,
)

object ReservationHelpPolicy {
    fun content(page: ReservationHelpPage): ReservationHelpContent = when (page) {
        ReservationHelpPage.LIST -> ReservationHelpContent(
            titleRes = R.string.reservation_help_list_title,
            summaryRes = R.string.reservation_help_list_summary,
            steps = listOf(
                ReservationHelpStep(
                    number = 1,
                    titleRes = R.string.reservation_help_step_open_title,
                    bodyRes = R.string.reservation_help_step_open_body,
                ),
                ReservationHelpStep(
                    number = 2,
                    titleRes = R.string.reservation_help_step_external_title,
                    bodyRes = R.string.reservation_help_step_external_body,
                ),
                ReservationHelpStep(
                    number = 3,
                    titleRes = R.string.reservation_help_step_add_title,
                    bodyRes = R.string.reservation_help_step_add_body,
                ),
            ),
            sections = listOf(
                ReservationHelpSection(
                    id = ReservationHelpSectionId.PENDING_DRAFT,
                    tone = ReservationHelpTone.WARNING,
                    titleRes = R.string.reservation_help_pending_title,
                    bodyRes = R.string.reservation_help_pending_body,
                    pointResIds = listOf(R.string.reservation_help_pending_point),
                    action = ReservationHelpAction.VIEW_PENDING,
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.LINKLESS_ADD,
                    tone = ReservationHelpTone.INFO,
                    titleRes = R.string.reservation_help_linkless_title,
                    bodyRes = R.string.reservation_help_linkless_body,
                    action = ReservationHelpAction.ADD_WITHOUT_LINK,
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.LIST_GROUPS,
                    tone = ReservationHelpTone.NORMAL,
                    titleRes = R.string.reservation_help_groups_title,
                    bodyRes = R.string.reservation_help_groups_body,
                    pointResIds = listOf(R.string.reservation_help_groups_point),
                    action = ReservationHelpAction.VIEW_UPCOMING,
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.LOCAL_STORAGE,
                    tone = ReservationHelpTone.SECURITY,
                    titleRes = R.string.reservation_help_storage_title,
                    bodyRes = R.string.reservation_help_storage_body,
                    pointResIds = listOf(R.string.reservation_help_storage_point),
                ),
            ),
            faqs = listOf(
                ReservationHelpFaq(
                    id = ReservationHelpFaqId.RETURN_PROMPT_MISSING,
                    tone = ReservationHelpTone.WARNING,
                    questionRes = R.string.reservation_help_faq_return_question,
                    answerRes = R.string.reservation_help_faq_return_answer,
                    action = ReservationHelpAction.VIEW_PENDING,
                ),
                ReservationHelpFaq(
                    id = ReservationHelpFaqId.DETAIL_LINK_MISSING,
                    tone = ReservationHelpTone.INFO,
                    questionRes = R.string.reservation_help_faq_link_question,
                    answerRes = R.string.reservation_help_faq_link_answer,
                    action = ReservationHelpAction.ADD_WITHOUT_LINK,
                ),
                ReservationHelpFaq(
                    id = ReservationHelpFaqId.DUPLICATE_LINK,
                    tone = ReservationHelpTone.WARNING,
                    questionRes = R.string.reservation_help_faq_duplicate_question,
                    answerRes = R.string.reservation_help_faq_duplicate_answer,
                    action = ReservationHelpAction.VIEW_EXISTING_RECORD,
                ),
                ReservationHelpFaq(
                    id = ReservationHelpFaqId.SENSITIVE_LINK,
                    tone = ReservationHelpTone.SECURITY,
                    questionRes = R.string.reservation_help_faq_sensitive_question,
                    answerRes = R.string.reservation_help_faq_sensitive_answer,
                ),
                ReservationHelpFaq(
                    id = ReservationHelpFaqId.OFFICIAL_EVENT_CANCELLED,
                    tone = ReservationHelpTone.WARNING,
                    questionRes = R.string.reservation_help_faq_cancelled_question,
                    answerRes = R.string.reservation_help_faq_cancelled_answer,
                ),
            ),
        )
        ReservationHelpPage.DETAIL -> ReservationHelpContent(
            titleRes = R.string.reservation_help_detail_title,
            summaryRes = R.string.reservation_help_detail_summary,
            sections = listOf(
                ReservationHelpSection(
                    id = ReservationHelpSectionId.DETAIL_ACTIONS,
                    tone = ReservationHelpTone.INFO,
                    titleRes = R.string.reservation_help_detail_actions_title,
                    bodyRes = R.string.reservation_help_detail_actions_body,
                    pointResIds = listOf(
                        R.string.reservation_help_detail_actions_link,
                        R.string.reservation_help_detail_actions_edit,
                        R.string.reservation_help_detail_actions_notes,
                    ),
                    action = ReservationHelpAction.EDIT_CURRENT_RECORD,
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.LINK_PRIORITY,
                    tone = ReservationHelpTone.NORMAL,
                    titleRes = R.string.reservation_help_link_priority_title,
                    bodyRes = R.string.reservation_help_link_priority_body,
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.USER_OVERRIDES,
                    tone = ReservationHelpTone.INFO,
                    titleRes = R.string.reservation_help_overrides_title,
                    bodyRes = R.string.reservation_help_overrides_body,
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.OFFICIAL_EVENT,
                    tone = ReservationHelpTone.WARNING,
                    titleRes = R.string.reservation_help_official_title,
                    bodyRes = R.string.reservation_help_official_body,
                ),
                ReservationHelpSection(
                    id = ReservationHelpSectionId.DELETE_WARNING,
                    tone = ReservationHelpTone.DANGER,
                    titleRes = R.string.reservation_help_delete_title,
                    bodyRes = R.string.reservation_help_delete_body,
                ),
            ),
        )
    }

    fun presentation(
        page: ReservationHelpPage,
        context: ReservationHelpContext,
        now: Instant = Instant.now(),
    ): ReservationHelpPresentation {
        val base = content(page)
        val filtered = base.copy(
            sections = base.sections.map { section ->
                section.copy(action = section.action?.takeIf { isActionAvailable(it, context) })
            },
            faqs = base.faqs.map { faq ->
                faq.copy(action = faq.action?.takeIf { isActionAvailable(it, context) })
            },
        )
        val status = if (page == ReservationHelpPage.LIST) {
            when {
                context.activeDraftCount > 0 -> ReservationHelpStatusPresentation(
                    kind = ReservationHelpStatusKind.PENDING,
                    tone = ReservationHelpTone.WARNING,
                    activeDraftCount = context.activeDraftCount,
                    expiry = context.earliestDraftExpiresAt?.let {
                        ReservationDraftExpiryPresentationPolicy.presentation(it, now)
                    },
                    action = ReservationHelpAction.VIEW_PENDING,
                )
                context.hasRecords -> ReservationHelpStatusPresentation(
                    kind = ReservationHelpStatusKind.MANAGE_RECORDS,
                    tone = ReservationHelpTone.INFO,
                    action = ReservationHelpAction.VIEW_UPCOMING.takeIf { context.hasUpcomingRecords },
                )
                else -> ReservationHelpStatusPresentation(
                    kind = ReservationHelpStatusKind.GETTING_STARTED,
                    tone = ReservationHelpTone.INFO,
                )
            }
        } else {
            null
        }
        return ReservationHelpPresentation(filtered, status)
    }

    fun isActionAvailable(action: ReservationHelpAction, context: ReservationHelpContext): Boolean = when (action) {
        ReservationHelpAction.VIEW_PENDING,
        ReservationHelpAction.ADD_WITHOUT_LINK -> context.activeDraftCount > 0 && context.firstDraftSessionId != null
        ReservationHelpAction.VIEW_UPCOMING -> context.hasUpcomingRecords
        ReservationHelpAction.EDIT_CURRENT_RECORD -> context.currentRecordId != null
        ReservationHelpAction.VIEW_EXISTING_RECORD -> context.existingRecordId != null
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
