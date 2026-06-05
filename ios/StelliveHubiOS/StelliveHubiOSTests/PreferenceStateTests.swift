import XCTest
@testable import StelliveHubiOS

@MainActor
final class PreferenceStateTests: XCTestCase {
    func testCatalogPolicySeedsRequiredEntries() {
        let store = MockHubStore()
        XCTAssertTrue(store.members.contains { $0.id == "gangzi" && $0.generationId == "gamja" && $0.catalogRole == .representative })
        XCTAssertTrue(store.members.contains { $0.id == "stellive-official" && $0.generationId == "official" && $0.catalogRole == .officialChannel })
        XCTAssertTrue(store.members.allSatisfy { $0.activeStatus == .active || $0.activeStatus == .upcoming })
        XCTAssertFalse(store.members.contains { $0.generationName.localizedCaseInsensitiveContains("Former") })
    }

    func testRealtimeAndChatDefaults() {
        let store = MockHubStore()
        XCTAssertFalse(store.settings.realtimeEnabled)
        XCTAssertFalse(store.settings.chzzkChatEnabled)
        XCTAssertFalse(store.settings.canEnableChzzkChatPush)
    }

    func testSettingsExposeRequiredPreferencePolicyStructures() {
        let settings = NotificationSettingsState()

        XCTAssertEqual(Set(settings.generationEnabled.keys), ["gen1", "gen2", "gen3", "gamja", "official", "gen4-upcoming"])
        XCTAssertEqual(settings.generationEnabled["gen4-upcoming"], false)
        XCTAssertEqual(Set(settings.platformEnabled.keys), Set(NotificationPlatform.allCases))
        XCTAssertEqual(NotificationPlatform.hubEvent.displayName, "굿즈/행사")
        XCTAssertEqual(NotificationEventType.eventAnnounced.displayName, "굿즈/행사 공개")
        XCTAssertEqual(NotificationEventType.eventSalesOpen.displayName, "예약/판매 시작")
        XCTAssertEqual(NotificationEventType.eventDeadlineSoon.displayName, "마감 임박")
        XCTAssertEqual(HubEventCategory.onlineGoods.displayName, "굿즈")
        XCTAssertEqual(HubEventParticipationMode.hybrid.displayName, "온/오프라인")
        XCTAssertTrue(HubEventParticipationMode.hybrid.isOffline)
        XCTAssertEqual(HubEventStatus.closingSoon.displayName, "마감 임박")
        XCTAssertEqual(settings.platformEnabled[.hubEvent], true)
        XCTAssertEqual(settings.eventTypeEnabled[.eventAnnounced], true)
        XCTAssertEqual(settings.eventTypeEnabled[.eventSalesOpen], true)
        XCTAssertEqual(settings.eventTypeEnabled[.eventDeadlineSoon], true)
        XCTAssertEqual(settings.eventTypeEnabled[.eventUpdated], false)
        XCTAssertEqual(settings.eventTypeEnabled[.eventCancelled], true)
        XCTAssertEqual(settings.eventTypeEnabled[.officialXPost], true)
        XCTAssertEqual(settings.eventTypeEnabled[.officialYoutubeUpload], true)
        XCTAssertEqual(settings.eventTypeEnabled[.youtubeLiveStarted], false)
        XCTAssertTrue(settings.combinationPreferences.map(\.scope).contains(.generationPlatform))
        XCTAssertTrue(settings.combinationPreferences.map(\.scope).contains(.generationEventType))
        XCTAssertTrue(settings.combinationPreferences.map(\.scope).contains(.memberPlatform))
        XCTAssertTrue(settings.combinationPreferences.map(\.scope).contains(.memberEventType))
        XCTAssertFalse(settings.quietHours.enabled)
        XCTAssertFalse(settings.keywordFilters.hasExplicitFilters)
        XCTAssertEqual(settings.rateLimit.maxNotificationsPerMinute, 10)
    }

    func testSettingsNavigationHubSummarizesChildPages() {
        let store = MockHubStore()
        let rows = SettingsNavigationPolicy.hubRows(settings: store.settings, members: store.members)

        XCTAssertEqual(rows.map(\.route), [.delivery, .targets, .platforms, .eventTypes, .hubEvents, .advanced])
        XCTAssertEqual(rows.first { $0.route == .delivery }?.summary, "표준")
        XCTAssertEqual(rows.first { $0.route == .platforms }?.summary, "4/5")
        XCTAssertEqual(rows.first { $0.route == .hubEvents }?.summary, "켜짐 · 마감 임박 ON")
        XCTAssertFalse(rows.contains { $0.title == "CHZZK 채팅" })
    }

