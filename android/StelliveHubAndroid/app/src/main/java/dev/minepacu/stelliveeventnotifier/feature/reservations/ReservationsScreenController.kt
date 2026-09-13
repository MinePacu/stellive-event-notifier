package dev.minepacu.stelliveeventnotifier.feature.reservations

import android.app.AlertDialog
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.RippleDrawable
import android.transition.AutoTransition
import android.transition.TransitionManager
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import com.google.android.material.card.MaterialCardView
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.google.android.material.snackbar.Snackbar
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.feature.home.HubScreen
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDetailLink
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDetailPresentation
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDetailPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDetailRow
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraft
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftExpiryKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftExpiryPresentation
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftExpiryPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEditPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEditStatusPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpAction
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpContextPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpFaq
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpFaqExpansionPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpFaqId
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpPage
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpSection
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpSectionId
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpStatusKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpStatusPresentation
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpStep
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpTone
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationListPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationListSectionKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationRecord
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationStatus
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationURLPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.system.ReservationQuickAddActivity
import dev.minepacu.stelliveeventnotifier.feature.reservations.system.ReservationSystemShortcutCoordinator
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardStyle
import dev.minepacu.stelliveeventnotifier.ui.components.HubSingleChoiceBottomSheet
import dev.minepacu.stelliveeventnotifier.ui.components.HubSingleChoiceOption
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

private const val RESERVATION_PENDING_SECTION_TAG = "reservation_pending_section"
private const val RESERVATION_UPCOMING_SECTION_TAG = "reservation_upcoming_section"

/**
 * Owns all Reservations-screen (list + detail + edit + help) VIEW-BUILDING and state-transition
 * logic that previously lived directly on [MainActivity], following the same extraction shape as
 * [dev.minepacu.stelliveeventnotifier.feature.settings.SettingsScreenController],
 * [dev.minepacu.stelliveeventnotifier.feature.songs.SongsScreenController], and
 * [dev.minepacu.stelliveeventnotifier.feature.goodsevents.GoodsEventsScreenController].
 *
 * Dependency-injection choice: like Settings/Songs/GoodsEvents, this one takes the concrete
 * [MainActivity] rather than a narrow interface - Reservations view-building is entangled with
 * generic Activity-wide UI-atom helpers (color/dp/rounded/baseCard/...), the screen-navigation
 * stack, and GoodsEvents-owned state (`goodsEvents`, `hubEventCard`) it links into.
 *
 * State ownership: all Reservations session/UI state (`reservationDrafts`, `reservationRecords`,
 * `selectedReservationId`, `reservationDateFormatter`, `reservationEditHasUnsavedChanges`,
 * `pendingReservationHelpScrollAction`, `expandedReservationHelpFaqId`,
 * `reservationHelpFaqUiStates`) stays on [MainActivity] as `internal` fields, exactly like
 * Settings/Songs/GoodsEvents kept theirs - `renderScreen()` and `confirmReservationEditDiscardIfNeeded()`
 * (both still on MainActivity, shared/generic navigation infrastructure) read/write
 * `reservationEditHasUnsavedChanges` directly, so it had to stay put and internal rather than move.
 *
 * `ReservationHelpFaqUiState` (the per-FAQ view-handle bundle) also stays a nested type of
 * [MainActivity] - the `reservationHelpFaqUiStates` map field that stores it stays on MainActivity,
 * so the type has to be at least as visible as that field. `ReservationDateTimeInput`,
 * `ReservationEditTextInput`, and `ReservationEditStatusInput`, by contrast, are purely local
 * return types of functions that moved here wholesale and are not held by any MainActivity field,
 * so they moved here too as private nested data classes (matching how GoodsEventsScreenController
 * moved `ScheduleBadgeTone`/`ScheduleBadgePresentation`).
 *
 * Reservations-adjacent functions that were evaluated for this extraction but intentionally NOT
 * moved (kept `internal` on MainActivity, called back into from here or from elsewhere):
 * - `openHubEventLink()`: already bumped to `internal` and kept on MainActivity during the
 *   GoodsEvents extraction (GoodsEventsScreenController's schedule/detail cards call it directly);
 *   moving it now would re-break that call site for no benefit.
 * - `reservationSummaryCard()`: conceptually Reservations-flavored but shown atop the GoodsEvents
 *   screen; GoodsEventsScreenController calls `activity.reservationSummaryCard()` directly, so per
 *   the shared-helper rule it stays put on MainActivity rather than being duplicated or moved.
 * - `evaluateReservationReturnPrompt()`, `showReservationReturnPrompt()`, `returnPromptTitleRes()`,
 *   `dismissReservationReturnPrompt()`: this "return prompt" banner cluster is invoked from
 *   Activity-wide generic lifecycle/navigation code that is not part of any single screen -
 *   `onResume()` (`::evaluateReservationReturnPrompt` callback) and `handleSystemBackPressed()`
 *   (`dismissReservationReturnPrompt()`) both live on MainActivity and are shared across every
 *   screen, not just Reservations. Splitting the cluster across two files would also separate
 *   `dismissReservationReturnPrompt()` from the `reservationReturnPromptView` field and
 *   `RETURN_PROMPT_ANIMATION_DURATION_MS` constant it shares with the rest of the cluster.
 * - `scheduleReservationReturnPromptPositionUpdate()`: has a hard, already-existing dependency
 *   from `SongsScreenController.scheduleSongScrollToTopButtonPositionUpdate()`, which calls
 *   `activity.scheduleReservationReturnPromptPositionUpdate()` directly - moving it would require
 *   touching the already-extracted Songs controller, which is out of scope here.
 * - `confirmReservationEditDiscardIfNeeded()`: generic back/pop-navigation guard called from
 *   `handleSystemBackPressed()` and `popScreen()` (both shared, unextracted MainActivity
 *   infrastructure covering every screen), so it stays with them.
 *
 * `openLinkedOfficialEvent()`, by contrast, moved here: its only caller is
 * `renderReservationDetail()` (moving with it), and it only writes GoodsEvents-owned `internal`
 * fields (`selectedHubEventId`, `selectedHubEventScheduleItemId`, `serverHubEventDetailLoadedId`)
 * already exposed for cross-controller use plus `pushScreen()` - no duplication needed.
 *
 * Shared-helper decisions: generic/stateful UI atoms also used by not-yet-extracted or other
 * already-extracted screens (`startScreen`, `pushScreen`, `popScreen`, `renderScreen`, `binding`,
 * `dp`, `color`, `rounded`, `divider`, `baseCard`, `compactEventCard`, `sectionLabel`,
 * `detailActionButton`, `hubEventCard`, `hubEventThumbnail`, `pillRow`, `openExternalUrl`,
 * `navigationHistory`, `handleAppDeepLink`, `reservationRepository`, `goodsEvents`) stay on
 * MainActivity (visibility bumped to `internal` where still `private` - `pillRow`,
 * `hubEventThumbnail`, and `renderScreen` needed that bump for this extraction) and are called
 * back into here instead of being duplicated. The tiny one-off `Int.withAlpha()` color helper is a
 * MEMBER extension function of MainActivity (not a plain function), so calling it from here would
 * need a dual receiver (`with(activity) { ... }`); since it is a single-line generic atom, it is
 * duplicated privately in this file instead, per the small/generic-atom rule - MainActivity keeps
 * its own copy untouched for any other internal use.
 */
internal class ReservationsScreenController(private val activity: MainActivity) {

    private data class ReservationDateTimeInput(
        val field: EditText,
        var value: Instant?,
        val view: View,
    )

