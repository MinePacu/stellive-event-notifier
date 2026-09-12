package dev.minepacu.stelliveeventnotifier.feature.history

import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.material.card.MaterialCardView
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.HubMember
import dev.minepacu.stelliveeventnotifier.core.model.NotificationHistoryItem
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import dev.minepacu.stelliveeventnotifier.ui.components.HubSingleChoiceBottomSheet
import dev.minepacu.stelliveeventnotifier.ui.components.HubSingleChoiceOption

/**
 * Owns all History-screen (filter panel + event list) VIEW-BUILDING logic that previously lived
 * directly on [MainActivity], following the same extraction shape as
 * [dev.minepacu.stelliveeventnotifier.feature.settings.SettingsScreenController],
 * [dev.minepacu.stelliveeventnotifier.feature.songs.SongsScreenController], and
 * [dev.minepacu.stelliveeventnotifier.feature.goodsevents.GoodsEventsScreenController].
 *
 * Dependency-injection choice: takes the concrete [MainActivity], matching every prior extraction -
 * History view-building is entangled with generic Activity-wide UI-atom helpers (color/dp/rounded/
 * baseCard/...) and the screen-navigation stack.
 *
 * State ownership: `selectedHistoryEventTypeFilterId`/`selectedHistoryMemberFilterId` stay on
 * [MainActivity] as `internal` fields, exactly like prior extractions kept their state behind.
 *
 * `HistoryFilterSelectorRow` moved here (as a private top-level type) since nothing outside this
 * History-filter cluster referenced it - same treatment GoodsEvents gave its own detail-only types.
 *
 * `settingsInfoCard()`/`settingsNoticeCard()`/`settingsCardLayoutParams()`/
 * `applySettingsCardContentPadding()` were private MainActivity helpers used only by History's
 * render path (despite the "settings"-flavoured name); they are duplicated here privately rather
 * than left behind on MainActivity, following the exact same private-per-controller duplication
 * [dev.minepacu.stelliveeventnotifier.feature.settings.SettingsScreenController] already applies to
 * its own copies of the same three helpers - and removed from MainActivity since nothing else there
 * called them.
 *
 * Home boundary: `historyEventCard()` is also shown on the Home screen (the "최근 알림" preview
 * list) - since it is fundamentally History-domain rendering, it is bumped to `internal` and
 * `HomeScreenController` calls back into
 * `activity.historyScreenController.historyEventCard(...)` rather than duplicating it, the same
 * call-back shape already used for `songsScreenController.songCard(...)`.
 *
 * Shared-helper decisions: generic/stateful UI atoms also used elsewhere (`baseCard`, `dp`, `color`,
 * `rounded`, `divider`, `pillRow`, `memberAvatar`, `startScreen`) stay on MainActivity (visibility
 * bumped to `internal` where still `private`) and are called back into here, instead of being
 * duplicated.
 */
internal class HistoryScreenController(private val activity: MainActivity) {

    private data class HistoryFilterSelectorRow(
        val title: String,
        val selectedValue: String,
        val onClick: () -> Unit,
    )

    internal fun renderHistory() {
        val eventTypeOptions = activity.repository.historyEventTypeFilters()
        val memberOptions = activity.repository.historyMemberFilters()
        val filteredHistory = activity.repository.filteredHistory(
            eventTypeFilterId = activity.selectedHistoryEventTypeFilterId,
            memberFilterId = activity.selectedHistoryMemberFilterId
        )
        activity.startScreen(
            screenId = "history",
            title = activity.getString(R.string.history_title),
            role = "서버에서 허용, 중복 제거, 사용자 설정, rate limit을 통과한 이벤트만 표시합니다."
        )
        activity.binding.contentList.addView(
            historyFilterPanel(
                rows = listOf(
                    HistoryFilterSelectorRow(
                        title = "알림 종류",
                        selectedValue = eventTypeOptions.firstOrNull { it.id == activity.selectedHistoryEventTypeFilterId }?.displayName ?: "전체",
                        onClick = {
                            showHistoryFilterDialog(
                                title = "알림 종류",
                                options = eventTypeOptions.map { it.id to it.displayName },
                                selectedId = activity.selectedHistoryEventTypeFilterId
                            ) {
                                activity.selectedHistoryEventTypeFilterId = it
                                renderHistory()
                            }
                        }
                    ),
                    HistoryFilterSelectorRow(
                        title = "멤버",
                        selectedValue = memberOptions.firstOrNull { it.id == activity.selectedHistoryMemberFilterId }?.displayName ?: "전체",
                        onClick = {
                            showHistoryFilterDialog(
                                title = "멤버",
                                options = memberOptions.map { it.id to it.displayName },
                                selectedId = activity.selectedHistoryMemberFilterId
                            ) {
                                activity.selectedHistoryMemberFilterId = it
                                renderHistory()
                            }
                        }
                    )
                )
            )
        )
        if (filteredHistory.isEmpty()) {
            activity.binding.contentList.addView(
                settingsInfoCard(
                    "조건에 맞는 알림 없음",
                    "다른 알림 종류나 멤버를 선택하면 해당 기록만 볼 수 있습니다.",
                    listOf("필터")
                )
            )
        } else {
            filteredHistory.forEach {
                activity.binding.contentList.addView(
                    historyEventCard(
                        item = it,
                        member = activity.repository.memberForHistory(it)
                    )
                )
            }
        }
        activity.binding.contentList.addView(settingsNoticeCard(MainUiPolicy.historyPolicyNotice()))
    }

