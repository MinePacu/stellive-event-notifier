package dev.minepacu.stelliveeventnotifier

import android.Manifest
import android.app.AlertDialog
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.BitmapFactory
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.CalendarContract
import android.text.Editable
import android.text.TextUtils
import android.text.TextWatcher
import android.transition.AutoTransition
import android.transition.TransitionManager
import android.util.Log
import android.util.LruCache
import android.view.DragEvent
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ContextThemeWrapper
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import android.widget.ScrollView
import androidx.activity.OnBackPressedCallback
import androidx.activity.viewModels
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.appcompat.widget.PopupMenu
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.isVisible
import androidx.core.widget.NestedScrollView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import androidx.window.layout.WindowMetricsCalculator
import com.google.android.material.card.MaterialCardView
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.google.android.material.switchmaterial.SwitchMaterial
import com.google.android.material.snackbar.Snackbar
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.AndroidEntryPoint
import dev.minepacu.stelliveeventnotifier.core.device.DeviceIdStore
import dev.minepacu.stelliveeventnotifier.core.device.PushTokenSyncer
import dev.minepacu.stelliveeventnotifier.core.datastore.PreferenceKeys
import dev.minepacu.stelliveeventnotifier.core.model.AppearanceMode
import dev.minepacu.stelliveeventnotifier.core.model.CatalogRole
import dev.minepacu.stelliveeventnotifier.core.model.DeliveryMode
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarDay
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntry
import dev.minepacu.stelliveeventnotifier.core.model.HubCalendarEntryKind
import dev.minepacu.stelliveeventnotifier.core.model.HubEvent
import dev.minepacu.stelliveeventnotifier.core.model.HubMember
import dev.minepacu.stelliveeventnotifier.core.model.NotificationEventType
import dev.minepacu.stelliveeventnotifier.core.model.NotificationHistoryItem
import dev.minepacu.stelliveeventnotifier.core.model.NotificationPlatform
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationPermissionPromptMoment
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationPermissionPromptPolicy
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.core.model.AnnouncementsSummary
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncement
import dev.minepacu.stelliveeventnotifier.databinding.ActivityMainBinding
import dev.minepacu.stelliveeventnotifier.feature.calendar.HubCalendarDeepLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.calendar.CalendarUiPolicy
import dev.minepacu.stelliveeventnotifier.feature.calendar.HubEventsCalendarView
import dev.minepacu.stelliveeventnotifier.feature.home.HubScreen
import dev.minepacu.stelliveeventnotifier.feature.home.HubRepository
import dev.minepacu.stelliveeventnotifier.feature.home.LiveMemberOrderingPolicy
import dev.minepacu.stelliveeventnotifier.feature.home.LoadingPresentation
import dev.minepacu.stelliveeventnotifier.core.network.HubApiClient
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import dev.minepacu.stelliveeventnotifier.feature.home.SongListQueryKey
import dev.minepacu.stelliveeventnotifier.feature.home.SongScrollPosition
import dev.minepacu.stelliveeventnotifier.feature.home.SongFilterOption
import dev.minepacu.stelliveeventnotifier.feature.home.SongMemberFilterPolicy
import dev.minepacu.stelliveeventnotifier.feature.home.SongMemberFilterState
import dev.minepacu.stelliveeventnotifier.feature.home.SongMemberMatchMode
import dev.minepacu.stelliveeventnotifier.feature.home.SongParticipation
import dev.minepacu.stelliveeventnotifier.feature.home.MainNavigationHistory
import dev.minepacu.stelliveeventnotifier.feature.home.MainNavigationHistoryState
import dev.minepacu.stelliveeventnotifier.feature.home.MockHubRepository
import dev.minepacu.stelliveeventnotifier.feature.home.ServerHubRepository
import dev.minepacu.stelliveeventnotifier.feature.songs.SongIdentity
import dev.minepacu.stelliveeventnotifier.feature.songs.SongDetailBottomSheet
import dev.minepacu.stelliveeventnotifier.feature.songs.SongDetailPolicy
import dev.minepacu.stelliveeventnotifier.feature.songs.SongLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.songs.SongOpenPreferenceStore
import dev.minepacu.stelliveeventnotifier.feature.songs.SongOpenTarget
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailFormatting
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventHeroTagTone
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventImagePolicy
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventLinkCtaMode
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventLinksBottomSheet
import dev.minepacu.stelliveeventnotifier.feature.hubevents.GoodsEventSelectionMode
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventsPanePolicy
import dev.minepacu.stelliveeventnotifier.feature.announcements.AnnouncementDeepLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.announcements.AnnouncementPolicy
import dev.minepacu.stelliveeventnotifier.feature.announcements.AnnouncementReadStore
import dev.minepacu.stelliveeventnotifier.feature.songs.SongMemberSelectionMode
import dev.minepacu.stelliveeventnotifier.feature.songs.SongsPanePolicy
import dev.minepacu.stelliveeventnotifier.feature.songs.DataStoreSongFavoritesRepository
import dev.minepacu.stelliveeventnotifier.feature.songs.SongFavoritesRepository
import dev.minepacu.stelliveeventnotifier.feature.songs.DataStoreSongDiscoveryRepository
import dev.minepacu.stelliveeventnotifier.feature.songs.SongDiscoveryPolicy
import dev.minepacu.stelliveeventnotifier.feature.songs.SongDiscoveryRepository
import dev.minepacu.stelliveeventnotifier.feature.songs.SongDiscoveryStateV1
import dev.minepacu.stelliveeventnotifier.ui.components.HubSingleChoiceBottomSheet
import dev.minepacu.stelliveeventnotifier.ui.components.HubSingleChoiceOption
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID
import kotlin.concurrent.thread
import dev.minepacu.stelliveeventnotifier.feature.home.SettingsHubRow
import dev.minepacu.stelliveeventnotifier.feature.home.StatusSummaryItem
import dev.minepacu.stelliveeventnotifier.ui.chrome.MainScreenChromePolicy
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubAdaptivePolicy
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubAdaptiveSpec
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldFeature
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldOrientation
import dev.minepacu.stelliveeventnotifier.ui.adaptive.HubFoldState
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardFactory
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardStyle
import dev.minepacu.stelliveeventnotifier.ui.components.SectionHeaderView
import dev.minepacu.stelliveeventnotifier.ui.components.SettingsRowStyle
import dev.minepacu.stelliveeventnotifier.ui.components.SettingsRowView
import dev.minepacu.stelliveeventnotifier.ui.components.TopFilterGroup
import dev.minepacu.stelliveeventnotifier.ui.components.TopFilterOption
import dev.minepacu.stelliveeventnotifier.ui.navigation.ScreenNavigationMotion
import dev.minepacu.stelliveeventnotifier.ui.navigation.ScreenTransitionController
import dev.minepacu.stelliveeventnotifier.ui.navigation.ScreenTransitionPolicy
import dev.minepacu.stelliveeventnotifier.ui.navigation.ScreenTransitionReason
import dev.minepacu.stelliveeventnotifier.feature.reservations.data.RoomReservationRepository
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationActionPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraft
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDisplayPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDeepLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDeepLinkRoute
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEventSnapshot
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationExternalLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationLinkSource
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationListPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationRecord
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptDecision
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationStatus
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationURLPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.system.ReservationQuickAddActivity
import dev.minepacu.stelliveeventnotifier.feature.reservations.system.ReservationTileService
import dev.minepacu.stelliveeventnotifier.feature.reservations.system.ReservationSystemShortcutCoordinator

private const val EXIT_BACK_PRESS_INTERVAL_MS = 2_000L
private const val NAVIGATION_RAIL_WIDTH_DP = 80
private const val LARGE_SCREEN_CONTENT_MAX_WIDTH_DP = 760
private const val GOODS_EVENTS_TWO_PANE_CONTENT_MAX_WIDTH_DP = 1120
private const val SONGS_TWO_PANE_CONTENT_MAX_WIDTH_DP = 1080
private const val SETTINGS_TWO_PANE_CONTENT_MAX_WIDTH_DP = 1080
private const val GOODS_EVENTS_CALENDAR_EXPANDED_STATE = "goods_events_calendar_expanded"
private const val NAVIGATION_CURRENT_ROOT_STATE = "navigation_current_root"
private const val NAVIGATION_CURRENT_SCREEN_STATE = "navigation_current_screen"
private const val NAVIGATION_PREVIOUS_SCREENS_STATE = "navigation_previous_screens"
private const val CONTENT_SCROLL_Y_STATE = "content_scroll_y"

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
@Inject lateinit var reservationRepository: RoomReservationRepository
private data class LiveClockTextView(
    val startedAt: Instant,
    val textView: TextView,
)

private data class LiveDragPayload(
    val memberId: String,
    val fromIndex: Int,
)

private data class RootNavigationItem(
    val screen: HubScreen,
    val view: View,
)

private data class SongRenderState(
val catalogMembers: List<HubMember>,
val visibleSongs: List<SongCatalogItem>,
val displayedSongs: List<SongCatalogItem>,
val displayedCount: Int,
val totalFilteredCount: Int,
val remainingCount: Int,
)

private data class ScrollablePane(
    val scrollView: NestedScrollView,
    val content: LinearLayout,
)

private data class ReservationDateTimeInput(
    val field: EditText,
    var value: Instant?,
)

private data class SongPanes(val filter: ScrollablePane, val list: ScrollablePane)

private data class PendingScreenRefresh(
    val screen: HubScreen,
    val render: () -> Unit,
)

private enum class SongScrollSlot { SONGS_SINGLE, SONGS_TWO_PANE, SONG_SEARCH }

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

internal class SongBrowseSessionViewModel : ViewModel() {
    var generationId = "all"
    var type = "all"
    var libraryId = "all"
    var sortId = "publishedAt_desc"
    var memberFilter = SongMemberFilterState()
    var query = ""
    var visibleLimit = MainUiPolicy.SONG_PAGE_SIZE
    val positions: MutableMap<String, SongScrollPosition> = mutableMapOf()
}

private lateinit var binding: ActivityMainBinding
    private val repository = MockHubRepository()
    private lateinit var serverRepository: HubRepository
    private lateinit var pushTokenSyncer: PushTokenSyncer
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
    private var currentFoldFeature: HubFoldFeature? = null
    private var currentAdaptiveSpec: HubAdaptiveSpec = HubAdaptivePolicy.spec(widthDp = 0)
    private val topBarScrollSourceOffsets = mutableMapOf<View, Int>()
    private val avatarBitmapCache = LruCache<String, Bitmap>(64)
    private var selectedSettingsDetailScreen: HubScreen? = null
    private val serverConnectionDebugLogs = mutableListOf("bootstrap: 대기 중")
    private val navigationHistory = MainNavigationHistory()
    private lateinit var screenTransitionController: ScreenTransitionController
    private var latestNavigationDestination = HubScreen.HOME
    private var latestRootDestination = HubScreen.HOME
    private var pendingScreenRefresh: PendingScreenRefresh? = null
    private var activeTwoPaneDetailPane: View? = null
    private var activeSettingsHubScrollView: NestedScrollView? = null
    private var lastRootBackPressedAt = 0L
private var selectedFilter = "all"
private var selectedLiveStatusFilter = "all"
private var liveMemberPriorityIds: List<String> = emptyList()
private var draggingLiveMemberId: String? = null
    private var selectedHistoryEventTypeFilterId = "all"
    private var selectedHistoryMemberFilterId = "all"
private val songBrowseSession: SongBrowseSessionViewModel by viewModels()
private var selectedSongType: String
    get() = songBrowseSession.type
    set(value) { songBrowseSession.type = value }
private var selectedSongLibraryId: String
    get() = songBrowseSession.libraryId
    set(value) { songBrowseSession.libraryId = value }
private var songFavoriteIds: Set<String> = emptySet()
private var songDiscoveryState = SongDiscoveryStateV1()
private lateinit var songDiscoveryRepository: SongDiscoveryRepository
private lateinit var songFavoritesRepository: SongFavoritesRepository
private val songOpenPreferenceStore by lazy { SongOpenPreferenceStore(this) }
private var selectedSongSortId: String
    get() = songBrowseSession.sortId
    set(value) { songBrowseSession.sortId = value }
private var selectedSongQuery: String
    get() = songBrowseSession.query
    set(value) { songBrowseSession.query = value }
private var appliedSongQuery = ""
private var visibleSongLimit: Int
    get() = songBrowseSession.visibleLimit
    set(value) { songBrowseSession.visibleLimit = value }
private var isLoadingMoreSongs = false
private var activeSongScrollView: View? = null
private var activeSongListContainer: LinearLayout? = null
private var activeSongScrollSlot: SongScrollSlot? = null
private var isRestoringSongScrollPosition = false
private lateinit var songScrollToTopButton: ImageButton
private var selectedSongMemberFilter: SongMemberFilterState
    get() = songBrowseSession.memberFilter
    set(value) { songBrowseSession.memberFilter = value.normalized() }
private var selectedSongMemberFilterDraft: SongMemberFilterState? = null
private val songSearchHandler = Handler(Looper.getMainLooper())
private var pendingSongSearchRender: Runnable? = null
private var cachedSongItems: List<SongCatalogItem> = emptyList()
private var cachedSongType: String? = null
private var cachedSongCatalogAuthoritative = false
private var songSearchResultsContainer: LinearLayout? = null
private var homeRecentSongs: List<SongCatalogItem>? = null
private var isLoadingHomeRecentSongs = false
private var selectedHubEventId: String? = null
private var selectedHubEventScheduleItemId: String? = null
private val reservationDateFormatter = DateTimeFormatter.ofPattern("yyyy. M. d. HH:mm").withZone(ZoneId.of("Asia/Seoul"))
private var reservationDrafts: List<ReservationDraft> = emptyList()
private var reservationRecords: List<ReservationRecord> = emptyList()
private var selectedReservationId: UUID? = null
private var reservationEditHasUnsavedChanges: (() -> Boolean)? = null
private val externallyOpenedReservationSessionIds = mutableSetOf<UUID>()
private val promptedReservationSessionIds = mutableSetOf<UUID>()
private var reservationExternalFlowActive = false
private var reservationExternalFlowLeftApp = false
private var pendingReservationRecordingFailure = false
private var expandedHubEventScheduleEventId: String? = null
private val expandedHubEventScheduleItemIds = mutableSetOf<String>()
private var selectedAnnouncementId: String? = null
private var announcementsSummary = AnnouncementsSummary()
private var announcementItems: List<ServiceAnnouncement> = emptyList()
private var announcementNextCursor: String? = null
private var announcementReadKeys: Set<String> = emptySet()
private lateinit var announcementReadStore: AnnouncementReadStore
    private var goodsEventsDays: List<HubCalendarDay> = emptyList()
    private var goodsEvents: List<HubEvent> = emptyList()
    private var goodsEventsSelectedMonth: YearMonth = YearMonth.now()
    private var goodsEventsCalendarExpanded = true
    private var serverHubEventDetailLoadedId: String? = null
    private var serverHubEventDetail: HubEvent? = null
    private var selectedAppearanceMode = AppearanceMode.SYSTEM
    private val targetNotificationEnabledOverrides = mutableMapOf<String, Boolean>()
