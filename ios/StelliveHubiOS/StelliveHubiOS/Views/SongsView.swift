import SwiftUI
import UIKit
import ImageIO

private struct FirstSongOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat?
    static func reduce(value: inout CGFloat?, nextValue: () -> CGFloat?) {
        value = nextValue() ?? value
    }
}

struct SongMetadataDisplayTag: Equatable, Hashable, Identifiable {
    let text: String
    let accessibilityText: String
    var id: String { "\(text)|\(accessibilityText)" }
}

struct SongRowDisplayModel: Equatable, Hashable, Identifiable {
    let id: String
    let song: SongCatalogItem
    let title: String
    let subtitle: String
    let tags: [SongMetadataDisplayTag]
    let isFavorite: Bool
    let isNew: Bool
    let canFavorite: Bool
    let videoURL: URL?
    let thumbnailURLs: [URL]
    let detailAccessibilityLabel: String
    let quickActionAccessibilityLabel: String

    static func make(song: SongCatalogItem, catalogMembers: [HubMember], favoriteIdentifiers: Set<String>, discoveryState: SongDiscoveryStateV1) -> Self {
        let identifier = SongIdentity.identifier(for: song)
        let display = IOSSongPagePolicy.displayText(for: song, catalogMembers: catalogMembers)
        let isNew = SongDiscoveryPolicy.isNew(song, state: discoveryState)
        var tags = [SongMetadataDisplayTag(text: song.type.displayName, accessibilityText: song.type.displayName)]
        if isNew { tags.append(.init(text: "NEW", accessibilityText: "새로 추가된 노래")) }
        if let premiere = IOSSongPagePolicy.premiereStatusLabel(for: song) {
            tags.append(.init(text: premiere, accessibilityText: premiere))
        }
        return Self(
            id: identifier ?? "song:\(song.id)", song: song, title: display.title, subtitle: display.subtitle, tags: tags,
            isFavorite: identifier.map(favoriteIdentifiers.contains) ?? false, isNew: isNew, canFavorite: identifier != nil,
            videoURL: SongLinkPolicy.videoURL(for: song), thumbnailURLs: IOSSongPagePolicy.thumbnailUrlCandidates(for: song),
            detailAccessibilityLabel: "\(display.title), 곡 상세 보기", quickActionAccessibilityLabel: "\(display.title) 빠른 동작"
        )
    }
}

struct SongsDerivationInput: Equatable, Hashable {
    let songs: [SongCatalogItem]
    let catalogMembers: [HubMember]
    let queryKey: SongListQueryKey
    let favoriteIdentifiers: Set<String>
    let discoveryState: SongDiscoveryStateV1
    let visibleLimit: Int
}

struct SongsDerivedState: Equatable {
    static let empty = SongsDerivedState(
        summary: SongFacetSummary(total: 0, original: 0, cover: 0), filteredSongs: [], displayedRows: [],
        displayedCount: 0, remainingCount: 0, newSongCount: 0
    )
    let summary: SongFacetSummary
    let filteredSongs: [SongCatalogItem]
    let displayedRows: [SongRowDisplayModel]
    let displayedCount: Int
    let remainingCount: Int
    let newSongCount: Int

    static func make(input: SongsDerivationInput) -> Self {
        let rows = input.songs.map {
            SongRowDisplayModel.make(song: $0, catalogMembers: input.catalogMembers, favoriteIdentifiers: input.favoriteIdentifiers, discoveryState: input.discoveryState)
        }
        let key = input.queryKey
        let memberState = SongMemberFilterState(
            selectedMemberIds: Set(key.selectedMemberIds), matchMode: key.memberMatchMode, participation: key.participation
        )
        let filtered = rows.filter { row in
            (key.type == "all" || row.song.type.rawValue == key.type) &&
                IOSSongPagePolicy.matchesMember(row.song, state: memberState) &&
                (key.query.isEmpty || row.title.localizedCaseInsensitiveContains(key.query) || row.subtitle.localizedCaseInsensitiveContains(key.query)) &&
                (key.libraryId != "favorites" || row.isFavorite) &&
                (key.statusId != "new" || row.isNew)
        }
        let sorted = filtered.sorted { left, right in
            switch key.sortId {
            case "publishedAt_asc": return comparePublishedAt(left, right, newestFirst: false)
            case "title_asc": return compareText(left.title, right.title, leftID: left.id, rightID: right.id)
            case "member_asc":
                let order = left.subtitle.localizedStandardCompare(right.subtitle)
                return order == .orderedSame ? compareText(left.title, right.title, leftID: left.id, rightID: right.id) : order == .orderedAscending
            default: return comparePublishedAt(left, right, newestFirst: true)
            }
        }
        let count = IOSSongPagePolicy.displayedCount(visibleLimit: input.visibleLimit, totalItems: sorted.count)
        let originalCount = input.songs.reduce(into: 0) { if $1.type == .original { $0 += 1 } }
        return Self(
            summary: SongFacetSummary(total: input.songs.count, original: originalCount, cover: input.songs.count - originalCount),
            filteredSongs: sorted.map(\.song), displayedRows: Array(sorted.prefix(count)), displayedCount: count,
            remainingCount: max(sorted.count - count, 0), newSongCount: rows.filter(\.isNew).count
        )
    }

