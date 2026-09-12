package dev.minepacu.stelliveeventnotifier.feature.goodsevents

import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.provider.CalendarContract
import android.transition.AutoTransition
import android.transition.TransitionManager
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.isVisible
import androidx.core.widget.NestedScrollView
import androidx.lifecycle.lifecycleScope
import coil.load
import com.google.android.material.card.MaterialCardView
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.SettingRow
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarDay
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntry
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntryKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.feature.calendar.CalendarUiPolicy
import dev.minepacu.stelliveeventnotifier.feature.calendar.HubEventsCalendarView
import dev.minepacu.stelliveeventnotifier.feature.home.HubScreen
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import dev.minepacu.stelliveeventnotifier.feature.hubevents.GoodsEventSelectionMode
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailCalendarCard
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailCalendarExpansionPolicy
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailCalendarMode
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailCalendarPolicy
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailFormatting
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventHeroTagTone
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventImagePolicy
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventLinkCtaMode
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventLinksBottomSheet
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventScheduleTimelineItem
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventsPanePolicy
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardStyle
import dev.minepacu.stelliveeventnotifier.ui.components.SectionHeaderView
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth

/**
 * Owns all GoodsEvents-screen (list + calendar filtering + two-pane + detail pane) VIEW-BUILDING
 * and state-transition logic that previously lived directly on [MainActivity], following the
 * same extraction shape as [dev.minepacu.stelliveeventnotifier.feature.settings.SettingsScreenController]
 * and [dev.minepacu.stelliveeventnotifier.feature.songs.SongsScreenController].
 *
 * Dependency-injection choice: like Settings and Songs, this one takes the concrete [MainActivity]
 * rather than a narrow interface - GoodsEvents view-building is entangled with generic Activity-wide
 * UI-atom helpers (color/dp/rounded/baseCard/...), the screen-navigation stack, and two-pane/scroll
 * chrome that isn't GoodsEvents-specific.
 *
 * State ownership: all GoodsEvents session/UI state (loaded days/events, selected filter/month,
 * calendar expansion, selected event/schedule-item ids, detail-calendar selection state, the
 * background jobs) stays on [MainActivity] as `internal` fields, exactly like Settings/Songs kept
 * their state behind - `onSaveInstanceState`/`onCreate` restore a few of these fields directly and
 * had to keep reading/writing them from MainActivity itself.
 *
 * Types `ScheduleBadgeTone`/`ScheduleBadgePresentation` moved here (as private nested types) since
 * nothing outside this GoodsEvents-detail cluster referenced them - unlike Songs' `SongRenderState`/
 * `SongPanes`, no Activity-owned field needed them to stay on MainActivity.
 *
 * Reservations boundary: `reservationSummaryCard()` is defined immediately next to the GoodsEvents
 * cluster in the original file and is shown at the top of the GoodsEvents list/screen, but it reads
 * Reservations-owned state (`reservationDrafts`, `reservationRecords`, `reservationDateFormatter`)
 * and navigates into the Reservations screen - it stays on MainActivity (bumped to `internal`) and
 * is called back into here, rather than being duplicated or moved, since it belongs to the
 * not-yet-extracted Reservations feature. Likewise `hubEventCard()` stays on MainActivity because
 * Reservations' detail screen also renders it directly; it now calls back into
 * `goodsEventsScreenController.onGoodsEventSelected(...)` for its click handler. `openHubEventLink()`
 * is a Reservations function (records external-link taps as reservation drafts) that this
 * controller's schedule/detail views call into - bumped to `internal`, not duplicated, since it is
 * meaningfully stateful Reservations behavior.
 *
 * Shared-helper decisions: generic/stateful UI atoms also used by not-yet-extracted screens
 * (`filterPanel`, `serverStatusStrip`, `loadingCard`, `noticeCard`, `compactEventCard`, `baseCard`,
 * `sectionLabel`, `settingsPanel`, `detailActionButton`, `scrollablePane`, `twoPaneViewportHeight`,
 * `rowChip`, `color`, `dp`, `rounded`, `divider`, `startScreen`, `pushScreen`,
 * `refreshScreenWhenIdle`, `resetTopBarScrollSources`, `crossFadeTwoPaneSelection`,
 * `applyContentTopPadding`) stay on MainActivity (visibility bumped to `internal` where still
 * `private`) and are called back into here, instead of being duplicated. The tiny one-off
 * `Int.withAlpha()` color helper is a MEMBER extension function of MainActivity (not a plain
 * function), so calling it from here would need a dual receiver (`with(activity) { ... }`); since
 * it is a single-line generic atom, it is duplicated privately in this file instead, per the
 * small/generic-atom rule - MainActivity keeps its own copy untouched for any other internal use.
 */
internal class GoodsEventsScreenController(private val activity: MainActivity) {

    private enum class ScheduleBadgeTone {
        UPCOMING,
        IN_PROGRESS,
        COMPLETED,
        CANCELLED,
        KIND,
        PRIMARY,
        SELECTED,
    }

    private data class ScheduleBadgePresentation(
        val label: String,
        val tone: ScheduleBadgeTone,
    )

    // region Screen entry points (called from MainActivity.renderScreen / hubEventCard)

