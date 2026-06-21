package dev.stellive.hub

import android.Manifest
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.CalendarContract
import android.view.DragEvent
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.google.android.material.card.MaterialCardView
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.google.android.material.switchmaterial.SwitchMaterial
import dagger.hilt.android.AndroidEntryPoint
import dev.stellive.hub.core.device.DeviceIdStore
import dev.stellive.hub.core.datastore.PreferenceKeys
import dev.stellive.hub.core.model.AppearanceMode
import dev.stellive.hub.core.model.CatalogRole
import dev.stellive.hub.core.model.DeliveryMode
import dev.stellive.hub.core.model.HubCalendarDay
import dev.stellive.hub.core.model.HubCalendarEntry
import dev.stellive.hub.core.model.HubEvent
import dev.stellive.hub.core.model.HubMember
import dev.stellive.hub.core.model.NotificationEventType
import dev.stellive.hub.core.model.NotificationHistoryItem
import dev.stellive.hub.core.model.NotificationPlatform
import dev.stellive.hub.databinding.ActivityMainBinding
import dev.stellive.hub.feature.calendar.HubCalendarDeepLinkPolicy
import dev.stellive.hub.feature.calendar.CalendarUiPolicy
import dev.stellive.hub.feature.calendar.HubEventsCalendarView
import dev.stellive.hub.feature.home.HubScreen
import dev.stellive.hub.feature.home.HubRepository
import dev.stellive.hub.feature.home.LiveMemberOrderingPolicy
import dev.stellive.hub.core.network.HubApiClient
import dev.stellive.hub.feature.home.MainUiPolicy
import dev.stellive.hub.feature.home.MainNavigationHistory
import dev.stellive.hub.feature.home.MockHubRepository
import dev.stellive.hub.feature.home.ServerHubRepository
import dev.stellive.hub.feature.hubevents.HubEventDetailFormatting
import dev.stellive.hub.feature.hubevents.HubEventImagePolicy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import kotlin.concurrent.thread
import dev.stellive.hub.feature.home.SettingsHubRow
import dev.stellive.hub.feature.home.StatusSummaryItem

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
private data class LiveClockTextView(
    val startedAt: Instant,
    val textView: TextView,
)

private data class LiveDragPayload(
    val memberId: String,
    val fromIndex: Int,
)

private lateinit var binding: ActivityMainBinding
    private val repository = MockHubRepository()
    private lateinit var serverRepository: HubRepository
    private val liveClockHandler = Handler(Looper.getMainLooper())
    private val liveClockTextViews = mutableListOf<LiveClockTextView>()
    private val liveClockTicker = object : Runnable {
        override fun run() {
            updateLiveClockTextViews()
            scheduleLiveClockRefresh()
        }
    }
    private var serverMembers: List<HubMember>? = null
    private var liveStatusSourceLabel = "앱 내 목업"
    private var debugModeEnabled = false
    private var systemTopInsetPx = 0
    private val serverConnectionDebugLogs = mutableListOf("bootstrap: 대기 중")
    private val navigationHistory = MainNavigationHistory()
