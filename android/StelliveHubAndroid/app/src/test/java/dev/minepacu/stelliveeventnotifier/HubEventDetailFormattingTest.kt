package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubEventCategory
import dev.minepacu.stelliveeventnotifier.core.model.HubEventParticipationMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleItem
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleMode
import dev.minepacu.stelliveeventnotifier.core.model.HubEventSourceType
import dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailFormatting
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventHeroTagTone
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
    fun linkActionLabelFollowsCategory() {
        assertEquals("구매 링크", HubEventDetailFormatting.linkActionLabel(HubEventCategory.ONLINE_GOODS))
        assertEquals("구매 링크", HubEventDetailFormatting.linkActionLabel(HubEventCategory.ONLINE_COLLAB))
        assertEquals("티켓 링크", HubEventDetailFormatting.linkActionLabel(HubEventCategory.OFFLINE_CONCERT))
        assertEquals("티켓 링크", HubEventDetailFormatting.linkActionLabel(HubEventCategory.TICKETING))
        assertEquals("예약 링크", HubEventDetailFormatting.linkActionLabel(HubEventCategory.OFFLINE_COLLAB))
        assertEquals("예약 링크", HubEventDetailFormatting.linkActionLabel(HubEventCategory.OFFLINE_POPUP))
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

    @Test
    fun heroSubtitleSplitsVenueAndPeriodAcrossLines() {
        val lines = HubEventDetailFormatting.heroSubtitleLines(sampleEvent(), zone)

        assertEquals(
            listOf(
                "더현대 서울 B2 아이코닉 스퀘어",
                "2026.06.17 (수) 19:00 - 2026.06.23 (화) 21:00",
            ),
            lines,
        )
    }

    @Test
    fun heroTagsAreDeduplicatedAndUseDistinctTones() {
        val tags = HubEventDetailFormatting.heroTags(sampleEvent())

        assertEquals(listOf("진행 중", "굿즈", "오프라인"), tags.map { it.label })
        assertEquals(
            listOf(
                HubEventHeroTagTone.STATUS,
                HubEventHeroTagTone.CATEGORY,
                HubEventHeroTagTone.PARTICIPATION,
            ),
            tags.map { it.tone },
        )
        assertEquals(tags.size, tags.map { it.label }.toSet().size)
    }

    @Test
    fun timelineSortsChronologicallyAndShowsCompletedCurrentAndCancelledStates() {
        val event = sampleEvent().copy(
            scheduleItems = listOf(
                schedule("future", "2026-06-20T00:00:00Z"),
                schedule("completed", "2026-06-10T00:00:00Z"),
                schedule("current", "2026-06-12T00:00:00Z", "2026-06-14T00:00:00Z"),
                schedule("cancelled", "2026-06-11T00:00:00Z", cancelled = true),
            ),
        )

        val timeline = HubEventDetailFormatting.timeline(event, Instant.parse("2026-06-13T00:00:00Z"))

        assertEquals(listOf("completed", "cancelled", "current", "future"), timeline.map { it.schedule.id })
        assertEquals(listOf("완료", "취소", "진행", "예정"), timeline.map { it.stateText })
    }

    @Test
    fun timelineModeHidesParentPeriodRowsAndUsesNextActiveScheduleInHero() {
        val event = sampleEvent().copy(
            scheduleMode = HubEventScheduleMode.TIMELINE,
            scheduleItems = listOf(
                schedule("cancelled", "2026-06-14T00:00:00Z", cancelled = true),
                schedule("next", "2026-06-20T00:00:00Z"),
            ),
        )

        assertFalse(HubEventDetailFormatting.rows(event, zone).any { it.label == "시작" || it.label == "기간" })
        assertEquals(listOf("next"), HubEventDetailFormatting.activeScheduleItems(event).map { it.id })
        assertEquals("next", HubEventDetailFormatting.nextScheduleItem(event, Instant.parse("2026-06-15T00:00:00Z"))?.id)
        assertEquals(
            "다음 일정 · next · 2026.06.20 (토) 09:00",
            HubEventDetailFormatting.heroSubtitleLines(event, zone, Instant.parse("2026-06-15T00:00:00Z")).last(),
        )
    }

    @Test
    fun scheduleActionsPreferHttpsActionUrlAndMapLabels() {
        val item = schedule("sales", "2026-06-20T00:00:00Z").copy(
            kind = HubEventScheduleKind.SALES_OPEN,
            actionUrl = "http://unsafe.example/action",
            sourceUrl = "https://safe.example/source",
        )

        assertEquals("https://safe.example/source", HubEventDetailFormatting.scheduleActionUrl(item))
        assertEquals("구매/예약 페이지", HubEventDetailFormatting.scheduleActionLabel(item.kind))
        assertEquals("티켓 페이지", HubEventDetailFormatting.scheduleActionLabel(HubEventScheduleKind.TICKET_OPEN))
        assertEquals("콘텐츠", HubEventDetailFormatting.scheduleActionLabel(HubEventScheduleKind.CONTENT_REVEAL))
        assertEquals("공지", HubEventDetailFormatting.scheduleActionLabel(HubEventScheduleKind.ANNOUNCEMENT))
        assertEquals("상세 보기", HubEventDetailFormatting.scheduleActionLabel(HubEventScheduleKind.DEADLINE))
    }

    private fun schedule(id: String, startsAt: String, endsAt: String? = null, cancelled: Boolean = false) =
        HubEventScheduleItem(
            id = id,
            kind = HubEventScheduleKind.CUSTOM,
            label = id,
            startsAt = Instant.parse(startsAt),
            endsAt = endsAt?.let(Instant::parse),
            cancelledAt = if (cancelled) Instant.parse("2026-06-10T00:00:00Z") else null,
        )

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