    private static func comparePublishedAt(_ left: SongRowDisplayModel, _ right: SongRowDisplayModel, newestFirst: Bool) -> Bool {
        switch (left.song.publishedAt, right.song.publishedAt) {
        case let (leftDate?, rightDate?) where leftDate != rightDate: return newestFirst ? leftDate > rightDate : leftDate < rightDate
        case (nil, _?): return false
        case (_?, nil): return true
        default: return compareText(left.title, right.title, leftID: left.id, rightID: right.id)
        }
    }

    private static func compareText(_ left: String, _ right: String, leftID: String, rightID: String) -> Bool {
        let order = left.localizedStandardCompare(right)
        return order == .orderedSame ? leftID < rightID : order == .orderedAscending
    }
}

extension IOSSongPagePolicy {
    static var songRowInsets: EdgeInsets {
        EdgeInsets(
            top: rowInsetTop,
            leading: rowInsetLeading,
            bottom: rowInsetBottom,
            trailing: rowInsetTrailing
        )
    }
}

struct SongsView: View {
    @EnvironmentObject private var store: MockHubStore
    @EnvironmentObject private var serverStore: ServerHubStore
    @EnvironmentObject private var favoritesStore: SongFavoritesStore
    @EnvironmentObject private var discoveryStore: SongDiscoveryStore
    @EnvironmentObject private var browseSession: SongBrowseSessionStore
    @State private var path = NavigationPath()
    @State private var selectedType = "all"
    @State private var selectedLibraryId = "all"
    @State private var selectedStatusId = "all"
    @State private var selectedSortId = "publishedAt_desc"
    @State private var memberFilter = SongMemberFilterState()
    @State private var query = ""
    @State private var visibleLimit = IOSSongPagePolicy.pageSize
    @State private var isLoadingMore = false
    @State private var isApplyingSession = false
    @State private var isRestoringScrollPosition = false
    @State private var didApplySession = false
    @State private var didRestoreScrollPosition = false
    @State private var hasScrolledPastTopThreshold = false
    @State private var pendingScrollPosition: SongScrollPosition?
    @State private var scrollSaveTask: Task<Void, Never>?
    @State private var derivedState = SongsDerivedState.empty
    @State private var selectedSong: SongCatalogItem?

    private var queryKey: SongListQueryKey {
        SongListQueryKey(
            generationId: "all",
            type: selectedType,
            libraryId: selectedLibraryId,
            statusId: selectedStatusId,
            sortId: selectedSortId,
            selectedMemberIds: memberFilter.selectedMemberIds.sorted(),
            memberMatchMode: memberFilter.normalized().matchMode,
            participation: memberFilter.participation,
            query: query
        )
    }

    private var derivationInput: SongsDerivationInput {
        SongsDerivationInput(
            songs: serverStore.songCatalogItems,
            catalogMembers: store.members,
            queryKey: queryKey,
            favoriteIdentifiers: favoritesStore.identifiers,
            discoveryState: discoveryStore.state,
            visibleLimit: visibleLimit
        )
    }