private var notificationPermissionRequested = false
    private val requestNotificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
    private val cardFactory by lazy { HubCardFactory(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        selectedAppearanceMode = readAppearanceMode()
        liveMemberPriorityIds = readLiveMemberPriorityIds()
        AppCompatDelegate.setDefaultNightMode(selectedAppearanceMode.toNightMode())
        super.onCreate(savedInstanceState)
        goodsEventsCalendarExpanded = savedInstanceState?.getBoolean(
            GOODS_EVENTS_CALENDAR_EXPANDED_STATE,
            true,
        ) ?: true
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        screenTransitionController = ScreenTransitionController(
            screenBody = binding.screenBody,
            dp = { value -> dp(value).toFloat() },
            onIdle = ::onScreenTransitionIdle,
        )
        setupSongScrollToTopButton()
        serverRepository = createServerRepository()
        songFavoritesRepository = DataStoreSongFavoritesRepository(this)
        songDiscoveryRepository = DataStoreSongDiscoveryRepository(this)
        announcementReadStore = AnnouncementReadStore(this)
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                reservationRepository.drafts.collect { drafts ->
                    reservationDrafts = drafts
                    ReservationTileService.requestRefresh(this@MainActivity)
                    updateNavigationChrome()
                    if (navigationHistory.currentScreen in setOf(HubScreen.GOODS_EVENTS, HubScreen.RESERVATIONS)) {
                        refreshScreenWhenIdle(navigationHistory.currentScreen) { renderScreen(navigationHistory.currentScreen) }
                    }
                }
            }
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                reservationRepository.records.collect { records ->
                    reservationRecords = records
                    if (navigationHistory.currentScreen in setOf(HubScreen.GOODS_EVENTS, HubScreen.RESERVATIONS, HubScreen.RESERVATION_DETAIL)) {
                        refreshScreenWhenIdle(navigationHistory.currentScreen) { renderScreen(navigationHistory.currentScreen) }
                    }
                }
            }
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                announcementReadStore.readKeys.collect { keys ->
                    announcementReadKeys = keys
                    updateAnnouncementAction()
                    if (navigationHistory.currentScreen == HubScreen.ANNOUNCEMENTS) refreshScreenWhenIdle(HubScreen.ANNOUNCEMENTS, ::renderAnnouncements)
                }
            }
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                songFavoritesRepository.favorites.collect { favorites ->
                    songFavoriteIds = favorites
                    if (navigationHistory.currentScreen == HubScreen.SONGS && cachedSongItems.isNotEmpty()) {
                        refreshScreenWhenIdle(HubScreen.SONGS, ::renderSongsFromCache)
                    }
                }
            }
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                songDiscoveryRepository.state.collect { state ->
                    songDiscoveryState = state
                    if (navigationHistory.currentScreen == HubScreen.SONGS && cachedSongItems.isNotEmpty()) {
                        refreshScreenWhenIdle(HubScreen.SONGS, ::renderSongsFromCache)
                    }
                }
            }
        }
        syncCurrentPushToken()
        configureTopBarGlass()
        startAdaptiveWindowTracking()
        setupTopBarScrollBehavior()
        setupBackNavigation()
        setupTopBarActions()
        setupBottomNavigation()
        setupPullToRefresh()
        if (!handleAppDeepLink(intent)) {
            val restoredNavigation = savedInstanceState?.restoredNavigationHistory()
            if (restoredNavigation != null) {
                navigationHistory.restore(restoredNavigation)
                latestNavigationDestination = restoredNavigation.currentScreen
                latestRootDestination = restoredNavigation.currentRoot
            }
            replaceScreenWithoutAnimation(restoredNavigation?.currentScreen ?: HubScreen.HOME)
            savedInstanceState?.getInt(CONTENT_SCROLL_Y_STATE)?.let(::restoreContentScrollPosition)
        }
        loadServerBootstrap()
    }

    override fun onResume() {
        super.onResume()
        scheduleLiveClockRefresh()
        if (reservationExternalFlowLeftApp) {
            liveClockHandler.postDelayed(::evaluateReservationReturnPrompt, 350L)
        }
    }

    override fun onPause() {
        if (reservationExternalFlowActive) reservationExternalFlowLeftApp = true
        liveClockHandler.removeCallbacks(liveClockTicker)
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putBoolean(GOODS_EVENTS_CALENDAR_EXPANDED_STATE, goodsEventsCalendarExpanded)
        val navigation = navigationHistory.snapshot()
        outState.putString(NAVIGATION_CURRENT_ROOT_STATE, navigation.currentRoot.id)
        outState.putString(NAVIGATION_CURRENT_SCREEN_STATE, navigation.currentScreen.id)
        outState.putStringArrayList(
            NAVIGATION_PREVIOUS_SCREENS_STATE,
            ArrayList(navigation.previousScreens.map(HubScreen::id)),
        )
        if (::binding.isInitialized) {
            outState.putInt(CONTENT_SCROLL_Y_STATE, currentContentScrollY())
        }
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        liveClockHandler.removeCallbacks(liveClockTicker)
        pendingSongSearchRender?.let(songSearchHandler::removeCallbacks)
        liveClockTextViews.clear()
        screenTransitionController.cancelAndClear()
        super.onDestroy()
    }

    private fun loadServerBootstrap() {
        lifecycleScope.launch {
            val state = serverRepository.bootstrap()
            serverMembers = state.members
            announcementsSummary = state.announcementsSummary
            announcementReadStore.initializeSummary(announcementsSummary.items)
            liveStatusSourceLabel = state.liveStatusSourceLabel
            recordServerConnectionLog("bootstrap: $liveStatusSourceLabel")
            val screen = navigationHistory.currentScreen
            val scrollY = currentContentScrollY()
            refreshScreenWhenIdle(screen) {
                replaceScreenWithoutAnimation(screen)
                restoreContentScrollPosition(scrollY)
            }
            binding.contentRefresh.isRefreshing = false
        }
    }

    private fun Bundle.restoredNavigationHistory(): MainNavigationHistoryState? {
        fun screen(key: String): HubScreen? = getString(key)?.let { id ->
            HubScreen.entries.firstOrNull { it.id == id }
        }

        val currentRoot = screen(NAVIGATION_CURRENT_ROOT_STATE) ?: return null
        val currentScreen = screen(NAVIGATION_CURRENT_SCREEN_STATE) ?: return null
        val previousScreens = getStringArrayList(NAVIGATION_PREVIOUS_SCREENS_STATE)
            .orEmpty()
            .mapNotNull { id -> HubScreen.entries.firstOrNull { it.id == id } }
        return MainNavigationHistoryState(currentRoot, currentScreen, previousScreens)
    }

    private fun currentContentScrollY(): Int =
        activeSettingsHubScrollView?.scrollY ?: binding.contentScroll.scrollY

    private fun restoreContentScrollPosition(scrollY: Int) {
        val scrollView = activeSettingsHubScrollView ?: binding.contentScroll
        scrollView.post {
            scrollView.scrollTo(0, scrollY)
            if (scrollView === binding.contentScroll) {
                updateTopBarScrolled(scrollY > dp(24))
            }
        }
    }

    private fun createServerRepository(): HubRepository {
        val apiClient = HubApiClient.create(BuildConfig.HUB_BASE_URL)
        pushTokenSyncer = PushTokenSyncer(context = this, apiClient = apiClient)
        return ServerHubRepository(
            remoteDataSource = ServerHubRepository.HubApiRemoteDataSource(apiClient),
            deviceIdStore = DeviceIdStore(this),
            fallback = repository,
            flushPendingPushToken = { pushTokenSyncer.flushPendingToken() },
        )
    }

    private fun startAdaptiveWindowTracking() {
        updateAdaptiveSpec(foldFeature = currentFoldFeature, renderIfChanged = false)
        binding.root.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
            updateAdaptiveSpec(foldFeature = currentFoldFeature, renderIfChanged = true)
            updateNavigationChrome()
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                WindowInfoTracker.getOrCreate(this@MainActivity)
                    .windowLayoutInfo(this@MainActivity)
                    .collect { layoutInfo ->
                        currentFoldFeature = layoutInfo.displayFeatures
                            .filterIsInstance<FoldingFeature>()
                            .firstOrNull()
                            ?.toHubFoldFeature()
                        updateAdaptiveSpec(foldFeature = currentFoldFeature, renderIfChanged = true)
                    }
            }
        }
    }

    private fun updateAdaptiveSpec(foldFeature: HubFoldFeature?, renderIfChanged: Boolean) {
        val previousSpec = currentAdaptiveSpec
        val nextSpec = HubAdaptivePolicy.spec(
            widthDp = currentWindowWidthDp(),
            foldFeature = foldFeature,
        )
        if (nextSpec == currentAdaptiveSpec) return
        currentAdaptiveSpec = nextSpec
        updateNavigationChrome()
        if (renderIfChanged && nextSpec.widthClass != previousSpec.widthClass) {
            val screen = navigationHistory.currentScreen
            refreshScreenWhenIdle(screen) { replaceScreenWithoutAnimation(screen) }
        }
    }

    private fun currentWindowWidthDp(): Int {
        val bounds = WindowMetricsCalculator.getOrCreate()
            .computeCurrentWindowMetrics(this)
            .bounds
        return (bounds.width() / resources.displayMetrics.density).toInt()
    }

    private fun FoldingFeature.toHubFoldFeature(): HubFoldFeature =
        HubFoldFeature(
            state = when (state) {
                FoldingFeature.State.FLAT -> HubFoldState.FLAT
                FoldingFeature.State.HALF_OPENED -> HubFoldState.HALF_OPENED
                else -> HubFoldState.UNKNOWN
            },
            orientation = when (orientation) {
                FoldingFeature.Orientation.VERTICAL -> HubFoldOrientation.VERTICAL
                FoldingFeature.Orientation.HORIZONTAL -> HubFoldOrientation.HORIZONTAL
                else -> null
            },
            isSeparating = isSeparating,
            bounds = bounds,
        )

    private fun syncCurrentPushToken() {
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                if (token.isBlank()) return@addOnSuccessListener
                CoroutineScope(Dispatchers.IO).launch {
                    pushTokenSyncer.syncToken(token)
                }
            }
            .addOnFailureListener { error ->
                Log.d("MainActivity", "FCM token sync unavailable: ${error.javaClass.simpleName}")
            }
    }

 private fun setupPullToRefresh() {
 binding.contentRefresh.isEnabled = false
 binding.contentRefresh.setOnRefreshListener {
 if (navigationHistory.currentScreen == HubScreen.ANNOUNCEMENTS) loadAnnouncements(reset = true) else loadServerBootstrap()
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

    private fun serverStatusStrip(): MaterialCardView =
        baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                bottomMargin = dp(10)
            }
            addView(TextView(context).apply {
                text = "● ${MainUiPolicy.serverConnectionLabel(liveStatusSourceLabel)}"
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(dp(12), dp(7), dp(12), dp(7))
            })
        }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAppDeepLink(intent)
    }

    private fun handleAppDeepLink(intent: Intent?): Boolean {
        val deepLink = intent?.dataString ?: intent?.getStringExtra("appDeepLink")
        val reservationRoute = ReservationDeepLinkPolicy.route(deepLink)
        when (val route = reservationRoute) {
            ReservationDeepLinkRoute.ListRoute -> {
                selectedReservationId = null
                navigationHistory.selectRoot(HubScreen.GOODS_EVENTS)
                navigationHistory.select(HubScreen.RESERVATIONS)
            }
            is ReservationDeepLinkRoute.QuickAdd -> {
                startActivity(Intent(this, ReservationQuickAddActivity::class.java).apply {
                    route.sessionId?.let { putExtra(ReservationQuickAddActivity.EXTRA_SESSION_ID, it.toString()) }
                })
                return true
            }
            is ReservationDeepLinkRoute.Detail -> {
                selectedReservationId = route.reservationId
                navigationHistory.selectRoot(HubScreen.GOODS_EVENTS)
                navigationHistory.select(HubScreen.RESERVATION_DETAIL)
            }
            is ReservationDeepLinkRoute.Edit -> {
                selectedReservationId = route.reservationId
                navigationHistory.selectRoot(HubScreen.GOODS_EVENTS)
                navigationHistory.select(HubScreen.RESERVATION_EDIT)
            }
            null -> Unit
        }
        if (reservationRoute != null) {
            replaceScreenWithoutAnimation(navigationHistory.currentScreen)
            latestNavigationDestination = navigationHistory.currentScreen
            latestRootDestination = HubScreen.GOODS_EVENTS
            return true
        }
        val announcementId = AnnouncementDeepLinkPolicy.idFromAppDeepLink(deepLink)
        if (announcementId != null) {
            selectedAnnouncementId = announcementId
            navigationHistory.selectRoot(HubScreen.HOME)
            navigationHistory.select(HubScreen.ANNOUNCEMENTS)
            navigationHistory.select(HubScreen.ANNOUNCEMENT_DETAIL)
            replaceScreenWithoutAnimation(HubScreen.ANNOUNCEMENT_DETAIL)
            latestNavigationDestination = navigationHistory.currentScreen
            latestRootDestination = navigationHistory.currentRootScreen
            return true
        }
        val eventId = HubCalendarDeepLinkPolicy.eventIdFromAppDeepLink(deepLink) ?: return false
        selectedHubEventId = eventId
        selectedHubEventScheduleItemId = HubCalendarDeepLinkPolicy.scheduleItemIdFromAppDeepLink(deepLink)
        serverHubEventDetailLoadedId = null
        navigationHistory.selectRoot(HubScreen.GOODS_EVENTS)
        if (shouldUseGoodsEventsTwoPane()) {
            replaceScreenWithoutAnimation(HubScreen.GOODS_EVENTS)
        } else {
            navigationHistory.select(HubScreen.GOODS_EVENT_DETAIL)
            replaceScreenWithoutAnimation(HubScreen.GOODS_EVENT_DETAIL)
        }
        latestNavigationDestination = navigationHistory.currentScreen
        latestRootDestination = navigationHistory.currentRootScreen
        return true
    }

    private fun setupTopBarScrollBehavior() {
        registerTopBarScrollSource(binding.contentScroll)
    }

    private fun registerTopBarScrollSource(source: View) {
        topBarScrollSourceOffsets[source] = source.scrollY
        source.setOnScrollChangeListener { view, _, scrollY, _, _ ->
            topBarScrollSourceOffsets[view] = scrollY
            updateTopBarScrolledFromSources()
        }
    }

    private fun resetTopBarScrollSources() {
        topBarScrollSourceOffsets.clear()
        topBarScrollSourceOffsets[binding.contentScroll] = binding.contentScroll.scrollY
    }

    private fun updateTopBarScrolledFromSources() {
        updateTopBarScrolled(topBarScrollSourceOffsets.values.any { it > dp(24) })
    }

    private fun setupBottomNavigation() {
        rootNavigationItems().forEach { item ->
            item.view.setOnClickListener {
                navigateToRoot(item.screen)
            }
        }
    }

    private fun setupTopBarActions() {
        binding.topBarReservations.setOnClickListener { pushScreen(HubScreen.RESERVATIONS) }
        binding.topBarAnnouncement.setOnClickListener { pushScreen(HubScreen.ANNOUNCEMENTS) }
        binding.topBarSettings.setOnClickListener {
            pushScreen(HubScreen.SETTINGS)
        }
        binding.topBarSongSearch.setOnClickListener {
            pushScreen(HubScreen.SONG_SEARCH)
        }
    }

    private fun setupBackNavigation() {
        binding.topBarBack.setOnClickListener {
            if (!popScreen()) finish()
        }
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    handleSystemBackPressed()
                }
            }
        )
    }

    private fun navigateToRoot(screen: HubScreen) {
        if (screen == latestNavigationDestination &&
            (screenTransitionController.isTransitionRunning || !navigationHistory.canGoBack)
        ) {
            return
        }
        captureActiveSongScrollPosition()
        lastRootBackPressedAt = 0L
        val from = latestRootDestination
        val motion = ScreenTransitionPolicy.motion(from, screen, ScreenTransitionReason.ROOT_SELECTION)
        latestNavigationDestination = screen
        latestRootDestination = screen
        performScreenTransition("root:${screen.id}", screen, motion) {
            navigationHistory.selectRoot(screen)
        }
    }

    private fun pushScreen(screen: HubScreen) {
        if (screen == latestNavigationDestination) return
        captureActiveSongScrollPosition()
        lastRootBackPressedAt = 0L
        val motion = ScreenTransitionPolicy.motion(
            latestNavigationDestination,
            screen,
            ScreenTransitionReason.PUSH,
        )
        latestNavigationDestination = screen
        performScreenTransition("push:${screen.id}", screen, motion) {
            navigationHistory.select(screen)
        }
    }

    private fun popScreen(): Boolean {
        if (confirmReservationEditDiscardIfNeeded { popScreen() }) return true
        if (screenTransitionController.isTransitionRunning) {
            screenTransitionController.runWhenIdle("deferred:pop", ::popScreenNow)
            return true
        }
        return popScreenNow()
    }

    private fun popScreenNow(): Boolean {
        val previous = navigationHistory.previousScreen ?: return false
        captureActiveSongScrollPosition()
        latestNavigationDestination = previous
        val motion = ScreenTransitionPolicy.motion(
            navigationHistory.currentScreen,
            previous,
            ScreenTransitionReason.POP,
        )
        performScreenTransition("pop:${previous.id}", previous, motion) {
            navigationHistory.goBack()
        }
        return true
    }

    private fun handleSystemBackPressed() {
        if (confirmReservationEditDiscardIfNeeded(::handleSystemBackPressed)) return
        if (screenTransitionController.isTransitionRunning) {
            screenTransitionController.runWhenIdle("deferred:system_back", ::handleSystemBackPressedNow)
            return
        }
        handleSystemBackPressedNow()
    }

    private fun confirmReservationEditDiscardIfNeeded(onDiscard: () -> Unit): Boolean {
        if (navigationHistory.currentScreen != HubScreen.RESERVATION_EDIT ||
            reservationEditHasUnsavedChanges?.invoke() != true
        ) {
            return false
        }
        AlertDialog.Builder(this)
            .setTitle("수정 내용을 버릴까요?")
            .setMessage("저장하지 않은 예약 변경 내용이 있습니다.")
            .setNegativeButton("계속 수정", null)
            .setPositiveButton("변경사항 버리기") { _, _ ->
                reservationEditHasUnsavedChanges = null
                onDiscard()
            }
            .show()
        return true
    }

    private fun handleSystemBackPressedNow() {
        if (navigateBackToCurrentRootNow()) {
            lastRootBackPressedAt = 0L
            return
        }

        val now = SystemClock.elapsedRealtime()
        if (now - lastRootBackPressedAt <= EXIT_BACK_PRESS_INTERVAL_MS) {
            finish()
            return
        }
        lastRootBackPressedAt = now
        Toast.makeText(this, "한 번 더 뒤로 가면 앱이 종료됩니다.", Toast.LENGTH_SHORT).show()
    }

    private fun navigateBackToCurrentRootNow(): Boolean {
        val root = navigationHistory.currentRootScreen
        if (root == navigationHistory.currentScreen) return false
        latestNavigationDestination = root
        val motion = ScreenTransitionPolicy.motion(
            navigationHistory.currentScreen,
            root,
            ScreenTransitionReason.POP,
        )
        performScreenTransition("pop-to-root:${root.id}", root, motion) {
            navigationHistory.goBackToCurrentRoot()
        }
        return true
    }

    private fun performScreenTransition(
        key: String,
        screen: HubScreen,
        motion: ScreenNavigationMotion,
        updateHistory: () -> Unit,
    ) {
        screenTransitionController.transition(
            key = key,
            motion = motion,
            isRtl = binding.root.layoutDirection == View.LAYOUT_DIRECTION_RTL,
        ) {
            updateHistory()
            replaceScreenWithoutAnimation(screen)
        }
    }

    private fun replaceScreenWithoutAnimation(screen: HubScreen) {
        renderScreen(screen)
        updateSelectedBottomNavigation(screen)
        updateNavigationChrome()
    }

    private fun refreshScreenWhenIdle(screen: HubScreen, render: () -> Unit) {
        if (screen != navigationHistory.currentScreen) return
        if (screenTransitionController.isTransitionRunning) {
            pendingScreenRefresh = PendingScreenRefresh(screen, render)
        } else {
            render()
        }
    }

    private fun crossFadeTwoPaneSelection(key: String, render: () -> Unit) {
        val screen = navigationHistory.currentScreen
        val motion = ScreenTransitionPolicy.motion(
            screen,
            screen,
            ScreenTransitionReason.TWO_PANE_SELECTION,
        )
        screenTransitionController.transition(
            key = "two-pane:$key",
            motion = motion,
            isRtl = binding.root.layoutDirection == View.LAYOUT_DIRECTION_RTL,
            targetProvider = { activeTwoPaneDetailPane },
            commit = render,
        )
    }

    private fun onScreenTransitionIdle() {
        latestNavigationDestination = navigationHistory.currentScreen
        latestRootDestination = navigationHistory.currentRootScreen
        val pending = pendingScreenRefresh
        pendingScreenRefresh = null
        if (pending?.screen == navigationHistory.currentScreen) {
            pending.render()
        }
    }

    private fun renderScreen(screen: HubScreen) {
        if (screen != HubScreen.RESERVATION_EDIT) reservationEditHasUnsavedChanges = null
        if (screen != HubScreen.SONG_SEARCH) {
            pendingSongSearchRender?.let(songSearchHandler::removeCallbacks)
            pendingSongSearchRender = null
            songSearchResultsContainer = null
        }
        when (screen) {
HubScreen.HOME -> renderHome()
HubScreen.SONGS -> renderSongs()
HubScreen.SONG_SEARCH -> renderSongSearch()
HubScreen.SONG_MEMBER_FILTER -> renderSongMemberFilter()
HubScreen.GOODS_EVENTS -> renderGoodsEvents()
            HubScreen.GOODS_EVENT_DETAIL -> renderHubEventDetail()
            HubScreen.RESERVATIONS -> renderReservations()
            HubScreen.RESERVATION_DETAIL -> renderReservationDetail()
            HubScreen.RESERVATION_EDIT -> renderReservationEdit()
            HubScreen.LIVE -> renderLive()
HubScreen.HISTORY -> renderHistory()
            HubScreen.ANNOUNCEMENTS -> renderAnnouncements()
            HubScreen.ANNOUNCEMENT_DETAIL -> renderAnnouncementDetail()
            HubScreen.SETTINGS -> renderSettings()
            HubScreen.SETTINGS_DELIVERY -> renderSettingsDelivery()
            HubScreen.SETTINGS_TARGETS -> renderSettingsTargets()
            HubScreen.SETTINGS_PLATFORMS -> renderSettingsPlatforms()
            HubScreen.SETTINGS_EVENT_TYPES -> renderSettingsEventTypes()
            HubScreen.SETTINGS_HUB_EVENTS -> renderSettingsHubEvents()
            HubScreen.SETTINGS_ADVANCED -> renderSettingsAdvanced()
            HubScreen.SETTINGS_ABOUT -> renderSettingsAbout()
        }
        updateTwoPaneScrollChrome(screen)
    }

    private fun updateTwoPaneScrollChrome(screen: HubScreen = navigationHistory.currentScreen) {
        val isTwoPaneScreen =
            screen == HubScreen.GOODS_EVENTS && shouldUseGoodsEventsTwoPane() ||
                screen == HubScreen.SONGS && shouldUseSongsTwoPane() ||
                screen == HubScreen.SETTINGS && shouldUseSettingsTwoPane()
        binding.contentRefresh.isEnabled =
            !isTwoPaneScreen && (screen == HubScreen.LIVE || screen == HubScreen.GOODS_EVENTS || screen == HubScreen.SONGS || screen == HubScreen.ANNOUNCEMENTS)
        if (isTwoPaneScreen) {
            binding.contentRefresh.isRefreshing = false
        }
    }

    private fun updateSelectedBottomNavigation(screen: HubScreen) {
        val selectedScreen = itemForScreen(screen)?.let(::screenForItem) ?: return
        rootNavigationItems().forEach { item ->
            setSelectedState(item.view, item.screen == selectedScreen)
        }
    }

    private fun rootNavigationItems(): List<RootNavigationItem> = listOf(
        RootNavigationItem(HubScreen.HOME, binding.tabHome),
        RootNavigationItem(HubScreen.LIVE, binding.tabLive),
        RootNavigationItem(HubScreen.SONGS, binding.tabSongs),
        RootNavigationItem(HubScreen.GOODS_EVENTS, binding.tabGoodsEvents),
        RootNavigationItem(HubScreen.HOME, binding.railTabHome),
        RootNavigationItem(HubScreen.LIVE, binding.railTabLive),
        RootNavigationItem(HubScreen.SONGS, binding.railTabSongs),
        RootNavigationItem(HubScreen.GOODS_EVENTS, binding.railTabGoodsEvents),
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
        val spec = MainScreenChromePolicy.spec(navigationHistory.currentScreen.id, canGoBack)
        val navigationSpec = MainScreenChromePolicy.navigationSpec(currentAdaptiveSpec)
        binding.topBarBack.isVisible = canGoBack
        binding.topBarTitleGroup.setPaddingRelative(
            dp(MainUiPolicy.topBarTitleStartInsetDp(canGoBack)),
            binding.topBarTitleGroup.paddingTop,
            binding.topBarTitleGroup.paddingEnd,
            binding.topBarTitleGroup.paddingBottom
        )
        binding.topBarTitleGroup.isVisible = spec.showTopBarTitleAtRest
        binding.topBarSettings.isVisible = spec.showSettingsAction
        binding.topBarAnnouncementContainer.isVisible = spec.showAnnouncementAction
        val showsReservations = navigationHistory.currentScreen in setOf(HubScreen.GOODS_EVENTS, HubScreen.GOODS_EVENT_DETAIL)
        binding.topBarReservationsContainer.isVisible = showsReservations
        val pendingReservations = reservationDrafts.count { it.expiresAt.isAfter(Instant.now()) }
        binding.topBarReservationsBadge.isVisible = showsReservations && pendingReservations > 0
        binding.topBarReservationsBadge.text = pendingReservations.coerceAtMost(99).toString()
        binding.topBarReservations.contentDescription = "내 예약 및 구매, 확인 필요 ${pendingReservations}개"
        updateAnnouncementAction()
        binding.topBarSongSearch.isVisible = spec.showSongSearchAction &&
            SongsPanePolicy.shouldShowTopBarSearchAction(currentAdaptiveSpec)
        binding.bottomNavigation.isVisible = navigationSpec.showBottomNavigation
        binding.navigationRail.isVisible = navigationSpec.showNavigationRail
        binding.navigationRailDivider.isVisible = navigationSpec.showNavigationRail
        updateTopGlassOverlayStartMargin(navigationSpec.showNavigationRail)
        updateContentWidthConstraint(navigationSpec.constrainContentWidth)
        scheduleSongScrollToTopButtonPositionUpdate()
    }

    private fun screenForItem(itemId: Int): HubScreen = when (itemId) {
        R.id.rail_tab_live,
        R.id.tab_live -> HubScreen.LIVE
        R.id.rail_tab_songs,
        R.id.tab_songs -> HubScreen.SONGS
        R.id.rail_tab_goods_events,
        R.id.tab_goods_events -> HubScreen.GOODS_EVENTS
        else -> HubScreen.HOME
    }

    private fun itemForScreen(screen: HubScreen): Int? = when (screen) {
HubScreen.HOME -> R.id.tab_home
HubScreen.SONGS -> R.id.tab_songs
HubScreen.SONG_SEARCH -> R.id.tab_songs
HubScreen.SONG_MEMBER_FILTER -> R.id.tab_songs
HubScreen.GOODS_EVENTS -> R.id.tab_goods_events
        HubScreen.GOODS_EVENT_DETAIL -> R.id.tab_goods_events
        HubScreen.RESERVATIONS -> R.id.tab_goods_events
        HubScreen.RESERVATION_DETAIL -> R.id.tab_goods_events
        HubScreen.RESERVATION_EDIT -> R.id.tab_goods_events
        HubScreen.LIVE -> R.id.tab_live
        HubScreen.HISTORY -> null
        HubScreen.ANNOUNCEMENTS -> null
        HubScreen.ANNOUNCEMENT_DETAIL -> null
        HubScreen.SETTINGS -> null
        HubScreen.SETTINGS_DELIVERY -> null
        HubScreen.SETTINGS_TARGETS -> null
        HubScreen.SETTINGS_PLATFORMS -> null
        HubScreen.SETTINGS_EVENT_TYPES -> null
        HubScreen.SETTINGS_HUB_EVENTS -> null
        HubScreen.SETTINGS_ADVANCED -> null
        HubScreen.SETTINGS_ABOUT -> null
    }

