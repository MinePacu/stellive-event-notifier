package dev.minepacu.stelliveeventnotifier.feature.settings

import android.graphics.Typeface
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.switchmaterial.SwitchMaterial
import dev.minepacu.stelliveeventnotifier.BuildConfig
import dev.minepacu.stelliveeventnotifier.MainActivity
import dev.minepacu.stelliveeventnotifier.R
import dev.minepacu.stelliveeventnotifier.core.model.AppearanceMode
import dev.minepacu.stelliveeventnotifier.core.model.CatalogRole
import dev.minepacu.stelliveeventnotifier.core.model.DeliveryMode
import dev.minepacu.stelliveeventnotifier.core.model.NotificationEventType
import dev.minepacu.stelliveeventnotifier.core.model.NotificationPlatform
import dev.minepacu.stelliveeventnotifier.core.notification.NotificationPermissionPromptMoment
import dev.minepacu.stelliveeventnotifier.feature.home.HubScreen
import dev.minepacu.stelliveeventnotifier.feature.home.MainUiPolicy
import dev.minepacu.stelliveeventnotifier.feature.home.PreferenceSyncConflictException
import dev.minepacu.stelliveeventnotifier.feature.home.SettingsHubRow
import dev.minepacu.stelliveeventnotifier.feature.songs.SongOpenTarget
import dev.minepacu.stelliveeventnotifier.toNightMode
import dev.minepacu.stelliveeventnotifier.ui.components.HubCardStyle
import dev.minepacu.stelliveeventnotifier.ui.components.SettingsRowStyle
import dev.minepacu.stelliveeventnotifier.ui.components.SettingsRowView
import kotlinx.coroutines.launch

/**
 * Owns all Settings-screen VIEW-BUILDING logic that previously lived directly on
 * [MainActivity]. Business/state-derivation logic already lives in [MainUiPolicy];
 * this class is only responsible for turning that data into views and wiring
 * click/navigation behavior, exactly as it worked when inlined in MainActivity.
 *
 * Dependency-injection choice: this controller takes the concrete [MainActivity]
 * rather than a narrow interface. Settings view-building is heavily entangled with
 * generic, Activity-wide UI-atom helpers (color/dp/rounded/baseCard/sectionLabel/...),
 * the screen-navigation stack (startScreen/pushScreen/crossFadeTwoPaneSelection/...),
 * and a few pieces of state shared with other screens (activeTwoPaneDetailPane,
 * activeSettingsHubScrollView, currentAdaptiveSpec, repository, navigationHistory).
 * None of that is Settings-specific, so it stays on MainActivity (visibility bumped
 * from `private` to `internal` where this controller needs to call it) rather than
 * being duplicated or prematurely extracted. For this pilot, taking the whole
 * MainActivity reference avoids inventing a >20-method interface for infrastructure
 * that will be revisited when the next screens are extracted; a narrower interface
 * can be carved out later once the shared surface across multiple controllers is
 * clearer. Business logic that is bound to Activity-lifecycle machinery it would be
 * risky to relocate (ActivityResultLauncher registration timing for notification
 * permission and the "install unknown apk" flow, and the multi-step Android update
 * check/download/install workflow) intentionally stays on MainActivity too - the
 * Settings screen only surfaces it, it doesn't own it.
 */
internal class SettingsScreenController(private val activity: MainActivity) {

    private val targetNotificationEnabledOverrides = mutableMapOf<String, Boolean>()
    private var selectedSettingsDetailScreen: HubScreen? = null

    // region Screen entry points (called from MainActivity.renderScreen)

    internal fun renderSettings() {
        activity.startScreen(
            screenId = "settings",
            title = activity.getString(R.string.settings_title),
            role = ""
        )
        if (activity.shouldUseSettingsTwoPane()) {
            renderSettingsTwoPane()
            return
        }
        renderSettingsHubInto(activity.binding.contentList)
    }

