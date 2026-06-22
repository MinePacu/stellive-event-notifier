import SwiftUI

struct SongsView: View {
    @EnvironmentObject private var store: MockHubStore
    @EnvironmentObject private var serverStore: ServerHubStore
    @State private var path = NavigationPath()
    @State private var selectedGenerationId = "all"
    @State private var selectedType = "all"
    @State private var query = ""

    private var songs: [SongCatalogItem] {
        serverStore.songs(
            generationId: selectedGenerationId,
            type: selectedType,
            query: query
        ).items
    }

    private var facets: SongFacetsResponse {
        serverStore.songFacets(
            generationId: selectedGenerationId,
            type: selectedType,
            query: query
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
                        .init(value: "(facets.summary.total)", label: "전체"),
                        .init(value: "(facets.summary.original)", label: "오리지널"),
                        .init(value: "(facets.summary.cover)", label: "커버")
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
                        ForEach(songs) { song in
                            SongRow(song: song)
                                .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
                                .listRowSeparator(.hidden)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color(uiColor: .systemGroupedBackground))
            .settingsToolbar(path: $path)
            .refreshable {
                await refreshSongs()
            }
            .task {
                await refreshSongs()
            }
        }
    }

    private func refreshSongs() async {
        await serverStore.refreshSongFacets(
            generationId: selectedGenerationId,
            type: selectedType,
            query: query
        )
        await serverStore.refreshSongs(
            generationId: selectedGenerationId,
            type: selectedType,
            query: query
        )
    }
}

private struct SongRow: View {
    let song: SongCatalogItem

    var body: some View {
        Link(destination: URL(string: song.sourceUrl) ?? URL(string: "https://www.youtube.com")!) {
            HStack(alignment: .top, spacing: 12) {
                SongThumbnailView()

                VStack(alignment: .leading, spacing: 6) {
                    Text(song.title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.86)

                    Text([song.memberName, song.generationName, song.type.displayName].joined(separator: " · "))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)

                    Text(song.publishedAt, style: .date)
                        .font(.caption)
                        .foregroundStyle(.secondary)
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
    var body: some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color(.tertiarySystemGroupedBackground))
            .overlay {
                Image(systemName: "play.rectangle.fill")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            .aspectRatio(16.0 / 9.0, contentMode: .fit)
            .frame(width: 96)
            .accessibilityHidden(true)
    }
}