private fun startScreen(screenId: String, title: String, role: String) {
        binding.screenActionContainer.isVisible = false
        scheduleSongScrollToTopButtonPositionUpdate()
        activeTwoPaneDetailPane = null
        activeSettingsHubScrollView = null
        if (screenId != "song_member_filter") selectedSongMemberFilterDraft = null
        if (screenId != "songs" && screenId != "song_search") {
            activeSongScrollView = null
            activeSongListContainer = null
            activeSongScrollSlot = null
            if (::songScrollToTopButton.isInitialized) songScrollToTopButton.isVisible = false
        }
        liveClockHandler.removeCallbacks(liveClockTicker)
        liveClockTextViews.clear()
        binding.collapsedTitle.text = MainUiPolicy.topBarTitle(screenId)
        val topBarRole = MainUiPolicy.topBarRole(screenId)
        binding.collapsedRole.text = topBarRole
        binding.collapsedRole.isVisible = topBarRole.isNotBlank()
        binding.contentList.removeAllViews()
        resetTopBarScrollSources()
        registerTopBarScrollSource(binding.contentScroll)
        clearTopFilters()
        applyContentTopPadding(underTopBar = false)
        if (MainScreenChromePolicy.spec(screenId, navigationHistory.canGoBack).showExpandedBodyHeader) {
            binding.contentList.addView(screenTitle(title))
            binding.contentList.addView(screenCopy(role))
        }
        binding.contentScroll.post {
            binding.contentScroll.scrollTo(0, 0)
            updateTopBarScrolled(false)
        }
    }

    private fun applyContentTopPadding(underTopBar: Boolean) {
        val overlayHeight = binding.topGlassOverlay.height.takeIf { it > 0 } ?: (systemTopInsetPx + dp(52))
        val topPadding = if (underTopBar) 0 else overlayHeight
        val horizontalPadding = if (underTopBar) 0 else dp(18)
        binding.contentList.setPadding(horizontalPadding, topPadding, horizontalPadding, dp(20))
    }

    private fun updateTopGlassOverlayStartMargin(showNavigationRail: Boolean) {
        val marginStart = if (showNavigationRail) dp(NAVIGATION_RAIL_WIDTH_DP) + dp(1) else 0
        val params = binding.topGlassOverlay.layoutParams as? FrameLayout.LayoutParams ?: return
        if (params.marginStart == marginStart) return
        params.marginStart = marginStart
        binding.topGlassOverlay.layoutParams = params
    }

    private fun updateContentWidthConstraint(constrainContentWidth: Boolean) {
        val params = binding.contentList.layoutParams
        val nextWidth = if (constrainContentWidth) {
            val maxWidthDp = when {
                navigationHistory.currentScreen == HubScreen.GOODS_EVENTS && shouldUseGoodsEventsTwoPane() ->
                    GOODS_EVENTS_TWO_PANE_CONTENT_MAX_WIDTH_DP
                navigationHistory.currentScreen == HubScreen.SONGS && shouldUseSongsTwoPane() ->
                    SONGS_TWO_PANE_CONTENT_MAX_WIDTH_DP
                navigationHistory.currentScreen == HubScreen.SETTINGS && shouldUseSettingsTwoPane() ->
                    SETTINGS_TWO_PANE_CONTENT_MAX_WIDTH_DP
                else -> LARGE_SCREEN_CONTENT_MAX_WIDTH_DP
            }
            val availableWidth = binding.contentScroll.width.takeIf { it > 0 } ?: dp(maxWidthDp)
            minOf(dp(maxWidthDp), availableWidth)
        } else {
            ViewGroup.LayoutParams.MATCH_PARENT
        }
        if (params.width != nextWidth) {
            params.width = nextWidth
            binding.contentList.layoutParams = params
        }
        (binding.contentList.layoutParams as? FrameLayout.LayoutParams)?.let { frameParams ->
            val nextGravity = if (constrainContentWidth) Gravity.TOP or Gravity.CENTER_HORIZONTAL else Gravity.NO_GRAVITY
            if (frameParams.gravity != nextGravity) {
                frameParams.gravity = nextGravity
                binding.contentList.layoutParams = frameParams
            }
        }
    }

    private fun scrollablePane(trackTopBarScroll: Boolean = true): ScrollablePane {
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        val scrollView = NestedScrollView(this).apply {
            isFillViewport = true
            overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
            addView(
                content,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ),
            )
        }
        if (trackTopBarScroll) {
            registerTopBarScrollSource(scrollView)
        }
        return ScrollablePane(scrollView, content)
    }

    private fun setupSongScrollToTopButton() {
        songScrollToTopButton = ImageButton(this).apply {
            setImageResource(android.R.drawable.arrow_up_float)
            background = rounded(fill = color(R.color.hub_card), radius = dp(24))
            contentDescription = "맨 위로 이동"
            elevation = dp(8).toFloat()
            isVisible = false
            setOnClickListener {
                val source = activeSongScrollView ?: return@setOnClickListener
                smoothScrollSongViewTo(source, 0)
                activeSongScrollSlot?.let { slot ->
                    songBrowseSession.positions[slot.name] = SongScrollPosition(
                        anchorSongId = null,
                        anchorOffset = 0,
                        fallbackAbsoluteOffset = 0,
                        visibleLimitAtCapture = visibleSongLimit,
                        queryKey = currentSongQueryKey(),
                    )
                }
                isVisible = false
            }
        }
        binding.root.addView(
            songScrollToTopButton,
            FrameLayout.LayoutParams(dp(48), dp(48), Gravity.END or Gravity.BOTTOM).apply {
                marginEnd = dp(18)
                bottomMargin = dp(80)
            },
        )
        scheduleSongScrollToTopButtonPositionUpdate()
    }

    private fun scheduleSongScrollToTopButtonPositionUpdate() {
        if (!::songScrollToTopButton.isInitialized || !::binding.isInitialized) return
        binding.root.post {
            val obstruction = when {
                binding.screenActionContainer.isVisible -> binding.screenActionContainer
                binding.bottomNavigation.isVisible -> binding.bottomNavigation
                else -> null
            }
            val occupiedBottomHeight = obstruction?.let { view ->
                val rootLocation = IntArray(2)
                val viewLocation = IntArray(2)
                binding.root.getLocationInWindow(rootLocation)
                view.getLocationInWindow(viewLocation)
                (rootLocation[1] + binding.root.height - viewLocation[1]).coerceAtLeast(0)
            } ?: 0
            val params = songScrollToTopButton.layoutParams as? FrameLayout.LayoutParams ?: return@post
            val nextBottomMargin = occupiedBottomHeight + dp(16)
            if (params.bottomMargin != nextBottomMargin) {
                params.bottomMargin = nextBottomMargin
                songScrollToTopButton.layoutParams = params
            }
        }
    }

    private fun registerSongMemberFilterScrollToTop() {
        val source = binding.contentScroll
        activeSongScrollView = source
        activeSongListContainer = null
        activeSongScrollSlot = null
        source.setOnScrollChangeListener { view, _, scrollY, _, _ ->
            topBarScrollSourceOffsets[view] = scrollY
            updateTopBarScrolledFromSources()
            songScrollToTopButton.isVisible = MainUiPolicy.shouldShowSongScrollToTop(
                absoluteOffset = scrollY,
                isLoading = false,
                isEmpty = false,
                isRestoring = false,
                threshold = dp(240),
            )
        }
    }

    private fun currentSongQueryKey(): SongListQueryKey = SongListQueryKey(
        generationId = "all",
        type = selectedSongType,
        selectedMemberIds = selectedSongMemberFilter.selectedMemberIds.sorted(),
        memberMatchMode = selectedSongMemberFilter.matchMode,
        participation = selectedSongMemberFilter.participation,
        libraryId = selectedSongLibraryId,
        sortId = selectedSongSortId,
        query = selectedSongQuery,
    )

    private fun ViewGroup.childrenSequence(): Sequence<View> = sequence {
        for (index in 0 until childCount) yield(getChildAt(index))
    }

    private fun songScrollY(source: View): Int = when (source) {
        is ScrollView -> source.scrollY
        is NestedScrollView -> source.scrollY
        else -> source.scrollY
    }

    private fun smoothScrollSongViewTo(source: View, y: Int) {
        when (source) {
            is ScrollView -> source.smoothScrollTo(0, y)
            is NestedScrollView -> source.smoothScrollTo(0, y)
        }
    }

    private fun scrollSongViewTo(source: View, y: Int) {
        when (source) {
            is ScrollView -> source.scrollTo(0, y)
            is NestedScrollView -> source.scrollTo(0, y)
        }
    }

    private fun viewTopInSongScroll(view: View, source: View): Int {
        var top = view.top
        var parent = view.parent
        while (parent is View && parent !== source) {
            top += parent.top
            parent = parent.parent
        }
        return top
    }

    private fun captureActiveSongScrollPosition() {
        if (isRestoringSongScrollPosition) return
        val source = activeSongScrollView ?: return
        val container = activeSongListContainer ?: return
        val slot = activeSongScrollSlot ?: return
        val scrollY = songScrollY(source)
        val anchor = container.childrenSequence()
            .filter { it.tag is String }
            .firstOrNull { viewTopInSongScroll(it, source) + it.height > scrollY }
        songBrowseSession.visibleLimit = visibleSongLimit
        songBrowseSession.positions[slot.name] = SongScrollPosition(
            anchorSongId = anchor?.tag as? String,
            anchorOffset = anchor?.let { viewTopInSongScroll(it, source) - scrollY } ?: 0,
            fallbackAbsoluteOffset = scrollY,
            visibleLimitAtCapture = visibleSongLimit,
            queryKey = currentSongQueryKey(),
        )
    }

    private fun registerSongScrollSession(
        source: View,
        container: LinearLayout,
        state: SongRenderState,
        slot: SongScrollSlot,
    ) {
        activeSongScrollView = source
        activeSongListContainer = container
        activeSongScrollSlot = slot
        source.setOnScrollChangeListener { view, _, scrollY, _, _ ->
            topBarScrollSourceOffsets[view] = scrollY
            updateTopBarScrolledFromSources()
            captureActiveSongScrollPosition()
            songScrollToTopButton.isVisible = MainUiPolicy.shouldShowSongScrollToTop(
                absoluteOffset = scrollY,
                isLoading = false,
                isEmpty = state.displayedSongs.isEmpty(),
                isRestoring = isRestoringSongScrollPosition,
                threshold = dp(240),
            )
        }
        restoreSongScrollPosition(source, container, slot)
    }

    private fun restoreSongScrollPosition(source: View, container: LinearLayout, slot: SongScrollSlot) {
        val position = songBrowseSession.positions[slot.name] ?: when (slot) {
            SongScrollSlot.SONGS_SINGLE -> songBrowseSession.positions[SongScrollSlot.SONGS_TWO_PANE.name]
            SongScrollSlot.SONGS_TWO_PANE -> songBrowseSession.positions[SongScrollSlot.SONGS_SINGLE.name]
            SongScrollSlot.SONG_SEARCH -> null
        }
        if (!MainUiPolicy.canRestoreSongScroll(position, currentSongQueryKey())) {
            scrollSongViewTo(source, 0)
            return
        }
        visibleSongLimit = maxOf(visibleSongLimit, position?.visibleLimitAtCapture ?: MainUiPolicy.SONG_PAGE_SIZE)
        isRestoringSongScrollPosition = true
        source.post {
            val anchor = position?.anchorSongId?.let { id ->
                container.childrenSequence().firstOrNull { it.tag == id }
            }
            val target = anchor?.let { viewTopInSongScroll(it, source) - (position?.anchorOffset ?: 0) }
                ?: position?.fallbackAbsoluteOffset
                ?: 0
            scrollSongViewTo(source, target.coerceAtLeast(0))
            source.post {
                isRestoringSongScrollPosition = false
                captureActiveSongScrollPosition()
            }
        }
    }

    private fun twoPaneViewportHeight(): Int {
        val viewport = binding.contentScroll.height
        val verticalPadding = binding.contentList.paddingTop + binding.contentList.paddingBottom
        val fallback = resources.displayMetrics.heightPixels - systemTopInsetPx
        return (viewport.takeIf { it > 0 } ?: fallback)
            .minus(verticalPadding)
            .coerceAtLeast(dp(360))
    }

    private fun clearTopFilters() {
        binding.topFilterContainer.removeAllViews()
        binding.topFilterContainer.isVisible = false
        binding.topBarFadeSpace.layoutParams = binding.topBarFadeSpace.layoutParams.apply {
            height = 0
        }
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
        val homeAnnouncement = AnnouncementPolicy.homeAnnouncement(
            (announcementItems + listOfNotNull(announcementsSummary.pinned)).distinctBy { it.id }
        )
        if (homeAnnouncement != null) {
            binding.contentList.addView(sectionLabel("중요 공지"))
            binding.contentList.addView(announcementCard(homeAnnouncement, showBody = false))
        }
        binding.contentList.addView(sectionLabel("지금 라이브"))
        binding.contentList.addView(serverStatusStrip())
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
        binding.contentList.addView(sectionLabel("최근 곡"))
        when (val recentSongs = homeRecentSongs) {
            null -> binding.contentList.addView(
                loadingCard(MainUiPolicy.homeRecentSongsLoadingPresentation())
            )
            emptyList<SongCatalogItem>() -> binding.contentList.addView(
                compactEventCard("최근 곡 없음", "등록된 곡이 없습니다.", listOf("노래"))
            )
            else -> recentSongs.forEach { binding.contentList.addView(songCard(it)) }
        }
        binding.contentList.addView(
            compactEventCard("노래 전체 보기", "커버곡과 오리지널 곡 전체 목록으로 이동합니다.", listOf("전체")).apply {
                isClickable = true
                isFocusable = true
                setOnClickListener { navigateToRoot(HubScreen.SONGS) }
            }
        )
        loadHomeRecentSongsIfNeeded()
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

    private fun updateAnnouncementAction() {
        if (!::binding.isInitialized) return
        val unreadCount = announcementsSummary.items.count {
            AnnouncementPolicy.readKey(it.id, it.attentionRevision) !in announcementReadKeys
        }
        binding.topBarAnnouncementBadge.text = AnnouncementPolicy.badgeText(unreadCount).orEmpty()
        binding.topBarAnnouncementBadge.isVisible = unreadCount > 0 && binding.topBarAnnouncementContainer.isVisible
        binding.topBarAnnouncement.contentDescription = AnnouncementPolicy.accessibilityLabel(unreadCount)
    }

    private fun renderAnnouncements() {
        startScreen("announcements", "공지사항", "앱 서비스 운영 안내와 장애·점검·업데이트 소식입니다.")
        if (announcementItems.isEmpty()) {
            binding.contentList.addView(compactEventCard("공지 확인 중", "서버에서 최신 공지를 불러오고 있습니다.", emptyList()))
            loadAnnouncements(reset = true)
            return
        }
        val sorted = AnnouncementPolicy.sorted(announcementItems)
        val pinned = sorted.filter { it.isPinned }
        val recent = sorted.filterNot { it.isPinned }
        if (pinned.isNotEmpty()) {
            binding.contentList.addView(sectionLabel("고정 공지"))
            pinned.forEach { binding.contentList.addView(announcementCard(it, showBody = false)) }
        }
        binding.contentList.addView(sectionLabel("최근 공지"))
        recent.forEach { binding.contentList.addView(announcementCard(it, showBody = false)) }
        announcementNextCursor?.let {
            binding.contentList.addView(compactEventCard("더 불러오기", "이전 공지를 이어서 확인합니다.", emptyList()).apply {
                isClickable = true
                isFocusable = true
                setOnClickListener { loadAnnouncements(reset = false) }
            })
        }
    }

    private fun loadAnnouncements(reset: Boolean) {
        lifecycleScope.launch {
            val page = serverRepository.announcements(if (reset) null else announcementNextCursor)
            announcementItems = if (reset) page.items else (announcementItems + page.items).distinctBy { it.id }
            announcementNextCursor = page.nextCursor
            announcementReadStore.initialize(announcementItems)
            binding.contentRefresh.isRefreshing = false
            if (navigationHistory.currentScreen == HubScreen.ANNOUNCEMENTS) refreshScreenWhenIdle(HubScreen.ANNOUNCEMENTS, ::renderAnnouncements)
        }
    }

    private fun announcementCard(announcement: ServiceAnnouncement, showBody: Boolean): MaterialCardView {
        val unread = AnnouncementPolicy.readKey(announcement.id, announcement.attentionRevision) !in announcementReadKeys
        val meta = mutableListOf(announcement.type.displayName, announcement.severity.displayName)
        if (unread) meta += "읽지 않음"
        if (announcement.resolvedAt != null) meta += "해결됨"
        meta += announcement.publishedAt.toString().take(10)
        return compactEventCard(
            announcement.title,
            if (showBody) announcement.body else announcement.summary,
            meta,
        ).apply {
            isClickable = true
            isFocusable = true
            setOnClickListener {
                selectedAnnouncementId = announcement.id
                markAnnouncementRead(announcement)
                pushScreen(HubScreen.ANNOUNCEMENT_DETAIL)
            }
        }
    }

    private fun markAnnouncementRead(announcement: ServiceAnnouncement) {
        announcementReadKeys = announcementReadKeys + AnnouncementPolicy.readKey(announcement.id, announcement.attentionRevision)
        updateAnnouncementAction()
        lifecycleScope.launch { announcementReadStore.markRead(announcement) }
    }

    private fun renderAnnouncementDetail() {
        startScreen("announcement_detail", "공지사항", "")
        val id = selectedAnnouncementId
        val announcement = announcementItems.firstOrNull { it.id == id } ?: announcementsSummary.pinned?.takeIf { it.id == id }
        if (id == null) {
            binding.contentList.addView(compactEventCard("공지를 찾을 수 없습니다", "공지 목록에서 다시 선택해 주세요.", emptyList()))
            return
        }
        if (announcement == null) {
            binding.contentList.addView(compactEventCard("공지 불러오는 중", "상세 내용을 확인하고 있습니다.", emptyList()))
            lifecycleScope.launch {
                serverRepository.announcementDetail(id)?.let {
                    announcementItems = (announcementItems + it).distinctBy(ServiceAnnouncement::id)
                    markAnnouncementRead(it)
                    refreshScreenWhenIdle(HubScreen.ANNOUNCEMENT_DETAIL, ::renderAnnouncementDetail)
                }
            }
            return
        }
        markAnnouncementRead(announcement)
        binding.contentList.addView(sectionLabel(announcement.type.displayName + " · " + announcement.severity.displayName))
        binding.contentList.addView(screenTitle(announcement.title))
        binding.contentList.addView(screenCopy("게시 ${announcement.publishedAt.toString().take(16).replace('T', ' ')} · 수정 ${announcement.updatedAt.toString().take(16).replace('T', ' ')}"))
        binding.contentList.addView(compactEventCard("", announcement.body, listOfNotNull(if (announcement.resolvedAt != null) "해결됨" else null)))
        if (!announcement.actionLabel.isNullOrBlank() && (!announcement.appDeepLink.isNullOrBlank() || !announcement.externalUrl.isNullOrBlank())) {
            binding.contentList.addView(compactEventCard(announcement.actionLabel, "관련 화면 또는 링크를 엽니다.", emptyList()).apply {
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    announcement.appDeepLink?.let { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) }
                        ?: openExternalUrl(announcement.externalUrl)
                }
            })
        }
        announcement.externalUrl?.let { url ->
            binding.contentList.addView(compactEventCard("외부 링크", url, emptyList()).apply {
                isClickable = true
                isFocusable = true
                setOnClickListener { openExternalUrl(url) }
            })
        }
    }

    private fun loadHomeRecentSongsIfNeeded() {
        if (homeRecentSongs != null || isLoadingHomeRecentSongs) return
        isLoadingHomeRecentSongs = true
        CoroutineScope(Dispatchers.Main).launch {
            homeRecentSongs = serverRepository.recentSongs(limit = 5)
            isLoadingHomeRecentSongs = false
            if (navigationHistory.currentScreen == HubScreen.HOME) {
                refreshScreenWhenIdle(HubScreen.HOME, ::renderHome)
            }
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
                navigateToRoot(HubScreen.LIVE)
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
        binding.contentList.addView(reservationSummaryCard())
        binding.contentList.addView(filterPanel(MainUiPolicy.goodsEventsTopFilterGroups(selectedFilter)) { _, optionId ->
            selectedFilter = optionId
            if (goodsEventsDays.isEmpty()) renderGoodsEvents()
            else renderServerGoodsEvents(goodsEventsDays, goodsEvents)
        })
        binding.contentList.addView(serverStatusStrip())
        loadServerGoodsEvents()
    }

    private fun loadServerGoodsEvents() {
        binding.contentList.addView(loadingCard(MainUiPolicy.goodsEventsLoadingPresentation()))
        CoroutineScope(Dispatchers.Main).launch {
            val today = LocalDate.now()
            val from = today.minusMonths(1)
            val to = today.plusMonths(3)
            val days = serverRepository.hubCalendarDays(from, to, "Asia/Seoul")
            val listedEvents = serverRepository.hubEvents("all", from, to)
            val listedEventIds = listedEvents.mapTo(mutableSetOf()) { it.id }
            val missingEventIds = days
                .flatMap { it.entries }
                .asSequence()
                .filter { it.entryKind == HubCalendarEntryKind.HUB_EVENT }
                .map { it.eventId }
                .filterNot(listedEventIds::contains)
                .distinct()
                .toList()
            val resolvedMissingEvents = missingEventIds.mapNotNull { serverRepository.hubEventDetail(it) }
            val events = (listedEvents + resolvedMissingEvents).distinctBy { it.id }
            goodsEventsSelectedMonth = YearMonth.from(today)
            goodsEventsDays = days
            goodsEvents = events
            if (navigationHistory.currentScreen == HubScreen.GOODS_EVENTS) {
                refreshScreenWhenIdle(HubScreen.GOODS_EVENTS) {
                    renderServerGoodsEvents(days, events)
                }
            }
        }
    }

    private fun renderServerGoodsEvents(days: List<HubCalendarDay>, events: List<HubEvent>) {
        goodsEventsDays = days
        goodsEvents = events
        val filteredDays = filteredGoodsEventDays(days)
        val filteredEvents = filteredGoodsEvents(events)
        val monthDays = monthDaysForGoodsEvents(filteredDays)
        binding.contentList.removeAllViews()
        resetTopBarScrollSources()
        if (shouldUseGoodsEventsTwoPane()) {
            renderServerGoodsEventsTwoPane(filteredDays, filteredEvents, monthDays)
            return
        }
        renderGoodsEventsListInto(binding.contentList, filteredDays, filteredEvents, monthDays)
        binding.contentList.addView(
            noticeCard("방송/라이브/업로드와 팬 주최 이벤트는 굿즈/행사 피드에 포함하지 않습니다.")
        )
    }

    private fun filteredGoodsEventDays(days: List<HubCalendarDay>): List<HubCalendarDay> =
        days.mapNotNull { day ->
            val entries = day.entries.filter { entry ->
                MainUiPolicy.goodsEventMatchesFilter(
                    selectedFilter,
                    entry.category,
                    entry.status,
                    entry.participationMode,
                )
            }
            day.copy(entries = entries).takeIf { entries.isNotEmpty() }
        }

    private fun filteredGoodsEvents(events: List<HubEvent>): List<HubEvent> =
        events.filter { event ->
            MainUiPolicy.goodsEventMatchesFilter(
                selectedFilter,
                event.category,
                event.status,
                event.participationMode,
            )
        }

    private fun monthDaysForGoodsEvents(days: List<HubCalendarDay>): List<HubCalendarDay> =
        days.filter { it.date.take(7) == goodsEventsSelectedMonth.toString() }

    private fun renderServerGoodsEventsTwoPane(
        filteredDays: List<HubCalendarDay>,
        filteredEvents: List<HubEvent>,
        monthDays: List<HubCalendarDay>,
    ) {
        val paneRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            isBaselineAligned = false
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                twoPaneViewportHeight(),
            )
        }
        val listPane = scrollablePane()
        val detailPane = scrollablePane().apply {
            scrollView.background = rounded(color(R.color.hub_surface), dp(16), color(R.color.hub_line))
            content.setPadding(dp(10), dp(10), dp(10), dp(10))
        }
        val paneWeights = if (shouldUseGoodsEventsFoldAwarePane()) {
            1f to 1f
        } else {
            1f to 1f
        }
        paneRow.addView(
            listPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, paneWeights.first).apply {
                marginEnd = dp(8)
            },
        )
        paneRow.addView(
            detailPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, paneWeights.second).apply {
                marginStart = dp(8)
            },
        )
        activeTwoPaneDetailPane = detailPane.scrollView
        binding.contentList.addView(paneRow)
        renderGoodsEventsListInto(listPane.content, filteredDays, filteredEvents, monthDays)
        listPane.content.addView(
            noticeCard("방송/라이브/업로드와 팬 주최 이벤트는 굿즈/행사 피드에 포함하지 않습니다.")
        )
        renderGoodsEventDetailPane(detailPane.content)
    }

    private fun renderGoodsEventsListInto(
        container: LinearLayout,
        filteredDays: List<HubCalendarDay>,
        filteredEvents: List<HubEvent>,
        monthDays: List<HubCalendarDay>,
    ) {
        container.addView(reservationSummaryCard())
        container.addView(filterPanel(MainUiPolicy.goodsEventsTopFilterGroups(selectedFilter)) { _, optionId ->
            selectedFilter = optionId
            renderServerGoodsEvents(goodsEventsDays, goodsEvents)
        })
        container.addView(serverStatusStrip())
        container.addView(
            HubEventsCalendarView(
                context = this,
                days = filteredDays,
                initialMonth = goodsEventsSelectedMonth,
                showModeControls = false,
                showCollapseControl = true,
                initiallyExpanded = goodsEventsCalendarExpanded,
                onExpandedChanged = { expanded -> goodsEventsCalendarExpanded = expanded },
                onMonthChanged = { month ->
                    goodsEventsSelectedMonth = month
                    if (navigationHistory.currentScreen == HubScreen.GOODS_EVENTS) {
                        renderServerGoodsEvents(goodsEventsDays, goodsEvents)
                    }
                },
            ) { entry -> onGoodsEventSelected(entry.eventId) }
        )
        val feedRows = CalendarUiPolicy.feedRenderRowsForMonth(
            days = monthDays,
            month = goodsEventsSelectedMonth,
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
                container.addView(hubEventCard(event = event))
            } ?: container.addView(localCalendarEntryRow(row.entry))
        }
    }

    private fun reservationSummaryCard(): MaterialCardView = baseCard(HubCardStyle.INTERACTIVE).apply {
        val now = Instant.now()
        val activeDrafts = reservationDrafts.filter { it.expiresAt.isAfter(now) }
        val upcoming = reservationRecords.filter {
            it.status == ReservationStatus.CONFIRMED && (it.effectiveStartsAt?.isAfter(now) ?: true)
        }.sortedBy { it.effectiveStartsAt ?: Instant.MAX }
        isClickable = true
        isFocusable = true
        contentDescription = "내 예약 및 구매, 확인 필요 ${activeDrafts.size}개, 다가오는 예약 ${upcoming.size}개"
        setOnClickListener { pushScreen(HubScreen.RESERVATIONS) }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(14))
            addView(TextView(context).apply {
                text = "내 예약·구매"
                textSize = 17f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(color(R.color.hub_text))
            })
            addView(TextView(context).apply {
                text = "확인 필요 ${activeDrafts.size}개 · 다가오는 예약 ${upcoming.size}개"
                textSize = 13f
                setTextColor(color(R.color.hub_text_muted))
                setPadding(0, dp(5), 0, 0)
            })
            upcoming.firstOrNull()?.effectiveStartsAt?.let { startsAt ->
                addView(TextView(context).apply {
                    text = "가장 가까운 예약 · ${reservationDateFormatter.format(startsAt)}"
                    textSize = 12f
                    setTextColor(color(R.color.hub_primary))
                    setPadding(0, dp(6), 0, 0)
                })
            }
            addView(TextView(context).apply {
                text = "전체 내역 보기  ›"
                textSize = 13f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(color(R.color.hub_primary))
                setPadding(0, dp(10), 0, 0)
            })
        })
    }

    private fun renderReservations() {
        startScreen("reservations", "내 예약·구매", "외부 결제 여부를 자동 검증하지 않으며 사용자가 확인한 기록만 이 기기에 저장합니다.")
        binding.contentList.addView(detailActionButton("빠른 설정에 예약 추가 버튼 넣기", false) {
            ReservationSystemShortcutCoordinator.requestTile(this)
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)).apply { bottomMargin = dp(10) })
        val activeDrafts = reservationDrafts.filter { it.expiresAt.isAfter(Instant.now()) }
        if (activeDrafts.isNotEmpty()) {
            binding.contentList.addView(sectionLabel("확인 필요"))
            activeDrafts.sortedByDescending(ReservationDraft::openedAt).forEach { draft ->
                binding.contentList.addView(baseCard(HubCardStyle.COMPACT).apply {
                    addView(LinearLayout(context).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding(dp(15), dp(13), dp(15), dp(13))
                        addView(TextView(context).apply { text = draft.eventSnapshot.title; textSize = 15f; typeface = Typeface.DEFAULT_BOLD; setTextColor(color(R.color.hub_text)) })
                        addView(TextView(context).apply { text = "예약 진행 중 · ${draft.providerHost}"; textSize = 12f; setTextColor(color(R.color.hub_text_muted)); setPadding(0, dp(4), 0, 0) })
                        addView(LinearLayout(context).apply {
                            orientation = LinearLayout.HORIZONTAL
                            addView(detailActionButton("취소", false) {
                                lifecycleScope.launch { reservationRepository.deleteDraft(draft) }
                            }, LinearLayout.LayoutParams(0, dp(44), 1f).apply { marginEnd = dp(5) })
                            addView(detailActionButton("완료로 추가", true) {
                                startActivity(Intent(this@MainActivity, ReservationQuickAddActivity::class.java).putExtra(ReservationQuickAddActivity.EXTRA_SESSION_ID, draft.sessionId.toString()))
                            }, LinearLayout.LayoutParams(0, dp(44), 1f).apply { marginStart = dp(5) })
                        }.apply { setPadding(0, dp(10), 0, 0) })
                    })
                })
            }
        }
        val sections = ReservationListPolicy.sections(reservationRecords)
        addReservationRecordSection("다가오는 예약", sections.upcoming)
        addReservationRecordSection("지난 내역", sections.past)
        if (activeDrafts.isEmpty() && reservationRecords.isEmpty()) {
            binding.contentList.addView(compactEventCard("저장된 예약 없음", "굿즈·행사에서 티켓, 구매 또는 예약 링크를 열면 진행 중인 항목이 여기에 표시됩니다.", listOf("기기 로컬 저장")))
        }
    }

    private fun addReservationRecordSection(title: String, records: List<ReservationRecord>) {
        if (records.isEmpty()) return
        binding.contentList.addView(sectionLabel(title))
        records.forEach { record ->
            binding.contentList.addView(baseCard(HubCardStyle.INTERACTIVE).apply {
                isClickable = true
                isFocusable = true
                setOnClickListener {
                    selectedReservationId = record.id
                    pushScreen(HubScreen.RESERVATION_DETAIL)
                }
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(dp(15), dp(13), dp(15), dp(13))
                    addView(TextView(context).apply { text = record.displayTitle; textSize = 15f; typeface = Typeface.DEFAULT_BOLD; setTextColor(color(R.color.hub_text)) })
                    addView(TextView(context).apply {
                        text = "${reservationStatusLabel(record.status)} · ${record.eventSnapshot.sourceLabel}"
                        textSize = 12f; setTextColor(color(R.color.hub_text_muted)); setPadding(0, dp(4), 0, 0)
                    })
                    record.effectiveStartsAt?.let { addView(TextView(context).apply { text = reservationDateFormatter.format(it); textSize = 12f; setTextColor(color(R.color.hub_text_muted)); setPadding(0, dp(4), 0, 0) }) }
                    if (record.reservationDetailUrl != null) addView(TextView(context).apply { text = "예약 상세 링크 있음"; textSize = 11f; setTextColor(color(R.color.hub_primary)); setPadding(0, dp(5), 0, 0) })
                })
            })
        }
    }

    private fun renderReservationDetail() {
        val record = reservationRecords.firstOrNull { it.id == selectedReservationId }
        startScreen("reservation_detail", "예약 상세", "예약 정보와 링크는 이 기기에만 저장됩니다.")
        if (record == null) {
            binding.contentList.addView(compactEventCard("예약을 찾을 수 없음", "목록에서 다시 선택해 주세요.", listOf("로컬 기록")))
            return
        }
        binding.contentList.addView(compactEventCard(record.displayTitle, buildList {
            add(reservationStatusLabel(record.status))
            record.effectiveStartsAt?.let { add(reservationDateFormatter.format(it)) }
            record.effectiveVenue?.let(::add)
            record.optionText?.let { add("옵션 · $it") }
            record.quantity?.let { add("수량 · $it") }
            record.referenceNumber?.let { add("예약번호 · $it") }
            record.note?.let(::add)
        }.joinToString("\n"), listOf(record.kind.name.lowercase(), "기기 로컬 저장")))
        val latestEvent = record.eventId?.let { eventId -> goodsEvents.firstOrNull { it.id == eventId } }
        if (ReservationDisplayPolicy.officialEventChanged(record, latestEvent?.title, latestEvent?.startsAt)) {
            binding.contentList.addView(compactEventCard(
                "공식 일정 변경됨",
                "저장 당시 정보와 현재 공식 행사 정보가 다릅니다. 사용자 수정값과 예약 상태는 자동으로 바꾸지 않습니다.",
                listOf("확인 필요"),
            ))
        }
        if (latestEvent?.status == dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus.CANCELLED) {
            binding.contentList.addView(compactEventCard(
                "공식 행사 취소 안내",
                "공식 행사가 취소되었습니다. 사용자의 예약 상태는 자동으로 취소하지 않습니다.",
                listOf("공식 정보"),
            ))
        }
        record.preferredOpenUrl?.let { url ->
            binding.contentList.addView(detailActionButton("예약 링크 열기", true) { openExternalUrl(url) }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)))
        }
        binding.contentList.addView(detailActionButton("수정", false) { pushScreen(HubScreen.RESERVATION_EDIT) }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)).apply { topMargin = dp(10) })
        binding.contentList.addView(detailActionButton("예약 삭제", false) {
            AlertDialog.Builder(this).setTitle("예약 삭제").setMessage("이 기기에서 예약 기록을 삭제할까요?")
                .setNegativeButton("취소", null)
                .setPositiveButton("삭제") { _, _ ->
                    lifecycleScope.launch {
                        reservationRepository.delete(record)
                        popScreen()
                        Snackbar.make(binding.root, "예약 기록을 삭제했습니다.", Snackbar.LENGTH_LONG)
                            .setAction("실행 취소") {
                                lifecycleScope.launch { reservationRepository.update(record) }
                            }
                            .show()
                    }
                }
                .show()
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)).apply { topMargin = dp(10) })
    }

    private fun renderReservationEdit() {
        val record = reservationRecords.firstOrNull { it.id == selectedReservationId }
        startScreen("reservation_edit", "예약 수정", "민감할 수 있는 링크와 예약번호는 서버나 로그로 전송하지 않습니다.")
        if (record == null) return
        val title = reservationEditField("표시 제목", record.displayTitleOverride.orEmpty())
        val startsAt = reservationDateTimeInput("시작 날짜와 시각", record.startsAtOverride)
        val endsAt = reservationDateTimeInput("종료 날짜와 시각", record.endsAtOverride)
        val venue = reservationEditField("장소", record.venueOverride.orEmpty())
        val detailUrl = reservationEditField("예약 상세 URL", record.reservationDetailUrl.orEmpty())
        val historyUrl = reservationEditField("제공사 내역 URL", record.providerHistoryUrl.orEmpty())
        val option = reservationEditField("좌석 또는 상품 옵션", record.optionText.orEmpty())
        val quantity = reservationEditField("수량", record.quantity?.toString().orEmpty()).apply {
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
        }
        val reference = reservationEditField("예약번호", record.referenceNumber.orEmpty())
        val note = reservationEditField("메모", record.note.orEmpty(), multiline = true)
        var status = record.status
        val statusButton = detailActionButton("상태 · ${reservationStatusLabel(status)}", false) {}
        statusButton.setOnClickListener {
            PopupMenu(this, statusButton).apply {
                ReservationStatus.entries.forEachIndexed { index, value -> menu.add(0, index, index, reservationStatusLabel(value)) }
                setOnMenuItemClickListener { item -> status = ReservationStatus.entries[item.itemId]; statusButton.text = "상태 · ${reservationStatusLabel(status)}"; true }
                show()
            }
        }
        reservationEditHasUnsavedChanges = {
            status != record.status ||
                title.text.toString().trim().takeIf(String::isNotEmpty) != record.displayTitleOverride ||
                startsAt.value != record.startsAtOverride ||
                endsAt.value != record.endsAtOverride ||
                venue.text.toString().trim().takeIf(String::isNotEmpty) != record.venueOverride ||
                detailUrl.text.toString().trim().takeIf(String::isNotEmpty) != record.reservationDetailUrl ||
                historyUrl.text.toString().trim().takeIf(String::isNotEmpty) != record.providerHistoryUrl ||
                option.text.toString().trim().takeIf(String::isNotEmpty) != record.optionText ||
                quantity.text.toString().trim().takeIf(String::isNotEmpty) != record.quantity?.toString() ||
                reference.text.toString().trim().takeIf(String::isNotEmpty) != record.referenceNumber ||
                note.text.toString().trim().takeIf(String::isNotEmpty) != record.note
        }
        binding.contentList.addView(statusButton, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)).apply { bottomMargin = dp(10) })
        binding.contentList.addView(detailActionButton("저장", true) {
            val detailValidation = detailUrl.text.toString().takeIf(String::isNotBlank)?.let(ReservationURLPolicy::validate)
            val historyValidation = historyUrl.text.toString().takeIf(String::isNotBlank)?.let(ReservationURLPolicy::validate)
            if (detailValidation?.isValid == false || historyValidation?.isValid == false) {
                Toast.makeText(this, "HTTPS 링크를 확인해 주세요.", Toast.LENGTH_SHORT).show()
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
                Toast.makeText(this, "종료 시각은 시작 시각보다 뒤여야 합니다.", Toast.LENGTH_SHORT).show()
                return@detailActionButton
            }
            val save: () -> Unit = {
                lifecycleScope.launch {
                    runCatching {
                        reservationRepository.update(record.copy(
                            status = status,
                            displayTitleOverride = title.text.toString().trim().takeIf(String::isNotEmpty),
                            startsAtOverride = startsAt.value,
                            endsAtOverride = endsAt.value,
                            venueOverride = venue.text.toString().trim().takeIf(String::isNotEmpty),
                            reservationDetailUrl = detailValidation?.normalizedUrl,
                            providerHistoryUrl = historyValidation?.normalizedUrl,
                            optionText = option.text.toString().trim().takeIf(String::isNotEmpty),
                            quantity = parsedQuantity,
                            referenceNumber = reference.text.toString().trim().takeIf(String::isNotEmpty),
                            note = note.text.toString().trim().takeIf(String::isNotEmpty),
                            updatedAt = Instant.now(),
                        ))
                    }.onSuccess {
                        reservationEditHasUnsavedChanges = null
                        popScreen()
                    }.onFailure {
                        Toast.makeText(this@MainActivity, "예약 변경 내용을 저장하지 못했습니다.", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            val confirmSensitiveAndSave = {
                if (detailValidation?.isSensitive == true || historyValidation?.isSensitive == true) {
                    AlertDialog.Builder(this).setTitle("민감할 수 있는 링크").setMessage("인증 정보가 포함될 수 있습니다. 이 기기에만 저장할까요?")
                        .setNegativeButton("취소", null).setPositiveButton("로컬 저장") { _, _ -> save() }.show()
                } else save()
            }
            lifecycleScope.launch {
                val detailURL = detailValidation?.normalizedUrl
                val duplicate = detailURL != null &&
                    detailURL != record.reservationDetailUrl &&
                    reservationRepository.hasReservationDetailUrl(detailURL, excludingId = record.id)
                if (duplicate) {
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("이미 저장된 링크")
                        .setMessage("같은 예약 상세 링크가 다른 기록에 있습니다. 그래도 저장할까요?")
                        .setNegativeButton("취소", null)
                        .setPositiveButton("그래도 저장") { _, _ -> confirmSensitiveAndSave() }
                        .show()
                } else {
                    confirmSensitiveAndSave()
                }
            }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(50)).apply { topMargin = dp(12) })
    }

    private fun reservationDateTimeInput(label: String, value: Instant?): ReservationDateTimeInput {
        val field = EditText(this).apply {
            hint = label
            isFocusable = false
            isClickable = true
            contentDescription = "$label 선택"
            setText(value?.let(reservationDateFormatter::format).orEmpty())
        }
        val input = ReservationDateTimeInput(field, value)
        field.setOnClickListener { showReservationDateTimePicker(input) }
        binding.contentList.addView(LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(field, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(MaterialButton(context).apply {
                text = "지우기"
                contentDescription = "$label 지우기"
                setOnClickListener {
                    input.value = null
                    field.setText("")
                }
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) })
        return input
    }

    private fun showReservationDateTimePicker(input: ReservationDateTimeInput) {
        val zone = ZoneId.of("Asia/Seoul")
        val initial = input.value?.atZone(zone) ?: ZonedDateTime.now(zone)
        DatePickerDialog(this, { _, year, month, day ->
            val selectedDate = LocalDate.of(year, month + 1, day)
            TimePickerDialog(this, { _, hour, minute ->
                input.value = ZonedDateTime.of(selectedDate, LocalTime.of(hour, minute), zone).toInstant()
                input.field.setText(input.value?.let(reservationDateFormatter::format))
            }, initial.hour, initial.minute, true).show()
        }, initial.year, initial.monthValue - 1, initial.dayOfMonth).show()
    }

    private fun reservationEditField(hint: String, value: String, multiline: Boolean = false): EditText = EditText(this).apply {
        this.hint = hint
        setText(value)
        if (multiline) minLines = 3
        binding.contentList.addView(this, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) })
    }

    private fun reservationStatusLabel(status: ReservationStatus): String = when (status) {
        ReservationStatus.PENDING_CONFIRMATION -> "확인 필요"
        ReservationStatus.CONFIRMED -> "예약 완료"
        ReservationStatus.CANCELLED -> "취소"
        ReservationStatus.REFUNDED -> "환불"
        ReservationStatus.COMPLETED -> "이용 완료"
    }

    private fun openHubEventLink(
        event: HubEvent,
        scheduleItem: dev.minepacu.stelliveeventnotifier.core.model.HubEventScheduleItem?,
        link: dev.minepacu.stelliveeventnotifier.core.model.HubEventLink,
    ) {
        val kind = ReservationActionPolicy.kindFor(link.kind, scheduleItem?.cancelledAt)
        if (kind == null) {
            openExternalUrl(link.url)
            return
        }
        reservationExternalFlowActive = true
        ReservationExternalLinkPolicy.openFailOpen(
            openExternal = { openExternalUrl(link.url) },
            recordBestEffort = {
                lifecycleScope.launch {
                    val snapshot = ReservationEventSnapshot(
                        title = event.title,
                        category = event.category.name,
                        startsAt = scheduleItem?.startsAt ?: event.startsAt,
                        endsAt = scheduleItem?.endsAt ?: event.endsAt,
                        venueName = event.venueName,
                        venueAddress = event.venueAddress,
                        sourceLabel = event.sourceLabel,
                        imageUrl = event.image?.url?.takeIf { HubEventImagePolicy.canDisplay(event.image) },
                    )
                    runCatching {
                        reservationRepository.begin(event.id, scheduleItem?.id, kind, snapshot, link.url)
                    }.onSuccess { draft ->
                        externallyOpenedReservationSessionIds += draft.sessionId
                        ReservationTileService.requestRefresh(this@MainActivity)
                        if (reservationExternalFlowLeftApp) {
                            liveClockHandler.postDelayed(::evaluateReservationReturnPrompt, 350L)
                        }
                    }.onFailure {
                        pendingReservationRecordingFailure = true
                        if (reservationExternalFlowLeftApp) evaluateReservationReturnPrompt()
                    }
                }
            },
            onRecordingFailure = { pendingReservationRecordingFailure = true },
        )
    }

    private fun evaluateReservationReturnPrompt() {
        if (!lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) return
        if (pendingReservationRecordingFailure) {
            pendingReservationRecordingFailure = false
            Snackbar.make(
                binding.root,
                "외부 페이지는 열었지만 예약 진행 정보를 이 기기에 저장하지 못했습니다.",
                Snackbar.LENGTH_LONG,
            ).setAction("확인") {}.show()
        }
        when (val decision = ReservationReturnPromptPolicy.decision(
            drafts = reservationDrafts,
            externallyOpenedSessionIds = externallyOpenedReservationSessionIds,
            promptedSessionIds = promptedReservationSessionIds,
        )) {
            ReservationReturnPromptDecision.None -> Unit
            is ReservationReturnPromptDecision.Single -> {
                promptedReservationSessionIds += decision.sessionId
                showReservationReturnSnackbar(
                    message = "예매·구매를 마치셨나요? 완료 내역을 직접 추가할 수 있습니다.",
                    primaryLabel = "완료 내역 추가",
                ) {
                    startActivity(Intent(this, ReservationQuickAddActivity::class.java).putExtra(
                        ReservationQuickAddActivity.EXTRA_SESSION_ID,
                        decision.sessionId.toString(),
                    ))
                }
            }
            is ReservationReturnPromptDecision.Multiple -> {
                promptedReservationSessionIds += decision.sessionIds
                showReservationReturnSnackbar(
                    message = "확인이 필요한 예약이 여러 건 있습니다.",
                    primaryLabel = "목록 보기",
                ) { pushScreen(HubScreen.RESERVATIONS) }
            }
        }
    }

    private fun showReservationReturnSnackbar(message: String, primaryLabel: String, onPrimary: () -> Unit) {
        val snackbar = Snackbar.make(binding.root, message, Snackbar.LENGTH_INDEFINITE)
            .setAction("아직 아니에요") {}
        val content = snackbar.view.findViewById<TextView>(com.google.android.material.R.id.snackbar_text).parent as? ViewGroup
        content?.addView(MaterialButton(this).apply {
            text = primaryLabel
            isAllCaps = false
            contentDescription = primaryLabel
            setOnClickListener {
                snackbar.dismiss()
                onPrimary()
            }
        }, (content.childCount - 1).coerceAtLeast(0))
        snackbar.show()
    }

    private fun onGoodsEventSelected(eventId: String) {
        val selection = CalendarUiPolicy.feedSelection(eventId)
        when (HubEventsPanePolicy.selectionMode(currentAdaptiveSpec)) {
            GoodsEventSelectionMode.UPDATE_INLINE_DETAIL -> crossFadeTwoPaneSelection(selection.transitionKey) {
                selectedHubEventId = selection.eventId
                selectedHubEventScheduleItemId = null
                serverHubEventDetailLoadedId = null
                renderServerGoodsEvents(goodsEventsDays, goodsEvents)
            }
            GoodsEventSelectionMode.NAVIGATE_TO_DETAIL -> {
                selectedHubEventId = selection.eventId
                selectedHubEventScheduleItemId = null
                serverHubEventDetailLoadedId = null
                pushScreen(HubScreen.GOODS_EVENT_DETAIL)
            }
        }
    }

    private fun shouldUseGoodsEventsTwoPane(): Boolean =
        HubEventsPanePolicy.shouldUseTwoPane(currentAdaptiveSpec)

    private fun shouldUseGoodsEventsFoldAwarePane(): Boolean =
        HubEventsPanePolicy.shouldUseFoldAwarePane(currentAdaptiveSpec)

    private fun renderGoodsEventDetailPane(container: LinearLayout) {
        val eventId = selectedHubEventId
        if (eventId == null) {
            renderGoodsEventEmptyDetailPane(container)
            return
        }
        if (serverHubEventDetailLoadedId != eventId) {
            container.addView(loadingCard(MainUiPolicy.hubEventDetailLoadingPresentation()))
            CoroutineScope(Dispatchers.Main).launch {
                serverHubEventDetail = serverRepository.hubEventDetail(eventId)
                serverHubEventDetailLoadedId = eventId
                if (navigationHistory.currentScreen == HubScreen.GOODS_EVENTS && selectedHubEventId == eventId) {
                    refreshScreenWhenIdle(HubScreen.GOODS_EVENTS) {
                        renderServerGoodsEvents(goodsEventsDays, goodsEvents)
                    }
                }
            }
            return
        }
        val event = currentSelectedHubEvent()
        if (event == null) {
            container.addView(compactEventCard("항목 없음", "목록에서 다시 선택해 주세요.", listOf("굿즈/행사")))
            return
        }
        renderHubEventDetailInto(container, event, fullScreen = false)
    }

    private fun renderGoodsEventEmptyDetailPane(container: LinearLayout) {
        container.addView(
            compactEventCard(
                title = "굿즈/행사를 선택해 상세 정보를 확인하세요.",
                body = "왼쪽 목록이나 캘린더에서 항목을 선택하면 이 영역에 상세 정보가 표시됩니다.",
                pills = listOf("상세")
            )
        )
    }

    private fun localCalendarEntryRow(entry: HubCalendarEntry): MaterialCardView =
        compactEventCard(
            title = CalendarUiPolicy.displayTitle(entry),
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

private fun calendarDayHeader(date: String): SectionHeaderView =
        SectionHeaderView(this).bind(date).apply {
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
            binding.contentList.addView(loadingCard(MainUiPolicy.hubEventDetailLoadingPresentation()))
            CoroutineScope(Dispatchers.Main).launch {
                serverHubEventDetail = serverRepository.hubEventDetail(eventId)
                serverHubEventDetailLoadedId = eventId
                if (navigationHistory.currentScreen == HubScreen.GOODS_EVENT_DETAIL && selectedHubEventId == eventId) {
                    refreshScreenWhenIdle(HubScreen.GOODS_EVENT_DETAIL, ::renderHubEventDetail)
                }
            }
            return
        }
        val event = currentSelectedHubEvent()
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
            title = "",
            role = ""
        )
        binding.collapsedTitle.text = ""
        binding.collapsedRole.text = ""
        binding.contentList.removeAllViews()
        resetTopBarScrollSources()
        applyContentTopPadding(underTopBar = true)
        renderHubEventDetailInto(binding.contentList, event, fullScreen = true)
    }

    private fun currentSelectedHubEvent(): HubEvent? =
        serverHubEventDetail?.takeIf { it.id == selectedHubEventId }
            ?: goodsEvents.firstOrNull { it.id == selectedHubEventId }
            ?: repository.hubEvents.firstOrNull { it.id == selectedHubEventId }

    private fun renderHubEventDetailInto(container: LinearLayout, event: HubEvent, fullScreen: Boolean) {
        val resolvedExpandedIds = HubEventLinkPolicy.resolvedExpandedScheduleItemIds(
            previousEventId = expandedHubEventScheduleEventId,
            eventId = event.id,
            currentIds = expandedHubEventScheduleItemIds,
            highlightedScheduleItemId = selectedHubEventScheduleItemId,
        )
        expandedHubEventScheduleItemIds.clear()
        expandedHubEventScheduleItemIds.addAll(resolvedExpandedIds)
        expandedHubEventScheduleEventId = event.id
        container.addView(hubEventDetailHero(event).apply {
            if (!fullScreen) {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(220),
                ).apply {
                    bottomMargin = dp(8)
                }
            }
        })
        container.addView(hubEventDetailActions(event))
        container.addView(sectionLabel(HubEventDetailFormatting.SummaryLabel).let { if (fullScreen) it.withDetailHorizontalMargins() else it })
        container.addView(
            compactEventCard(
                title = "",
                body = event.summary ?: "공식 출처 기반 굿즈/행사 정보입니다.",
                pills = emptyList()
            ).let { if (fullScreen) it.withDetailHorizontalMargins() else it }
        )
        val timeline = HubEventDetailFormatting.timeline(event)
        if (HubEventDetailFormatting.hasTimelineSchedule(event) && timeline.isNotEmpty()) {
            container.addView(sectionLabel("세부 일정").let { if (fullScreen) it.withDetailHorizontalMargins() else it })
            val effectivePrimaryId = HubEventLinkPolicy.effectivePrimaryScheduleItemId(event)
            timeline.forEach { item ->
                val highlighted = item.schedule.id == selectedHubEventScheduleItemId
                val card = hubEventScheduleCard(
                    item = item,
                    highlighted = highlighted,
                    isEffectivePrimary = item.schedule.id == effectivePrimaryId,
                    initiallyExpanded = item.schedule.id in expandedHubEventScheduleItemIds,
                )
                    .let { if (fullScreen) it.withDetailHorizontalMargins() else it }
                container.addView(card)
            }
        }
        container.addView(sectionLabel("행사 정보").let { if (fullScreen) it.withDetailHorizontalMargins() else it })
        container.addView(
            settingsPanel(
                rows = HubEventDetailFormatting.rows(event).map { row ->
                    SettingRow(row.label, row.value, null, null)
                }
            ).let { if (fullScreen) it.withDetailHorizontalMargins() else it }
        )
        container.addView(noticeCard(HubEventDetailFormatting.NoticeText).let { if (fullScreen) it.withDetailHorizontalMargins() else it })
    }

    private fun hubEventScheduleCard(
        item: dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventScheduleTimelineItem,
        highlighted: Boolean,
        isEffectivePrimary: Boolean,
        initiallyExpanded: Boolean,
    ): MaterialCardView = baseCard(HubCardStyle.COMPACT).apply {
        val scheduleCard = this
        val displayTitle = HubEventDetailFormatting.displayTitle(item.schedule)
        val links = HubEventLinkPolicy.resolvedScheduleLinks(item.schedule)
        var expanded = initiallyExpanded
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(10)
        }
        if (highlighted) {
            strokeWidth = dp(2)
            strokeColor = color(R.color.hub_primary)
            setCardBackgroundColor(color(R.color.hub_accent_soft))
        }
        alpha = if (item.schedule.cancelledAt != null) 0.58f else 1f
        val content = LinearLayout(context).apply {
            val detailContainer = this
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(10), dp(14), dp(12))
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
                setPadding(0, dp(7), 0, 0)
            }
            heading.addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(context).apply {
                    text = displayTitle
                    setTextColor(color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                    includeFontPadding = false
                })
                addView(TextView(context).apply {
                    text = item.timingText
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 12f
                    includeFontPadding = false
                    setPadding(0, dp(4), 0, 0)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            val chevron = ImageView(context).apply {
                setImageResource(R.drawable.ic_chevron_down_24)
                imageTintList = ColorStateList.valueOf(color(R.color.hub_text_muted))
                scaleType = ImageView.ScaleType.CENTER
            }
            heading.addView(chevron, LinearLayout.LayoutParams(dp(36), dp(44)))
            addView(heading)

            val details = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                isVisible = expanded
                addView(TextView(context).apply {
                    text = "정확한 일정 · ${item.timingText}"
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 11f
                    setPadding(0, dp(9), 0, 0)
                })
                addView(TextView(context).apply {
                    val precision = if (item.schedule.timePrecision.name == "DATE") "날짜만" else "날짜와 시간"
                    text = "$precision · ${item.schedule.timezone}"
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 11f
                    setPadding(0, dp(5), 0, 0)
                })
                HubEventDetailFormatting.scheduleDescription(item.schedule)?.let { description ->
                    addView(TextView(context).apply {
                        text = description
                        setTextColor(color(R.color.hub_text))
                        textSize = 12f
                        setPadding(0, dp(7), 0, 0)
                    })
                }
                item.schedule.sourceLabel?.takeIf { it.isNotBlank() }?.let { source ->
                    addView(TextView(context).apply {
                        text = "출처 · $source"
                        setTextColor(color(R.color.hub_text_muted))
                        textSize = 11f
                        setPadding(0, dp(6), 0, 0)
                    })
                }
                links.forEach { link ->
                    val label = HubEventLinkPolicy.displayLinkLabel(link)
                    addView(detailActionButton(label, primary = false) { openHubEventLink(currentSelectedHubEvent() ?: return@detailActionButton, item.schedule, link) }.apply {
                        contentDescription = "$label, 외부 링크 열기"
                    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(44)).apply {
                        topMargin = dp(9)
                    })
                }
            }
            addView(details)

            fun updateExpansionPresentation(animate: Boolean) {
                details.isVisible = expanded
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
                if (expanded) expandedHubEventScheduleItemIds.add(item.schedule.id)
                else expandedHubEventScheduleItemIds.remove(item.schedule.id)
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

    private fun scheduleBadgeRow(badges: List<ScheduleBadgePresentation>): ChipGroup = ChipGroup(this).apply {
        isSingleLine = false
        chipSpacingHorizontal = dp(5)
        chipSpacingVertical = dp(4)
        badges.forEach { badge ->
            val (textColorRes, backgroundColorRes) = scheduleBadgeColors(badge.tone)
            addView(Chip(context).apply {
                text = badge.label
                textSize = 10f
                includeFontPadding = false
                gravity = Gravity.CENTER
                textAlignment = View.TEXT_ALIGNMENT_CENTER
                setTextColor(color(textColorRes))
                chipBackgroundColor = ColorStateList.valueOf(color(backgroundColorRes))
                chipStrokeWidth = 0f
                isClickable = false
                isCheckable = false
                isFocusable = false
                setEnsureMinTouchTargetSize(false)
                chipMinHeight = dp(23).toFloat()
                minHeight = dp(23)
                setPadding(0, 0, 0, 0)
            })
        }
    }

    private fun renderLive() {
        startScreen(
            screenId = "live",
            title = getString(R.string.live_title),
            role = "Foreground 상태 갱신은 화면 표시용입니다. 백그라운드 알림은 서버 중심 푸시로 처리합니다."
        )
        binding.contentList.addView(filterPanel(MainUiPolicy.liveTopFilterGroups(selectedLiveStatusFilter)) { _, optionId ->
            selectedLiveStatusFilter = optionId
            renderLive()
        })
        binding.contentList.addView(serverStatusStrip())
        val members = liveStatusFilteredMembersForUi()
        if (members.isEmpty()) {
            binding.contentList.addView(compactEventCard("조건에 맞는 멤버 없음", "다른 라이브 상태 필터를 선택해 확인할 수 있습니다.", listOf("필터")))
        } else {
            members.forEach { member ->
                binding.contentList.addView(liveMemberRow(member, reorderable = true))
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
                settingsInfoCard(
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
        binding.contentList.addView(settingsNoticeCard(MainUiPolicy.historyPolicyNotice()))
    }

private fun renderSongs() {
        pendingSongSearchRender?.let(songSearchHandler::removeCallbacks)
        pendingSongSearchRender = null
        startScreen(
            screenId = "songs",
            title = getString(R.string.songs_title),
            role = "멤버별 오리지널곡과 커버곡을 서버 캐시에서 탐색합니다."
        )
        clearTopFilters()
        if (shouldUseSongsTwoPane()) {
            renderSongsTwoPaneLoading()
        } else {
            binding.contentList.addView(songFilterPanel())
            binding.contentList.addView(serverStatusStrip())
            binding.contentList.addView(loadingCard(MainUiPolicy.songsLoadingPresentation()))
        }

        CoroutineScope(Dispatchers.Main).launch {
            val state = songRenderState(loadSongItemsForCurrentType())
            if (navigationHistory.currentScreen != HubScreen.SONGS) return@launch
            refreshScreenWhenIdle(HubScreen.SONGS) {
                startScreen(
                    screenId = "songs",
                    title = getString(R.string.songs_title),
                    role = "멤버별 오리지널곡과 커버곡을 서버 캐시에서 탐색합니다."
                )
                clearTopFilters()
                if (shouldUseSongsTwoPane()) {
                    renderSongsTwoPane(state)
                } else {
                    binding.contentList.addView(songFilterPanel())
                    renderSongListInto(binding.contentList, state, includeServerStatus = true)
                    registerSongScrollSession(binding.contentScroll, binding.contentList, state, SongScrollSlot.SONGS_SINGLE)
                }
            }
        }
    }

    private suspend fun loadSongItemsForCurrentType(): List<SongCatalogItem> =
        if (cachedSongType == "all" && cachedSongItems.isNotEmpty()) {
            cachedSongItems
        } else {
            serverRepository.songs(generationId = "all", type = "all").let { result ->
                songDiscoveryRepository.initialize(result.serverTime, result.items, result.isAuthoritative)
                cachedSongCatalogAuthoritative = result.isAuthoritative
                result.items.also {
                cachedSongItems = it
                cachedSongType = "all"
                }
            }
        }

    private fun songRenderState(songItems: List<SongCatalogItem>): SongRenderState {
        val songCatalogMembers = serverMembers ?: repository.members
        val visibleSongs = MainUiPolicy.sortSongs(
            songItems.filter { song ->
                (selectedSongType == "all" || song.type.apiValue == selectedSongType) &&
                    MainUiPolicy.songMatchesMember(song, selectedSongMemberFilter) &&
                    MainUiPolicy.songMatchesQuery(song, selectedSongQuery, songCatalogMembers) &&
                    MainUiPolicy.songMatchesLibrary(song, selectedSongLibraryId, songFavoriteIds)
            },
            selectedSongSortId,
        )
        visibleSongLimit = MainUiPolicy.coerceSongVisibleLimit(visibleSongLimit, visibleSongs.size)
        return SongRenderState(
            catalogMembers = songCatalogMembers,
            visibleSongs = visibleSongs,
            displayedSongs = MainUiPolicy.displayedSongItems(visibleSongs, visibleSongLimit),
            displayedCount = MainUiPolicy.displayedSongCount(visibleSongLimit, visibleSongs.size),
            totalFilteredCount = visibleSongs.size,
            remainingCount = MainUiPolicy.remainingSongCount(visibleSongLimit, visibleSongs.size),
        )
    }

    private fun renderSongsFromCache() {
        captureActiveSongScrollPosition()
        val state = songRenderState(cachedSongItems)
        startScreen("songs", getString(R.string.songs_title), "멤버별 오리지널곡과 커버곡을 서버 캐시에서 탐색합니다.")
        clearTopFilters()
        if (shouldUseSongsTwoPane()) renderSongsTwoPane(state) else {
            binding.contentList.addView(songFilterPanel())
            renderSongListInto(binding.contentList, state, includeServerStatus = true)
            registerSongScrollSession(binding.contentScroll, binding.contentList, state, SongScrollSlot.SONGS_SINGLE)
        }
    }

    private fun renderSongsSelectionChange(render: () -> Unit = ::renderSongsFromCache) {
        if (shouldUseSongsTwoPane() && activeTwoPaneDetailPane != null) {
            val key = listOf(
                selectedSongType,
                selectedSongLibraryId,
                selectedSongSortId,
                selectedSongQuery,
            ).joinToString(":")
            crossFadeTwoPaneSelection("songs:$key", render)
        } else {
            render()
        }
    }

    private fun renderSongsTwoPaneLoading() {
        val panes = songsTwoPaneContainer()
        renderSongFilterPaneInto(panes.filter.content)
        panes.list.content.addView(loadingCard(MainUiPolicy.songsLoadingPresentation()))
    }

    private fun renderSongsTwoPane(state: SongRenderState) {
        val panes = songsTwoPaneContainer()
        renderSongFilterPaneInto(panes.filter.content, state.visibleSongs.size)
        renderSongListInto(panes.list.content, state, includeServerStatus = true)
        registerSongScrollSession(panes.list.scrollView, panes.list.content, state, SongScrollSlot.SONGS_TWO_PANE)
    }

    private fun songsTwoPaneContainer(): SongPanes {
        binding.contentList.removeAllViews()
        resetTopBarScrollSources()
        val paneRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            isBaselineAligned = false
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                twoPaneViewportHeight(),
            )
        }
        val filterPane = scrollablePane()
        val listPane = scrollablePane()
        val paneWeights = if (shouldUseSongsFoldAwarePane()) {
            0.9f to 1.1f
        } else {
            0.9f to 1.1f
        }
        paneRow.addView(
            filterPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, paneWeights.first).apply {
                marginEnd = dp(8)
            },
        )
        paneRow.addView(
            listPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, paneWeights.second).apply {
                marginStart = dp(8)
            },
        )
        activeTwoPaneDetailPane = listPane.scrollView
        binding.contentList.addView(paneRow)
        return SongPanes(filterPane, listPane)
    }

    private fun renderSongListInto(container: LinearLayout, state: SongRenderState, includeServerStatus: Boolean) {
        if (includeServerStatus) {
            container.addView(serverStatusStrip())
        }
        if (state.visibleSongs.isEmpty()) {
            val message = if (selectedSongLibraryId == "favorites") {
                MainUiPolicy.songFavoriteEmptyMessage(songFavoriteIds.isNotEmpty())
            } else SongMemberFilterPolicy.emptyMessage(state.catalogMembers, selectedSongMemberFilter)
            container.addView(noticeCard(message))
            return
        }
        state.displayedSongs.forEach { song ->
            container.addView(songCard(song, state.catalogMembers))
        }
        addSongListFooter(container, state)
    }

    private fun addSongListFooter(container: LinearLayout, state: SongRenderState) {
        container.addView(songLoadMoreControl(container, state))
    }

    private fun renderSongFilterPaneInto(container: LinearLayout, visibleCount: Int = 0) {
        container.addView(songSearchCard())
        container.addView(songFilterPanel())
        container.addView(songInlineMemberFilterPanel(visibleCount))
    }

    private fun shouldUseSongsTwoPane(): Boolean =
        SongsPanePolicy.shouldUseTwoPane(currentAdaptiveSpec)

    private fun shouldUseSongsFoldAwarePane(): Boolean =
        SongsPanePolicy.shouldUseFoldAwarePane(currentAdaptiveSpec)

    private fun renderSongSearch() {
        binding.topBarSongSearch.isEnabled = true
        startScreen(
            screenId = "song_search",
            title = "노래 검색",
            role = "제목 또는 멤버 이름으로 검색합니다.",
        )
        binding.collapsedTitle.text = "노래 검색"
        binding.collapsedRole.text = "제목 또는 멤버"
        binding.contentList.addView(songSearchCard())
        songSearchResultsContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }.also(binding.contentList::addView)
        refreshSongSearchResults()
    }

    private fun refreshSongSearchResults() {
        captureActiveSongScrollPosition()
        val container = songSearchResultsContainer ?: return
        container.removeAllViews()
        val renderItems: (List<SongCatalogItem>) -> Unit = { items ->
            val state = songRenderState(items)
            if (state.visibleSongs.isEmpty()) {
                container.addView(noticeCard("검색 결과가 없습니다."))
            } else {
                state.displayedSongs.forEach { container.addView(songCard(it, state.catalogMembers)) }
                addSongListFooter(container, state)
                registerSongScrollSession(binding.contentScroll, container, state, SongScrollSlot.SONG_SEARCH)
            }
        }
        if (cachedSongType == "all" && cachedSongItems.isNotEmpty()) {
            renderItems(cachedSongItems)
            return
        }
        container.addView(loadingCard(MainUiPolicy.songSearchLoadingPresentation()))
        CoroutineScope(Dispatchers.Main).launch {
            val result = serverRepository.songs(generationId = "all", type = "all")
            val items = result.items
            songDiscoveryRepository.initialize(result.serverTime, items, result.isAuthoritative)
            cachedSongCatalogAuthoritative = result.isAuthoritative
            cachedSongItems = items
            cachedSongType = "all"
            if (navigationHistory.currentScreen != HubScreen.SONG_SEARCH) return@launch
            refreshScreenWhenIdle(HubScreen.SONG_SEARCH) refresh@{
                if (container !== songSearchResultsContainer) return@refresh
                container.removeAllViews()
                renderItems(items)
            }
        }
    }