    internal fun renderGoodsEvents() {
        activity.startScreen(
            screenId = "goods_events",
            title = "굿즈/행사",
            role = "공식/멤버/공식 콜라보 출처가 있는 기간성 정보만 표시합니다."
        )
        activity.binding.contentList.addView(activity.filterPanel(MainUiPolicy.goodsEventsTopFilterGroups(activity.selectedFilter)) { _, optionId ->
            activity.selectedFilter = optionId
            if (activity.goodsEventsDays.isEmpty()) renderGoodsEvents()
            else renderServerGoodsEvents(activity.goodsEventsDays, activity.goodsEvents)
        })
        activity.binding.contentList.addView(activity.reservationSummaryCard())
        activity.binding.contentList.addView(activity.serverStatusStrip())
        loadServerGoodsEvents()
    }

    internal fun renderHubEventDetail() {
        val eventId = activity.selectedHubEventId
        if (eventId != null && activity.serverHubEventDetailLoadedId != eventId) {
            activity.startScreen(
                screenId = "goods_event_detail",
                title = "상세",
                role = "선택한 굿즈/행사를 불러오고 있습니다."
            )
            activity.binding.contentList.addView(activity.loadingCard(MainUiPolicy.hubEventDetailLoadingPresentation()))
            activity.serverHubEventDetailJob?.cancel()
            activity.serverHubEventDetailJob = activity.lifecycleScope.launch {
                activity.serverHubEventDetail = activity.serverRepository.hubEventDetail(eventId)
                activity.serverHubEventDetailLoadedId = eventId
                if (activity.navigationHistory.currentScreen == HubScreen.GOODS_EVENT_DETAIL && activity.selectedHubEventId == eventId) {
                    activity.refreshScreenWhenIdle(HubScreen.GOODS_EVENT_DETAIL, ::renderHubEventDetail)
                }
            }
            return
        }
        val event = currentSelectedHubEvent()
        if (event == null) {
            activity.startScreen(
                screenId = "goods_event_detail",
                title = "상세",
                role = "선택한 굿즈/행사를 찾을 수 없습니다."
            )
            activity.binding.contentList.addView(activity.compactEventCard("항목 없음", "목록에서 다시 선택해 주세요.", listOf("굿즈/행사")))
            return
        }

        activity.startScreen(
            screenId = "goods_event_detail",
            title = "",
            role = ""
        )
        activity.binding.collapsedTitle.text = ""
        activity.binding.collapsedRole.text = ""
        activity.binding.contentList.removeAllViews()
        activity.resetTopBarScrollSources()
        activity.applyContentTopPadding(underTopBar = true)
        renderHubEventDetailInto(activity.binding.contentList, event, fullScreen = true)
    }

    internal fun onGoodsEventSelected(eventId: String) {
        val selection = CalendarUiPolicy.feedSelection(eventId)
        when (HubEventsPanePolicy.selectionMode(activity.currentAdaptiveSpec)) {
            GoodsEventSelectionMode.UPDATE_INLINE_DETAIL -> activity.crossFadeTwoPaneSelection(selection.transitionKey) {
                activity.selectedHubEventId = selection.eventId
                activity.selectedHubEventScheduleItemId = null
                activity.serverHubEventDetailLoadedId = null
                renderServerGoodsEvents(activity.goodsEventsDays, activity.goodsEvents)
            }
            GoodsEventSelectionMode.NAVIGATE_TO_DETAIL -> {
                activity.selectedHubEventId = selection.eventId
                activity.selectedHubEventScheduleItemId = null
                activity.serverHubEventDetailLoadedId = null
                activity.pushScreen(HubScreen.GOODS_EVENT_DETAIL)
            }
        }
    }

    // endregion

    private fun loadServerGoodsEvents() {
        activity.binding.contentList.addView(activity.loadingCard(MainUiPolicy.goodsEventsLoadingPresentation()))
        activity.goodsEventsJob?.cancel()
        activity.goodsEventsJob = activity.lifecycleScope.launch {
            val today = LocalDate.now()
            val from = today.minusMonths(1)
            val to = today.plusMonths(3)
            val days = activity.serverRepository.hubCalendarDays(from, to, "Asia/Seoul")
            val listedEvents = activity.serverRepository.hubEvents("all", from, to)
            val listedEventIds = listedEvents.mapTo(mutableSetOf()) { it.id }
            val missingEventIds = days
                .flatMap { it.entries }
                .asSequence()
                .filter { it.entryKind == HubCalendarEntryKind.HUB_EVENT }
                .map { it.eventId }
                .filterNot(listedEventIds::contains)
                .distinct()
                .toList()
            val resolvedMissingEvents = missingEventIds.mapNotNull { activity.serverRepository.hubEventDetail(it) }
            val events = (listedEvents + resolvedMissingEvents).distinctBy { it.id }
            activity.goodsEventsSelectedMonth = YearMonth.from(today)
            activity.goodsEventsDays = days
            activity.goodsEvents = events
            if (activity.navigationHistory.currentScreen == HubScreen.GOODS_EVENTS) {
                activity.refreshScreenWhenIdle(HubScreen.GOODS_EVENTS) {
                    renderServerGoodsEvents(days, events)
                }
            }
        }
    }