    var body: some View {
        NavigationStack(path: $path) {
            ScrollViewReader { songListProxy in
                List {
                HubHeaderCard(
                    iconText: "♪",
                title: "노래",
                subtitle: "YouTube 기반 오리지널/커버 곡 목록",
                metrics: [
                    .init(value: "\(derivedState.summary.total)", label: "전체"),
                    .init(value: "\(derivedState.summary.original)", label: "오리지널"),
                    .init(value: "\(derivedState.summary.cover)", label: "커버")
                ]
            )
                .listRowInsets(IOSGroupedScreenPolicy.headerRowInsets)
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
                .id("songs-list-start")

                Section("검색") {
                    TextField("노래 제목 또는 멤버 검색", text: $query)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)
                }

                Section("필터") {
            Picker("분류", selection: $selectedType) {
                ForEach(IOSSongPagePolicy.typeFilters) { filter in
                    Text(filter.label).tag(filter.id)
                }
            }
            .pickerStyle(.segmented)

            NavigationLink {
                SongMemberFilterView(
                    members: store.members,
                    appliedState: $memberFilter
                )
            } label: {
                HStack {
                    Text("멤버")
                    Spacer()
                    Text(IOSSongPagePolicy.memberFilterLabel(from: store.members, state: memberFilter))
                        .foregroundStyle(.secondary)
                }
            }

            if IOSSongPagePolicy.canClearMemberFilter(memberFilter) {
                Button("멤버 조건 초기화") {
                    memberFilter = SongMemberFilterState()
                }
            }

            Picker("보관함", selection: $selectedLibraryId) {
                ForEach(IOSSongPagePolicy.libraryFilters) { filter in
                    Text(filter.label).tag(filter.id)
                }
            }
            .pickerStyle(.segmented)

            Picker("상태", selection: $selectedStatusId) {
                ForEach(IOSSongPagePolicy.statusFilters) { filter in
                    Text(filter.id == "new" ? "새 노래 (\(derivedState.newSongCount))" : filter.label).tag(filter.id)
                }
            }
            .pickerStyle(.segmented)

            Picker("정렬", selection: $selectedSortId) {
                ForEach(IOSSongPagePolicy.sortOptions) { option in
                    Text(option.label).tag(option.id)
                }
            }
            .pickerStyle(.menu)

        }

                Section("노래 목록") {
                    if serverStore.isRefreshingSongs && serverStore.serverSongs.isEmpty {
                        LoadingStateRow(
                            title: "노래 목록 불러오는 중",
                            message: "서버 캐시에서 오리지널곡과 커버곡 목록을 가져오고 있습니다."
                        )
                    } else if derivedState.filteredSongs.isEmpty {
                        Text(emptyStateMessage)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                    ForEach(derivedState.displayedRows) { row in
                        SongRow(
                            model: row,
                            onOpenDetail: { selectedSong = $0 },
                            onToggleFavorite: { favoritesStore.toggle($0) }
                        )
                            .id(row.id)
                            .background {
                                if row.id == derivedState.displayedRows.first?.id {
                                    GeometryReader { proxy in
                                        Color.clear.preference(
                                            key: FirstSongOffsetPreferenceKey.self,
                                            value: proxy.frame(in: .named("song-list-scroll")).minY
                                        )
                                    }
                                }
                            }
                            .onAppear { trackVisibleRow(row) }
                            .listRowInsets(IOSSongPagePolicy.songRowInsets)
                            .listRowSeparator(.hidden)
                    }

                    if selectedStatusId == "new" && derivedState.displayedRows.contains(where: \.isNew) {
                        Button("표시된 새 노래 확인 완료") {
                            discoveryStore.acknowledge(derivedState.displayedRows.map(\.song), catalog: serverStore.songCatalogItems)
                        }
                    }

                    songLoadMoreControl
                    }
                }
            }
                .listStyle(.insetGrouped)
                .coordinateSpace(name: "song-list-scroll")
                .scrollContentBackground(.hidden)
                .background(Color(uiColor: .systemGroupedBackground))
                .settingsToolbar(path: $path)
                .onChange(of: queryKey) { _ in
                    guard !isApplyingSession else { return }
                    resetSongList()
                    saveBrowseState()
                    songListProxy.scrollTo("songs-list-start", anchor: .top)
                }
                .onChange(of: derivedState.filteredSongs.count) { count in
                    guard count > 0 else { return }
                    visibleLimit = IOSSongPagePolicy.clampedVisibleLimit(visibleLimit, totalItems: count)
                }
                .onChange(of: visibleLimit) { _ in
                    guard !isApplyingSession else { return }
                    saveBrowseState()
                }
                .onPreferenceChange(FirstSongOffsetPreferenceKey.self) { offset in
                    updateTopThreshold(firstRowOffset: offset)
                }
                .refreshable {
                    await refreshSongs()
                }
                .task {
                    if serverStore.serverSongs.isEmpty {
                        await refreshSongs()
                    }
                }
                .onAppear {
                    applySessionIfNeeded()
                }
                .task(id: derivationInput) {
                    let updated = SongsDerivedState.make(input: derivationInput)
                    if derivedState != updated { derivedState = updated }
                    restoreScrollIfNeeded(using: songListProxy, state: updated)
                }
                .onDisappear {
                    scrollSaveTask?.cancel()
                    if let pendingScrollPosition { browseSession.saveScrollPosition(pendingScrollPosition) }
                    saveBrowseState()
                }
                .overlay(alignment: .bottomTrailing) {
                    if shouldShowScrollToTopButton {
                        Button {
                            withAnimation(.easeInOut(duration: 0.25)) {
                                songListProxy.scrollTo("songs-list-start", anchor: .top)
                            }
                            hasScrolledPastTopThreshold = false
                            pendingScrollPosition = nil
                            browseSession.saveScrollPosition(nil)
                        } label: {
                            Image(systemName: "arrow.up")
                                .font(.headline.weight(.semibold))
                                .frame(width: 44, height: 44)
                                .background(.regularMaterial, in: Circle())
                                .shadow(radius: 4, y: 2)
                        }
                        .accessibilityLabel("맨 위로 이동")
                        .padding(.trailing, 16)
                        .padding(.bottom, 12)
                    }
                }
                .sheet(item: $selectedSong) { song in
                    SongDetailSheet(
                        song: song,
                        onMemberFilter: { applyRelatedMemberFilter(SongDetailPolicy.memberFilter(id: $0)) },
                        onAllMembersFilter: { applyRelatedMemberFilter(SongDetailPolicy.allMembersFilter(for: $0)) },
                        onSameTypeFilter: { applyRelatedTypeFilter($0.type.rawValue) }
                    )
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
                }
            }
        }
    }

    private func applyRelatedMemberFilter(_ filter: SongMemberFilterState) {
        query = ""
        memberFilter = filter.normalized()
        resetSongList()
        UIAccessibility.post(notification: .announcement, argument: "관련 멤버 필터를 적용했습니다")
    }

    private func applyRelatedTypeFilter(_ type: String) {
        query = ""
        selectedType = type
        resetSongList()
        UIAccessibility.post(notification: .announcement, argument: "같은 종류 필터를 적용했습니다")
    }

    private func resetSongList() {
        visibleLimit = IOSSongPagePolicy.pageSize
        pendingScrollPosition = nil
        browseSession.saveScrollPosition(nil)
        hasScrolledPastTopThreshold = false
    }

    private var shouldShowScrollToTopButton: Bool {
        IOSSongPagePolicy.shouldShowScrollToTop(
            absoluteOffset: hasScrolledPastTopThreshold ? 241 : 0,
            isLoading: serverStore.isRefreshingSongs,
            isEmpty: derivedState.filteredSongs.isEmpty,
            isRestoring: isRestoringScrollPosition
        )
    }

    private func saveBrowseState() {
        browseSession.saveFilters(currentBrowseSnapshot)
    }

    private var currentBrowseSnapshot: SongBrowseSnapshot {
        SongBrowseSnapshot(
            selectedGenerationId: "all",
            selectedType: selectedType,
            selectedLibraryId: selectedLibraryId,
            selectedStatusId: selectedStatusId,
            selectedSortId: selectedSortId,
            memberFilter: memberFilter.normalized(),
            query: query,
            visibleLimit: visibleLimit
        )
    }

    private func applySessionIfNeeded() {
        guard !didApplySession else { return }
        didApplySession = true
        isApplyingSession = true
        let snapshot = browseSession.snapshot
        selectedType = snapshot.selectedType
        selectedLibraryId = snapshot.selectedLibraryId
        selectedStatusId = snapshot.selectedStatusId
        selectedSortId = snapshot.selectedSortId
        memberFilter = snapshot.memberFilter
        query = snapshot.query
        visibleLimit = snapshot.visibleLimit
        isApplyingSession = false
    }

    private func restoreScrollIfNeeded(using proxy: ScrollViewProxy, state: SongsDerivedState) {
        guard didApplySession,
              !didRestoreScrollPosition,
              let position = browseSession.scrollPosition,
              position.queryKey == queryKey,
              !state.displayedRows.isEmpty
        else { return }
        didRestoreScrollPosition = true
        isRestoringScrollPosition = true
        DispatchQueue.main.async {
            if let anchor = position.anchorSongId,
               state.displayedRows.contains(where: { $0.id == anchor }) {
                proxy.scrollTo(anchor, anchor: .top)
            } else if position.fallbackAbsoluteOffset > 0,
                      let fallback = state.displayedRows.first?.id {
                proxy.scrollTo(fallback, anchor: .top)
            }
            DispatchQueue.main.async {
                isRestoringScrollPosition = false
            }
        }
    }

    private func updateTopThreshold(firstRowOffset: CGFloat?) {
        guard !isRestoringScrollPosition, let firstRowOffset else { return }
        let updated = -firstRowOffset > 240
        if hasScrolledPastTopThreshold != updated { hasScrolledPastTopThreshold = updated }
    }

    private func trackVisibleRow(_ row: SongRowDisplayModel) {
        guard !isRestoringScrollPosition else { return }
        let position = SongScrollPosition(
            anchorSongId: row.id,
            anchorOffset: 0,
            fallbackAbsoluteOffset: hasScrolledPastTopThreshold ? 241 : 0,
            visibleLimitAtCapture: visibleLimit,
            queryKey: queryKey
        )
        guard pendingScrollPosition != position else { return }
        pendingScrollPosition = position
        scrollSaveTask?.cancel()
        scrollSaveTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled, pendingScrollPosition == position else { return }
            browseSession.saveScrollPosition(position)
        }
    }

    private func refreshSongs() async {
        await serverStore.refreshSongs(
            generationId: "all",
            type: "all",
            query: ""
        )
        discoveryStore.initialize(
            serverTime: serverStore.songCatalogServerTime,
            catalog: serverStore.songCatalogItems,
            authoritative: serverStore.hasAuthoritativeSongCatalog
        )
    }

    private var emptyStateMessage: String {
        if selectedStatusId == "new" {
            if !discoveryStore.state.initialized { return "새 노래 상태를 확인하는 중입니다." }
            if derivedState.newSongCount == 0 { return "새로 추가된 노래가 없습니다." }
            return "현재 필터 조건에 맞는 새 노래가 없습니다."
        }
        if selectedLibraryId == "favorites" { return IOSSongPagePolicy.favoriteEmptyMessage(hasStoredFavorites: !favoritesStore.identifiers.isEmpty) }
        return IOSSongPagePolicy.memberFilterEmptyMessage(from: store.members, state: memberFilter)
    }

    private var songLoadMoreControl: some View {
        VStack(spacing: 8) {
            Text(IOSSongPagePolicy.progressText(
                displayedCount: derivedState.displayedCount,
                totalFilteredCount: derivedState.filteredSongs.count,
                authoritative: serverStore.hasAuthoritativeSongCatalog
            ))
                .font(.caption)
                .foregroundStyle(.secondary)

            if derivedState.remainingCount > 0 {
                Button(IOSSongPagePolicy.loadMoreText(remainingCount: derivedState.remainingCount)) {
                    guard !isLoadingMore else { return }
                    isLoadingMore = true
                    visibleLimit = IOSSongPagePolicy.nextVisibleLimit(visibleLimit: visibleLimit, totalItems: derivedState.filteredSongs.count)
                    isLoadingMore = false
                }
                .buttonStyle(.borderless)
                .disabled(isLoadingMore)
                .accessibilityLabel(IOSSongPagePolicy.loadMoreText(remainingCount: derivedState.remainingCount))
                .accessibilityValue(IOSSongPagePolicy.progressText(
                    displayedCount: derivedState.displayedCount,
                    totalFilteredCount: derivedState.filteredSongs.count,
                    authoritative: serverStore.hasAuthoritativeSongCatalog
                ))
            }
        }
    }
}

