package dev.minepacu.stelliveeventnotifier.feature.songs

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.BitmapFactory
import android.graphics.Color
import android.text.Editable
import android.text.TextUtils
import android.text.TextWatcher
import android.view.ContextThemeWrapper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.widget.PopupMenu
import androidx.core.view.isVisible
import androidx.core.widget.NestedScrollView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.card.MaterialCardView
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.MainActivity.ScrollablePane
import dev.minepacu.stelliveeventnotifier.MainActivity.SongPanes
import dev.minepacu.stelliveeventnotifier.MainActivity.SongRenderState
import dev.minepacu.stelliveeventnotifier.MainActivity.SongResultsAdapter
import dev.minepacu.stelliveeventnotifier.MainActivity.SongScrollSlot
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.HubMember
import dev.minepacu.stelliveeventnotifier.core.model.SongCatalogItem
import dev.minepacu.stelliveeventnotifier.feature.home.HubScreen
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import dev.minepacu.stelliveeventnotifier.feature.home.SongFilterOption
import dev.minepacu.stelliveeventnotifier.feature.home.SongListQueryKey
import dev.minepacu.stelliveeventnotifier.feature.home.SongMemberFilterPolicy
import dev.minepacu.stelliveeventnotifier.feature.home.SongMemberFilterState
import dev.minepacu.stelliveeventnotifier.feature.home.SongMemberMatchMode
import dev.minepacu.stelliveeventnotifier.feature.home.SongParticipation
import dev.minepacu.stelliveeventnotifier.feature.home.SongScrollPosition
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardStyle
import dev.minepacu.stelliveeventnotifier.ui.components.HubSingleChoiceBottomSheet
import dev.minepacu.stelliveeventnotifier.ui.components.HubSingleChoiceOption
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.net.URL
import kotlin.concurrent.thread

/**
 * Owns all Songs-screen (catalog browse, search, member filter) VIEW-BUILDING and
 * scroll-session logic that previously lived directly on [MainActivity], following the
 * same extraction shape as [dev.minepacu.stelliveeventnotifier.feature.settings.SettingsScreenController].
 *
 * Dependency-injection choice: like the Settings controller, this one takes the concrete
 * [MainActivity] rather than a narrow interface, for the same reason - Songs view-building
 * is entangled with generic Activity-wide UI-atom helpers (color/dp/rounded/baseCard/...),
 * the screen-navigation stack, and top-bar scroll-source bookkeeping that isn't Songs-specific.
 *
 * State ownership: all Songs session/UI state (selected filters, cached catalog, scroll
 * positions, the search RecyclerView adapter, the "scroll to top" button, etc.) stays on
 * [MainActivity] as `internal` fields, exactly like Settings kept its shared state behind.
 * This also covers the small set of nested types that state field types require
 * (`SongRenderState`, `SongPanes`, `SongScrollSlot`, `SongResultsAdapter`) - those remain
 * declared on MainActivity too so the state fields that use them don't need to move.
 *
 * Shared-helper decisions:
 * - `songCard()` is still used directly by Home's recent-songs preview (`renderHome`,
 *   which has not been extracted yet). Rather than duplicating it there, `songCard()` now
 *   lives here and MainActivity calls back into it via `songsScreenController.songCard(...)`
 *   - the same cross-controller call shape `renderScreen()` already uses for Settings.
 * - Small trivial UI atoms that are also used by not-yet-extracted screens
 *   (`filterSegmentView` for GoodsEvents/Live's `segmentedFilterRow`, `avatarText`/
 *   `channelImageAvatar` for Live/History's `memberAvatar`, `rowChip`, `centerChipText`,
 *   `loadingCard`, `serverStatusStrip`, `clearTopFilters`, `resetTopBarScrollSources`,
 *   `popScreen`, `updateTopBarScrolledFromSources`, `currentBottomObstructionHeight`,
 *   `scheduleReservationReturnPromptPositionUpdate`, `topBarScrollSourceOffsets`,
 *   `serverMembers`) stay on MainActivity (visibility bumped to `internal`) and are called
 *   back into, instead of being duplicated - they are generic/stateful enough that a copy
 *   would risk drifting from the original.
 */
internal class SongsScreenController(private val activity: MainActivity) {

    // region Screen entry points (called from MainActivity.renderScreen / generic Activity infra)

    internal fun setupSongScrollToTopButton() {
        activity.songScrollToTopButton = ImageButton(activity).apply {
            setImageResource(android.R.drawable.arrow_up_float)
            background = activity.rounded(fill = activity.color(R.color.hub_card), radius = activity.dp(24))
            contentDescription = "맨 위로 이동"
            elevation = activity.dp(8).toFloat()
            isVisible = false
            setOnClickListener {
                val source = activity.activeSongScrollView ?: return@setOnClickListener
                smoothScrollSongViewTo(source, 0)
                activity.activeSongScrollSlot?.let { slot ->
                    activity.songBrowseSession.positions[slot.name] = SongScrollPosition(
                        anchorSongId = null,
                        anchorOffset = 0,
                        fallbackAbsoluteOffset = 0,
                        visibleLimitAtCapture = activity.visibleSongLimit,
                        queryKey = currentSongQueryKey(),
                    )
                }
                isVisible = false
            }
        }
        activity.binding.root.addView(
            activity.songScrollToTopButton,
            FrameLayout.LayoutParams(activity.dp(48), activity.dp(48), Gravity.END or Gravity.BOTTOM).apply {
                marginEnd = activity.dp(18)
                bottomMargin = activity.dp(80)
            },
        )
        scheduleSongScrollToTopButtonPositionUpdate()
    }

    internal fun scheduleSongScrollToTopButtonPositionUpdate() {
        if (!activity.isSongScrollToTopButtonInitialized() || !activity.isBindingInitialized()) return
        activity.binding.root.post {
            val occupiedBottomHeight = activity.currentBottomObstructionHeight()
            val params = activity.songScrollToTopButton.layoutParams as? FrameLayout.LayoutParams ?: return@post
            val nextBottomMargin = occupiedBottomHeight + activity.dp(16)
            if (params.bottomMargin != nextBottomMargin) {
                params.bottomMargin = nextBottomMargin
                activity.songScrollToTopButton.layoutParams = params
            }
            activity.scheduleReservationReturnPromptPositionUpdate()
        }
    }

    internal fun captureActiveSongScrollPosition() {
        if (activity.isRestoringSongScrollPosition) return
        val source = activity.activeSongScrollView ?: return
        val container = activity.activeSongListContainer ?: return
        val slot = activity.activeSongScrollSlot ?: return
        val scrollY = songScrollY(source)
        val anchor = container.songCandidateViews()
            .filter { it.tag is String }
            .firstOrNull { viewTopInSongScroll(it, source) + it.height > scrollY }
        activity.songBrowseSession.visibleLimit = activity.visibleSongLimit
        activity.songBrowseSession.positions[slot.name] = SongScrollPosition(
            anchorSongId = anchor?.tag as? String,
            anchorOffset = anchor?.let { viewTopInSongScroll(it, source) - scrollY } ?: 0,
            fallbackAbsoluteOffset = scrollY,
            visibleLimitAtCapture = activity.visibleSongLimit,
            queryKey = currentSongQueryKey(),
        )
    }

