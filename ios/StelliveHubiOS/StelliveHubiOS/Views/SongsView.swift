import SwiftUI
import UIKit

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
    @State private var didRestoreSession = false
    @State private var listTopOffset: CGFloat = 0
    @State private var selectedSong: SongCatalogItem?

    private var songs: [SongCatalogItem] {
        let filtered = serverStore.songs(
            generationId: "all",
            type: selectedType,
            query: ""
        ).items.filter {
            IOSSongPagePolicy.matchesMember($0, state: memberFilter) &&
                IOSSongPagePolicy.matchesQuery($0, query: query, catalogMembers: store.members) &&
                IOSSongPagePolicy.matchesLibrary($0, selectedLibraryId: selectedLibraryId, favorites: favoritesStore.identifiers)
                && (selectedStatusId != "new" || discoveryStore.isNew($0))
        }
        return IOSSongPagePolicy.sortedSongs(filtered, sortId: selectedSortId)
    }

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
                        SongRow(song: song, catalogMembers: store.members) { selectedSong = $0 }
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
        browseSession.selectedGenerationId = "all"
        browseSession.selectedType = selectedType
        browseSession.selectedLibraryId = selectedLibraryId
        browseSession.selectedStatusId = selectedStatusId
        browseSession.selectedSortId = selectedSortId
        browseSession.memberFilter = memberFilter.normalized()
        browseSession.query = query
        browseSession.visibleLimit = visibleLimit
    }

    private func restoreSessionIfNeeded(using proxy: ScrollViewProxy) {
        guard !didRestoreSession else { return }
        didRestoreSession = true
        isApplyingSession = true
        browseSession.selectedGenerationId = "all"
        selectedType = browseSession.selectedType
        selectedLibraryId = browseSession.selectedLibraryId
        selectedStatusId = browseSession.selectedStatusId
        selectedSortId = browseSession.selectedSortId
        memberFilter = browseSession.memberFilter
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
        if selectedLibraryId == "favorites" { return IOSSongPagePolicy.favoriteEmptyMessage(hasStoredFavorites: !favoritesStore.identifiers.isEmpty) }
        return IOSSongPagePolicy.memberFilterEmptyMessage(from: store.members, state: memberFilter)
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

private struct SongMetadataFlowLayout: Layout {
    let spacing: CGFloat

    init(spacing: CGFloat = 6) {
        self.spacing = spacing
    }

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        let availableWidth = proposal.width ?? .greatestFiniteMagnitude
        var currentWidth: CGFloat = 0
        var maximumWidth: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            let itemWidth = currentWidth == 0 ? size.width : spacing + size.width
            if currentWidth > 0, currentWidth + itemWidth > availableWidth {
                maximumWidth = max(maximumWidth, currentWidth)
                totalHeight += rowHeight + spacing
                currentWidth = size.width
                rowHeight = size.height
            } else {
                currentWidth += itemWidth
                rowHeight = max(rowHeight, size.height)
            }
        }

        maximumWidth = max(maximumWidth, currentWidth)
        totalHeight += rowHeight
        return CGSize(width: proposal.width ?? maximumWidth, height: totalHeight)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
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
    let song: SongCatalogItem
    let catalogMembers: [HubMember]
    let onOpenDetail: (SongCatalogItem) -> Void
    @EnvironmentObject private var favoritesStore: SongFavoritesStore
    @EnvironmentObject private var discoveryStore: SongDiscoveryStore
    @Environment(\.openURL) private var openURL

    init(
        song: SongCatalogItem,
        catalogMembers: [HubMember],
        onOpenDetail: @escaping (SongCatalogItem) -> Void = { _ in }
    ) {
        self.song = song
        self.catalogMembers = catalogMembers
        self.onOpenDetail = onOpenDetail
    }

    var body: some View {
        let displayText = IOSSongPagePolicy.displayText(for: song, catalogMembers: catalogMembers)
        let isNew = discoveryStore.isNew(song)
        HStack(alignment: .top, spacing: 12) {
            Button {
                onOpenDetail(song)
            } label: {
                SongThumbnailView(urls: IOSSongPagePolicy.thumbnailUrlCandidates(for: song))
            }
            .buttonStyle(.plain)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 6) {
                Button {
                    onOpenDetail(song)
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(displayText.title)
                            .font(.headline)
                            .foregroundStyle(.primary)
                            .lineLimit(IOSSongPagePolicy.titleLineLimit)
                            .fixedSize(horizontal: false, vertical: true)

                        Text(displayText.subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(IOSSongPagePolicy.subtitleLineLimit)
                            .fixedSize(horizontal: false, vertical: true)

                        SongMetadataFlowLayout {
                            SongMetadataTag(song.type.displayName)
                            if isNew {
                                SongMetadataTag("NEW", accessibilityText: "새로 추가된 노래")
                            }
                            if let premiereLabel = IOSSongPagePolicy.premiereStatusLabel(for: song) {
                                SongMetadataTag(premiereLabel)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        if let publishedAt = song.publishedAt {
                            Text(publishedAt, style: .date)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(displayText.title), 곡 상세 보기")

                HStack(spacing: 4) {
                    Spacer(minLength: 0)
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
                    Menu {
                        if let url = SongLinkPolicy.videoURL(for: song) {
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
                    .accessibilityLabel("\(displayText.title) 빠른 동작")
                    .accessibilityHint(SongLinkPolicy.videoURL(for: song) == nil ? SongLinkPolicy.unavailableReason : "열기, 공유 또는 복사")
                }
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