    func testSettingsNavigationRowsCenterTrailingSummaryAgainstFullRow() {
        XCTAssertEqual(SettingsNavigationRowLayout.trailingSummaryVerticalAlignment, .center)
        XCTAssertEqual(SettingsNavigationRowLayout.summaryLineLimit, 1)
        XCTAssertLessThanOrEqual(SettingsNavigationRowLayout.summaryMinimumScaleFactor, 0.9)
    }

    func testSettingsNavigationChildPagesKeepPolicySensitiveRows() {
        let store = MockHubStore()

        let eventRows = SettingsNavigationPolicy.eventTypeRows(settings: store.settings)
        XCTAssertEqual(eventRows.first { $0.title == "CHZZK 채팅" }?.isEnabled, false)
        XCTAssertEqual(eventRows.first { $0.title == "YouTube 라이브 시작" }?.isEnabled, false)
        XCTAssertNil(eventRows.first { $0.title == "CHZZK 채팅" }?.note)
        XCTAssertNil(eventRows.first { $0.title == "YouTube 라이브 시작" }?.note)
        XCTAssertTrue(SettingsNavigationPolicy.eventTypeSettingsCommonNotices.contains { $0.contains("공식 채널에는 YouTube 라이브 예정/시작/종료") })
        XCTAssertTrue(SettingsNavigationPolicy.eventTypeSettingsCommonNotices.contains { $0.contains("조용한 시간") })

        let hubRows = SettingsNavigationPolicy.hubEventRows(settings: store.settings)
        XCTAssertEqual(hubRows.first { $0.title == "굿즈/행사 알림" }?.isEnabled, true)
        XCTAssertEqual(hubRows.first { $0.title == "변경 알림" }?.isEnabled, false)
        XCTAssertTrue(SettingsNavigationPolicy.hubEventPolicyNotice.contains("대표/강지 이벤트"))
    }

    func testSettingsSharedPlatformPolicyIsShownOncePerSection() {
        XCTAssertNil(SettingsNavigationPolicy.platformPolicy(.chzzk))
        XCTAssertNil(SettingsNavigationPolicy.platformPolicy(.youtube))
        XCTAssertEqual(SettingsNavigationPolicy.platformPolicy(.naverCafe), "공식 API와 약관을 우선합니다. 무단 수집이나 로그인 쿠키 수집은 사용하지 않습니다.")
        XCTAssertEqual(SettingsNavigationPolicy.platformPolicy(.hubEvent), "공식 출처가 있는 기간성 굿즈, 티켓, 오프라인 행사만 포함합니다.")
        XCTAssertTrue(SettingsNavigationPolicy.platformSettingsCommonNotice.contains("플랫폼 OFF"))
    }

    func testRealtimeDisclosureMentionsPolicyLimits() {
        XCTAssertEqual(NotificationSettingsState.realtimeDisclosureLines, [
            "최대한 실시간 모드는 가능한 한 빠르게 알림을 받도록 시도하지만, 플랫폼/OS/네트워크 사정으로 지연될 수 있습니다.",
            "배터리와 데이터 사용량이 증가할 수 있습니다.",
            "사용자가 꺼둔 알림, 조용한 시간, 차단 키워드, rate limit은 계속 적용됩니다."
        ])
    }

    func testChzzkChatPushRequiresExplicitFilters() {
        var settings = NotificationSettingsState()
        settings.chzzkChatEnabled = true
        XCTAssertFalse(settings.canEnableChzzkChatPush)

        settings.keywordFilters.allowlistText = "공지"
        XCTAssertTrue(settings.canEnableChzzkChatPush)
    }

    func testAppearanceModeDefaultsToSystemAndProvidesSettingsChoices() {
        let store = MockHubStore()
        XCTAssertEqual(store.settings.appearanceMode, .system)
        XCTAssertEqual(AppearanceMode.allCases.map(\.displayName), ["자동", "라이트", "다크"])
    }

