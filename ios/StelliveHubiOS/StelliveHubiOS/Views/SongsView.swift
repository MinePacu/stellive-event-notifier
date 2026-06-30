import SwiftUI

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
    @State private var path = NavigationPath()
    @State private var selectedGenerationId = "all"
    @State private var selectedType = "all"
    @State private var selectedSortId = "publishedAt_desc"
    @State private var selectedMemberId = "all"
    @State private var query = ""
    @State private var selectedPage = 1

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
                IOSSongPagePolicy.matchesQuery($0, query: query, catalogMembers: store.members)
        }
        return IOSSongPagePolicy.sortedSongs(filtered, sortId: selectedSortId)
    }

    private var currentPage: Int {
        IOSSongPagePolicy.clampedPage(selectedPage, totalItems: songs.count)
    }

    private var pagedSongs: [SongCatalogItem] {
        IOSSongPagePolicy.pageItems(songs, page: currentPage)
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

            Picker("정렬", selection: $selectedSortId) {
                ForEach(IOSSongPagePolicy.sortOptions) { option in
                    Text(option.label).tag(option.id)
                }
            }
            .pickerStyle(.menu)

            NavigationLink {
                SongMemberFilterView(
                    filters: IOSSongPagePolicy.memberFilters(from: store.members),
                    selectedMemberId: $selectedMemberId,
                    selectedPage: $selectedPage
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
                    selectedPage = 1
                }
            }
        }

                Section("노래 목록") {
                    if serverStore.isRefreshingSongs && serverStore.serverSongs.isEmpty {
                        LoadingStateRow(
                            title: "노래 목록 불러오는 중",
                            message: "서버 캐시에서 오리지널곡과 커버곡 목록을 가져오고 있습니다."
                        )
                    } else if songs.isEmpty {
                        Text("표시할 노래 없음")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                    ForEach(pagedSongs) { song in
                        SongRow(song: song, catalogMembers: store.members)
                            .listRowInsets(IOSSongPagePolicy.songRowInsets)
                            .listRowSeparator(.hidden)
                    }

                    if IOSSongPagePolicy.pageCount(totalItems: songs.count) > 1 {
                        songPageControl
                    }
                    }
                }
            }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .background(Color(uiColor: .systemGroupedBackground))
                .settingsToolbar(path: $path)
                .onChange(of: selectedGenerationId) { _ in selectedPage = 1 }
                .onChange(of: selectedType) { _ in selectedPage = 1 }
                .onChange(of: selectedSortId) { _ in selectedPage = 1 }
                .onChange(of: selectedMemberId) { _ in selectedPage = 1 }
                .onChange(of: query) { _ in selectedPage = 1 }
                .onChange(of: selectedPage) { _ in
                    guard let firstSongId = pagedSongs.first?.id else { return }
                    withAnimation(.easeInOut(duration: 0.2)) {
                        songListProxy.scrollTo(firstSongId, anchor: .top)
                    }
                }
                .refreshable {
                    await refreshSongs()
                }
                .task {
                    await refreshSongs()
                }
            }
        }
    }

    private func refreshSongs() async {
        await serverStore.refreshSongs(
            generationId: "all",
            type: selectedType,
            query: ""
        )
    }

    private var songPageControl: some View {
        HStack {
            Button("이전") {
                selectedPage = max(1, currentPage - 1)
            }
            .buttonStyle(.borderless)
            .disabled(currentPage == 1)

            Spacer()

            Text("\(currentPage) / \(IOSSongPagePolicy.pageCount(totalItems: songs.count))")
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer()

            Button("다음") {
                selectedPage = min(IOSSongPagePolicy.pageCount(totalItems: songs.count), currentPage + 1)
            }
            .buttonStyle(.borderless)
            .disabled(currentPage == IOSSongPagePolicy.pageCount(totalItems: songs.count))
        }
    }
}

struct SongRow: View {
    let song: SongCatalogItem
    let catalogMembers: [HubMember]

    var body: some View {
        let displayText = IOSSongPagePolicy.displayText(for: song, catalogMembers: catalogMembers)
        Link(destination: URL(string: song.youtubeUrl) ?? URL(string: "https://www.youtube.com")!) {
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
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color(.secondarySystemGroupedBackground))
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }
}

private struct SongMemberFilterView: View {
    let filters: [SongFilterOption]
    @Binding var selectedMemberId: String
    @Binding var selectedPage: Int
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List(filters) { filter in
            Button {
                selectedMemberId = filter.id
                selectedPage = 1
                dismiss()
            } label: {
                HStack {
                    Text(filter.label)
                    Spacer()
                    if selectedMemberId == filter.id {
                        Image(systemName: "checkmark")
                    }
                }
            }
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