    private fun renderServerGoodsEvents(days: List<HubCalendarDay>, events: List<HubEvent>) {
        activity.goodsEventsDays = days
        activity.goodsEvents = events
        val filteredDays = filteredGoodsEventDays(days)
        val filteredEvents = filteredGoodsEvents(events)
        val monthDays = monthDaysForGoodsEvents(filteredDays)
        activity.binding.contentList.removeAllViews()
        activity.resetTopBarScrollSources()
        if (shouldUseGoodsEventsTwoPane()) {
            renderServerGoodsEventsTwoPane(filteredDays, filteredEvents, monthDays)
            return
        }
        renderGoodsEventsListInto(activity.binding.contentList, filteredDays, filteredEvents, monthDays)
        activity.binding.contentList.addView(
            activity.noticeCard("방송/라이브/업로드와 팬 주최 이벤트는 굿즈/행사 피드에 포함하지 않습니다.")
        )
    }

    private fun filteredGoodsEventDays(days: List<HubCalendarDay>): List<HubCalendarDay> =
        days.mapNotNull { day ->
            val entries = day.entries.filter { entry ->
                MainUiPolicy.goodsEventMatchesFilter(
                    activity.selectedFilter,
                    entry.category,
                    entry.status,
                    entry.participationMode,
                    entry.tags,
                )
            }
            day.copy(entries = entries).takeIf { entries.isNotEmpty() }
        }

    private fun filteredGoodsEvents(events: List<HubEvent>): List<HubEvent> =
        events.filter { event ->
            MainUiPolicy.goodsEventMatchesFilter(
                activity.selectedFilter,
                event.category,
                event.status,
                event.participationMode,
                event.tags,
            )
        }

    private fun monthDaysForGoodsEvents(days: List<HubCalendarDay>): List<HubCalendarDay> =
        days.filter { it.date.take(7) == activity.goodsEventsSelectedMonth.toString() }