private fun applySongMemberFilter(state: SongMemberFilterState) {
    val normalized = state.normalized(SongMemberFilterPolicy.selectableMembers(serverMembers ?: repository.members).map { it.id }.toSet())
    if (normalized == selectedSongMemberFilter) return
    selectedSongMemberFilter = normalized
    resetSongBrowseForQueryChange()
}

private fun resetSongBrowseForQueryChange() {
    visibleSongLimit = MainUiPolicy.SONG_PAGE_SIZE
    songBrowseSession.visibleLimit = visibleSongLimit
    songBrowseSession.positions.clear()
    activeSongScrollView?.let { scrollSongViewTo(it, 0) }
    if (::songScrollToTopButton.isInitialized) songScrollToTopButton.isVisible = false
}

private fun filterPanel(
    groups: List<TopFilterGroup>,
    onSelected: (groupId: String, optionId: String) -> Unit,
): MaterialCardView =
    baseCard(HubCardStyle.COMPACT).apply {
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            bottomMargin = dp(12)
        }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(12), dp(12), dp(10))
            groups.forEachIndexed { index, group ->
                if (index > 0) {
                    addView(divider())
                }
                addView(segmentedFilterRow(group.options, group.selectedId) { optionId ->
                    onSelected(group.id, optionId)
                }.apply {
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    ).apply {
                        if (index > 0) topMargin = dp(MainUiPolicy.SONG_FILTER_SEGMENT_SPACING_DP)
                        if (index < groups.lastIndex) bottomMargin = dp(MainUiPolicy.SONG_FILTER_SEGMENT_SPACING_DP)
                    }
                })
            }
        })
    }

