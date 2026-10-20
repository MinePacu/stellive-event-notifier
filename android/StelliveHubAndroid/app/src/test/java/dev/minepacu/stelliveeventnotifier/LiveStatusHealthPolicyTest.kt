package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.core.network.BootstrapResponseDto
import dev.minepacu.stelliveeventnotifier.core.network.HubApiClient
import dev.minepacu.stelliveeventnotifier.core.network.LiveStatusHealthDto
import dev.minepacu.stelliveeventnotifier.feature.home.LiveStatusHealthPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant

class LiveStatusHealthPolicyTest {
    private val now = Instant.parse("2026-10-20T12:00:00Z")
    private val emptyLabel = "서버 연결됨 · 라이브 폴링 꺼짐/데이터 없음"

    private fun health(state: String?, lastSuccessfulAt: String? = null) =
        LiveStatusHealthDto(state = state, lastSuccessfulAt = lastSuccessfulAt)

    private fun label(h: LiveStatusHealthDto?, empty: Boolean = false, serverTime: String? = null, at: Instant = now) =
        LiveStatusHealthPolicy.label(empty, h, serverTime, at)

    @Test
    fun absentHealthKeepsLegacyLabels() {
        assertEquals(emptyLabel, label(null, empty = true))
        assertEquals("서버 liveStatus", label(null))
        assertNull(LiveStatusHealthPolicy.notice(null, null, now))
    }

    @Test
    fun unavailableAndDisabledOverrideLabelAndNotice() {
        assertEquals("서버 연결됨 · 라이브 상태 확인 불가", label(health("unavailable"), empty = true))
        assertEquals("서버 연결됨 · 라이브 수집 꺼짐", label(health("disabled")))
        assertEquals(
            "지금은 방송 상태를 확인할 수 없어요. 방송 중이어도 표시되지 않을 수 있어요.",
            LiveStatusHealthPolicy.notice(health("unavailable"), null, now),
        )
        assertEquals("라이브 상태 수집이 꺼져 있어요.", LiveStatusHealthPolicy.notice(health("disabled"), null, now))
    }

    @Test
    fun okAndRateLimitedWithoutStaleKeepLegacyLabels() {
        listOf("ok", "rate_limited").forEach { state ->
            assertEquals("서버 liveStatus", label(health(state)))
            assertEquals(emptyLabel, label(health(state, "2026-10-20T11:59:00Z"), empty = true))
            assertNull(LiveStatusHealthPolicy.notice(health(state), null, now))
        }
    }

    @Test
    fun staleBoundaryIsExclusiveAtFiveMinutes() {
        assertEquals("서버 liveStatus", label(health("ok", "2026-10-20T11:55:00Z")))
        val stale = health("ok", "2026-10-20T11:54:59Z")
        assertEquals("서버 연결됨 · 라이브 정보 지연 (5분 전 확인)", label(stale))
        assertEquals("라이브 정보가 5분 전 기준이에요.", LiveStatusHealthPolicy.notice(stale, null, now))
        assertEquals("서버 연결됨 · 라이브 정보 지연 (12분 전 확인)", label(health("rate_limited", "2026-10-20T11:48:00Z")))
    }

    @Test
    fun serverTimeIsPreferredOverDeviceClock() {
        val h = health("ok", "2026-10-20T11:00:00Z")
        // Device clock is badly behind; server time says 20 minutes have passed.
        assertEquals(
            "서버 연결됨 · 라이브 정보 지연 (20분 전 확인)",
            label(h, serverTime = "2026-10-20T11:20:00Z", at = Instant.parse("2026-10-20T11:01:00Z")),
        )
        // Server time says fresh although the device clock is far ahead.
        assertEquals("서버 liveStatus", label(h, serverTime = "2026-10-20T11:03:00Z", at = now))
    }

    @Test
    fun unknownStateIsParsedAsAbsent() {
        val json = """{"config":{"unofficialProject":true,"catalogVersion":"x","officialYoutubeLiveExcluded":true,"hubCalendarEnabled":true},"liveStatusHealth":{"state":"future_state"}}"""
        val decoded = HubApiClient.moshi().adapter(BootstrapResponseDto::class.java).fromJson(json)
        assertEquals("서버 liveStatus", label(decoded?.liveStatusHealth))
        assertNull(LiveStatusHealthPolicy.notice(decoded?.liveStatusHealth, null, now))
    }

    @Test
    fun healthFieldsParseFromBootstrapJson() {
        val json = """{"config":{"unofficialProject":true,"catalogVersion":"x","officialYoutubeLiveExcluded":true,"hubCalendarEnabled":true},"liveStatusHealth":{"state":"ok","lastSuccessfulAt":"2026-10-20T11:00:00Z"},"serverTime":"2026-10-20T11:10:00Z"}"""
        val decoded = HubApiClient.moshi().adapter(BootstrapResponseDto::class.java).fromJson(json)
        assertEquals("ok", decoded?.liveStatusHealth?.state)
        assertEquals("서버 연결됨 · 라이브 정보 지연 (10분 전 확인)", label(decoded?.liveStatusHealth, serverTime = decoded?.serverTime))
    }
}
