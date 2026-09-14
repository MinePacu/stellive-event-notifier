package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.feature.announcements.AnnouncementsScreenController
import dev.minepacu.stelliveeventnotifier.feature.goodsevents.GoodsEventsScreenController
import dev.minepacu.stelliveeventnotifier.feature.history.HistoryScreenController
import dev.minepacu.stelliveeventnotifier.feature.home.HomeScreenController
import dev.minepacu.stelliveeventnotifier.feature.live.LiveScreenController
import dev.minepacu.stelliveeventnotifier.feature.reservations.ReservationsScreenController
import dev.minepacu.stelliveeventnotifier.feature.settings.SettingsScreenController
import dev.minepacu.stelliveeventnotifier.feature.songs.SongsScreenController

import android.Manifest
import android.app.AlertDialog
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.ActivityNotFoundException
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
import android.graphics.drawable.RippleDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.CalendarContract
import android.text.Editable
import android.text.TextWatcher
import android.transition.AutoTransition
import android.transition.TransitionManager
import android.util.Log
import android.util.LruCache
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
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
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
import coil.load
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
import dev.minepacu.stelliveeventnotifier.core.model.NotificationPlatform
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationPermissionPromptMoment
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationPermissionPromptPolicy
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.core.model.AnnouncementsSummary
import dev.minepacu.stelliveeventnotifier.core.model.ServiceAnnouncement
import dev.minepacu.stelliveeventnotifier.databinding.ActivityMainBinding
import dev.minepacu.stelliveeventnotifier.databinding.ViewReservationReturnPromptBinding
import dev.minepacu.stelliveeventnotifier.feature.calendar.HubCalendarDeepLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.calendar.CalendarUiPolicy
import dev.minepacu.stelliveeventnotifier.feature.calendar.HubEventsCalendarView
import dev.minepacu.stelliveeventnotifier.feature.home.HubScreen
import dev.minepacu.stelliveeventnotifier.feature.home.HubRepository
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
import dev.minepacu.stelliveeventnotifier.feature.home.PreferenceSyncConflictException
import dev.minepacu.stelliveeventnotifier.feature.home.ServerHubRepository
import dev.minepacu.stelliveeventnotifier.feature.songs.SongIdentity
import dev.minepacu.stelliveeventnotifier.feature.songs.SongDetailBottomSheet
import dev.minepacu.stelliveeventnotifier.feature.songs.SongDetailPolicy
import dev.minepacu.stelliveeventnotifier.feature.songs.SongLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.songs.SongOpenPreferenceStore
import dev.minepacu.stelliveeventnotifier.feature.songs.SongOpenTarget
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailCalendarCard
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailCalendarExpansionPolicy
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailCalendarMode
import dev.minepacu.stelliveeventnotifier.feature.hubevents.HubEventDetailCalendarPolicy
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import javax.inject.Inject
import java.net.URL
import java.io.File
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
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftExpiryKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftExpiryPresentation
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftExpiryPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDraftPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDetailLink
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDetailPresentation
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDetailPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDetailRow
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDeepLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationDeepLinkRoute
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEditPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEditStatusPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationEventSnapshot
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationExternalLinkPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpPage
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpFaqExpansionPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpAction
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpContextPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpFaq
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpFaqId
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpSection
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpSectionId
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpStatusKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpStatusPresentation
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpStep
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationHelpTone
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationLinkSource
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationListPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationListSectionKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationRecord
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptDecision
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptPresentationKind
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationReturnPromptPresentationPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationStatus
import dev.minepacu.stelliveeventnotifier.feature.reservations.domain.ReservationURLPolicy
import dev.minepacu.stelliveeventnotifier.feature.reservations.system.ReservationQuickAddActivity
import dev.minepacu.stelliveeventnotifier.feature.reservations.system.ReservationTileService
import dev.minepacu.stelliveeventnotifier.feature.reservations.system.ReservationSystemShortcutCoordinator
import dev.minepacu.stelliveeventnotifier.feature.update.AndroidApkInspector
import dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdateCandidate
import dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdateDownloadArtifact
import dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdateDownloader
import dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdateInstaller
import dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdatePolicy
import dev.minepacu.stelliveeventnotifier.feature.update.AndroidUpdateRepository
import dev.minepacu.stelliveeventnotifier.feature.update.GitHubReleaseAndroidUpdateRepository
import dev.minepacu.stelliveeventnotifier.feature.update.UpdatePreferenceStore

private const val EXIT_BACK_PRESS_INTERVAL_MS = 2_000L
private const val RETURN_PROMPT_ANIMATION_DURATION_MS = 200L
private const val NAVIGATION_RAIL_WIDTH_DP = 80
private const val LARGE_SCREEN_CONTENT_MAX_WIDTH_DP = 760
private const val GOODS_EVENTS_TWO_PANE_CONTENT_MAX_WIDTH_DP = 1120
private const val SONGS_TWO_PANE_CONTENT_MAX_WIDTH_DP = 1080
private const val SETTINGS_TWO_PANE_CONTENT_MAX_WIDTH_DP = 1080
private const val GOODS_EVENTS_CALENDAR_EXPANDED_STATE = "goods_events_calendar_expanded"
private const val DETAIL_CALENDAR_EXPANSION_EVENT_ID_STATE = "detail_calendar_expansion_event_id"
private const val DETAIL_CALENDAR_EXPANDED_STATE = "detail_calendar_expanded"
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

private data class RootNavigationItem(
    val screen: HubScreen,
    val view: View,
)

internal data class SongRenderState(
val catalogMembers: List<HubMember>,
val visibleSongs: List<SongCatalogItem>,
val displayedSongs: List<SongCatalogItem>,
val displayedCount: Int,
val totalFilteredCount: Int,
val remainingCount: Int,
)

internal data class ScrollablePane(
    val scrollView: NestedScrollView,
    val content: LinearLayout,
)


internal data class SongPanes(val filter: ScrollablePane, val list: ScrollablePane)

private data class PendingScreenRefresh(
    val screen: HubScreen,
    val render: () -> Unit,
)

internal enum class SongScrollSlot { SONGS_SINGLE, SONGS_TWO_PANE, SONG_SEARCH }


    private object SongResultDiffCallback : DiffUtil.ItemCallback<SongCatalogItem>() {
        override fun areItemsTheSame(oldItem: SongCatalogItem, newItem: SongCatalogItem): Boolean =
            (SongIdentity.identifier(oldItem) ?: oldItem.id) == (SongIdentity.identifier(newItem) ?: newItem.id)

        override fun areContentsTheSame(oldItem: SongCatalogItem, newItem: SongCatalogItem): Boolean = oldItem == newItem
    }

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

