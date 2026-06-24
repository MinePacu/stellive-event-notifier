import SwiftUI

struct SongsView: View {
    @EnvironmentObject private var store: MockHubStore
    @EnvironmentObject private var serverStore: ServerHubStore
    @State private var path = NavigationPath()
    @State private var selectedGenerationId = "all"
    @State private var selectedType = "all"
    @State private var query = ""
    @State private var selectedPage = 1

    private var memberGenerationById: [String: String] {
        Dictionary(uniqueKeysWithValues: store.members.map { ($0.id, $0.generationId) })
    }

    private var songs: [SongCatalogItem] {
        serverStore.songs(
            generationId: "all",
            type: selectedType,
            query: ""
        ).items.filter {
            IOSSongPagePolicy.matchesGeneration($0, selectedGenerationId: selectedGenerationId, memberGenerationById: memberGenerationById) &&
                IOSSongPagePolicy.matchesQuery($0, query: query)
        }
    }

    private var currentPage: Int {
        IOSSongPagePolicy.clampedPage(selectedPage, totalItems: songs.count)
    }

    private var pagedSongs: [SongCatalogItem] {
        IOSSongPagePolicy.pageItems(songs, page: currentPage)
    }

    private var facets: SongFacetsResponse {
        SongFacetsResponse(
            summary: SongFacetSummary(
                total: songs.count,
                original: songs.filter { $0.type == .original }.count,
                cover: songs.filter { $0.type == .cover }.count
            ),
            generationFilters: IOSSongPagePolicy.generationFilters.map {
                SongFilterCount(id: $0.id, label: $0.label, generationId: $0.id == "all" ? nil : $0.id, count: songs.count)
            },
            memberFilters: [],
            typeFilters: IOSSongPagePolicy.typeFilters.map {
                SongFilterCount(id: $0.id, label: $0.label, generationId: nil, count: songs.count)
            }
        )
    }

    var body: some View {
        NavigationStack(path: $path) {
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
                }

                Section("노래 목록") {
                    if songs.isEmpty {
                        Text("표시할 노래 없음")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                    ForEach(pagedSongs) { song in
                        SongRow(song: song)
                            .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
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
            .onChange(of: query) { _ in selectedPage = 1 }
            .refreshable {
                await refreshSongs()
            }
            .task {
                await refreshSongs()
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
            .disabled(currentPage == 1)

            Spacer()

            Text("\(currentPage) / \(IOSSongPagePolicy.pageCount(totalItems: songs.count))")
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer()

            Button("다음") {
                selectedPage = min(IOSSongPagePolicy.pageCount(totalItems: songs.count), currentPage + 1)
            }
            .disabled(currentPage == IOSSongPagePolicy.pageCount(totalItems: songs.count))
        }
    }
}

private struct SongRow: View {
    let song: SongCatalogItem

    var body: some View {
        Link(destination: URL(string: song.youtubeUrl) ?? URL(string: "https://www.youtube.com")!) {
            HStack(alignment: .top, spacing: 12) {
                    SongThumbnailView(urls: IOSSongPagePolicy.thumbnailUrlCandidates(for: song))

                VStack(alignment: .leading, spacing: 6) {
                    Text(song.title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.86)

                    Text([IOSSongPagePolicy.memberDisplayText(song), song.type.displayName].joined(separator: " · "))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)

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
        .frame(width: 96, height: 54)
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
