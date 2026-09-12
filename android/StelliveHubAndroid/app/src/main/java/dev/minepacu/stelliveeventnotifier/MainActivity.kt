package dev.minepacu.stelliveeventnotifier

import dev.minepacu.stelliveeventnotifier.feature.goodsevents.GoodsEventsScreenController
import dev.minepacu.stelliveeventnotifier.feature.settings.SettingsScreenController
import dev.minepacu.stelliveeventnotifier.feature.songs.SongsScreenController

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
import android.graphics.drawable.RippleDrawable
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
import dev.minepacu.stelliveeventnotifier.core.model.NotificationHistoryItem
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
import dev.minepacu.stelliveeventnotifier.ui.components.HubSingleChoiceBottomSheet
import dev.minepacu.stelliveeventnotifier.ui.components.HubSingleChoiceOption
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
private const val RESERVATION_PENDING_SECTION_TAG = "reservation_pending_section"
private const val RESERVATION_UPCOMING_SECTION_TAG = "reservation_upcoming_section"

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
private var selectedLiveStatusFilter = "all"
private var liveMemberPriorityIds: List<String> = emptyList()
private var draggingLiveMemberId: String? = null
    private var selectedHistoryEventTypeFilterId = "all"
    private var selectedHistoryMemberFilterId = "all"
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
    private var homeRecentSongsJob: Job? = null
    internal var persistSettingsJob: Job? = null
