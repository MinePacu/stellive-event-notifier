import Foundation

@MainActor
final class MockHubStore: ObservableObject {
    @Published var selectedFilter = "all"
    @Published var settings = NotificationSettingsState()

    let filters: [GenerationFilter] = [
        .init(id: "all", displayName: "전체", notificationDefaultEnabled: true),
        .init(id: "gen1", displayName: "1기생", notificationDefaultEnabled: true),
        .init(id: "gen2", displayName: "2기생", notificationDefaultEnabled: true),
        .init(id: "gen3", displayName: "3기생", notificationDefaultEnabled: true),
        .init(id: "gamja", displayName: "감자", notificationDefaultEnabled: true),
        .init(id: "official", displayName: "기타", notificationDefaultEnabled: true),
        .init(id: "gen4-upcoming", displayName: "upcoming", notificationDefaultEnabled: false)
    ]

    let members: [HubMember] = [
        .init(id: "ayatsuno-yuni", koreanName: "아야츠노 유니", englishName: "Ayatsuno Yuni", generationId: "gen1", generationName: "1기생", unitName: "Everys", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "45e71a76e949e16a34764deb962f9d9f", youtubeHandle: "@ayatsunoyuni", xHandle: "AyatsunoYuni", isLive: true, notificationEnabled: true, realtimeEnabled: true, liveStartedAt: Date(timeIntervalSince1970: 1_780_390_800)),
        .init(id: "sakihane-huya", koreanName: "사키하네 후야", englishName: "Sakihane Huya", generationId: "gen1", generationName: "1기생", unitName: "Everys", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "36ddb9bb4f17593b60f1b63cec86611d", youtubeHandle: "@Sakihanechannel", xHandle: "verify_required", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "shirayuki-hina", koreanName: "시라유키 히나", englishName: "Shirayuki Hina", generationId: "gen2", generationName: "2기생", unitName: "Universe", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "b044e3a3b9259246bc92e863e7d3f3b8", youtubeHandle: "verify_required", xHandle: "verify_required", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "neneko-mashiro", koreanName: "네네코 마시로", englishName: "Neneko Mashiro", generationId: "gen2", generationName: "2기생", unitName: "Universe", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "4515b179f86b67b4981e16190817c580", youtubeHandle: "verify_required", xHandle: "verify_required", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "akane-lize", koreanName: "아카네 리제", englishName: "Akane Lize", generationId: "gen2", generationName: "2기생", unitName: "Universe", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "4325b1d5bbc321fad3042306646e2e50", youtubeHandle: "verify_required", xHandle: "verify_required", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "arahashi-tabi", koreanName: "아라하시 타비", englishName: "Arahashi Tabi", generationId: "gen2", generationName: "2기생", unitName: "Universe", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "a6c4ddb09cdb160478996007bff35296", youtubeHandle: "verify_required", xHandle: "verify_required", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "tenko-shibuki", koreanName: "텐코 시부키", englishName: "Tenko Shibuki", generationId: "gen3", generationName: "3기생", unitName: "Cliche", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "64d76089fba26b180d9c9e48a32600d9", youtubeHandle: nil, xHandle: "TenkoShibuki", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "aokumo-rin", koreanName: "아오쿠모 린", englishName: "Aokumo Rin", generationId: "gen3", generationName: "3기생", unitName: "Cliche", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "516937b5f85cbf2249ce31b0ad046b0f", youtubeHandle: nil, xHandle: "AokumoRin", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "hanako-nana", koreanName: "하나코 나나", englishName: "Hanako Nana", generationId: "gen3", generationName: "3기생", unitName: "Cliche", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "4d812b586ff63f8a2946e64fa860bbf5", youtubeHandle: nil, xHandle: "HanakoNana_", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "yuzuha-riko", koreanName: "유즈하 리코", englishName: "Yuzuha Riko", generationId: "gen3", generationName: "3기생", unitName: "Cliche", catalogRole: .member, roleLabel: nil, isPerson: true, chzzkChannelId: "8fd39bb8de623317de90654718638b10", youtubeHandle: nil, xHandle: "YuzuhaRiko", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "gangzi", koreanName: "강지", englishName: "Gangzi", generationId: "gamja", generationName: "감자", unitName: "감자", catalogRole: .representative, roleLabel: "스텔라이브 대표", isPerson: true, chzzkChannelId: "b5ed5db484d04faf4d150aedd362f34b", youtubeHandle: "@GANGZI1", xHandle: "GANGZIIII", isLive: false, notificationEnabled: true, realtimeEnabled: false),
        .init(id: "stellive-official", koreanName: "스텔라이브 공식", englishName: "Stellive Official", generationId: "official", generationName: "기타", unitName: "공식 채널", catalogRole: .officialChannel, roleLabel: "스텔라이브 공식 채널", isPerson: false, chzzkChannelId: nil, youtubeHandle: "@stellive_official", xHandle: "StelLive_kr", isLive: false, notificationEnabled: true, realtimeEnabled: true),
        .init(id: "gen4-placeholder", koreanName: "4기생 placeholder", englishName: "Generation 4 Placeholder", generationId: "gen4-upcoming", generationName: "4기생", unitName: "upcoming", catalogRole: .placeholder, roleLabel: nil, activeStatus: .upcoming, isPerson: false, chzzkChannelId: nil, youtubeHandle: nil, xHandle: nil, isLive: false, notificationEnabled: false, realtimeEnabled: false)
    ]

    let history: [NotificationHistoryItem] = [
        .init(id: "h1", title: "방송 시작", body: "아야츠노 유니 CHZZK 방송 시작", memberId: "ayatsuno-yuni", memberName: "아야츠노 유니", eventType: "chzzk_live_started", deliveryMode: .realtimeBestEffort, deliveryLatencyMs: 1800),
        .init(id: "h2", title: "공식 업로드", body: "스텔라이브 공식 YouTube 업로드", memberId: "stellive-official", memberName: "스텔라이브 공식", eventType: "official_youtube_upload", deliveryMode: .realtimeBestEffort, deliveryLatencyMs: 2400)
    ]

    var filteredMembers: [HubMember] {
        members.filter { selectedFilter == "all" || $0.generationId == selectedFilter }
    }

    var liveMemberCount: Int {
        members.filter(\.isLive).count
    }

    var chzzkLiveTargets: [HubMember] {
        members.filter { $0.catalogRole != .officialChannel && $0.chzzkChannelId != nil }
    }

    var chzzkLiveTargetCount: Int {
        chzzkLiveTargets.count
    }

    var offlineChzzkTargetCount: Int {
        chzzkLiveTargets.filter { !$0.isLive }.count
    }

    var recentNotificationCount: Int {
        history.count
    }

    var realtimeHistoryCount: Int {
        history.filter { $0.deliveryMode == .realtimeBestEffort }.count
    }

    var averageHistoryLatencySummary: String {
        let latencies = history.compactMap(\.deliveryLatencyMs)
        guard !latencies.isEmpty else { return "-" }

        let averageMilliseconds = Double(latencies.reduce(0, +)) / Double(latencies.count)
        return String(format: "%.1f초", averageMilliseconds / 1000)
    }

    var deliveryModeSummary: String {
        settings.realtimeEnabled ? "실시간" : "표준"
    }

    func member(for historyItem: NotificationHistoryItem) -> HubMember? {
        members.first { $0.id == historyItem.memberId }
    }
}