    private data class ReservationEditTextInput(
        val field: EditText,
        val view: View,
    )

    private data class ReservationEditStatusInput(
        val view: View,
        val update: (ReservationStatus) -> Unit,
    )

    // region Screen entry points (called from MainActivity.renderScreen)

    internal fun renderReservations() {
        activity.startScreen(
            screenId = "reservations",
            title = "내 예약·구매",
            role = "임시 항목과 내역은 이 기기에 저장되며 외부 완료 여부를 자동 확인하지 않습니다.",
            showExpandedBodyHeader = false,
        )
        activity.binding.contentList.addView(activity.detailActionButton("빠른 설정에 내역 추가 버튼 넣기 ›", false) {
            ReservationSystemShortcutCoordinator.requestTile(activity)
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, activity.dp(48)).apply { bottomMargin = activity.dp(10) })
        val now = Instant.now()
        val activeDrafts = ReservationDraftPolicy.active(activity.reservationDrafts, now)
        if (activeDrafts.isNotEmpty()) {
            activity.binding.contentList.addView(activity.sectionLabel("확인 필요").apply { tag = RESERVATION_PENDING_SECTION_TAG })
            activeDrafts.sortedByDescending(ReservationDraft::openedAt).forEach { draft ->
                activity.binding.contentList.addView(activity.baseCard(HubCardStyle.COMPACT).apply {
                    addView(LinearLayout(context).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding(activity.dp(15), activity.dp(13), activity.dp(15), activity.dp(13))
                        addView(TextView(context).apply { text = draft.eventSnapshot.title; textSize = 15f; typeface = Typeface.DEFAULT_BOLD; setTextColor(activity.color(R.color.hub_text)) })
                        addView(TextView(context).apply { text = "${ReservationPresentationPolicy.inProgressLabel(draft.kind)} · ${draft.providerHost}"; textSize = 12f; setTextColor(activity.color(R.color.hub_text_muted)); setPadding(0, activity.dp(4), 0, 0) })
                        ReservationDraftExpiryPresentationPolicy.presentation(draft.expiresAt, now)?.let { expiry ->
                            addView(TextView(context).apply {
                                text = reservationDraftExpiryText(expiry)
                                textSize = 12f
                                typeface = Typeface.DEFAULT_BOLD
                                setTextColor(activity.color(R.color.hub_warning))
                                setPadding(0, activity.dp(5), 0, 0)
                            })
                        }
                        addView(LinearLayout(context).apply {
                            orientation = LinearLayout.HORIZONTAL
                            addView(activity.detailActionButton("취소", false) {
                                activity.lifecycleScope.launch { activity.reservationRepository.deleteDraft(draft) }
                            }, LinearLayout.LayoutParams(0, activity.dp(44), 1f).apply { marginEnd = activity.dp(5) })
                            addView(activity.detailActionButton(ReservationPresentationPolicy.addActionLabel(draft.kind), true) {
                                activity.startActivity(Intent(activity, ReservationQuickAddActivity::class.java).putExtra(ReservationQuickAddActivity.EXTRA_SESSION_ID, draft.sessionId.toString()))
                            }, LinearLayout.LayoutParams(0, activity.dp(44), 1f).apply { marginStart = activity.dp(5) })
                        }.apply { setPadding(0, activity.dp(10), 0, 0) })
                    })
                })
            }
        }
        val sections = ReservationListPolicy.sections(activity.reservationRecords)
        addReservationRecordSection("예정된 내역", sections.upcoming, ReservationListSectionKind.UPCOMING)
        addReservationRecordSection("지난 내역", sections.past, ReservationListSectionKind.PAST)
        if (activeDrafts.isEmpty() && activity.reservationRecords.isEmpty()) {
            activity.binding.contentList.addView(activity.compactEventCard("저장된 내역 없음", "굿즈·행사에서 티켓, 구매 또는 예약 링크를 열면 진행 중인 항목이 여기에 표시됩니다.", emptyList()))
            activity.binding.contentList.addView(activity.detailActionButton("사용 방법 보기", false) {
                activity.pushScreen(HubScreen.RESERVATIONS_HELP)
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, activity.dp(48)).apply {
                bottomMargin = activity.dp(10)
            })
        }
        activity.pendingReservationHelpScrollAction?.let { action ->
            activity.pendingReservationHelpScrollAction = null
            val targetTag = when (action) {
                ReservationHelpAction.VIEW_PENDING -> RESERVATION_PENDING_SECTION_TAG
                ReservationHelpAction.VIEW_UPCOMING -> RESERVATION_UPCOMING_SECTION_TAG
                else -> null
            }
            targetTag?.let(::scrollReservationContentToTag)
        }
    }

    internal fun renderReservationDetail() {
        val record = activity.reservationRecords.firstOrNull { it.id == activity.selectedReservationId }
        activity.startScreen(
            screenId = "reservation_detail",
            title = "내역 상세",
            role = "예약·예매·구매 정보와 링크는 이 기기에만 저장됩니다.",
            showExpandedBodyHeader = record == null,
        )
        if (record == null) {
            activity.binding.contentList.addView(activity.compactEventCard("내역을 찾을 수 없음", "목록에서 다시 선택해 주세요.", listOf("로컬 기록")))
            return
        }
        val latestEvent = record.eventId?.let { eventId -> activity.goodsEvents.firstOrNull { it.id == eventId } }
        val presentation = ReservationDetailPresentationPolicy.presentation(
            record = record,
            formatDateTime = activity.reservationDateFormatter::format,
            officialEventAvailable = latestEvent != null,
            latestOfficialTitle = latestEvent?.title,
            latestOfficialStartsAt = latestEvent?.startsAt,
            officialEventCancelled = latestEvent?.status == dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus.CANCELLED,
        )

        activity.binding.contentList.addView(reservationDetailSummaryCard(presentation, record.status))
        activity.binding.contentList.addView(activity.sectionLabel("빠른 동작"))
        activity.binding.contentList.addView(reservationDetailActionRow(presentation.links.firstOrNull()?.url))

        if (presentation.informationRows.isNotEmpty()) {
            activity.binding.contentList.addView(activity.sectionLabel("내역 정보"))
            activity.binding.contentList.addView(reservationDetailRowsCard(presentation.informationRows))
        }
        if (presentation.links.isNotEmpty()) {
            activity.binding.contentList.addView(activity.sectionLabel("관련 링크"))
            presentation.links.forEach { link ->
                activity.binding.contentList.addView(reservationDetailLinkCard(link))
            }
        }
        presentation.note?.let { note ->
            activity.binding.contentList.addView(activity.sectionLabel("메모"))
            activity.binding.contentList.addView(reservationDetailTextCard(note))
        }
        if (presentation.canOpenOfficialEvent && latestEvent != null) {
            activity.binding.contentList.addView(activity.sectionLabel("연결된 공식 행사"))
            activity.binding.contentList.addView(activity.hubEventCard(latestEvent).apply {
                setOnClickListener { openLinkedOfficialEvent(latestEvent.id) }
                contentDescription = "${latestEvent.title}, 연결된 공식 행사 열기"
            })
        }
        if (presentation.officialEventChanged) {
            activity.binding.contentList.addView(activity.compactEventCard(
                "공식 일정 변경됨",
                "저장 당시 정보와 현재 공식 행사 정보가 다릅니다. 사용자 수정값과 내역 상태는 자동으로 바꾸지 않습니다.",
                listOf("확인 필요"),
            ))
        }
        if (presentation.officialEventCancelled) {
            activity.binding.contentList.addView(activity.compactEventCard(
                "공식 행사 취소 안내",
                "공식 행사가 취소되었습니다. 사용자의 내역 상태는 자동으로 취소하지 않습니다.",
                listOf("공식 정보"),
            ))
        }
        activity.binding.contentList.addView(activity.sectionLabel("기록 정보"))
        activity.binding.contentList.addView(reservationDetailRowsCard(presentation.recordRows))
        activity.binding.contentList.addView(activity.sectionLabel("위험 동작"))
        activity.binding.contentList.addView(reservationDetailDeleteButton(record))
    }

    internal fun renderReservationHelp(page: ReservationHelpPage) {
        val now = Instant.now()
        val presentation = ReservationHelpPolicy.presentation(
            page = page,
            context = ReservationHelpContextPolicy.context(
                drafts = activity.reservationDrafts,
                records = activity.reservationRecords,
                currentRecordId = activity.selectedReservationId?.takeIf { id -> activity.reservationRecords.any { it.id == id } },
                now = now,
            ),
            now = now,
        )
        val content = presentation.content
        val screenId = when (page) {
            ReservationHelpPage.LIST -> HubScreen.RESERVATIONS_HELP.id
            ReservationHelpPage.DETAIL -> HubScreen.RESERVATION_DETAIL_HELP.id
        }
        activity.startScreen(
            screenId = screenId,
            title = activity.getString(content.titleRes),
            role = activity.getString(content.summaryRes),
            showExpandedBodyHeader = false,
        )
        presentation.status
            ?.takeUnless { it.kind == ReservationHelpStatusKind.GETTING_STARTED }
            ?.let { activity.binding.contentList.addView(reservationHelpStatusCard(it)) }
        if (content.steps.isNotEmpty()) {
            activity.binding.contentList.addView(activity.sectionLabel(activity.getString(R.string.reservation_help_steps_header)))
            activity.binding.contentList.addView(reservationHelpStepsCard(content.steps))
        }
        content.sections.forEach { section ->
            activity.binding.contentList.addView(reservationHelpSectionCard(section))
        }
        if (content.faqs.isNotEmpty()) {
            activity.binding.contentList.addView(activity.sectionLabel(activity.getString(R.string.reservation_help_faq_header)))
            activity.reservationHelpFaqUiStates.clear()
            content.faqs.forEach { faq ->
                activity.binding.contentList.addView(reservationHelpFaqCard(faq))
            }
        }
    }

    internal fun renderReservationEdit() {
        val record = activity.reservationRecords.firstOrNull { it.id == activity.selectedReservationId }
        activity.startScreen(
            screenId = "reservation_edit",
            title = "내역 수정",
            role = "민감할 수 있는 링크와 예매·주문·예약번호는 서버나 로그로 전송하지 않습니다.",
            showExpandedBodyHeader = false,
        )
        if (record == null) return
        val initialValues = ReservationEditPresentationPolicy.initialValues(record)
        val titleInput = reservationEditField("표시 제목", initialValues.title)
        val title = titleInput.field
        val startsAt = reservationDateTimeInput("시작 날짜와 시각", initialValues.startsAt)
        val endsAt = reservationDateTimeInput("종료 날짜와 시각", initialValues.endsAt)
        val venueInput = reservationEditField("장소", initialValues.venue)
        val venue = venueInput.field
        val detailUrlInput = reservationEditField(ReservationPresentationPolicy.detailLinkLabel(record.kind), record.reservationDetailUrl.orEmpty(), placeholder = "https://")
        val detailUrl = detailUrlInput.field
        val historyUrlInput = reservationEditField("제공사 내역 URL", record.providerHistoryUrl.orEmpty(), placeholder = "https://")
        val historyUrl = historyUrlInput.field
        val optionInput = reservationEditField("좌석 또는 상품 옵션", record.optionText.orEmpty())
        val option = optionInput.field
        val quantityInput = reservationEditField("수량", record.quantity?.toString().orEmpty())
        val quantity = quantityInput.field.apply {
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
        }
        val referenceInput = reservationEditField(ReservationPresentationPolicy.referenceNumberLabel(record.kind), record.referenceNumber.orEmpty())
        val reference = referenceInput.field
        val noteInput = reservationEditField("메모", record.note.orEmpty(), multiline = true)
        val note = noteInput.field
        var status = record.status
        val statusInput = reservationEditStatusInput(record.kind, status) { selected -> status = selected }
        activity.reservationEditHasUnsavedChanges = {
            status != record.status ||
                title.text.toString().trim() != initialValues.title ||
                startsAt.value != initialValues.startsAt ||
                endsAt.value != initialValues.endsAt ||
                venue.text.toString().trim() != initialValues.venue ||
                detailUrl.text.toString().trim().takeIf(String::isNotEmpty) != record.reservationDetailUrl ||
                historyUrl.text.toString().trim().takeIf(String::isNotEmpty) != record.providerHistoryUrl ||
                option.text.toString().trim().takeIf(String::isNotEmpty) != record.optionText ||
                quantity.text.toString().trim().takeIf(String::isNotEmpty) != record.quantity?.toString() ||
                reference.text.toString().trim().takeIf(String::isNotEmpty) != record.referenceNumber ||
                note.text.toString().trim().takeIf(String::isNotEmpty) != record.note
        }
        activity.binding.contentList.addView(reservationEditPanel(
            title = "기본 정보",
            description = "화면에 표시할 이름과 현재 내역 상태를 정리합니다.",
            children = listOf(titleInput.view, statusInput.view, venueInput.view),
        ))
        activity.binding.contentList.addView(reservationEditPanel(
            title = "일정",
            description = "직접 설정한 일정은 저장된 행사 정보보다 우선 표시됩니다.",
            children = listOf(startsAt.view, endsAt.view),
        ))
        activity.binding.contentList.addView(reservationEditPanel(
            title = "추가 정보",
            description = "예매·주문·예약번호를 포함한 입력 내용은 이 기기에만 저장됩니다.",
            children = listOf(optionInput.view, quantityInput.view, referenceInput.view, noteInput.view),
        ))
        activity.binding.contentList.addView(reservationEditPanel(
            title = "관련 링크",
            description = "호스트가 포함된 HTTPS 주소만 저장할 수 있습니다.",
            children = listOf(detailUrlInput.view, historyUrlInput.view),
        ))
        activity.binding.contentList.addView(activity.detailActionButton("저장", true) {
            val detailValidation = detailUrl.text.toString().takeIf(String::isNotBlank)?.let(ReservationURLPolicy::validate)
            val historyValidation = historyUrl.text.toString().takeIf(String::isNotBlank)?.let(ReservationURLPolicy::validate)
            if (detailValidation?.isValid == false || historyValidation?.isValid == false) {
                Toast.makeText(activity, "HTTPS 링크를 확인해 주세요.", Toast.LENGTH_SHORT).show()
                return@detailActionButton
            }
            val quantityText = quantity.text.toString().trim()
            val parsedQuantity = quantityText.takeIf(String::isNotEmpty)?.toIntOrNull()
            if (quantityText.isNotEmpty() && (parsedQuantity == null || parsedQuantity <= 0)) {
                quantity.error = "수량은 1 이상의 숫자로 입력해 주세요."
                quantity.requestFocus()
                return@detailActionButton
            }
            val selectedStart = startsAt.value
            val selectedEnd = endsAt.value
            if (selectedStart != null && selectedEnd != null && !selectedEnd.isAfter(selectedStart)) {
                Toast.makeText(activity, "종료 시각은 시작 시각보다 뒤여야 합니다.", Toast.LENGTH_SHORT).show()
                return@detailActionButton
            }
            val save: () -> Unit = {
                activity.lifecycleScope.launch {
                    runCatching {
                        val overrides = ReservationEditPresentationPolicy.overrides(
                            record = record,
                            title = title.text.toString(),
                            startsAt = startsAt.value,
                            endsAt = endsAt.value,
                            venue = venue.text.toString(),
                        )
                        activity.reservationRepository.update(record.copy(
                            status = status,
                            displayTitleOverride = overrides.title,
                            startsAtOverride = overrides.startsAt,
                            endsAtOverride = overrides.endsAt,
                            venueOverride = overrides.venue,
                            reservationDetailUrl = detailValidation?.normalizedUrl,
                            providerHistoryUrl = historyValidation?.normalizedUrl,
                            optionText = option.text.toString().trim().takeIf(String::isNotEmpty),
                            quantity = parsedQuantity,
                            referenceNumber = reference.text.toString().trim().takeIf(String::isNotEmpty),
                            note = note.text.toString().trim().takeIf(String::isNotEmpty),
                            updatedAt = Instant.now(),
                        ))
                    }.onSuccess {
                        activity.reservationEditHasUnsavedChanges = null
                        activity.popScreen()
                    }.onFailure {
                        Toast.makeText(activity, "내역 변경 내용을 저장하지 못했습니다.", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            val confirmSensitiveAndSave = {
                if (detailValidation?.isSensitive == true || historyValidation?.isSensitive == true) {
                    AlertDialog.Builder(activity).setTitle("민감할 수 있는 링크").setMessage("인증 정보가 포함될 수 있습니다. 이 기기에만 저장할까요?")
                        .setNegativeButton("취소", null).setPositiveButton("로컬 저장") { _, _ -> save() }.show()
                } else save()
            }
            activity.lifecycleScope.launch {
                val detailURL = detailValidation?.normalizedUrl
                val duplicate = detailURL != null &&
                    detailURL != record.reservationDetailUrl &&
                    activity.reservationRepository.hasReservationDetailUrl(detailURL, excludingId = record.id)
                if (duplicate) {
                    AlertDialog.Builder(activity)
                        .setTitle("이미 저장된 링크")
                        .setMessage("같은 상세 링크가 다른 내역에 있습니다. 그래도 저장할까요?")
                        .setNegativeButton("취소", null)
                        .setPositiveButton("그래도 저장") { _, _ -> confirmSensitiveAndSave() }
                        .show()
                } else {
                    confirmSensitiveAndSave()
                }
            }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, activity.dp(52)).apply {
            topMargin = activity.dp(2)
            bottomMargin = activity.dp(10)
        })
    }

    // endregion

    private fun addReservationRecordSection(
        title: String,
        records: List<ReservationRecord>,
        section: ReservationListSectionKind,
    ) {
        if (records.isEmpty()) return
        activity.binding.contentList.addView(activity.sectionLabel(title).apply {
            if (section == ReservationListSectionKind.UPCOMING) tag = RESERVATION_UPCOMING_SECTION_TAG
        })
        records.forEach { record ->
            activity.binding.contentList.addView(activity.baseCard(HubCardStyle.INTERACTIVE).apply {
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    activity.selectedReservationId = record.id
                    activity.pushScreen(HubScreen.RESERVATION_DETAIL)
                }
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(activity.dp(15), activity.dp(13), activity.dp(15), activity.dp(13))
                    addView(TextView(context).apply { text = record.displayTitle; textSize = 15f; typeface = Typeface.DEFAULT_BOLD; setTextColor(activity.color(R.color.hub_text)) })
                    addView(TextView(context).apply {
                        text = "${ReservationPresentationPolicy.statusLabel(record.kind, record.status)} · ${record.eventSnapshot.sourceLabel}"
                        textSize = 12f; setTextColor(activity.color(R.color.hub_text_muted)); setPadding(0, activity.dp(4), 0, 0)
                    })
                    ReservationListPolicy.timestampLabel(record, section, activity.reservationDateFormatter::format)?.let { label ->
                        addView(TextView(context).apply {
                            text = label
                            textSize = 12f
                            setTextColor(activity.color(R.color.hub_text_muted))
                            setPadding(0, activity.dp(4), 0, 0)
                        })
                    }
                    if (record.reservationDetailUrl != null) addView(TextView(context).apply { text = "${ReservationPresentationPolicy.detailLinkLabel(record.kind)} 있음"; textSize = 11f; setTextColor(activity.color(R.color.hub_primary)); setPadding(0, activity.dp(5), 0, 0) })
                })
            })
        }
    }

    private fun reservationHelpStepsCard(steps: List<ReservationHelpStep>): MaterialCardView =
        activity.baseCard(HubCardStyle.STANDARD).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(10) }
            strokeWidth = activity.dp(1)
            strokeColor = activity.color(R.color.hub_primary)
            setCardBackgroundColor(activity.color(R.color.hub_accent_soft))
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(activity.dp(16), activity.dp(14), activity.dp(16), activity.dp(14))
                steps.forEachIndexed { index, step ->
                    if (index > 0) {
                        addView(View(context).apply {
                            setBackgroundColor(activity.color(R.color.hub_primary).withAlpha(45))
                        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, activity.dp(1)).apply {
                            marginStart = activity.dp(42)
                            topMargin = activity.dp(11)
                            bottomMargin = activity.dp(11)
                        })
                    }
                    addView(reservationHelpStepRow(step))
                }
            })
        }

    private fun reservationHelpStepRow(step: ReservationHelpStep): LinearLayout =
        LinearLayout(activity).apply {
            val title = activity.getString(step.titleRes)
            val body = activity.getString(step.bodyRes)
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.TOP
            contentDescription = activity.getString(R.string.reservation_help_step_accessibility, step.number, title, body)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
            addView(TextView(context).apply {
                text = step.number.toString()
                gravity = Gravity.CENTER
                textSize = 14f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(activity.color(R.color.hub_on_primary))
                background = activity.rounded(activity.color(R.color.hub_primary), activity.dp(18))
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, LinearLayout.LayoutParams(activity.dp(32), activity.dp(32)).apply { marginEnd = activity.dp(10) })
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(context).apply {
                    text = title
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(activity.color(R.color.hub_text))
                })
                addView(TextView(context).apply {
                    text = body
                    textSize = 13f
                    setTextColor(activity.color(R.color.hub_text_muted))
                    setLineSpacing(0f, 1.12f)
                    setPadding(0, activity.dp(4), 0, 0)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }

    private fun reservationHelpSectionCard(section: ReservationHelpSection): MaterialCardView {
        val accent = when (section.tone) {
            ReservationHelpTone.NORMAL -> activity.color(R.color.hub_text_muted)
            ReservationHelpTone.INFO,
            ReservationHelpTone.SECURITY -> activity.color(R.color.hub_primary)
            ReservationHelpTone.WARNING -> activity.color(R.color.hub_warning)
            ReservationHelpTone.DANGER -> activity.color(R.color.hub_schedule_tag_cancelled)
        }
        val background = when (section.tone) {
            ReservationHelpTone.NORMAL -> activity.color(R.color.hub_card_surface)
            ReservationHelpTone.INFO,
            ReservationHelpTone.SECURITY -> activity.color(R.color.hub_accent_soft)
            ReservationHelpTone.WARNING -> activity.color(R.color.hub_warning_soft)
            ReservationHelpTone.DANGER -> activity.color(R.color.hub_schedule_tag_cancelled_soft)
        }
        val icon = when (section.tone) {
            ReservationHelpTone.NORMAL,
            ReservationHelpTone.INFO -> android.R.drawable.ic_dialog_info
            ReservationHelpTone.WARNING -> android.R.drawable.ic_dialog_alert
            ReservationHelpTone.SECURITY -> android.R.drawable.ic_lock_lock
            ReservationHelpTone.DANGER -> android.R.drawable.ic_menu_delete
        }
        val meaning = when (section.tone) {
            ReservationHelpTone.NORMAL -> activity.getString(R.string.reservation_help_tone_normal)
            ReservationHelpTone.INFO -> activity.getString(R.string.reservation_help_tone_info)
            ReservationHelpTone.WARNING -> activity.getString(R.string.reservation_help_tone_warning)
            ReservationHelpTone.SECURITY -> activity.getString(R.string.reservation_help_tone_security)
            ReservationHelpTone.DANGER -> activity.getString(R.string.reservation_help_tone_danger)
        }
        val title = activity.getString(section.titleRes)
        val body = activity.getString(section.bodyRes)
        return activity.baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(10) }
            strokeWidth = activity.dp(1)
            strokeColor = accent
            setCardBackgroundColor(background)
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.TOP
                setPadding(activity.dp(14), activity.dp(14), activity.dp(14), activity.dp(14))
                addView(ImageView(context).apply {
                    setImageResource(icon)
                    imageTintList = ColorStateList.valueOf(accent)
                    contentDescription = meaning
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                }, LinearLayout.LayoutParams(activity.dp(24), activity.dp(24)).apply { marginEnd = activity.dp(11) })
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(context).apply {
                        text = title
                        textSize = 15f
                        typeface = Typeface.DEFAULT_BOLD
                        setTextColor(accent)
                        contentDescription = activity.getString(R.string.reservation_help_section_accessibility, meaning, title)
                        ViewCompat.setAccessibilityHeading(this, true)
                    })
                    addView(TextView(context).apply {
                        text = body
                        textSize = 13f
                        setTextColor(activity.color(R.color.hub_text))
                        setLineSpacing(0f, 1.14f)
                        setPadding(0, activity.dp(6), 0, 0)
                    })
                    section.pointResIds.forEach { pointRes ->
                        addView(TextView(context).apply {
                            val point = activity.getString(pointRes)
                            text = "• $point"
                            textSize = 13f
                            setTextColor(activity.color(R.color.hub_text))
                            setLineSpacing(0f, 1.14f)
                            setPadding(0, activity.dp(8), 0, 0)
                            contentDescription = point
                        })
                    }
                    section.action?.let { action ->
                        addView(activity.detailActionButton(reservationHelpActionLabel(action), false) {
                            performReservationHelpAction(action)
                        }, LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            activity.dp(48),
                        ).apply { topMargin = activity.dp(10) })
                    }
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            })
        }
    }

    private fun reservationHelpStatusCard(status: ReservationHelpStatusPresentation): MaterialCardView {
        val title = when (status.kind) {
            ReservationHelpStatusKind.PENDING -> activity.getString(
                R.string.reservation_help_status_pending_title,
                status.activeDraftCount,
            )
            ReservationHelpStatusKind.MANAGE_RECORDS -> activity.getString(R.string.reservation_help_status_manage_title)
            ReservationHelpStatusKind.GETTING_STARTED -> activity.getString(R.string.reservation_help_steps_header)
        }
        val body = when (status.kind) {
            ReservationHelpStatusKind.PENDING -> buildString {
                append(activity.getString(R.string.reservation_help_status_pending_body))
                status.expiry?.let {
                    append("\n")
                    append(activity.getString(R.string.reservation_help_status_expiry, reservationDraftExpiryText(it)))
                }
            }
            ReservationHelpStatusKind.MANAGE_RECORDS -> activity.getString(R.string.reservation_help_status_manage_body)
            ReservationHelpStatusKind.GETTING_STARTED -> activity.getString(R.string.reservation_help_list_summary)
        }
        return reservationHelpSectionCard(
            ReservationHelpSection(
                id = ReservationHelpSectionId.PENDING_DRAFT,
                tone = status.tone,
                titleRes = when (status.kind) {
                    ReservationHelpStatusKind.PENDING -> R.string.reservation_help_pending_title
                    ReservationHelpStatusKind.MANAGE_RECORDS -> R.string.reservation_help_status_manage_title
                    ReservationHelpStatusKind.GETTING_STARTED -> R.string.reservation_help_steps_header
                },
                bodyRes = when (status.kind) {
                    ReservationHelpStatusKind.PENDING -> R.string.reservation_help_status_pending_body
                    ReservationHelpStatusKind.MANAGE_RECORDS -> R.string.reservation_help_status_manage_body
                    ReservationHelpStatusKind.GETTING_STARTED -> R.string.reservation_help_list_summary
                },
                action = status.action,
            ),
        ).apply {
            val content = ((getChildAt(0) as? LinearLayout)?.getChildAt(1) as? LinearLayout)
            (content?.getChildAt(0) as? TextView)?.apply {
                text = title
                contentDescription = title
            }
            (content?.getChildAt(1) as? TextView)?.text = body
        }
    }

    private fun reservationHelpFaqCard(faq: ReservationHelpFaq): MaterialCardView {
        val question = activity.getString(faq.questionRes)
        val card = activity.baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(8) }
            strokeWidth = activity.dp(1)
            strokeColor = activity.color(R.color.hub_line)
            setCardBackgroundColor(activity.color(R.color.hub_card_surface))
        }
        val content = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        val header = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = activity.dp(56)
            setPadding(activity.dp(14), activity.dp(12), activity.dp(10), activity.dp(12))
            isClickable = true
            isFocusable = true
            descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
            accessibilityDelegate = object : View.AccessibilityDelegate() {
                override fun onInitializeAccessibilityNodeInfo(host: View, info: android.view.accessibility.AccessibilityNodeInfo) {
                    super.onInitializeAccessibilityNodeInfo(host, info)
                    info.className = android.widget.Button::class.java.name
                    info.isClickable = true
                }
            }
        }
        header.addView(ImageView(activity).apply {
            setImageResource(reservationHelpFaqToneIcon(faq.tone))
            imageTintList = ColorStateList.valueOf(reservationHelpFaqToneColor(faq.tone))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(activity.dp(22), activity.dp(22)).apply { marginEnd = activity.dp(12) })
        header.addView(TextView(activity).apply {
            text = question
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(activity.color(R.color.hub_text))
            setLineSpacing(0f, 1.12f)
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        val chevron = ImageView(activity).apply {
            imageTintList = ColorStateList.valueOf(activity.color(R.color.hub_text_muted))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        header.addView(chevron, LinearLayout.LayoutParams(activity.dp(22), activity.dp(22)).apply { marginStart = activity.dp(10) })

        val answerContainer = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            isVisible = false
            addView(activity.divider())
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(reservationHelpFaqAnswerBackground(faq.tone))
                setPadding(activity.dp(14), activity.dp(12), activity.dp(14), activity.dp(14))
                addView(TextView(context).apply {
                    text = activity.getString(faq.answerRes)
                    textSize = 13f
                    setTextColor(activity.color(R.color.hub_text))
                    setLineSpacing(0f, 1.14f)
                })
                faq.action?.let { action ->
                    addView(activity.detailActionButton(reservationHelpActionLabel(action), false) {
                        performReservationHelpAction(action)
                    }, LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        activity.dp(48),
                    ).apply { topMargin = activity.dp(12) })
                }
            })
        }
        content.addView(header)
        content.addView(answerContainer)
        card.addView(content)

        val state = MainActivity.ReservationHelpFaqUiState(
            card = card,
            header = header,
            answerContainer = answerContainer,
            chevron = chevron,
            question = question,
        )
        activity.reservationHelpFaqUiStates[faq.id] = state
        header.setOnClickListener { toggleReservationHelpFaq(faq.id) }
        updateReservationHelpFaqCard(state, faq.id == activity.expandedReservationHelpFaqId)
        return card
    }

    private fun toggleReservationHelpFaq(faqId: ReservationHelpFaqId) {
        val previousFaqId = activity.expandedReservationHelpFaqId
        val nextFaqId = ReservationHelpFaqExpansionPolicy.toggled(previousFaqId, faqId)
        if (nextFaqId == previousFaqId) return
        TransitionManager.beginDelayedTransition(activity.binding.contentList, AutoTransition().apply { duration = 160 })
        activity.expandedReservationHelpFaqId = nextFaqId
        listOfNotNull(previousFaqId, nextFaqId).distinct().forEach { changedFaqId ->
            activity.reservationHelpFaqUiStates[changedFaqId]?.let { state ->
                updateReservationHelpFaqCard(state, changedFaqId == nextFaqId)
            }
        }
    }

    private fun updateReservationHelpFaqCard(state: MainActivity.ReservationHelpFaqUiState, expanded: Boolean) {
        state.answerContainer.isVisible = expanded
        state.chevron.setImageResource(if (expanded) R.drawable.ic_expand_less else R.drawable.ic_expand_more)
        state.header.contentDescription = state.question
        ViewCompat.setStateDescription(
            state.header,
            activity.getString(if (expanded) R.string.reservation_help_faq_state_expanded else R.string.reservation_help_faq_state_collapsed),
        )
        state.card.strokeColor = activity.color(R.color.hub_line)
        state.card.setCardBackgroundColor(activity.color(R.color.hub_card_surface))
    }

    private fun reservationHelpFaqToneIcon(tone: ReservationHelpTone): Int = when (tone) {
        ReservationHelpTone.NORMAL,
        ReservationHelpTone.INFO -> R.drawable.ic_help_outline
        ReservationHelpTone.WARNING -> R.drawable.ic_help_warning_outline
        ReservationHelpTone.SECURITY -> R.drawable.ic_help_lock_outline
        ReservationHelpTone.DANGER -> R.drawable.ic_help_warning_outline
    }

    private fun reservationHelpFaqToneColor(tone: ReservationHelpTone): Int = when (tone) {
        ReservationHelpTone.NORMAL -> activity.color(R.color.hub_text_muted)
        ReservationHelpTone.INFO,
        ReservationHelpTone.SECURITY -> activity.color(R.color.hub_primary)
        ReservationHelpTone.WARNING -> activity.color(R.color.hub_warning)
        ReservationHelpTone.DANGER -> activity.color(R.color.hub_schedule_tag_cancelled)
    }

    private fun reservationHelpFaqAnswerBackground(tone: ReservationHelpTone): Int = when (tone) {
        ReservationHelpTone.NORMAL,
        ReservationHelpTone.INFO,
        ReservationHelpTone.SECURITY -> activity.color(R.color.hub_accent_soft)
        ReservationHelpTone.WARNING -> activity.color(R.color.hub_warning_soft)
        ReservationHelpTone.DANGER -> activity.color(R.color.hub_schedule_tag_cancelled_soft)
    }

    private fun reservationDraftExpiryText(expiry: ReservationDraftExpiryPresentation): String = when (expiry.kind) {
        ReservationDraftExpiryKind.HOURS -> activity.getString(R.string.reservation_draft_expiry_hours, expiry.value)
        ReservationDraftExpiryKind.MINUTES -> activity.getString(R.string.reservation_draft_expiry_minutes, expiry.value)
        ReservationDraftExpiryKind.SOON -> activity.getString(R.string.reservation_draft_expiry_soon)
    }

    private fun reservationHelpActionLabel(action: ReservationHelpAction): String = activity.getString(
        when (action) {
            ReservationHelpAction.VIEW_PENDING -> R.string.reservation_help_action_view_pending
            ReservationHelpAction.ADD_WITHOUT_LINK -> R.string.reservation_help_action_add_without_link
            ReservationHelpAction.VIEW_UPCOMING -> R.string.reservation_help_action_view_upcoming
            ReservationHelpAction.EDIT_CURRENT_RECORD -> R.string.reservation_help_action_edit_record
            ReservationHelpAction.VIEW_EXISTING_RECORD -> R.string.reservation_help_action_view_existing
        },
    )

    private fun performReservationHelpAction(action: ReservationHelpAction) {
        when (action) {
            ReservationHelpAction.VIEW_PENDING,
            ReservationHelpAction.VIEW_UPCOMING -> {
                activity.pendingReservationHelpScrollAction = action
                if (!activity.popScreen()) {
                    activity.navigationHistory.selectRoot(HubScreen.GOODS_EVENTS)
                    activity.navigationHistory.select(HubScreen.RESERVATIONS)
                    activity.renderScreen(HubScreen.RESERVATIONS)
                }
            }
            ReservationHelpAction.ADD_WITHOUT_LINK -> {
                val draft = ReservationDraftPolicy.active(activity.reservationDrafts)
                    .minByOrNull(ReservationDraft::expiresAt) ?: return
                activity.startActivity(Intent(activity, ReservationQuickAddActivity::class.java).putExtra(
                    ReservationQuickAddActivity.EXTRA_SESSION_ID,
                    draft.sessionId.toString(),
                ))
            }
            ReservationHelpAction.EDIT_CURRENT_RECORD -> activity.selectedReservationId?.let { id ->
                activity.handleAppDeepLink(Intent().putExtra("appDeepLink", "stellivehub://reservations/$id/edit"))
            }
            ReservationHelpAction.VIEW_EXISTING_RECORD -> Unit
        }
    }

    private fun scrollReservationContentToTag(targetTag: String) {
        activity.binding.contentList.post {
            val target = activity.binding.contentList.findViewWithTag<View>(targetTag) ?: return@post
            activity.binding.contentScroll.smoothScrollTo(0, target.top)
            target.sendAccessibilityEvent(android.view.accessibility.AccessibilityEvent.TYPE_VIEW_FOCUSED)
        }
    }

    private fun reservationDetailSummaryCard(presentation: ReservationDetailPresentation, status: ReservationStatus): MaterialCardView =
        activity.baseCard(HubCardStyle.STANDARD).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(6) }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(activity.dp(16), activity.dp(15), activity.dp(16), activity.dp(16))
                presentation.imageUrl?.let { addView(activity.hubEventThumbnail(it)) }
                addView(TextView(context).apply {
                    text = presentation.title
                    textSize = 20f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(activity.color(R.color.hub_text))
                    setLineSpacing(0f, 1.08f)
                })
                addView(ChipGroup(context).apply {
                    setPadding(0, activity.dp(8), 0, 0)
                    isSingleLine = false
                    addView(reservationDetailStatusChip(status, presentation.statusLabel))
                    addView(activity.rowChip(presentation.kindLabel))
                })
                presentation.dateTimeLabel?.let { dateTime ->
                    addView(TextView(context).apply {
                        text = dateTime
                        textSize = 13f
                        typeface = Typeface.DEFAULT_BOLD
                        setTextColor(activity.color(R.color.hub_text))
                        setPadding(0, activity.dp(10), 0, 0)
                    })
                }
                addView(TextView(context).apply {
                    text = "출처 · ${presentation.sourceLabel}"
                    textSize = 12f
                    setTextColor(activity.color(R.color.hub_text_muted))
                    setPadding(0, activity.dp(5), 0, 0)
                })
            })
        }

    private fun reservationDetailActionRow(primaryUrl: String?): LinearLayout =
        LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(6) }
            if (primaryUrl != null) {
                addView(activity.detailActionButton("상세 내역 열기", true) { activity.openExternalUrl(primaryUrl) }, LinearLayout.LayoutParams(0, activity.dp(50), 1f).apply {
                    marginEnd = activity.dp(5)
                })
                addView(activity.detailActionButton("내역 수정", false) { activity.pushScreen(HubScreen.RESERVATION_EDIT) }, LinearLayout.LayoutParams(0, activity.dp(50), 1f).apply {
                    marginStart = activity.dp(5)
                })
            } else {
                addView(activity.detailActionButton("내역 수정", true) { activity.pushScreen(HubScreen.RESERVATION_EDIT) }, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    activity.dp(50),
                ))
            }
        }

    private fun reservationDetailRowsCard(rows: List<ReservationDetailRow>): MaterialCardView =
        activity.baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(8) }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(activity.dp(15), activity.dp(4), activity.dp(15), activity.dp(4))
                rows.forEachIndexed { index, row ->
                    if (index > 0) addView(activity.divider())
                    addView(LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.TOP
                        setPadding(0, activity.dp(11), 0, activity.dp(11))
                        addView(TextView(context).apply {
                            text = row.label
                            textSize = 12f
                            typeface = Typeface.DEFAULT_BOLD
                            setTextColor(activity.color(R.color.hub_text_muted))
                        }, LinearLayout.LayoutParams(activity.dp(88), LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                            marginEnd = activity.dp(10)
                        })
                        addView(TextView(context).apply {
                            text = row.value
                            textSize = 14f
                            setTextColor(activity.color(R.color.hub_text))
                            setLineSpacing(0f, 1.1f)
                        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    })
                }
            })
        }

    private fun reservationDetailLinkCard(link: ReservationDetailLink): MaterialCardView =
        activity.baseCard(HubCardStyle.INTERACTIVE).apply {
            isClickable = true
            isFocusable = true
            contentDescription = "${link.label}, ${link.host}, 외부 링크 열기"
            setOnClickListener { activity.openExternalUrl(link.url) }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(8) }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(activity.dp(15), activity.dp(12), activity.dp(13), activity.dp(12))
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(context).apply {
                        text = link.label
                        textSize = 14f
                        typeface = Typeface.DEFAULT_BOLD
                        setTextColor(activity.color(R.color.hub_text))
                    })
                    addView(TextView(context).apply {
                        text = link.host
                        textSize = 12f
                        setTextColor(activity.color(R.color.hub_text_muted))
                        setPadding(0, activity.dp(3), 0, 0)
                    })
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                addView(TextView(context).apply {
                    text = "↗"
                    textSize = 18f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(activity.color(R.color.hub_primary))
                    contentDescription = null
                })
            })
        }

    private fun reservationDetailTextCard(body: String): MaterialCardView =
        activity.baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(8) }
            addView(TextView(context).apply {
                text = body
                textSize = 14f
                setTextColor(activity.color(R.color.hub_text))
                setLineSpacing(0f, 1.15f)
                setPadding(activity.dp(15), activity.dp(13), activity.dp(15), activity.dp(13))
            })
        }

    private fun openLinkedOfficialEvent(eventId: String) {
        activity.selectedHubEventId = eventId
        activity.selectedHubEventScheduleItemId = null
        activity.serverHubEventDetailLoadedId = null
        activity.pushScreen(HubScreen.GOODS_EVENT_DETAIL)
    }

    private fun reservationDetailDeleteButton(record: ReservationRecord): TextView =
        activity.detailActionButton("내역 삭제", false) {
            AlertDialog.Builder(activity).setTitle("내역 삭제").setMessage("이 기기에서 이 내역을 삭제할까요?")
                .setNegativeButton("취소", null)
                .setPositiveButton("삭제") { _, _ ->
                    activity.lifecycleScope.launch {
                        activity.reservationRepository.delete(record)
                        activity.popScreen()
                        Snackbar.make(activity.binding.root, "내역을 삭제했습니다.", Snackbar.LENGTH_LONG)
                            .setAction("실행 취소") {
                                activity.lifecycleScope.launch { activity.reservationRepository.update(record) }
                            }
                            .show()
                    }
                }
                .show()
        }.apply {
            setTextColor(activity.color(R.color.hub_schedule_tag_cancelled))
            background = activity.rounded(
                fill = activity.color(R.color.hub_schedule_tag_cancelled_soft),
                radius = activity.dp(14),
                stroke = activity.color(R.color.hub_schedule_tag_cancelled),
            )
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                activity.dp(50),
            ).apply { bottomMargin = activity.dp(14) }
        }

    private fun reservationDateTimeInput(label: String, value: Instant?): ReservationDateTimeInput {
        val field = EditText(activity).apply {
            hint = "선택하지 않음"
            isFocusable = false
            isClickable = true
            contentDescription = "$label 선택"
            setText(value?.let(activity.reservationDateFormatter::format).orEmpty())
            textSize = 14f
            setTextColor(activity.color(R.color.hub_text))
            setHintTextColor(activity.color(R.color.hub_text_subtle))
            gravity = Gravity.CENTER_VERTICAL
            background = null
            setPadding(activity.dp(14), 0, activity.dp(8), 0)
        }
        val row = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = activity.rounded(activity.color(R.color.hub_surface), activity.dp(12), activity.color(R.color.hub_text_subtle))
        }
        val container = labeledReservationEditInput(label, row)
        val input = ReservationDateTimeInput(field, value, container)
        field.setOnClickListener { showReservationDateTimePicker(input) }
        row.addView(field, LinearLayout.LayoutParams(0, activity.dp(52), 1f))
        row.addView(TextView(activity).apply {
            text = "지우기"
            contentDescription = "$label 지우기"
            gravity = Gravity.CENTER
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(activity.color(R.color.hub_text_muted))
            background = activity.rounded(activity.color(R.color.hub_card), activity.dp(10))
            setOnClickListener {
                input.value = null
                field.setText("")
            }
        }, LinearLayout.LayoutParams(activity.dp(58), activity.dp(40)).apply { marginEnd = activity.dp(6) })
        return input
    }

    private fun showReservationDateTimePicker(input: ReservationDateTimeInput) {
        val zone = ZoneId.of("Asia/Seoul")
        val initial = input.value?.atZone(zone) ?: ZonedDateTime.now(zone)
        DatePickerDialog(activity, { _, year, month, day ->
            val selectedDate = LocalDate.of(year, month + 1, day)
            TimePickerDialog(activity, { _, hour, minute ->
                input.value = ZonedDateTime.of(selectedDate, LocalTime.of(hour, minute), zone).toInstant()
                input.field.setText(input.value?.let(activity.reservationDateFormatter::format))
            }, initial.hour, initial.minute, true).show()
        }, initial.year, initial.monthValue - 1, initial.dayOfMonth).show()
    }

    private fun reservationEditField(
        label: String,
        value: String,
        multiline: Boolean = false,
        placeholder: String = "입력하지 않음",
    ): ReservationEditTextInput {
        val field = EditText(activity).apply {
            hint = placeholder
            setText(value)
            textSize = 14f
            setTextColor(activity.color(R.color.hub_text))
            setHintTextColor(activity.color(R.color.hub_text_subtle))
            background = activity.rounded(activity.color(R.color.hub_surface), activity.dp(12), activity.color(R.color.hub_text_subtle))
            setPadding(activity.dp(14), activity.dp(12), activity.dp(14), activity.dp(12))
            minHeight = activity.dp(if (multiline) 96 else 52)
            gravity = if (multiline) Gravity.TOP or Gravity.START else Gravity.CENTER_VERTICAL
            setSingleLine(!multiline)
            if (multiline) minLines = 3
        }
        return ReservationEditTextInput(field, labeledReservationEditInput(label, field))
    }

    private fun reservationEditStatusInput(
        kind: ReservationKind,
        initialStatus: ReservationStatus,
        onSelected: (ReservationStatus) -> Unit,
    ): ReservationEditStatusInput {
        var displayedStatus = initialStatus
        val value = TextView(activity).apply {
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            includeFontPadding = false
            maxLines = 2
            setLineSpacing(0f, 1.08f)
        }
        val description = TextView(activity).apply {
            textSize = 12f
            includeFontPadding = false
            setTextColor(activity.color(R.color.hub_text_muted))
            setLineSpacing(0f, 1.12f)
        }
        val row = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = activity.dp(56)
            isClickable = true
            isFocusable = true
            background = RippleDrawable(
                ColorStateList.valueOf(activity.color(R.color.hub_line)),
                activity.rounded(activity.color(R.color.hub_surface), activity.dp(12), activity.color(R.color.hub_line)),
                null,
            )
            setPadding(activity.dp(14), activity.dp(12), activity.dp(12), activity.dp(12))
            addView(value, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(ImageView(context).apply {
                setImageResource(R.drawable.ic_expand_more)
                imageTintList = ColorStateList.valueOf(activity.color(R.color.hub_text_subtle))
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, LinearLayout.LayoutParams(activity.dp(24), activity.dp(24)).apply { marginStart = activity.dp(8) })
        }
        val container = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(context).apply {
                setText(R.string.reservation_edit_status_label)
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(activity.color(R.color.hub_text_muted))
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(6) })
            addView(row, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ))
            addView(description, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = activity.dp(6) })
        }
        fun update(selected: ReservationStatus) {
            displayedStatus = selected
            val label = ReservationPresentationPolicy.statusLabel(kind, selected)
            value.text = label
            value.setTextColor(activity.color(reservationEditStatusColor(selected)))
            description.setText(reservationEditStatusDescriptionRes(kind, selected))
            row.contentDescription = activity.getString(
                R.string.reservation_edit_status_accessibility,
                activity.getString(R.string.reservation_edit_status_label),
                label,
            )
            ViewCompat.setStateDescription(row, label)
        }
        row.setOnClickListener {
            HubSingleChoiceBottomSheet(
                context = activity,
                title = activity.getString(R.string.reservation_edit_status_selection_title),
                options = ReservationEditStatusPresentationPolicy.displayOrder.map { candidate ->
                    HubSingleChoiceOption(candidate.name, ReservationPresentationPolicy.statusLabel(kind, candidate))
                },
                selectedId = displayedStatus.name,
            ) { id ->
                val selected = ReservationStatus.valueOf(id)
                onSelected(selected)
                update(selected)
                row.requestFocus()
                row.announceForAccessibility(
                    activity.getString(R.string.reservation_edit_status_accessibility, activity.getString(R.string.reservation_edit_status_label), ReservationPresentationPolicy.statusLabel(kind, selected)),
                )
            }.show()
        }
        update(initialStatus)
        return ReservationEditStatusInput(container, ::update)
    }

    private fun reservationEditStatusColor(status: ReservationStatus): Int = when (status) {
        ReservationStatus.PENDING_CONFIRMATION, ReservationStatus.REFUNDED -> R.color.hub_warning
        ReservationStatus.CONFIRMED -> R.color.hub_success
        ReservationStatus.COMPLETED -> R.color.hub_text_muted
        ReservationStatus.CANCELLED -> R.color.hub_schedule_tag_cancelled
    }

    private fun reservationDetailStatusFillColor(status: ReservationStatus): Int = when (status) {
        ReservationStatus.PENDING_CONFIRMATION, ReservationStatus.REFUNDED -> R.color.hub_warning_soft
        ReservationStatus.CONFIRMED -> R.color.hub_success_soft
        ReservationStatus.COMPLETED -> R.color.hub_schedule_tag_completed_soft
        ReservationStatus.CANCELLED -> R.color.hub_schedule_tag_cancelled_soft
    }

    private fun reservationDetailStatusChip(status: ReservationStatus, label: String): Chip =
        Chip(activity).apply {
            text = label
            activity.centerChipText(this)
            isCheckable = false
            isClickable = false
            setEnsureMinTouchTargetSize(false)
            setTextColor(activity.color(reservationEditStatusColor(status)))
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            chipStrokeWidth = activity.dp(1).toFloat()
            chipStrokeColor = ContextCompat.getColorStateList(context, reservationEditStatusColor(status))
            chipBackgroundColor = ContextCompat.getColorStateList(context, reservationDetailStatusFillColor(status))
        }

    private fun reservationEditStatusDescriptionRes(kind: ReservationKind, status: ReservationStatus): Int = when (status) {
        ReservationStatus.PENDING_CONFIRMATION -> R.string.reservation_edit_status_pending_description
        ReservationStatus.CONFIRMED -> when (kind) {
            ReservationKind.TICKET -> R.string.reservation_edit_status_ticket_confirmed_description
            ReservationKind.PURCHASE -> R.string.reservation_edit_status_purchase_confirmed_description
            ReservationKind.RESERVATION -> R.string.reservation_edit_status_reservation_confirmed_description
        }
        ReservationStatus.COMPLETED -> when (kind) {
            ReservationKind.PURCHASE -> R.string.reservation_edit_status_purchase_completed_description
            ReservationKind.TICKET, ReservationKind.RESERVATION -> R.string.reservation_edit_status_ticket_completed_description
        }
        ReservationStatus.CANCELLED -> R.string.reservation_edit_status_cancelled_description
        ReservationStatus.REFUNDED -> R.string.reservation_edit_status_refunded_description
    }

    private fun labeledReservationEditInput(label: String, input: View): LinearLayout =
        LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(context).apply {
                text = label
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(activity.color(R.color.hub_text_muted))
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = activity.dp(6) })
            addView(input, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ))
        }

    private fun reservationEditPanel(
        title: String,
        description: String,
        children: List<View>,
    ): MaterialCardView = activity.baseCard(HubCardStyle.STANDARD).apply {
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { bottomMargin = activity.dp(12) }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(activity.dp(15), activity.dp(14), activity.dp(15), activity.dp(15))
            addView(TextView(context).apply {
                text = title
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(activity.color(R.color.hub_text))
            })
            addView(TextView(context).apply {
                text = description
                textSize = 12f
                setTextColor(activity.color(R.color.hub_text_muted))
                setLineSpacing(0f, 1.12f)
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = activity.dp(4) })
            children.forEach { child ->
                addView(child, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply { topMargin = activity.dp(12) })
            }
        })
    }

    private fun Int.withAlpha(alpha: Int): Int =
        Color.argb(alpha, Color.red(this), Color.green(this), Color.blue(this))
}
