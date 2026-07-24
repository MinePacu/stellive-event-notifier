package dev.minepacu.stelliveeventnotifier.feature.reservations

import dev.minepacu.stelliveeventnotifier.core.model.HubEventLinkKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationActionPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraft
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftSelection
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDetailPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEventSnapshot
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationExternalLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpPage
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationLinkSource
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationListPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationListSectionKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationRecord
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationStatus
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDeepLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDeepLinkRoute
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEditPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptDecision
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationShareIntentParser
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationTileState
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationTileStatePolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationURLPolicy
import java.time.Instant
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReservationPoliciesTest {
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

        assertEquals("내 예약·구매 도움말", list.title)
        assertTrue(list.sections.any { it.title == "확인 필요" })
        assertTrue(list.sections.any { it.title == "예정된 내역과 지난 내역" })
        assertEquals("내역 상세 도움말", detail.title)
        assertTrue(detail.sections.any { it.title == "내역 링크" })
        assertTrue(detail.sections.any { it.title == "내역 삭제" })
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
            officialEventAvailable = true,
            latestOfficialTitle = record.eventSnapshot.title,
            latestOfficialStartsAt = record.eventSnapshot.startsAt,
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
            officialEventAvailable = true,
            latestOfficialTitle = "변경된 행사명",
            latestOfficialStartsAt = record.eventSnapshot.startsAt,
            officialEventCancelled = true,
        )

        assertTrue(presentation.officialEventChanged)
        assertTrue(presentation.officialEventCancelled)
    }

    @Test fun returnPromptRequiresTenSecondsAndPromptsEachSessionOnce() {
        val now = Instant.parse("2026-07-22T00:00:20Z")
        val eligible = draft("eligible", now.plusSeconds(20)).copy(openedAt = now.minusSeconds(10))
        assertEquals(
            ReservationReturnPromptDecision.Single(eligible.sessionId),
            ReservationReturnPromptPolicy.decision(listOf(eligible), setOf(eligible.sessionId), emptySet(), now),
        )
        assertEquals(
            ReservationReturnPromptDecision.None,
            ReservationReturnPromptPolicy.decision(listOf(eligible), setOf(eligible.sessionId), setOf(eligible.sessionId), now),
        )
        val tooSoon = eligible.copy(sessionId = UUID.randomUUID(), openedAt = now.minusSeconds(9))
        assertEquals(
            ReservationReturnPromptDecision.None,
            ReservationReturnPromptPolicy.decision(listOf(tooSoon), setOf(tooSoon.sessionId), emptySet(), now),
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