private fun songFilterPanel(): MaterialCardView =
    baseCard(HubCardStyle.COMPACT).apply {
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            bottomMargin = dp(12)
        }
        val members = serverMembers ?: repository.members
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(12), dp(12), dp(10))
            addView(songSegmentedRow(MainUiPolicy.songTypeFilters(), selectedSongType) { optionId ->
                selectedSongType = optionId
                resetSongBrowseForQueryChange()
                renderSongsSelectionChange()
            }.apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply {
                    bottomMargin = dp(MainUiPolicy.SONG_FILTER_SEGMENT_SPACING_DP)
                }
            })
            addView(divider())
            addView(songSegmentedRow(MainUiPolicy.songLibraryFilters(), selectedSongLibraryId) { optionId ->
                selectedSongLibraryId = optionId
                resetSongBrowseForQueryChange()
                renderSongsSelectionChange()
            }.apply {
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = dp(MainUiPolicy.SONG_FILTER_SEGMENT_SPACING_DP)
                    bottomMargin = dp(MainUiPolicy.SONG_FILTER_SEGMENT_SPACING_DP)
                }
            })
            addView(divider())
            addView(songSelectorRow("정렬", MainUiPolicy.songSortLabel(selectedSongSortId), accentValue = true) {
                showSongSortDialog()
            })
            if (SongsPanePolicy.memberSelectionMode(currentAdaptiveSpec) == SongMemberSelectionMode.NAVIGATE_TO_MEMBER_FILTER) {
                addView(divider())
                addView(songSelectorRow("멤버", MainUiPolicy.songMemberFilterLabel(members, selectedSongMemberFilter), accentValue = false) {
                    pushScreen(HubScreen.SONG_MEMBER_FILTER)
                })
            }
        })
    }

