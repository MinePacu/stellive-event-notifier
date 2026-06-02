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

    func testHomeSummaryCountsLiveMembersAndRecentNotifications() {
        let store = MockHubStore()
        XCTAssertEqual(store.liveMemberCount, 1)
        XCTAssertEqual(store.recentNotificationCount, 2)
        XCTAssertEqual(store.deliveryModeSummary, "표준")
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
        let historyMembers = store.history.compactMap { store.member(for: $0) }

        XCTAssertEqual(historyMembers.count, store.history.count)
        XCTAssertTrue(historyMembers.contains { $0.id == "ayatsuno-yuni" && $0.catalogRole == .member })
        XCTAssertTrue(historyMembers.contains { $0.id == "stellive-official" && $0.generationId == "official" && $0.catalogRole == .officialChannel })
    }

    func testOfficialYoutubeLiveIsNotRepresentedInHistoryOrSettings() {
        let store = MockHubStore()
        XCTAssertFalse(store.history.contains { $0.eventType.localizedCaseInsensitiveContains("youtube_live") })
        XCTAssertEqual(store.settings.eventTypeEnabled[.youtubeLiveScheduled], false)
        XCTAssertEqual(store.settings.eventTypeEnabled[.youtubeLiveStarted], false)
        XCTAssertEqual(store.settings.eventTypeEnabled[.youtubeLiveEnded], false)
    }
}