    private fun renderServerGoodsEventsTwoPane(
        filteredDays: List<HubCalendarDay>,
        filteredEvents: List<HubEvent>,
        monthDays: List<HubCalendarDay>,
    ) {
        val paneRow = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            isBaselineAligned = false
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                activity.twoPaneViewportHeight(),
            )
        }
        val listPane = activity.scrollablePane()
        val detailPane = activity.scrollablePane().apply {
            scrollView.background = activity.rounded(activity.color(R.color.hub_surface), activity.dp(16), activity.color(R.color.hub_line))
            content.setPadding(activity.dp(10), activity.dp(10), activity.dp(10), activity.dp(10))
        }
        val paneWeights = if (shouldUseGoodsEventsFoldAwarePane()) {
            1f to 1f
        } else {
            1f to 1f
        }
        paneRow.addView(
            listPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, paneWeights.first).apply {
                marginEnd = activity.dp(8)
            },
        )
        paneRow.addView(
            detailPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, paneWeights.second).apply {
                marginStart = activity.dp(8)
            },
        )
        activity.activeTwoPaneDetailPane = detailPane.scrollView
        activity.binding.contentList.addView(paneRow)
        renderGoodsEventsListInto(listPane.content, filteredDays, filteredEvents, monthDays)
        listPane.content.addView(
            activity.noticeCard("방송/라이브/업로드와 팬 주최 이벤트는 굿즈/행사 피드에 포함하지 않습니다.")
        )
        renderGoodsEventDetailPane(detailPane.content)
    }

    private fun renderGoodsEventsListInto(
        container: LinearLayout,
        filteredDays: List<HubCalendarDay>,
        filteredEvents: List<HubEvent>,
        monthDays: List<HubCalendarDay>,
    ) {
        container.addView(activity.filterPanel(MainUiPolicy.goodsEventsTopFilterGroups(activity.selectedFilter)) { _, optionId ->
            activity.selectedFilter = optionId
            renderServerGoodsEvents(activity.goodsEventsDays, activity.goodsEvents)
        })
        container.addView(activity.reservationSummaryCard())
        container.addView(activity.serverStatusStrip())
        container.addView(
            HubEventsCalendarView(
                context = activity,
                days = filteredDays,
                initialMonth = activity.goodsEventsSelectedMonth,
                showModeControls = false,
                showCollapseControl = true,
                initiallyExpanded = activity.goodsEventsCalendarExpanded,
                onExpandedChanged = { expanded -> activity.goodsEventsCalendarExpanded = expanded },
                onMonthChanged = { month ->
                    activity.goodsEventsSelectedMonth = month
                    if (activity.navigationHistory.currentScreen == HubScreen.GOODS_EVENTS) {
                        renderServerGoodsEvents(activity.goodsEventsDays, activity.goodsEvents)
                    }
                },
            ) { entry -> onGoodsEventSelected(entry.eventId) }
        )
        val feedRows = CalendarUiPolicy.feedRenderRowsForMonth(
            days = monthDays,
            month = activity.goodsEventsSelectedMonth,
            events = filteredEvents,
        )
        var previousHeader: String? = null
        feedRows.forEach { row ->
            val header = CalendarUiPolicy.feedRowHeaderText(row)
            if (header != previousHeader) {
                container.addView(calendarDayHeader(header))
                previousHeader = header
            }
            row.canonicalEvent?.let { event ->
                container.addView(activity.hubEventCard(event = event))
            } ?: container.addView(localCalendarEntryRow(row.entry))
        }
    }

    internal fun shouldUseGoodsEventsTwoPane(): Boolean =
        HubEventsPanePolicy.shouldUseTwoPane(activity.currentAdaptiveSpec)

    private fun shouldUseGoodsEventsFoldAwarePane(): Boolean =
        HubEventsPanePolicy.shouldUseFoldAwarePane(activity.currentAdaptiveSpec)

    private fun renderGoodsEventDetailPane(container: LinearLayout) {
        val eventId = activity.selectedHubEventId
        if (eventId == null) {
            renderGoodsEventEmptyDetailPane(container)
            return
        }
        if (activity.serverHubEventDetailLoadedId != eventId) {
            container.addView(activity.loadingCard(MainUiPolicy.hubEventDetailLoadingPresentation()))
            activity.hubEventDetailJob?.cancel()
            activity.hubEventDetailJob = activity.lifecycleScope.launch {
                activity.serverHubEventDetail = activity.serverRepository.hubEventDetail(eventId)
                activity.serverHubEventDetailLoadedId = eventId
                if (activity.navigationHistory.currentScreen == HubScreen.GOODS_EVENTS && activity.selectedHubEventId == eventId) {
                    activity.refreshScreenWhenIdle(HubScreen.GOODS_EVENTS) {
                        renderServerGoodsEvents(activity.goodsEventsDays, activity.goodsEvents)
                    }
                }
            }
            return
        }
        val event = currentSelectedHubEvent()
        if (event == null) {
            container.addView(activity.compactEventCard("항목 없음", "목록에서 다시 선택해 주세요.", listOf("굿즈/행사")))
            return
        }
        renderHubEventDetailInto(container, event, fullScreen = false)
    }

    private fun renderGoodsEventEmptyDetailPane(container: LinearLayout) {
        container.addView(
            activity.compactEventCard(
                title = "굿즈/행사를 선택해 상세 정보를 확인하세요.",
                body = "왼쪽 목록이나 캘린더에서 항목을 선택하면 이 영역에 상세 정보가 표시됩니다.",
                pills = listOf("상세")
            )
        )
    }

    private fun localCalendarEntryRow(entry: HubCalendarEntry): MaterialCardView =
        activity.compactEventCard(
            title = CalendarUiPolicy.displayTitle(entry),
            body = listOf(CalendarUiPolicy.entryPeriodDateText(entry), entry.displayTimeText)
                .filter { it.isNotBlank() }
                .joinToString(" · "),
            pills = MainUiPolicy.goodsEventPillLabels(
                entry.category,
                entry.participationMode,
                entry.tags,
            ),
    )

    private fun calendarDayHeaderText(day: HubCalendarDay): String {
        val periodEntry = day.entries.firstOrNull { entry ->
            CalendarUiPolicy.entryPeriodDateText(entry) != entry.displayDate
        } ?: return day.date
        return CalendarUiPolicy.entryPeriodDateText(periodEntry)
    }

    private fun calendarDayHeader(date: String): SectionHeaderView =
        SectionHeaderView(activity).bind(date).apply {
            setPadding(activity.dp(2), activity.dp(18), activity.dp(2), activity.dp(8))
        }

    private fun currentSelectedHubEvent(): HubEvent? =
        activity.serverHubEventDetail?.takeIf { it.id == activity.selectedHubEventId }
            ?: activity.goodsEvents.firstOrNull { it.id == activity.selectedHubEventId }
            ?: activity.repository.hubEvents.firstOrNull { it.id == activity.selectedHubEventId }

    private fun renderHubEventDetailInto(container: LinearLayout, event: HubEvent, fullScreen: Boolean) {
        if (activity.detailCalendarSelectionEventId != event.id || activity.selectedHubEventScheduleItemId != null) {
            activity.detailCalendarSelectionEventId = event.id
            activity.detailCalendarSelectedDate = null
            activity.detailCalendarSelectedScheduleItemIds.clear()
        }
        val resolvedExpandedIds = HubEventLinkPolicy.resolvedExpandedScheduleItemIds(
            previousEventId = activity.expandedHubEventScheduleEventId,
            eventId = event.id,
            currentIds = activity.expandedHubEventScheduleItemIds,
            highlightedScheduleItemId = activity.selectedHubEventScheduleItemId,
        )
        activity.expandedHubEventScheduleItemIds.clear()
        activity.expandedHubEventScheduleItemIds.addAll(resolvedExpandedIds)
        activity.expandedHubEventScheduleEventId = event.id
        container.addView(hubEventDetailHero(event).apply {
            if (!fullScreen) {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    activity.dp(220),
                ).apply {
                    bottomMargin = activity.dp(8)
                }
            }
        })
        container.addView(hubEventDetailActions(event))
        container.addView(activity.sectionLabel(HubEventDetailFormatting.SummaryLabel).let { if (fullScreen) it.withDetailHorizontalMargins() else it })
        container.addView(
            activity.compactEventCard(
                title = "",
                body = event.summary ?: "공식 출처 기반 굿즈/행사 정보입니다.",
                pills = emptyList()
            ).let { if (fullScreen) it.withDetailHorizontalMargins() else it }
        )
        val timeline = HubEventDetailFormatting.timeline(event)
        val scheduleCardsById = mutableMapOf<String, MaterialCardView>()
        val initialCalendarPresentation = HubEventDetailCalendarPolicy.build(
            event = event,
            highlightedScheduleItemId = activity.selectedHubEventScheduleItemId,
        )
        val calendarPresentation = activity.detailCalendarSelectedDate
            ?.takeIf { activity.selectedHubEventScheduleItemId == null && initialCalendarPresentation.day(it) != null }
            ?.let { selectedDate ->
                initialCalendarPresentation.copy(
                    selectedDate = selectedDate,
                    displayedMonth = YearMonth.from(selectedDate),
                )
            }
            ?: initialCalendarPresentation
        if (activity.selectedHubEventScheduleItemId == null && activity.detailCalendarSelectedDate == null) {
            activity.detailCalendarSelectedDate = calendarPresentation.initialSelectedDate
            activity.detailCalendarSelectedScheduleItemIds.clear()
            calendarPresentation.initialSelectedDate
                ?.let(calendarPresentation::scheduleIdsFor)
                ?.let(activity.detailCalendarSelectedScheduleItemIds::addAll)
        }
        if (calendarPresentation.mode != HubEventDetailCalendarMode.HIDDEN) {
            activity.detailCalendarExpanded = HubEventDetailCalendarExpansionPolicy.resolve(
                previousEventId = activity.detailCalendarExpansionEventId,
                eventId = event.id,
                currentExpanded = activity.detailCalendarExpanded,
                highlightedScheduleItemId = activity.selectedHubEventScheduleItemId,
            )
            activity.detailCalendarExpansionEventId = event.id
            container.addView(activity.sectionLabel("행사 일정").let { if (fullScreen) it.withDetailHorizontalMargins() else it })
            container.addView(
                HubEventDetailCalendarCard(
                    context = activity,
                    event = event,
                    presentation = calendarPresentation,
                    initiallyExpanded = activity.detailCalendarExpanded,
                    onExpandedChanged = { expanded ->
                        activity.detailCalendarExpansionEventId = event.id
                        activity.detailCalendarExpanded = expanded
                    },
                ) { selectedDate, scheduleIds ->
                    activity.detailCalendarSelectionEventId = event.id
                    activity.detailCalendarSelectedDate = selectedDate
                    activity.selectedHubEventScheduleItemId = null
                    activity.detailCalendarSelectedScheduleItemIds.clear()
                    activity.detailCalendarSelectedScheduleItemIds.addAll(scheduleIds)
                    scheduleCardsById.forEach { (scheduleId, card) ->
                        updateHubEventScheduleCardHighlight(
                            card = card,
                            highlighted = scheduleId in activity.detailCalendarSelectedScheduleItemIds,
                        )
                    }
                    val firstCard = scheduleIds.firstOrNull()?.let(scheduleCardsById::get)
                    if (scheduleIds.size == 1 && firstCard != null && !firstCard.isActivated) {
                        firstCard.performClick()
                    }
                    firstCard?.let(::scrollHubEventScheduleCardIntoView)
                }.let { if (fullScreen) it.withDetailHorizontalMargins() else it },
            )
        }
        if (timeline.isNotEmpty()) {
            container.addView(activity.sectionLabel("세부 일정").let { if (fullScreen) it.withDetailHorizontalMargins() else it })
            val effectivePrimaryId = HubEventLinkPolicy.effectivePrimaryScheduleItemId(event)
            timeline.forEach { item ->
                val highlighted =
                    item.schedule.id == activity.selectedHubEventScheduleItemId ||
                        item.schedule.id in activity.detailCalendarSelectedScheduleItemIds
                val card = hubEventScheduleCard(
                    item = item,
                    highlighted = highlighted,
                    isEffectivePrimary = item.schedule.id == effectivePrimaryId,
                    initiallyExpanded = item.schedule.id in activity.expandedHubEventScheduleItemIds,
                )
                    .let { if (fullScreen) it.withDetailHorizontalMargins() else it }
                scheduleCardsById[item.schedule.id] = card as MaterialCardView
                container.addView(card)
            }
            activity.selectedHubEventScheduleItemId
                ?.let(scheduleCardsById::get)
                ?.post { activity.selectedHubEventScheduleItemId?.let(scheduleCardsById::get)?.let(::scrollHubEventScheduleCardIntoView) }
        }
        container.addView(activity.sectionLabel("행사 정보").let { if (fullScreen) it.withDetailHorizontalMargins() else it })
        container.addView(
            activity.settingsPanel(
                rows = HubEventDetailFormatting.rows(event).map { row ->
                    SettingRow(row.label, row.value, null, null)
                }
            ).let { if (fullScreen) it.withDetailHorizontalMargins() else it }
        )
        container.addView(activity.noticeCard(HubEventDetailFormatting.NoticeText).let { if (fullScreen) it.withDetailHorizontalMargins() else it })
    }

    private fun hubEventScheduleCard(
        item: HubEventScheduleTimelineItem,
        highlighted: Boolean,
        isEffectivePrimary: Boolean,
        initiallyExpanded: Boolean,
    ): MaterialCardView = activity.baseCard(HubCardStyle.COMPACT).apply {
        val scheduleCard = this
        val displayTitle = HubEventDetailFormatting.displayTitle(item.schedule)
        val links = HubEventLinkPolicy.resolvedScheduleLinks(item.schedule)
        var expanded = initiallyExpanded
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = activity.dp(10)
        }
        updateHubEventScheduleCardHighlight(this, highlighted)
        alpha = if (item.schedule.cancelledAt != null) 0.58f else 1f
        val content = LinearLayout(context).apply {
            val detailContainer = this
            orientation = LinearLayout.VERTICAL
            setPadding(activity.dp(14), activity.dp(10), activity.dp(14), activity.dp(12))
            addView(scheduleBadgeRow(buildList {
                add(ScheduleBadgePresentation(item.stateText, scheduleStateBadgeTone(item.stateText)))
                add(
                    ScheduleBadgePresentation(
                        HubEventDetailFormatting.scheduleKindLabel(item.schedule.kind),
                        ScheduleBadgeTone.KIND,
                    )
                )
                if (isEffectivePrimary) add(ScheduleBadgePresentation("대표 일정", ScheduleBadgeTone.PRIMARY))
                if (highlighted) add(ScheduleBadgePresentation("선택한 일정", ScheduleBadgeTone.SELECTED))
            }))
            val heading = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, activity.dp(7), 0, 0)
            }
            heading.addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(context).apply {
                    text = displayTitle
                    setTextColor(activity.color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                    includeFontPadding = false
                })
                addView(TextView(context).apply {
                    text = item.timingText
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                    includeFontPadding = false
                    setPadding(0, activity.dp(4), 0, 0)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            val chevron = ImageView(context).apply {
                setImageResource(R.drawable.ic_chevron_down_24)
                imageTintList = ColorStateList.valueOf(activity.color(R.color.hub_text_muted))
                scaleType = ImageView.ScaleType.CENTER
            }
            heading.addView(chevron, LinearLayout.LayoutParams(activity.dp(36), activity.dp(44)))
            addView(heading)

            val details = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                isVisible = expanded
                addView(TextView(context).apply {
                    text = "정확한 일정 · ${item.timingText}"
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 11f
                    setPadding(0, activity.dp(9), 0, 0)
                })
                addView(TextView(context).apply {
                    val precision = if (item.schedule.timePrecision.name == "DATE") "날짜만" else "날짜와 시간"
                    text = "$precision · ${item.schedule.timezone}"
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 11f
                    setPadding(0, activity.dp(5), 0, 0)
                })
                HubEventDetailFormatting.scheduleDescription(item.schedule)?.let { description ->
                    addView(TextView(context).apply {
                        text = description
                        setTextColor(activity.color(R.color.hub_text))
                        textSize = 12f
                        setPadding(0, activity.dp(7), 0, 0)
                    })
                }
                item.schedule.sourceLabel?.takeIf { it.isNotBlank() }?.let { source ->
                    addView(TextView(context).apply {
                        text = "출처 · $source"
                        setTextColor(activity.color(R.color.hub_text_muted))
                        textSize = 11f
                        setPadding(0, activity.dp(6), 0, 0)
                    })
                }
                links.forEach { link ->
                    val label = HubEventLinkPolicy.displayLinkLabel(link)
                    addView(activity.detailActionButton(label, primary = false) { activity.openHubEventLink(currentSelectedHubEvent() ?: return@detailActionButton, item.schedule, link) }.apply {
                        contentDescription = "$label, 외부 링크 열기"
                    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, activity.dp(44)).apply {
                        topMargin = activity.dp(9)
                    })
                }
            }
            addView(details)

            fun updateExpansionPresentation(animate: Boolean) {
                details.isVisible = expanded
                scheduleCard.isActivated = expanded
                val targetRotation = if (expanded) 180f else 0f
                if (animate) {
                    chevron.animate()
                        .rotation(targetRotation)
                        .setDuration(220L)
                        .start()
                } else {
                    chevron.rotation = targetRotation
                }
                scheduleCard.contentDescription = buildString {
                    append(displayTitle)
                    append(", ")
                    append(item.stateText)
                    if (isEffectivePrimary) append(", 대표 일정")
                    append(", ")
                    append(item.timingText)
                    if (highlighted) append(", 선택한 일정")
                    append(if (expanded) ", 펼쳐짐, 세부 정보 접기" else ", 접힘, 세부 정보 펼치기")
                }
            }
            updateExpansionPresentation(animate = false)
            scheduleCard.isClickable = true
            scheduleCard.isFocusable = true
            scheduleCard.setOnClickListener {
                expanded = !expanded
                if (expanded) activity.expandedHubEventScheduleItemIds.add(item.schedule.id)
                else activity.expandedHubEventScheduleItemIds.remove(item.schedule.id)
                val transitionRoot = (scheduleCard.parent as? ViewGroup) ?: detailContainer
                TransitionManager.beginDelayedTransition(
                    transitionRoot,
                    AutoTransition().apply { duration = 220L },
                )
                updateExpansionPresentation(animate = true)
            }
        }
        addView(content)
    }

    private fun updateHubEventScheduleCardHighlight(
        card: MaterialCardView,
        highlighted: Boolean,
    ) {
        card.isSelected = highlighted
        card.strokeWidth = if (highlighted) activity.dp(2) else 0
        card.strokeColor = if (highlighted) activity.color(R.color.hub_primary) else activity.color(R.color.hub_line)
        card.setCardBackgroundColor(
            activity.color(if (highlighted) R.color.hub_accent_soft else R.color.hub_card_surface),
        )
        ViewCompat.setStateDescription(card, if (highlighted) "선택한 날짜의 일정" else null)
    }

    private fun scrollHubEventScheduleCardIntoView(card: MaterialCardView) {
        card.post {
            var descendant: View = card
            var targetY = 0
            while (true) {
                targetY += descendant.top
                when (val parent = descendant.parent) {
                    is NestedScrollView -> {
                        parent.smoothScrollTo(0, (targetY - activity.dp(16)).coerceAtLeast(0))
                        break
                    }
                    is ScrollView -> {
                        parent.smoothScrollTo(0, (targetY - activity.dp(16)).coerceAtLeast(0))
                        break
                    }
                    is View -> descendant = parent
                    else -> break
                }
            }
            card.requestFocus()
            card.announceForAccessibility("선택한 세부 일정으로 이동")
        }
    }

    private fun scheduleStateBadgeTone(stateText: String): ScheduleBadgeTone = when (stateText) {
        "예정" -> ScheduleBadgeTone.UPCOMING
        "진행" -> ScheduleBadgeTone.IN_PROGRESS
        "취소" -> ScheduleBadgeTone.CANCELLED
        else -> ScheduleBadgeTone.COMPLETED
    }

    private fun scheduleBadgeColors(tone: ScheduleBadgeTone): Pair<Int, Int> = when (tone) {
        ScheduleBadgeTone.UPCOMING -> R.color.hub_schedule_tag_upcoming to R.color.hub_schedule_tag_upcoming_soft
        ScheduleBadgeTone.IN_PROGRESS -> R.color.hub_schedule_tag_progress to R.color.hub_schedule_tag_progress_soft
        ScheduleBadgeTone.COMPLETED -> R.color.hub_schedule_tag_completed to R.color.hub_schedule_tag_completed_soft
        ScheduleBadgeTone.CANCELLED -> R.color.hub_schedule_tag_cancelled to R.color.hub_schedule_tag_cancelled_soft
        ScheduleBadgeTone.KIND -> R.color.hub_schedule_tag_kind to R.color.hub_schedule_tag_kind_soft
        ScheduleBadgeTone.PRIMARY -> R.color.hub_schedule_tag_primary to R.color.hub_schedule_tag_primary_soft
        ScheduleBadgeTone.SELECTED -> R.color.hub_schedule_tag_selected to R.color.hub_schedule_tag_selected_soft
    }

    private fun scheduleBadgeRow(badges: List<ScheduleBadgePresentation>): ChipGroup = ChipGroup(activity).apply {
        isSingleLine = false
        chipSpacingHorizontal = activity.dp(5)
        chipSpacingVertical = activity.dp(4)
        badges.forEach { badge ->
            val (textColorRes, backgroundColorRes) = scheduleBadgeColors(badge.tone)
            addView(Chip(context).apply {
                text = badge.label
                textSize = 10f
                includeFontPadding = false
                gravity = Gravity.CENTER
                textAlignment = View.TEXT_ALIGNMENT_CENTER
                setTextColor(activity.color(textColorRes))
                chipBackgroundColor = ColorStateList.valueOf(activity.color(backgroundColorRes))
                chipStrokeWidth = 0f
                isClickable = false
                isCheckable = false
                isFocusable = false
                setEnsureMinTouchTargetSize(false)
                chipMinHeight = activity.dp(23).toFloat()
                minHeight = activity.dp(23)
                setPadding(0, 0, 0, 0)
            })
        }
    }

    private fun View.withDetailHorizontalMargins(): View {
        val params = (layoutParams as? LinearLayout.LayoutParams)
            ?: LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
                )
            params.leftMargin = activity.dp(18)
            params.rightMargin = activity.dp(18)
        layoutParams = params
        return this
    }

    @Suppress("unused")
    private fun View.withGoodsEventsNoticeTopMargin(): View {
        val params = (layoutParams as? LinearLayout.LayoutParams)
            ?: LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        params.topMargin = activity.dp(8)
        layoutParams = params
        return this
    }

    private fun hubEventDetailHero(event: HubEvent): FrameLayout =
        FrameLayout(activity).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                activity.systemTopInsetPx + activity.dp(338)
            ).apply {
                leftMargin = 0
                rightMargin = 0
                bottomMargin = activity.dp(8)
            }
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(
                    Color.rgb(54, 79, 99),
                    Color.rgb(16, 43, 53),
                    Color.rgb(15, 20, 23)
                )
            )

            event.image?.takeIf(HubEventImagePolicy::canDisplay)?.url?.let { imageUrl ->
                val imageView = ImageView(context).apply {
                    visibility = View.GONE
                    scaleType = ImageView.ScaleType.CENTER_CROP
                }
                addView(
                    imageView,
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                )
                imageView.load(imageUrl) {
                    listener(
                        onSuccess = { _, _ -> imageView.visibility = View.VISIBLE },
                        onError = { _, _ -> imageView.visibility = View.GONE },
                    )
                }
            }

            addView(
                View(context).apply {
                    background = GradientDrawable(
                        GradientDrawable.Orientation.TOP_BOTTOM,
                        intArrayOf(Color.TRANSPARENT, Color.argb(188, 0, 0, 0))
                    )
                },
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    activity.dp(172),
                    Gravity.BOTTOM
                )
            )

            addView(
                LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(activity.dp(18), 0, activity.dp(18), activity.dp(10))
                    addView(ChipGroup(context).apply {
                        isSingleLine = false
                        chipSpacingHorizontal = activity.dp(10)
                        chipSpacingVertical = activity.dp(6)
                        HubEventDetailFormatting.heroTags(event).forEach { tag ->
                            addView(heroTagChip(tag.label, tag.tone))
                        }
                    })
                    addView(LinearLayout(context).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding(0, activity.dp(10), 0, 0)
                        addView(TextView(context).apply {
                            text = event.title
                            setTextColor(Color.WHITE)
                            textSize = 25f
                            typeface = Typeface.DEFAULT_BOLD
                            setLineSpacing(0f, 1.06f)
                        })
                        HubEventDetailFormatting.heroSubtitleLines(event).forEachIndexed { index, line ->
                            addView(TextView(context).apply {
                                text = line
                                setTextColor(Color.argb(214, 255, 255, 255))
                                textSize = 13f
                                typeface = if (index == 0) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
                                setPadding(0, if (index == 0) activity.dp(7) else activity.dp(3), 0, 0)
                            })
                        }
                    })
                },
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.BOTTOM or Gravity.START
                )
            )
        }

    private fun hubEventDetailActions(event: HubEvent): LinearLayout = LinearLayout(activity).apply {
        val links = HubEventLinkPolicy.resolvedEventLinks(event)
        orientation = LinearLayout.HORIZONTAL
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            leftMargin = activity.dp(18)
            rightMargin = activity.dp(18)
            bottomMargin = activity.dp(12)
        }

        val calendarParams = LinearLayout.LayoutParams(0, activity.dp(50), 1f)
        if (links.isNotEmpty()) calendarParams.marginEnd = activity.dp(5)
        addView(activity.detailActionButton("캘린더 추가", primary = true) { openCalendarInsert(event) }, calendarParams)
        if (links.isNotEmpty()) {
            val ctaMode = HubEventLinkPolicy.eventCtaMode(event)
            val label = if (ctaMode == HubEventLinkCtaMode.DIRECT) {
                HubEventLinkPolicy.displayLinkLabel(links.single())
            } else {
                "관련 링크 ${links.size}개"
            }
            addView(
                activity.detailActionButton(label, primary = false) {
                    if (ctaMode == HubEventLinkCtaMode.DIRECT) activity.openHubEventLink(event, null, links.single())
                    else HubEventLinksBottomSheet(activity) { link -> activity.openHubEventLink(event, null, link) }.show("관련 링크", links)
                }.apply {
                    contentDescription = if (ctaMode == HubEventLinkCtaMode.DIRECT) "$label, 외부 링크 열기" else "$label, 목록 열기"
                },
                LinearLayout.LayoutParams(0, activity.dp(50), 1f).apply { marginStart = activity.dp(5) }
            )
        }
    }

    private fun openCalendarInsert(event: HubEvent) {
        val intent = Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, event.title)
            .putExtra(CalendarContract.Events.EVENT_LOCATION, event.venueName)
            .putExtra(CalendarContract.Events.DESCRIPTION, event.summary ?: event.sourceLabel)
        event.startsAt?.let { intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, it.toEpochMilli()) }
        event.endsAt?.let { intent.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, it.toEpochMilli()) }
        activity.startActivity(intent)
    }

    private fun heroTagChip(text: String, tone: HubEventHeroTagTone): Chip =
        activity.rowChip(text).apply {
            val textColorRes = when (tone) {
                HubEventHeroTagTone.STATUS -> R.color.hub_success
                HubEventHeroTagTone.CATEGORY -> R.color.hub_warning
                HubEventHeroTagTone.PARTICIPATION -> R.color.hub_primary
                HubEventHeroTagTone.SUPPLEMENTARY -> R.color.hub_text_muted
            }
            val tagColor = activity.color(textColorRes)
            setTextColor(tagColor)
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            minWidth = 0
            minHeight = 0
            chipMinHeight = activity.dp(32).toFloat()
            chipStartPadding = activity.dp(9).toFloat()
            chipEndPadding = activity.dp(9).toFloat()
            textStartPadding = 0f
            textEndPadding = 0f
            iconStartPadding = 0f
            iconEndPadding = 0f
            closeIconStartPadding = 0f
            closeIconEndPadding = 0f
            chipBackgroundColor = ColorStateList.valueOf(tagColor.withAlpha(112))
            chipStrokeColor = ColorStateList.valueOf(tagColor.withAlpha(88))
            rippleColor = ColorStateList.valueOf(Color.TRANSPARENT)
            (layoutParams as? ViewGroup.MarginLayoutParams)?.marginEnd = activity.dp(10)
        }

    private fun Int.withAlpha(alpha: Int): Int =
        Color.argb(alpha, Color.red(this), Color.green(this), Color.blue(this))
}