private var selectedFilter = "all"
private var selectedLiveStatusFilter = "all"
private var liveMemberPriorityIds: List<String> = emptyList()
private var draggingLiveMemberId: String? = null
    private var selectedHistoryEventTypeFilterId = "all"
    private var selectedHistoryMemberFilterId = "all"
    private var selectedHubEventId: String? = null
    private var goodsEventsDays: List<HubCalendarDay> = emptyList()
    private var goodsEvents: List<HubEvent> = emptyList()
    private var goodsEventsSelectedMonth: YearMonth = YearMonth.now()
    private var serverHubEventDetailLoadedId: String? = null
    private var serverHubEventDetail: HubEvent? = null
    private var selectedAppearanceMode = AppearanceMode.SYSTEM
    private val targetNotificationEnabledOverrides = mutableMapOf<String, Boolean>()
    private var notificationPermissionRequested = false
    private val requestNotificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        selectedAppearanceMode = readAppearanceMode()
        liveMemberPriorityIds = readLiveMemberPriorityIds()
        AppCompatDelegate.setDefaultNightMode(selectedAppearanceMode.toNightMode())
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        serverRepository = createServerRepository()
        configureTopBarGlass()
        setupTopBarScrollBehavior()
        setupBackNavigation()
        setupTopBarActions()
        setupBottomNavigation()
        setupPullToRefresh()
        if (!handleAppDeepLink(intent)) {
            renderHome()
            updateSelectedBottomNavigation(HubScreen.HOME)
        }
        updateNavigationChrome()
        loadServerBootstrap()
    }

    override fun onResume() {
        super.onResume()
        scheduleLiveClockRefresh()
    }

    override fun onPause() {
        liveClockHandler.removeCallbacks(liveClockTicker)
        super.onPause()
    }

    override fun onDestroy() {
        liveClockHandler.removeCallbacks(liveClockTicker)
        liveClockTextViews.clear()
        super.onDestroy()
    }

    private fun loadServerBootstrap() {
        CoroutineScope(Dispatchers.Main).launch {
            val state = serverRepository.bootstrap()
            serverMembers = state.members
            liveStatusSourceLabel = state.liveStatusSourceLabel
            recordServerConnectionLog("bootstrap: $liveStatusSourceLabel")
            renderScreen(navigationHistory.currentScreen)
            binding.contentRefresh.isRefreshing = false
        }
    }

    private fun createServerRepository(): HubRepository =
        ServerHubRepository(
            remoteDataSource = ServerHubRepository.HubApiRemoteDataSource(HubApiClient.create(BuildConfig.HUB_BASE_URL)),
            deviceIdStore = DeviceIdStore(this),
            fallback = repository,
        )

 private fun setupPullToRefresh() {
 binding.contentRefresh.isEnabled = false
 binding.contentRefresh.setOnRefreshListener {
 loadServerBootstrap()
 }
 }

 private fun recordServerConnectionLog(message: String) {
        serverConnectionDebugLogs.add(message)
        while (serverConnectionDebugLogs.size > 8) {
            serverConnectionDebugLogs.removeAt(0)
        }
    }

    private fun visibleServerConnectionDebugLogs(): List<String> =
        MainUiPolicy.debugServerConnectionLogs(debugModeEnabled, serverConnectionDebugLogs)

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAppDeepLink(intent)
    }

    private fun handleAppDeepLink(intent: Intent?): Boolean {
        val eventId = HubCalendarDeepLinkPolicy.eventIdFromAppDeepLink(intent?.dataString) ?: return false
        selectedHubEventId = eventId
        navigationHistory.selectRoot(HubScreen.GOODS_EVENTS)
        navigateTo(HubScreen.GOODS_EVENT_DETAIL, addToBackStack = true)
        return true
    }

    private fun setupTopBarScrollBehavior() {
        binding.contentScroll.setOnScrollChangeListener { _, _, scrollY, _, _ ->
            updateTopBarScrolled(scrollY > dp(24))
        }
    }

    private fun setupBottomNavigation() {
        bottomNavigationItems().forEach { item ->
            item.setOnClickListener {
                navigateToRoot(screenForItem(item.id))
            }
        }
    }

    private fun setupTopBarActions() {
        binding.topBarSettings.setOnClickListener {
            navigateTo(HubScreen.SETTINGS, addToBackStack = true)
        }
    }

    private fun setupBackNavigation() {
        binding.topBarBack.setOnClickListener {
            if (!navigateBack()) finish()
        }
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (!navigateBack()) finish()
                }
            }
        )
    }

    private fun navigateTo(screen: HubScreen, addToBackStack: Boolean) {
        if (addToBackStack && screen == navigationHistory.currentScreen) return
        if (addToBackStack) {
            navigationHistory.select(screen)
        }
        renderScreen(screen)
        updateSelectedBottomNavigation(screen)
        updateNavigationChrome()
    }

    private fun navigateToRoot(screen: HubScreen) {
        if (screen == navigationHistory.currentScreen && !navigationHistory.canGoBack) return
        navigationHistory.selectRoot(screen)
        renderScreen(screen)
        updateSelectedBottomNavigation(screen)
        updateNavigationChrome()
    }

    private fun navigateBack(): Boolean {
        val previous = navigationHistory.goBack() ?: return false
        renderScreen(previous)
        updateSelectedBottomNavigation(previous)
        updateNavigationChrome()
        return true
    }

    private fun renderScreen(screen: HubScreen) {
        when (screen) {
            HubScreen.HOME -> renderHome()
            HubScreen.GOODS_EVENTS -> renderGoodsEvents()
            HubScreen.GOODS_EVENT_DETAIL -> renderHubEventDetail()
            HubScreen.LIVE -> renderLive()
            HubScreen.HISTORY -> renderHistory()
            HubScreen.SETTINGS -> renderSettings()
            HubScreen.SETTINGS_DELIVERY -> renderSettingsDelivery()
            HubScreen.SETTINGS_TARGETS -> renderSettingsTargets()
            HubScreen.SETTINGS_PLATFORMS -> renderSettingsPlatforms()
            HubScreen.SETTINGS_EVENT_TYPES -> renderSettingsEventTypes()
            HubScreen.SETTINGS_HUB_EVENTS -> renderSettingsHubEvents()
            HubScreen.SETTINGS_ADVANCED -> renderSettingsAdvanced()
        }
        binding.contentRefresh.isEnabled = screen == HubScreen.LIVE || screen == HubScreen.GOODS_EVENTS
    }

    private fun updateSelectedBottomNavigation(screen: HubScreen) {
        val selectedItem = itemForScreen(screen) ?: return
        bottomNavigationItems().forEach { item ->
            setSelectedState(item, item.id == selectedItem)
        }
    }

    private fun bottomNavigationItems(): List<View> = listOf(
        binding.tabHome,
        binding.tabLive,
        binding.tabHistory,
        binding.tabGoodsEvents
    )

    private fun setSelectedState(view: View, selected: Boolean) {
        view.isSelected = selected
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                setSelectedState(view.getChildAt(index), selected)
            }
        }
    }

    private fun updateNavigationChrome() {
        val canGoBack = navigationHistory.canGoBack
        binding.topBarBack.visibility = if (canGoBack) View.VISIBLE else View.GONE
        binding.topBarTitleGroup.setPaddingRelative(
            dp(MainUiPolicy.topBarTitleStartInsetDp(canGoBack)),
            binding.topBarTitleGroup.paddingTop,
            binding.topBarTitleGroup.paddingEnd,
            binding.topBarTitleGroup.paddingBottom
        )
        binding.topBarTitleGroup.visibility =
            if (MainUiPolicy.showsTopBarText(navigationHistory.currentScreen.id)) View.VISIBLE else View.INVISIBLE
        binding.topBarSettings.visibility = if (
            MainUiPolicy.showsSettingsTopBarAction(navigationHistory.currentScreen.id, canGoBack)
        ) {
            View.VISIBLE
        } else {
            View.GONE
        }
    }

    private fun screenForItem(itemId: Int): HubScreen = when (itemId) {
        R.id.tab_live -> HubScreen.LIVE
        R.id.tab_history -> HubScreen.HISTORY
        R.id.tab_goods_events -> HubScreen.GOODS_EVENTS
        else -> HubScreen.HOME
    }

    private fun itemForScreen(screen: HubScreen): Int? = when (screen) {
        HubScreen.HOME -> R.id.tab_home
        HubScreen.GOODS_EVENTS -> R.id.tab_goods_events
        HubScreen.GOODS_EVENT_DETAIL -> R.id.tab_goods_events
        HubScreen.LIVE -> R.id.tab_live
        HubScreen.HISTORY -> R.id.tab_history
        HubScreen.SETTINGS -> null
        HubScreen.SETTINGS_DELIVERY -> null
        HubScreen.SETTINGS_TARGETS -> null
        HubScreen.SETTINGS_PLATFORMS -> null
        HubScreen.SETTINGS_EVENT_TYPES -> null
        HubScreen.SETTINGS_HUB_EVENTS -> null
        HubScreen.SETTINGS_ADVANCED -> null
    }

    private fun startScreen(screenId: String, title: String, role: String) {
        liveClockHandler.removeCallbacks(liveClockTicker)
        liveClockTextViews.clear()
        binding.collapsedTitle.text = MainUiPolicy.topBarTitle(screenId)
        binding.collapsedRole.text = MainUiPolicy.topBarRole(screenId)
        binding.contentList.removeAllViews()
        applyContentTopPadding(underTopBar = false)
        binding.contentList.addView(screenTitle(title))
        binding.contentList.addView(screenCopy(role))
        binding.contentScroll.post {
            binding.contentScroll.scrollTo(0, 0)
            updateTopBarScrolled(false)
        }
    }

    private fun applyContentTopPadding(underTopBar: Boolean) {
        val topPadding = if (underTopBar) 0 else systemTopInsetPx + dp(86)
        val horizontalPadding = if (underTopBar) 0 else dp(18)
        binding.contentList.setPadding(horizontalPadding, topPadding, horizontalPadding, dp(20))
    }

    private fun liveMembersForUi(): List<HubMember> =
        LiveMemberOrderingPolicy.orderedLiveMembers(serverMembers ?: repository.members, liveMemberPriorityIds)

    private fun chzzkMembersForUi(): List<HubMember> =
        LiveMemberOrderingPolicy.orderedChzzkTargets(serverMembers ?: repository.members, liveMemberPriorityIds)

    private fun liveStatusFilteredMembersForUi(): List<HubMember> =
        chzzkMembersForUi()
            .filter {
                when (selectedLiveStatusFilter) {
                    "live" -> it.isLive
                    "offline" -> !it.isLive
                    else -> true
                }
            }

    private fun renderHome() {
        startScreen(
            screenId = "home",
            title = getString(R.string.home_title),
            role = "지금 라이브, 최근 알림, 마감 임박 굿즈/행사를 확인합니다."
        )
        binding.contentList.addView(sectionLabel("지금 라이브"))
        binding.contentList.addView(compactEventCard("라이브 데이터", liveStatusSourceLabel, listOf("상태")))
        if (liveMembersForUi().isEmpty()) {
            binding.contentList.addView(
                compactEventCard("현재 라이브 없음", "서버 갱신 기준으로 표시합니다.", listOf("대기"))
            )
        } else {
            LiveMemberOrderingPolicy.homeLivePreview(serverMembers ?: repository.members, liveMemberPriorityIds)
                .forEach { binding.contentList.addView(liveMemberRow(it)) }
            if (LiveMemberOrderingPolicy.hasHomeLiveOverflow(serverMembers ?: repository.members)) {
                binding.contentList.addView(moreLiveMembersButton())
            }
        }
        binding.contentList.addView(sectionLabel("최근 알림"))
        if (repository.recentHistoryPreview.isEmpty()) {
            binding.contentList.addView(
                compactEventCard("최근 알림 없음", "허용된 알림이 도착하면 여기에 표시됩니다.", listOf("기록"))
            )
        } else {
            repository.recentHistoryPreview.forEach {
                binding.contentList.addView(
                    historyEventCard(
                        item = it,
                        member = repository.memberForHistory(it)
                    )
                )
            }
        }
        binding.contentList.addView(sectionLabel("마감 임박 굿즈/행사"))
        val hubEventsListAction = MainUiPolicy.homeHubEventsListAction(repository.closingSoonHubEvents.size)
        if (repository.closingSoonHubEvents.isEmpty()) {
            binding.contentList.addView(
                compactEventCard(
                    hubEventsListAction.title,
                    hubEventsListAction.body,
                    hubEventsListAction.pills
                ).apply {
                    isClickable = true
                    isFocusable = true
                    setOnClickListener {
                        navigateToRoot(HubScreen.GOODS_EVENTS)
                    }
                }
            )
        } else {
            repository.closingSoonHubEvents.forEach {
                binding.contentList.addView(hubEventCard(it))
            }
            binding.contentList.addView(
                compactEventCard(
                    hubEventsListAction.title,
                    hubEventsListAction.body,
                    hubEventsListAction.pills
                ).apply {
                    isClickable = true
                    isFocusable = true
                    setOnClickListener {
                        navigateToRoot(HubScreen.GOODS_EVENTS)
                    }
                }
            )
        }
    }

    private fun moreLiveMembersButton(): Chip =
        Chip(this).apply {
            text = "더보기"
            isCheckable = false
            chipMinHeight = dp(34).toFloat()
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            chipBackgroundColor = ContextCompat.getColorStateList(context, R.color.hub_surface)
            chipStrokeWidth = dp(1).toFloat()
            chipStrokeColor = ContextCompat.getColorStateList(context, R.color.hub_line)
            setTextColor(color(R.color.hub_text))
            setOnClickListener {
                navigateTo(HubScreen.LIVE, addToBackStack = false)
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                bottomMargin = dp(10)
            }
        }

    private fun renderGoodsEvents() {
        startScreen(
            screenId = "goods_events",
            title = "굿즈/행사",
            role = "공식/멤버/공식 콜라보 출처가 있는 기간성 정보만 표시합니다."
        )
        binding.contentList.addView(
            summaryGrid(
                listOf(
                    StatusSummaryItem(repository.hubEventsSummary.openCount.toString(), "진행 중"),
                    StatusSummaryItem(repository.hubEventsSummary.upcomingCount.toString(), "예정"),
                    StatusSummaryItem(repository.hubEventsSummary.closingSoonCount.toString(), "마감 임박")
                )
            )
        )
        binding.contentList.addView(staticChips("전체", "굿즈", "티켓", "오프라인", "마감 임박"))
        loadServerGoodsEvents()
        return
        binding.contentList.addView(
            HubEventsCalendarView(
                context = this,
                days = repository.calendarDaysForFilter("all"),
                initialMonth = goodsEventsSelectedMonth,
                showModeControls = false,
                onMonthChanged = { month ->
                    goodsEventsSelectedMonth = month
                    if (navigationHistory.currentScreen == HubScreen.GOODS_EVENTS) {
                        renderServerGoodsEvents(goodsEventsDays, goodsEvents)
                    }
                },
            ) { eventId ->
                selectedHubEventId = eventId
                navigateTo(HubScreen.GOODS_EVENT_DETAIL, addToBackStack = true)
            }
        )

        repository.calendarDaysForFilter("all").forEach { day ->
            binding.contentList.addView(calendarDayHeader(calendarDayHeaderText(day)))
            day.entries.forEach { entry ->
                repository.hubEvents.firstOrNull { it.id == entry.eventId }?.let { event ->
                    binding.contentList.addView(hubEventCard(event))
                }
            }
        }
        binding.contentList.addView(
            noticeCard("방송/라이브/업로드와 팬 주최 이벤트는 굿즈/행사 피드에 포함하지 않습니다.")
                .withGoodsEventsNoticeTopMargin()
        )
    }

    private fun loadServerGoodsEvents() {
        binding.contentList.addView(noticeCard("불러오는 중 · 서버에서 게시된 굿즈/행사 목록과 캘린더를 가져오고 있습니다."))
        CoroutineScope(Dispatchers.Main).launch {
            val today = LocalDate.now()
            val from = today.minusMonths(1)
            val to = today.plusMonths(3)
            val days = serverRepository.hubCalendarDays(from, to, "Asia/Seoul")
            val events = serverRepository.hubEvents("all", from, to)
            goodsEventsSelectedMonth = YearMonth.from(today)
            goodsEventsDays = days
            goodsEvents = events
            if (navigationHistory.currentScreen == HubScreen.GOODS_EVENTS) {
                renderServerGoodsEvents(days, events)
            }
        }
    }