    internal fun renderSettingsDelivery() {
        activity.startScreen(
            screenId = "settings_delivery",
            title = "알림 수신 방식",
            role = "알림 속도와 방해 금지 시간을 설정합니다."
        )
        renderSettingsDeliveryInto(activity.binding.contentList)
    }

    internal fun renderSettingsTargets() {
        activity.startScreen(
            screenId = "settings_targets",
            title = "대상별 알림",
            role = "알림 받을 분류와 개별 대상을 선택합니다."
        )
        renderSettingsTargetsInto(activity.binding.contentList)
    }

    internal fun renderSettingsPlatforms() {
        activity.startScreen(
            screenId = "settings_platforms",
            title = "플랫폼별 알림",
            role = "플랫폼별로 받을 알림을 선택합니다."
        )
        renderSettingsPlatformsInto(activity.binding.contentList)
    }

    internal fun renderSettingsEventTypes() {
        activity.startScreen(
            screenId = "settings_event_types",
            title = "알림 종류",
            role = "받을 알림 종류를 선택합니다."
        )
        renderSettingsEventTypesInto(activity.binding.contentList)
    }

    internal fun renderSettingsHubEvents() {
        activity.startScreen(
            screenId = "settings_hub_events",
            title = "굿즈/행사",
            role = "굿즈와 행사 알림을 설정합니다."
        )
        renderSettingsHubEventsInto(activity.binding.contentList)
    }

    internal fun renderSettingsAdvanced() {
        activity.startScreen(
            screenId = "settings_advanced",
            title = "세부 알림 설정",
            role = "분류와 개별 대상의 우선순위를 설정합니다."
        )
        renderSettingsAdvancedInto(activity.binding.contentList)
    }

    internal fun renderSettingsAbout() {
        activity.startScreen(
            screenId = "settings_about",
            title = "앱 정보",
            role = "프로젝트 소개와 버전"
        )
        renderSettingsAboutInto(activity.binding.contentList)
    }

    // endregion

