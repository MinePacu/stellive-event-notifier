package dev.minepacu.stelliveeventnotifier.feature.reservations

import dev.minepacu.stelliveeventnotifier.core.model.HubEventLinkKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationActionPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraft
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftSelection
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEventSnapshot
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationExternalLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDeepLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDeepLinkRoute
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

    @Test fun tilePresentationIsDerivedFromActiveDraftCount() {
        assertEquals(ReservationTileState.UNAVAILABLE, ReservationTileStatePolicy.presentation(0).state)
        assertEquals("예약 완료로 추가", ReservationTileStatePolicy.presentation(1).label)
        assertEquals("예약 3건 확인", ReservationTileStatePolicy.presentation(3).label)
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
}