    internal fun historyEventCard(item: NotificationHistoryItem, member: HubMember?): MaterialCardView =
        activity.baseCard().apply {
            layoutParams = settingsCardLayoutParams()
            val row = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.TOP
                applySettingsCardContentPadding(horizontalPaddingDp = 13)
            }
            if (member != null) {
                row.addView(activity.memberAvatar(member, activity.dp(42)), LinearLayout.LayoutParams(activity.dp(42), activity.dp(42)))
            } else {
                row.addView(historyFallbackAvatar(item.memberName), LinearLayout.LayoutParams(activity.dp(42), activity.dp(42)))
            }
            row.addView(historyTextBlock(item), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = activity.dp(12)
            })
            addView(row)
        }

    private fun historyFallbackAvatar(memberName: String): TextView = TextView(activity).apply {
        text = memberName.take(2).ifBlank { "?" }
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
        textSize = 14f
        typeface = Typeface.DEFAULT_BOLD
        background = activity.rounded(
            fill = activity.color(R.color.hub_text_subtle),
            radius = activity.dp(21)
        )
    }

    private fun historyTextBlock(item: NotificationHistoryItem): LinearLayout = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        addView(TextView(context).apply {
            text = item.title
            setTextColor(activity.color(R.color.hub_text))
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setLineSpacing(0f, 1.08f)
        })
        addView(TextView(context).apply {
            text = item.body
            setTextColor(activity.color(R.color.hub_text_muted))
            textSize = 12f
            setPadding(0, activity.dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp), 0, 0)
            setLineSpacing(0f, 1.12f)
        })
        addView(activity.pillRow(listOf(item.eventType, item.deliveryMode.name.lowercase(), "${item.deliveryLatencyMs ?: "-"}ms")))
    }

    private fun historyFilterPanel(rows: List<HistoryFilterSelectorRow>): MaterialCardView =
        activity.baseCard().apply {
            layoutParams = settingsCardLayoutParams()
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(activity.dp(15), 0, activity.dp(15), 0)
            }
            content.addView(TextView(context).apply {
                text = "보기 필터"
                setTextColor(activity.color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                val verticalPadding = activity.dp(MainUiPolicy.settingsCardSpacing.contentVerticalPaddingDp)
                setPadding(0, verticalPadding, 0, verticalPadding)
            })
            rows.forEach { row ->
                content.addView(activity.divider())
                content.addView(historyFilterSelectorRowView(row))
            }
            addView(content)
        }

    private fun historyFilterSelectorRowView(row: HistoryFilterSelectorRow): LinearLayout = LinearLayout(activity).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        val verticalPadding = activity.dp(MainUiPolicy.settingsCardSpacing.rowVerticalPaddingDp)
        setPadding(0, verticalPadding, 0, verticalPadding)
        isClickable = true
        isFocusable = true
        setOnClickListener { row.onClick() }
        addView(TextView(context).apply {
            text = row.title
            setTextColor(activity.color(R.color.hub_text))
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginEnd = activity.dp(12)
        })
        addView(TextView(context).apply {
            text = row.selectedValue
            setTextColor(activity.color(R.color.hub_text_muted))
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
            context = activity,
            title = title,
            options = options.map { HubSingleChoiceOption(it.first, it.second) },
            selectedId = selectedId,
            onSelected = onSelected,
        ).show()
    }

    private fun settingsInfoCard(title: String, body: String, pills: List<String>): MaterialCardView =
        activity.compactEventCard(title, body, pills).apply {
            layoutParams = settingsCardLayoutParams()
            (getChildAt(0) as? LinearLayout)?.let { content ->
                content.applySettingsCardContentPadding(horizontalPaddingDp = 13)
                (content.getChildAt(1) as? TextView)?.setPadding(
                    0,
                    activity.dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp),
                    0,
                    0,
                )
            }
        }

    private fun settingsNoticeCard(text: String): TextView = activity.noticeCard(text).apply {
        val verticalPadding = activity.dp(MainUiPolicy.settingsCardSpacing.contentVerticalPaddingDp)
        setPadding(paddingLeft, verticalPadding, paddingRight, verticalPadding)
        layoutParams = settingsCardLayoutParams()
    }

    private fun settingsCardLayoutParams(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            bottomMargin = activity.dp(MainUiPolicy.settingsCardSpacing.bottomMarginDp)
        }

    private fun LinearLayout.applySettingsCardContentPadding(horizontalPaddingDp: Int = 15) {
        val verticalPadding = activity.dp(MainUiPolicy.settingsCardSpacing.contentVerticalPaddingDp)
        setPadding(activity.dp(horizontalPaddingDp), verticalPadding, activity.dp(horizontalPaddingDp), verticalPadding)
    }
}