private fun songInlineMemberFilterPanel(visibleCount: Int): MaterialCardView =
    baseCard(HubCardStyle.COMPACT).apply {
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            bottomMargin = dp(12)
        }
        val members = serverMembers ?: repository.members
        val memberById = members.associateBy { it.id }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(12), dp(12), dp(10))
            addView(TextView(context).apply {
                text = "멤버"
                setTextColor(color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
            })
            addView(TextView(context).apply {
                text = MainUiPolicy.songMemberFilterSummary(members, selectedSongMemberFilter, visibleCount)
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(0, dp(4), 0, dp(8))
            })
            addView(TextView(context).apply {
                text = "상세 조건 편집 ›"
                setPadding(0, dp(10), 0, dp(10))
                isClickable = true
                isFocusable = true
                contentDescription = "멤버 필터 상세 조건 편집"
                setOnClickListener { pushScreen(HubScreen.SONG_MEMBER_FILTER) }
            })
        })
    }

private fun segmentedFilterRow(
    filters: List<TopFilterOption>,
    selectedId: String,
    onSelected: (String) -> Unit,
): LinearLayout =
    LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        weightSum = filters.size.toFloat()
        filters.forEachIndexed { index, filter ->
            addView(filterSegmentView(filter.id, filter.label, filter.id == selectedId) {
                onSelected(filter.id)
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (index < filters.lastIndex) marginEnd = dp(6)
            })
        }
    }

private fun songSegmentedRow(
    filters: List<dev.minepacu.stelliveeventnotifier.feature.home.SongFilterOption>,
    selectedId: String,
    onSelected: (String) -> Unit,
): LinearLayout =
    LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        weightSum = filters.size.toFloat()
        filters.forEachIndexed { index, filter ->
            addView(filterSegmentView(filter.id, filter.label, filter.id == selectedId) {
                onSelected(filter.id)
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (index < filters.lastIndex) marginEnd = dp(6)
            })
        }
    }

private fun filterSegmentView(
    id: String,
    label: String,
    selected: Boolean,
    onSelected: () -> Unit,
): TextView =
    TextView(this).apply {
        text = label
        gravity = Gravity.CENTER
        maxLines = 1
        setTextColor(color(if (selected) R.color.hub_text else R.color.hub_text_muted))
        textSize = 13f
        typeface = if (selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        background = rounded(
            fill = color(if (selected) R.color.hub_card_surface_compact else R.color.hub_surface),
            radius = dp(18),
            stroke = if (selected) color(R.color.hub_line) else Color.TRANSPARENT,
        )
        setPadding(dp(8), dp(8), dp(8), dp(8))
        isClickable = true
        isFocusable = true
        contentDescription = label
        setOnClickListener { onSelected() }
    }

private fun songSelectorRow(
    label: String,
    value: String,
    accentValue: Boolean,
    onClick: () -> Unit,
): LinearLayout =
    LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(3), dp(9), dp(3), dp(9))
        isClickable = true
        isFocusable = true
        setOnClickListener { onClick() }
        addView(TextView(context).apply {
            text = label
            setTextColor(color(R.color.hub_text))
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        addView(TextView(context).apply {
            text = "$value ›"
            setTextColor(if (accentValue) Color.rgb(74, 144, 226) else color(R.color.hub_text))
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
        })
    }

private fun showSongSortDialog() {
    val options = MainUiPolicy.songSortOptions()
    HubSingleChoiceBottomSheet(
        context = this,
        title = getString(R.string.song_sort_title),
        options = options.map { HubSingleChoiceOption(it.id, it.label) },
        selectedId = selectedSongSortId,
        onSelected = { selectedId ->
            selectedSongSortId = selectedId
            resetSongBrowseForQueryChange()
            renderSongsSelectionChange(::renderSongs)
        },
    ).show()
}

private fun songSearchCard(): MaterialCardView =
        baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            }
            val input = EditText(context).apply {
                hint = "노래 제목 또는 멤버 검색"
                setSingleLine(true)
                setText(selectedSongQuery)
                setTextColor(color(R.color.hub_text))
                setHintTextColor(color(R.color.hub_text_muted))
                textSize = 14f
                setPadding(dp(13), dp(8), dp(13), dp(8))
                setOnEditorActionListener { view, _, _ ->
                    applySongSearchText(view.text?.toString().orEmpty())
                    true
                }
                setOnFocusChangeListener { view, hasFocus ->
                    if (!hasFocus) {
                        applySongSearchText((view as EditText).text?.toString().orEmpty())
                    }
                }
                addTextChangedListener(object : TextWatcher {
                    override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                    override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit

                    override fun afterTextChanged(s: Editable?) {
                        selectedSongQuery = s?.toString().orEmpty()
                        resetSongBrowseForQueryChange()
                    }
                })
            }
            addView(input)
        }

private fun applySongSearchText(rawQuery: String) {
    if (shouldUseSongsTwoPane()) {
        selectedSongQuery = MainUiPolicy.normalizedSongQuery(rawQuery)
        resetSongBrowseForQueryChange()
        renderSongsSelectionChange(::renderSongs)
    } else {
        scheduleSongSearchRender(rawQuery)
    }
}

private fun scheduleSongSearchRender(rawQuery: String) {
    val normalized = MainUiPolicy.normalizedSongQuery(rawQuery)
    selectedSongQuery = normalized
    resetSongBrowseForQueryChange()
    pendingSongSearchRender?.let(songSearchHandler::removeCallbacks)
    if (normalized == appliedSongQuery) return
    pendingSongSearchRender = Runnable {
        pendingSongSearchRender = null
        if (navigationHistory.currentScreen != HubScreen.SONG_SEARCH) return@Runnable
        appliedSongQuery = normalized
        refreshScreenWhenIdle(HubScreen.SONG_SEARCH, ::refreshSongSearchResults)
    }.also { songSearchHandler.postDelayed(it, 150L) }
}

    private fun songFilterChips(): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(12)
            }
            addView(songFilterRow(MainUiPolicy.songTypeFilters(), selectedSongType) { selectedSongType = it })
            addView(songFilterRow(MainUiPolicy.songSortOptions(), selectedSongSortId) { selectedSongSortId = it })
        }

private fun songMemberFilterCard(members: List<HubMember>, visibleCount: Int): MaterialCardView =
    baseCard(HubCardStyle.INTERACTIVE).apply {
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            bottomMargin = dp(10)
        }
        isClickable = true
        isFocusable = true
        setOnClickListener { pushScreen(HubScreen.SONG_MEMBER_FILTER) }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(15), dp(14), dp(15), dp(14))
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(context).apply {
                    text = "멤버"
                    setTextColor(color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                })
                addView(TextView(context).apply {
                    text = MainUiPolicy.songMemberFilterSummary(members, selectedSongMemberFilter, visibleCount)
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, dp(4), 0, 0)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = dp(12)
            })
            addView(TextView(context).apply {
                text = MainUiPolicy.songMemberFilterLabel(members, selectedSongMemberFilter) + " ›"
                gravity = Gravity.CENTER
                maxLines = 1
                setTextColor(color(R.color.hub_text))
                textSize = 13f
                typeface = Typeface.DEFAULT_BOLD
                background = rounded(
                    fill = color(R.color.hub_card_surface_compact),
                    radius = dp(18),
                    stroke = color(R.color.hub_line),
                )
                setPadding(dp(12), dp(7), dp(12), dp(7))
            })
        })
    }

private fun renderSongMemberFilter(restoreScrollY: Int? = null) {
    val members = serverMembers ?: repository.members
    val selectable = SongMemberFilterPolicy.selectableMembers(members)
    val draft = selectedSongMemberFilterDraft ?: selectedSongMemberFilter.also { selectedSongMemberFilterDraft = it }
    startScreen(
        screenId = "song_member_filter",
        title = "노래 멤버 선택",
        role = "노래 목록을 멤버별로 좁혀 봅니다"
    )
    fun updateDraft(next: SongMemberFilterState) {
        val currentScrollY = binding.contentScroll.scrollY
        selectedSongMemberFilterDraft = next.normalized(selectable.map { it.id }.toSet())
        renderSongMemberFilter(restoreScrollY = currentScrollY)
    }

    binding.contentList.addView(baseCard(HubCardStyle.COMPACT).apply {
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(16)
        }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(14), dp(14), dp(14))
            addView(TextView(context).apply {
                text = "현재 조건"
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
            })
            addView(TextView(context).apply {
                text = SongMemberFilterPolicy.summary(members, draft)
                setTextColor(color(R.color.hub_text))
                textSize = 16f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(0, dp(4), 0, dp(14))
                contentDescription = "현재 조건, $text"
            })
            addView(TextView(context).apply {
                text = "선택 멤버"
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(0, 0, 0, dp(7))
            })
            val matchModeEnabled = draft.selectedMemberIds.size >= 2 && draft.participation != SongParticipation.SOLO
            addView(songSegmentedRow(listOf(SongFilterOption("ANY", "한 명 이상"), SongFilterOption("ALL", "모두 참여")), draft.matchMode.name) {
                updateDraft(draft.copy(matchMode = SongMemberMatchMode.valueOf(it)))
            }.apply {
                alpha = if (matchModeEnabled) 1f else 0.48f
                contentDescription = if (matchModeEnabled) "멤버 일치 방식" else "멤버 두 명 이상 선택 시 사용 가능"
                childrenSequence().forEach { it.isEnabled = matchModeEnabled }
            })
            addView(TextView(context).apply {
                text = "참여 형태"
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(0, dp(14), 0, dp(7))
            })
            addView(songSegmentedRow(listOf(SongFilterOption("ANY", "전체"), SongFilterOption("SOLO", "솔로"), SongFilterOption("COLLABORATION", "함께")), draft.participation.name) {
                updateDraft(draft.copy(participation = SongParticipation.valueOf(it)))
            })
            addView(TextView(context).apply {
                text = "솔로는 1명, 함께 부른 곡은 연결된 스텔라이브 멤버 2명 이상을 기준으로 하며 외부 가수는 계산에 포함되지 않습니다."
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(0, dp(12), 0, 0)
                contentDescription = text
            })
        })
    })

    binding.contentList.addView(sectionLabel("빠른 선택"))
    binding.contentList.addView(HorizontalScrollView(this).apply {
        isHorizontalScrollBarEnabled = false
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dp(14)
        }
        addView(ChipGroup(context).apply {
            isSingleLine = true
            chipSpacingHorizontal = dp(8)
            listOf("gen1" to "1기생 전원", "gen2" to "2기생 전원", "gen3" to "3기생 전원").forEach { (id, label) ->
                val preset = SongMemberFilterPolicy.generationPreset(members, id)
                addView(centerChipText(Chip(context).apply {
                    val selected = draft == preset
                    text = label
                    isCheckable = false
                    isClickable = true
                    setEnsureMinTouchTargetSize(true)
                    chipMinHeight = dp(40).toFloat()
                    shapeAppearanceModel = shapeAppearanceModel.toBuilder()
                        .setAllCornerSizes(dp(20).toFloat())
                        .build()
                    chipStrokeWidth = dp(1).toFloat()
                    chipStrokeColor = ColorStateList.valueOf(color(if (selected) R.color.hub_primary else R.color.hub_line))
                    chipBackgroundColor = ColorStateList.valueOf(color(if (selected) R.color.hub_accent_soft else R.color.hub_card))
                    setTextColor(color(if (selected) R.color.hub_primary else R.color.hub_text_muted))
                    textSize = 13f
                    typeface = Typeface.DEFAULT_BOLD
                    textStartPadding = dp(12).toFloat()
                    textEndPadding = dp(12).toFloat()
                    contentDescription = "$label 빠른 선택${if (selected) ", 선택됨" else ""}"
                    setOnClickListener { updateDraft(preset) }
                }))
            }
        })
    })

    selectable.groupBy { it.generationId }.forEach { (generationId, generationMembers) ->
        binding.contentList.addView(sectionLabel(when (generationId) { "gen1" -> "1기생"; "gen2" -> "2기생"; else -> "3기생" }))
        generationMembers.forEach { member ->
            val checked = member.id in draft.selectedMemberIds
            val option = SongFilterOption(member.id, member.koreanName.ifBlank { member.englishName })
            binding.contentList.addView(songMemberFilterOptionCard(option, member, checked).apply {
                setOnClickListener {
                val ids = draft.selectedMemberIds.toMutableSet().apply { if (!add(member.id)) remove(member.id) }
                    updateDraft(draft.copy(selectedMemberIds = ids))
                }
            })
        }
    }

    val normalizedDraft = draft.normalized(selectable.map { it.id }.toSet())
    val canReset = normalizedDraft != SongMemberFilterState()
    val canApply = normalizedDraft != selectedSongMemberFilter.normalized(selectable.map { it.id }.toSet())
    binding.screenActionContainer.isVisible = true
    binding.screenActionReset.apply {
        background = rounded(fill = color(R.color.hub_surface), radius = dp(14), stroke = color(R.color.hub_line))
        alpha = if (canReset) 1f else 0.45f
        isEnabled = canReset
        contentDescription = if (canReset) "멤버 조건 초기화" else "멤버 조건 초기화, 이미 초기 상태"
        setOnClickListener { updateDraft(SongMemberFilterState()) }
    }
    binding.screenActionApply.apply {
        background = rounded(fill = color(R.color.hub_primary), radius = dp(14))
        alpha = if (canApply) 1f else 0.45f
        isEnabled = canApply
        contentDescription = if (canApply) "멤버 조건 적용" else "멤버 조건 적용, 변경 사항 없음"
        setOnClickListener {
            applySongMemberFilter(normalizedDraft)
            selectedSongMemberFilterDraft = null
            popScreen()
        }
    }
    registerSongMemberFilterScrollToTop()
    scheduleSongScrollToTopButtonPositionUpdate()
    restoreScrollY?.let { scrollY ->
        binding.contentScroll.post { binding.contentScroll.scrollTo(0, scrollY) }
    }
}

private fun songMemberFilterOptionCard(
        option: dev.minepacu.stelliveeventnotifier.feature.home.SongFilterOption,
        member: HubMember?,
        selected: Boolean,
    ): MaterialCardView =
        baseCard(HubCardStyle.INTERACTIVE).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            }
            setCardBackgroundColor(color(if (selected) R.color.hub_card_surface_compact else R.color.hub_card_surface))
            strokeColor = color(if (selected) R.color.hub_primary else R.color.hub_line)
            isClickable = true
            isFocusable = true
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(14), dp(12), dp(14), dp(12))
            }
            if (member != null) {
                row.addView(songMemberProfileAvatar(member, dp(42)), LinearLayout.LayoutParams(dp(42), dp(42)).apply {
                    marginEnd = dp(12)
                })
            }
            row.addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(context).apply {
                    text = option.label
                    setTextColor(color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                    maxLines = 1
                })
                addView(TextView(context).apply {
                    text = if (selected) "선택됨" else "선택 안 됨"
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, dp(4), 0, 0)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            if (selected) {
                row.addView(rowChip("선택됨"), LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply {
                    marginStart = dp(12)
                })
            }
            contentDescription = "${option.label}, ${if (selected) "선택됨" else "선택 안 됨"}"
            addView(row)
        }