struct SongMetadataFlowLayout: Layout {
    struct Cache {
        var sizes: [CGSize] = []
        var width: CGFloat?
        var result = FlowResult(size: .zero, origins: [])
    }

    struct FlowResult: Equatable {
        let size: CGSize
        let origins: [CGPoint]
    }

    let spacing: CGFloat

    init(spacing: CGFloat = 6) {
        self.spacing = spacing
    }

    func makeCache(subviews: Subviews) -> Cache {
        Cache(sizes: subviews.map { $0.sizeThatFits(.unspecified) })
    }

    func updateCache(_ cache: inout Cache, subviews: Subviews) {
        cache.sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        cache.width = nil
    }

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout Cache
    ) -> CGSize {
        let availableWidth = proposal.width ?? .greatestFiniteMagnitude
        if cache.width != availableWidth {
            cache.width = availableWidth
            cache.result = Self.layout(sizes: cache.sizes, width: availableWidth, spacing: spacing)
        }
        return CGSize(
            width: proposal.width ?? cache.result.size.width,
            height: cache.result.size.height
        )
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout Cache
    ) {
        if cache.width != bounds.width {
            cache.width = bounds.width
            cache.result = Self.layout(sizes: cache.sizes, width: bounds.width, spacing: spacing)
        }
        for (index, subview) in subviews.enumerated() where cache.result.origins.indices.contains(index) {
            let origin = cache.result.origins[index]
            subview.place(
                at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
                proposal: ProposedViewSize(cache.sizes[index])
            )
        }
    }

    static func layout(sizes: [CGSize], width: CGFloat, spacing: CGFloat) -> FlowResult {
        var origins: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maximumWidth: CGFloat = 0
        for size in sizes {
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            maximumWidth = max(maximumWidth, x + size.width)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return FlowResult(
            size: CGSize(width: min(maximumWidth, width), height: sizes.isEmpty ? 0 : y + rowHeight),
            origins: origins
        )
    }
}