private fun renderServerGoodsEvents(days: List<HubCalendarDay>, events: List<HubEvent>) {
        goodsEventsDays = days
        goodsEvents = events
        val monthDays = days.filter { it.date.take(7) == goodsEventsSelectedMonth.toString() }
        binding.contentList.removeAllViews()
        binding.contentList.addView(
            summaryGrid(
                listOf(
                    StatusSummaryItem(events.count { it.status == dev.stellive.hub.core.model.HubEventStatus.OPEN }.toString(), "진행 중"),
                    StatusSummaryItem(events.count { it.status == dev.stellive.hub.core.model.HubEventStatus.UPCOMING }.toString(), "예정"),
                    StatusSummaryItem(events.count { it.status == dev.stellive.hub.core.model.HubEventStatus.CLOSING_SOON }.toString(), "마감 임박")
                )
            )
        )
        binding.contentList.addView(staticChips("전체", "굿즈", "티켓", "오프라인", "마감 임박"))
        binding.contentList.addView(
            HubEventsCalendarView(
                context = this,
                days = days,
                initialMonth = goodsEventsSelectedMonth,
                showModeControls = false,
                onMonthChanged = { month ->
                    goodsEventsSelectedMonth = month
                    if (navigationHistory.currentScreen == HubScreen.GOODS_EVENTS) {
                        renderServerGoodsEvents(goodsEventsDays, goodsEvents)
                    }
                },
            ) { eventId ->
                selectedHubEventId = eventId
                navigateTo(HubScreen.GOODS_EVENT_DETAIL, addToBackStack = true)
            }
        )
        val feedRows = CalendarUiPolicy.feedRenderRowsForMonth(
            days = monthDays,
            month = goodsEventsSelectedMonth,
            events = events,
        )
        var previousHeader: String? = null
        feedRows.forEach { row ->
            val header = calendarDayHeaderText(row.day)
            if (header != previousHeader) {
                binding.contentList.addView(calendarDayHeader(header))
                previousHeader = header
            }
            row.canonicalEvent?.let { event ->
                binding.contentList.addView(hubEventCard(event))
            } ?: binding.contentList.addView(localCalendarEntryRow(row.entry))
        }
        binding.contentList.addView(
            noticeCard("방송/라이브/업로드와 팬 주최 이벤트는 굿즈/행사 피드에 포함하지 않습니다.")
        )
    }

    private fun localCalendarEntryRow(entry: HubCalendarEntry): MaterialCardView =
        compactEventCard(
            title = entry.title,
            body = listOf(CalendarUiPolicy.entryPeriodDateText(entry), entry.displayTimeText)
                .filter { it.isNotBlank() }
                .joinToString(" · "),
            pills = listOf(entry.category.displayName, entry.participationMode.displayName)
                .filter { it.isNotBlank() },
    )

    private fun calendarDayHeaderText(day: HubCalendarDay): String {
        val periodEntry = day.entries.firstOrNull { entry ->
            CalendarUiPolicy.entryPeriodDateText(entry) != entry.displayDate
        } ?: return day.date
        return CalendarUiPolicy.entryPeriodDateText(periodEntry)
    }

    private fun calendarDayHeader(date: String): TextView = TextView(this).apply {
        text = date
        setTextColor(color(R.color.hub_text))
        setTextSize(15f)
        setTypeface(typeface, Typeface.BOLD)
        setPadding(dp(2), dp(18), dp(2), dp(8))
    }

    private fun renderHubEventDetail() {
        val eventId = selectedHubEventId
        if (eventId != null && serverHubEventDetailLoadedId != eventId) {
            startScreen(
                screenId = "goods_event_detail",
                title = "상세",
                role = "선택한 굿즈/행사를 불러오고 있습니다."
            )
            binding.contentList.addView(noticeCard("불러오는 중 · 서버에서 상세 정보를 가져오고 있습니다."))
            CoroutineScope(Dispatchers.Main).launch {
                serverHubEventDetail = serverRepository.hubEventDetail(eventId)
                serverHubEventDetailLoadedId = eventId
                if (navigationHistory.currentScreen == HubScreen.GOODS_EVENT_DETAIL && selectedHubEventId == eventId) {
                    renderHubEventDetail()
                }
            }
            return
        }
        val event = serverHubEventDetail?.takeIf { it.id == selectedHubEventId }
            ?: repository.hubEvents.firstOrNull { it.id == selectedHubEventId }
        if (event == null) {
            startScreen(
                screenId = "goods_event_detail",
                title = "상세",
                role = "선택한 굿즈/행사를 찾을 수 없습니다."
            )
            binding.contentList.addView(compactEventCard("항목 없음", "목록에서 다시 선택해 주세요.", listOf("굿즈/행사")))
            return
        }

        startScreen(
            screenId = "goods_event_detail",
            title = event.title,
            role = "공식 출처와 일정 정보를 확인합니다."
        )
        binding.collapsedTitle.text = MainUiPolicy.goodsEventDetailTopBarTitle(event.title)
        binding.collapsedRole.text = MainUiPolicy.goodsEventDetailTopBarRole()
        binding.contentList.removeAllViews()
        applyContentTopPadding(underTopBar = true)
        binding.contentList.addView(hubEventDetailHero(event))
        binding.contentList.addView(hubEventDetailActions(event))
        binding.contentList.addView(
            compactEventCard(
                title = event.title,
                body = listOfNotNull(
                    event.venueName,
                    event.startsAt?.let { HubEventDetailFormatting.formatDateTime(it) },
                ).joinToString(" · ").ifBlank { event.sourceLabel },
                pills = listOf(event.status.displayName, event.category.displayName, event.participationMode.displayName)
            ).withDetailHorizontalMargins()
        )
        binding.contentList.addView(
            compactEventCard(
                title = HubEventDetailFormatting.SummaryLabel,
                body = event.summary ?: "공식 출처 기반 굿즈/행사 정보입니다.",
                pills = listOf(event.status.displayName)
            ).withDetailHorizontalMargins()
        )
        binding.contentList.addView(
            settingsPanel(
                title = "행사 정보",
                rows = HubEventDetailFormatting.rows(event).map { row ->
                    SettingRow(row.label, row.value, null, null)
                }
            ).withDetailHorizontalMargins()
        )
        binding.contentList.addView(noticeCard(HubEventDetailFormatting.NoticeText).withDetailHorizontalMargins())
        return
        binding.contentList.addView(
            compactEventCard(
                title = event.title,
                body = event.summary ?: "공식 출처 기반 굿즈/행사 정보입니다.",
                pills = listOf(event.status.displayName, event.category.displayName, event.participationMode.displayName)
            )
        )
        binding.contentList.addView(
            settingsPanel(
                title = "정보",
                rows = listOfNotNull(
                    SettingRow("분류", event.category.displayName, null, event.category.displayName),
                    SettingRow("참여 방식", event.participationMode.displayName, null, event.participationMode.displayName),
                    SettingRow("출처", event.sourceLabel, null, "공식"),
                    event.venueName?.let { SettingRow("장소", it, null, "오프라인") },
                    event.endsAt?.let { SettingRow("종료", it.toString(), null, "일정") }
                )
            )
        )
        val linkRows = listOfNotNull(
            httpsLinkRow("출처", event.sourceUrl),
            httpsLinkRow("구매", event.purchaseUrl),
            httpsLinkRow("티켓", event.ticketUrl)
        )
        if (linkRows.isNotEmpty()) {
            binding.contentList.addView(settingsPanel(title = "링크", rows = linkRows))
        }
        binding.contentList.addView(
            noticeCard("공식 이미지, 로고, 포스터는 앱에 저장하거나 재사용하지 않습니다.")
        )
    }

    private fun renderLive() {
        startScreen(
            screenId = "live",
            title = getString(R.string.live_title),
            role = "Foreground 상태 갱신은 화면 표시용입니다. 백그라운드 알림은 서버 중심 푸시로 처리합니다."
        )
        binding.contentList.addView(liveStatusChips())
        binding.contentList.addView(compactEventCard("라이브 데이터", liveStatusSourceLabel, listOf("상태")))
        val members = liveStatusFilteredMembersForUi()
        if (members.isEmpty()) {
            binding.contentList.addView(compactEventCard("조건에 맞는 멤버 없음", "다른 라이브 상태 필터를 선택해 확인할 수 있습니다.", listOf("필터")))
        } else {
            members.forEach { member ->
                binding.contentList.addView(liveMemberRow(member, showOrderControls = true))
            }
        }
    }

    private fun renderHistory() {
        val eventTypeOptions = repository.historyEventTypeFilters()
        val memberOptions = repository.historyMemberFilters()
        val filteredHistory = repository.filteredHistory(
            eventTypeFilterId = selectedHistoryEventTypeFilterId,
            memberFilterId = selectedHistoryMemberFilterId
        )
        startScreen(
            screenId = "history",
            title = getString(R.string.history_title),
            role = "서버에서 허용, 중복 제거, 사용자 설정, rate limit을 통과한 이벤트만 표시합니다."
        )
        binding.contentList.addView(
            historyFilterPanel(
                rows = listOf(
                    HistoryFilterSelectorRow(
                        title = "알림 종류",
                        selectedValue = eventTypeOptions.firstOrNull { it.id == selectedHistoryEventTypeFilterId }?.displayName ?: "전체",
                        onClick = {
                            showHistoryFilterDialog(
                                title = "알림 종류",
                                options = eventTypeOptions.map { it.id to it.displayName },
                                selectedId = selectedHistoryEventTypeFilterId
                            ) {
                                selectedHistoryEventTypeFilterId = it
                                renderHistory()
                            }
                        }
                    ),
                    HistoryFilterSelectorRow(
                        title = "멤버",
                        selectedValue = memberOptions.firstOrNull { it.id == selectedHistoryMemberFilterId }?.displayName ?: "전체",
                        onClick = {
                            showHistoryFilterDialog(
                                title = "멤버",
                                options = memberOptions.map { it.id to it.displayName },
                                selectedId = selectedHistoryMemberFilterId
                            ) {
                                selectedHistoryMemberFilterId = it
                                renderHistory()
                            }
                        }
                    )
                )
            )
        )
        if (filteredHistory.isEmpty()) {
            binding.contentList.addView(
                compactEventCard(
                    "조건에 맞는 알림 없음",
                    "다른 알림 종류나 멤버를 선택하면 해당 기록만 볼 수 있습니다.",
                    listOf("필터")
                )
            )
        } else {
            filteredHistory.forEach {
                binding.contentList.addView(
                    historyEventCard(
                        item = it,
                        member = repository.memberForHistory(it)
                    )
                )
            }
        }
        binding.contentList.addView(noticeCard(MainUiPolicy.historyPolicyNotice()))
    }

    private fun renderSettings() {
        val settings = repository.settings
        startScreen(
            screenId = "settings",
            title = getString(R.string.settings_title),
            role = "핵심 상태만 보고, 세부 설정은 항목별 화면에서 변경합니다."
        )
        binding.contentList.addView(
            settingsPanel(
                title = "전체 알림",
                rows = listOf(
                    SettingRow("마스터 알림", "OFF이면 모든 푸시와 기록 생성 대상 알림을 차단합니다.", settings.globalEnabled),
                    SettingRow("터치 동작", "알림을 눌렀을 때 열 위치입니다.", null, settings.tapAction.name)
                )
            )
        )
        binding.contentList.addView(appearanceModePanel())
        binding.contentList.addView(debugModePanel())
        visibleServerConnectionDebugLogs().takeIf { it.isNotEmpty() }?.let { logs ->
            binding.contentList.addView(
                compactEventCard(
                    title = "서버 연결 로그",
                    body = logs.joinToString("\n"),
                    pills = listOf("임시", "디버그")
                )
            )
        }
        val targetValues = settings.generationEnabled.values.toList() +
            repository.members.filter { it.catalogRole != CatalogRole.PLACEHOLDER }.map { member ->
                settings.memberEnabled[member.id] ?: member.notificationEnabled
            }
        val hubRows = MainUiPolicy.settingsHubRows(
            deliveryMode = settings.deliveryMode.name,
            enabledTargets = targetValues.count { it },
            totalTargets = targetValues.size,
            enabledPlatforms = NotificationPlatform.entries.count { settings.platformEnabled[it] == true },
            totalPlatforms = NotificationPlatform.entries.size,
            enabledEventTypes = NotificationEventType.entries.count { settings.eventTypeEnabled[it] == true },
            totalEventTypes = NotificationEventType.entries.size,
            hubEventsEnabled = settings.platformEnabled[NotificationPlatform.HUB_EVENT] == true,
            deadlineSoonEnabled = settings.eventTypeEnabled[NotificationEventType.EVENT_DEADLINE_SOON] == true
        )
        binding.contentList.addView(sectionLabel("설정 항목"))
        hubRows.forEach { row ->
            binding.contentList.addView(settingsNavigationCard(row))
        }
        binding.contentList.addView(
            settingsPanel(
                title = "표시 정책",
                rows = listOf(
                    SettingRow("Former 멤버", "MVP 카탈로그, 알림 대상, 필터, seed data에 포함하지 않습니다.", null, "제외"),
                    SettingRow("강지", "감자 카테고리의 대표 항목으로 유지하되 굿즈/행사 MVP에는 표시하지 않습니다.", null, "대표"),
                    SettingRow("이미지/로고/포스터", "공식 이미지, 로고, 포스터, 캡처, 팬아트는 저장하거나 재사용하지 않습니다.", null, "텍스트")
                )
            )
        )
        if (!notificationPermissionRequested) {
            notificationPermissionRequested = true
            requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun renderSettingsDelivery() {
        val settings = repository.settings
        startScreen(
            screenId = "settings_delivery",
            title = "전달 방식",
            role = "실시간 우선은 OS와 플랫폼 정책을 우회하지 않습니다."
        )
        binding.contentList.addView(
            settingsPanel(
                title = "전달 방식",
                rows = listOf(
                    SettingRow("전달 방식", "표준 또는 realtime_best_effort. 비활성 알림을 다시 켜지는 않습니다.", null, settings.deliveryMode.name),
                    SettingRow("최대한 실시간으로 알림 받기", MainUiPolicy.realtimeDisclosureLines().joinToString(" "), settings.deliveryMode == DeliveryMode.REALTIME_BEST_EFFORT)
                )
            )
        )
        binding.contentList.addView(
            settingsPanel(
                title = "조용한 시간, 키워드, rate limit",
                rows = listOf(
                    SettingRow("조용한 시간", "${settings.quietHours.start}-${settings.quietHours.end} ${settings.quietHours.timezone}", settings.quietHours.enabled),
                    SettingRow("키워드 필터", "CHZZK chat 푸시는 명시 필터가 있어야 허용됩니다.", settings.keywordFilters.hasExplicitFilters),
                    SettingRow("분당 제한", "사용자 설정과 서버 rate limit은 realtime_best_effort에서도 계속 적용됩니다.", null, "${settings.rateLimit.maxNotificationsPerMinute}/min"),
                    SettingRow("CHZZK chat 푸시", "기본 OFF이며 명시 필터 없이는 푸시 전송 대상으로 쓰지 않습니다.", settings.canEnableChzzkChatPush)
                )
            )
        )
    }

    private fun renderSettingsTargets() {
        val settings = repository.settings
        startScreen(
            screenId = "settings_targets",
            title = "대상별 알림",
            role = "기수/카테고리와 개별 항목을 분리해서 제어합니다."
        )
        binding.contentList.addView(
            settingsPanel(
                title = "카테고리",
                rows = listOf(
                    SettingRow("1기생, 2기생, 3기생", "활성 멤버만 표시합니다. Former 멤버는 MVP에서 제외합니다.", settings.generationEnabled["gen1"] == true && settings.generationEnabled["gen2"] == true && settings.generationEnabled["gen3"] == true),
                    SettingRow("감자", "강지는 대표 항목으로만 포함합니다.", settings.generationEnabled["gamja"] == true),
                    SettingRow("기타", "스텔라이브 공식 X와 YouTube 업로드 알림입니다.", settings.generationEnabled["official"] == true),
                    SettingRow("upcoming", "기본 OFF입니다. 사용자가 명시적으로 켤 수 있습니다.", settings.generationEnabled["gen4-upcoming"] == true)
                )
            )
        )
        binding.contentList.addView(sectionLabel("개별 항목"))
        repository.members.filter { it.catalogRole != CatalogRole.PLACEHOLDER }.forEach { member ->
            binding.contentList.addView(
                targetToggleCard(
                    title = member.koreanName,
                    body = when (member.catalogRole) {
                        CatalogRole.REPRESENTATIVE -> "감자 카테고리의 대표 항목입니다."
                        CatalogRole.OFFICIAL_CHANNEL -> "기타 카테고리의 공식 채널입니다."
                        else -> "${member.generationName} · ${member.roleLabel ?: "멤버"}"
                    },
                    checked = targetNotificationEnabledOverrides[member.id]
                        ?: settings.memberEnabled[member.id]
                        ?: member.notificationEnabled,
                    onCheckedChange = { checked ->
                        targetNotificationEnabledOverrides[member.id] = checked
                    }
                )
            )
        }
    }

    private fun renderSettingsPlatforms() {
        val settings = repository.settings
        startScreen(
            screenId = "settings_platforms",
            title = "플랫폼별 알림",
            role = "플랫폼별 허용 여부"
        )
        binding.contentList.addView(
            settingsPanel(
                title = "플랫폼별 알림",
                rows = NotificationPlatform.entries.map { platform ->
                    SettingRow(
                        title = platform.displayName,
                        body = MainUiPolicy.settingsPlatformPolicy(platform),
                        checked = settings.platformEnabled[platform] == true
                    )
                }
            )
        )
        binding.contentList.addView(
            compactEventCard(
                title = "공통 안내",
                body = MainUiPolicy.settingsPlatformCommonNotice(),
                pills = listOf("플랫폼 OFF", "푸시 차단")
            )
        )
    }

    private fun renderSettingsEventTypes() {
        val settings = repository.settings
        startScreen(
            screenId = "settings_event_types",
            title = "이벤트 타입별 알림",
            role = "이벤트 종류별 허용 여부"
        )
        binding.contentList.addView(
            settingsPanel(
                title = "이벤트 타입별 알림",
                rows = MainUiPolicy.settingsEventTypeRows(settings).map { row ->
                    SettingRow(
                        title = row.title,
                        body = row.body,
                        checked = row.checked
                    )
                }
            )
        )
        binding.contentList.addView(
            compactEventCard(
                title = "공통 안내",
                body = MainUiPolicy.settingsEventTypeCommonNotices().first(),
                pills = listOf("조용한 시간", "차단 키워드", "rate limit")
            )
        )
        binding.contentList.addView(
            settingsPanel(
                title = "채팅 알림",
                rows = listOf(
                    SettingRow("치지직 채팅 알림", "기본 OFF입니다. 키워드 또는 역할 필터를 설정한 경우에만 제한적으로 사용합니다.", settings.chatEnabled),
                    SettingRow("Push 전달 가능", "명시 필터가 있을 때만 푸시 전송 대상으로 쓸 수 있습니다.", null, if (settings.canEnableChzzkChatPush) "필터 설정됨" else "필터 필요")
                )
            )
        )
        binding.contentList.addView(
            compactEventCard(
                title = "공식 채널 제한",
                body = MainUiPolicy.settingsEventTypeCommonNotices().last(),
                pills = listOf("공식 X 게시글", "공식 YouTube 업로드", "공식 YouTube live 제외")
            )
        )
    }

    private fun renderSettingsHubEvents() {
        val settings = repository.settings
        startScreen(
            screenId = "settings_hub_events",
            title = "굿즈/행사",
            role = "온라인 한정 굿즈와 오프라인 공식 행사를 중심으로 봅니다."
        )
        binding.contentList.addView(
            settingsPanel(
                title = "굿즈/행사",
                rows = MainUiPolicy.settingsHubEventRows(
                    hubEventsEnabled = settings.platformEnabled[NotificationPlatform.HUB_EVENT] == true,
                    deadlineSoonEnabled = settings.eventTypeEnabled[NotificationEventType.EVENT_DEADLINE_SOON] == true
                ).map { row -> SettingRow(row.title, row.body, row.checked) }
            )
        )
        binding.contentList.addView(noticeCard(MainUiPolicy.hubEventPolicyNotice()))
        binding.contentList.addView(noticeCard("공식 이미지, 로고, 포스터는 앱에 저장하거나 재사용하지 않습니다."))
    }

    private fun renderSettingsAdvanced() {
        val settings = repository.settings
        startScreen(
            screenId = "settings_advanced",
            title = "고급 조합 설정",
            role = "복잡한 예외 규칙은 필요할 때만 조정합니다."
        )
        binding.contentList.addView(
            settingsPanel(
                title = "조합 설정",
                rows = settings.combinationPreferences.map { preference ->
                    SettingRow(
                        title = preference.label,
                        body = "카테고리/개별 항목과 플랫폼/이벤트 타입을 함께 해석합니다.",
                        checked = preference.enabled
                    )
                }
            )
        )
        binding.contentList.addView(
            noticeCard("개별 명시 설정은 카테고리 설정을 덮어쓸 수 있습니다. 플랫폼, 이벤트 타입, 조용한 시간, 키워드, rate limit은 이후에도 계속 적용됩니다.")
        )
    }

    private fun httpsLinkRow(title: String, url: String?): SettingRow? {
        val value = url ?: return null
        return if (value.startsWith("https://")) SettingRow(title, value, null, "열기") else null
    }

    private fun settingsScreenForRow(screenId: String): HubScreen = when (screenId) {
        "delivery" -> HubScreen.SETTINGS_DELIVERY
        "targets" -> HubScreen.SETTINGS_TARGETS
        "platforms" -> HubScreen.SETTINGS_PLATFORMS
        "event_types" -> HubScreen.SETTINGS_EVENT_TYPES
        "hub_events" -> HubScreen.SETTINGS_HUB_EVENTS
        "advanced" -> HubScreen.SETTINGS_ADVANCED
        else -> HubScreen.SETTINGS
    }

    private fun settingsNavigationCard(row: SettingsHubRow): MaterialCardView =
        baseCard().apply {
            isClickable = true
            isFocusable = true
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            }
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(15), dp(15), dp(15), dp(15))
            }
            content.addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(context).apply {
                    text = row.title
                    setTextColor(color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                })
                addView(TextView(context).apply {
                    text = row.body
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, dp(5), 0, 0)
                    setLineSpacing(0f, 1.1f)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = dp(12)
            })
            content.addView(TextView(context).apply {
                text = "${row.value} ›"
                setTextColor(color(R.color.hub_text_muted))
                textSize = 13f
                typeface = Typeface.DEFAULT_BOLD
            })
            addView(content)
            setOnClickListener {
                navigateTo(settingsScreenForRow(row.screenId), addToBackStack = true)
            }
        }

    private fun appearanceModePanel(): MaterialCardView =
        baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(12)
            }
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(15), dp(15), dp(15), dp(15))
            }
            content.addView(TextView(context).apply {
                text = "화면 모드"
                setTextColor(color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(0, 0, 0, dp(8))
            })
            content.addView(TextView(context).apply {
                text = "자동은 기기의 시스템 설정을 따릅니다."
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(0, 0, 0, dp(10))
            })
            content.addView(ChipGroup(context).apply {
                isSingleSelection = true
                addView(appearanceModeChip(AppearanceMode.SYSTEM, "자동"))
                addView(appearanceModeChip(AppearanceMode.LIGHT, "라이트"))
                addView(appearanceModeChip(AppearanceMode.DARK, "다크"))
            })
            addView(content)
        }

    private fun debugModePanel(): MaterialCardView =
        baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(12)
            }

            val content = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(15), dp(15), dp(15), dp(15))
            }

            content.addView(
                LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(context).apply {
                        text = "디버그 모드"
                        setTextColor(color(R.color.hub_text))
                        textSize = 15f
                        typeface = Typeface.DEFAULT_BOLD
                    })
                    addView(TextView(context).apply {
                        text = "켜면 이 설정 화면에 서버 연결 상태 로그를 임시로 표시합니다."
                        setTextColor(color(R.color.hub_text_muted))
                        textSize = 12f
                        setPadding(0, dp(6), 0, 0)
                    })
                },
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginEnd = dp(12)
                }
            )

            content.addView(SwitchMaterial(context).apply {
                isChecked = debugModeEnabled
                setOnCheckedChangeListener { _, checked ->
                    debugModeEnabled = checked
                    recordServerConnectionLog(
                        if (checked) "debug: 서버 연결 로그 표시 켜짐" else "debug: 서버 연결 로그 표시 꺼짐"
                    )
                    renderSettings()
                }
            })

            addView(content)
        }

    private fun appearanceModeChip(mode: AppearanceMode, label: String): Chip =
        Chip(this).apply {
            text = label
            isCheckable = true
            isChecked = selectedAppearanceMode == mode
            setTextColor(if (isChecked) color(R.color.hub_primary) else color(R.color.hub_text))
            chipStrokeWidth = dp(1).toFloat()
            chipStrokeColor = ContextCompat.getColorStateList(context, R.color.hub_line)
            chipBackgroundColor = ContextCompat.getColorStateList(
                context,
                if (isChecked) R.color.hub_accent_soft else R.color.hub_card
            )
            setOnClickListener {
                if (selectedAppearanceMode != mode) {
                    selectedAppearanceMode = mode
                    writeAppearanceMode(mode)
                    AppCompatDelegate.setDefaultNightMode(mode.toNightMode())
                    renderSettings()
                }
            }
        }

    private fun readAppearanceMode(): AppearanceMode {
        val value = getSharedPreferences("hub_preferences", Context.MODE_PRIVATE)
            .getString(PreferenceKeys.APPEARANCE_MODE, AppearanceMode.SYSTEM.name)
        return AppearanceMode.entries.firstOrNull { it.name == value } ?: AppearanceMode.SYSTEM
    }

    private fun writeAppearanceMode(mode: AppearanceMode) {
        getSharedPreferences("hub_preferences", Context.MODE_PRIVATE)
            .edit()
            .putString(PreferenceKeys.APPEARANCE_MODE, mode.name)
            .apply()
    }

    private fun readLiveMemberPriorityIds(): List<String> =
        getSharedPreferences("hub_preferences", Context.MODE_PRIVATE)
            .getString(PreferenceKeys.LIVE_MEMBER_ORDER, null)
            ?.split(",")
            ?.map { it.trim() }
            ?.filter { it.isNotBlank() }
            ?: emptyList()