private fun songFilterRow(
        filters: List<dev.minepacu.stelliveeventnotifier.feature.home.SongFilterOption>,
        selectedId: String,
        onSelected: (String) -> Unit,
    ): HorizontalScrollView =
        HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(ChipGroup(context).apply {
                isSingleLine = true
                filters.forEach { filter ->
                    addView(centerChipText(Chip(context).apply {
                        text = filter.label
                        isCheckable = true
                        isChecked = filter.id == selectedId
                        setOnClickListener {
                            onSelected(filter.id)
                            resetSongBrowseForQueryChange()
                            renderSongsSelectionChange(::renderSongs)
                        }
                    }))
                }
            })
        }

    private fun songCard(song: SongCatalogItem, catalogMembers: List<HubMember> = serverMembers ?: repository.members): MaterialCardView =
        baseCard(HubCardStyle.INTERACTIVE).apply {
            tag = SongIdentity.identifier(song)
            val displayText = MainUiPolicy.songDisplayText(song, catalogMembers)
            isClickable = true
            isFocusable = true
            contentDescription = "${displayText.title}, 곡 상세 보기"
            setOnClickListener { showSongDetail(song) }
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            }
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(dp(15), dp(14), dp(15), dp(14))
            }
            row.addView(songThumbnail(song))
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            content.addView(TextView(context).apply {
                text = displayText.title
                setTextColor(color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                maxLines = MainUiPolicy.SONG_TITLE_MAX_LINES
                ellipsize = TextUtils.TruncateAt.END
                includeFontPadding = false
            })
            content.addView(TextView(context).apply {
                text = displayText.subtitle
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(0, dp(5), 0, 0)
                maxLines = MainUiPolicy.SONG_SUBTITLE_MAX_LINES
                ellipsize = TextUtils.TruncateAt.END
                includeFontPadding = false
            })
            content.addView(ChipGroup(context).apply {
                isSingleLine = false
                isSelectionRequired = false
                chipSpacingHorizontal = dp(6)
                chipSpacingVertical = dp(4)
                addView(rowChip(song.type.displayName))
                MainUiPolicy.songPremiereStatusLabel(song)?.let { label ->
                    addView(rowChip(label))
                }
                if (SongDiscoveryPolicy.isNew(song, songDiscoveryState)) {
                    addView(rowChip("NEW").apply {
                        contentDescription = "새로 추가된 노래"
                    })
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply {
                    topMargin = dp(7)
                }
            })
            content.addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                addView(View(context), LinearLayout.LayoutParams(0, 0, 1f))
                MainUiPolicy.songFavoriteIdentifier(song)?.let { identifier ->
                    addView(TextView(context).apply {
                        text = if (identifier in songFavoriteIds) "★" else "☆"
                        textSize = 24f
                        gravity = Gravity.CENTER
                        setTextColor(color(R.color.hub_text))
                        contentDescription = if (identifier in songFavoriteIds) "즐겨찾기 해제" else "즐겨찾기 추가"
                        isClickable = true
                        isFocusable = true
                        minWidth = dp(48)
                        minHeight = dp(48)
                        setOnClickListener {
                            lifecycleScope.launch { songFavoritesRepository.toggle(identifier) }
                        }
                    })
                }
                addView(TextView(context).apply {
                    text = "⋮"
                    textSize = 24f
                    gravity = Gravity.CENTER
                    minWidth = dp(48)
                    minHeight = dp(48)
                    isClickable = true
                    isFocusable = true
                    contentDescription = "${displayText.title} 빠른 동작" +
                        if (SongLinkPolicy.videoUrl(song) == null) ", ${SongLinkPolicy.unavailableReason}" else ""
                    setOnClickListener { anchor -> showSongQuickMenu(anchor, song) }
                })
            })
            row.addView(content)
            addView(row)
        }

    private fun showSongDetail(song: SongCatalogItem) {
        val sheet = SongDetailBottomSheet(
            context = this,
            openTarget = songOpenPreferenceStore.read(),
            isFavorite = { target -> MainUiPolicy.songFavoriteIdentifier(target)?.let(songFavoriteIds::contains) == true },
            onOpen = { openExternalUrl(it) },
            onShare = ::shareSongUrl,
            onCopy = ::copySongUrl,
            onToggleFavorite = { target ->
                MainUiPolicy.songFavoriteIdentifier(target)?.let { identifier ->
                    lifecycleScope.launch { songFavoritesRepository.toggle(identifier) }
                }
            },
            onMemberFilter = { memberId -> applyRelatedSongFilter(SongDetailPolicy.memberFilter(memberId), null) },
            onAllMembersFilter = { target -> applyRelatedSongFilter(SongDetailPolicy.allMembersFilter(target), null) },
            onSameTypeFilter = { target -> applyRelatedSongFilter(null, target.type.apiValue) },
        )
        sheet.show(song)
        lifecycleScope.launch {
            songDiscoveryRepository.acknowledge(listOf(song), cachedSongItems)
            sheet.update(serverRepository.songDetail(song.id, song))
        }
    }

    private fun showSongQuickMenu(anchor: View, song: SongCatalogItem) {
        val selectedTarget = songOpenPreferenceStore.read()
        val youtubeUrl = SongLinkPolicy.videoUrl(song, SongOpenTarget.YOUTUBE)
        val youtubeMusicUrl = SongLinkPolicy.videoUrl(song, SongOpenTarget.YOUTUBE_MUSIC)
        PopupMenu(ContextThemeWrapper(this, R.style.ThemeOverlay_StelliveHub_PopupMenu), anchor).apply {
            val youtube = menu.add(
                "YouTube에서 열기" + if (selectedTarget == SongOpenTarget.YOUTUBE) " · 기본" else "",
            )
            val youtubeMusic = menu.add(
                "YouTube Music에서 열기" + if (selectedTarget == SongOpenTarget.YOUTUBE_MUSIC) " · 기본" else "",
            )
            val share = menu.add("링크 공유")
            val copy = menu.add("링크 복사")
            youtube.isEnabled = youtubeUrl != null
            youtubeMusic.isEnabled = youtubeMusicUrl != null
            listOf(share, copy).forEach { it.isEnabled = youtubeUrl != null }
            setOnMenuItemClickListener { item ->
                when (item) {
                    youtube -> youtubeUrl?.let(::openExternalUrl)
                    youtubeMusic -> youtubeMusicUrl?.let(::openExternalUrl)
                    share -> youtubeUrl?.let(::shareSongUrl)
                    copy -> youtubeUrl?.let(::copySongUrl)
                }
                true
            }
            show()
        }
    }

    private fun shareSongUrl(url: String) {
        startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, url)
        }, "노래 링크 공유"))
    }

    private fun copySongUrl(url: String) {
        (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
            .setPrimaryClip(ClipData.newPlainText("YouTube 링크", url))
        Toast.makeText(this, "링크를 복사했습니다.", Toast.LENGTH_SHORT).show()
    }

    private fun applyRelatedSongFilter(memberState: SongMemberFilterState?, type: String?) {
        selectedSongQuery = ""
        memberState?.let { selectedSongMemberFilter = it.normalized() }
        type?.let { selectedSongType = it }
        resetSongBrowseForQueryChange()
        renderSongsSelectionChange()
        Toast.makeText(this, "관련 노래 필터를 적용했습니다.", Toast.LENGTH_SHORT).show()
    }

    private fun songThumbnail(song: SongCatalogItem): View =
        FrameLayout(this).apply {
            val widthDp = MainUiPolicy.songThumbnailWidthDp(resources.configuration.screenWidthDp)
            val width = dp(widthDp)
            val height = dp(MainUiPolicy.songThumbnailHeightDp(widthDp))
            layoutParams = LinearLayout.LayoutParams(width, height).apply {
                rightMargin = dp(12)
            }
            background = rounded(fill = color(R.color.hub_surface), radius = dp(12))
            addView(TextView(context).apply {
                text = "♪"
                gravity = Gravity.CENTER
                setTextColor(color(R.color.hub_text_muted))
                textSize = 20f
            }, FrameLayout.LayoutParams(width, height))
            val url = song.thumbnailUrl?.takeIf { it.startsWith("https://") }
            if (url != null) {
                addView(ImageView(context).apply {
                    scaleType = ImageView.ScaleType.CENTER_CROP
                    clipToOutline = true
                    thread {
                        runCatching {
                            URL(url).openStream().use { BitmapFactory.decodeStream(it) }
                        }.getOrNull()?.let { bitmap ->
                            runOnUiThread { setImageBitmap(bitmap) }
                        }
                    }
                }, FrameLayout.LayoutParams(width, height))
            }
        }

    private fun songLoadMoreControl(container: LinearLayout, state: SongRenderState): MaterialCardView {
        lateinit var control: MaterialCardView
        control = baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setPadding(dp(15), dp(10), dp(15), dp(10))
                addView(TextView(context).apply {
                    text = MainUiPolicy.songProgressText(
                        state.displayedCount,
                        state.totalFilteredCount,
                        cachedSongCatalogAuthoritative,
                    )
                    gravity = Gravity.CENTER
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 12f
                })
                if (state.remainingCount > 0) {
                    addView(Chip(context).apply {
                        text = MainUiPolicy.songLoadMoreText(state.remainingCount)
                        contentDescription = "$text, ${MainUiPolicy.songProgressText(state.displayedCount, state.totalFilteredCount, cachedSongCatalogAuthoritative)}"
                        setOnClickListener {
                            if (isLoadingMoreSongs) return@setOnClickListener
                            isLoadingMoreSongs = true
                            val footerIndex = container.indexOfChild(control)
                            if (footerIndex >= 0) container.removeViews(footerIndex, container.childCount - footerIndex)
                            visibleSongLimit = MainUiPolicy.nextSongVisibleLimit(
                                visibleSongLimit,
                                state.totalFilteredCount,
                            )
                            songBrowseSession.visibleLimit = visibleSongLimit
                            val nextState = songRenderState(cachedSongItems)
                            nextState.displayedSongs.drop(state.displayedCount).forEach { song ->
                                container.addView(songCard(song, nextState.catalogMembers))
                            }
                            addSongListFooter(container, nextState)
                            isLoadingMoreSongs = false
                        }
                    })
                }
            })
        }
        return control
    }

    private fun renderSettings() {
        startScreen(
            screenId = "settings",
            title = getString(R.string.settings_title),
            role = ""
        )
        if (shouldUseSettingsTwoPane()) {
            renderSettingsTwoPane()
            return
        }
        renderSettingsHubInto(binding.contentList)
    }

    private fun renderSettingsTwoPane() {
        val paneRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            isBaselineAligned = false
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                twoPaneViewportHeight(),
            )
        }
        val hubPane = scrollablePane()
        val detailPane = scrollablePane().apply {
            scrollView.background = rounded(color(R.color.hub_surface), dp(16), color(R.color.hub_line))
            content.setPadding(dp(10), dp(10), dp(10), dp(10))
        }
        paneRow.addView(
            hubPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 0.9f).apply {
                marginEnd = dp(8)
            },
        )
        paneRow.addView(
            detailPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.1f).apply {
                marginStart = dp(8)
            },
        )
        activeTwoPaneDetailPane = detailPane.scrollView
        activeSettingsHubScrollView = hubPane.scrollView
        registerTopBarScrollSource(hubPane.scrollView)
        binding.contentList.addView(paneRow)
        renderSettingsHubInto(hubPane.content)
        renderSelectedSettingsDetailInto(detailPane.content)
    }

    private fun renderSettingsHubInto(container: LinearLayout) {
        val settings = repository.settings
        container.addView(sectionLabel("알림 기본 설정"))
        container.addView(
            settingsPanel(
                rows = listOf(
                    SettingRow(
                        "전체 알림",
                        "끄면 푸시 알림을 받지 않으며 새 알림 기록도 만들지 않습니다.",
                        settings.globalEnabled,
                        onCheckedChange = { enabled ->
                            if (enabled) {
                                requestNotificationPermissionIfNeeded(NotificationPermissionPromptMoment.GLOBAL_NOTIFICATION_TOGGLE)
                            }
                            persistSettings(settings.copy(globalEnabled = enabled))
                        },
                    ),
                    SettingRow(
                        "서비스 공지",
                        "서비스 전체 공지와 장애, 점검, 새 버전 안내를 받습니다. 전체 알림이 꺼져 있으면 받지 않습니다.",
                        settings.serviceAnnouncementsEnabled,
                        enabled = settings.globalEnabled,
                        onCheckedChange = { enabled -> persistSettings(settings.copy(serviceAnnouncementsEnabled = enabled)) },
                    )
                )
            )
        )
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
        val hubSections = MainUiPolicy.settingsHubSections(hubRows).associateBy { it.title }
        fun addNavigationRows(sectionTitle: String) {
            hubSections.getValue(sectionTitle).rows.forEach { row ->
                val screen = settingsScreenForRow(row.screenId)
                container.addView(settingsNavigationCard(row, selected = selectedSettingsDetailScreen == screen))
            }
        }

        addNavigationRows("알림 기본 설정")
        container.addView(sectionLabel("알림 대상 및 종류"))
        addNavigationRows("알림 대상 및 종류")
        container.addView(sectionLabel("앱 사용"))
        container.addView(
            settingsPanel(
                rows = listOf(
                    SettingRow(
                        "알림을 눌렀을 때",
                        "알림을 누르면 열 화면을 선택합니다.",
                        null,
                        MainUiPolicy.settingsTapActionLabel(settings.tapAction.name),
                    )
                )
            )
        )
        container.addView(appearanceModePanel())
        container.addView(songOpenPreferencePanel())
        container.addView(sectionLabel("기록 및 정보"))
        addNavigationRows("기록 및 정보")
        container.addView(sectionLabel("진단"))
        container.addView(debugModePanel())
        visibleServerConnectionDebugLogs().takeIf { it.isNotEmpty() }?.let { logs ->
            container.addView(
                settingsInfoCard(
                    title = "서버 연결 로그",
                    body = logs.joinToString("\n"),
                    pills = listOf("임시", "진단")
                )
            )
        }
    }

    private fun requestNotificationPermissionIfNeeded(moment: NotificationPermissionPromptMoment) {
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if (NotificationPermissionPromptPolicy.shouldRequest(moment, granted, notificationPermissionRequested)) {
            notificationPermissionRequested = true
            requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun renderSettingsDelivery() {
        startScreen(
            screenId = "settings_delivery",
            title = "알림 수신 방식",
            role = "알림 속도와 방해 금지 시간을 설정합니다."
        )
        renderSettingsDeliveryInto(binding.contentList)
    }

    private fun renderSettingsDeliveryInto(container: LinearLayout) {
        val settings = repository.settings
        container.addView(sectionLabel("알림 수신 방식"))
        container.addView(
            settingsPanel(
                rows = listOf(
                    SettingRow(
                        "알림 수신 방식",
                        "표준 또는 실시간 우선 중에서 선택합니다. 꺼진 알림을 자동으로 켜지는 않습니다.",
                        null,
                        MainUiPolicy.settingsDeliveryModeLabel(settings.deliveryMode.name),
                    ),
                    SettingRow("최대한 실시간으로 받기", MainUiPolicy.realtimeDisclosureLines().joinToString(" "), settings.deliveryMode == DeliveryMode.REALTIME_BEST_EFFORT)
                )
            )
        )
        container.addView(sectionLabel("방해 금지 시간 및 필터"))
        container.addView(
            settingsPanel(
                rows = listOf(
                    SettingRow("방해 금지 시간", "${settings.quietHours.start}-${settings.quietHours.end} ${settings.quietHours.timezone}", settings.quietHours.enabled),
                    SettingRow("키워드 필터", "치지직 채팅 알림을 받으려면 허용하거나 차단할 키워드를 설정해야 합니다.", settings.keywordFilters.hasExplicitFilters),
                    SettingRow("치지직 채팅 알림", "기본적으로 꺼져 있으며, 키워드 필터가 없으면 푸시 알림을 보내지 않습니다.", settings.canEnableChzzkChatPush)
                )
            )
        )
    }

    private fun renderSettingsTargets() {
        startScreen(
            screenId = "settings_targets",
            title = "대상별 알림",
            role = "알림 받을 분류와 개별 대상을 선택합니다."
        )
        renderSettingsTargetsInto(binding.contentList)
    }

    private fun renderSettingsTargetsInto(container: LinearLayout) {
        val settings = repository.settings
        container.addView(sectionLabel("분류별 알림"))
        container.addView(
            settingsPanel(
                rows = listOf(
                    SettingRow("1기생, 2기생, 3기생", "현재 활동 중인 멤버만 포함하며, 활동이 종료된 멤버는 알림 대상에서 제외합니다.", settings.generationEnabled["gen1"] == true && settings.generationEnabled["gen2"] == true && settings.generationEnabled["gen3"] == true),
                    SettingRow("기타", "스텔라이브 공식 YouTube 업로드 알림입니다.", settings.generationEnabled["official"] == true),
                    SettingRow("합류 예정 멤버", "기본적으로 꺼져 있으며, 필요한 경우 직접 켤 수 있습니다.", settings.generationEnabled["gen4-upcoming"] == true)
                )
            )
        )
        container.addView(sectionLabel("개별 대상"))
        repository.members.filter { it.catalogRole != CatalogRole.PLACEHOLDER }.forEach { member ->
            container.addView(
                targetToggleCard(
                    title = member.koreanName,
                    body = when (member.catalogRole) {
                        CatalogRole.REPRESENTATIVE -> null
                        CatalogRole.OFFICIAL_CHANNEL -> "기타 분류에 포함된 공식 채널입니다."
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
        startScreen(
            screenId = "settings_platforms",
            title = "플랫폼별 알림",
            role = "플랫폼별로 받을 알림을 선택합니다."
        )
        renderSettingsPlatformsInto(binding.contentList)
    }

    private fun renderSettingsPlatformsInto(container: LinearLayout) {
        val settings = repository.settings
        container.addView(sectionLabel("플랫폼별 알림"))
        container.addView(
            settingsPanel(
                rows = NotificationPlatform.entries.map { platform ->
                    SettingRow(
                        title = platform.displayName,
                        body = MainUiPolicy.settingsPlatformPolicy(platform),
                        checked = settings.platformEnabled[platform] == true
                    )
                }
            )
        )
        container.addView(
            settingsInfoCard(
                title = "알림 적용 기준",
                body = MainUiPolicy.settingsPlatformCommonNotice(),
                pills = listOf("플랫폼 알림", "푸시 알림")
            )
        )
    }

    private fun renderSettingsEventTypes() {
        startScreen(
            screenId = "settings_event_types",
            title = "알림 종류",
            role = "받을 알림 종류를 선택합니다."
        )
        renderSettingsEventTypesInto(binding.contentList)
    }

    private fun renderSettingsEventTypesInto(container: LinearLayout) {
        val settings = repository.settings
        container.addView(sectionLabel("알림 종류별 설정"))
        container.addView(
            settingsPanel(
                rows = MainUiPolicy.settingsEventTypeRows(settings).map { row ->
                    SettingRow(
                        title = row.title,
                        body = row.body,
                        checked = row.checked
                    )
                }
            )
        )
        container.addView(
            settingsInfoCard(
                title = "알림 적용 기준",
                body = MainUiPolicy.settingsEventTypeCommonNotices().first(),
                pills = listOf("방해 금지 시간", "차단 키워드")
            )
        )
        container.addView(sectionLabel("채팅 알림"))
        container.addView(
            settingsPanel(
                rows = listOf(
                    SettingRow("치지직 채팅 알림", "기본적으로 꺼져 있으며, 키워드 또는 역할 필터를 설정한 경우에만 받을 수 있습니다.", settings.chatEnabled),
                    SettingRow("채팅 푸시 알림", "허용하거나 차단할 키워드를 설정해야 푸시 알림을 받을 수 있습니다.", null, if (settings.canEnableChzzkChatPush) "사용 가능" else "키워드 설정 필요")
                )
            )
        )
        container.addView(
            settingsInfoCard(
                title = "공식 채널 제한",
                body = MainUiPolicy.settingsEventTypeCommonNotices().last(),
                pills = listOf("공식 YouTube 업로드", "YouTube 라이브 제외")
            )
        )
    }

    private fun renderSettingsHubEvents() {
        startScreen(
            screenId = "settings_hub_events",
            title = "굿즈/행사",
            role = "굿즈와 행사 알림을 설정합니다."
        )
        renderSettingsHubEventsInto(binding.contentList)
    }

    private fun renderSettingsHubEventsInto(container: LinearLayout) {
        val settings = repository.settings
        container.addView(sectionLabel("굿즈/행사"))
        container.addView(
            settingsPanel(
                rows = MainUiPolicy.settingsHubEventRows(
                    hubEventsEnabled = settings.platformEnabled[NotificationPlatform.HUB_EVENT] == true,
                    deadlineSoonEnabled = settings.eventTypeEnabled[NotificationEventType.EVENT_DEADLINE_SOON] == true
                ).map { row -> SettingRow(row.title, row.body, row.checked) }
            )
        )
        container.addView(settingsNoticeCard(MainUiPolicy.hubEventPolicyNotice()))
        container.addView(settingsNoticeCard("공식 이미지, 로고, 포스터는 앱에 저장하거나 재사용하지 않습니다."))
    }

    private fun renderSettingsAdvanced() {
        startScreen(
            screenId = "settings_advanced",
            title = "세부 알림 설정",
            role = "분류와 개별 대상의 우선순위를 설정합니다."
        )
        renderSettingsAdvancedInto(binding.contentList)
    }

    private fun renderSettingsAdvancedInto(container: LinearLayout) {
        val settings = repository.settings
        container.addView(sectionLabel("알림 우선순위"))
        container.addView(
            settingsPanel(
                rows = settings.combinationPreferences.map { preference ->
                    SettingRow(
                        title = MainUiPolicy.settingsCombinationPreferenceLabel(preference.scope),
                        body = "분류 또는 개별 대상 설정과 플랫폼, 알림 종류를 함께 적용합니다.",
                        checked = preference.enabled
                    )
                }
            )
        )
        container.addView(
            settingsNoticeCard("개별 대상에서 선택한 설정은 분류별 설정보다 우선할 수 있습니다. 플랫폼, 알림 종류, 방해 금지 시간과 키워드 필터는 그대로 적용됩니다.")
        )
    }

    private fun renderSettingsAbout() {
        startScreen(
            screenId = "settings_about",
            title = "앱 정보",
            role = "프로젝트 소개와 버전"
        )
        renderSettingsAboutInto(binding.contentList)
    }

    private fun renderSettingsAboutInto(container: LinearLayout) {
        container.addView(sectionLabel("앱"))
        container.addView(aboutAppCard())
        container.addView(
            settingsPanel(
                rows = listOf(
                    SettingRow("버전", null, null, "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"),
                    SettingRow("라이선스", null, null, "Apache-2.0")
                )
            )
        )

        container.addView(sectionLabel("오픈 소스"))
        container.addView(
            linkCard(
                title = "GitHub 저장소",
                body = "GitHub 저장소 열기",
                url = "https://github.com/MinePacu/stellive-event-notifier"
            )
        )

        container.addView(sectionLabel("고지"))
        container.addView(
            settingsPanel(
                rows = listOf(
                    SettingRow(
                        "비공식 프로젝트",
                        "스텔라이브, 치지직, YouTube, 네이버, Samsung, Apple과 공식 관계가 없습니다."
                    )
                )
            )
        )
    }

    private fun httpsLinkRow(title: String, url: String?): SettingRow? {
        val value = url ?: return null
        return if (value.startsWith("https://")) SettingRow(title, value, null, "열기") else null
    }

    private fun shouldUseSettingsTwoPane(): Boolean =
        currentAdaptiveSpec.useLargeScreenLayout

    private fun isSettingsDetailPaneScreen(screen: HubScreen): Boolean =
        screen == HubScreen.SETTINGS_DELIVERY ||
            screen == HubScreen.SETTINGS_TARGETS ||
            screen == HubScreen.SETTINGS_PLATFORMS ||
            screen == HubScreen.SETTINGS_EVENT_TYPES ||
            screen == HubScreen.SETTINGS_HUB_EVENTS ||
            screen == HubScreen.SETTINGS_ADVANCED ||
            screen == HubScreen.SETTINGS_ABOUT

    private fun renderSelectedSettingsDetailInto(container: LinearLayout) {
        when (selectedSettingsDetailScreen) {
            HubScreen.SETTINGS_DELIVERY -> renderSettingsDeliveryInto(container)
            HubScreen.SETTINGS_TARGETS -> renderSettingsTargetsInto(container)
            HubScreen.SETTINGS_PLATFORMS -> renderSettingsPlatformsInto(container)
            HubScreen.SETTINGS_EVENT_TYPES -> renderSettingsEventTypesInto(container)
            HubScreen.SETTINGS_HUB_EVENTS -> renderSettingsHubEventsInto(container)
            HubScreen.SETTINGS_ADVANCED -> renderSettingsAdvancedInto(container)
            HubScreen.SETTINGS_ABOUT -> renderSettingsAboutInto(container)
            else -> renderSettingsDetailEmptyPane(container)
        }
    }

    private fun renderSettingsDetailEmptyPane(container: LinearLayout) {
        container.addView(
            settingsInfoCard(
                title = "설정 항목을 선택하세요",
                body = "왼쪽 목록에서 세부 설정을 선택하면 이 영역에 표시됩니다.",
                pills = listOf("설정")
            )
        )
    }

    private fun onSettingsRowSelected(row: SettingsHubRow) {
        val screen = settingsScreenForRow(row.screenId)
        if (shouldUseSettingsTwoPane() && isSettingsDetailPaneScreen(screen)) {
            crossFadeTwoPaneSelection("settings:${screen.id}") {
                selectedSettingsDetailScreen = screen
                renderSettings()
            }
        } else {
            pushScreen(screen)
        }
    }

    private fun settingsScreenForRow(screenId: String): HubScreen = when (screenId) {
        "delivery" -> HubScreen.SETTINGS_DELIVERY
        "targets" -> HubScreen.SETTINGS_TARGETS
        "platforms" -> HubScreen.SETTINGS_PLATFORMS
        "event_types" -> HubScreen.SETTINGS_EVENT_TYPES
        "hub_events" -> HubScreen.SETTINGS_HUB_EVENTS
        "history" -> HubScreen.HISTORY
        "advanced" -> HubScreen.SETTINGS_ADVANCED
        "about" -> HubScreen.SETTINGS_ABOUT
        else -> HubScreen.SETTINGS
    }

    private fun settingsNavigationCard(row: SettingsHubRow, selected: Boolean = false): MaterialCardView =
        baseCard().apply {
            isClickable = true
            isFocusable = true
            isSelected = selected
            layoutParams = settingsCardLayoutParams()
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                applySettingsCardContentPadding()
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
                    setPadding(0, dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp), 0, 0)
                    setLineSpacing(0f, 1.1f)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = dp(12)
            })
            content.addView(TextView(context).apply {
                text = if (selected) "${row.value} · 선택됨 ›" else "${row.value} ›"
                setTextColor(color(R.color.hub_text_muted))
                textSize = 13f
                typeface = Typeface.DEFAULT_BOLD
            })
            addView(content)
            setOnClickListener {
                onSettingsRowSelected(row)
            }
        }

    private fun aboutAppCard(): MaterialCardView =
        baseCard().apply {
            layoutParams = settingsCardLayoutParams()
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                applySettingsCardContentPadding()
            }
            content.addView(TextView(context).apply {
                text = "앱"
                gravity = Gravity.CENTER
                setTextColor(color(R.color.hub_primary))
                textSize = 13f
                typeface = Typeface.DEFAULT_BOLD
                background = rounded(color(R.color.hub_accent_soft), dp(14), color(R.color.hub_line))
            }, LinearLayout.LayoutParams(dp(48), dp(48)).apply {
                marginEnd = dp(13)
            })
            content.addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(context).apply {
                    text = "스텔라이브 이벤트 알리미"
                    setTextColor(color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                })
                addView(TextView(context).apply {
                    text = "굿즈/행사 일정, 멤버 기념일, 플랫폼 알림을 한곳에서 확인하는 비공식 오픈 소스 앱입니다."
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp), 0, 0)
                    setLineSpacing(0f, 1.1f)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(content)
        }

    private fun linkCard(title: String, body: String, url: String): MaterialCardView =
        baseCard(HubCardStyle.INTERACTIVE).apply {
            isClickable = true
            isFocusable = true
            layoutParams = settingsCardLayoutParams()
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                applySettingsCardContentPadding()
            }
            content.addView(LinearLayout(context).apply {
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
                    setPadding(0, dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp), 0, 0)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = dp(12)
            })
            content.addView(TextView(context).apply {
                text = "열기 ›"
                setTextColor(color(R.color.hub_text_muted))
                textSize = 13f
                typeface = Typeface.DEFAULT_BOLD
            })
            addView(content)
            setOnClickListener { openExternalUrl(url) }
        }

    private fun appearanceModePanel(): MaterialCardView =
        baseCard().apply {
            layoutParams = settingsCardLayoutParams()
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                applySettingsCardContentPadding()
            }
            content.addView(TextView(context).apply {
                text = "화면 모드"
                setTextColor(color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(0, 0, 0, dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp))
            })
            content.addView(TextView(context).apply {
                text = "자동 모드는 기기의 화면 설정을 따릅니다."
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(0, 0, 0, dp(8))
            })
            content.addView(ChipGroup(context).apply {
                isSingleSelection = true
                addView(appearanceModeChip(AppearanceMode.SYSTEM, "자동"))
                addView(appearanceModeChip(AppearanceMode.LIGHT, "라이트"))
                addView(appearanceModeChip(AppearanceMode.DARK, "다크"))
            })
            addView(content)
        }

    private fun songOpenPreferencePanel(): MaterialCardView =
        baseCard().apply {
            layoutParams = settingsCardLayoutParams()
            val selectedTarget = songOpenPreferenceStore.read()
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                applySettingsCardContentPadding()
                addView(TextView(context).apply {
                    text = "노래 재생"
                    setTextColor(color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                })
                addView(TextView(context).apply {
                    text = "기본으로 열 앱"
                    setTextColor(color(R.color.hub_text))
                    textSize = 13f
                    setPadding(0, dp(8), 0, dp(8))
                })
                addView(ChipGroup(context).apply {
                    isSingleSelection = true
                    isSelectionRequired = true
                    SongOpenTarget.entries.forEach { target ->
                        addView(Chip(context).apply {
                            text = target.displayName
                            isCheckable = true
                            isChecked = selectedTarget == target
                            minHeight = dp(48)
                            setOnClickListener {
                                if (songOpenPreferenceStore.read() != target) {
                                    songOpenPreferenceStore.write(target)
                                }
                            }
                        })
                    }
                })
                addView(TextView(context).apply {
                    text = "노래 상세 화면의 ‘열기’ 버튼에서 사용할 앱입니다. 공유와 링크 복사에는 YouTube 주소를 사용합니다."
                    setTextColor(color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, dp(8), 0, 0)
                })
            })
        }

    private fun debugModePanel(): MaterialCardView =
        baseCard().apply {
            layoutParams = settingsCardLayoutParams()

            val content = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                applySettingsCardContentPadding()
            }

            content.addView(
                LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(context).apply {
                        text = "진단 모드"
                        setTextColor(color(R.color.hub_text))
                        textSize = 15f
                        typeface = Typeface.DEFAULT_BOLD
                    })
                    addView(TextView(context).apply {
                        text = "켜면 이 화면에 서버 연결 기록을 임시로 표시합니다."
                        setTextColor(color(R.color.hub_text_muted))
                        textSize = 12f
                        setPadding(0, dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp), 0, 0)
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
                        if (checked) "진단: 서버 연결 기록 표시 켜짐" else "진단: 서버 연결 기록 표시 꺼짐"
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
        val spec = MainScreenChromePolicy.spec(
            navigationHistory.currentScreen.id,
            navigationHistory.canGoBack,
        )
        val alpha = if (!scrolled || spec.keepTopBarTitleWhenScrolled) 1f else 0f
        binding.collapsedTitle.alpha = alpha
        binding.collapsedRole.alpha = alpha
        binding.topBarDivider.alpha = if (scrolled) 1f else 0f
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
            binding.navigationRail.setPadding(0, bars.top + dp(8), 0, bars.bottom + dp(8))
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

private fun sectionLabel(text: String): SectionHeaderView =
        SectionHeaderView(this).bind(text)

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
            centerChipText(Chip(this).apply {
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
            })
        })

    private fun staticChips(vararg labels: String): HorizontalScrollView =
        chipsContainer(labels.mapIndexed { index, label ->
            centerChipText(Chip(this).apply {
                text = label
                isCheckable = false
                chipStrokeWidth = dp(1).toFloat()
                chipStrokeColor = ContextCompat.getColorStateList(context, R.color.hub_line)
                chipBackgroundColor = ContextCompat.getColorStateList(
                    context,
                    if (index == 0) R.color.hub_accent_soft else R.color.hub_card
                )
            })
        })

    private fun liveStatusChips(): HorizontalScrollView {
        val filters = listOf(
            "live" to "방송 중",
            "all" to "전체",
            "offline" to "오프라인"
        )
        return chipsContainer(filters.map { (id, label) ->
            centerChipText(Chip(this).apply {
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
            })
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

private fun loadingCard(presentation: LoadingPresentation): MaterialCardView =
        baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(14)
            }
            contentDescription = presentation.title
            addView(ProgressBar(context).apply {
                isIndeterminate = true
                indeterminateTintList = ColorStateList.valueOf(color(R.color.hub_primary))
            }, FrameLayout.LayoutParams(dp(36), dp(36), Gravity.CENTER).apply {
                setMargins(0, dp(18), 0, dp(18))
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

    private fun settingsNoticeCard(text: String): TextView = noticeCard(text).apply {
        val verticalPadding = dp(MainUiPolicy.settingsCardSpacing.contentVerticalPaddingDp)
        setPadding(paddingLeft, verticalPadding, paddingRight, verticalPadding)
        layoutParams = settingsCardLayoutParams()
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

    private fun songMemberProfileAvatar(member: HubMember, size: Int): FrameLayout =
        FrameLayout(this).apply {
            addView(
                avatarText(member, size),
                FrameLayout.LayoutParams(size, size)
            )
            member.profileImageUrl?.takeIf { it.startsWith("https://") }?.let { imageUrl ->
                addView(
                    channelImageAvatar(imageUrl, size),
                    FrameLayout.LayoutParams(size, size)
                )
            }
        }

    private fun channelImageAvatar(imageUrl: String, size: Int): ImageView =
        ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = rounded(fill = color(R.color.hub_primary), radius = size / 2)
            clipToOutline = true
            avatarBitmapCache.get(imageUrl)?.let { bitmap ->
                setImageBitmap(bitmap)
                return@apply
            }
            thread {
                runCatching {
                    URL(imageUrl).openStream().use { BitmapFactory.decodeStream(it) }
                }.getOrNull()?.let { bitmap ->
                    avatarBitmapCache.put(imageUrl, bitmap)
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
        gravity = Gravity.CENTER
        textAlignment = View.TEXT_ALIGNMENT_CENTER
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

private fun liveMemberRow(member: HubMember, reorderable: Boolean = false): MaterialCardView =
        baseCard(HubCardStyle.INTERACTIVE).apply {
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
            addView(row)
            if (reorderable) {
                attachLiveReorderHandlers(this, member)
            }
        }

    private fun attachLiveReorderHandlers(card: MaterialCardView, member: HubMember) {
        val orderedMembers = liveStatusFilteredMembersForUi()
        val currentIndex = orderedMembers.indexOfFirst { it.id == member.id }
        card.contentDescription = "${member.koreanName}, ${currentIndex + 1}번째, 길게 눌러 순서 변경"
        card.setOnLongClickListener {
            if (currentIndex == -1) return@setOnLongClickListener false
            draggingLiveMemberId = member.id
            card.alpha = 0.84f
            val payload = ClipData.newPlainText("live-member-id", member.id)
            val shadow = View.DragShadowBuilder(card)
            card.startDragAndDrop(payload, shadow, LiveDragPayload(member.id, currentIndex), 0)
            card.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
            true
        }
        card.setOnDragListener { _, event ->
            when (event.action) {
                DragEvent.ACTION_DRAG_STARTED -> event.localState is LiveDragPayload
                DragEvent.ACTION_DRAG_ENTERED -> {
                    val payload = event.localState as? LiveDragPayload ?: return@setOnDragListener false
                    if (payload.memberId != member.id) {
                        card.alpha = 0.72f
                    }
                    true
                }
                DragEvent.ACTION_DRAG_EXITED -> {
                    card.alpha = if (draggingLiveMemberId == member.id) 0.84f else 1f
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
                    card.alpha = 1f
                    draggingLiveMemberId = null
                    true
                }
                else -> true
            }
        }
        card.accessibilityDelegate = object : View.AccessibilityDelegate() {
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
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
            setPadding(0, dp(6), 0, 0)
            setLineSpacing(0f, 1.1f)
        })
        if (member.isLive) {
            liveSupplementaryChipGroup(member)?.let { group ->
                addView(group, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = dp(6)
                })
            }
        }
    }

    private fun liveSupplementaryChipGroup(member: HubMember): ChipGroup? {
        val chips = buildList {
            MainUiPolicy.liveCategoryText(member.liveCategory)?.let { category ->
                add(liveCategoryChip(category))
            }
            member.livePlatformUrl?.takeIf { it.startsWith("https://") }?.let { url ->
                add(liveOpenLinkChip(url))
                if (currentAdaptiveSpec.showAdjacentLiveAction) {
                    add(liveOpenAdjacentChip(url))
                }
            }
        }
        if (chips.isEmpty()) return null
        return ChipGroup(this).apply {
            isSingleLine = false
            chipSpacingHorizontal = dp(6)
            chipSpacingVertical = dp(4)
            chips.forEach(::addView)
        }
    }

    private fun liveCategoryChip(category: String): Chip =
        Chip(this).apply {
            text = category
            isCheckable = false
            isClickable = false
            isFocusable = false
            setEnsureMinTouchTargetSize(false)
            chipMinHeight = dp(22).toFloat()
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            chipBackgroundColor = ContextCompat.getColorStateList(context, R.color.hub_card_surface_compact)
            setTextColor(color(R.color.hub_text_muted))
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            maxWidth = dp(140)
        }

    private fun liveOpenLinkChip(url: String): Chip =
        Chip(this).apply {
            text = getString(R.string.live_open_chzzk)
            isCheckable = false
            setEnsureMinTouchTargetSize(false)
            chipMinHeight = dp(24).toFloat()
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            chipBackgroundColor = ContextCompat.getColorStateList(context, R.color.hub_success_soft)
            setTextColor(color(R.color.hub_primary))
            setOnClickListener {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            }
        }

    private fun liveOpenAdjacentChip(url: String): Chip =
        Chip(this).apply {
            text = getString(R.string.live_open_split)
            isCheckable = false
            setEnsureMinTouchTargetSize(false)
            chipMinHeight = dp(24).toFloat()
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            chipBackgroundColor = ContextCompat.getColorStateList(context, R.color.hub_card_surface_compact)
            setTextColor(color(R.color.hub_text))
            setOnClickListener {
                openLiveUrlAdjacentOrFallback(url)
            }
        }

    private fun openLiveUrlAdjacentOrFallback(url: String) {
        val uri = Uri.parse(url)
        val adjacentIntent = Intent(Intent.ACTION_VIEW, uri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT)
        }

        runCatching {
            startActivity(adjacentIntent)
        }.onFailure {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
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

private fun hubEventDetailHero(event: dev.minepacu.stelliveeventnotifier.core.model.HubEvent): FrameLayout =
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
                        intArrayOf(Color.TRANSPARENT, Color.argb(188, 0, 0, 0))
                    )
                },
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    dp(172),
                    Gravity.BOTTOM
                )
            )

            addView(
                LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(dp(18), 0, dp(18), dp(10))
                    addView(LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL
                        HubEventDetailFormatting.heroTags(event).forEach { tag ->
                            addView(heroTagChip(tag.label, tag.tone))
                        }
                    })
                    addView(LinearLayout(context).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding(0, dp(10), 0, 0)
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
                                setPadding(0, if (index == 0) dp(7) else dp(3), 0, 0)
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

    private fun hubEventDetailActions(event: HubEvent): LinearLayout = LinearLayout(this).apply {
        val links = HubEventLinkPolicy.resolvedEventLinks(event)
        orientation = LinearLayout.HORIZONTAL
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            leftMargin = dp(18)
            rightMargin = dp(18)
            bottomMargin = dp(12)
        }

        val calendarParams = LinearLayout.LayoutParams(0, dp(50), 1f)
        if (links.isNotEmpty()) calendarParams.marginEnd = dp(5)
        addView(detailActionButton("캘린더 추가", primary = true) { openCalendarInsert(event) }, calendarParams)
        if (links.isNotEmpty()) {
            val ctaMode = HubEventLinkPolicy.eventCtaMode(event)
            val label = if (ctaMode == HubEventLinkCtaMode.DIRECT) {
                HubEventLinkPolicy.displayLinkLabel(links.single())
            } else {
                "관련 링크 ${links.size}개"
            }
            addView(
                detailActionButton(label, primary = false) {
                    if (ctaMode == HubEventLinkCtaMode.DIRECT) openHubEventLink(event, null, links.single())
                    else HubEventLinksBottomSheet(this@MainActivity) { link -> openHubEventLink(event, null, link) }.show("관련 링크", links)
                }.apply {
                    contentDescription = if (ctaMode == HubEventLinkCtaMode.DIRECT) "$label, 외부 링크 열기" else "$label, 목록 열기"
                },
                LinearLayout.LayoutParams(0, dp(50), 1f).apply { marginStart = dp(5) }
            )
        }
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
        val target = url?.trim()?.takeIf { it.isNotEmpty() } ?: return
        val uri = Uri.parse(target)
        val isSupportedScheme = uri.scheme.equals("http", ignoreCase = true) ||
            uri.scheme.equals("https", ignoreCase = true)
        if (!isSupportedScheme || uri.host.isNullOrBlank()) return

        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.external_link_no_handler, Toast.LENGTH_SHORT).show()
        }
    }