    private fun renderSettingsTwoPane() {
        val paneRow = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            isBaselineAligned = false
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                activity.twoPaneViewportHeight(),
            )
        }
        val hubPane = activity.scrollablePane()
        val detailPane = activity.scrollablePane().apply {
            scrollView.background = activity.rounded(activity.color(R.color.hub_surface), activity.dp(16), activity.color(R.color.hub_line))
            content.setPadding(activity.dp(10), activity.dp(10), activity.dp(10), activity.dp(10))
        }
        paneRow.addView(
            hubPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 0.9f).apply {
                marginEnd = activity.dp(8)
            },
        )
        paneRow.addView(
            detailPane.scrollView,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1.1f).apply {
                marginStart = activity.dp(8)
            },
        )
        activity.activeTwoPaneDetailPane = detailPane.scrollView
        activity.activeSettingsHubScrollView = hubPane.scrollView
        activity.registerTopBarScrollSource(hubPane.scrollView)
        activity.binding.contentList.addView(paneRow)
        renderSettingsHubInto(hubPane.content)
        renderSelectedSettingsDetailInto(detailPane.content)
    }

    private fun renderSettingsHubInto(container: LinearLayout) {
        val settings = activity.repository.settings
        container.addView(activity.sectionLabel("알림 기본 설정"))
        container.addView(
            settingsPanel(
                rows = listOf(
                    SettingRow(
                        "전체 알림",
                        "끄면 푸시 알림을 받지 않으며 새 알림 기록도 만들지 않습니다.",
                        settings.globalEnabled,
                        onCheckedChange = { enabled ->
                            if (enabled) {
                                activity.requestNotificationPermissionIfNeeded(NotificationPermissionPromptMoment.GLOBAL_NOTIFICATION_TOGGLE)
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
            activity.repository.members.filter { it.catalogRole != CatalogRole.PLACEHOLDER }.map { member ->
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
        container.addView(activity.sectionLabel("알림 대상 및 종류"))
        addNavigationRows("알림 대상 및 종류")
        container.addView(activity.sectionLabel("앱 사용"))
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
        container.addView(activity.sectionLabel("기록 및 정보"))
        addNavigationRows("기록 및 정보")
        container.addView(activity.sectionLabel("진단"))
        container.addView(debugModePanel())
        activity.visibleServerConnectionDebugLogs().takeIf { it.isNotEmpty() }?.let { logs ->
            container.addView(
                settingsInfoCard(
                    title = "서버 연결 로그",
                    body = logs.joinToString("\n"),
                    pills = listOf("임시", "진단")
                )
            )
        }
    }

    private fun renderSettingsDeliveryInto(container: LinearLayout) {
        val settings = activity.repository.settings
        container.addView(activity.sectionLabel("알림 수신 방식"))
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
        container.addView(activity.sectionLabel("방해 금지 시간 및 필터"))
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

    private fun renderSettingsTargetsInto(container: LinearLayout) {
        val settings = activity.repository.settings
        container.addView(activity.sectionLabel("분류별 알림"))
        container.addView(
            settingsPanel(
                rows = listOf(
                    SettingRow("1기생, 2기생, 3기생", "현재 활동 중인 멤버만 포함하며, 활동이 종료된 멤버는 알림 대상에서 제외합니다.", settings.generationEnabled["gen1"] == true && settings.generationEnabled["gen2"] == true && settings.generationEnabled["gen3"] == true),
                    SettingRow("기타", "스텔라이브 공식 YouTube 업로드 알림입니다.", settings.generationEnabled["official"] == true),
                    SettingRow("합류 예정 멤버", "기본적으로 꺼져 있으며, 필요한 경우 직접 켤 수 있습니다.", settings.generationEnabled["gen4-upcoming"] == true)
                )
            )
        )
        container.addView(activity.sectionLabel("개별 대상"))
        activity.repository.members.filter { it.catalogRole != CatalogRole.PLACEHOLDER }.forEach { member ->
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

    private fun renderSettingsPlatformsInto(container: LinearLayout) {
        val settings = activity.repository.settings
        container.addView(activity.sectionLabel("플랫폼별 알림"))
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

    private fun renderSettingsEventTypesInto(container: LinearLayout) {
        val settings = activity.repository.settings
        container.addView(activity.sectionLabel("알림 종류별 설정"))
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
        container.addView(activity.sectionLabel("채팅 알림"))
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

    private fun renderSettingsHubEventsInto(container: LinearLayout) {
        val settings = activity.repository.settings
        container.addView(activity.sectionLabel("굿즈/행사"))
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

    private fun renderSettingsAdvancedInto(container: LinearLayout) {
        val settings = activity.repository.settings
        container.addView(activity.sectionLabel("알림 우선순위"))
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

    private fun renderSettingsAboutInto(container: LinearLayout) {
        container.addView(activity.sectionLabel("앱"))
        container.addView(aboutAppCard())
        container.addView(
            settingsPanel(
                rows = listOf(
                    SettingRow("버전", null, null, "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"),
                    SettingRow("라이선스", null, null, "Apache-2.0")
                )
            )
        )

        container.addView(activity.sectionLabel("업데이트"))
        container.addView(updateCheckCard())

        container.addView(activity.sectionLabel("오픈 소스"))
        container.addView(
            linkCard(
                title = "GitHub 저장소",
                body = "GitHub 저장소 열기",
                url = "https://github.com/MinePacu/stellive-event-notifier"
            )
        )

        container.addView(activity.sectionLabel("고지"))
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

    private fun updateCheckCard(): MaterialCardView =
        activity.baseCard(HubCardStyle.INTERACTIVE).apply {
            layoutParams = settingsCardLayoutParams()
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                applySettingsCardContentPadding()
            }
            content.addView(TextView(context).apply {
                text = "GitHub Release 업데이트"
                setTextColor(activity.color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
            })
            val status = TextView(context).apply {
                text = if (activity.updateCheckInProgress) "업데이트를 확인하는 중입니다." else "새 버전을 직접 확인할 수 있습니다."
                setTextColor(activity.color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(0, activity.dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp), 0, activity.dp(10))
            }
            activity.updateStatusTextView = status
            content.addView(status)
            content.addView(MaterialButton(context).apply {
                text = if (activity.updateCheckInProgress) "확인 중" else "업데이트 확인"
                isEnabled = !activity.updateCheckInProgress
                setOnClickListener { activity.checkForAndroidUpdate(manual = true) }
            })
            addView(content)
        }

    @Suppress("unused")
    private fun httpsLinkRow(title: String, url: String?): SettingRow? {
        val value = url ?: return null
        return if (value.startsWith("https://")) SettingRow(title, value, null, "열기") else null
    }

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
        if (activity.shouldUseSettingsTwoPane() && isSettingsDetailPaneScreen(screen)) {
            activity.crossFadeTwoPaneSelection("settings:${screen.id}") {
                selectedSettingsDetailScreen = screen
                renderSettings()
            }
        } else {
            activity.pushScreen(screen)
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

    private fun isSettingsDetailPaneScreen(screen: HubScreen): Boolean =
        screen == HubScreen.SETTINGS_DELIVERY ||
            screen == HubScreen.SETTINGS_TARGETS ||
            screen == HubScreen.SETTINGS_PLATFORMS ||
            screen == HubScreen.SETTINGS_EVENT_TYPES ||
            screen == HubScreen.SETTINGS_HUB_EVENTS ||
            screen == HubScreen.SETTINGS_ADVANCED ||
            screen == HubScreen.SETTINGS_ABOUT

    private fun settingsNavigationCard(row: SettingsHubRow, selected: Boolean = false): MaterialCardView =
        activity.baseCard().apply {
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
                    setTextColor(activity.color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                })
                addView(TextView(context).apply {
                    text = row.body
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, activity.dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp), 0, 0)
                    setLineSpacing(0f, 1.1f)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = activity.dp(12)
            })
            content.addView(TextView(context).apply {
                text = if (selected) "${row.value} · 선택됨 ›" else "${row.value} ›"
                setTextColor(activity.color(R.color.hub_text_muted))
                textSize = 13f
                typeface = Typeface.DEFAULT_BOLD
            })
            addView(content)
            setOnClickListener {
                onSettingsRowSelected(row)
            }
        }

    private fun aboutAppCard(): MaterialCardView =
        activity.baseCard().apply {
            layoutParams = settingsCardLayoutParams()
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                applySettingsCardContentPadding()
            }
            content.addView(TextView(context).apply {
                text = "앱"
                gravity = Gravity.CENTER
                setTextColor(activity.color(R.color.hub_primary))
                textSize = 13f
                typeface = Typeface.DEFAULT_BOLD
                background = activity.rounded(activity.color(R.color.hub_accent_soft), activity.dp(14), activity.color(R.color.hub_line))
            }, LinearLayout.LayoutParams(activity.dp(48), activity.dp(48)).apply {
                marginEnd = activity.dp(13)
            })
            content.addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                addView(TextView(context).apply {
                    text = "스텔라이브 이벤트 알리미"
                    setTextColor(activity.color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                })
                addView(TextView(context).apply {
                    text = "굿즈/행사 일정, 멤버 기념일, 플랫폼 알림을 한곳에서 확인하는 비공식 오픈 소스 앱입니다."
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, activity.dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp), 0, 0)
                    setLineSpacing(0f, 1.1f)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(content)
        }

    private fun linkCard(title: String, body: String, url: String): MaterialCardView =
        activity.baseCard(HubCardStyle.INTERACTIVE).apply {
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
                    setTextColor(activity.color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                })
                addView(TextView(context).apply {
                    text = body
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, activity.dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp), 0, 0)
                })
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = activity.dp(12)
            })
            content.addView(TextView(context).apply {
                text = "열기 ›"
                setTextColor(activity.color(R.color.hub_text_muted))
                textSize = 13f
                typeface = Typeface.DEFAULT_BOLD
            })
            addView(content)
            setOnClickListener { activity.openExternalUrl(url) }
        }

    private fun appearanceModePanel(): MaterialCardView =
        activity.baseCard().apply {
            layoutParams = settingsCardLayoutParams()
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                applySettingsCardContentPadding()
            }
            content.addView(TextView(context).apply {
                text = "화면 모드"
                setTextColor(activity.color(R.color.hub_text))
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(0, 0, 0, activity.dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp))
            })
            content.addView(TextView(context).apply {
                text = "자동 모드는 기기의 화면 설정을 따릅니다."
                setTextColor(activity.color(R.color.hub_text_muted))
                textSize = 12f
                setPadding(0, 0, 0, activity.dp(8))
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
        activity.baseCard().apply {
            layoutParams = settingsCardLayoutParams()
            val selectedTarget = activity.songOpenPreferenceStore.read()
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                applySettingsCardContentPadding()
                addView(TextView(context).apply {
                    text = "노래 재생"
                    setTextColor(activity.color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                })
                addView(TextView(context).apply {
                    text = "기본으로 열 앱"
                    setTextColor(activity.color(R.color.hub_text))
                    textSize = 13f
                    setPadding(0, activity.dp(8), 0, activity.dp(8))
                })
                addView(ChipGroup(context).apply {
                    isSingleSelection = true
                    isSelectionRequired = true
                    SongOpenTarget.entries.forEach { target ->
                        addView(Chip(context).apply {
                            text = target.displayName
                            isCheckable = true
                            isChecked = selectedTarget == target
                            minHeight = activity.dp(48)
                            setOnClickListener {
                                if (activity.songOpenPreferenceStore.read() != target) {
                                    activity.songOpenPreferenceStore.write(target)
                                }
                            }
                        })
                    }
                })
                addView(TextView(context).apply {
                    text = "노래 상세 화면의 '열기' 버튼에서 사용할 앱입니다. 공유와 링크 복사에는 YouTube 주소를 사용합니다."
                    setTextColor(activity.color(R.color.hub_text_muted))
                    textSize = 12f
                    setPadding(0, activity.dp(8), 0, 0)
                })
            })
        }

    private fun debugModePanel(): MaterialCardView =
        activity.baseCard().apply {
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
                        setTextColor(activity.color(R.color.hub_text))
                        textSize = 15f
                        typeface = Typeface.DEFAULT_BOLD
                    })
                    addView(TextView(context).apply {
                        text = "켜면 이 화면에 서버 연결 기록을 임시로 표시합니다."
                        setTextColor(activity.color(R.color.hub_text_muted))
                        textSize = 12f
                        setPadding(0, activity.dp(MainUiPolicy.settingsCardSpacing.titleBodySpacingDp), 0, 0)
                    })
                },
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginEnd = activity.dp(12)
                }
            )

            content.addView(SwitchMaterial(context).apply {
                isChecked = activity.debugModeEnabled
                thumbTintList = ContextCompat.getColorStateList(context, R.color.hub_switch_thumb_selector)
                trackTintList = ContextCompat.getColorStateList(context, R.color.hub_switch_track_selector)
                setOnCheckedChangeListener { _, checked ->
                    activity.debugModeEnabled = checked
                    activity.recordServerConnectionLog(
                        if (checked) "진단: 서버 연결 기록 표시 켜짐" else "진단: 서버 연결 기록 표시 꺼짐"
                    )
                    renderSettings()
                }
            })

            addView(content)
        }

    private fun appearanceModeChip(mode: AppearanceMode, label: String): Chip =
        Chip(activity).apply {
            text = label
            isCheckable = true
            isChecked = activity.selectedAppearanceMode == mode
            setTextColor(if (isChecked) activity.color(R.color.hub_primary) else activity.color(R.color.hub_text))
            chipStrokeWidth = activity.dp(1).toFloat()
            chipStrokeColor = ContextCompat.getColorStateList(context, R.color.hub_line)
            chipBackgroundColor = ContextCompat.getColorStateList(
                context,
                if (isChecked) R.color.hub_accent_soft else R.color.hub_card
            )
            setOnClickListener {
                if (activity.selectedAppearanceMode != mode) {
                    activity.selectedAppearanceMode = mode
                    activity.writeAppearanceMode(mode)
                    AppCompatDelegate.setDefaultNightMode(mode.toNightMode())
                }
            }
        }

    private fun settingsPanel(title: String? = null, rows: List<SettingRow>): MaterialCardView =
        activity.baseCard().apply {
            val spacing = MainUiPolicy.settingsCardSpacing
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = activity.dp(spacing.bottomMarginDp)
            }
            val content = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(activity.dp(15), 0, activity.dp(15), 0)
            }
            title?.let { panelTitle ->
                content.addView(TextView(context).apply {
                    text = panelTitle
                    setTextColor(activity.color(R.color.hub_text))
                    textSize = 15f
                    typeface = Typeface.DEFAULT_BOLD
                    val verticalPadding = MainUiPolicy.settingsPanelContentVerticalPaddingDp(hasTitle = true)
                    setPadding(0, activity.dp(verticalPadding), 0, activity.dp(verticalPadding))
                })
            }
            rows.forEachIndexed { index, row ->
                if (index > 0 || title != null) content.addView(activity.divider())
                content.addView(settingRowView(row))
            }
            addView(content)
        }

    private fun settingRowView(row: SettingRow): SettingsRowView =
        SettingsRowView(activity).bind(
            title = row.title,
            body = row.body,
            checked = row.checked,
            enabled = row.enabled,
            badge = row.badge?.let { activity.pill(it, true) },
            onCheckedChange = row.onCheckedChange,
            style = SettingsRowStyle.GROUPED,
        )

    private fun persistSettings(settings: dev.minepacu.stelliveeventnotifier.core.model.NotificationSettingState) {
        activity.persistSettingsJob?.cancel()
        activity.persistSettingsJob = activity.lifecycleScope.launch {
            try {
                activity.serverRepository.updatePreferences(settings)
                val screen = activity.navigationHistory.currentScreen
                activity.refreshScreenWhenIdle(screen) { activity.replaceScreenWithoutAnimation(screen) }
            } catch (_: PreferenceSyncConflictException) {
                Snackbar.make(
                    activity.binding.root,
                    "설정 동기화가 충돌했습니다. 다시 시도해 주세요.",
                    Snackbar.LENGTH_LONG,
                ).show()
            }
        }
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

    private fun targetToggleCard(
        title: String,
        body: String?,
        checked: Boolean,
        onCheckedChange: (Boolean) -> Unit
    ): MaterialCardView =
        activity.baseCard().apply {
            layoutParams = settingsCardLayoutParams()

            addView(
                SettingsRowView(activity).bind(
                    title = title,
                    body = body,
                    checked = checked,
                    onCheckedChange = onCheckedChange,
                    style = SettingsRowStyle.STANDALONE,
                )
            )
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

    private fun settingsNoticeCard(text: String): TextView = activity.noticeCard(text).apply {
        val verticalPadding = activity.dp(MainUiPolicy.settingsCardSpacing.contentVerticalPaddingDp)
        setPadding(paddingLeft, verticalPadding, paddingRight, verticalPadding)
        layoutParams = settingsCardLayoutParams()
    }

    private data class SettingRow(
        val title: String,
        val body: String?,
        val checked: Boolean? = null,
        val badge: String? = null,
        val enabled: Boolean = true,
        val onCheckedChange: ((Boolean) -> Unit)? = null,
    )
}