internal var songSearchResultsContainer: LinearLayout? = null
internal var songSearchResultsAdapter: SongResultsAdapter? = null
private var homeRecentSongs: List<SongCatalogItem>? = null
private var isLoadingHomeRecentSongs = false
internal var selectedHubEventId: String? = null
internal var selectedHubEventScheduleItemId: String? = null
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
private var reservationReturnPromptView: View? = null
private var pendingReservationHelpScrollAction: ReservationHelpAction? = null
private var expandedReservationHelpFaqId: ReservationHelpFaqId? = null
private val reservationHelpFaqUiStates = mutableMapOf<ReservationHelpFaqId, ReservationHelpFaqUiState>()
internal var expandedHubEventScheduleEventId: String? = null
internal val expandedHubEventScheduleItemIds = mutableSetOf<String>()
internal var detailCalendarSelectionEventId: String? = null
internal var detailCalendarSelectedDate: LocalDate? = null
internal val detailCalendarSelectedScheduleItemIds = mutableSetOf<String>()
internal var detailCalendarExpansionEventId: String? = null
internal var detailCalendarExpanded = true
private var selectedAnnouncementId: String? = null
private var announcementsSummary = AnnouncementsSummary()
private var announcementItems: List<ServiceAnnouncement> = emptyList()
private var announcementNextCursor: String? = null
private var announcementReadKeys: Set<String> = emptySet()
private lateinit var announcementReadStore: AnnouncementReadStore
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

    private data class ReservationHelpFaqUiState(
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
                    if (navigationHistory.currentScreen == HubScreen.ANNOUNCEMENTS) refreshScreenWhenIdle(HubScreen.ANNOUNCEMENTS, ::renderAnnouncements)
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
     HubScreen.ANNOUNCEMENTS -> loadAnnouncements(reset = true)
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

    private fun handleAppDeepLink(intent: Intent?): Boolean {
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

    private fun navigateToRoot(screen: HubScreen) {
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

    private fun renderScreen(screen: HubScreen) {
        if (screen != HubScreen.RESERVATION_EDIT) reservationEditHasUnsavedChanges = null
        if (screen != HubScreen.SONG_SEARCH) {
            pendingSongSearchRender?.let(songSearchHandler::removeCallbacks)
            pendingSongSearchRender = null
            songSearchResultsContainer = null
        }
        when (screen) {
HubScreen.HOME -> renderHome()
HubScreen.SONGS -> songsScreenController.renderSongs()
HubScreen.SONG_SEARCH -> songsScreenController.renderSongSearch()
HubScreen.SONG_MEMBER_FILTER -> songsScreenController.renderSongMemberFilter()
HubScreen.GOODS_EVENTS -> goodsEventsScreenController.renderGoodsEvents()
            HubScreen.GOODS_EVENT_DETAIL -> goodsEventsScreenController.renderHubEventDetail()
            HubScreen.RESERVATIONS -> renderReservations()
            HubScreen.RESERVATION_DETAIL -> renderReservationDetail()
            HubScreen.RESERVATION_EDIT -> renderReservationEdit()
            HubScreen.RESERVATIONS_HELP -> renderReservationHelp(ReservationHelpPage.LIST)
            HubScreen.RESERVATION_DETAIL_HELP -> renderReservationHelp(ReservationHelpPage.DETAIL)
            HubScreen.LIVE -> renderLive()
HubScreen.HISTORY -> renderHistory()
            HubScreen.ANNOUNCEMENTS -> renderAnnouncements()
            HubScreen.ANNOUNCEMENT_DETAIL -> renderAnnouncementDetail()
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
        binding.root.post {
            if (navigationHistory.currentScreen == HubScreen.HOME) {
                checkForAndroidUpdate(manual = false)
            }
        }
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
            else -> recentSongs.forEach { binding.contentList.addView(songsScreenController.songCard(it)) }
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
        homeRecentSongsJob?.cancel()
        homeRecentSongsJob = lifecycleScope.launch {
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

    private fun renderReservations() {
        startScreen(
            screenId = "reservations",
            title = "내 예약·구매",
            role = "임시 항목과 내역은 이 기기에 저장되며 외부 완료 여부를 자동 확인하지 않습니다.",
            showExpandedBodyHeader = false,
        )
        binding.contentList.addView(detailActionButton("빠른 설정에 내역 추가 버튼 넣기", false) {
            ReservationSystemShortcutCoordinator.requestTile(this)
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)).apply { bottomMargin = dp(10) })
        val now = Instant.now()
        val activeDrafts = ReservationDraftPolicy.active(reservationDrafts, now)
        if (activeDrafts.isNotEmpty()) {
            binding.contentList.addView(sectionLabel("확인 필요").apply { tag = RESERVATION_PENDING_SECTION_TAG })
            activeDrafts.sortedByDescending(ReservationDraft::openedAt).forEach { draft ->
                binding.contentList.addView(baseCard(HubCardStyle.COMPACT).apply {
                    addView(LinearLayout(context).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding(dp(15), dp(13), dp(15), dp(13))
                        addView(TextView(context).apply { text = draft.eventSnapshot.title; textSize = 15f; typeface = Typeface.DEFAULT_BOLD; setTextColor(color(R.color.hub_text)) })
                        addView(TextView(context).apply { text = "${ReservationPresentationPolicy.inProgressLabel(draft.kind)} · ${draft.providerHost}"; textSize = 12f; setTextColor(color(R.color.hub_text_muted)); setPadding(0, dp(4), 0, 0) })
                        ReservationDraftExpiryPresentationPolicy.presentation(draft.expiresAt, now)?.let { expiry ->
                            addView(TextView(context).apply {
                                text = reservationDraftExpiryText(expiry)
                                textSize = 12f
                                typeface = Typeface.DEFAULT_BOLD
                                setTextColor(color(R.color.hub_warning))
                                setPadding(0, dp(5), 0, 0)
                            })
                        }
                        addView(LinearLayout(context).apply {
                            orientation = LinearLayout.HORIZONTAL
                            addView(detailActionButton("취소", false) {
                                lifecycleScope.launch { reservationRepository.deleteDraft(draft) }
                            }, LinearLayout.LayoutParams(0, dp(44), 1f).apply { marginEnd = dp(5) })
                            addView(detailActionButton(ReservationPresentationPolicy.addActionLabel(draft.kind), true) {
                                startActivity(Intent(this@MainActivity, ReservationQuickAddActivity::class.java).putExtra(ReservationQuickAddActivity.EXTRA_SESSION_ID, draft.sessionId.toString()))
                            }, LinearLayout.LayoutParams(0, dp(44), 1f).apply { marginStart = dp(5) })
                        }.apply { setPadding(0, dp(10), 0, 0) })
                    })
                })
            }
        }
        val sections = ReservationListPolicy.sections(reservationRecords)
        addReservationRecordSection("예정된 내역", sections.upcoming, ReservationListSectionKind.UPCOMING)
        addReservationRecordSection("지난 내역", sections.past, ReservationListSectionKind.PAST)
        if (activeDrafts.isEmpty() && reservationRecords.isEmpty()) {
            binding.contentList.addView(compactEventCard("저장된 내역 없음", "굿즈·행사에서 티켓, 구매 또는 예약 링크를 열면 진행 중인 항목이 여기에 표시됩니다.", emptyList()))
            binding.contentList.addView(detailActionButton("사용 방법 보기", false) {
                pushScreen(HubScreen.RESERVATIONS_HELP)
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)).apply {
                bottomMargin = dp(10)
            })
        }
        pendingReservationHelpScrollAction?.let { action ->
            pendingReservationHelpScrollAction = null
            val targetTag = when (action) {
                ReservationHelpAction.VIEW_PENDING -> RESERVATION_PENDING_SECTION_TAG
                ReservationHelpAction.VIEW_UPCOMING -> RESERVATION_UPCOMING_SECTION_TAG
                else -> null
            }
            targetTag?.let(::scrollReservationContentToTag)
        }
    }

    private fun addReservationRecordSection(
        title: String,
        records: List<ReservationRecord>,
        section: ReservationListSectionKind,
    ) {
        if (records.isEmpty()) return
        binding.contentList.addView(sectionLabel(title).apply {
            if (section == ReservationListSectionKind.UPCOMING) tag = RESERVATION_UPCOMING_SECTION_TAG
        })
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
                        text = "${ReservationPresentationPolicy.statusLabel(record.kind, record.status)} · ${record.eventSnapshot.sourceLabel}"
                        textSize = 12f; setTextColor(color(R.color.hub_text_muted)); setPadding(0, dp(4), 0, 0)
                    })
                    ReservationListPolicy.timestampLabel(record, section, reservationDateFormatter::format)?.let { label ->
                        addView(TextView(context).apply {
                            text = label
                            textSize = 12f
                            setTextColor(color(R.color.hub_text_muted))
                            setPadding(0, dp(4), 0, 0)
                        })
                    }
                    if (record.reservationDetailUrl != null) addView(TextView(context).apply { text = "${ReservationPresentationPolicy.detailLinkLabel(record.kind)} 있음"; textSize = 11f; setTextColor(color(R.color.hub_primary)); setPadding(0, dp(5), 0, 0) })
                })
            })
        }
    }

    private fun renderReservationDetail() {
        val record = reservationRecords.firstOrNull { it.id == selectedReservationId }
        startScreen(
            screenId = "reservation_detail",
            title = "내역 상세",
            role = "예약·예매·구매 정보와 링크는 이 기기에만 저장됩니다.",
            showExpandedBodyHeader = record == null,
        )
        if (record == null) {
            binding.contentList.addView(compactEventCard("내역을 찾을 수 없음", "목록에서 다시 선택해 주세요.", listOf("로컬 기록")))
            return
        }
        val latestEvent = record.eventId?.let { eventId -> goodsEvents.firstOrNull { it.id == eventId } }
        val presentation = ReservationDetailPresentationPolicy.presentation(
            record = record,
            formatDateTime = reservationDateFormatter::format,
            officialEventAvailable = latestEvent != null,
            latestOfficialTitle = latestEvent?.title,
            latestOfficialStartsAt = latestEvent?.startsAt,
            officialEventCancelled = latestEvent?.status == dev.minepacu.stelliveeventnotifier.core.model.HubEventStatus.CANCELLED,
        )

        binding.contentList.addView(reservationDetailSummaryCard(presentation))
        binding.contentList.addView(sectionLabel("빠른 동작"))
        binding.contentList.addView(reservationDetailActionRow(presentation.links.firstOrNull()?.url))

        if (presentation.informationRows.isNotEmpty()) {
            binding.contentList.addView(sectionLabel("내역 정보"))
            binding.contentList.addView(reservationDetailRowsCard(presentation.informationRows))
        }
        if (presentation.links.isNotEmpty()) {
            binding.contentList.addView(sectionLabel("관련 링크"))
            presentation.links.forEach { link ->
                binding.contentList.addView(reservationDetailLinkCard(link))
            }
        }
        presentation.note?.let { note ->
            binding.contentList.addView(sectionLabel("메모"))
            binding.contentList.addView(reservationDetailTextCard(note))
        }
        if (presentation.canOpenOfficialEvent && latestEvent != null) {
            binding.contentList.addView(sectionLabel("연결된 공식 행사"))
            binding.contentList.addView(hubEventCard(latestEvent).apply {
                setOnClickListener { openLinkedOfficialEvent(latestEvent.id) }
                contentDescription = "${latestEvent.title}, 연결된 공식 행사 열기"
            })
        }
        if (presentation.officialEventChanged) {
            binding.contentList.addView(compactEventCard(
                "공식 일정 변경됨",
                "저장 당시 정보와 현재 공식 행사 정보가 다릅니다. 사용자 수정값과 내역 상태는 자동으로 바꾸지 않습니다.",
                listOf("확인 필요"),
            ))
        }
        if (presentation.officialEventCancelled) {
            binding.contentList.addView(compactEventCard(
                "공식 행사 취소 안내",
                "공식 행사가 취소되었습니다. 사용자의 내역 상태는 자동으로 취소하지 않습니다.",
                listOf("공식 정보"),
            ))
        }
        binding.contentList.addView(sectionLabel("기록 정보"))
        binding.contentList.addView(reservationDetailRowsCard(presentation.recordRows))
        binding.contentList.addView(sectionLabel("위험 동작"))
        binding.contentList.addView(reservationDetailDeleteButton(record))
    }

    private fun renderReservationHelp(page: ReservationHelpPage) {
        val now = Instant.now()
        val presentation = ReservationHelpPolicy.presentation(
            page = page,
            context = ReservationHelpContextPolicy.context(
                drafts = reservationDrafts,
                records = reservationRecords,
                currentRecordId = selectedReservationId?.takeIf { id -> reservationRecords.any { it.id == id } },
                now = now,
            ),
            now = now,
        )
        val content = presentation.content
        val screenId = when (page) {
            ReservationHelpPage.LIST -> HubScreen.RESERVATIONS_HELP.id
            ReservationHelpPage.DETAIL -> HubScreen.RESERVATION_DETAIL_HELP.id
        }
        startScreen(
            screenId = screenId,
            title = getString(content.titleRes),
            role = getString(content.summaryRes),
            showExpandedBodyHeader = false,
        )
        presentation.status
            ?.takeUnless { it.kind == ReservationHelpStatusKind.GETTING_STARTED }
            ?.let { binding.contentList.addView(reservationHelpStatusCard(it)) }
        if (content.steps.isNotEmpty()) {
            binding.contentList.addView(sectionLabel(getString(R.string.reservation_help_steps_header)))
            binding.contentList.addView(reservationHelpStepsCard(content.steps))
        }
        content.sections.forEach { section ->
            binding.contentList.addView(reservationHelpSectionCard(section))
        }
        if (content.faqs.isNotEmpty()) {
            binding.contentList.addView(sectionLabel(getString(R.string.reservation_help_faq_header)))
            reservationHelpFaqUiStates.clear()
            content.faqs.forEach { faq ->
                binding.contentList.addView(reservationHelpFaqCard(faq))
            }
        }
    }

    private fun reservationHelpStepsCard(steps: List<ReservationHelpStep>): MaterialCardView =
        baseCard(HubCardStyle.STANDARD).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(10) }
            strokeWidth = dp(1)
            strokeColor = color(R.color.hub_primary)
            setCardBackgroundColor(color(R.color.hub_accent_soft))
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(14), dp(16), dp(14))
                steps.forEachIndexed { index, step ->
                    if (index > 0) {
                        addView(View(context).apply {
                            setBackgroundColor(color(R.color.hub_primary).withAlpha(45))
                        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)).apply {
                            marginStart = dp(42)
                            topMargin = dp(11)
                            bottomMargin = dp(11)
                        })
                    }
                    addView(reservationHelpStepRow(step))
                }
            })
        }

    private fun reservationHelpStepRow(step: ReservationHelpStep): LinearLayout =
        LinearLayout(this).apply {
            val title = getString(step.titleRes)
            val body = getString(step.bodyRes)
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.TOP
            contentDescription = getString(R.string.reservation_help_step_accessibility, step.number, title, body)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
            addView(TextView(context).apply {
                text = step.number.toString()
                gravity = Gravity.CENTER
                textSize = 14f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(color(R.color.hub_on_primary))
                background = rounded(color(R.color.hub_primary), dp(18))
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, LinearLayout.LayoutParams(dp(32), dp(32)).apply { marginEnd = dp(10) })
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(context).apply {
                    text = title
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(color(R.color.hub_text))
                })
                addView(TextView(context).apply {
                    text = body
                    textSize = 13f
                    setTextColor(color(R.color.hub_text_muted))
                    setLineSpacing(0f, 1.12f)
                    setPadding(0, dp(4), 0, 0)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }

    private fun reservationHelpSectionCard(section: ReservationHelpSection): MaterialCardView {
        val accent = when (section.tone) {
            ReservationHelpTone.NORMAL -> color(R.color.hub_text_muted)
            ReservationHelpTone.INFO,
            ReservationHelpTone.SECURITY -> color(R.color.hub_primary)
            ReservationHelpTone.WARNING -> color(R.color.hub_warning)
            ReservationHelpTone.DANGER -> color(R.color.hub_schedule_tag_cancelled)
        }
        val background = when (section.tone) {
            ReservationHelpTone.NORMAL -> color(R.color.hub_card_surface)
            ReservationHelpTone.INFO,
            ReservationHelpTone.SECURITY -> color(R.color.hub_accent_soft)
            ReservationHelpTone.WARNING -> color(R.color.hub_warning_soft)
            ReservationHelpTone.DANGER -> color(R.color.hub_schedule_tag_cancelled_soft)
        }
        val icon = when (section.tone) {
            ReservationHelpTone.NORMAL,
            ReservationHelpTone.INFO -> android.R.drawable.ic_dialog_info
            ReservationHelpTone.WARNING -> android.R.drawable.ic_dialog_alert
            ReservationHelpTone.SECURITY -> android.R.drawable.ic_lock_lock
            ReservationHelpTone.DANGER -> android.R.drawable.ic_menu_delete
        }
        val meaning = when (section.tone) {
            ReservationHelpTone.NORMAL -> getString(R.string.reservation_help_tone_normal)
            ReservationHelpTone.INFO -> getString(R.string.reservation_help_tone_info)
            ReservationHelpTone.WARNING -> getString(R.string.reservation_help_tone_warning)
            ReservationHelpTone.SECURITY -> getString(R.string.reservation_help_tone_security)
            ReservationHelpTone.DANGER -> getString(R.string.reservation_help_tone_danger)
        }
        val title = getString(section.titleRes)
        val body = getString(section.bodyRes)
        return baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(10) }
            strokeWidth = dp(1)
            strokeColor = accent
            setCardBackgroundColor(background)
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.TOP
                setPadding(dp(14), dp(14), dp(14), dp(14))
                addView(ImageView(context).apply {
                    setImageResource(icon)
                    imageTintList = ColorStateList.valueOf(accent)
                    contentDescription = meaning
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                }, LinearLayout.LayoutParams(dp(24), dp(24)).apply { marginEnd = dp(11) })
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(context).apply {
                        text = title
                        textSize = 15f
                        typeface = Typeface.DEFAULT_BOLD
                        setTextColor(accent)
                        contentDescription = getString(R.string.reservation_help_section_accessibility, meaning, title)
                        ViewCompat.setAccessibilityHeading(this, true)
                    })
                    addView(TextView(context).apply {
                        text = body
                        textSize = 13f
                        setTextColor(color(R.color.hub_text))
                        setLineSpacing(0f, 1.14f)
                        setPadding(0, dp(6), 0, 0)
                    })
                    section.pointResIds.forEach { pointRes ->
                        addView(TextView(context).apply {
                            val point = getString(pointRes)
                            text = "• $point"
                            textSize = 13f
                            setTextColor(color(R.color.hub_text))
                            setLineSpacing(0f, 1.14f)
                            setPadding(0, dp(8), 0, 0)
                            contentDescription = point
                        })
                    }
                    section.action?.let { action ->
                        addView(detailActionButton(reservationHelpActionLabel(action), false) {
                            performReservationHelpAction(action)
                        }, LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            dp(48),
                        ).apply { topMargin = dp(10) })
                    }
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            })
        }
    }

    private fun reservationHelpStatusCard(status: ReservationHelpStatusPresentation): MaterialCardView {
        val title = when (status.kind) {
            ReservationHelpStatusKind.PENDING -> getString(
                R.string.reservation_help_status_pending_title,
                status.activeDraftCount,
            )
            ReservationHelpStatusKind.MANAGE_RECORDS -> getString(R.string.reservation_help_status_manage_title)
            ReservationHelpStatusKind.GETTING_STARTED -> getString(R.string.reservation_help_steps_header)
        }
        val body = when (status.kind) {
            ReservationHelpStatusKind.PENDING -> buildString {
                append(getString(R.string.reservation_help_status_pending_body))
                status.expiry?.let {
                    append("\n")
                    append(getString(R.string.reservation_help_status_expiry, reservationDraftExpiryText(it)))
                }
            }
            ReservationHelpStatusKind.MANAGE_RECORDS -> getString(R.string.reservation_help_status_manage_body)
            ReservationHelpStatusKind.GETTING_STARTED -> getString(R.string.reservation_help_list_summary)
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
        val question = getString(faq.questionRes)
        val card = baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(8) }
            strokeWidth = dp(1)
            strokeColor = color(R.color.hub_line)
            setCardBackgroundColor(color(R.color.hub_card_surface))
        }
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = dp(56)
            setPadding(dp(14), dp(12), dp(10), dp(12))
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
        header.addView(ImageView(this).apply {
            setImageResource(reservationHelpFaqToneIcon(faq.tone))
            imageTintList = ColorStateList.valueOf(reservationHelpFaqToneColor(faq.tone))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(dp(22), dp(22)).apply { marginEnd = dp(12) })
        header.addView(TextView(this).apply {
            text = question
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(color(R.color.hub_text))
            setLineSpacing(0f, 1.12f)
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        val chevron = ImageView(this).apply {
            imageTintList = ColorStateList.valueOf(color(R.color.hub_text_muted))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        header.addView(chevron, LinearLayout.LayoutParams(dp(22), dp(22)).apply { marginStart = dp(10) })

        val answerContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            isVisible = false
            addView(divider())
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(reservationHelpFaqAnswerBackground(faq.tone))
                setPadding(dp(14), dp(12), dp(14), dp(14))
                addView(TextView(context).apply {
                    text = getString(faq.answerRes)
                    textSize = 13f
                    setTextColor(color(R.color.hub_text))
                    setLineSpacing(0f, 1.14f)
                })
                faq.action?.let { action ->
                    addView(detailActionButton(reservationHelpActionLabel(action), false) {
                        performReservationHelpAction(action)
                    }, LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        dp(48),
                    ).apply { topMargin = dp(12) })
                }
            })
        }
        content.addView(header)
        content.addView(answerContainer)
        card.addView(content)

        val state = ReservationHelpFaqUiState(
            card = card,
            header = header,
            answerContainer = answerContainer,
            chevron = chevron,
            question = question,
        )
        reservationHelpFaqUiStates[faq.id] = state
        header.setOnClickListener { toggleReservationHelpFaq(faq.id) }
        updateReservationHelpFaqCard(state, faq.id == expandedReservationHelpFaqId)
        return card
    }

    private fun toggleReservationHelpFaq(faqId: ReservationHelpFaqId) {
        val previousFaqId = expandedReservationHelpFaqId
        val nextFaqId = ReservationHelpFaqExpansionPolicy.toggled(previousFaqId, faqId)
        if (nextFaqId == previousFaqId) return
        TransitionManager.beginDelayedTransition(binding.contentList, AutoTransition().apply { duration = 160 })
        expandedReservationHelpFaqId = nextFaqId
        listOfNotNull(previousFaqId, nextFaqId).distinct().forEach { changedFaqId ->
            reservationHelpFaqUiStates[changedFaqId]?.let { state ->
                updateReservationHelpFaqCard(state, changedFaqId == nextFaqId)
            }
        }
    }

    private fun updateReservationHelpFaqCard(state: ReservationHelpFaqUiState, expanded: Boolean) {
        state.answerContainer.isVisible = expanded
        state.chevron.setImageResource(if (expanded) R.drawable.ic_expand_less else R.drawable.ic_expand_more)
        state.header.contentDescription = state.question
        ViewCompat.setStateDescription(
            state.header,
            getString(if (expanded) R.string.reservation_help_faq_state_expanded else R.string.reservation_help_faq_state_collapsed),
        )
        state.card.strokeColor = color(R.color.hub_line)
        state.card.setCardBackgroundColor(color(R.color.hub_card_surface))
    }

    private fun reservationHelpFaqToneIcon(tone: ReservationHelpTone): Int = when (tone) {
        ReservationHelpTone.NORMAL,
        ReservationHelpTone.INFO -> R.drawable.ic_help_outline
        ReservationHelpTone.WARNING -> R.drawable.ic_help_warning_outline
        ReservationHelpTone.SECURITY -> R.drawable.ic_help_lock_outline
        ReservationHelpTone.DANGER -> R.drawable.ic_help_warning_outline
    }

    private fun reservationHelpFaqToneColor(tone: ReservationHelpTone): Int = when (tone) {
        ReservationHelpTone.NORMAL -> color(R.color.hub_text_muted)
        ReservationHelpTone.INFO,
        ReservationHelpTone.SECURITY -> color(R.color.hub_primary)
        ReservationHelpTone.WARNING -> color(R.color.hub_warning)
        ReservationHelpTone.DANGER -> color(R.color.hub_schedule_tag_cancelled)
    }

    private fun reservationHelpFaqAnswerBackground(tone: ReservationHelpTone): Int = when (tone) {
        ReservationHelpTone.NORMAL,
        ReservationHelpTone.INFO,
        ReservationHelpTone.SECURITY -> color(R.color.hub_accent_soft)
        ReservationHelpTone.WARNING -> color(R.color.hub_warning_soft)
        ReservationHelpTone.DANGER -> color(R.color.hub_schedule_tag_cancelled_soft)
    }

    private fun reservationDraftExpiryText(expiry: ReservationDraftExpiryPresentation): String = when (expiry.kind) {
        ReservationDraftExpiryKind.HOURS -> getString(R.string.reservation_draft_expiry_hours, expiry.value)
        ReservationDraftExpiryKind.MINUTES -> getString(R.string.reservation_draft_expiry_minutes, expiry.value)
        ReservationDraftExpiryKind.SOON -> getString(R.string.reservation_draft_expiry_soon)
    }

    private fun reservationHelpActionLabel(action: ReservationHelpAction): String = getString(
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
                pendingReservationHelpScrollAction = action
                if (!popScreen()) {
                    navigationHistory.selectRoot(HubScreen.GOODS_EVENTS)
                    navigationHistory.select(HubScreen.RESERVATIONS)
                    renderScreen(HubScreen.RESERVATIONS)
                }
            }
            ReservationHelpAction.ADD_WITHOUT_LINK -> {
                val draft = ReservationDraftPolicy.active(reservationDrafts)
                    .minByOrNull(ReservationDraft::expiresAt) ?: return
                startActivity(Intent(this, ReservationQuickAddActivity::class.java).putExtra(
                    ReservationQuickAddActivity.EXTRA_SESSION_ID,
                    draft.sessionId.toString(),
                ))
            }
            ReservationHelpAction.EDIT_CURRENT_RECORD -> selectedReservationId?.let { id ->
                handleAppDeepLink(Intent().putExtra("appDeepLink", "stellivehub://reservations/$id/edit"))
            }
            ReservationHelpAction.VIEW_EXISTING_RECORD -> Unit
        }
    }

    private fun scrollReservationContentToTag(targetTag: String) {
        binding.contentList.post {
            val target = binding.contentList.findViewWithTag<View>(targetTag) ?: return@post
            binding.contentScroll.smoothScrollTo(0, target.top)
            target.sendAccessibilityEvent(android.view.accessibility.AccessibilityEvent.TYPE_VIEW_FOCUSED)
        }
    }

    private fun reservationDetailSummaryCard(presentation: ReservationDetailPresentation): MaterialCardView =
        baseCard(HubCardStyle.STANDARD).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(6) }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(15), dp(16), dp(16))
                presentation.imageUrl?.let { addView(hubEventThumbnail(it)) }
                addView(TextView(context).apply {
                    text = presentation.title
                    textSize = 20f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(color(R.color.hub_text))
                    setLineSpacing(0f, 1.08f)
                })
                addView(pillRow(listOf(presentation.statusLabel, presentation.kindLabel)))
                presentation.dateTimeLabel?.let { dateTime ->
                    addView(TextView(context).apply {
                        text = dateTime
                        textSize = 13f
                        typeface = Typeface.DEFAULT_BOLD
                        setTextColor(color(R.color.hub_text))
                        setPadding(0, dp(10), 0, 0)
                    })
                }
                addView(TextView(context).apply {
                    text = "출처 · ${presentation.sourceLabel}"
                    textSize = 12f
                    setTextColor(color(R.color.hub_text_muted))
                    setPadding(0, dp(5), 0, 0)
                })
            })
        }

    private fun reservationDetailActionRow(primaryUrl: String?): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(6) }
            if (primaryUrl != null) {
                addView(detailActionButton("상세 내역 열기", true) { openExternalUrl(primaryUrl) }, LinearLayout.LayoutParams(0, dp(50), 1f).apply {
                    marginEnd = dp(5)
                })
                addView(detailActionButton("내역 수정", false) { pushScreen(HubScreen.RESERVATION_EDIT) }, LinearLayout.LayoutParams(0, dp(50), 1f).apply {
                    marginStart = dp(5)
                })
            } else {
                addView(detailActionButton("내역 수정", true) { pushScreen(HubScreen.RESERVATION_EDIT) }, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(50),
                ))
            }
        }

    private fun reservationDetailRowsCard(rows: List<ReservationDetailRow>): MaterialCardView =
        baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(8) }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(15), dp(4), dp(15), dp(4))
                rows.forEachIndexed { index, row ->
                    if (index > 0) addView(divider())
                    addView(LinearLayout(context).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.TOP
                        setPadding(0, dp(11), 0, dp(11))
                        addView(TextView(context).apply {
                            text = row.label
                            textSize = 12f
                            typeface = Typeface.DEFAULT_BOLD
                            setTextColor(color(R.color.hub_text_muted))
                        }, LinearLayout.LayoutParams(dp(88), LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                            marginEnd = dp(10)
                        })
                        addView(TextView(context).apply {
                            text = row.value
                            textSize = 14f
                            setTextColor(color(R.color.hub_text))
                            setLineSpacing(0f, 1.1f)
                        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    })
                }
            })
        }

    private fun reservationDetailLinkCard(link: ReservationDetailLink): MaterialCardView =
        baseCard(HubCardStyle.INTERACTIVE).apply {
            isClickable = true
            isFocusable = true
            contentDescription = "${link.label}, ${link.host}, 외부 링크 열기"
            setOnClickListener { openExternalUrl(link.url) }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(8) }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(15), dp(12), dp(13), dp(12))
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(context).apply {
                        text = link.label
                        textSize = 14f
                        typeface = Typeface.DEFAULT_BOLD
                        setTextColor(color(R.color.hub_text))
                    })
                    addView(TextView(context).apply {
                        text = link.host
                        textSize = 12f
                        setTextColor(color(R.color.hub_text_muted))
                        setPadding(0, dp(3), 0, 0)
                    })
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                addView(TextView(context).apply {
                    text = "↗"
                    textSize = 18f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(color(R.color.hub_primary))
                    contentDescription = null
                })
            })
        }

    private fun reservationDetailTextCard(body: String): MaterialCardView =
        baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(8) }
            addView(TextView(context).apply {
                text = body
                textSize = 14f
                setTextColor(color(R.color.hub_text))
                setLineSpacing(0f, 1.15f)
                setPadding(dp(15), dp(13), dp(15), dp(13))
            })
        }

    private fun openLinkedOfficialEvent(eventId: String) {
        selectedHubEventId = eventId
        selectedHubEventScheduleItemId = null
        serverHubEventDetailLoadedId = null
        pushScreen(HubScreen.GOODS_EVENT_DETAIL)
    }

    private fun reservationDetailDeleteButton(record: ReservationRecord): TextView =
        detailActionButton("내역 삭제", false) {
            AlertDialog.Builder(this).setTitle("내역 삭제").setMessage("이 기기에서 이 내역을 삭제할까요?")
                .setNegativeButton("취소", null)
                .setPositiveButton("삭제") { _, _ ->
                    lifecycleScope.launch {
                        reservationRepository.delete(record)
                        popScreen()
                        Snackbar.make(binding.root, "내역을 삭제했습니다.", Snackbar.LENGTH_LONG)
                            .setAction("실행 취소") {
                                lifecycleScope.launch { reservationRepository.update(record) }
                            }
                            .show()
                    }
                }
                .show()
        }.apply {
            setTextColor(color(R.color.hub_schedule_tag_cancelled))
            background = rounded(
                fill = color(R.color.hub_schedule_tag_cancelled_soft),
                radius = dp(14),
                stroke = color(R.color.hub_schedule_tag_cancelled),
            )
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(50),
            ).apply { bottomMargin = dp(14) }
        }

    private fun renderReservationEdit() {
        val record = reservationRecords.firstOrNull { it.id == selectedReservationId }
        startScreen(
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
        reservationEditHasUnsavedChanges = {
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
        binding.contentList.addView(reservationEditPanel(
            title = "기본 정보",
            description = "화면에 표시할 이름과 현재 내역 상태를 정리합니다.",
            children = listOf(titleInput.view, statusInput.view, venueInput.view),
        ))
        binding.contentList.addView(reservationEditPanel(
            title = "일정",
            description = "직접 설정한 일정은 저장된 행사 정보보다 우선 표시됩니다.",
            children = listOf(startsAt.view, endsAt.view),
        ))
        binding.contentList.addView(reservationEditPanel(
            title = "추가 정보",
            description = "예매·주문·예약번호를 포함한 입력 내용은 이 기기에만 저장됩니다.",
            children = listOf(optionInput.view, quantityInput.view, referenceInput.view, noteInput.view),
        ))
        binding.contentList.addView(reservationEditPanel(
            title = "관련 링크",
            description = "호스트가 포함된 HTTPS 주소만 저장할 수 있습니다.",
            children = listOf(detailUrlInput.view, historyUrlInput.view),
        ))
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
                        val overrides = ReservationEditPresentationPolicy.overrides(
                            record = record,
                            title = title.text.toString(),
                            startsAt = startsAt.value,
                            endsAt = endsAt.value,
                            venue = venue.text.toString(),
                        )
                        reservationRepository.update(record.copy(
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
                        reservationEditHasUnsavedChanges = null
                        popScreen()
                    }.onFailure {
                        Toast.makeText(this@MainActivity, "내역 변경 내용을 저장하지 못했습니다.", Toast.LENGTH_SHORT).show()
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
                        .setMessage("같은 상세 링크가 다른 내역에 있습니다. 그래도 저장할까요?")
                        .setNegativeButton("취소", null)
                        .setPositiveButton("그래도 저장") { _, _ -> confirmSensitiveAndSave() }
                        .show()
                } else {
                    confirmSensitiveAndSave()
                }
            }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52)).apply {
            topMargin = dp(2)
            bottomMargin = dp(10)
        })
    }

    private fun reservationDateTimeInput(label: String, value: Instant?): ReservationDateTimeInput {
        val field = EditText(this).apply {
            hint = "선택하지 않음"
            isFocusable = false
            isClickable = true
            contentDescription = "$label 선택"
            setText(value?.let(reservationDateFormatter::format).orEmpty())
            textSize = 14f
            setTextColor(color(R.color.hub_text))
            setHintTextColor(color(R.color.hub_text_subtle))
            gravity = Gravity.CENTER_VERTICAL
            background = null
            setPadding(dp(14), 0, dp(8), 0)
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = rounded(color(R.color.hub_surface), dp(12), color(R.color.hub_line))
        }
        val container = labeledReservationEditInput(label, row)
        val input = ReservationDateTimeInput(field, value, container)
        field.setOnClickListener { showReservationDateTimePicker(input) }
        row.addView(field, LinearLayout.LayoutParams(0, dp(52), 1f))
        row.addView(TextView(this).apply {
            text = "지우기"
            contentDescription = "$label 지우기"
            gravity = Gravity.CENTER
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(color(R.color.hub_text_muted))
            background = rounded(color(R.color.hub_card), dp(10))
            setOnClickListener {
                input.value = null
                field.setText("")
            }
        }, LinearLayout.LayoutParams(dp(58), dp(40)).apply { marginEnd = dp(6) })
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

    private fun reservationEditField(
        label: String,
        value: String,
        multiline: Boolean = false,
        placeholder: String = "입력하지 않음",
    ): ReservationEditTextInput {
        val field = EditText(this).apply {
            hint = placeholder
            setText(value)
            textSize = 14f
            setTextColor(color(R.color.hub_text))
            setHintTextColor(color(R.color.hub_text_subtle))
            background = rounded(color(R.color.hub_surface), dp(12), color(R.color.hub_line))
            setPadding(dp(14), dp(12), dp(14), dp(12))
            minHeight = dp(if (multiline) 96 else 52)
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
        val value = TextView(this).apply {
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            includeFontPadding = false
            maxLines = 2
            setLineSpacing(0f, 1.08f)
        }
        val description = TextView(this).apply {
            textSize = 12f
            includeFontPadding = false
            setTextColor(color(R.color.hub_text_muted))
            setLineSpacing(0f, 1.12f)
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = dp(56)
            isClickable = true
            isFocusable = true
            background = RippleDrawable(
                ColorStateList.valueOf(color(R.color.hub_line)),
                rounded(color(R.color.hub_surface), dp(12), color(R.color.hub_line)),
                null,
            )
            setPadding(dp(14), dp(12), dp(12), dp(12))
            addView(value, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(ImageView(context).apply {
                setImageResource(R.drawable.ic_expand_more)
                imageTintList = ColorStateList.valueOf(color(R.color.hub_text_subtle))
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, LinearLayout.LayoutParams(dp(24), dp(24)).apply { marginStart = dp(8) })
        }
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(context).apply {
                setText(R.string.reservation_edit_status_label)
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(color(R.color.hub_text_muted))
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(6) })
            addView(row, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ))
            addView(description, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = dp(6) })
        }
        fun update(selected: ReservationStatus) {
            displayedStatus = selected
            val label = ReservationPresentationPolicy.statusLabel(kind, selected)
            value.text = label
            value.setTextColor(color(reservationEditStatusColor(selected)))
            description.setText(reservationEditStatusDescriptionRes(kind, selected))
            row.contentDescription = getString(
                R.string.reservation_edit_status_accessibility,
                getString(R.string.reservation_edit_status_label),
                label,
            )
            ViewCompat.setStateDescription(row, label)
        }
        row.setOnClickListener {
            HubSingleChoiceBottomSheet(
                context = this,
                title = getString(R.string.reservation_edit_status_selection_title),
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
                    getString(R.string.reservation_edit_status_accessibility, getString(R.string.reservation_edit_status_label), ReservationPresentationPolicy.statusLabel(kind, selected)),
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
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(context).apply {
                text = label
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(color(R.color.hub_text_muted))
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = dp(6) })
            addView(input, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ))
        }

    private fun reservationEditPanel(
        title: String,
        description: String,
        children: List<View>,
    ): MaterialCardView = baseCard(HubCardStyle.STANDARD).apply {
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { bottomMargin = dp(12) }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(15), dp(14), dp(15), dp(15))
            addView(TextView(context).apply {
                text = title
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(color(R.color.hub_text))
            })
            addView(TextView(context).apply {
                text = description
                textSize = 12f
                setTextColor(color(R.color.hub_text_muted))
                setLineSpacing(0f, 1.12f)
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = dp(4) })
            children.forEach { child ->
                addView(child, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply { topMargin = dp(12) })
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

    private fun pillRow(labels: List<String>): ChipGroup = ChipGroup(this).apply {
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


private data class HistoryFilterSelectorRow(
    val title: String,
    val selectedValue: String,
    val onClick: () -> Unit
)

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
