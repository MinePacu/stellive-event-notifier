import SwiftUI

private extension SongCatalogItem {
    var stableSongIdentifier: String {
        SongIdentity.identifier(for: self) ?? "song:\(id)"
    }
}

private struct SongRowOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: [String: CGFloat] = [:]
    static func reduce(value: inout [String: CGFloat], nextValue: () -> [String: CGFloat]) {
        value.merge(nextValue(), uniquingKeysWith: { _, latest in latest })
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
    @State private var selectedGenerationId = "all"
    @State private var selectedType = "all"
    @State private var selectedLibraryId = "all"
    @State private var selectedStatusId = "all"
    @State private var selectedSortId = "publishedAt_desc"
    @State private var selectedMemberId = "all"
    @State private var query = ""
    @State private var visibleLimit = IOSSongPagePolicy.pageSize
    @State private var isLoadingMore = false
    @State private var isApplyingSession = false
    @State private var isRestoringScrollPosition = false
    @State private var didRestoreSession = false
    @State private var listTopOffset: CGFloat = 0

    private var memberGenerationById: [String: String] {
        Dictionary(uniqueKeysWithValues: store.members.map { ($0.id, $0.generationId) })
    }

    private var songs: [SongCatalogItem] {
        let filtered = serverStore.songs(
            generationId: "all",
            type: selectedType,
            query: ""
        ).items.filter {
            IOSSongPagePolicy.matchesGeneration($0, selectedGenerationId: selectedGenerationId, memberGenerationById: memberGenerationById) &&
                IOSSongPagePolicy.matchesMember($0, selectedMemberId: selectedMemberId) &&
                IOSSongPagePolicy.matchesQuery($0, query: query, catalogMembers: store.members) &&
                IOSSongPagePolicy.matchesLibrary($0, selectedLibraryId: selectedLibraryId, favorites: favoritesStore.identifiers)
                && (selectedStatusId != "new" || discoveryStore.isNew($0))
        }
        return IOSSongPagePolicy.sortedSongs(filtered, sortId: selectedSortId)
    }

    private var queryKey: SongListQueryKey {
        SongListQueryKey(
            generationId: selectedGenerationId,
            type: selectedType,
            libraryId: selectedLibraryId,
            statusId: selectedStatusId,
            sortId: selectedSortId,
            memberId: selectedMemberId,
            query: query
        )
    }

    private var displayedSongs: [SongCatalogItem] {
        IOSSongPagePolicy.displayedItems(songs, visibleLimit: visibleLimit)
    }

    private var displayedCount: Int {
        IOSSongPagePolicy.displayedCount(visibleLimit: visibleLimit, totalItems: songs.count)
    }

    private var remainingCount: Int {
        IOSSongPagePolicy.remainingCount(visibleLimit: visibleLimit, totalItems: songs.count)
    }

    private var facets: SongFacetsResponse {
        let allSongs = serverStore.songs(
            generationId: "all",
            type: "all",
            query: ""
        ).items
        return SongFacetsResponse(
            summary: IOSSongPagePolicy.summaryCounts(for: allSongs, filteredSongs: songs),
            generationFilters: IOSSongPagePolicy.generationFilters.map {
                SongFilterCount(id: $0.id, label: $0.label, generationId: $0.id == "all" ? nil : $0.id, count: allSongs.count)
            },
            memberFilters: [],
            typeFilters: IOSSongPagePolicy.typeFilters.map {
                SongFilterCount(id: $0.id, label: $0.label, generationId: nil, count: allSongs.count)
            }
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
                    .init(value: "\(facets.summary.total)", label: "전체"),
                    .init(value: "\(facets.summary.original)", label: "오리지널"),
                    .init(value: "\(facets.summary.cover)", label: "커버")
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
                    Picker("기수", selection: $selectedGenerationId) {
                        ForEach(IOSSongPagePolicy.generationFilters) { filter in
                            Text(filter.label).tag(filter.id)
                        }
                    }
                    .pickerStyle(.segmented)

            Picker("분류", selection: $selectedType) {
                ForEach(IOSSongPagePolicy.typeFilters) { filter in
                    Text(filter.label).tag(filter.id)
                }
            }
            .pickerStyle(.segmented)

            NavigationLink {
                SongMemberFilterView(
                    filters: IOSSongPagePolicy.memberFilters(from: store.members),
                    members: store.members,
                    selectedMemberId: $selectedMemberId,
                    visibleLimit: $visibleLimit
                )
            } label: {
                HStack {
                    Text("멤버")
                    Spacer()
                    Text(IOSSongPagePolicy.memberFilterLabel(from: store.members, selectedMemberId: selectedMemberId))
                        .foregroundStyle(.secondary)
                }
            }

            if IOSSongPagePolicy.canClearMemberFilter(selectedMemberId) {
                Button("전체로 보기") {
                    selectedMemberId = "all"
                    visibleLimit = IOSSongPagePolicy.pageSize
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
                    Text(filter.id == "new" ? "새 노래 (\(serverStore.serverSongs.filter(discoveryStore.isNew).count))" : filter.label).tag(filter.id)
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
                    } else if songs.isEmpty {
                        Text(emptyStateMessage)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                    ForEach(displayedSongs, id: \.stableSongIdentifier) { song in
                        SongRow(song: song, catalogMembers: store.members)
                            .id(song.stableSongIdentifier)
                            .background {
                                GeometryReader { proxy in
                                    Color.clear.preference(
                                        key: SongRowOffsetPreferenceKey.self,
                                        value: [song.stableSongIdentifier: proxy.frame(in: .named("song-list-scroll")).minY]
                                    )
                                }
                            }
                            .listRowInsets(IOSSongPagePolicy.songRowInsets)
                            .listRowSeparator(.hidden)
                    }

                    if selectedStatusId == "new" && displayedSongs.contains(where: discoveryStore.isNew) {
                        Button("표시된 새 노래 확인 완료") {
                            discoveryStore.acknowledge(displayedSongs, catalog: serverStore.serverSongs)
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
                    songListProxy.scrollTo("songs-list-start", anchor: .top)
                }
                .onChange(of: songs.count) { count in
                    guard count > 0 else { return }
                    visibleLimit = IOSSongPagePolicy.clampedVisibleLimit(visibleLimit, totalItems: count)
                    browseSession.visibleLimit = visibleLimit
                }
                .onChange(of: visibleLimit) { value in
                    browseSession.visibleLimit = value
                }
                .onPreferenceChange(SongRowOffsetPreferenceKey.self) { offsets in
                    captureScrollPosition(offsets)
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
                    restoreSessionIfNeeded(using: songListProxy)
                }
                .onDisappear(perform: saveBrowseState)
                .overlay(alignment: .bottomTrailing) {
                    if shouldShowScrollToTopButton {
                        Button {
                            withAnimation(.easeInOut(duration: 0.25)) {
                                songListProxy.scrollTo("songs-list-start", anchor: .top)
                            }
                            listTopOffset = 0
                            browseSession.scrollPosition = SongScrollPosition(
                                anchorSongId: nil,
                                anchorOffset: 0,
                                fallbackAbsoluteOffset: 0,
                                visibleLimitAtCapture: visibleLimit,
                                queryKey: queryKey
                            )
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
            }
        }
    }

    private func resetSongList() {
        visibleLimit = IOSSongPagePolicy.pageSize
        browseSession.resetForQueryChange()
        listTopOffset = 0
    }

    private var shouldShowScrollToTopButton: Bool {
        IOSSongPagePolicy.shouldShowScrollToTop(
            absoluteOffset: listTopOffset,
            isLoading: serverStore.isRefreshingSongs,
            isEmpty: songs.isEmpty,
            isRestoring: isRestoringScrollPosition
        )
    }

    private func saveBrowseState() {
        browseSession.selectedGenerationId = selectedGenerationId
        browseSession.selectedType = selectedType
        browseSession.selectedLibraryId = selectedLibraryId
        browseSession.selectedStatusId = selectedStatusId
        browseSession.selectedSortId = selectedSortId
        browseSession.selectedMemberId = selectedMemberId
        browseSession.query = query
        browseSession.visibleLimit = visibleLimit
    }

    private func restoreSessionIfNeeded(using proxy: ScrollViewProxy) {
        guard !didRestoreSession else { return }
        didRestoreSession = true
        isApplyingSession = true
        selectedGenerationId = browseSession.selectedGenerationId
        selectedType = browseSession.selectedType
        selectedLibraryId = browseSession.selectedLibraryId
        selectedStatusId = browseSession.selectedStatusId
        selectedSortId = browseSession.selectedSortId
        selectedMemberId = browseSession.selectedMemberId
        query = browseSession.query
        visibleLimit = browseSession.visibleLimit
        isApplyingSession = false

        guard let position = browseSession.scrollPosition, position.queryKey == browseSession.queryKey else { return }
        visibleLimit = position.visibleLimitAtCapture
        isRestoringScrollPosition = true
        DispatchQueue.main.async {
            if let anchor = position.anchorSongId,
               displayedSongs.contains(where: { $0.stableSongIdentifier == anchor }) {
                proxy.scrollTo(anchor, anchor: .top)
            } else if position.fallbackAbsoluteOffset > 0,
                      let fallback = displayedSongs.first?.stableSongIdentifier {
                proxy.scrollTo(fallback, anchor: .top)
            }
            DispatchQueue.main.async {
                isRestoringScrollPosition = false
            }
        }
    }

    private func captureScrollPosition(_ offsets: [String: CGFloat]) {
        guard !isRestoringScrollPosition, !offsets.isEmpty else { return }
        let anchor = offsets.min { abs($0.value) < abs($1.value) ? true : false }
        if let firstId = displayedSongs.first?.stableSongIdentifier,
           let firstOffset = offsets[firstId] {
            listTopOffset = max(0, -firstOffset)
        } else if anchor?.key != displayedSongs.first?.stableSongIdentifier {
            listTopOffset = max(listTopOffset, 241)
        }
        browseSession.scrollPosition = SongScrollPosition(
            anchorSongId: anchor?.key,
            anchorOffset: anchor?.value ?? 0,
            fallbackAbsoluteOffset: listTopOffset,
            visibleLimitAtCapture: visibleLimit,
            queryKey: queryKey
        )
        saveBrowseState()
    }

    private func refreshSongs() async {
        await serverStore.refreshSongs(
            generationId: "all",
            type: "all",
            query: ""
        )
        discoveryStore.initialize(
            serverTime: serverStore.songCatalogServerTime,
            catalog: serverStore.serverSongs,
            authoritative: serverStore.hasAuthoritativeSongCatalog
        )
    }

    private var emptyStateMessage: String {
        if selectedStatusId == "new" {
            if !discoveryStore.state.initialized { return "새 노래 상태를 확인하는 중입니다." }
            if !serverStore.serverSongs.contains(where: discoveryStore.isNew) { return "새로 추가된 노래가 없습니다." }
            return "현재 필터 조건에 맞는 새 노래가 없습니다."
        }
        return selectedLibraryId == "favorites"
            ? IOSSongPagePolicy.favoriteEmptyMessage(hasStoredFavorites: !favoritesStore.identifiers.isEmpty)
            : "표시할 노래 없음"
    }

    private var songLoadMoreControl: some View {
        VStack(spacing: 8) {
            Text(IOSSongPagePolicy.progressText(
                displayedCount: displayedCount,
                totalFilteredCount: songs.count,
                authoritative: serverStore.hasAuthoritativeSongCatalog
            ))
                .font(.caption)
                .foregroundStyle(.secondary)

            if IOSSongPagePolicy.canLoadMore(visibleLimit: visibleLimit, totalItems: songs.count) {
                Button(IOSSongPagePolicy.loadMoreText(remainingCount: remainingCount)) {
                    guard !isLoadingMore else { return }
                    isLoadingMore = true
                    visibleLimit = IOSSongPagePolicy.nextVisibleLimit(visibleLimit: visibleLimit, totalItems: songs.count)
                    isLoadingMore = false
                }
                .buttonStyle(.borderless)
                .disabled(isLoadingMore)
                .accessibilityLabel(IOSSongPagePolicy.loadMoreText(remainingCount: remainingCount))
                .accessibilityValue(IOSSongPagePolicy.progressText(
                    displayedCount: displayedCount,
                    totalFilteredCount: songs.count,
                    authoritative: serverStore.hasAuthoritativeSongCatalog
                ))
            }
        }
    }
}

struct SongRow: View {
    let song: SongCatalogItem
    let catalogMembers: [HubMember]
    @EnvironmentObject private var favoritesStore: SongFavoritesStore
    @EnvironmentObject private var discoveryStore: SongDiscoveryStore
    @EnvironmentObject private var serverStore: ServerHubStore
    @Environment(\.openURL) private var openURL

    var body: some View {
        let displayText = IOSSongPagePolicy.displayText(for: song, catalogMembers: catalogMembers)
        HStack(alignment: .top, spacing: 4) {
            Button {
                discoveryStore.acknowledge([song], catalog: serverStore.serverSongs)
                openURL(URL(string: song.youtubeUrl) ?? URL(string: "https://www.youtube.com")!)
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    SongThumbnailView(urls: IOSSongPagePolicy.thumbnailUrlCandidates(for: song))

                VStack(alignment: .leading, spacing: 6) {
                    Text(displayText.title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.86)

                    Text(displayText.subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)

                    Text(song.type.displayName)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule(style: .continuous)
                                .fill(Color(.tertiarySystemGroupedBackground))
                        )

                    if let premiereLabel = IOSSongPagePolicy.premiereStatusLabel(for: song) {
                        Text(premiereLabel)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(Color(.tertiarySystemGroupedBackground))
                            )
                    }

                    if let publishedAt = song.publishedAt {
                        Text(publishedAt, style: .date)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer(minLength: 8)
                if discoveryStore.isNew(song) {
                    Text("NEW")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule(style: .continuous).fill(Color(.tertiarySystemGroupedBackground)))
                        .accessibilityLabel("새로 추가된 노래")
                }
                }
            }
            .buttonStyle(.plain)

            if IOSSongPagePolicy.favoriteIdentifier(for: song) != nil {
                Button {
                    favoritesStore.toggle(song)
                } label: {
                    Image(systemName: favoritesStore.contains(song) ? "star.fill" : "star")
                        .font(.title3)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(favoritesStore.contains(song) ? "즐겨찾기 해제" : "즐겨찾기 추가")
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
        )
    }
}

private struct SongMemberFilterView: View {
    let filters: [SongFilterOption]
    let members: [HubMember]
    @Binding var selectedMemberId: String
    @Binding var visibleLimit: Int
    @Environment(\.dismiss) private var dismiss

    private var memberById: [String: HubMember] {
        Dictionary(uniqueKeysWithValues: members.map { ($0.id, $0) })
    }

    var body: some View {
        List(filters) { filter in
            Button {
                selectedMemberId = filter.id
                visibleLimit = IOSSongPagePolicy.pageSize
                dismiss()
            } label: {
                HStack(spacing: 12) {
                    if let member = memberById[filter.id] {
                        MemberAvatarView(member: member, size: 42, source: .youtubeProfile)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(filter.label)
                            .foregroundStyle(.primary)
                        Text(selectedMemberId == filter.id ? "현재 적용 중" : "탭해서 선택")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    if selectedMemberId == filter.id {
                        Text("선택됨")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.primary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(Color(.tertiarySystemGroupedBackground))
                            )
                    }
                }
            }
            .buttonStyle(.plain)
        }
        .navigationTitle("노래 멤버 선택")
    }
}

private struct SongThumbnailView: View {
    let urls: [URL]
    @State private var index = 0

    var body: some View {
        Group {
            if urls.indices.contains(index) {
                AsyncImage(url: urls[index]) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        fallbackTrigger
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: IOSSongPagePolicy.thumbnailSize.width, height: IOSSongPagePolicy.thumbnailSize.height)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityHidden(true)
    }

    private var fallbackTrigger: some View {
        placeholder.task {
            if index + 1 < urls.count {
                index += 1
            }
        }
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