    func testIOSPrimaryNavigationMovesSettingsToToolbarAndAddsHubEventsTab() {
        XCTAssertEqual(IOSPrimaryNavigationPolicy.bottomTabs.map(\.id), ["home", "live", "history", "hubEvents"])
        XCTAssertEqual(IOSPrimaryNavigationPolicy.bottomTabs.map(\.title), ["홈", "라이브", "기록", "굿즈/행사"])
        XCTAssertFalse(IOSPrimaryNavigationPolicy.bottomTabs.contains { $0.id == "settings" })
        XCTAssertEqual(IOSPrimaryNavigationPolicy.titlelessPrimaryScreens, ["home", "hubEvents"])
        XCTAssertEqual(IOSPrimaryNavigationPolicy.settingsAccess.placement, .topBarTrailing)
        XCTAssertEqual(IOSPrimaryNavigationPolicy.settingsAccess.systemImage, "slider.horizontal.3")
        XCTAssertTrue(IOSPrimaryNavigationPolicy.settingsAccess.appliesToAllPrimaryTabs)
    }

    func testSettingsToolbarPushesWithinPresenterNavigationStackOnlyFromPrimaryRoots() {
        XCTAssertEqual(IOSPrimaryNavigationPolicy.settingsAccess.presentation, .navigationStackPush)
        XCTAssertTrue(IOSPrimaryNavigationPolicy.settingsAccess.reusesPresenterNavigationStack)
        XCTAssertTrue(IOSPrimaryNavigationPolicy.settingsAccess.showsOnlyOnPrimaryRoots)
        XCTAssertTrue(IOSPrimaryNavigationPolicy.settingsAccess.suppressesPrimaryButtonWithinSettingsFlow)
    }

    func testHomeSummaryCountsLiveMembersAndRecentNotifications() {
        let store = MockHubStore()
        XCTAssertEqual(store.liveMemberCount, 1)
        XCTAssertEqual(store.recentNotificationCount, 3)
        XCTAssertEqual(store.deliveryModeSummary, "표준")
    }

    func testHomePreviewSelectorsSurfaceCurrentStatus() {
        let store = MockHubStore()

        XCTAssertEqual(store.liveMembers.map(\.id), ["ayatsuno-yuni"])
        XCTAssertEqual(store.recentHistoryPreview.map(\.id), ["h3", "h1", "h2"])
        XCTAssertEqual(store.closingSoonHubEvents.map(\.id), ["closing-official-goods"])
    }

    func testHomeDashboardPreviewCountsAreCurrentStatusOnly() {
        let store = MockHubStore()

        XCTAssertEqual(store.liveMembers.count, store.liveMemberCount)
        XCTAssertEqual(store.recentHistoryPreview.count, min(3, store.history.count))
        XCTAssertEqual(store.closingSoonHubEvents.count, store.hubEventsSummary.closingSoonCount)
        XCTAssertFalse(store.deliveryModeSummary.isEmpty)
    }

    func testHubEventStatusBadgesCenterAgainstFullRowContent() {
        XCTAssertEqual(HubEventStatusRowLayout.trailingStatusVerticalAlignment, .center)
        XCTAssertEqual(HubEventStatusRowLayout.statusLineLimit, 1)
        XCTAssertLessThanOrEqual(HubEventStatusRowLayout.statusMinimumScaleFactor, 0.9)
        XCTAssertTrue(HubEventStatusRowLayout.preservesStatusIntrinsicWidth)
    }

    func testHomePreviewKeepsPolicyContentOutOfHomeSelectors() {
        let store = MockHubStore()

        XCTAssertFalse(store.recentHistoryPreview.contains { $0.eventType.localizedCaseInsensitiveContains("youtube_live") })
        XCTAssertFalse(store.closingSoonHubEvents.contains { $0.memberId == "gangzi" })
        XCTAssertFalse(store.closingSoonHubEvents.contains { $0.generationId == "gamja" })
    }

    func testIOSGroupedScreenPolicyKeepsSecondaryScreensOnGroupedSurfaces() {
        XCTAssertEqual(IOSGroupedScreenPolicy.groupedScreens.map(\.id), ["live", "history", "hubEvents"])
        XCTAssertTrue(IOSGroupedScreenPolicy.groupedScreens.allSatisfy(\.usesInsetGroupedList))
        XCTAssertTrue(IOSGroupedScreenPolicy.groupedScreens.allSatisfy(\.wrapsRowsInGroupedCards))
        XCTAssertEqual(IOSGroupedScreenPolicy.headerHorizontalContentInset, 0)
        XCTAssertEqual(IOSGroupedScreenPolicy.headerRowInsets.top, 0)
        XCTAssertEqual(IOSGroupedScreenPolicy.hubEventsFilterPlacement, .groupedSection)
        XCTAssertEqual(IOSGroupedScreenPolicy.secondaryNoticeStyle, .settingsFootnoteSecondary)
        XCTAssertTrue(IOSGroupedScreenPolicy.darkModeGuidance.contains("plain list"))
    }

