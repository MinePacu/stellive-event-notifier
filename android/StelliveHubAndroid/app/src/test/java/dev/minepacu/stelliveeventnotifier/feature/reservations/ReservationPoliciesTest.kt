package dev.minepacu.stelliveeventnotifier.feature.reservations

import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventLinkKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventParticipationMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleItem
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventSourceType
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.core.model.HubEventTimePrecision
import dev.minepacu.stelliveeventnotifier.feature.reservations.data.ReservationDraftEntity
import dev.minepacu.stelliveeventnotifier.feature.reservations.data.ReservationRecordEntity
import dev.minepacu.stelliveeventnotifier.feature.reservations.data.toDomain
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationActionPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDateFormat
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDisplayPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationSchedulePolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationScheduleWindow
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraft
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftExpiryKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftExpiryPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftSelection
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDetailPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEventSnapshot
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationExternalLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpPage
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpAction
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpContext
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpContextPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpFaqId
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpFaqExpansionPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpSectionId
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpStatusKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpTone
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationLinkSource
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationListPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationListSectionKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationQuickAddPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationQuickAddScreenTitle
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationRecord
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationStatus
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDeepLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDeepLinkRoute
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEditPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEditStatusPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptDecision
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptPresentationKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationShareIntentParser
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationTileState
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationTileStatePolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationURLPolicy
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReservationPoliciesTest {
    @Test fun helpFaqExpansionKeepsOnlyOneItemOpenAndTogglesTheSameItem() {
        val first = ReservationHelpFaqId.RETURN_PROMPT_MISSING
        val second = ReservationHelpFaqId.DETAIL_LINK_MISSING

        assertEquals(first, ReservationHelpFaqExpansionPolicy.toggled(null, first))
        assertNull(ReservationHelpFaqExpansionPolicy.toggled(first, first))
        assertEquals(second, ReservationHelpFaqExpansionPolicy.toggled(first, second))
    }

    @Test fun onlyTicketPurchaseAndReservationLinksCreateDrafts() {
        assertEquals(ReservationKind.TICKET, ReservationActionPolicy.kindFor(HubEventLinkKind.TICKET))
        assertEquals(ReservationKind.PURCHASE, ReservationActionPolicy.kindFor(HubEventLinkKind.PURCHASE))
        assertEquals(ReservationKind.RESERVATION, ReservationActionPolicy.kindFor(HubEventLinkKind.RESERVATION))
        assertNull(ReservationActionPolicy.kindFor(HubEventLinkKind.SOURCE))
        assertNull(ReservationActionPolicy.kindFor(HubEventLinkKind.MAP))
        assertNull(ReservationActionPolicy.kindFor(HubEventLinkKind.TICKET, Instant.EPOCH))
    }

    @Test fun urlPolicyRequiresHttpsAndFlagsSensitiveKeys() {
        assertFalse(ReservationURLPolicy.validate("http://example.com/order").isValid)
        assertFalse(ReservationURLPolicy.validate("https:///missing-host").isValid)
        val safe = ReservationURLPolicy.validate("  https://example.com/order/1  ")
        assertEquals("https://example.com/order/1", safe.normalizedUrl)
        assertFalse(safe.isSensitive)
        assertTrue(ReservationURLPolicy.validate("https://example.com/order?token=secret").isSensitive)
    }

    @Test fun shareParserExtractsFirstValidHttpsUrl() {
        assertEquals(
            "https://example.com/complete?id=1",
            ReservationShareIntentParser.firstHttpsURL("결제 완료 https://example.com/complete?id=1 다음"),
        )
        assertNull(ReservationShareIntentParser.firstHttpsURL("http://example.com/insecure"))
    }

    @Test fun externalLinkAlwaysOpensBeforeBestEffortRecording() {
        val calls = mutableListOf<String>()
        ReservationExternalLinkPolicy.openFailOpen(
            openExternal = { calls += "open" },
            recordBestEffort = { calls += "record"; error("disk unavailable") },
            onRecordingFailure = { calls += "failure" },
        )
        assertEquals(listOf("open", "record", "failure"), calls)
    }

    @Test fun reservationDeepLinksAreParsedByDedicatedPolicy() {
        val id = UUID.randomUUID()
        assertEquals(ReservationDeepLinkRoute.ListRoute, ReservationDeepLinkPolicy.route("stellivehub://reservations"))
        assertEquals(ReservationDeepLinkRoute.Edit(id), ReservationDeepLinkPolicy.route("stellivehub://reservations/$id/edit"))
        assertEquals(ReservationDeepLinkRoute.QuickAdd(id), ReservationDeepLinkPolicy.route("stellivehub://reservations/new?sessionId=$id"))
        assertNull(ReservationDeepLinkPolicy.route("https://example.com/reservations/$id"))
    }

    @Test fun presentationPolicyCoversEveryKindAndStatus() {
        val expected = mapOf(
            ReservationKind.TICKET to listOf("확인 필요", "예매 완료", "예매 취소", "환불 완료", "이용 완료"),
            ReservationKind.PURCHASE to listOf("확인 필요", "구매 완료", "구매 취소", "환불 완료", "처리 완료"),
            ReservationKind.RESERVATION to listOf("확인 필요", "예약 완료", "예약 취소", "환불 완료", "이용 완료"),
        )
        ReservationKind.entries.forEach { kind ->
            assertEquals(expected.getValue(kind), ReservationStatus.entries.map { ReservationPresentationPolicy.statusLabel(kind, it) })
        }
        assertFalse(ReservationPresentationPolicy.statusLabel(ReservationKind.PURCHASE, ReservationStatus.COMPLETED) in setOf("이용 완료", "배송 완료"))
    }

    @Test fun presentationPolicyUsesKindSpecificActionsAndFields() {
        assertEquals("예매 내역에 추가", ReservationPresentationPolicy.addActionLabel(ReservationKind.TICKET))
        assertEquals("구매 내역에 추가", ReservationPresentationPolicy.addActionLabel(ReservationKind.PURCHASE))
        assertEquals("예약 내역에 추가", ReservationPresentationPolicy.addActionLabel(ReservationKind.RESERVATION))
        assertEquals("예매 상세 링크", ReservationPresentationPolicy.detailLinkLabel(ReservationKind.TICKET))
        assertEquals("구매 상세 링크", ReservationPresentationPolicy.detailLinkLabel(ReservationKind.PURCHASE))
        assertEquals("예약 상세 링크", ReservationPresentationPolicy.detailLinkLabel(ReservationKind.RESERVATION))
        assertEquals("예매번호", ReservationPresentationPolicy.referenceNumberLabel(ReservationKind.TICKET))
        assertEquals("주문번호", ReservationPresentationPolicy.referenceNumberLabel(ReservationKind.PURCHASE))
        assertEquals("예약번호", ReservationPresentationPolicy.referenceNumberLabel(ReservationKind.RESERVATION))
    }

    @Test fun editStatusPresentationUsesUserOrderWithoutChangingEnumOrder() {
        assertEquals(
            listOf(
                ReservationStatus.PENDING_CONFIRMATION,
                ReservationStatus.CONFIRMED,
                ReservationStatus.COMPLETED,
                ReservationStatus.CANCELLED,
                ReservationStatus.REFUNDED,
            ),
            ReservationEditStatusPresentationPolicy.displayOrder,
        )
        assertEquals(
            listOf(
                ReservationStatus.PENDING_CONFIRMATION,
                ReservationStatus.CONFIRMED,
                ReservationStatus.CANCELLED,
                ReservationStatus.REFUNDED,
                ReservationStatus.COMPLETED,
            ),
            ReservationStatus.entries.toList(),
        )
    }

    @Test fun quickAddPresentationUsesExistingKindLabelsAndRequiresAValidHttpsLink() {
        val draft = ReservationDraft(
            sessionId = UUID.randomUUID(),
            eventId = "event-1",
            scheduleItemId = null,
            kind = ReservationKind.PURCHASE,
            eventSnapshot = ReservationEventSnapshot(
                title = "상품",
                category = "goods",
                sourceLabel = "공식 판매처",
            ),
            originalActionUrl = "https://example.com/purchase",
            providerHost = "example.com",
            openedAt = Instant.parse("2026-07-25T00:00:00Z"),
            expiresAt = Instant.parse("2026-07-25T02:00:00Z"),
            attemptCount = 1,
        )

        val presentation = ReservationQuickAddPresentationPolicy.presentation(
            draft,
            now = Instant.parse("2026-07-25T00:30:00Z"),
        )

        assertEquals("상품", presentation.title)
        assertEquals(ReservationQuickAddScreenTitle.PURCHASE, presentation.screenTitle)
        assertEquals("상품 구매 진행 중", presentation.inProgressLabel)
        assertEquals("구매 내역에 추가", presentation.primaryActionLabel)
        assertEquals("구매 상세 링크", presentation.detailLinkLabel)
        assertEquals(ReservationDraftExpiryKind.HOURS, presentation.expiry?.kind)
        assertFalse(ReservationQuickAddPresentationPolicy.isPrimaryActionEnabled(null))
        assertFalse(ReservationQuickAddPresentationPolicy.isPrimaryActionEnabled("http://example.com/order"))
        assertTrue(ReservationQuickAddPresentationPolicy.isPrimaryActionEnabled("https://example.com/order"))
    }

    @Test fun quickAddScreenTitleMeaningMatchesEachKindAndGenericStates() {
        assertEquals(
            ReservationQuickAddScreenTitle.GENERIC,
            ReservationQuickAddPresentationPolicy.screenTitle(kind = null),
        )
        assertEquals(
            ReservationQuickAddScreenTitle.TICKET,
            ReservationQuickAddPresentationPolicy.screenTitle(ReservationKind.TICKET),
        )
        assertEquals(
            ReservationQuickAddScreenTitle.PURCHASE,
            ReservationQuickAddPresentationPolicy.screenTitle(ReservationKind.PURCHASE),
        )
        assertEquals(
            ReservationQuickAddScreenTitle.RESERVATION,
            ReservationQuickAddPresentationPolicy.screenTitle(ReservationKind.RESERVATION),
        )
    }

    @Test fun pastListUsesSavedTimeWhileUpcomingUsesScheduledTime() {
        val scheduledAt = Instant.parse("2026-08-01T09:00:00Z")
        val savedAt = Instant.parse("2026-07-23T10:30:00Z")
        val record = record().copy(
            startsAtOverride = scheduledAt,
            createdAt = savedAt,
        )

        assertEquals(
            "scheduled:$scheduledAt",
            ReservationListPolicy.timestampLabel(record, ReservationListSectionKind.UPCOMING) { "scheduled:$it" },
        )
        assertEquals(
            "저장 시각 · saved:$savedAt",
            ReservationListPolicy.timestampLabel(record, ReservationListSectionKind.PAST) { "saved:$it" },
        )
    }

    @Test fun editPresentationPrefillsValuesFromStoredRecordAndEventSnapshot() {
        val base = record().copy(
            eventSnapshot = record().eventSnapshot.copy(
                endsAt = Instant.parse("2026-08-01T10:00:00Z"),
            ),
        )

        val inherited = ReservationEditPresentationPolicy.initialValues(base)
        assertEquals("행사", inherited.title)
        assertEquals(Instant.parse("2026-08-01T08:00:00Z"), inherited.startsAt)
        assertEquals(Instant.parse("2026-08-01T10:00:00Z"), inherited.endsAt)
        assertEquals("기본 장소", inherited.venue)

        val overridden = ReservationEditPresentationPolicy.initialValues(
            base.copy(
                displayTitleOverride = "내 행사",
                startsAtOverride = Instant.parse("2026-08-02T08:00:00Z"),
                endsAtOverride = Instant.parse("2026-08-02T10:00:00Z"),
                venueOverride = "변경 장소",
            ),
        )
        assertEquals("내 행사", overridden.title)
        assertEquals(Instant.parse("2026-08-02T08:00:00Z"), overridden.startsAt)
        assertEquals(Instant.parse("2026-08-02T10:00:00Z"), overridden.endsAt)
        assertEquals("변경 장소", overridden.venue)
    }

    @Test fun editPresentationAvoidsSavingDuplicateEventOverrides() {
        val record = record()

        val inherited = ReservationEditPresentationPolicy.overrides(
            record = record,
            title = record.eventSnapshot.title,
            startsAt = record.eventSnapshot.startsAt,
            endsAt = record.eventSnapshot.endsAt,
            venue = record.eventSnapshot.venueName.orEmpty(),
        )
        assertNull(inherited.title)
        assertNull(inherited.startsAt)
        assertNull(inherited.endsAt)
        assertNull(inherited.venue)

        val changedStart = Instant.parse("2026-08-03T09:00:00Z")
        val changed = ReservationEditPresentationPolicy.overrides(
            record = record,
            title = "수정 제목",
            startsAt = changedStart,
            endsAt = null,
            venue = "수정 장소",
        )
        assertEquals("수정 제목", changed.title)
        assertEquals(changedStart, changed.startsAt)
        assertNull(changed.endsAt)
        assertEquals("수정 장소", changed.venue)
    }

    @Test fun reservationHelpContentIsContextualForListAndDetail() {
        val list = ReservationHelpPolicy.content(ReservationHelpPage.LIST)
        val detail = ReservationHelpPolicy.content(ReservationHelpPage.DETAIL)

        assertEquals(listOf(1, 2, 3), list.steps.map { it.number })

        val pending = list.sections.single { it.id == ReservationHelpSectionId.PENDING_DRAFT }
        assertEquals(ReservationHelpTone.WARNING, pending.tone)
        assertEquals(ReservationHelpAction.VIEW_PENDING, pending.action)

        val linkless = list.sections.single { it.id == ReservationHelpSectionId.LINKLESS_ADD }
        assertEquals(ReservationHelpTone.INFO, linkless.tone)
        assertEquals(ReservationHelpAction.ADD_WITHOUT_LINK, linkless.action)

        val storage = list.sections.single { it.id == ReservationHelpSectionId.LOCAL_STORAGE }
        assertEquals(ReservationHelpTone.SECURITY, storage.tone)

        val actions = detail.sections.single { it.id == ReservationHelpSectionId.DETAIL_ACTIONS }
        assertEquals(ReservationHelpTone.INFO, actions.tone)
        assertEquals(ReservationHelpAction.EDIT_CURRENT_RECORD, actions.action)

        val official = detail.sections.single { it.id == ReservationHelpSectionId.OFFICIAL_EVENT }
        assertEquals(ReservationHelpTone.WARNING, official.tone)

        val deletion = detail.sections.single { it.id == ReservationHelpSectionId.DELETE_WARNING }
        assertEquals(ReservationHelpTone.DANGER, deletion.tone)

        assertEquals(
            listOf(
                ReservationHelpSectionId.PENDING_DRAFT,
                ReservationHelpSectionId.LINKLESS_ADD,
                ReservationHelpSectionId.LIST_GROUPS,
                ReservationHelpSectionId.LOCAL_STORAGE,
            ),
            list.sections.map { it.id },
        )
        assertEquals(
            listOf(
                ReservationHelpSectionId.DETAIL_ACTIONS,
                ReservationHelpSectionId.LINK_PRIORITY,
                ReservationHelpSectionId.USER_OVERRIDES,
                ReservationHelpSectionId.OFFICIAL_EVENT,
                ReservationHelpSectionId.DELETE_WARNING,
            ),
            detail.sections.map { it.id },
        )
        assertEquals(
            listOf(
                ReservationHelpFaqId.RETURN_PROMPT_MISSING,
                ReservationHelpFaqId.DETAIL_LINK_MISSING,
                ReservationHelpFaqId.DUPLICATE_LINK,
                ReservationHelpFaqId.SENSITIVE_LINK,
                ReservationHelpFaqId.OFFICIAL_EVENT_CANCELLED,
            ),
            list.faqs.map { it.id },
        )
        assertEquals(
            listOf(
                R.string.reservation_help_faq_return_question,
                R.string.reservation_help_faq_link_question,
                R.string.reservation_help_faq_duplicate_question,
                R.string.reservation_help_faq_sensitive_question,
                R.string.reservation_help_faq_cancelled_question,
            ),
            list.faqs.map { it.questionRes },
        )
        assertEquals(
            listOf(
                ReservationHelpTone.WARNING,
                ReservationHelpTone.INFO,
                ReservationHelpTone.WARNING,
                ReservationHelpTone.SECURITY,
                ReservationHelpTone.WARNING,
            ),
            list.faqs.map { it.tone },
        )
        assertEquals(
            listOf(
                ReservationHelpAction.VIEW_PENDING,
                ReservationHelpAction.ADD_WITHOUT_LINK,
                ReservationHelpAction.VIEW_EXISTING_RECORD,
                null,
                null,
            ),
            list.faqs.map { it.action },
        )
    }

    @Test fun helpPresentationAdaptsActionsAndStatusToCurrentState() {
        val now = Instant.parse("2026-07-25T00:00:00Z")
        val empty = ReservationHelpPolicy.presentation(
            ReservationHelpPage.LIST,
            ReservationHelpContext(0, null, null, false, false),
            now,
        )
        assertEquals(ReservationHelpStatusKind.GETTING_STARTED, empty.status?.kind)
        assertNull(empty.content.sections.single { it.id == ReservationHelpSectionId.PENDING_DRAFT }.action)
        assertNull(empty.content.sections.single { it.id == ReservationHelpSectionId.LINKLESS_ADD }.action)

        val draft = draft("soon", now.plusSeconds(2_700))
        val context = ReservationHelpContextPolicy.context(listOf(draft), emptyList(), now = now)
        val pending = ReservationHelpPolicy.presentation(ReservationHelpPage.LIST, context, now)
        assertEquals(ReservationHelpStatusKind.PENDING, pending.status?.kind)
        assertEquals(1, pending.status?.activeDraftCount)
        assertEquals(ReservationHelpAction.VIEW_PENDING, pending.status?.action)
        assertEquals(ReservationHelpAction.ADD_WITHOUT_LINK, pending.content.sections.single {
            it.id == ReservationHelpSectionId.LINKLESS_ADD
        }.action)

        val current = record()
        val detail = ReservationHelpPolicy.presentation(
            ReservationHelpPage.DETAIL,
            ReservationHelpContextPolicy.context(emptyList(), listOf(current), currentRecordId = current.id, now = now),
            now,
        )
        assertEquals(ReservationHelpAction.EDIT_CURRENT_RECORD, detail.content.sections.single {
            it.id == ReservationHelpSectionId.DETAIL_ACTIONS
        }.action)
    }

    @Test fun helpContextChoosesEarliestActiveDraftAndIgnoresExpiredDrafts() {
        val now = Instant.parse("2026-07-25T00:00:00Z")
        val later = draft("later", now.plusSeconds(7_200))
        val earlier = draft("earlier", now.plusSeconds(600))
        val expired = draft("expired", now.minusSeconds(1))
        val context = ReservationHelpContextPolicy.context(listOf(later, expired, earlier), emptyList(), now = now)

        assertEquals(2, context.activeDraftCount)
        assertEquals(earlier.expiresAt, context.earliestDraftExpiresAt)
        assertEquals(earlier.sessionId, context.firstDraftSessionId)
    }

    @Test fun draftExpiryPresentationUsesSharedMinuteBoundaries() {
        val now = Instant.parse("2026-07-25T00:00:00Z")
        assertEquals(
            ReservationDraftExpiryKind.HOURS,
            ReservationDraftExpiryPresentationPolicy.presentation(now.plusSeconds(7_200), now)?.kind,
        )
        assertEquals(
            45,
            ReservationDraftExpiryPresentationPolicy.presentation(now.plusSeconds(45 * 60), now)?.value,
        )
        assertEquals(
            8,
            ReservationDraftExpiryPresentationPolicy.presentation(now.plusSeconds(8 * 60), now)?.value,
        )
        assertEquals(
            ReservationDraftExpiryKind.SOON,
            ReservationDraftExpiryPresentationPolicy.presentation(now.plusSeconds(90), now)?.kind,
        )
        assertNull(ReservationDraftExpiryPresentationPolicy.presentation(now, now))
    }

    @Test fun tilePresentationIsDerivedFromActiveDraftKinds() {
        val now = Instant.parse("2026-07-22T00:00:00Z")
        val ticket = draft("ticket", now.plusSeconds(60))
        val purchase = ticket.copy(sessionId = UUID.randomUUID(), eventId = "purchase", kind = ReservationKind.PURCHASE)
        val reservation = ticket.copy(sessionId = UUID.randomUUID(), eventId = "reservation", kind = ReservationKind.RESERVATION)
        assertEquals(ReservationTileState.UNAVAILABLE, ReservationTileStatePolicy.presentation(emptyList()).state)
        assertEquals("진행 중인 내역 없음", ReservationTileStatePolicy.presentation(emptyList()).label)
        assertEquals("예매 내역 추가", ReservationTileStatePolicy.presentation(listOf(ticket)).label)
        assertEquals("구매 내역 추가", ReservationTileStatePolicy.presentation(listOf(purchase)).label)
        assertEquals("예약 내역 추가", ReservationTileStatePolicy.presentation(listOf(reservation)).label)
        assertEquals("진행 내역 3건 확인", ReservationTileStatePolicy.presentation(listOf(ticket, purchase, reservation)).label)
    }

    @Test fun persistedEnumNamesRemainStable() {
        assertEquals(listOf("TICKET", "PURCHASE", "RESERVATION"), ReservationKind.entries.map(Enum<*>::name))
        assertEquals(
            listOf("PENDING_CONFIRMATION", "CONFIRMED", "CANCELLED", "REFUNDED", "COMPLETED"),
            ReservationStatus.entries.map(Enum<*>::name),
        )
    }

    @Test fun detailPresentationBuildsStructuredSectionsFromRecord() {
        val record = record().copy(
            reservationDetailUrl = "https://tickets.example.com/detail/1",
            providerHistoryUrl = "https://account.example.com/orders/1",
            originalActionUrl = "https://tickets.example.com/buy/1",
            startsAtOverride = Instant.parse("2026-08-01T09:00:00Z"),
            endsAtOverride = Instant.parse("2026-08-01T11:00:00Z"),
            venueOverride = "서울 행사장",
            optionText = "A석",
            quantity = 2,
            referenceNumber = "ORDER-1",
            note = "입장 전 본인 확인",
            openedAt = Instant.parse("2026-07-20T09:00:00Z"),
            linkSource = ReservationLinkSource.BROWSER_SHARE,
        )

        val presentation = ReservationDetailPresentationPolicy.presentation(
            record = record,
            formatDateTime = { it.toString() },
            latestEvent = officialEvent(startsAt = record.eventSnapshot.startsAt),
        )

        assertEquals("행사", presentation.title)
        assertEquals("예매 완료", presentation.statusLabel)
        assertEquals("티켓 예매", presentation.kindLabel)
        assertEquals("2026-08-01T09:00:00Z – 2026-08-01T11:00:00Z", presentation.dateTimeLabel)
        assertEquals(
            listOf("시작", "종료", "장소", "옵션", "수량", "예매번호"),
            presentation.informationRows.map { it.label },
        )
        assertEquals(listOf("tickets.example.com", "account.example.com", "tickets.example.com"), presentation.links.map { it.host })
        assertEquals("입장 전 본인 확인", presentation.note)
        assertEquals(listOf("외부 링크 열기", "내역 추가", "최근 수정", "추가 경로"), presentation.recordRows.map { it.label })
        assertTrue(presentation.canOpenOfficialEvent)
        assertFalse(presentation.officialEventChanged)
        assertFalse(presentation.officialEventCancelled)
    }

    @Test fun detailPresentationOmitsBlankInvalidAndDuplicateValues() {
        val record = record().copy(
            eventId = null,
            reservationDetailUrl = "https://example.com/same",
            providerHistoryUrl = "https://example.com/same",
            originalActionUrl = "javascript:alert(1)",
            optionText = "  ",
            quantity = null,
            referenceNumber = null,
            note = " ",
            eventSnapshot = record().eventSnapshot.copy(imageUrl = "http://example.com/image.jpg"),
        )

        val presentation = ReservationDetailPresentationPolicy.presentation(record, Instant::toString)

        assertEquals(1, presentation.links.size)
        assertNull(presentation.note)
        assertNull(presentation.imageUrl)
        assertFalse(presentation.canOpenOfficialEvent)
        assertEquals(listOf("시작", "장소"), presentation.informationRows.map { it.label })
    }

    @Test fun detailPresentationReportsOfficialEventChangesAndCancellation() {
        val record = record()
        val presentation = ReservationDetailPresentationPolicy.presentation(
            record = record,
            formatDateTime = Instant::toString,
            latestEvent = officialEvent(
                title = "변경된 행사명",
                status = HubEventStatus.CANCELLED,
                startsAt = record.eventSnapshot.startsAt,
            ),
        )

        assertTrue(presentation.officialEventChanged)
        assertTrue(presentation.officialEventCancelled)
    }

    @Test fun scheduleWindowUsesPrimaryMainWindowForTicketOpenLink() {
        val event = concertEvent()

        assertEquals(
            ReservationScheduleWindow(concertStart, concertEnd, HubEventTimePrecision.DATETIME, "Asia/Seoul"),
            ReservationSchedulePolicy.window(event, ticketOpenItem()),
        )
        assertEquals(
            ReservationScheduleWindow(concertStart, concertEnd, HubEventTimePrecision.DATETIME, "Asia/Seoul"),
            ReservationSchedulePolicy.window(event, null),
        )
    }

    @Test fun scheduleWindowUsesLinkedMainWindowItself() {
        val dayTwo = scheduleItem(
            id = "day-2",
            kind = HubEventScheduleKind.MAIN_WINDOW,
            startsAt = kst("2026-08-16T00:00"),
            endsAt = kst("2026-08-16T00:00"),
            precision = HubEventTimePrecision.DATE,
            timezone = "Asia/Tokyo",
        )
        val event = concertEvent(extraItems = listOf(dayTwo))

        assertEquals(
            ReservationScheduleWindow(dayTwo.startsAt, dayTwo.endsAt, HubEventTimePrecision.DATE, "Asia/Tokyo"),
            ReservationSchedulePolicy.window(event, dayTwo),
        )
    }

    @Test fun scheduleWindowFallsBackToEventTimesAndSkipsCancelledPrimary() {
        val eventStart = kst("2026-09-01T12:00")
        val eventEnd = kst("2026-09-01T18:00")
        val withoutPrimary = officialEvent(startsAt = eventStart, endsAt = eventEnd, scheduleItems = listOf(ticketOpenItem()))
        val expected = ReservationScheduleWindow(eventStart, eventEnd, HubEventTimePrecision.DATETIME, "Asia/Seoul")

        assertEquals(expected, ReservationSchedulePolicy.window(withoutPrimary, ticketOpenItem()))
        val cancelledPrimary = mainItem().copy(cancelledAt = kst("2026-07-10T09:00"))
        assertEquals(
            expected,
            ReservationSchedulePolicy.window(withoutPrimary.copy(scheduleItems = listOf(ticketOpenItem(), cancelledPrimary)), ticketOpenItem()),
        )
        assertNull(ReservationSchedulePolicy.window(officialEvent(startsAt = null, scheduleItems = listOf(ticketOpenItem())), ticketOpenItem()))

        val snapshot = ReservationSchedulePolicy.snapshot(officialEvent(startsAt = null), null, imageUrl = null)
        assertNull(snapshot.startsAt)
        assertNull(snapshot.endsAt)
        assertEquals(HubEventTimePrecision.DATETIME, snapshot.timePrecision)
        assertEquals("Asia/Seoul", snapshot.timezone)
    }

    @Test fun recordFromTicketOpenLinkStaysUpcomingAndUnchanged() {
        val event = concertEvent()
        val record = record().copy(
            scheduleItemId = "ticket-open",
            eventSnapshot = ReservationSchedulePolicy.snapshot(event, ticketOpenItem(), imageUrl = null),
        )
        val now = kst("2026-07-01T20:05")

        assertEquals(concertStart, record.eventSnapshot.startsAt)
        assertEquals(concertEnd, record.eventSnapshot.endsAt)
        assertEquals(listOf(record), ReservationListPolicy.sections(listOf(record), now).upcoming)
        assertFalse(ReservationDisplayPolicy.officialEventChanged(record, event))
        assertFalse(ReservationDisplayPolicy.officialEventCancelled(record, event))
    }

    @Test fun officialChangeDetectsMovedPrimaryVenueAndCancelledLinkedMainWindow() {
        val event = concertEvent()
        val ticketRecord = record().copy(
            scheduleItemId = "ticket-open",
            eventSnapshot = ReservationSchedulePolicy.snapshot(event, ticketOpenItem(), imageUrl = null),
        )
        val moved = event.copy(scheduleItems = listOf(ticketOpenItem(), mainItem().copy(startsAt = concertStart.plusSeconds(86_400))))

        assertTrue(ReservationDisplayPolicy.officialEventChanged(ticketRecord, moved))
        assertTrue(ReservationDisplayPolicy.officialEventChanged(ticketRecord, event.copy(venueName = "다른 장소")))
        assertFalse(ReservationDisplayPolicy.officialEventChanged(ticketRecord, null))

        val mainRecord = ticketRecord.copy(scheduleItemId = "main")
        val cancelledMain = event.copy(scheduleItems = listOf(ticketOpenItem(), mainItem().copy(cancelledAt = kst("2026-07-10T09:00"))))
        assertTrue(ReservationDisplayPolicy.officialEventCancelled(mainRecord, cancelledMain))
        assertFalse(ReservationDisplayPolicy.officialEventCancelled(ticketRecord, cancelledMain))
        assertTrue(ReservationDisplayPolicy.officialEventCancelled(ticketRecord, event.copy(status = HubEventStatus.CANCELLED)))
    }

    @Test fun sectionsKeepOngoingAndDatePrecisionRecordsUpcomingUntilTheirEnd() {
        val ongoing = record().copy(
            eventSnapshot = record().eventSnapshot.copy(startsAt = kst("2026-05-01T10:00"), endsAt = kst("2026-05-03T18:00")),
        )
        assertEquals(listOf(ongoing), ReservationListPolicy.sections(listOf(ongoing), kst("2026-05-02T12:00")).upcoming)

        val popup = record().copy(eventSnapshot = datePopupSnapshot())
        assertEquals(listOf(popup), ReservationListPolicy.sections(listOf(popup), kst("2026-05-07T10:00")).upcoming)
        assertEquals(listOf(popup), ReservationListPolicy.sections(listOf(popup), kst("2026-05-07T23:59")).upcoming)
        assertEquals(listOf(popup), ReservationListPolicy.sections(listOf(popup), kst("2026-05-08T00:00")).past)

        val overridden = popup.copy(endsAtOverride = kst("2026-05-07T00:00"))
        assertEquals(listOf(overridden), ReservationListPolicy.sections(listOf(overridden), kst("2026-05-07T10:00")).past)
    }

    @Test fun sectionsGroupByStatusAndSortUpcomingByStartWithUndatedLast() {
        val now = kst("2026-07-01T12:00")
        val undated = record().copy(eventSnapshot = record().eventSnapshot.copy(startsAt = null))
        val later = record().copy(startsAtOverride = kst("2026-08-01T12:00"))
        val sooner = record().copy(status = ReservationStatus.PENDING_CONFIRMATION, startsAtOverride = kst("2026-07-02T12:00"))
        val pendingPast = record().copy(status = ReservationStatus.PENDING_CONFIRMATION, startsAtOverride = kst("2026-06-01T12:00"))
        val cancelledFuture = record().copy(status = ReservationStatus.CANCELLED, startsAtOverride = kst("2026-09-01T12:00"))
        val refundedFuture = record().copy(status = ReservationStatus.REFUNDED, startsAtOverride = kst("2026-09-02T12:00"))
        val completedFuture = record().copy(status = ReservationStatus.COMPLETED, startsAtOverride = kst("2026-09-03T12:00"))

        val sections = ReservationListPolicy.sections(
            listOf(undated, later, pendingPast, cancelledFuture, sooner, refundedFuture, completedFuture),
            now,
        )

        assertEquals(listOf(sooner, later, undated), sections.upcoming)
        assertEquals(listOf(completedFuture, refundedFuture, cancelledFuture, pendingPast), sections.past)
    }

    @Test fun entityMappingReadsMissingPrecisionAndTimezoneAsDatetimeInSeoul() {
        val record = recordEntity(precision = null, timezone = null).toDomain()
        assertEquals(HubEventTimePrecision.DATETIME, record.eventSnapshot.timePrecision)
        assertEquals("Asia/Seoul", record.eventSnapshot.timezone)

        val dated = recordEntity(precision = "DATE", timezone = "Asia/Tokyo").toDomain()
        assertEquals(HubEventTimePrecision.DATE, dated.eventSnapshot.timePrecision)
        assertEquals("Asia/Tokyo", dated.eventSnapshot.timezone)

        val draft = ReservationDraftEntity(
            sessionId = UUID.randomUUID().toString(), eventId = "event-1", scheduleItemId = null, kind = "TICKET",
            snapshotTitle = "행사", snapshotCategory = "OFFLINE", snapshotStartsAtEpochMs = null, snapshotEndsAtEpochMs = null,
            snapshotVenueName = null, snapshotVenueAddress = null, snapshotSourceLabel = "공식", snapshotImageUrl = null,
            snapshotTimePrecision = null, snapshotTimezone = null, originalActionUrl = "https://example.com/order",
            providerHost = "example.com", openedAtEpochMs = 0, expiresAtEpochMs = 1, attemptCount = 1,
        ).toDomain()
        assertEquals(HubEventTimePrecision.DATETIME, draft.eventSnapshot.timePrecision)
        assertEquals("Asia/Seoul", draft.eventSnapshot.timezone)
    }

    @Test fun datePrecisionValuesAreFormattedWithoutTime() {
        assertEquals("2026. 5. 7.", ReservationDateFormat.label(Instant.parse("2026-05-06T15:00:00Z"), true, "Asia/Seoul") { "time" })
        assertEquals("time", ReservationDateFormat.label(Instant.parse("2026-05-06T15:00:00Z"), false, "Asia/Seoul") { "time" })

        val popup = record().copy(eventSnapshot = datePopupSnapshot())
        val presentation = ReservationDetailPresentationPolicy.presentation(popup, { "time" })
        assertEquals("2026. 5. 1. – 2026. 5. 7.", presentation.dateTimeLabel)
        assertEquals(listOf("2026. 5. 1.", "2026. 5. 7."), presentation.informationRows.take(2).map { it.value })
        assertEquals("2026. 5. 1.", ReservationListPolicy.timestampLabel(popup, ReservationListSectionKind.UPCOMING) { "time" })

        val overridden = popup.copy(endsAtOverride = kst("2026-05-07T20:00"))
        assertEquals("2026. 5. 1. – time", ReservationDetailPresentationPolicy.presentation(overridden, { "time" }).dateTimeLabel)
    }

    @Test fun returnPromptRequiresTenSecondsSinceOpen() {
        val now = Instant.parse("2026-07-22T00:00:20Z")
        val eligible = draft("eligible", now.plusSeconds(20)).copy(openedAt = now.minusSeconds(10))
        assertEquals(
            ReservationReturnPromptDecision.Single(eligible.sessionId),
            ReservationReturnPromptPolicy.decision(listOf(eligible), emptyMap(), null, now),
        )
        val tooSoon = eligible.copy(sessionId = UUID.randomUUID(), openedAt = now.minusSeconds(9))
        assertEquals(
            ReservationReturnPromptDecision.None,
            ReservationReturnPromptPolicy.decision(listOf(tooSoon), emptyMap(), null, now),
        )
    }

    @Test fun returnPromptStaysSilentAfterPromptUntilUserLeavesAgain() {
        val now = Instant.parse("2026-07-22T00:10:00Z")
        val opened = draft("prompted", now.plusSeconds(600)).copy(openedAt = now.minusSeconds(300))
        val promptedAt = mapOf(opened.sessionId to now.minusSeconds(120))

        assertEquals(
            ReservationReturnPromptDecision.None,
            ReservationReturnPromptPolicy.decision(listOf(opened), promptedAt, null, now),
        )
        assertEquals(
            ReservationReturnPromptDecision.None,
            ReservationReturnPromptPolicy.decision(listOf(opened), promptedAt, now.minusSeconds(200), now),
        )
        assertEquals(
            ReservationReturnPromptDecision.Single(opened.sessionId),
            ReservationReturnPromptPolicy.decision(listOf(opened), promptedAt, now.minusSeconds(60), now),
        )
        assertEquals(
            ReservationReturnPromptDecision.None,
            ReservationReturnPromptPolicy.decision(listOf(opened), promptedAt, now.minusSeconds(5), now),
        )
    }

    @Test fun returnPromptAppearsAgainWhenLinkIsReopenedAfterPrompt() {
        val now = Instant.parse("2026-07-22T00:10:00Z")
        val reopened = draft("reopened", now.plusSeconds(600)).copy(openedAt = now.minusSeconds(30))
        val promptedAt = mapOf(reopened.sessionId to now.minusSeconds(120))
        assertEquals(
            ReservationReturnPromptDecision.Single(reopened.sessionId),
            ReservationReturnPromptPolicy.decision(listOf(reopened), promptedAt, null, now),
        )
    }

    @Test fun returnPromptIgnoresExpiredDrafts() {
        val now = Instant.parse("2026-07-22T00:10:00Z")
        val expired = draft("expired", now.minusSeconds(1)).copy(openedAt = now.minusSeconds(300))
        assertEquals(
            ReservationReturnPromptDecision.None,
            ReservationReturnPromptPolicy.decision(listOf(expired), emptyMap(), null, now),
        )
    }

    @Test fun returnPromptPresentationKeepsTicketPurchaseAndReservationMeaningsDistinct() {
        assertEquals(
            ReservationReturnPromptPresentationKind.TICKET,
            ReservationReturnPromptPresentationPolicy.single(ReservationKind.TICKET),
        )
        assertEquals(
            ReservationReturnPromptPresentationKind.PURCHASE,
            ReservationReturnPromptPresentationPolicy.single(ReservationKind.PURCHASE),
        )
        assertEquals(
            ReservationReturnPromptPresentationKind.RESERVATION,
            ReservationReturnPromptPresentationPolicy.single(ReservationKind.RESERVATION),
        )
        val now = Instant.parse("2026-07-22T00:00:20Z")
        val first = draft("first", now.plusSeconds(40)).copy(openedAt = now.minusSeconds(10))
        val second = draft("second", now.plusSeconds(40)).copy(openedAt = now.minusSeconds(10))
        assertTrue(
            ReservationReturnPromptPolicy.decision(
                drafts = listOf(first, second),
                promptedAt = emptyMap(),
                lastBackgroundedAt = null,
                now = now,
            ) is ReservationReturnPromptDecision.Multiple,
        )
    }

    @Test fun draftPolicyRemovesExpiredAndRequiresChoiceForMultiple() {
        val now = Instant.parse("2026-07-22T00:00:00Z")
        val active = draft("active", now.plusSeconds(60))
        val expired = draft("expired", now.minusSeconds(1))
        assertEquals(listOf(active), ReservationDraftPolicy.active(listOf(expired, active), now))
        assertTrue(ReservationDraftPolicy.selection(listOf(active), now) is ReservationDraftSelection.Selected)
        assertTrue(ReservationDraftPolicy.selection(listOf(active, draft("other", now.plusSeconds(60))), now) is ReservationDraftSelection.Choose)
        assertEquals(ReservationDraftSelection.None, ReservationDraftPolicy.selection(listOf(expired), now))
    }

    private val seoul: ZoneId = ZoneId.of("Asia/Seoul")
    private val concertStart: Instant = kst("2026-08-15T18:00")
    private val concertEnd: Instant = kst("2026-08-15T21:00")

    private fun kst(value: String): Instant = LocalDateTime.parse(value).atZone(seoul).toInstant()

    private fun scheduleItem(
        id: String,
        kind: HubEventScheduleKind,
        startsAt: Instant,
        endsAt: Instant? = null,
        precision: HubEventTimePrecision = HubEventTimePrecision.DATETIME,
        timezone: String = "Asia/Seoul",
        isPrimary: Boolean = false,
    ) = HubEventScheduleItem(
        id = id, kind = kind, label = id, startsAt = startsAt, endsAt = endsAt,
        timePrecision = precision, timezone = timezone, isPrimary = isPrimary,
    )

    private fun ticketOpenItem() = scheduleItem("ticket-open", HubEventScheduleKind.TICKET_OPEN, kst("2026-07-01T20:00"))

    private fun mainItem() = scheduleItem("main", HubEventScheduleKind.MAIN_WINDOW, concertStart, concertEnd, isPrimary = true)

    private fun concertEvent(extraItems: List<HubEventScheduleItem> = emptyList()) = officialEvent(
        startsAt = concertStart,
        endsAt = concertEnd,
        scheduleItems = listOf(ticketOpenItem(), mainItem()) + extraItems,
    )

    private fun officialEvent(
        title: String = "행사",
        status: HubEventStatus = HubEventStatus.UPCOMING,
        startsAt: Instant? = Instant.parse("2026-08-01T08:00:00Z"),
        endsAt: Instant? = null,
        venueName: String? = "기본 장소",
        scheduleItems: List<HubEventScheduleItem> = emptyList(),
    ) = HubEvent(
        id = "event-1",
        category = HubEventCategory.OFFLINE_CONCERT,
        participationMode = HubEventParticipationMode.OFFLINE,
        status = status,
        title = title,
        generationId = "gen",
        sourceUrl = "https://example.com/source",
        sourceLabel = "공식 출처",
        sourceType = HubEventSourceType.OFFICIAL,
        scheduleItems = scheduleItems,
        startsAt = startsAt,
        endsAt = endsAt,
        venueName = venueName,
        updatedAt = Instant.parse("2026-07-01T00:00:00Z"),
    )

    private fun datePopupSnapshot() = record().eventSnapshot.copy(
        startsAt = kst("2026-05-01T00:00"),
        endsAt = kst("2026-05-07T00:00"),
        timePrecision = HubEventTimePrecision.DATE,
    )

    private fun recordEntity(precision: String?, timezone: String?) = ReservationRecordEntity(
        id = UUID.randomUUID().toString(), sourceSessionId = null, eventId = "event-1", scheduleItemId = null,
        kind = "TICKET", status = "CONFIRMED", snapshotTitle = "행사", snapshotCategory = "OFFLINE",
        snapshotStartsAtEpochMs = 0, snapshotEndsAtEpochMs = null, snapshotVenueName = null, snapshotVenueAddress = null,
        snapshotSourceLabel = "공식", snapshotImageUrl = null, snapshotTimePrecision = precision, snapshotTimezone = timezone,
        originalActionUrl = null, reservationDetailUrl = null, providerHistoryUrl = null, linkSource = null,
        displayTitleOverride = null, startsAtOverrideEpochMs = null, endsAtOverrideEpochMs = null, venueOverride = null,
        optionText = null, quantity = null, referenceNumber = null, note = null, openedAtEpochMs = null,
        confirmedAtEpochMs = 0, createdAtEpochMs = 0, updatedAtEpochMs = 0, effectiveStartsAtEpochMs = 0, schemaVersion = 1,
    )

    private fun draft(eventId: String, expiresAt: Instant) = ReservationDraft(
        sessionId = UUID.randomUUID(), eventId = eventId, scheduleItemId = null, kind = ReservationKind.TICKET,
        eventSnapshot = ReservationEventSnapshot(eventId, "OFFLINE", sourceLabel = "source"),
        originalActionUrl = "https://example.com/$eventId", providerHost = "example.com",
        openedAt = expiresAt.minusSeconds(30), expiresAt = expiresAt, attemptCount = 1,
    )

    private fun record(): ReservationRecord {
        val createdAt = Instant.parse("2026-07-21T09:00:00Z")
        return ReservationRecord(
            id = UUID.randomUUID(),
            sourceSessionId = UUID.randomUUID(),
            eventId = "event-1",
            scheduleItemId = null,
            kind = ReservationKind.TICKET,
            status = ReservationStatus.CONFIRMED,
            eventSnapshot = ReservationEventSnapshot(
                title = "행사",
                category = "OFFLINE",
                startsAt = Instant.parse("2026-08-01T08:00:00Z"),
                venueName = "기본 장소",
                sourceLabel = "공식 출처",
                imageUrl = "https://example.com/image.jpg",
            ),
            originalActionUrl = null,
            reservationDetailUrl = null,
            providerHistoryUrl = null,
            linkSource = ReservationLinkSource.APP_INPUT,
            displayTitleOverride = null,
            startsAtOverride = null,
            endsAtOverride = null,
            venueOverride = null,
            optionText = null,
            quantity = null,
            referenceNumber = null,
            note = null,
            openedAt = null,
            confirmedAt = createdAt,
            createdAt = createdAt,
            updatedAt = createdAt.plusSeconds(60),
        )
    }
}