private fun writeLiveMemberPriorityIds(ids: List<String>) {
    liveMemberPriorityIds = ids
    getSharedPreferences("hub_preferences", Context.MODE_PRIVATE)
        .edit()
        .putString(PreferenceKeys.LIVE_MEMBER_ORDER, ids.joinToString(","))
        .apply()
}

private fun moveLiveMember(fromIndex: Int, toIndex: Int) {
    val members = liveStatusFilteredMembersForUi()
    writeLiveMemberPriorityIds(
        LiveMemberOrderingPolicy.movedPriority(
            priorityMemberIds = liveMemberPriorityIds,
            orderedMembers = members,
            fromIndex = fromIndex,
            toIndex = toIndex,
        ),
    )
    renderLive()
}

private fun moveLiveMember(member: HubMember, offset: Int) {
    val members = liveStatusFilteredMembersForUi()
    val index = members.indexOfFirst { it.id == member.id }
    if (index == -1) return
    moveLiveMember(index, index + offset)
}

    private fun registerLiveClockTextView(startedAt: Instant, textView: TextView) {
        liveClockTextViews += LiveClockTextView(startedAt, textView)
        scheduleLiveClockRefresh()
    }

    private fun scheduleLiveClockRefresh() {
        liveClockHandler.removeCallbacks(liveClockTicker)
        val delay = MainUiPolicy.liveClockRefreshDelayMillis(
            screenId = navigationHistory.currentScreen.id,
            hasLiveMembers = liveClockTextViews.isNotEmpty(),
        ) ?: return
        liveClockHandler.postDelayed(liveClockTicker, delay)
    }

    private fun updateLiveClockTextViews() {
        liveClockTextViews.forEach { item ->
            item.textView.text = MainUiPolicy.liveElapsedClockText(item.startedAt).orEmpty()
        }
    }

    private fun updateTopBarScrolled(scrolled: Boolean) {
        val alpha = if (scrolled) 1f else 0f
        binding.collapsedTitle.alpha = alpha
        binding.collapsedRole.alpha = alpha
        binding.topBarDivider.alpha = alpha
        binding.topBar.elevation = 0f
        updateTopBarGlass(scrolled)
    }

    private fun configureTopBarGlass() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars =
            resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK !=
                Configuration.UI_MODE_NIGHT_YES
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            systemTopInsetPx = bars.top
            binding.topGlassOverlay.setPadding(0, bars.top, 0, 0)
            binding.mainContent.setPadding(0, 0, 0, bars.bottom)
            applyContentTopPadding(underTopBar = navigationHistory.currentScreen == HubScreen.GOODS_EVENT_DETAIL)
            insets
        }
        ViewCompat.requestApplyInsets(binding.root)
        updateTopBarGlass(scrolled = false)
    }

    private fun updateTopBarGlass(scrolled: Boolean) {
        window.statusBarColor = Color.TRANSPARENT
    }

    private fun screenTitle(text: String): TextView = TextView(this).apply {
        this.text = text
        setTextColor(color(R.color.hub_text))
        textSize = 26f
        typeface = Typeface.DEFAULT_BOLD
        includeFontPadding = false
        setPadding(0, 0, 0, dp(8))
    }

    private fun screenCopy(text: String): TextView = TextView(this).apply {
        this.text = text
        setTextColor(color(R.color.hub_text_muted))
        textSize = 13f
        setLineSpacing(0f, 1.12f)
        setPadding(0, 0, 0, dp(16))
    }

    private fun sectionLabel(text: String): TextView = TextView(this).apply {
        this.text = text
        setTextColor(color(R.color.hub_text_muted))
        textSize = 13f
        typeface = Typeface.DEFAULT_BOLD
        setPadding(0, dp(4), 0, dp(8))
    }

    private fun summaryGrid(items: List<StatusSummaryItem>): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 0, 0, dp(12))
        }
        items.chunked(2).forEach { rowItems ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, 0, 0, dp(10))
            }
            rowItems.forEachIndexed { index, item ->
                row.addView(
                    summaryCard(item),
                    LinearLayout.LayoutParams(0, dp(84), 1f).apply {
                        if (index == 0) marginEnd = dp(10) else marginStart = 0
                    }
                )
            }
            container.addView(row)
        }
        return container
    }

    private fun summaryCard(item: StatusSummaryItem): MaterialCardView =
        baseCard().apply {
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(13), dp(13), dp(13), dp(13))
            }
            content.addView(TextView(context).apply {
                text = item.value
                setTextColor(color(R.color.hub_text))
                textSize = 24f
                typeface = Typeface.DEFAULT_BOLD
                includeFontPadding = false
            })
            content.addView(TextView(context).apply {
                text = item.label
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(0, dp(7), 0, 0)
            })
            addView(content)
        }

    private fun filterChips(): HorizontalScrollView =
        chipsContainer(repository.filters.map { filter ->
            Chip(this).apply {
                text = filter.displayName
                isCheckable = true
                isChecked = filter.id == selectedFilter
                setTextColor(if (isChecked) color(R.color.hub_primary) else color(R.color.hub_text))
                chipStrokeWidth = dp(1).toFloat()
                chipStrokeColor = ContextCompat.getColorStateList(context, R.color.hub_line)
                chipBackgroundColor = ContextCompat.getColorStateList(
                    context,
                    if (isChecked) R.color.hub_accent_soft else R.color.hub_card
                )
                setOnClickListener {
                    selectedFilter = filter.id
                    renderHome()
                }
            }
        })

    private fun staticChips(vararg labels: String): HorizontalScrollView =
        chipsContainer(labels.mapIndexed { index, label ->
            Chip(this).apply {
                text = label
                isCheckable = false
                chipStrokeWidth = dp(1).toFloat()
                chipStrokeColor = ContextCompat.getColorStateList(context, R.color.hub_line)
                chipBackgroundColor = ContextCompat.getColorStateList(
                    context,
                    if (index == 0) R.color.hub_accent_soft else R.color.hub_card
                )
            }
        })

    private fun liveStatusChips(): HorizontalScrollView {
        val filters = listOf(
            "live" to "방송 중",
            "all" to "전체",
            "offline" to "오프라인"
        )
        return chipsContainer(filters.map { (id, label) ->
            Chip(this).apply {
                text = label
                isCheckable = true
                isChecked = id == selectedLiveStatusFilter
                chipStrokeWidth = dp(1).toFloat()
                chipStrokeColor = ContextCompat.getColorStateList(context, R.color.hub_line)
                chipBackgroundColor = ContextCompat.getColorStateList(
                    context,
                    if (isChecked) R.color.hub_accent_soft else R.color.hub_card
                )
                setOnClickListener {
                    selectedLiveStatusFilter = id
                    renderLive()
                }
            }
        })
    }

    private fun chipsContainer(chips: List<Chip>): HorizontalScrollView =
        HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            setPadding(0, 0, 0, dp(14))
            addView(ChipGroup(context).apply {
                isSingleSelection = true
                setPadding(0, 0, dp(18), 0)
                chips.forEach { addView(it) }
            })
        }

    private fun noticeCard(text: String): TextView = TextView(this).apply {
        this.text = text
        setTextColor(color(R.color.hub_warning))
        textSize = 12f
        setLineSpacing(0f, 1.12f)
        background = rounded(color(R.color.hub_warning_soft), dp(8), color(R.color.hub_secondary))
        setPadding(dp(13), dp(12), dp(13), dp(12))
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(14)
        }
    }

    private fun memberCard(member: HubMember): MaterialCardView =
        baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            }
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.TOP
                setPadding(dp(14), dp(14), dp(14), dp(14))
            }
            row.addView(memberAvatar(member, dp(46)), LinearLayout.LayoutParams(dp(46), dp(46)))
            row.addView(memberTextBlock(member), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = dp(12)
                marginEnd = dp(10)
            })
            row.addView(statusBadge(memberStatus(member), member.isLive))
            addView(row)
        }

    private fun memberAvatar(member: HubMember, size: Int, showsLiveIndicator: Boolean = false): FrameLayout =
        FrameLayout(this).apply {
            addView(
                avatarText(member, size),
                FrameLayout.LayoutParams(size, size)
            )
            member.channelImageUrl?.takeIf { it.startsWith("https://") }?.let { imageUrl ->
                addView(
                    channelImageAvatar(imageUrl, size),
                    FrameLayout.LayoutParams(size, size)
                )
            }
            if (showsLiveIndicator && member.isLive) {
                addView(liveIndicator(size), FrameLayout.LayoutParams(dp(12), dp(12), Gravity.BOTTOM or Gravity.END))
            }
        }

    private fun channelImageAvatar(imageUrl: String, size: Int): ImageView =
        ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = rounded(fill = color(R.color.hub_primary), radius = size / 2)
            clipToOutline = true
            thread {
                runCatching {
                    URL(imageUrl).openStream().use { BitmapFactory.decodeStream(it) }
                }.getOrNull()?.let { bitmap ->
                    runOnUiThread { setImageBitmap(bitmap) }
                }
            }
        }

    private fun avatarText(member: HubMember, size: Int): TextView = TextView(this).apply {
        text = when (member.catalogRole) {
            CatalogRole.OFFICIAL_CHANNEL -> "공식"
            else -> member.koreanName.take(2)
        }
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
        textSize = if (size <= dp(42)) 12f else 13f
        typeface = Typeface.DEFAULT_BOLD
        background = rounded(
            fill = if (member.catalogRole == CatalogRole.OFFICIAL_CHANNEL) Color.rgb(77, 95, 102) else color(R.color.hub_primary),
            radius = if (member.catalogRole == CatalogRole.OFFICIAL_CHANNEL) dp(8) else size / 2
        )
    }

    private fun memberTextBlock(member: HubMember): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        addView(TextView(context).apply {
            text = member.koreanName
            setTextColor(color(R.color.hub_text))
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
        })
        addView(TextView(context).apply {
            text = listOfNotNull(member.generationName, member.roleLabel ?: "멤버", "placeholder avatar").joinToString(" · ")
            setTextColor(color(R.color.hub_text_muted))
            textSize = 12f
        })
        addView(pillRow(platformLabels(member)))
        addView(TextView(context).apply {
            text = memberPolicy(member)
            setTextColor(color(R.color.hub_text_muted))
            textSize = 12f
            setPadding(0, dp(7), 0, 0)
        })
    }

    private fun platformLabels(member: HubMember): List<String> {
        val labels = mutableListOf<String>()
        if (member.chzzkChannelId != null) labels += "CHZZK"
        if (member.youtubeHandle != null) labels += if (member.catalogRole == CatalogRole.OFFICIAL_CHANNEL) "공식 YouTube 업로드" else "YouTube"
        if (member.xHandle != null) labels += if (member.xHandle == "verify_required") "X 확인 필요" else if (member.catalogRole == CatalogRole.OFFICIAL_CHANNEL) "공식 X 게시글" else "X"
        if (member.catalogRole == CatalogRole.OFFICIAL_CHANNEL) labels += "YouTube LIVE 제외"
        return labels
    }

    private fun memberPolicy(member: HubMember): String = when (member.catalogRole) {
        CatalogRole.REPRESENTATIVE -> "감자 카테고리와 개별 대표 설정을 분리해서 제어"
        CatalogRole.OFFICIAL_CHANNEL -> "공식 채널 알림 ON · 실시간 best-effort 가능"
        CatalogRole.PLACEHOLDER -> "upcoming 기본 OFF · 사용자가 명시적으로 켤 수 있음"
        CatalogRole.MEMBER -> if (member.realtimeEnabled) {
            "개별 알림 ON · realtime_best_effort ON · 사용자 설정 적용 후 전송"
        } else {
            "표준 전달 · 플랫폼별 OFF가 있으면 푸시 차단"
        }
    }

    private fun memberStatus(member: HubMember): String = when {
        member.catalogRole == CatalogRole.OFFICIAL_CHANNEL -> "제한"
        member.isLive -> "LIVE"
        else -> "OFFLINE"
    }

    private fun statusBadge(text: String, positive: Boolean): TextView = TextView(this).apply {
        this.text = text
        setTextColor(if (positive) color(R.color.hub_success) else color(R.color.hub_text_muted))
        textSize = 11f
        typeface = Typeface.DEFAULT_BOLD
        includeFontPadding = false
        background = rounded(
            fill = if (positive) color(R.color.hub_success_soft) else color(R.color.hub_surface),
            radius = dp(14),
            stroke = if (positive) color(R.color.hub_success) else color(R.color.hub_line)
        )
        setPadding(dp(8), dp(5), dp(8), dp(5))
    }

    private fun liveMemberRow(member: HubMember, showOrderControls: Boolean = false): MaterialCardView =
        baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            }
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(13), dp(13), dp(13), dp(13))
            }
            row.addView(memberAvatar(member, dp(42), showsLiveIndicator = true), LinearLayout.LayoutParams(dp(42), dp(42)))
            row.addView(liveMemberTextBlock(member), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = dp(12)
                marginEnd = dp(10)
            })
            row.addView(liveMemberStatusBlock(member))
            if (showOrderControls) {
                row.addView(liveOrderControl(member), LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    marginStart = dp(8)
                })
            }
            addView(row)
        }

    private fun liveOrderControl(member: HubMember): LinearLayout =
        LinearLayout(this).apply {
            val orderedMembers = liveStatusFilteredMembersForUi()
            val currentIndex = orderedMembers.indexOfFirst { it.id == member.id }
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            contentDescription = "${member.koreanName}, ${currentIndex + 1}번째, 길게 눌러 순서 변경"

            addView(
                TextView(context).apply {
                    text = "≡"
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 18f
                    typeface = Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    includeFontPadding = false
                    setPadding(dp(8), dp(6), dp(8), dp(6))
                    background = rounded(
                        fill = color(R.color.hub_success_soft),
                        radius = dp(10),
                    )
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    )
                },
            )
            setOnLongClickListener {
                if (currentIndex == -1) return@setOnLongClickListener false
                draggingLiveMemberId = member.id
                val payload = ClipData.newPlainText("live-member-id", member.id)
                val shadow = View.DragShadowBuilder(this)
                startDragAndDrop(payload, shadow, LiveDragPayload(member.id, currentIndex), 0)
                performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
                true
            }
            setOnDragListener { _, event ->
                when (event.action) {
                    DragEvent.ACTION_DRAG_STARTED -> event.localState is LiveDragPayload
                    DragEvent.ACTION_DRAG_ENTERED -> {
                        alpha = 0.72f
                        true
                    }
                    DragEvent.ACTION_DRAG_EXITED -> {
                        alpha = 1f
                        true
                    }
                    DragEvent.ACTION_DROP -> {
                        val payload = event.localState as? LiveDragPayload ?: return@setOnDragListener false
                        if (payload.memberId != member.id && currentIndex != -1) {
                            moveLiveMember(payload.fromIndex, currentIndex)
                        }
                        true
                    }
                    DragEvent.ACTION_DRAG_ENDED -> {
                        alpha = 1f
                        draggingLiveMemberId = null
                        true
                    }
                    else -> true
                }
            }
            accessibilityDelegate = object : View.AccessibilityDelegate() {
                override fun onInitializeAccessibilityNodeInfo(
                    host: View,
                    info: android.view.accessibility.AccessibilityNodeInfo,
                ) {
                    super.onInitializeAccessibilityNodeInfo(host, info)
                    info.addAction(
                        android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction(
                            android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD,
                            "위로 이동",
                        ),
                    )
                    info.addAction(
                        android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction(
                            android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_FORWARD,
                            "아래로 이동",
                        ),
                    )
                }

                override fun performAccessibilityAction(host: View, action: Int, args: Bundle?): Boolean =
                    when (action) {
                        android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD -> {
                            moveLiveMember(member, -1)
                            true
                        }
                        android.view.accessibility.AccessibilityNodeInfo.ACTION_SCROLL_FORWARD -> {
                            moveLiveMember(member, 1)
                            true
                        }
                        else -> super.performAccessibilityAction(host, action, args)
                    }
            }
        }

    private fun liveMemberTextBlock(member: HubMember): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        addView(TextView(context).apply {
            text = member.koreanName
            setTextColor(color(R.color.hub_text))
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setLineSpacing(0f, 1.08f)
        })
        addView(TextView(context).apply {
            text = "${member.generationName} · ${member.unitName}"
            setTextColor(color(R.color.hub_text_muted))
            textSize = 11f
            setPadding(0, dp(3), 0, 0)
        })
        addView(TextView(context).apply {
            text = if (member.isLive) MainUiPolicy.liveTitleText(member.liveTitle) else MainUiPolicy.liveStatusText(member.isLive, member.liveStartedAt)
            setTextColor(if (member.isLive) color(R.color.hub_text) else color(R.color.hub_text_muted))
            textSize = if (member.isLive) 13f else 12f
            typeface = if (member.isLive) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            setPadding(0, dp(6), 0, 0)
            setLineSpacing(0f, 1.1f)
        })
        if (member.isLive) {
            member.livePlatformUrl?.takeIf { it.startsWith("https://") }?.let { url ->
                addView(Chip(context).apply {
                    text = "CHZZK 열기"
                    isCheckable = false
                    chipMinHeight = dp(28).toFloat()
                    textSize = 12f
                    typeface = Typeface.DEFAULT_BOLD
                    chipBackgroundColor = ContextCompat.getColorStateList(context, R.color.hub_success_soft)
                    setTextColor(color(R.color.hub_primary))
                    setOnClickListener {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    }
                }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = dp(4)
                })
            }
        }
    }

    private fun liveIndicator(size: Int): View = View(this).apply {
        background = rounded(
            fill = color(R.color.hub_success),
            radius = size / 2,
            stroke = color(R.color.hub_card)
        )
    }

    private fun liveMemberStatusBlock(member: HubMember): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.END
        addView(statusBadge(if (member.isLive) "LIVE" else "OFF", member.isLive))
        if (member.isLive) {
            MainUiPolicy.liveElapsedClockText(member.liveStartedAt)?.let { elapsed ->
                addView(liveSideMetricRow(R.drawable.ic_metric_clock, elapsed, color(R.color.hub_text_muted), member.liveStartedAt))
            }
            MainUiPolicy.viewerCountText(member.liveViewerCount)?.let { viewers ->
                addView(liveSideMetricRow(R.drawable.ic_metric_viewers, viewers, color(R.color.hub_primary)))
            }
        }
    }

    private fun liveSideMetricRow(iconResId: Int, value: String, valueColor: Int, liveStartedAt: Instant? = null): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            setPadding(0, dp(5), 0, 0)
            addView(ImageView(context).apply {
                setImageResource(iconResId)
                setColorFilter(valueColor)
                contentDescription = null
            }, LinearLayout.LayoutParams(dp(12), dp(12)))
            val valueView = TextView(context).apply {
                text = value
                setTextColor(valueColor)
                textSize = 11f
                typeface = Typeface.DEFAULT_BOLD
            }
            addView(valueView, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                marginStart = dp(4)
            })
            liveStartedAt?.let { registerLiveClockTextView(it, valueView) }
        }