private struct SongMetadataTag: View {
    let text: String
    let accessibilityText: String

    init(_ text: String, accessibilityText: String? = nil) {
        self.text = text
        self.accessibilityText = accessibilityText ?? text
    }

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule(style: .continuous)
                    .fill(Color(.tertiarySystemGroupedBackground))
            )
            .accessibilityLabel(accessibilityText)
    }
}

struct SongRow: View {
    let model: SongRowDisplayModel
    let onOpenDetail: (SongCatalogItem) -> Void
    let onToggleFavorite: (SongCatalogItem) -> Void
    @Environment(\.openURL) private var openURL

    init(
        model: SongRowDisplayModel,
        onOpenDetail: @escaping (SongCatalogItem) -> Void = { _ in },
        onToggleFavorite: @escaping (SongCatalogItem) -> Void = { _ in }
    ) {
        self.model = model
        self.onOpenDetail = onOpenDetail
        self.onToggleFavorite = onToggleFavorite
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Button {
                onOpenDetail(model.song)
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    SongThumbnailView(urls: model.thumbnailURLs)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(model.title)
                            .font(.headline)
                            .foregroundStyle(.primary)
                            .lineLimit(IOSSongPagePolicy.titleLineLimit)

                        Text(model.subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(IOSSongPagePolicy.subtitleLineLimit)

                        SongMetadataFlowLayout {
                            ForEach(model.tags) { tag in
                                SongMetadataTag(tag.text, accessibilityText: tag.accessibilityText)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        if let publishedAt = model.song.publishedAt {
                            Text(publishedAt, style: .date)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Color.clear
                            .frame(height: 44)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(model.detailAccessibilityLabel)

            HStack(spacing: 4) {
                if model.canFavorite {
                    Button {
                        onToggleFavorite(model.song)
                    } label: {
                        Image(systemName: model.isFavorite ? "star.fill" : "star")
                            .font(.title3)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(model.isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가")
                }
                Menu {
                    if let url = model.videoURL {
                        Button("YouTube 열기", systemImage: "play.rectangle") { openURL(url) }
                        ShareLink(item: url) { Label("링크 공유", systemImage: "square.and.arrow.up") }
                        Button("링크 복사", systemImage: "doc.on.doc") {
                            UIPasteboard.general.url = url
                            UIAccessibility.post(notification: .announcement, argument: "링크를 복사했습니다")
                        }
                    } else {
                        Button("YouTube 열기", systemImage: "play.rectangle") {}.disabled(true)
                        Button("링크 공유", systemImage: "square.and.arrow.up") {}.disabled(true)
                        Button("링크 복사", systemImage: "doc.on.doc") {}.disabled(true)
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel(model.quickActionAccessibilityLabel)
                .accessibilityHint(model.videoURL == nil ? SongLinkPolicy.unavailableReason : "열기, 공유 또는 복사")
            }
            .padding(14)
        }
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color(uiColor: .separator), lineWidth: 1)
        }
    }
}

private struct SongMemberFilterView: View {
    let members: [HubMember]
    @Binding var appliedState: SongMemberFilterState
    @State private var draft: SongMemberFilterState
    @Environment(\.dismiss) private var dismiss

    init(members: [HubMember], appliedState: Binding<SongMemberFilterState>) {
        self.members = members
        self._appliedState = appliedState
        self._draft = State(initialValue: appliedState.wrappedValue)
    }

    private var validMemberIds: Set<String> {
        Set(IOSSongPagePolicy.memberFilters(from: members).map(\.id))
    }

    private var normalizedDraft: SongMemberFilterState {
        draft.normalized(validMemberIds: validMemberIds)
    }

    private var canReset: Bool { normalizedDraft != SongMemberFilterState() }
    private var canApply: Bool { normalizedDraft != appliedState.normalized(validMemberIds: validMemberIds) }

    var body: some View {
        List {
            Section("현재 조건") {
                Text(IOSSongPagePolicy.memberFilterLabel(from: members, state: draft))
                    .accessibilityLabel("현재 조건, \(IOSSongPagePolicy.memberFilterLabel(from: members, state: draft))")
            }
            Section("일치 방식") {
                Picker("선택 멤버", selection: Binding(get: { draft.matchMode }, set: { draft.matchMode = $0; normalizeDraft() })) {
                    Text("한 명 이상").tag(SongMemberMatchMode.any)
                    Text("모두 참여").tag(SongMemberMatchMode.all)
                }
                .pickerStyle(.segmented)
                .disabled(draft.selectedMemberIds.count < 2 || draft.participation == .solo)
                .accessibilityHint(draft.participation == .solo ? "솔로에서는 모두 참여를 사용할 수 없습니다" : "멤버 두 명 이상 선택 시 사용할 수 있습니다")
                Picker("참여 형태", selection: Binding(get: { draft.participation }, set: { draft.participation = $0; normalizeDraft() })) {
                    Text("전체").tag(SongParticipation.any)
                    Text("솔로").tag(SongParticipation.solo)
                    Text("콜라보").tag(SongParticipation.collaboration)
                }.pickerStyle(.segmented)
                Text("솔로·콜라보는 연결된 스텔라이브 멤버 수 기준이며 외부 가수는 계산에 포함되지 않습니다.").font(.caption).foregroundStyle(.secondary)
            }
            Section("빠른 선택") {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach([("gen1", "1기생 전원"), ("gen2", "2기생 전원"), ("gen3", "3기생 전원")], id: \.0) { id, label in
                            let preset = IOSSongPagePolicy.generationPreset(members, generationId: id)
                            Button(label) { draft = preset }
                                .buttonStyle(.bordered)
                                .tint(draft == preset ? .accentColor : .secondary)
                                .accessibilityLabel("\(label) 빠른 선택\(draft == preset ? ", 선택됨" : "")")
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
            ForEach([("gen1", "1기생"), ("gen2", "2기생"), ("gen3", "3기생")], id: \.0) { generationId, title in
                Section(title) {
                    ForEach(members.filter { member in
                        validMemberIds.contains(member.id) && member.generationId == generationId
                    }) { member in
                        Button {
                            if !draft.selectedMemberIds.insert(member.id).inserted { draft.selectedMemberIds.remove(member.id) }
                            normalizeDraft()
                        } label: {
                            HStack(spacing: 12) {
                                MemberAvatarView(member: member, size: 44, source: .youtubeProfile)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(member.koreanName.isEmpty ? member.englishName : member.koreanName)
                                        .font(.body.weight(.semibold))
                                        .foregroundStyle(.primary)
                                        .fixedSize(horizontal: false, vertical: true)
                                    Text(draft.selectedMemberIds.contains(member.id) ? "선택됨" : "선택 안 됨")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if draft.selectedMemberIds.contains(member.id) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.title3)
                                        .foregroundStyle(Color.accentColor)
                                        .accessibilityHidden(true)
                                }
                            }
                            .padding(.vertical, 4)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(
                            draft.selectedMemberIds.contains(member.id)
                                ? Color.accentColor.opacity(0.10)
                                : Color(.secondarySystemGroupedBackground)
                        )
                        .accessibilityLabel("\(member.koreanName.isEmpty ? member.englishName : member.koreanName), \(draft.selectedMemberIds.contains(member.id) ? "선택됨" : "선택 안 됨")")
                    }
                }
            }
        }
        .navigationTitle("노래 멤버 선택")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 0) {
                Divider()
                HStack(spacing: 10) {
                    Button("멤버 조건 초기화") { draft = SongMemberFilterState() }
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity)
                        .disabled(!canReset)
                        .accessibilityHint(canReset ? "편집 중인 멤버 조건을 초기 상태로 되돌립니다" : "이미 초기 상태입니다")
                    Button("적용") {
                        appliedState = normalizedDraft
                        dismiss()
                    }
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
                    .disabled(!canApply)
                    .accessibilityHint(canApply ? "편집한 멤버 조건을 노래 목록에 한 번 적용합니다" : "변경 사항이 없습니다")
                }
                .controlSize(.large)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .background(.bar)
        }
    }

    private func normalizeDraft() { draft = draft.normalized(validMemberIds: validMemberIds) }
}

struct SongThumbnailCandidateState: Equatable {
    private(set) var index = 0

    mutating func advance(urlCount: Int) -> Bool {
        guard index + 1 < urlCount else { return false }
        index += 1
        return true
    }
}

private actor SongThumbnailPipeline {
    static let shared = SongThumbnailPipeline()
    private let cache = NSCache<NSURL, UIImage>()
    private var inFlight: [URL: Task<UIImage?, Never>] = [:]

    func image(for url: URL) async -> UIImage? {
        if let cached = cache.object(forKey: url as NSURL) { return cached }
        if let existing = inFlight[url] { return await existing.value }
        let task = Task<UIImage?, Never> {
            do {
                var request = URLRequest(url: url)
                request.cachePolicy = .useProtocolCachePolicy
                let (data, response) = try await URLSession.shared.data(for: request)
                guard (response as? HTTPURLResponse).map({ 200..<300 ~= $0.statusCode }) != false else { return nil }
                return Self.downsample(data: data, maxPixelSize: 192)
            } catch {
                return nil
            }
        }
        inFlight[url] = task
        let image = await task.value
        inFlight[url] = nil
        if let image { cache.setObject(image, forKey: url as NSURL) }
        return image
    }

    private static func downsample(data: Data, maxPixelSize: CGFloat) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        return UIImage(cgImage: image)
    }
}

@MainActor
private final class SongThumbnailLoader: ObservableObject {
    @Published private(set) var image: UIImage?

    func load(urls: [URL]) async {
        image = nil
        var candidates = SongThumbnailCandidateState()
        while urls.indices.contains(candidates.index), !Task.isCancelled {
            if let loaded = await SongThumbnailPipeline.shared.image(for: urls[candidates.index]) {
                guard !Task.isCancelled else { return }
                image = loaded
                return
            }
            if !candidates.advance(urlCount: urls.count) { return }
        }
    }
}

private struct SongThumbnailView: View {
    let urls: [URL]
    @StateObject private var loader = SongThumbnailLoader()

    var body: some View {
        Group {
            if let image = loader.image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                placeholder
            }
        }
        .frame(width: IOSSongPagePolicy.thumbnailSize.width, height: IOSSongPagePolicy.thumbnailSize.height)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityHidden(true)
        .task(id: urls) { await loader.load(urls: urls) }
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color(.tertiarySystemGroupedBackground))
            .overlay {
                Image(systemName: "play.rectangle.fill")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
    }
}