internal lateinit var binding: ActivityMainBinding
    private lateinit var settingsScreenController: SettingsScreenController
    internal lateinit var songsScreenController: SongsScreenController
    internal lateinit var goodsEventsScreenController: GoodsEventsScreenController
    internal lateinit var reservationsScreenController: ReservationsScreenController
    private lateinit var homeScreenController: HomeScreenController
    internal lateinit var announcementsScreenController: AnnouncementsScreenController
    internal lateinit var liveScreenController: LiveScreenController
    internal lateinit var historyScreenController: HistoryScreenController
    internal val repository = MockHubRepository()
    internal lateinit var serverRepository: HubRepository
    private lateinit var pushTokenSyncer: PushTokenSyncer
    private val liveClockHandler = Handler(Looper.getMainLooper())
    private val liveClockTextViews = mutableListOf<LiveClockTextView>()
    private val liveClockTicker = object : Runnable {
        override fun run() {
            updateLiveClockTextViews()
            scheduleLiveClockRefresh()
        }
    }
    internal var serverMembers: List<HubMember>? = null
    private var liveStatusSourceLabel = "앱 내 목업"
    internal var debugModeEnabled = false
    internal var systemTopInsetPx = 0
    private var systemBottomInsetPx = 0
    private var currentFoldFeature: HubFoldFeature? = null
    internal var currentAdaptiveSpec: HubAdaptiveSpec = HubAdaptivePolicy.spec(widthDp = 0)
    internal val topBarScrollSourceOffsets = mutableMapOf<View, Int>()
    private val avatarBitmapCache = LruCache<String, Bitmap>(64)
    private val serverConnectionDebugLogs = mutableListOf("bootstrap: 대기 중")
    internal val navigationHistory = MainNavigationHistory()
    private lateinit var screenTransitionController: ScreenTransitionController
    private var latestNavigationDestination = HubScreen.HOME
    private var latestRootDestination = HubScreen.HOME
    private var pendingScreenRefresh: PendingScreenRefresh? = null
    internal var activeTwoPaneDetailPane: View? = null
    internal var activeSettingsHubScrollView: NestedScrollView? = null
    private var lastRootBackPressedAt = 0L
internal var selectedFilter = "all"
internal var selectedLiveStatusFilter = "all"
internal var liveMemberPriorityIds: List<String> = emptyList()
internal var draggingLiveMemberId: String? = null
    internal var selectedHistoryEventTypeFilterId = "all"
    internal var selectedHistoryMemberFilterId = "all"
internal val songBrowseSession: SongBrowseSessionViewModel by viewModels()
internal var selectedSongType: String
    get() = songBrowseSession.type
    set(value) { songBrowseSession.type = value }
internal var selectedSongLibraryId: String
    get() = songBrowseSession.libraryId
    set(value) { songBrowseSession.libraryId = value }
internal var songFavoriteIds: Set<String> = emptySet()
internal var songDiscoveryState = SongDiscoveryStateV1()
internal lateinit var songDiscoveryRepository: SongDiscoveryRepository
internal lateinit var songFavoritesRepository: SongFavoritesRepository
internal val songOpenPreferenceStore by lazy { SongOpenPreferenceStore(this) }
internal var selectedSongSortId: String
    get() = songBrowseSession.sortId
    set(value) { songBrowseSession.sortId = value }
internal var selectedSongQuery: String
    get() = songBrowseSession.query
    set(value) { songBrowseSession.query = value }
internal var appliedSongQuery = ""
internal var visibleSongLimit: Int
    get() = songBrowseSession.visibleLimit
    set(value) { songBrowseSession.visibleLimit = value }
internal var isLoadingMoreSongs = false
internal var activeSongScrollView: View? = null
internal var activeSongRefreshScrollSources: List<View> = emptyList()
internal var activeSongListContainer: LinearLayout? = null
internal var activeSongScrollSlot: SongScrollSlot? = null
internal var isRestoringSongScrollPosition = false
internal lateinit var songScrollToTopButton: ImageButton
internal var selectedSongMemberFilter: SongMemberFilterState
    get() = songBrowseSession.memberFilter
    set(value) { songBrowseSession.memberFilter = value.normalized() }
internal var selectedSongMemberFilterDraft: SongMemberFilterState? = null
internal val songSearchHandler = Handler(Looper.getMainLooper())
internal var pendingSongSearchRender: Runnable? = null
internal var cachedSongItems: List<SongCatalogItem> = emptyList()
internal var cachedSongType: String? = null
internal var cachedSongCatalogAuthoritative = false
internal var songRefreshJob: Job? = null

    internal var goodsEventsJob: Job? = null
    internal var hubEventDetailJob: Job? = null
    internal var serverHubEventDetailJob: Job? = null
    internal var homeRecentSongsJob: Job? = null
    internal var persistSettingsJob: Job? = null
internal var songSearchResultsContainer: LinearLayout? = null
internal var songSearchResultsAdapter: SongResultsAdapter? = null
internal var homeRecentSongs: List<SongCatalogItem>? = null
internal var isLoadingHomeRecentSongs = false
internal var selectedHubEventId: String? = null
internal var selectedHubEventScheduleItemId: String? = null
internal val reservationDateFormatter = DateTimeFormatter.ofPattern("yyyy. M. d. HH:mm").withZone(ZoneId.of("Asia/Seoul"))
internal var reservationDrafts: List<ReservationDraft> = emptyList()
internal var reservationRecords: List<ReservationRecord> = emptyList()
internal var selectedReservationId: UUID? = null
internal var reservationEditHasUnsavedChanges: (() -> Boolean)? = null
private val externallyOpenedReservationSessionIds = mutableSetOf<UUID>()
private val promptedReservationSessionIds = mutableSetOf<UUID>()
private var reservationExternalFlowActive = false
private var reservationExternalFlowLeftApp = false
private var pendingReservationRecordingFailure = false
private var reservationReturnPromptView: View? = null
internal var pendingReservationHelpScrollAction: ReservationHelpAction? = null
internal var expandedReservationHelpFaqId: ReservationHelpFaqId? = null
internal val reservationHelpFaqUiStates = mutableMapOf<ReservationHelpFaqId, ReservationHelpFaqUiState>()
internal var expandedHubEventScheduleEventId: String? = null
internal val expandedHubEventScheduleItemIds = mutableSetOf<String>()
internal var detailCalendarSelectionEventId: String? = null
internal var detailCalendarSelectedDate: LocalDate? = null
internal val detailCalendarSelectedScheduleItemIds = mutableSetOf<String>()
internal var detailCalendarExpansionEventId: String? = null
internal var detailCalendarExpanded = true
internal var selectedAnnouncementId: String? = null
internal var announcementsSummary = AnnouncementsSummary()
internal var announcementItems: List<ServiceAnnouncement> = emptyList()
internal var announcementNextCursor: String? = null
internal var announcementReadKeys: Set<String> = emptySet()
internal lateinit var announcementReadStore: AnnouncementReadStore
    internal var goodsEventsDays: List<HubCalendarDay> = emptyList()
    internal var goodsEvents: List<HubEvent> = emptyList()
    internal var goodsEventsSelectedMonth: YearMonth = YearMonth.now()
    internal var goodsEventsCalendarExpanded = true
    internal var serverHubEventDetailLoadedId: String? = null
    internal var serverHubEventDetail: HubEvent? = null
    internal var selectedAppearanceMode = AppearanceMode.SYSTEM
