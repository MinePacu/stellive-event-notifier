package dev.minepacu.stelliveeventnotifier.feature.reservations.domain

import java.net.URI
import java.time.Instant

data class ReservationDetailPresentation(
    val title: String,
    val statusLabel: String,
    val kindLabel: String,
    val dateTimeLabel: String?,
    val sourceLabel: String,
    val imageUrl: String?,
    val informationRows: List<ReservationDetailRow>,
    val links: List<ReservationDetailLink>,
    val note: String?,
    val recordRows: List<ReservationDetailRow>,
    val canOpenOfficialEvent: Boolean,
    val officialEventChanged: Boolean,
    val officialEventCancelled: Boolean,
)

data class ReservationDetailRow(
    val label: String,
    val value: String,
)

data class ReservationDetailLink(
    val label: String,
    val host: String,
    val url: String,
)

object ReservationDetailPresentationPolicy {
    fun presentation(
        record: ReservationRecord,
        formatDateTime: (Instant) -> String,
        officialEventAvailable: Boolean = false,
        latestOfficialTitle: String? = null,
        latestOfficialStartsAt: Instant? = null,
        officialEventCancelled: Boolean = false,
    ): ReservationDetailPresentation {
        val startsAt = record.effectiveStartsAt
        val endsAt = record.effectiveEndsAt
        val dateTimeLabel = when {
            startsAt != null && endsAt != null -> "${formatDateTime(startsAt)} – ${formatDateTime(endsAt)}"
            startsAt != null -> formatDateTime(startsAt)
            endsAt != null -> "종료 ${formatDateTime(endsAt)}"
            else -> null
        }
        val informationRows = buildList {
            startsAt?.let { add(ReservationDetailRow("시작", formatDateTime(it))) }
            endsAt?.let { add(ReservationDetailRow("종료", formatDateTime(it))) }
            record.effectiveVenue.nonBlank()?.let { add(ReservationDetailRow("장소", it)) }
            record.optionText.nonBlank()?.let { add(ReservationDetailRow("옵션", it)) }
            record.quantity?.takeIf { it > 0 }?.let { add(ReservationDetailRow("수량", "${it}개")) }
            record.referenceNumber.nonBlank()?.let {
                add(ReservationDetailRow(ReservationPresentationPolicy.referenceNumberLabel(record.kind), it))
            }
        }
        val links = buildList {
            addLink(ReservationPresentationPolicy.detailLinkLabel(record.kind), record.reservationDetailUrl)
            addLink("제공사 내역 링크", record.providerHistoryUrl)
            addLink("최초 연결 링크", record.originalActionUrl)
        }.distinctBy(ReservationDetailLink::url)
        val recordRows = buildList {
            record.openedAt?.let { add(ReservationDetailRow("외부 링크 열기", formatDateTime(it))) }
            add(ReservationDetailRow("내역 추가", formatDateTime(record.createdAt)))
            add(ReservationDetailRow("최근 수정", formatDateTime(record.updatedAt)))
            record.linkSource?.let { add(ReservationDetailRow("추가 경로", linkSourceLabel(it))) }
        }
        return ReservationDetailPresentation(
            title = record.displayTitle,
            statusLabel = ReservationPresentationPolicy.statusLabel(record.kind, record.status),
            kindLabel = ReservationPresentationPolicy.kindLabel(record.kind),
            dateTimeLabel = dateTimeLabel,
            sourceLabel = record.eventSnapshot.sourceLabel,
            imageUrl = record.eventSnapshot.imageUrl?.takeIf(::isDisplayableImageUrl),
            informationRows = informationRows,
            links = links,
            note = record.note.nonBlank(),
            recordRows = recordRows,
            canOpenOfficialEvent = officialEventAvailable && record.eventId != null,
            officialEventChanged = ReservationDisplayPolicy.officialEventChanged(
                record = record,
                latestTitle = latestOfficialTitle,
                latestStartsAt = latestOfficialStartsAt,
            ),
            officialEventCancelled = officialEventAvailable && officialEventCancelled,
        )
    }

    private fun MutableList<ReservationDetailLink>.addLink(label: String, rawUrl: String?) {
        val value = rawUrl.nonBlank() ?: return
        val uri = runCatching { URI(value) }.getOrNull() ?: return
        if (uri.scheme?.lowercase() !in setOf("http", "https") || uri.host.isNullOrBlank()) return
        add(
            ReservationDetailLink(
                label = label,
                host = uri.host.removePrefix("www."),
                url = uri.toASCIIString(),
            )
        )
    }

    private fun isDisplayableImageUrl(value: String): Boolean {
        val uri = runCatching { URI(value) }.getOrNull() ?: return false
        return uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank()
    }

    private fun linkSourceLabel(source: ReservationLinkSource): String = when (source) {
        ReservationLinkSource.APP_INPUT -> "앱에서 직접 추가"
        ReservationLinkSource.BROWSER_SHARE -> "브라우저 공유"
        ReservationLinkSource.SYSTEM_SHORTCUT -> "빠른 설정"
    }

    private fun String?.nonBlank(): String? = this?.trim()?.takeIf(String::isNotEmpty)
}