private fun View.withDetailHorizontalMargins(): View {
    val params = (layoutParams as? LinearLayout.LayoutParams)
        ?: LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
            )
        params.leftMargin = dp(18)
        params.rightMargin = dp(18)
    layoutParams = params
    return this
}

private fun View.withGoodsEventsNoticeTopMargin(): View {
    val params = (layoutParams as? LinearLayout.LayoutParams)
        ?: LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )
    params.topMargin = dp(8)
    layoutParams = params
    return this
}

private fun hubEventDetailHero(event: dev.stellive.hub.core.model.HubEvent): FrameLayout =
        FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                systemTopInsetPx + dp(338)
            ).apply {
                leftMargin = 0
                rightMargin = 0
                bottomMargin = dp(8)
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
                thread {
                    val bitmap = runCatching {
                        URL(imageUrl).openStream().use(BitmapFactory::decodeStream)
                    }.getOrNull()
                    runOnUiThread {
                        if (bitmap != null) {
                            imageView.setImageBitmap(bitmap)
                            imageView.visibility = View.VISIBLE
                        }
                    }
                }
            }

            addView(
                View(context).apply {
                    background = GradientDrawable(
                        GradientDrawable.Orientation.TOP_BOTTOM,
                        intArrayOf(Color.TRANSPARENT, Color.argb(184, 0, 0, 0))
                    )
                },
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            )

            addView(
                LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(dp(18), 0, dp(18), dp(10))
                    addView(TextView(context).apply {
                        text = event.category.displayName
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        )
                        setTextColor(Color.WHITE)
                        textSize = 12f
                        typeface = Typeface.DEFAULT_BOLD
                        background = rounded(Color.argb(46, 255, 255, 255), dp(12))
                        setPadding(dp(8), dp(4), dp(8), dp(4))
                    })
                    addView(TextView(context).apply {
                        text = event.title
                        setTextColor(Color.WHITE)
                        textSize = 25f
                        typeface = Typeface.DEFAULT_BOLD
                        setPadding(0, dp(10), 0, 0)
                        setLineSpacing(0f, 1.06f)
                    })
                    addView(TextView(context).apply {
                        text = listOfNotNull(event.venueName, HubEventDetailFormatting.rows(event).firstOrNull { it.label == "기간" }?.value)
                            .joinToString(" · ")
                            .ifBlank { event.sourceLabel }
                        setTextColor(Color.argb(214, 255, 255, 255))
                        textSize = 13f
                        typeface = Typeface.DEFAULT_BOLD
                        setPadding(0, dp(7), 0, 0)
                    })
                },
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.BOTTOM or Gravity.START
                )
            )
        }

    private fun hubEventDetailActions(event: HubEvent): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            leftMargin = dp(18)
            rightMargin = dp(18)
            bottomMargin = dp(12)
        }

        addView(
            detailActionButton("캘린더 추가", primary = true) {
                openCalendarInsert(event)
            },
            LinearLayout.LayoutParams(0, dp(50), 1f).apply {
                marginEnd = dp(5)
            }
        )
        addView(
            detailActionButton("티켓 링크", primary = false) {
                openExternalUrl(event.ticketUrl ?: event.purchaseUrl ?: event.sourceUrl)
            },
            LinearLayout.LayoutParams(0, dp(50), 1f).apply {
                marginStart = dp(5)
            }
        )
    }

    private fun detailActionButton(label: String, primary: Boolean, onClick: () -> Unit): TextView =
        TextView(this).apply {
            text = label
            gravity = Gravity.CENTER
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(if (primary) Color.WHITE else color(R.color.hub_text))
            background = rounded(
                fill = if (primary) color(R.color.hub_primary) else color(R.color.hub_surface),
                radius = dp(14),
                stroke = if (primary) null else color(R.color.hub_line)
            )
            setOnClickListener { onClick() }
        }

    private fun openCalendarInsert(event: HubEvent) {
        val intent = Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, event.title)
            .putExtra(CalendarContract.Events.EVENT_LOCATION, event.venueName)
            .putExtra(CalendarContract.Events.DESCRIPTION, event.summary ?: event.sourceLabel)
        event.startsAt?.let { intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, it.toEpochMilli()) }
        event.endsAt?.let { intent.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, it.toEpochMilli()) }
        startActivity(intent)
    }

    private fun openExternalUrl(url: String?) {
        val target = url?.takeIf { it.startsWith("https://") || it.startsWith("http://") } ?: return
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target)))
    }

    private fun compactEventCard(title: String, body: String, pills: List<String>, thumbnailUrl: String? = null): MaterialCardView =
        baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            }
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(13), dp(13), dp(13), dp(13))
            }
            thumbnailUrl?.let { content.addView(hubEventThumbnail(it)) }
            content.addView(TextView(context).apply {
                text = title
                setTextColor(color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
            })
            content.addView(TextView(context).apply {
                text = body
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(0, dp(6), 0, 0)
            })
        content.addView(pillRow(pills))
        addView(content)
    }

    private fun targetToggleCard(
        title: String,
        body: String,
        checked: Boolean,
        onCheckedChange: (Boolean) -> Unit
    ): MaterialCardView =
        baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            }

            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(13), dp(13), dp(13), dp(13))

                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(context).apply {
                        text = title
                        setTextColor(color(R.color.hub_text))
                        textSize = 15f
                        typeface = Typeface.DEFAULT_BOLD
                    })
                    addView(TextView(context).apply {
                        text = body
                        setTextColor(color(R.color.hub_text_muted))
                        textSize = 12f
                        setPadding(0, dp(6), 0, 0)
                    })
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginEnd = dp(12)
                })

                addView(SwitchMaterial(context).apply {
                    isChecked = checked
                    setOnCheckedChangeListener { _, isChecked ->
                        onCheckedChange(isChecked)
                    }
                })
            })
        }

    private fun hubEventThumbnail(imageUrl: String): ImageView =
        ImageView(this).apply {
            visibility = View.GONE
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = rounded(color(R.color.hub_surface), dp(10))
            clipToOutline = true
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(128)).apply {
                bottomMargin = dp(10)
            }
            thread {
                val bitmap = runCatching {
                    URL(imageUrl).openStream().use(BitmapFactory::decodeStream)
                }.getOrNull()
                runOnUiThread {
                    if (bitmap != null) {
                        setImageBitmap(bitmap)
                        visibility = View.VISIBLE
                    } else {
                        visibility = View.GONE
                    }
                }
            }
        }

    private fun hubEventCard(event: dev.stellive.hub.core.model.HubEvent): MaterialCardView =
        compactEventCard(
            title = event.title,
            body = listOfNotNull(event.status.displayName, event.sourceLabel, event.venueName).joinToString(" · "),
            pills = listOf(event.category.displayName, event.participationMode.displayName),
            thumbnailUrl = event.image?.takeIf(HubEventImagePolicy::canDisplay)?.url
        ).apply {
            isClickable = true
            isFocusable = true
            setOnClickListener {
                selectedHubEventId = event.id
                navigateTo(HubScreen.GOODS_EVENT_DETAIL, addToBackStack = true)
            }
        }

    private fun historyEventCard(item: NotificationHistoryItem, member: HubMember?): MaterialCardView =
        baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            }
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.TOP
                setPadding(dp(13), dp(13), dp(13), dp(13))
            }
            if (member != null) {
                row.addView(memberAvatar(member, dp(42)), LinearLayout.LayoutParams(dp(42), dp(42)))
            } else {
                row.addView(historyFallbackAvatar(item.memberName), LinearLayout.LayoutParams(dp(42), dp(42)))
            }
            row.addView(historyTextBlock(item), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = dp(12)
            })
            addView(row)
        }

    private fun historyFallbackAvatar(memberName: String): TextView = TextView(this).apply {
        text = memberName.take(2).ifBlank { "?" }
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
        textSize = 14f
        typeface = Typeface.DEFAULT_BOLD
        background = rounded(
            fill = color(R.color.hub_text_subtle),
            radius = dp(21)
        )
    }

    private fun historyTextBlock(item: NotificationHistoryItem): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        addView(TextView(context).apply {
            text = item.title
            setTextColor(color(R.color.hub_text))
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setLineSpacing(0f, 1.08f)
        })
        addView(TextView(context).apply {
            text = item.body
            setTextColor(color(R.color.hub_text_muted))
            textSize = 12f
            setPadding(0, dp(5), 0, 0)
            setLineSpacing(0f, 1.12f)
        })
        addView(pillRow(listOf(item.eventType, item.deliveryMode.name.lowercase(), "${item.deliveryLatencyMs ?: "-"}ms")))
    }

    private fun settingsPanel(title: String, rows: List<SettingRow>): MaterialCardView =
        baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(12)
            }
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(15), dp(15), dp(15), dp(15))
            }
            content.addView(TextView(context).apply {
                text = title
                setTextColor(color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(0, 0, 0, dp(10))
            })
            rows.forEachIndexed { index, row ->
                if (index > 0) content.addView(divider())
                content.addView(settingRowView(row))
            }
            addView(content)
        }

    private fun historyFilterPanel(rows: List<HistoryFilterSelectorRow>): MaterialCardView =
        baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(12)
            }
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(15), dp(15), dp(15), dp(15))
            }
            content.addView(TextView(context).apply {
                text = "보기 필터"
                setTextColor(color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(0, 0, 0, dp(10))
            })
            rows.forEachIndexed { index, row ->
                if (index > 0) content.addView(divider())
                content.addView(historyFilterSelectorRowView(row))
            }
            addView(content)
        }

    private fun historyFilterSelectorRowView(row: HistoryFilterSelectorRow): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(0, dp(10), 0, dp(10))
        isClickable = true
        isFocusable = true
        setOnClickListener { row.onClick() }
        addView(TextView(context).apply {
            text = row.title
            setTextColor(color(R.color.hub_text))
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginEnd = dp(12)
        })
        addView(TextView(context).apply {
            text = row.selectedValue
            setTextColor(color(R.color.hub_text_muted))
            textSize = 13f
            maxLines = 1
        })
    }

    private fun showHistoryFilterDialog(
        title: String,
        options: List<Pair<String, String>>,
        selectedId: String,
        onSelected: (String) -> Unit
    ) {
        val selectedIndex = options.indexOfFirst { it.first == selectedId }.coerceAtLeast(0)
        AlertDialog.Builder(this)
            .setTitle(title)
            .setSingleChoiceItems(
                options.map { it.second }.toTypedArray(),
                selectedIndex
            ) { dialog, which ->
                onSelected(options[which].first)
                dialog.dismiss()
            }
            .setNegativeButton("취소", null)
            .show()
    }

    private fun settingRowView(row: SettingRow): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(0, dp(10), 0, dp(10))
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(context).apply {
                text = row.title
                setTextColor(color(R.color.hub_text))
                textSize = 14f
                typeface = Typeface.DEFAULT_BOLD
            })
            row.body?.takeIf { it.isNotBlank() }?.let { body ->
                addView(TextView(context).apply {
                    text = body
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 12f
                    setLineSpacing(0f, 1.1f)
                })
            }
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginEnd = dp(12)
        })
        if (row.checked != null) {
            addView(SwitchMaterial(context).apply {
                isChecked = row.checked
            })
        } else if (row.badge != null) {
            addView(pill(row.badge, true))
        }
    }

    private fun pillRow(labels: List<String>): ChipGroup = ChipGroup(this).apply {
        setPadding(0, dp(8), 0, 0)
        isSingleLine = false
        labels.forEach { label ->
            addView(rowChip(label))
        }
    }

    private fun rowChip(text: String): Chip = Chip(this).apply {
        this.text = text
        val isWarning = text.contains("필터") || text.contains("확인")
        val isOff = text.contains("OFF") || text.contains("제외") || text.contains("unsupported")
        val isGood = text.contains("LIVE") || text.contains("CHZZK") || text.contains("YouTube") || text.contains("X")
        isCheckable = false
        isClickable = false
        setEnsureMinTouchTargetSize(false)
        setTextColor(
            when {
                isWarning -> color(R.color.hub_warning)
                isOff -> color(R.color.hub_text_subtle)
                isGood -> color(R.color.hub_success)
                else -> color(R.color.hub_text_muted)
            }
        )
        textSize = 11f
        typeface = Typeface.DEFAULT_BOLD
        chipStrokeWidth = dp(1).toFloat()
        chipStrokeColor = ContextCompat.getColorStateList(context, R.color.hub_line)
        chipBackgroundColor = ContextCompat.getColorStateList(
            context,
            when {
                isWarning -> R.color.hub_warning_soft
                isOff -> R.color.hub_surface
                isGood -> R.color.hub_success_soft
                else -> R.color.hub_card
            }
        )
    }

    private fun pill(text: String, good: Boolean): TextView = TextView(this).apply {
        this.text = text
        val isWarning = text.contains("필터") || text.contains("확인")
        val isOff = text.contains("OFF") || text.contains("제외") || text.contains("unsupported")
        setTextColor(
            when {
                isWarning -> color(R.color.hub_warning)
                isOff -> color(R.color.hub_text_subtle)
                good -> color(R.color.hub_success)
                else -> color(R.color.hub_text_muted)
            }
        )
        textSize = 11f
        typeface = Typeface.DEFAULT_BOLD
        background = rounded(
            fill = when {
                isWarning -> color(R.color.hub_warning_soft)
                isOff -> color(R.color.hub_surface)
                good -> color(R.color.hub_success_soft)
                else -> color(R.color.hub_card)
            },
            radius = dp(14),
            stroke = color(R.color.hub_line)
        )
        setPadding(dp(8), dp(4), dp(8), dp(4))
    }

    private fun baseCard(): MaterialCardView = MaterialCardView(this).apply {
        radius = dp(8).toFloat()
        cardElevation = 0f
        setCardBackgroundColor(color(R.color.hub_card))
        strokeWidth = dp(1)
        strokeColor = color(R.color.hub_line)
    }

    private fun divider(): View = View(this).apply {
        setBackgroundColor(color(R.color.hub_line))
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
    }

    private fun rounded(fill: Int, radius: Int, stroke: Int? = null): GradientDrawable =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = radius.toFloat()
            if (stroke != null) setStroke(dp(1), stroke)
        }

    private fun color(id: Int): Int = ContextCompat.getColor(this, id)

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private data class SettingRow(
    val title: String,
    val body: String?,
    val checked: Boolean? = null,
    val badge: String? = null
)

private data class HistoryFilterSelectorRow(
    val title: String,
    val selectedValue: String,
    val onClick: () -> Unit
)

private fun AppearanceMode.toNightMode(): Int = when (this) {
    AppearanceMode.SYSTEM -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
    AppearanceMode.LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
    AppearanceMode.DARK -> AppCompatDelegate.MODE_NIGHT_YES
}