private var notificationPermissionRequested = false
    private val requestNotificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
    private val updateRepository: AndroidUpdateRepository by lazy {
        GitHubReleaseAndroidUpdateRepository.create()
    }
    private val updatePreferenceStore by lazy { UpdatePreferenceStore(this) }
    private val updateDownloader by lazy { AndroidUpdateDownloader(this) }
    private val updateApkInspector by lazy { AndroidApkInspector(this) }
    private val updateInstaller by lazy { AndroidUpdateInstaller(this) }
    internal var updateCheckInProgress = false
    internal var updateStatusTextView: TextView? = null
    private var pendingUpdateInstallFile: File? = null
    private val requestUnknownSources = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) {
        val file = pendingUpdateInstallFile ?: return@registerForActivityResult
        if (updateInstaller.canRequestPackageInstalls()) {
            pendingUpdateInstallFile = null
            installValidatedUpdate(file)
        } else {
            updateStatus("알 수 없는 앱 설치 권한이 필요합니다.")
        }
    }
    private val cardFactory by lazy { HubCardFactory(this) }

    internal data class ReservationHelpFaqUiState(
        val card: MaterialCardView,
        val header: LinearLayout,
        val answerContainer: LinearLayout,
        val chevron: ImageView,
        val question: String,
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        selectedAppearanceMode = readAppearanceMode()
        liveMemberPriorityIds = readLiveMemberPriorityIds()
        AppCompatDelegate.setDefaultNightMode(selectedAppearanceMode.toNightMode())
        super.onCreate(savedInstanceState)
        goodsEventsCalendarExpanded = savedInstanceState?.getBoolean(
            GOODS_EVENTS_CALENDAR_EXPANDED_STATE,
            true,
        ) ?: true
        detailCalendarExpansionEventId =
            savedInstanceState?.getString(DETAIL_CALENDAR_EXPANSION_EVENT_ID_STATE)
        detailCalendarExpanded = savedInstanceState?.getBoolean(
            DETAIL_CALENDAR_EXPANDED_STATE,
            true,
        ) ?: true
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        settingsScreenController = SettingsScreenController(this)
        songsScreenController = SongsScreenController(this)
        goodsEventsScreenController = GoodsEventsScreenController(this)
        reservationsScreenController = ReservationsScreenController(this)
        homeScreenController = HomeScreenController(this)
        announcementsScreenController = AnnouncementsScreenController(this)
        liveScreenController = LiveScreenController(this)
        historyScreenController = HistoryScreenController(this)
        binding.root.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
            scheduleReservationReturnPromptPositionUpdate()
        }
        screenTransitionController = ScreenTransitionController(
            screenBody = binding.screenBody,
            dp = { value -> dp(value).toFloat() },
            onIdle = ::onScreenTransitionIdle,
        )
        songsScreenController.setupSongScrollToTopButton()
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
                    if (navigationHistory.currentScreen == HubScreen.ANNOUNCEMENTS) refreshScreenWhenIdle(HubScreen.ANNOUNCEMENTS, announcementsScreenController::renderAnnouncements)
                }
            }
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                songFavoritesRepository.favorites.collect { favorites ->
                    songFavoriteIds = favorites
                    if (navigationHistory.currentScreen == HubScreen.SONGS && cachedSongItems.isNotEmpty()) {
                        refreshScreenWhenIdle(HubScreen.SONGS, songsScreenController::renderSongsFromCache)
                    }
                }
            }
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                songDiscoveryRepository.state.collect { state ->
                    songDiscoveryState = state
                    if (navigationHistory.currentScreen == HubScreen.SONGS && cachedSongItems.isNotEmpty()) {
                        refreshScreenWhenIdle(HubScreen.SONGS, songsScreenController::renderSongsFromCache)
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
        outState.putString(DETAIL_CALENDAR_EXPANSION_EVENT_ID_STATE, detailCalendarExpansionEventId)
        outState.putBoolean(DETAIL_CALENDAR_EXPANDED_STATE, detailCalendarExpanded)
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
        dismissReservationReturnPrompt(animated = false)
        liveClockHandler.removeCallbacks(liveClockTicker)
        pendingSongSearchRender?.let(songSearchHandler::removeCallbacks)
        liveClockTextViews.clear()
        screenTransitionController.cancelAndClear()
        goodsEventsJob?.cancel()
        hubEventDetailJob?.cancel()
        serverHubEventDetailJob?.cancel()
        homeRecentSongsJob?.cancel()
        persistSettingsJob?.cancel()
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
 binding.contentRefresh.setOnChildScrollUpCallback { _, child ->
 if (navigationHistory.currentScreen == HubScreen.SONGS && songsScreenController.shouldUseSongsTwoPane()) {
     SongsPanePolicy.shouldBlockTwoPanePullToRefresh(
         buildList {
             add(binding.contentScroll.canScrollVertically(-1))
             activeSongRefreshScrollSources.forEach { source ->
                 add(source.canScrollVertically(-1))
             }
         },
     )
 } else {
     child?.canScrollVertically(-1) ?: false
 }
 }
 binding.contentRefresh.setOnRefreshListener {
 when (navigationHistory.currentScreen) {
     HubScreen.ANNOUNCEMENTS -> announcementsScreenController.loadAnnouncements(reset = true)
     HubScreen.SONGS -> songsScreenController.forceRefreshSongs()
     else -> loadServerBootstrap()
 }
 }
 }

 internal fun recordServerConnectionLog(message: String) {
        serverConnectionDebugLogs.add(message)
        while (serverConnectionDebugLogs.size > 8) {
            serverConnectionDebugLogs.removeAt(0)
        }
    }

    internal fun visibleServerConnectionDebugLogs(): List<String> =
        MainUiPolicy.debugServerConnectionLogs(debugModeEnabled, serverConnectionDebugLogs)

    internal fun serverStatusStrip(): MaterialCardView =
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

    internal fun handleAppDeepLink(intent: Intent?): Boolean {
        val deepLink = intent?.dataString ?: intent?.getStringExtra("appDeepLink")
        if (deepLink == "stellivehub://goods-events") {
            selectedReservationId = null
            navigationHistory.selectRoot(HubScreen.GOODS_EVENTS)
            replaceScreenWithoutAnimation(HubScreen.GOODS_EVENTS)
            return true
        }
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
                navigationHistory.select(HubScreen.RESERVATIONS)
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
        if (goodsEventsScreenController.shouldUseGoodsEventsTwoPane()) {
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

    internal fun registerTopBarScrollSource(source: View) {
        topBarScrollSourceOffsets[source] = source.scrollY
        source.setOnScrollChangeListener { view, _, scrollY, _, _ ->
            topBarScrollSourceOffsets[view] = scrollY
            updateTopBarScrolledFromSources()
        }
    }

    internal fun resetTopBarScrollSources() {
        topBarScrollSourceOffsets.clear()
        topBarScrollSourceOffsets[binding.contentScroll] = binding.contentScroll.scrollY
    }

    internal fun updateTopBarScrolledFromSources() {
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
        binding.topBarReservationHelp.setOnClickListener {
            when (navigationHistory.currentScreen) {
                HubScreen.RESERVATIONS -> pushScreen(HubScreen.RESERVATIONS_HELP)
                HubScreen.RESERVATION_DETAIL -> pushScreen(HubScreen.RESERVATION_DETAIL_HELP)
                else -> Unit
            }
        }
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
            if (dismissReservationReturnPrompt()) return@setOnClickListener
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

    internal fun navigateToRoot(screen: HubScreen) {
        if (screen == latestNavigationDestination &&
            (screenTransitionController.isTransitionRunning || !navigationHistory.canGoBack)
        ) {
            return
        }
        songsScreenController.captureActiveSongScrollPosition()
        lastRootBackPressedAt = 0L
        val from = latestRootDestination
        val motion = ScreenTransitionPolicy.motion(from, screen, ScreenTransitionReason.ROOT_SELECTION)
        latestNavigationDestination = screen
        latestRootDestination = screen
        performScreenTransition("root:${screen.id}", screen, motion) {
            navigationHistory.selectRoot(screen)
        }
    }

    internal fun pushScreen(screen: HubScreen) {
        if (screen == latestNavigationDestination) return
        songsScreenController.captureActiveSongScrollPosition()
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

    internal fun popScreen(): Boolean {
        if (confirmReservationEditDiscardIfNeeded { popScreen() }) return true
        if (screenTransitionController.isTransitionRunning) {
            screenTransitionController.runWhenIdle("deferred:pop", ::popScreenNow)
            return true
        }
        return popScreenNow()
    }

    private fun popScreenNow(): Boolean {
        val current = navigationHistory.currentScreen
        val previous = when (current) {
            HubScreen.RESERVATION_DETAIL -> HubScreen.RESERVATIONS
            else -> navigationHistory.previousScreen ?: return false
        }
        songsScreenController.captureActiveSongScrollPosition()
        latestNavigationDestination = previous
        val motion = ScreenTransitionPolicy.motion(
            current,
            previous,
            ScreenTransitionReason.POP,
        )
        performScreenTransition("pop:${previous.id}", previous, motion) {
            if (current == HubScreen.RESERVATION_DETAIL) {
                navigationHistory.goBackTo(HubScreen.RESERVATIONS)
            } else {
                navigationHistory.goBack()
            }
        }
        return true
    }

    private fun handleSystemBackPressed() {
        if (dismissReservationReturnPrompt()) return
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
            .setMessage("저장하지 않은 내역 변경 내용이 있습니다.")
            .setNegativeButton("계속 수정", null)
            .setPositiveButton("변경사항 버리기") { _, _ ->
                reservationEditHasUnsavedChanges = null
                onDiscard()
            }
            .show()
        return true
    }

    private fun handleSystemBackPressedNow() {
        if (navigationHistory.currentScreen in setOf(
                HubScreen.RESERVATION_DETAIL,
                HubScreen.RESERVATIONS_HELP,
                HubScreen.RESERVATION_DETAIL_HELP,
                HubScreen.ANNOUNCEMENT_DETAIL,
                HubScreen.HISTORY,
                HubScreen.SETTINGS_DELIVERY,
                HubScreen.SETTINGS_TARGETS,
                HubScreen.SETTINGS_PLATFORMS,
                HubScreen.SETTINGS_EVENT_TYPES,
                HubScreen.SETTINGS_HUB_EVENTS,
                HubScreen.SETTINGS_ADVANCED,
                HubScreen.SETTINGS_ABOUT,
            ) && popScreenNow()
        ) {
            lastRootBackPressedAt = 0L
            return
        }
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
        dismissReservationReturnPrompt()
        screenTransitionController.transition(
            key = key,
            motion = motion,
            isRtl = binding.root.layoutDirection == View.LAYOUT_DIRECTION_RTL,
        ) {
            updateHistory()
            replaceScreenWithoutAnimation(screen)
        }
    }

    internal fun replaceScreenWithoutAnimation(screen: HubScreen) {
        renderScreen(screen)
        updateSelectedBottomNavigation(screen)
        updateNavigationChrome()
    }

    internal fun refreshScreenWhenIdle(screen: HubScreen, render: () -> Unit) {
        if (screen != navigationHistory.currentScreen) return
        if (screenTransitionController.isTransitionRunning) {
            pendingScreenRefresh = PendingScreenRefresh(screen, render)
        } else {
            render()
        }
    }

    internal fun crossFadeTwoPaneSelection(key: String, render: () -> Unit) {
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

    internal fun renderScreen(screen: HubScreen) {
        if (screen != HubScreen.RESERVATION_EDIT) reservationEditHasUnsavedChanges = null
        if (screen != HubScreen.SONG_SEARCH) {
            pendingSongSearchRender?.let(songSearchHandler::removeCallbacks)
            pendingSongSearchRender = null
            songSearchResultsContainer = null
        }
        when (screen) {
HubScreen.HOME -> homeScreenController.renderHome()
HubScreen.SONGS -> songsScreenController.renderSongs()
HubScreen.SONG_SEARCH -> songsScreenController.renderSongSearch()
HubScreen.SONG_MEMBER_FILTER -> songsScreenController.renderSongMemberFilter()
HubScreen.GOODS_EVENTS -> goodsEventsScreenController.renderGoodsEvents()
            HubScreen.GOODS_EVENT_DETAIL -> goodsEventsScreenController.renderHubEventDetail()
            HubScreen.RESERVATIONS -> reservationsScreenController.renderReservations()
            HubScreen.RESERVATION_DETAIL -> reservationsScreenController.renderReservationDetail()
            HubScreen.RESERVATION_EDIT -> reservationsScreenController.renderReservationEdit()
            HubScreen.RESERVATIONS_HELP -> reservationsScreenController.renderReservationHelp(ReservationHelpPage.LIST)
            HubScreen.RESERVATION_DETAIL_HELP -> reservationsScreenController.renderReservationHelp(ReservationHelpPage.DETAIL)
            HubScreen.LIVE -> liveScreenController.renderLive()
HubScreen.HISTORY -> historyScreenController.renderHistory()
            HubScreen.ANNOUNCEMENTS -> announcementsScreenController.renderAnnouncements()
            HubScreen.ANNOUNCEMENT_DETAIL -> announcementsScreenController.renderAnnouncementDetail()
            HubScreen.SETTINGS -> settingsScreenController.renderSettings()
            HubScreen.SETTINGS_DELIVERY -> settingsScreenController.renderSettingsDelivery()
            HubScreen.SETTINGS_TARGETS -> settingsScreenController.renderSettingsTargets()
            HubScreen.SETTINGS_PLATFORMS -> settingsScreenController.renderSettingsPlatforms()
            HubScreen.SETTINGS_EVENT_TYPES -> settingsScreenController.renderSettingsEventTypes()
            HubScreen.SETTINGS_HUB_EVENTS -> settingsScreenController.renderSettingsHubEvents()
            HubScreen.SETTINGS_ADVANCED -> settingsScreenController.renderSettingsAdvanced()
            HubScreen.SETTINGS_ABOUT -> settingsScreenController.renderSettingsAbout()
        }
        updateTwoPaneScrollChrome(screen)
    }

    private fun updateTwoPaneScrollChrome(screen: HubScreen = navigationHistory.currentScreen) {
        val isTwoPaneScreen =
            screen == HubScreen.GOODS_EVENTS && goodsEventsScreenController.shouldUseGoodsEventsTwoPane() ||
                screen == HubScreen.SONGS && songsScreenController.shouldUseSongsTwoPane() ||
                screen == HubScreen.SETTINGS && shouldUseSettingsTwoPane()
        val isRefreshableScreen =
            screen == HubScreen.LIVE || screen == HubScreen.GOODS_EVENTS || screen == HubScreen.ANNOUNCEMENTS
        binding.contentRefresh.isEnabled =
            SongsPanePolicy.shouldEnablePullToRefresh(
                isSongsScreen = screen == HubScreen.SONGS,
                isTwoPaneScreen = isTwoPaneScreen,
                otherwiseRefreshable = isRefreshableScreen,
            )
        if (isTwoPaneScreen && screen != HubScreen.SONGS) {
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
        val reservationHelpScreen = navigationHistory.currentScreen
        binding.topBarReservationHelp.isVisible = reservationHelpScreen in setOf(
            HubScreen.RESERVATIONS,
            HubScreen.RESERVATION_DETAIL,
        )
        binding.topBarReservationHelp.contentDescription = when (reservationHelpScreen) {
            HubScreen.RESERVATION_DETAIL -> "내역 상세 도움말"
            else -> "내 예약 및 구매 도움말"
        }
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
        songsScreenController.scheduleSongScrollToTopButtonPositionUpdate()
        scheduleReservationReturnPromptPositionUpdate()
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
        HubScreen.RESERVATIONS_HELP -> R.id.tab_goods_events
        HubScreen.RESERVATION_DETAIL_HELP -> R.id.tab_goods_events
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

internal fun startScreen(
    screenId: String,
    title: String,
    role: String,
    showExpandedBodyHeader: Boolean = true,
) {
        binding.screenActionContainer.isVisible = false
        songsScreenController.scheduleSongScrollToTopButtonPositionUpdate()
        activeTwoPaneDetailPane = null
        activeSettingsHubScrollView = null
        if (screenId != "song_member_filter") selectedSongMemberFilterDraft = null
        if (screenId != "songs" && screenId != "song_search") {
            activeSongScrollView = null
            activeSongRefreshScrollSources = emptyList()
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
        if (showExpandedBodyHeader && MainScreenChromePolicy.spec(screenId, navigationHistory.canGoBack).showExpandedBodyHeader) {
            binding.contentList.addView(screenTitle(title))
            binding.contentList.addView(screenCopy(role))
        }
        binding.contentScroll.post {
            binding.contentScroll.scrollTo(0, 0)
            updateTopBarScrolled(false)
        }
    }

    internal fun applyContentTopPadding(underTopBar: Boolean) {
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
                navigationHistory.currentScreen == HubScreen.GOODS_EVENTS && goodsEventsScreenController.shouldUseGoodsEventsTwoPane() ->
                    GOODS_EVENTS_TWO_PANE_CONTENT_MAX_WIDTH_DP
                navigationHistory.currentScreen == HubScreen.SONGS && songsScreenController.shouldUseSongsTwoPane() ->
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

    internal fun scrollablePane(trackTopBarScroll: Boolean = true): ScrollablePane {
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

    // lateinit's `::prop.isInitialized` can only be checked lexically inside the declaring
    // class (or top level); these expose that check to SongsScreenController.
    internal fun isSongScrollToTopButtonInitialized(): Boolean = ::songScrollToTopButton.isInitialized

    internal fun isBindingInitialized(): Boolean = ::binding.isInitialized

    internal fun currentBottomObstructionHeight(): Int {
        val obstruction = when {
            binding.screenActionContainer.isVisible -> binding.screenActionContainer
            binding.bottomNavigation.isVisible -> binding.bottomNavigation
            else -> null
        }
        return obstruction?.let { view ->
            val rootLocation = IntArray(2)
            val viewLocation = IntArray(2)
            binding.root.getLocationInWindow(rootLocation)
            view.getLocationInWindow(viewLocation)
            (rootLocation[1] + binding.root.height - viewLocation[1]).coerceAtLeast(0)
        } ?: systemBottomInsetPx
    }

    internal fun twoPaneViewportHeight(): Int {
        val viewport = binding.contentScroll.height
        val verticalPadding = binding.contentList.paddingTop + binding.contentList.paddingBottom
        val fallback = resources.displayMetrics.heightPixels - systemTopInsetPx
        return (viewport.takeIf { it > 0 } ?: fallback)
            .minus(verticalPadding)
            .coerceAtLeast(dp(360))
    }

    internal fun clearTopFilters() {
        binding.topFilterContainer.removeAllViews()
        binding.topFilterContainer.isVisible = false
        binding.topBarFadeSpace.layoutParams = binding.topBarFadeSpace.layoutParams.apply {
            height = 0
        }
    }

    internal fun updateAnnouncementAction() {
        if (!::binding.isInitialized) return
        val unreadCount = announcementsSummary.items.count {
            AnnouncementPolicy.readKey(it.id, it.attentionRevision) !in announcementReadKeys
        }
        binding.topBarAnnouncementBadge.text = AnnouncementPolicy.badgeText(unreadCount).orEmpty()
        binding.topBarAnnouncementBadge.isVisible = unreadCount > 0 && binding.topBarAnnouncementContainer.isVisible
        binding.topBarAnnouncement.contentDescription = AnnouncementPolicy.accessibilityLabel(unreadCount)
    }

    internal fun reservationSummaryCard(): MaterialCardView = baseCard(HubCardStyle.INTERACTIVE).apply {
        val now = Instant.now()
        val activeDrafts = reservationDrafts.filter { it.expiresAt.isAfter(now) }
        val upcoming = reservationRecords.filter {
            it.status == ReservationStatus.CONFIRMED && (it.effectiveStartsAt?.isAfter(now) ?: true)
        }.sortedBy { it.effectiveStartsAt ?: Instant.MAX }
        isClickable = true
        isFocusable = true
        minimumHeight = dp(86)
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            bottomMargin = dp(12)
        }
        contentDescription = "내 예약 및 구매, 확인 필요 ${activeDrafts.size}개, 예정된 내역 ${upcoming.size}개"
        setOnClickListener { pushScreen(HubScreen.RESERVATIONS) }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(13), dp(16), dp(13))
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                addView(TextView(context).apply {
                    text = "내 예약·구매"
                    textSize = 16f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(color(R.color.hub_text))
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                })
                addView(TextView(context).apply {
                    text = "›"
                    textSize = 22f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(color(R.color.hub_primary))
                    includeFontPadding = false
                    contentDescription = "내 예약 및 구매 열기"
                })
            })
            addView(TextView(context).apply {
                text = "확인 필요 ${activeDrafts.size}개 · 예정된 내역 ${upcoming.size}개"
                textSize = 12f
                setTextColor(color(R.color.hub_text_muted))
                setPadding(0, dp(4), 0, 0)
            })
            upcoming.firstOrNull()?.effectiveStartsAt?.let { startsAt ->
                addView(TextView(context).apply {
                    text = "가장 가까운 내역 · ${reservationDateFormatter.format(startsAt)}"
                    textSize = 11f
                    setTextColor(color(R.color.hub_primary))
                    setPadding(0, dp(5), 0, 0)
                })
            }
        })
    }

    internal fun openHubEventLink(
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
                getString(R.string.reservation_error_external_recording),
                Snackbar.LENGTH_LONG,
            ).setAction(R.string.reservation_action_open_history) {
                pushScreen(HubScreen.RESERVATIONS)
            }.show()
        }
        when (val decision = ReservationReturnPromptPolicy.decision(
            drafts = reservationDrafts,
            externallyOpenedSessionIds = externallyOpenedReservationSessionIds,
            promptedSessionIds = promptedReservationSessionIds,
        )) {
            ReservationReturnPromptDecision.None -> Unit
            is ReservationReturnPromptDecision.Single -> {
                val draft = reservationDrafts.firstOrNull { it.sessionId == decision.sessionId } ?: return
                promptedReservationSessionIds += decision.sessionId
                showReservationReturnPrompt(
                    presentationKind = ReservationReturnPromptPresentationPolicy.single(draft.kind),
                    itemTitle = draft.eventSnapshot.title,
                    primaryLabel = ReservationPresentationPolicy.addActionLabel(draft.kind),
                    bodyRes = R.string.reservation_return_prompt_single_body,
                    secondaryLabelRes = R.string.reservation_return_prompt_not_yet,
                ) {
                    startActivity(Intent(this, ReservationQuickAddActivity::class.java).putExtra(
                        ReservationQuickAddActivity.EXTRA_SESSION_ID,
                        decision.sessionId.toString(),
                    ))
                }
            }
            is ReservationReturnPromptDecision.Multiple -> {
                promptedReservationSessionIds += decision.sessionIds
                showReservationReturnPrompt(
                    presentationKind = ReservationReturnPromptPresentationKind.MULTIPLE,
                    itemTitle = null,
                    primaryLabel = getString(R.string.reservation_help_action_view_pending),
                    bodyRes = R.string.reservation_return_prompt_multiple_body,
                    secondaryLabelRes = R.string.reservation_return_prompt_later,
                ) { pushScreen(HubScreen.RESERVATIONS) }
            }
        }
    }

    private fun showReservationReturnPrompt(
        presentationKind: ReservationReturnPromptPresentationKind,
        itemTitle: String?,
        primaryLabel: String,
        bodyRes: Int,
        secondaryLabelRes: Int,
        onPrimary: () -> Unit,
    ) {
        dismissReservationReturnPrompt(animated = false)
        binding.reservationReturnPromptContainer.removeAllViews()
        val prompt = ViewReservationReturnPromptBinding.inflate(
            layoutInflater,
            binding.reservationReturnPromptContainer,
            false,
        )
        prompt.reservationReturnPromptTitle.setText(returnPromptTitleRes(presentationKind))
        prompt.reservationReturnPromptItemTitle.text = itemTitle.orEmpty()
        prompt.reservationReturnPromptItemTitle.isVisible = !itemTitle.isNullOrBlank()
        prompt.reservationReturnPromptBody.setText(bodyRes)
        prompt.reservationReturnPromptPrimary.text = primaryLabel
        prompt.reservationReturnPromptPrimary.setOnClickListener {
            dismissReservationReturnPrompt(animated = false)
            onPrimary()
        }
        prompt.reservationReturnPromptSecondary.setText(secondaryLabelRes)
        prompt.reservationReturnPromptSecondary.setOnClickListener { dismissReservationReturnPrompt() }
        val promptView = prompt.root
        reservationReturnPromptView = promptView
        binding.reservationReturnPromptContainer.addView(
            promptView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM,
            ),
        )
        scheduleReservationReturnPromptPositionUpdate()
        promptView.alpha = 0f
        promptView.translationY = dp(24).toFloat()
        promptView.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(RETURN_PROMPT_ANIMATION_DURATION_MS)
            .start()
    }

    private fun returnPromptTitleRes(kind: ReservationReturnPromptPresentationKind): Int = when (kind) {
        ReservationReturnPromptPresentationKind.TICKET -> R.string.reservation_return_prompt_ticket_title
        ReservationReturnPromptPresentationKind.PURCHASE -> R.string.reservation_return_prompt_purchase_title
        ReservationReturnPromptPresentationKind.RESERVATION -> R.string.reservation_return_prompt_reservation_title
        ReservationReturnPromptPresentationKind.MULTIPLE -> R.string.reservation_return_prompt_multiple_title
    }

    private fun dismissReservationReturnPrompt(animated: Boolean = true): Boolean {
        val prompt = reservationReturnPromptView ?: return false
        reservationReturnPromptView = null
        val remove = { binding.reservationReturnPromptContainer.removeView(prompt) }
        if (!animated || !prompt.isAttachedToWindow) {
            remove()
        } else {
            prompt.animate()
                .alpha(0f)
                .translationY(dp(24).toFloat())
                .setDuration(RETURN_PROMPT_ANIMATION_DURATION_MS)
                .withEndAction(remove)
                .start()
        }
        return true
    }

    internal fun scheduleReservationReturnPromptPositionUpdate() {
        val prompt = reservationReturnPromptView ?: return
        binding.root.post {
            if (reservationReturnPromptView !== prompt || binding.root.width == 0) return@post
            val params = prompt.layoutParams as? FrameLayout.LayoutParams ?: return@post
            val maxWidth = minOf((binding.root.width - dp(36)).coerceAtLeast(1), dp(560))
            val songButtonSpace = if (::songScrollToTopButton.isInitialized && songScrollToTopButton.isVisible) dp(64) else 0
            params.width = maxWidth
            params.bottomMargin = currentBottomObstructionHeight() + songButtonSpace + dp(16)
            params.gravity = Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM
            prompt.layoutParams = params
        }
    }

    // RecyclerView.Adapter for song search results. songCard() already builds a full,
    // self-contained row (thumbnail, chips, favorite/menu click listeners); this adapter's
    // only job is to let DiffUtil skip rebuilding rows that haven't changed between refreshes,
    // instead of the previous removeAllViews()+addView() rebuild of the entire result set.
    internal inner class SongResultsAdapter : ListAdapter<SongCatalogItem, SongViewHolder>(SongResultDiffCallback) {

        var catalogMembers: List<HubMember> = emptyList()

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SongViewHolder =
            SongViewHolder(
                FrameLayout(parent.context).apply {
                    layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                },
            )

        override fun onBindViewHolder(holder: SongViewHolder, position: Int) {
            val song = getItem(position)
            val wrapper = holder.itemView as FrameLayout
            wrapper.removeAllViews()
            wrapper.tag = SongIdentity.identifier(song)
            wrapper.addView(
                songsScreenController.songCard(song, catalogMembers),
                FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
                    bottomMargin = dp(10)
                },
            )
        }
    }


    internal class SongViewHolder(view: FrameLayout) : RecyclerView.ViewHolder(view)

internal fun filterPanel(
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

internal fun filterSegmentView(
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

    internal fun requestNotificationPermissionIfNeeded(moment: NotificationPermissionPromptMoment) {
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if (NotificationPermissionPromptPolicy.shouldRequest(moment, granted, notificationPermissionRequested)) {
            notificationPermissionRequested = true
            requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    internal fun checkForAndroidUpdate(manual: Boolean) {
        if (updateCheckInProgress) return
        updateCheckInProgress = true
        if (manual) updateStatus("업데이트를 확인하는 중입니다.")
        lifecycleScope.launch {
            try {
                val now = System.currentTimeMillis()
                if (!manual && !updatePreferenceStore.shouldRunAutomaticCheck(now)) return@launch
                if (!manual) updatePreferenceStore.markAutomaticCheck(now)
                val candidate = updateRepository.latestUpdate(
                    installedPackageName = packageName,
                    installedVersionCode = BuildConfig.VERSION_CODE.toLong(),
                )
                when {
                    candidate == null && manual -> updateStatus("현재 최신 버전을 사용하고 있습니다.")
                    candidate == null -> Unit
                    !manual &&
                        !AndroidUpdatePolicy.isMandatory(
                            candidate.manifest,
                            BuildConfig.VERSION_CODE.toLong(),
                        ) &&
                        updatePreferenceStore.isDismissed(candidate.manifest.versionCode) -> Unit
                    else -> {
                        updateStatus("새 버전 ${candidate.manifest.versionName}을 사용할 수 있습니다.")
                        showAndroidUpdateDialog(candidate)
                    }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (throwable: Throwable) {
                if (manual) updateStatus("업데이트 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")
                Log.w("AndroidUpdate", "Release update check failed", throwable)
            } finally {
                updateCheckInProgress = false
            }
        }
    }

    private fun showAndroidUpdateDialog(candidate: AndroidUpdateCandidate) {
        val mandatory = AndroidUpdatePolicy.isMandatory(
            candidate.manifest,
            BuildConfig.VERSION_CODE.toLong(),
        )
        val builder = AlertDialog.Builder(this)
            .setTitle(if (mandatory) "필수 업데이트가 있습니다" else "새 업데이트가 있습니다")
            .setMessage(
                "버전 ${candidate.manifest.versionName} (${candidate.manifest.versionCode})을 다운로드할 수 있습니다." +
                    if (mandatory) "\n현재 버전은 더 이상 지원되지 않습니다." else "",
            )
            .setPositiveButton("다운로드") { _, _ -> downloadAndInstallUpdate(candidate) }
            .setNeutralButton("릴리스 보기") { _, _ ->
                openExternalUrl(candidate.releaseHtmlUrl)
            }
        if (!mandatory) {
            builder.setNegativeButton("나중에") { _, _ ->
                lifecycleScope.launch {
                    updatePreferenceStore.dismiss(candidate.manifest.versionCode)
                }
            }
        }
        builder.show()
    }

    private fun downloadAndInstallUpdate(candidate: AndroidUpdateCandidate) {
        updateStatus("업데이트 파일을 다운로드하는 중입니다.")
        lifecycleScope.launch {
            var artifact: AndroidUpdateDownloadArtifact? = null
            runCatching {
                artifact = updateDownloader.downloadToTemporary(candidate)
                val validation = updateApkInspector.validate(
                    checkNotNull(artifact).temporaryFile,
                    candidate.manifest,
                )
                check(validation.isValid) {
                    "apk_validation_failed_${validation.errors.joinToString("_")}"
                }
                updateDownloader.promoteValidated(checkNotNull(artifact))
            }.onSuccess { file ->
                updateStatus("다운로드 검증을 마쳤습니다. 시스템 설치 화면을 엽니다.")
                requestUpdateInstall(file)
            }.onFailure {
                artifact?.let(updateDownloader::discard)
                updateStatus("업데이트 파일을 검증하거나 열지 못했습니다.")
                Log.w("AndroidUpdate", "Release update download/install failed", it)
            }
        }
    }

    private fun requestUpdateInstall(file: File) {
        if (updateInstaller.canRequestPackageInstalls()) {
            installValidatedUpdate(file)
            return
        }
        pendingUpdateInstallFile = file
        runCatching {
            requestUnknownSources.launch(updateInstaller.unknownSourcesSettingsIntent())
        }.onFailure {
            pendingUpdateInstallFile = null
            updateStatus("알 수 없는 앱 설치 설정을 열 수 없습니다.")
        }
    }

    private fun installValidatedUpdate(file: File) {
        runCatching { updateInstaller.install(file) }
            .onFailure {
                updateStatus("시스템 패키지 설치 화면을 열 수 없습니다.")
                Log.w("AndroidUpdate", "Package installer launch failed", it)
            }
    }

    private fun updateStatus(message: String) {
        updateStatusTextView?.text = message
        if (navigationHistory.currentScreen != HubScreen.SETTINGS_ABOUT) {
            Snackbar.make(binding.root, message, Snackbar.LENGTH_LONG).show()
        }
    }

    internal fun shouldUseSettingsTwoPane(): Boolean =
        currentAdaptiveSpec.useLargeScreenLayout

    private fun readAppearanceMode(): AppearanceMode {
        val value = getSharedPreferences("hub_preferences", Context.MODE_PRIVATE)
            .getString(PreferenceKeys.APPEARANCE_MODE, AppearanceMode.SYSTEM.name)
        return AppearanceMode.entries.firstOrNull { it.name == value } ?: AppearanceMode.SYSTEM
    }

    internal fun writeAppearanceMode(mode: AppearanceMode) {
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

    internal fun registerLiveClockTextView(startedAt: Instant, textView: TextView) {
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
            systemBottomInsetPx = bars.bottom
            binding.topGlassOverlay.setPadding(0, bars.top, 0, 0)
            binding.mainContent.setPadding(0, 0, 0, bars.bottom)
            binding.navigationRail.setPadding(0, bars.top + dp(8), 0, bars.bottom + dp(8))
            applyContentTopPadding(underTopBar = navigationHistory.currentScreen == HubScreen.GOODS_EVENT_DETAIL)
            scheduleReservationReturnPromptPositionUpdate()
            insets
        }
        ViewCompat.requestApplyInsets(binding.root)
        updateTopBarGlass(scrolled = false)
    }

    private fun updateTopBarGlass(scrolled: Boolean) {
        window.statusBarColor = Color.TRANSPARENT
    }

    internal fun screenTitle(text: String): TextView = TextView(this).apply {
        this.text = text
        setTextColor(color(R.color.hub_text))
        textSize = 26f
        typeface = Typeface.DEFAULT_BOLD
        includeFontPadding = false
        setPadding(0, 0, 0, dp(8))
    }

    internal fun screenCopy(text: String): TextView = TextView(this).apply {
        this.text = text
        setTextColor(color(R.color.hub_text_muted))
        textSize = 13f
        setLineSpacing(0f, 1.12f)
        setPadding(0, 0, 0, dp(16))
    }

internal fun sectionLabel(text: String): SectionHeaderView =
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
                    homeScreenController.renderHome()
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
                    liveScreenController.renderLive()
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

internal fun loadingCard(presentation: LoadingPresentation): MaterialCardView =
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

internal fun noticeCard(text: String): TextView = TextView(this).apply {
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

    internal fun memberAvatar(member: HubMember, size: Int, showsLiveIndicator: Boolean = false): FrameLayout =
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

    internal fun channelImageAvatar(imageUrl: String, size: Int): ImageView =
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

    internal fun avatarText(member: HubMember, size: Int): TextView = TextView(this).apply {
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

internal fun statusBadge(text: String, positive: Boolean): TextView = TextView(this).apply {
        this.text = text
        gravity = Gravity.CENTER
        textAlignment = View.TEXT_ALIGNMENT_CENTER
        setTextColor(if (positive) color(R.color.hub_success) else color(R.color.hub_text))
        textSize = 11f
        typeface = Typeface.DEFAULT_BOLD
        includeFontPadding = false
        background = rounded(
            fill = if (positive) color(R.color.hub_success_soft) else color(R.color.hub_surface),
            radius = dp(14),
            stroke = if (positive) color(R.color.hub_success) else color(R.color.hub_text_muted)
        )
        setPadding(dp(8), dp(5), dp(8), dp(5))
    }

    private fun liveIndicator(size: Int): View = View(this).apply {
        background = rounded(
            fill = color(R.color.hub_success),
            radius = size / 2,
            stroke = color(R.color.hub_card)
        )
    }

    internal fun detailActionButton(label: String, primary: Boolean, onClick: () -> Unit): TextView =
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

    internal fun openExternalUrl(url: String?) {
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

internal fun compactEventCard(title: String, body: String, pills: List<String>, thumbnailUrl: String? = null): MaterialCardView =
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

    internal fun hubEventThumbnail(imageUrl: String): ImageView =
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

    internal fun hubEventCard(event: dev.minepacu.stelliveeventnotifier.core.model.HubEvent): MaterialCardView {
        val body = listOfNotNull(
            listOfNotNull(event.status.displayName, event.sourceLabel, event.venueName).joinToString(" · "),
            event.summary?.takeIf { it.isNotBlank() },
        ).joinToString("\n")
        return compactEventCard(
            title = event.title,
            body = body,
            pills = MainUiPolicy.goodsEventPillLabels(
                event.category,
                event.participationMode,
                event.tags,
            ),
            thumbnailUrl = event.image?.takeIf(HubEventImagePolicy::canDisplay)?.url,
        ).apply {
            isClickable = true
            isFocusable = true
            setOnClickListener {
                goodsEventsScreenController.onGoodsEventSelected(event.id)
            }
        }
    }

    internal fun settingsPanel(title: String? = null, rows: List<SettingRow>): MaterialCardView =
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

    internal fun pillRow(labels: List<String>): ChipGroup = ChipGroup(this).apply {
        setPadding(0, dp(8), 0, 0)
        isSingleLine = false
        labels.forEach { label ->
            addView(rowChip(label))
        }
    }

internal fun rowChip(text: String): Chip = Chip(this).apply {
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

internal fun pill(text: String, good: Boolean): TextView = TextView(this).apply {
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

    internal fun centerChipText(chip: Chip): Chip = chip.apply {
        gravity = Gravity.CENTER
        textAlignment = View.TEXT_ALIGNMENT_CENTER
        textStartPadding = 0f
        textEndPadding = 0f
    }

internal fun baseCard(style: HubCardStyle = HubCardStyle.STANDARD): MaterialCardView =
        cardFactory.create(style)

    internal fun divider(): View = View(this).apply {
        setBackgroundColor(color(R.color.hub_line))
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
    }

    internal fun rounded(fill: Int, radius: Int, stroke: Int? = null): GradientDrawable =
        GradientDrawable().apply {
            setColor(fill)
            cornerRadius = radius.toFloat()
            if (stroke != null) setStroke(dp(1), stroke)
        }

internal fun color(id: Int): Int = ContextCompat.getColor(this, id)

private fun Int.withAlpha(alpha: Int): Int =
    Color.argb(alpha, Color.red(this), Color.green(this), Color.blue(this))

    internal fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}


internal data class SettingRow(
    val title: String,
    val body: String?,
    val checked: Boolean? = null,
    val badge: String? = null,
    val enabled: Boolean = true,
    val onCheckedChange: ((Boolean) -> Unit)? = null,
)

internal fun AppearanceMode.toNightMode(): Int = when (this) {
    AppearanceMode.SYSTEM -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
    AppearanceMode.LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
    AppearanceMode.DARK -> AppCompatDelegate.MODE_NIGHT_YES
}
