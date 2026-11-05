package dev.minepacu.stelliveeventnotifier.feature.home

import dev.minepacu.stelliveeventnotifier.core.network.LiveStatusHealthDto
import java.time.Duration
import java.time.Instant

/** Turns the bootstrap `liveStatusHealth` into the connection label and the live-screen notice. */
object LiveStatusHealthPolicy {
    val STALE_THRESHOLD: Duration = Duration.ofMinutes(5)

    private const val EMPTY_LABEL = "서버 연결됨 · 라이브 폴링 꺼짐/데이터 없음"
    private const val OK_LABEL = "서버 liveStatus"

    fun label(liveStatusEmpty: Boolean, health: LiveStatusHealthDto?, serverTime: String?, now: Instant): String =
        when (val s = status(health, serverTime, now)) {
            Status.Unavailable -> "서버 연결됨 · 라이브 상태 확인 불가"
            Status.Disabled -> "서버 연결됨 · 라이브 수집 꺼짐"
            is Status.Stale -> "서버 연결됨 · 라이브 정보 지연 (${s.minutes}분 전 확인)"
            Status.Fresh -> if (liveStatusEmpty) EMPTY_LABEL else OK_LABEL
        }

    fun notice(health: LiveStatusHealthDto?, serverTime: String?, now: Instant): String? =
        when (val s = status(health, serverTime, now)) {
            Status.Unavailable -> "지금은 방송 상태를 확인할 수 없어요. 방송 중이어도 표시되지 않을 수 있어요."
            Status.Disabled -> "라이브 상태 수집이 꺼져 있어요."
            is Status.Stale -> "라이브 정보가 ${s.minutes}분 전 기준이에요."
            Status.Fresh -> null
        }

    private sealed interface Status {
        object Fresh : Status
        object Unavailable : Status
        object Disabled : Status
        data class Stale(val minutes: Long) : Status
    }

    // Unknown or missing state is treated like an old server without health: Fresh.
    private fun status(health: LiveStatusHealthDto?, serverTime: String?, now: Instant): Status =
        when (health?.state) {
            "unavailable" -> Status.Unavailable
            "disabled" -> Status.Disabled
            "ok", "rate_limited" -> {
                val last = parse(health?.lastSuccessfulAt)
                val reference = parse(serverTime) ?: now
                val age = last?.let { Duration.between(it, reference) }
                if (age != null && age > STALE_THRESHOLD) Status.Stale(age.toMinutes()) else Status.Fresh
            }
            else -> Status.Fresh
        }

    private fun parse(value: String?): Instant? = value?.let { runCatching { Instant.parse(it) }.getOrNull() }
}