    func testHistoryPresentationMetadataUsesReaderFriendlyLabels() {
        let store = MockHubStore()
        let realtimeItem = store.history.first { $0.deliveryMode == .realtimeBestEffort }!
        let standardItem = store.history.first { $0.deliveryMode == .standard }!

        XCTAssertEqual(HistoryPresentationPolicy.titleText(for: realtimeItem), "방송 시작")
        XCTAssertEqual(HistoryPresentationPolicy.subtitleText(for: realtimeItem), "아야츠노 유니 CHZZK 방송 시작")
        XCTAssertEqual(HistoryPresentationPolicy.titleText(for: standardItem), "마감 임박")
        XCTAssertEqual(HistoryPresentationPolicy.subtitleText(for: standardItem), "스텔라이브 공식 굿즈 예약 마감 임박")
        XCTAssertEqual(HistoryPresentationPolicy.metadataText(for: realtimeItem), "실시간 · 1.8초")
        XCTAssertEqual(HistoryPresentationPolicy.metadataText(for: standardItem), "표준 · 방금")
        XCTAssertFalse(HistoryPresentationPolicy.metadataText(for: realtimeItem).contains("realtime_best_effort"))
        XCTAssertFalse(HistoryPresentationPolicy.metadataText(for: standardItem).contains("event_deadline_soon"))
    }

    func testHistoryFiltersExposeOnlyVisibleEventTypesAndMembers() {
        let store = MockHubStore()

        XCTAssertEqual(store.historyEventTypeFilters.map(\.id), [
            "all",
            "event_deadline_soon",
            "chzzk_live_started",
            "official_youtube_upload"
        ])
        XCTAssertEqual(store.historyEventTypeFilters.map(\.displayName), [
            "전체",
            "마감 임박",
            "CHZZK 방송 시작",
            "공식 YouTube 업로드"
        ])
        XCTAssertEqual(store.historyMemberFilters.map(\.id), [
            "all",
            "hub-event:closing-official-goods",
            "ayatsuno-yuni",
            "stellive-official"
        ])
        XCTAssertEqual(store.historyMemberFilters.map(\.displayName), [
            "전체",
            "굿즈/행사",
            "아야츠노 유니",
            "스텔라이브 공식"
        ])
    }

    func testHistoryFiltersCombineEventTypeAndMemberSelection() {
        let store = MockHubStore()

        XCTAssertEqual(
            store.filteredHistory(eventTypeFilterId: "event_deadline_soon", memberFilterId: "all").map(\.id),
            ["h3"]
        )
        XCTAssertEqual(
            store.filteredHistory(eventTypeFilterId: "all", memberFilterId: "ayatsuno-yuni").map(\.id),
            ["h1"]
        )
        XCTAssertTrue(
            store.filteredHistory(eventTypeFilterId: "event_deadline_soon", memberFilterId: "ayatsuno-yuni").isEmpty
        )
    }

    func testHubEventsExcludeGangziAndGamja() {
        let store = MockHubStore()

        XCTAssertFalse(store.hubEvents.contains { $0.memberId == "gangzi" })
        XCTAssertFalse(store.hubEvents.contains { $0.generationId == "gamja" })
    }

    func testHubEventsSummaryPrioritizesClosingSoonOpenUpcoming() {
        let store = MockHubStore()
        let summary = store.hubEventsSummary

        XCTAssertGreaterThanOrEqual(summary.openCount, 1)
        XCTAssertGreaterThanOrEqual(summary.upcomingCount, 1)
        XCTAssertGreaterThanOrEqual(summary.closingSoonCount, 1)
        XCTAssertEqual(summary.preview.first?.status, .closingSoon)
    }

    func testHubEventFiltersMatchExpectedCategoriesAndParticipationModes() {
        let store = MockHubStore()

        let goodsEvents = store.hubEvents(for: "goods")
        XCTAssertEqual(Set(goodsEvents.map(\.category)), [.onlineGoods, .onlineCollab])
        XCTAssertTrue(goodsEvents.allSatisfy { $0.category == .onlineGoods || $0.category == .onlineCollab })
        XCTAssertEqual(goodsEvents.map(\.id), ["closing-official-goods", "open-gen3-goods"])

        let offlineEvents = store.hubEvents(for: "offline")
        XCTAssertTrue(offlineEvents.allSatisfy { $0.participationMode.isOffline })
    }