    internal fun forceRefreshSongs() {
        if (activity.songRefreshJob?.isActive == true) return
        activity.songRefreshJob = activity.lifecycleScope.launch {
            try {
                val result = activity.serverRepository.songs(
                    generationId = "all",
                    type = "all",
                    forceRefresh = true,
                )
                activity.songDiscoveryRepository.initialize(result.serverTime, result.items, result.isAuthoritative)
                activity.cachedSongItems = result.items
                activity.cachedSongType = "all"
                activity.cachedSongCatalogAuthoritative = result.isAuthoritative
                if (activity.navigationHistory.currentScreen == HubScreen.SONGS) {
                    activity.refreshScreenWhenIdle(HubScreen.SONGS, ::renderSongsFromCache)
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                activity.recordServerConnectionLog("songs refresh: ${error.javaClass.simpleName}")
                Toast.makeText(
                    activity,
                    "노래 목록을 새로고침하지 못했습니다. 기존 목록을 유지합니다.",
                    Toast.LENGTH_SHORT,
                ).show()
            } finally {
                activity.binding.contentRefresh.isRefreshing = false
                activity.songRefreshJob = null
            }
        }
    }

    internal fun shouldUseSongsTwoPane(): Boolean =
        SongsPanePolicy.shouldUseTwoPane(activity.currentAdaptiveSpec)

    internal fun renderSongs() {
        activity.pendingSongSearchRender?.let(activity.songSearchHandler::removeCallbacks)
        activity.pendingSongSearchRender = null
        activity.startScreen(
            screenId = "songs",
            title = activity.getString(R.string.songs_title),
            role = "멤버별 오리지널곡과 커버곡을 서버 캐시에서 탐색합니다."
        )
        activity.clearTopFilters()
        if (shouldUseSongsTwoPane()) {
            renderSongsTwoPaneLoading()
        } else {
            activity.binding.contentList.addView(songFilterPanel())
            activity.binding.contentList.addView(activity.serverStatusStrip())
            activity.binding.contentList.addView(activity.loadingCard(MainUiPolicy.songsLoadingPresentation()))
        }

        activity.lifecycleScope.launch {
            val state = songRenderState(loadSongItemsForCurrentType())
            if (activity.navigationHistory.currentScreen != HubScreen.SONGS) return@launch
            activity.refreshScreenWhenIdle(HubScreen.SONGS) {
                activity.startScreen(
                    screenId = "songs",
                    title = activity.getString(R.string.songs_title),
                    role = "멤버별 오리지널곡과 커버곡을 서버 캐시에서 탐색합니다."
                )
                activity.clearTopFilters()
                if (shouldUseSongsTwoPane()) {
                    renderSongsTwoPane(state)
                } else {
                    activity.binding.contentList.addView(songFilterPanel())
                    renderSongListInto(activity.binding.contentList, state, includeServerStatus = true)
                    registerSongScrollSession(activity.binding.contentScroll, activity.binding.contentList, state, SongScrollSlot.SONGS_SINGLE)
                }
            }
        }
    }

    internal fun renderSongsFromCache() {
        captureActiveSongScrollPosition()
        val state = songRenderState(activity.cachedSongItems)
        activity.startScreen("songs", activity.getString(R.string.songs_title), "멤버별 오리지널곡과 커버곡을 서버 캐시에서 탐색합니다.")
        activity.clearTopFilters()
        if (shouldUseSongsTwoPane()) renderSongsTwoPane(state) else {
            activity.binding.contentList.addView(songFilterPanel())
            renderSongListInto(activity.binding.contentList, state, includeServerStatus = true)
            registerSongScrollSession(activity.binding.contentScroll, activity.binding.contentList, state, SongScrollSlot.SONGS_SINGLE)
        }
    }

    internal fun renderSongSearch() {
        activity.binding.topBarSongSearch.isEnabled = true
        activity.startScreen(
            screenId = "song_search",
            title = "노래 검색",
            role = "제목 또는 멤버 이름으로 검색합니다.",
        )
        activity.binding.collapsedTitle.text = "노래 검색"
        activity.binding.collapsedRole.text = "제목 또는 멤버"
        activity.binding.contentList.addView(songSearchCard())
        val songAdapter = activity.SongResultsAdapter()
        activity.songSearchResultsAdapter = songAdapter
        val resultsList = RecyclerView(activity).apply {
            layoutManager = LinearLayoutManager(activity)
            isNestedScrollingEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            adapter = songAdapter
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        activity.songSearchResultsContainer = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            addView(resultsList)
        }.also(activity.binding.contentList::addView)
        refreshSongSearchResults()
    }

    internal fun renderSongMemberFilter(restoreScrollY: Int? = null) {
        val members = activity.serverMembers ?: activity.repository.members
        val selectable = SongMemberFilterPolicy.selectableMembers(members)
        val draft = activity.selectedSongMemberFilterDraft ?: activity.selectedSongMemberFilter.also { activity.selectedSongMemberFilterDraft = it }
        activity.startScreen(
            screenId = "song_member_filter",
            title = "노래 멤버 선택",
            role = "노래 목록을 멤버별로 좁혀 봅니다"
        )
        fun updateDraft(next: SongMemberFilterState) {
            val currentScrollY = activity.binding.contentScroll.scrollY
            activity.selectedSongMemberFilterDraft = next.normalized(selectable.map { it.id }.toSet())
            renderSongMemberFilter(restoreScrollY = currentScrollY)
        }

        activity.binding.contentList.addView(activity.baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = activity.dp(16)
            }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(activity.dp(14), activity.dp(14), activity.dp(14), activity.dp(14))
                addView(TextView(context).apply {
                    text = "현재 조건"
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                })
                addView(TextView(context).apply {
                    text = SongMemberFilterPolicy.summary(members, draft)
                    setTextColor(activity.color(R.color.hub_text))
                    textSize = 16f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    setPadding(0, activity.dp(4), 0, activity.dp(14))
                    contentDescription = "현재 조건, $text"
                })
                addView(TextView(context).apply {
                    text = "선택 멤버"
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    setPadding(0, 0, 0, activity.dp(7))
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
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    setPadding(0, activity.dp(14), 0, activity.dp(7))
                })
                addView(songSegmentedRow(listOf(SongFilterOption("ANY", "전체"), SongFilterOption("SOLO", "솔로"), SongFilterOption("COLLABORATION", "함께")), draft.participation.name) {
                    updateDraft(draft.copy(participation = SongParticipation.valueOf(it)))
                })
                addView(TextView(context).apply {
                    text = "솔로는 1명, 함께 부른 곡은 연결된 스텔라이브 멤버 2명 이상을 기준으로 하며 외부 가수는 계산에 포함되지 않습니다."
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, activity.dp(12), 0, 0)
                    contentDescription = text
                })
            })
        })

        activity.binding.contentList.addView(activity.sectionLabel("빠른 선택"))
        activity.binding.contentList.addView(HorizontalScrollView(activity).apply {
            isHorizontalScrollBarEnabled = false
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = activity.dp(14)
            }
            addView(ChipGroup(context).apply {
                isSingleLine = true
                chipSpacingHorizontal = activity.dp(8)
                listOf("gen1" to "1기생 전원", "gen2" to "2기생 전원", "gen3" to "3기생 전원").forEach { (id, label) ->
                    val preset = SongMemberFilterPolicy.generationPreset(members, id)
                    addView(activity.centerChipText(Chip(context).apply {
                        val selected = draft == preset
                        text = label
                        isCheckable = false
                        isClickable = true
                        setEnsureMinTouchTargetSize(true)
                        chipMinHeight = activity.dp(40).toFloat()
                        shapeAppearanceModel = shapeAppearanceModel.toBuilder()
                            .setAllCornerSizes(activity.dp(20).toFloat())
                            .build()
                        chipStrokeWidth = activity.dp(1).toFloat()
                        chipStrokeColor = android.content.res.ColorStateList.valueOf(activity.color(if (selected) R.color.hub_primary else R.color.hub_line))
                        chipBackgroundColor = android.content.res.ColorStateList.valueOf(activity.color(if (selected) R.color.hub_accent_soft else R.color.hub_card))
                        setTextColor(activity.color(if (selected) R.color.hub_primary else R.color.hub_text_muted))
                        textSize = 13f
                        typeface = android.graphics.Typeface.DEFAULT_BOLD
                        textStartPadding = activity.dp(12).toFloat()
                        textEndPadding = activity.dp(12).toFloat()
                        contentDescription = "$label 빠른 선택${if (selected) ", 선택됨" else ""}"
                        setOnClickListener { updateDraft(preset) }
                    }))
                }
            })
        })

        selectable.groupBy { it.generationId }.forEach { (generationId, generationMembers) ->
            activity.binding.contentList.addView(activity.sectionLabel(when (generationId) { "gen1" -> "1기생"; "gen2" -> "2기생"; else -> "3기생" }))
            generationMembers.forEach { member ->
                val checked = member.id in draft.selectedMemberIds
                val option = SongFilterOption(member.id, member.koreanName.ifBlank { member.englishName })
                activity.binding.contentList.addView(songMemberFilterOptionCard(option, member, checked).apply {
                    setOnClickListener {
                    val ids = draft.selectedMemberIds.toMutableSet().apply { if (!add(member.id)) remove(member.id) }
                        updateDraft(draft.copy(selectedMemberIds = ids))
                    }
                })
            }
        }

        val normalizedDraft = draft.normalized(selectable.map { it.id }.toSet())
        val canReset = normalizedDraft != SongMemberFilterState()
        val canApply = normalizedDraft != activity.selectedSongMemberFilter.normalized(selectable.map { it.id }.toSet())
        activity.binding.screenActionContainer.isVisible = true
        activity.binding.contentList.let { list ->
            val baseBottomPadding = list.paddingBottom
            activity.binding.root.post {
                val obstruction = activity.currentBottomObstructionHeight()
                list.setPadding(list.paddingLeft, list.paddingTop, list.paddingRight, baseBottomPadding + obstruction)
            }
        }
        activity.binding.screenActionReset.apply {
            background = activity.rounded(fill = activity.color(R.color.hub_surface), radius = activity.dp(14), stroke = activity.color(R.color.hub_line))
            alpha = if (canReset) 1f else 0.45f
            isEnabled = canReset
            contentDescription = if (canReset) "멤버 조건 초기화" else "멤버 조건 초기화, 이미 초기 상태"
            setOnClickListener { updateDraft(SongMemberFilterState()) }
        }
        activity.binding.screenActionApply.apply {
            background = activity.rounded(fill = activity.color(R.color.hub_primary), radius = activity.dp(14))
            alpha = if (canApply) 1f else 0.45f
            isEnabled = canApply
            contentDescription = if (canApply) "멤버 조건 적용" else "멤버 조건 적용, 변경 사항 없음"
            setOnClickListener {
                applySongMemberFilter(normalizedDraft)
                activity.selectedSongMemberFilterDraft = null
                activity.popScreen()
            }
        }
        registerSongMemberFilterScrollToTop()
        scheduleSongScrollToTopButtonPositionUpdate()
        restoreScrollY?.let { scrollY ->
            activity.binding.contentScroll.post { activity.binding.contentScroll.scrollTo(0, scrollY) }
        }
    }

    internal fun songCard(song: SongCatalogItem, catalogMembers: List<HubMember> = activity.serverMembers ?: activity.repository.members): MaterialCardView =
        activity.baseCard(HubCardStyle.INTERACTIVE).apply {
            tag = SongIdentity.identifier(song)
            val displayText = MainUiPolicy.songDisplayText(song, catalogMembers)
            val isNew = SongDiscoveryPolicy.isNew(song, activity.songDiscoveryState)
            isClickable = true
            isFocusable = true
            contentDescription = "${displayText.title}, 곡 상세 보기"
            setOnClickListener { showSongDetail(song) }
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = activity.dp(10)
            }
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(activity.dp(15), activity.dp(14), activity.dp(15), activity.dp(14))
            }
            row.addView(songThumbnail(song, isNew))
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                // Reserve the overlay's real footprint: two 48dp touch targets (★/⋮) side by
                // side + 4dp gap between them + overlay rightMargin (6dp) + a small buffer
                // (6dp) = 112dp. Two 48dp-minHeight views can't be stacked vertically instead
                // (48+48=96dp already blows the card's ~82-91dp target height), so the
                // accessibility-minimum touch targets force horizontal icons, and horizontal
                // icons force this wider reserved padding back close to its pre-trim value —
                // the title-width gain from the vertical-stack attempt had to be traded back
                // for the row-height fix.
                setPadding(0, 0, activity.dp(48 + 48 + 4 + 6 + 6), 0)
            }
            content.addView(TextView(context).apply {
                text = displayText.title
                setTextColor(activity.color(R.color.hub_text))
                textSize = 15f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                maxLines = MainUiPolicy.SONG_TITLE_MAX_LINES
                ellipsize = TextUtils.TruncateAt.END
                includeFontPadding = false
            })
            content.addView(TextView(context).apply {
                text = "${song.type.displayName} · ${displayText.subtitle}"
                setTextColor(activity.color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(0, activity.dp(5), 0, 0)
                maxLines = MainUiPolicy.SONG_SUBTITLE_MAX_LINES
                ellipsize = TextUtils.TruncateAt.END
                includeFontPadding = false
            })
            MainUiPolicy.songPremiereStatusLabel(song)?.let { label ->
                content.addView(ChipGroup(context).apply {
                    isSingleLine = false
                    isSelectionRequired = false
                    chipSpacingHorizontal = activity.dp(6)
                    chipSpacingVertical = activity.dp(4)
                    addView(activity.rowChip(label))
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    ).apply {
                        topMargin = activity.dp(7)
                    }
                })
            }
            MainUiPolicy.songPremiereScheduledDateText(song)?.let { dateText ->
                content.addView(TextView(context).apply {
                    text = dateText
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, activity.dp(4), 0, 0)
                    includeFontPadding = false
                })
            }
            row.addView(content)
            addView(row)
            val overlayRow = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                MainUiPolicy.songFavoriteIdentifier(song)?.let { identifier ->
                    addView(TextView(context).apply {
                        text = if (identifier in activity.songFavoriteIds) "★" else "☆"
                        textSize = 24f
                        gravity = Gravity.CENTER
                        setTextColor(activity.color(R.color.hub_text))
                        contentDescription = if (identifier in activity.songFavoriteIds) "즐겨찾기 해제" else "즐겨찾기 추가"
                        isClickable = true
                        isFocusable = true
                        minWidth = activity.dp(48)
                        minHeight = activity.dp(48)
                        layoutParams = LinearLayout.LayoutParams(activity.dp(48), activity.dp(48)).apply {
                            marginEnd = activity.dp(4)
                        }
                        setOnClickListener {
                            activity.lifecycleScope.launch { activity.songFavoritesRepository.toggle(identifier) }
                        }
                    })
                }
                addView(TextView(context).apply {
                    text = "⋮"
                    textSize = 24f
                    gravity = Gravity.CENTER
                    minWidth = activity.dp(48)
                    minHeight = activity.dp(48)
                    isClickable = true
                    isFocusable = true
                    contentDescription = "${displayText.title} 빠른 동작" +
                        if (SongLinkPolicy.videoUrl(song) == null) ", ${SongLinkPolicy.unavailableReason}" else ""
                    setOnClickListener { anchor -> showSongQuickMenu(anchor, song) }
                })
            }
            addView(overlayRow, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.TOP or Gravity.END
                topMargin = activity.dp(6)
                rightMargin = activity.dp(6)
            })
        }

    // endregion

    // region Scroll-session helpers

    private fun ViewGroup.childrenSequence(): Sequence<View> = sequence {
        for (index in 0 until childCount) yield(getChildAt(index))
    }

    // Song search rows live inside a RecyclerView nested in the (still LinearLayout) scroll
    // container; unwrap it one level so scroll-anchor lookups keep finding tagged song views.
    private fun ViewGroup.songCandidateViews(): Sequence<View> =
        childrenSequence().flatMap { child -> if (child is RecyclerView) child.childrenSequence() else sequenceOf(child) }

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

    internal fun registerSongMemberFilterScrollToTop() {
        val source = activity.binding.contentScroll
        activity.activeSongScrollView = source
        activity.activeSongRefreshScrollSources = listOf(source)
        activity.activeSongListContainer = null
        activity.activeSongScrollSlot = null
        source.setOnScrollChangeListener { view, _, scrollY, _, _ ->
            activity.topBarScrollSourceOffsets[view] = scrollY
            activity.updateTopBarScrolledFromSources()
            activity.songScrollToTopButton.isVisible = MainUiPolicy.shouldShowSongScrollToTop(
                absoluteOffset = scrollY,
                isLoading = false,
                isEmpty = false,
                isRestoring = false,
                threshold = activity.dp(240),
            )
        }
    }

    private fun currentSongQueryKey(): SongListQueryKey = SongListQueryKey(
        generationId = "all",
        type = activity.selectedSongType,
        selectedMemberIds = activity.selectedSongMemberFilter.selectedMemberIds.sorted(),
        memberMatchMode = activity.selectedSongMemberFilter.matchMode,
        participation = activity.selectedSongMemberFilter.participation,
        libraryId = activity.selectedSongLibraryId,
        sortId = activity.selectedSongSortId,
        query = activity.selectedSongQuery,
    )

    private fun registerSongScrollSession(
        source: View,
        container: LinearLayout,
        state: SongRenderState,
        slot: SongScrollSlot,
    ) {
        activity.activeSongScrollView = source
        activity.activeSongRefreshScrollSources = listOf(source)
        activity.activeSongListContainer = container
        activity.activeSongScrollSlot = slot
        source.setOnScrollChangeListener { view, _, scrollY, _, _ ->
            activity.topBarScrollSourceOffsets[view] = scrollY
            activity.updateTopBarScrolledFromSources()
            captureActiveSongScrollPosition()
            activity.songScrollToTopButton.isVisible = MainUiPolicy.shouldShowSongScrollToTop(
                absoluteOffset = scrollY,
                isLoading = false,
                isEmpty = state.displayedSongs.isEmpty(),
                isRestoring = activity.isRestoringSongScrollPosition,
                threshold = activity.dp(240),
            )
        }
        restoreSongScrollPosition(source, container, slot)
    }

    private fun restoreSongScrollPosition(source: View, container: LinearLayout, slot: SongScrollSlot) {
        val position = activity.songBrowseSession.positions[slot.name] ?: when (slot) {
            SongScrollSlot.SONGS_SINGLE -> activity.songBrowseSession.positions[SongScrollSlot.SONGS_TWO_PANE.name]
            SongScrollSlot.SONGS_TWO_PANE -> activity.songBrowseSession.positions[SongScrollSlot.SONGS_SINGLE.name]
            SongScrollSlot.SONG_SEARCH -> null
        }
        if (!MainUiPolicy.canRestoreSongScroll(position, currentSongQueryKey())) {
            scrollSongViewTo(source, 0)
            return
        }
        activity.visibleSongLimit = maxOf(activity.visibleSongLimit, position?.visibleLimitAtCapture ?: MainUiPolicy.SONG_PAGE_SIZE)
        activity.isRestoringSongScrollPosition = true
        source.post {
            val anchor = position?.anchorSongId?.let { id ->
                container.songCandidateViews().firstOrNull { it.tag == id }
            }
            val target = anchor?.let { viewTopInSongScroll(it, source) - (position?.anchorOffset ?: 0) }
                ?: position?.fallbackAbsoluteOffset
                ?: 0
            scrollSongViewTo(source, target.coerceAtLeast(0))
            source.post {
                activity.isRestoringSongScrollPosition = false
                captureActiveSongScrollPosition()
            }
        }
    }

    // endregion

    // region Catalog list rendering

    private suspend fun loadSongItemsForCurrentType(): List<SongCatalogItem> =
        if (activity.cachedSongType == "all" && activity.cachedSongItems.isNotEmpty()) {
            activity.cachedSongItems
        } else {
            activity.serverRepository.songs(generationId = "all", type = "all").let { result ->
                activity.songDiscoveryRepository.initialize(result.serverTime, result.items, result.isAuthoritative)
                activity.cachedSongCatalogAuthoritative = result.isAuthoritative
                result.items.also {
                activity.cachedSongItems = it
                activity.cachedSongType = "all"
                }
            }
        }

    private fun songRenderState(songItems: List<SongCatalogItem>): SongRenderState {
        val songCatalogMembers = activity.serverMembers ?: activity.repository.members
        val visibleSongs = MainUiPolicy.sortSongs(
            songItems.filter { song ->
                (activity.selectedSongType == "all" || song.type.apiValue == activity.selectedSongType) &&
                    MainUiPolicy.songMatchesMember(song, activity.selectedSongMemberFilter) &&
                    MainUiPolicy.songMatchesQuery(song, activity.selectedSongQuery, songCatalogMembers) &&
                    MainUiPolicy.songMatchesLibrary(song, activity.selectedSongLibraryId, activity.songFavoriteIds)
            },
            activity.selectedSongSortId,
        )
        activity.visibleSongLimit = MainUiPolicy.coerceSongVisibleLimit(activity.visibleSongLimit, visibleSongs.size)
        return SongRenderState(
            catalogMembers = songCatalogMembers,
            visibleSongs = visibleSongs,
            displayedSongs = MainUiPolicy.displayedSongItems(visibleSongs, activity.visibleSongLimit),
            displayedCount = MainUiPolicy.displayedSongCount(activity.visibleSongLimit, visibleSongs.size),
            totalFilteredCount = visibleSongs.size,
            remainingCount = MainUiPolicy.remainingSongCount(activity.visibleSongLimit, visibleSongs.size),
        )
    }

    private fun renderSongsSelectionChange(render: () -> Unit = ::renderSongsFromCache) {
        if (shouldUseSongsTwoPane() && activity.activeTwoPaneDetailPane != null) {
            val key = listOf(
                activity.selectedSongType,
                activity.selectedSongLibraryId,
                activity.selectedSongSortId,
                activity.selectedSongQuery,
            ).joinToString(":")
            activity.crossFadeTwoPaneSelection("songs:$key", render)
        } else {
            render()
        }
    }

    private fun renderSongsTwoPaneLoading() {
        val panes = songsTwoPaneContainer()
        renderSongFilterPaneInto(panes.filter.content)
        panes.list.content.addView(activity.loadingCard(MainUiPolicy.songsLoadingPresentation()))
    }

    private fun renderSongsTwoPane(state: SongRenderState) {
        val panes = songsTwoPaneContainer()
        renderSongFilterPaneInto(panes.filter.content, state.visibleSongs.size)
        renderSongListInto(panes.list.content, state, includeServerStatus = true)
        registerSongScrollSession(panes.list.scrollView, panes.list.content, state, SongScrollSlot.SONGS_TWO_PANE)
    }

    private fun songsTwoPaneContainer(): SongPanes {
        activity.binding.contentList.removeAllViews()
        activity.resetTopBarScrollSources()
        val paneRow = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            isBaselineAligned = false
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                activity.twoPaneViewportHeight(),
            )
        }
        val filterPane = activity.scrollablePane()
        val listPane = activity.scrollablePane()
        val paneWeights = if (shouldUseSongsFoldAwarePane()) {
            0.9f to 1.1f
        } else {
            0.9f to 1.1f
        }
        paneRow.addView(
            filterPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, paneWeights.first).apply {
                marginEnd = activity.dp(8)
            },
        )
        paneRow.addView(
            listPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, paneWeights.second).apply {
                marginStart = activity.dp(8)
            },
        )
        activity.activeTwoPaneDetailPane = listPane.scrollView
        activity.activeSongRefreshScrollSources = listOf(filterPane.scrollView, listPane.scrollView)
        activity.binding.contentList.addView(paneRow)
        return SongPanes(filterPane, listPane)
    }

    private fun renderSongListInto(container: LinearLayout, state: SongRenderState, includeServerStatus: Boolean) {
        if (includeServerStatus) {
            container.addView(activity.serverStatusStrip())
        }
        if (state.visibleSongs.isEmpty()) {
            val message = if (activity.selectedSongLibraryId == "favorites") {
                MainUiPolicy.songFavoriteEmptyMessage(activity.songFavoriteIds.isNotEmpty())
            } else SongMemberFilterPolicy.emptyMessage(state.catalogMembers, activity.selectedSongMemberFilter)
            container.addView(activity.noticeCard(message))
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

    private fun shouldUseSongsFoldAwarePane(): Boolean =
        SongsPanePolicy.shouldUseFoldAwarePane(activity.currentAdaptiveSpec)

    // endregion

    // region Search

    private fun refreshSongSearchResults() {
        captureActiveSongScrollPosition()
        val container = activity.songSearchResultsContainer ?: return
        val adapter = activity.songSearchResultsAdapter ?: return
        fun clearSongSearchExtras() {
            if (container.childCount > 1) container.removeViews(1, container.childCount - 1)
        }
        val renderItems: (List<SongCatalogItem>) -> Unit = { items ->
            val state = songRenderState(items)
            clearSongSearchExtras()
            adapter.catalogMembers = state.catalogMembers
            if (state.visibleSongs.isEmpty()) {
                adapter.submitList(emptyList())
                container.addView(activity.noticeCard("검색 결과가 없습니다."))
            } else {
                adapter.submitList(state.displayedSongs)
                addSongSearchListFooter(container, adapter, state)
                registerSongScrollSession(activity.binding.contentScroll, container, state, SongScrollSlot.SONG_SEARCH)
            }
        }
        if (activity.cachedSongType == "all" && activity.cachedSongItems.isNotEmpty()) {
            renderItems(activity.cachedSongItems)
            return
        }
        clearSongSearchExtras()
        adapter.submitList(emptyList())
        container.addView(activity.loadingCard(MainUiPolicy.songSearchLoadingPresentation()))
        activity.lifecycleScope.launch {
            val result = activity.serverRepository.songs(generationId = "all", type = "all")
            val items = result.items
            activity.songDiscoveryRepository.initialize(result.serverTime, items, result.isAuthoritative)
            activity.cachedSongCatalogAuthoritative = result.isAuthoritative
            activity.cachedSongItems = items
            activity.cachedSongType = "all"
            if (activity.navigationHistory.currentScreen != HubScreen.SONG_SEARCH) return@launch
            activity.refreshScreenWhenIdle(HubScreen.SONG_SEARCH) refresh@{
                if (container !== activity.songSearchResultsContainer) return@refresh
                renderItems(items)
            }
        }
    }

    private fun addSongSearchListFooter(container: LinearLayout, adapter: SongResultsAdapter, state: SongRenderState) {
        container.addView(songSearchLoadMoreControl(container, adapter, state))
    }

    // Mirrors songLoadMoreControl(), but drives the RecyclerView adapter used by song search
    // instead of appending song cards directly to a LinearLayout (which also backs the
    // separate SONGS_SINGLE/SONGS_TWO_PANE screens and must stay untouched).
    private fun songSearchLoadMoreControl(container: LinearLayout, adapter: SongResultsAdapter, state: SongRenderState): MaterialCardView {
        lateinit var control: MaterialCardView
        control = activity.baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = activity.dp(10)
            }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setPadding(activity.dp(15), activity.dp(10), activity.dp(15), activity.dp(10))
                addView(TextView(context).apply {
                    text = MainUiPolicy.songProgressText(
                        state.displayedCount,
                        state.totalFilteredCount,
                        activity.cachedSongCatalogAuthoritative,
                    )
                    gravity = Gravity.CENTER
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                })
                if (state.remainingCount > 0) {
                    addView(Chip(context).apply {
                        text = MainUiPolicy.songLoadMoreText(state.remainingCount)
                        contentDescription = "$text, ${MainUiPolicy.songProgressText(state.displayedCount, state.totalFilteredCount, activity.cachedSongCatalogAuthoritative)}"
                        setOnClickListener {
                            if (activity.isLoadingMoreSongs) return@setOnClickListener
                            activity.isLoadingMoreSongs = true
                            val footerIndex = container.indexOfChild(control)
                            if (footerIndex >= 0) container.removeViews(footerIndex, container.childCount - footerIndex)
                            activity.visibleSongLimit = MainUiPolicy.nextSongVisibleLimit(
                                activity.visibleSongLimit,
                                state.totalFilteredCount,
                            )
                            activity.songBrowseSession.visibleLimit = activity.visibleSongLimit
                            val nextState = songRenderState(activity.cachedSongItems)
                            adapter.catalogMembers = nextState.catalogMembers
                            adapter.submitList(nextState.displayedSongs)
                            addSongSearchListFooter(container, adapter, nextState)
                            activity.isLoadingMoreSongs = false
                        }
                    })
                }
            })
        }
        return control
    }

    private fun applySongSearchText(rawQuery: String) {
        if (shouldUseSongsTwoPane()) {
            activity.selectedSongQuery = MainUiPolicy.normalizedSongQuery(rawQuery)
            resetSongBrowseForQueryChange()
            renderSongsSelectionChange(::renderSongs)
        } else {
            scheduleSongSearchRender(rawQuery)
        }
    }

    private fun scheduleSongSearchRender(rawQuery: String) {
        val normalized = MainUiPolicy.normalizedSongQuery(rawQuery)
        activity.selectedSongQuery = normalized
        resetSongBrowseForQueryChange()
        activity.pendingSongSearchRender?.let(activity.songSearchHandler::removeCallbacks)
        if (normalized == activity.appliedSongQuery) return
        activity.pendingSongSearchRender = Runnable {
            activity.pendingSongSearchRender = null
            if (activity.navigationHistory.currentScreen != HubScreen.SONG_SEARCH) return@Runnable
            activity.appliedSongQuery = normalized
            activity.refreshScreenWhenIdle(HubScreen.SONG_SEARCH, ::refreshSongSearchResults)
        }.also { activity.songSearchHandler.postDelayed(it, 150L) }
    }

    // endregion

    // region Filters

    private fun applySongMemberFilter(state: SongMemberFilterState) {
        val normalized = state.normalized(SongMemberFilterPolicy.selectableMembers(activity.serverMembers ?: activity.repository.members).map { it.id }.toSet())
        if (normalized == activity.selectedSongMemberFilter) return
        activity.selectedSongMemberFilter = normalized
        resetSongBrowseForQueryChange()
    }

    private fun resetSongBrowseForQueryChange() {
        activity.visibleSongLimit = MainUiPolicy.SONG_PAGE_SIZE
        activity.songBrowseSession.visibleLimit = activity.visibleSongLimit
        activity.songBrowseSession.positions.clear()
        activity.activeSongScrollView?.let { scrollSongViewTo(it, 0) }
        if (activity.isSongScrollToTopButtonInitialized()) activity.songScrollToTopButton.isVisible = false
    }

    private fun songFilterPanel(): MaterialCardView =
        activity.baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                bottomMargin = activity.dp(12)
            }
            val members = activity.serverMembers ?: activity.repository.members
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(activity.dp(12), activity.dp(12), activity.dp(12), activity.dp(10))
                addView(songSegmentedRow(MainUiPolicy.songTypeFilters(), activity.selectedSongType) { optionId ->
                    activity.selectedSongType = optionId
                    resetSongBrowseForQueryChange()
                    renderSongsSelectionChange()
                }.apply {
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    ).apply {
                        bottomMargin = activity.dp(MainUiPolicy.SONG_FILTER_SEGMENT_SPACING_DP)
                    }
                })
                addView(activity.divider())
                addView(songSegmentedRow(MainUiPolicy.songLibraryFilters(), activity.selectedSongLibraryId) { optionId ->
                    activity.selectedSongLibraryId = optionId
                    resetSongBrowseForQueryChange()
                    renderSongsSelectionChange()
                }.apply {
                    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                        topMargin = activity.dp(MainUiPolicy.SONG_FILTER_SEGMENT_SPACING_DP)
                        bottomMargin = activity.dp(MainUiPolicy.SONG_FILTER_SEGMENT_SPACING_DP)
                    }
                })
                addView(activity.divider())
                addView(songSelectorRow("정렬", MainUiPolicy.songSortLabel(activity.selectedSongSortId), accentValue = true) {
                    showSongSortDialog()
                })
                if (SongsPanePolicy.memberSelectionMode(activity.currentAdaptiveSpec) == SongMemberSelectionMode.NAVIGATE_TO_MEMBER_FILTER) {
                    addView(activity.divider())
                    addView(songSelectorRow("멤버", MainUiPolicy.songMemberFilterLabel(members, activity.selectedSongMemberFilter), accentValue = false) {
                        activity.pushScreen(HubScreen.SONG_MEMBER_FILTER)
                    })
                }
            })
        }

    private fun songInlineMemberFilterPanel(visibleCount: Int): MaterialCardView =
        activity.baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                bottomMargin = activity.dp(12)
            }
            val members = activity.serverMembers ?: activity.repository.members
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(activity.dp(12), activity.dp(12), activity.dp(12), activity.dp(10))
                addView(TextView(context).apply {
                    text = "멤버"
                    setTextColor(activity.color(R.color.hub_text))
                    textSize = 15f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                })
                addView(TextView(context).apply {
                    text = MainUiPolicy.songMemberFilterSummary(members, activity.selectedSongMemberFilter, visibleCount)
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, activity.dp(4), 0, activity.dp(8))
                })
                addView(TextView(context).apply {
                    text = "상세 조건 편집 ›"
                    setPadding(0, activity.dp(10), 0, activity.dp(10))
                    isClickable = true
                    isFocusable = true
                    contentDescription = "멤버 필터 상세 조건 편집"
                    setOnClickListener { activity.pushScreen(HubScreen.SONG_MEMBER_FILTER) }
                })
            })
        }

    private fun songSegmentedRow(
        filters: List<SongFilterOption>,
        selectedId: String,
        onSelected: (String) -> Unit,
    ): LinearLayout =
        LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            weightSum = filters.size.toFloat()
            filters.forEachIndexed { index, filter ->
                addView(activity.filterSegmentView(filter.id, filter.label, filter.id == selectedId) {
                    onSelected(filter.id)
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    if (index < filters.lastIndex) marginEnd = activity.dp(6)
                })
            }
        }

    private fun songSelectorRow(
        label: String,
        value: String,
        accentValue: Boolean,
        onClick: () -> Unit,
    ): LinearLayout =
        LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(activity.dp(3), activity.dp(9), activity.dp(3), activity.dp(9))
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
            addView(TextView(context).apply {
                text = label
                setTextColor(activity.color(R.color.hub_text))
                textSize = 14f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(TextView(context).apply {
                text = "$value ›"
                setTextColor(if (accentValue) Color.rgb(74, 144, 226) else activity.color(R.color.hub_text))
                textSize = 14f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            })
        }

    private fun showSongSortDialog() {
        val options = MainUiPolicy.songSortOptions()
        HubSingleChoiceBottomSheet(
            context = activity,
            title = activity.getString(R.string.song_sort_title),
            options = options.map { HubSingleChoiceOption(it.id, it.label) },
            selectedId = activity.selectedSongSortId,
            onSelected = { selectedId ->
                activity.selectedSongSortId = selectedId
                resetSongBrowseForQueryChange()
                renderSongsSelectionChange(::renderSongs)
            },
        ).show()
    }

    private fun songSearchCard(): MaterialCardView =
        activity.baseCard(HubCardStyle.COMPACT).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = activity.dp(10)
            }
            val icon = ImageView(context).apply {
                setImageResource(R.drawable.ic_search)
                imageTintList = ColorStateList.valueOf(activity.color(R.color.hub_text_muted))
                contentDescription = null
            }
            val input = EditText(context).apply {
                hint = "노래 제목 또는 멤버 검색"
                setSingleLine(true)
                setText(activity.selectedSongQuery)
                setTextColor(activity.color(R.color.hub_text))
                setHintTextColor(activity.color(R.color.hub_text_muted))
                textSize = 14f
                background = null
                setPadding(0, activity.dp(8), activity.dp(13), activity.dp(8))
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
                        activity.selectedSongQuery = s?.toString().orEmpty()
                        resetSongBrowseForQueryChange()
                    }
                })
            }
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(activity.dp(13), 0, 0, 0)
                addView(icon, LinearLayout.LayoutParams(activity.dp(18), activity.dp(18)))
                addView(input, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = activity.dp(8)
                })
            }
            addView(row)
        }

    // Currently unused by any live screen (superseded by songFilterPanel's segmented rows),
    // but kept and relocated as-is rather than pruned, matching the surgical-move scope of
    // this extraction.
    private fun songFilterChips(): LinearLayout =
        LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = activity.dp(12)
            }
            addView(songFilterRow(MainUiPolicy.songTypeFilters(), activity.selectedSongType) { activity.selectedSongType = it })
            addView(songFilterRow(MainUiPolicy.songSortOptions(), activity.selectedSongSortId) { activity.selectedSongSortId = it })
        }

    // Currently unused by any live screen (superseded by songInlineMemberFilterPanel), but
    // kept and relocated as-is rather than pruned, matching the surgical-move scope of this
    // extraction.
    private fun songMemberFilterCard(members: List<HubMember>, visibleCount: Int): MaterialCardView =
        activity.baseCard(HubCardStyle.INTERACTIVE).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                bottomMargin = activity.dp(10)
            }
            isClickable = true
            isFocusable = true
            setOnClickListener { activity.pushScreen(HubScreen.SONG_MEMBER_FILTER) }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(activity.dp(15), activity.dp(14), activity.dp(15), activity.dp(14))
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(context).apply {
                        text = "멤버"
                        setTextColor(activity.color(R.color.hub_text))
                        textSize = 15f
                        typeface = android.graphics.Typeface.DEFAULT_BOLD
                    })
                    addView(TextView(context).apply {
                        text = MainUiPolicy.songMemberFilterSummary(members, activity.selectedSongMemberFilter, visibleCount)
                        setTextColor(activity.color(R.color.hub_text_muted))
                        textSize = 12f
                        setPadding(0, activity.dp(4), 0, 0)
                    })
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginEnd = activity.dp(12)
                })
                addView(TextView(context).apply {
                    text = MainUiPolicy.songMemberFilterLabel(members, activity.selectedSongMemberFilter) + " ›"
                    gravity = Gravity.CENTER
                    maxLines = 1
                    setTextColor(activity.color(R.color.hub_text))
                    textSize = 13f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    background = activity.rounded(
                        fill = activity.color(R.color.hub_card_surface_compact),
                        radius = activity.dp(18),
                        stroke = activity.color(R.color.hub_line),
                    )
                    setPadding(activity.dp(12), activity.dp(7), activity.dp(12), activity.dp(7))
                })
            })
        }

    private fun songMemberFilterOptionCard(
            option: SongFilterOption,
            member: HubMember?,
            selected: Boolean,
        ): MaterialCardView =
            activity.baseCard(HubCardStyle.INTERACTIVE).apply {
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    bottomMargin = activity.dp(10)
                }
                setCardBackgroundColor(activity.color(if (selected) R.color.hub_card_surface_compact else R.color.hub_card_surface))
                strokeColor = activity.color(if (selected) R.color.hub_primary else R.color.hub_line)
                isClickable = true
                isFocusable = true
                val row = LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(activity.dp(14), activity.dp(12), activity.dp(14), activity.dp(12))
                }
                if (member != null) {
                    row.addView(songMemberProfileAvatar(member, activity.dp(42)), LinearLayout.LayoutParams(activity.dp(42), activity.dp(42)).apply {
                        marginEnd = activity.dp(12)
                    })
                }
                row.addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(context).apply {
                        text = option.label
                        setTextColor(activity.color(R.color.hub_text))
                        textSize = 15f
                        typeface = android.graphics.Typeface.DEFAULT_BOLD
                        maxLines = 1
                    })
                    addView(TextView(context).apply {
                        text = if (selected) "선택됨" else "선택 안 됨"
                        setTextColor(activity.color(R.color.hub_text_muted))
                        textSize = 12f
                        setPadding(0, activity.dp(4), 0, 0)
                    })
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                if (selected) {
                    row.addView(activity.rowChip("선택됨"), LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    ).apply {
                        marginStart = activity.dp(12)
                    })
                }
                contentDescription = "${option.label}, ${if (selected) "선택됨" else "선택 안 됨"}"
                addView(row)
            }

    // Currently unused by any live screen (superseded by songFilterPanel's segmented rows),
    // but kept and relocated as-is rather than pruned, matching the surgical-move scope of
    // this extraction.
    private fun songFilterRow(
            filters: List<SongFilterOption>,
            selectedId: String,
            onSelected: (String) -> Unit,
        ): HorizontalScrollView =
            HorizontalScrollView(activity).apply {
                isHorizontalScrollBarEnabled = false
                addView(ChipGroup(context).apply {
                    isSingleLine = true
                    filters.forEach { filter ->
                        addView(activity.centerChipText(Chip(context).apply {
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

    // endregion

    // region Song detail / quick actions

    private fun showSongDetail(song: SongCatalogItem) {
        val sheet = SongDetailBottomSheet(
            context = activity,
            openTarget = activity.songOpenPreferenceStore.read(),
            isFavorite = { target -> MainUiPolicy.songFavoriteIdentifier(target)?.let(activity.songFavoriteIds::contains) == true },
            onOpen = { activity.openExternalUrl(it) },
            onShare = ::shareSongUrl,
            onCopy = ::copySongUrl,
            onToggleFavorite = { target ->
                MainUiPolicy.songFavoriteIdentifier(target)?.let { identifier ->
                    activity.lifecycleScope.launch { activity.songFavoritesRepository.toggle(identifier) }
                }
            },
            onMemberFilter = { memberId -> applyRelatedSongFilter(SongDetailPolicy.memberFilter(memberId), null) },
            onAllMembersFilter = { target -> applyRelatedSongFilter(SongDetailPolicy.allMembersFilter(target), null) },
            onSameTypeFilter = { target -> applyRelatedSongFilter(null, target.type.apiValue) },
        )
        sheet.show(song)
        activity.lifecycleScope.launch {
            activity.songDiscoveryRepository.acknowledge(listOf(song), activity.cachedSongItems)
            sheet.update(activity.serverRepository.songDetail(song.id, song))
        }
    }

    private fun showSongQuickMenu(anchor: View, song: SongCatalogItem) {
        val selectedTarget = activity.songOpenPreferenceStore.read()
        val youtubeUrl = SongLinkPolicy.videoUrl(song, SongOpenTarget.YOUTUBE)
        val youtubeMusicUrl = SongLinkPolicy.videoUrl(song, SongOpenTarget.YOUTUBE_MUSIC)
        PopupMenu(ContextThemeWrapper(activity, R.style.ThemeOverlay_StelliveHub_PopupMenu), anchor).apply {
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
                    youtube -> youtubeUrl?.let(activity::openExternalUrl)
                    youtubeMusic -> youtubeMusicUrl?.let(activity::openExternalUrl)
                    share -> youtubeUrl?.let(::shareSongUrl)
                    copy -> youtubeUrl?.let(::copySongUrl)
                }
                true
            }
            show()
        }
    }

    private fun shareSongUrl(url: String) {
        activity.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, url)
        }, "노래 링크 공유"))
    }

    private fun copySongUrl(url: String) {
        (activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
            .setPrimaryClip(ClipData.newPlainText("YouTube 링크", url))
        Toast.makeText(activity, "링크를 복사했습니다.", Toast.LENGTH_SHORT).show()
    }

    private fun applyRelatedSongFilter(memberState: SongMemberFilterState?, type: String?) {
        activity.selectedSongQuery = ""
        memberState?.let { activity.selectedSongMemberFilter = it.normalized() }
        type?.let { activity.selectedSongType = it }
        resetSongBrowseForQueryChange()
        renderSongsSelectionChange()
        Toast.makeText(activity, "관련 노래 필터를 적용했습니다.", Toast.LENGTH_SHORT).show()
    }

    private fun songThumbnail(song: SongCatalogItem, isNew: Boolean = false): View =
        FrameLayout(activity).apply {
            val widthDp = MainUiPolicy.songThumbnailWidthDp(activity.resources.configuration.screenWidthDp)
            val width = activity.dp(widthDp)
            val height = activity.dp(MainUiPolicy.songThumbnailHeightDp(widthDp))
            layoutParams = LinearLayout.LayoutParams(width, height).apply {
                rightMargin = activity.dp(12)
            }
            background = activity.rounded(fill = activity.color(R.color.hub_surface), radius = activity.dp(12))
            addView(TextView(context).apply {
                text = "♪"
                gravity = Gravity.CENTER
                setTextColor(activity.color(R.color.hub_text_muted))
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
                            activity.runOnUiThread { setImageBitmap(bitmap) }
                        }
                    }
                }, FrameLayout.LayoutParams(width, height))
            }
            if (isNew) {
                addView(TextView(context).apply {
                    text = "NEW"
                    contentDescription = "새로 추가된 노래"
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    textSize = 10f
                    setTextColor(activity.color(R.color.hub_on_primary))
                    setPadding(activity.dp(6), activity.dp(2), activity.dp(6), activity.dp(2))
                    background = activity.rounded(
                        fill = activity.color(R.color.hub_new_badge_fill),
                        radius = activity.dp(6),
                        stroke = activity.color(R.color.hub_on_primary),
                    )
                }, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
                    gravity = Gravity.TOP or Gravity.START
                })
            }
        }

    private fun songLoadMoreControl(container: LinearLayout, state: SongRenderState): MaterialCardView {
        lateinit var control: MaterialCardView
        control = activity.baseCard().apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = activity.dp(10)
            }
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setPadding(activity.dp(15), activity.dp(10), activity.dp(15), activity.dp(10))
                addView(TextView(context).apply {
                    text = MainUiPolicy.songProgressText(
                        state.displayedCount,
                        state.totalFilteredCount,
                        activity.cachedSongCatalogAuthoritative,
                    )
                    gravity = Gravity.CENTER
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                })
                if (state.remainingCount > 0) {
                    addView(Chip(context).apply {
                        text = MainUiPolicy.songLoadMoreText(state.remainingCount)
                        contentDescription = "$text, ${MainUiPolicy.songProgressText(state.displayedCount, state.totalFilteredCount, activity.cachedSongCatalogAuthoritative)}"
                        setOnClickListener {
                            if (activity.isLoadingMoreSongs) return@setOnClickListener
                            activity.isLoadingMoreSongs = true
                            val footerIndex = container.indexOfChild(control)
                            if (footerIndex >= 0) container.removeViews(footerIndex, container.childCount - footerIndex)
                            activity.visibleSongLimit = MainUiPolicy.nextSongVisibleLimit(
                                activity.visibleSongLimit,
                                state.totalFilteredCount,
                            )
                            activity.songBrowseSession.visibleLimit = activity.visibleSongLimit
                            val nextState = songRenderState(activity.cachedSongItems)
                            nextState.displayedSongs.drop(state.displayedCount).forEach { song ->
                                container.addView(songCard(song, nextState.catalogMembers))
                            }
                            addSongListFooter(container, nextState)
                            activity.isLoadingMoreSongs = false
                        }
                    })
                }
            })
        }
        return control
    }

    private fun songMemberProfileAvatar(member: HubMember, size: Int): FrameLayout =
        FrameLayout(activity).apply {
            addView(
                activity.avatarText(member, size),
                FrameLayout.LayoutParams(size, size)
            )
            member.profileImageUrl?.takeIf { it.startsWith("https://") }?.let { imageUrl ->
                addView(
                    activity.channelImageAvatar(imageUrl, size),
                    FrameLayout.LayoutParams(size, size)
                )
            }
        }

    // endregion
}