private fun compactEventCard(title: String, body: String, pills: List<String>, thumbnailUrl: String? = null): MaterialCardView =
        baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            }
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(13), dp(13), dp(13), dp(13))
            }
            thumbnailUrl?.let { content.addView(hubEventThumbnail(it)) }
            if (title.isNotBlank()) {
                content.addView(TextView(context).apply {
                    text = title
                    setTextColor(color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                })
            }
            content.addView(TextView(context).apply {
                text = body
                setTextColor(color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(0, if (title.isBlank()) 0 else dp(6), 0, 0)
            })
            if (pills.isNotEmpty()) {
                content.addView(pillRow(pills))
            }
            addView(content)
        }

    private fun settingsInfoCard(title: String, body: String, pills: List<String>): MaterialCardView =
        compactEventCard(title, body, pills).apply {
            layoutParams = settingsCardLayoutParams()
            (getChildAt(0) as? LinearLayout)?.let { content ->
                content.applySettingsCardContentPadding(horizontalPaddingDp = 13)
                (content.getChildAt(1) as? TextView)?.setPadding(
                    0,
                    dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp),
                    0,
                    0,
                )
            }
        }

    private fun targetToggleCard(
        title: String,
        body: String?,
        checked: Boolean,
        onCheckedChange: (Boolean) -> Unit
    ): MaterialCardView =
        baseCard().apply {
            layoutParams = settingsCardLayoutParams()

            addView(
                SettingsRowView(context).bind(
                    title = title,
                    body = body,
                    checked = checked,
                    onCheckedChange = onCheckedChange,
                    style = SettingsRowStyle.STANDALONE,
                )
            )
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

    private fun hubEventCard(event: dev.minepacu.stelliveeventnotifier.core.model.HubEvent): MaterialCardView {
        val body = listOfNotNull(
            listOfNotNull(event.status.displayName, event.sourceLabel, event.venueName).joinToString(" · "),
            event.summary?.takeIf { it.isNotBlank() },
        ).joinToString("\n")
        return compactEventCard(
            title = event.title,
            body = body,
            pills = listOf(event.category.displayName, event.participationMode.displayName),
            thumbnailUrl = event.image?.takeIf(HubEventImagePolicy::canDisplay)?.url,
        ).apply {
            isClickable = true
            isFocusable = true
            setOnClickListener {
                onGoodsEventSelected(event.id)
            }
        }
    }

    private fun historyEventCard(item: NotificationHistoryItem, member: HubMember?): MaterialCardView =
        baseCard().apply {
            layoutParams = settingsCardLayoutParams()
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.TOP
                applySettingsCardContentPadding(horizontalPaddingDp = 13)
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
            setPadding(0, dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp), 0, 0)
            setLineSpacing(0f, 1.12f)
        })
        addView(pillRow(listOf(item.eventType, item.deliveryMode.name.lowercase(), "${item.deliveryLatencyMs ?: "-"}ms")))
    }

    private fun settingsPanel(title: String? = null, rows: List<SettingRow>): MaterialCardView =
        baseCard().apply {
            val spacing = MainUiPolicy.settingsCardSpacing
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(spacing.bottomMarginDp)
            }
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(15), 0, dp(15), 0)
            }
            title?.let { panelTitle ->
                content.addView(TextView(context).apply {
                    text = panelTitle
                    setTextColor(color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                    val verticalPadding = MainUiPolicy.settingsPanelContentVerticalPaddingDp(hasTitle = true)
                    setPadding(0, dp(verticalPadding), 0, dp(verticalPadding))
                })
            }
            rows.forEachIndexed { index, row ->
                if (index > 0 || title != null) content.addView(divider())
                content.addView(settingRowView(row))
            }
            addView(content)
        }

    private fun historyFilterPanel(rows: List<HistoryFilterSelectorRow>): MaterialCardView =
        baseCard().apply {
            layoutParams = settingsCardLayoutParams()
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(15), 0, dp(15), 0)
            }
            content.addView(TextView(context).apply {
                text = "보기 필터"
                setTextColor(color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                val verticalPadding = dp(MainUiPolicy.settingsCardSpacing.contentVerticalPaddingDp)
                setPadding(0, verticalPadding, 0, verticalPadding)
            })
            rows.forEach { row ->
                content.addView(divider())
                content.addView(historyFilterSelectorRowView(row))
            }
            addView(content)
        }

    private fun historyFilterSelectorRowView(row: HistoryFilterSelectorRow): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        val verticalPadding = dp(MainUiPolicy.settingsCardSpacing.rowVerticalPaddingDp)
        setPadding(0, verticalPadding, 0, verticalPadding)
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
        HubSingleChoiceBottomSheet(
            context = this,
            title = title,
            options = options.map { HubSingleChoiceOption(it.first, it.second) },
            selectedId = selectedId,
            onSelected = onSelected,
        ).show()
    }

    private fun settingRowView(row: SettingRow): SettingsRowView =
        SettingsRowView(this).bind(
            title = row.title,
            body = row.body,
            checked = row.checked,
            enabled = row.enabled,
            badge = row.badge?.let { pill(it, true) },
            onCheckedChange = row.onCheckedChange,
            style = SettingsRowStyle.GROUPED,
        )

    private fun persistSettings(settings: dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState) {
        CoroutineScope(Dispatchers.Main).launch {
            serverRepository.updatePreferences(settings)
            val screen = navigationHistory.currentScreen
            refreshScreenWhenIdle(screen) { replaceScreenWithoutAnimation(screen) }
        }
    }

    private fun pillRow(labels: List<String>): ChipGroup = ChipGroup(this).apply {
        setPadding(0, dp(8), 0, 0)
        isSingleLine = false
        labels.forEach { label ->
            addView(rowChip(label))
        }
    }

    private fun heroTagChip(text: String, tone: HubEventHeroTagTone): Chip =
        rowChip(text).apply {
            val textColorRes = when (tone) {
                HubEventHeroTagTone.STATUS -> R.color.hub_success
                HubEventHeroTagTone.CATEGORY -> R.color.hub_warning
                HubEventHeroTagTone.PARTICIPATION -> R.color.hub_primary
            }
            val tagColor = color(textColorRes)
            setTextColor(tagColor)
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            minWidth = 0
            minHeight = 0
            chipMinHeight = dp(32).toFloat()
            chipStartPadding = dp(9).toFloat()
            chipEndPadding = dp(9).toFloat()
            textStartPadding = 0f
            textEndPadding = 0f
            iconStartPadding = 0f
            iconEndPadding = 0f
            closeIconStartPadding = 0f
            closeIconEndPadding = 0f
            chipBackgroundColor = ColorStateList.valueOf(tagColor.withAlpha(112))
            chipStrokeColor = ColorStateList.valueOf(tagColor.withAlpha(88))
            rippleColor = ColorStateList.valueOf(Color.TRANSPARENT)
            (layoutParams as? ViewGroup.MarginLayoutParams)?.marginEnd = dp(10)
        }

private fun rowChip(text: String): Chip = Chip(this).apply {
        this.text = text
        centerChipText(this)
        val isWarning = text.contains("필터") || text.contains("확인")
        val isOff = text.contains("OFF") || text.contains("제외") || text.contains("unsupported")
        val isGood = text.contains("LIVE") || text.contains("CHZZK") || text.contains("YouTube")
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
        gravity = Gravity.CENTER
        textAlignment = View.TEXT_ALIGNMENT_CENTER
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

    private fun centerChipText(chip: Chip): Chip = chip.apply {
        gravity = Gravity.CENTER
        textAlignment = View.TEXT_ALIGNMENT_CENTER
        textStartPadding = 0f
        textEndPadding = 0f
    }

private fun baseCard(style: HubCardStyle = HubCardStyle.STANDARD): MaterialCardView =
        cardFactory.create(style)

    private fun settingsCardLayoutParams(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            bottomMargin = dp(MainUiPolicy.settingsCardSpacing.bottomMarginDp)
        }

    private fun LinearLayout.applySettingsCardContentPadding(horizontalPaddingDp: Int = 15) {
        val verticalPadding = dp(MainUiPolicy.settingsCardSpacing.contentVerticalPaddingDp)
        setPadding(dp(horizontalPaddingDp), verticalPadding, dp(horizontalPaddingDp), verticalPadding)
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

private fun Int.withAlpha(alpha: Int): Int =
    Color.argb(alpha, Color.red(this), Color.green(this), Color.blue(this))

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

private data class SettingRow(
    val title: String,
    val body: String?,
    val checked: Boolean? = null,
    val badge: String? = null,
    val enabled: Boolean = true,
    val onCheckedChange: ((Boolean) -> Unit)? = null,
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
