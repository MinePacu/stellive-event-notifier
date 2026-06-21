package dev.stellive.hub

import dev.stellive.hub.core.model.HubEvent
import dev.stellive.hub.core.model.HubEventCategory
import dev.stellive.hub.core.model.HubEventParticipationMode
import dev.stellive.hub.core.model.HubEventSourceType
import dev.stellive.hub.core.model.HubEventStatus
import dev.stellive.hub.feature.hubevents.HubEventDetailFormatting
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class HubEventDetailFormattingTest {
    private val zone = ZoneId.of("Asia/Seoul")

    @Test
    fun detailRowsUseSharedOrder() {
        val rows = HubEventDetailFormatting.rows(sampleEvent(), zone)

        assertEquals(
            listOf("장소", "시작", "기간", "참여 방식", "분류", "출처"),
            rows.map { it.label },
        )
    }

    @Test
    fun noticeCopyMatchesDesignSource() {
        assertEquals(
            "일정, 장소, 판매/입장 조건은 공식 공지 변경에 따라 달라질 수 있습니다. 앱은 확인용 요약만 제공하므로 참여 전 반드시 출처 링크에서 최신 공지를 확인하세요.",
            HubEventDetailFormatting.NoticeText,
        )
    }

    @Test
    fun summaryLabelDoesNotRepeatTitle() {
        val event = sampleEvent()

        assertEquals("핵심 안내", HubEventDetailFormatting.SummaryLabel)
        assertFalse(HubEventDetailFormatting.SummaryLabel.contains(event.title))
    }

    @Test
    fun periodUsesStartAndEndWhenBothExist() {
        val period = HubEventDetailFormatting.periodText(sampleEvent(), zone)

        assertEquals("2026.06.17 (수) 19:00 - 2026.06.23 (화) 21:00", period)
    }

    @Test
    fun periodTextForStartOnlyEventDoesNotShowUnknownEnd() {
        val period = HubEventDetailFormatting.periodText(sampleEvent().copy(endsAt = null), zone)

        assertEquals("2026.06.17 (수) 19:00 시작", period)
        assertFalse(period.contains("종료 미정"))
    }

    private fun sampleEvent(): HubEvent =
        HubEvent(
            id = "popup-store",
            category = HubEventCategory.ONLINE_GOODS,
            participationMode = HubEventParticipationMode.OFFLINE,
            status = HubEventStatus.OPEN,
            title = "팝업 스토어 현장 입장 시작",
            summary = "현장 입장과 굿즈 판매가 함께 진행됩니다.",
            memberId = null,
            generationId = "official",
            sourceUrl = "https://example.com/source",
            sourceLabel = "공식 공지 기반 HubEvent",
            sourceType = HubEventSourceType.OFFICIAL,
            announcedAt = Instant.parse("2026-06-10T01:00:00Z"),
            startsAt = Instant.parse("2026-06-17T10:00:00Z"),
            endsAt = Instant.parse("2026-06-23T12:00:00Z"),
            purchaseUrl = null,
            ticketUrl = null,
            venueName = "더현대 서울 B2 아이코닉 스퀘어",
            venueAddress = null,
            image = null,
            notificationEligible = true,
            updatedAt = Instant.parse("2026-06-10T01:00:00Z"),
        )
}