    func testOrderedHubEventsUsesIdAsFinalTieBreaker() {
        let store = MockHubStore()
        let sharedDate = Date(timeIntervalSince1970: 1_780_500_000)
        let events = [
            HubEvent(
                id: "b-event",
                category: .onlineGoods,
                participationMode: .online,
                status: .open,
                title: "B",
                summary: nil,
                memberId: nil,
                generationId: "official",
                sourceUrl: "https://example.com/b",
                sourceLabel: "B",
                sourceType: .official,
                announcedAt: nil,
                startsAt: sharedDate,
                endsAt: nil,
                purchaseUrl: nil,
                ticketUrl: nil,
                venueName: nil,
                venueAddress: nil,
                notificationEligible: true,
                updatedAt: sharedDate
            ),
            HubEvent(
                id: "a-event",
                category: .onlineGoods,
                participationMode: .online,
                status: .open,
                title: "A",
                summary: nil,
                memberId: nil,
                generationId: "official",
                sourceUrl: "https://example.com/a",
                sourceLabel: "A",
                sourceType: .official,
                announcedAt: nil,
                startsAt: sharedDate,
                endsAt: nil,
                purchaseUrl: nil,
                ticketUrl: nil,
                venueName: nil,
                venueAddress: nil,
                notificationEligible: true,
                updatedAt: sharedDate
            )
        ]

        XCTAssertEqual(store.orderedHubEvents(events).map(\.id), ["a-event", "b-event"])
    }

    func testLiveSummaryCountsChzzkTargets() {
        let store = MockHubStore()
        XCTAssertEqual(store.chzzkLiveTargetCount, 11)
        XCTAssertEqual(store.offlineChzzkTargetCount, 10)
    }

    func testLiveStatusTextShowsElapsedTimeWhenStartedAtExists() {
        let startedAt = Date(timeIntervalSince1970: 1_780_390_800)
        let now = Date(timeIntervalSince1970: 1_780_395_780)

        XCTAssertEqual(LiveStatusFormatter.statusText(isLive: true, startedAt: startedAt, now: now), "방송 중 · 1시간 23분 진행 중")
        XCTAssertEqual(LiveStatusFormatter.statusText(isLive: true, startedAt: nil, now: now), "방송 중")
        XCTAssertEqual(LiveStatusFormatter.statusText(isLive: false, startedAt: startedAt, now: now), "오프라인")
    }

    func testHistorySummaryCountsRealtimeAndLatency() {
        let store = MockHubStore()
        XCTAssertEqual(store.realtimeHistoryCount, 2)
        XCTAssertEqual(store.averageHistoryLatencySummary, "2.1초")
    }

    func testHistoryItemsResolveToCatalogEntries() {
        let store = MockHubStore()
        let catalogHistoryItems = store.history.filter { !$0.memberId.hasPrefix("hub-event:") }
        let historyMembers = catalogHistoryItems.compactMap { store.member(for: $0) }

        XCTAssertEqual(historyMembers.count, catalogHistoryItems.count)
        XCTAssertTrue(historyMembers.contains { $0.id == "ayatsuno-yuni" && $0.catalogRole == .member })
        XCTAssertTrue(historyMembers.contains { $0.id == "stellive-official" && $0.generationId == "official" && $0.catalogRole == .officialChannel })
    }

    func testRecentHistoryPreviewResolvesMembersOnlyForCatalogEntries() {
        let store = MockHubStore()
        let previewMembers = store.recentHistoryPreview.map { store.member(for: $0) }

        XCTAssertNil(previewMembers[0])
        XCTAssertEqual(previewMembers[1]?.id, "ayatsuno-yuni")
        XCTAssertEqual(previewMembers[2]?.id, "stellive-official")
    }

    func testOfficialYoutubeLiveIsNotRepresentedInHistoryOrSettings() {
        let store = MockHubStore()
        XCTAssertFalse(store.history.contains { $0.eventType.localizedCaseInsensitiveContains("youtube_live") })
        XCTAssertEqual(store.settings.eventTypeEnabled[.youtubeLiveScheduled], false)
        XCTAssertEqual(store.settings.eventTypeEnabled[.youtubeLiveStarted], false)
        XCTAssertEqual(store.settings.eventTypeEnabled[.youtubeLiveEnded], false)
    }
}
