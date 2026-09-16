import SwiftUI
import UIKit

struct SongDetailSheet: View {
    let fallback: SongCatalogItem
    let onMemberFilter: (String) -> Void
    let onAllMembersFilter: (SongCatalogItem) -> Void
    let onSameTypeFilter: (SongCatalogItem) -> Void

    @EnvironmentObject private var serverStore: ServerHubStore
    @EnvironmentObject private var favoritesStore: SongFavoritesStore
    @EnvironmentObject private var discoveryStore: SongDiscoveryStore
    @EnvironmentObject private var songOpenPreferenceStore: SongOpenPreferenceStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var song: SongCatalogItem
    @State private var isOpenFailurePresented = false

    init(
        song: SongCatalogItem,
        onMemberFilter: @escaping (String) -> Void,
        onAllMembersFilter: @escaping (SongCatalogItem) -> Void,
        onSameTypeFilter: @escaping (SongCatalogItem) -> Void
    ) {
        fallback = song
        _song = State(initialValue: song)
        self.onMemberFilter = onMemberFilter
        self.onAllMembersFilter = onAllMembersFilter
        self.onSameTypeFilter = onSameTypeFilter
    }

    var body: some View {
        NavigationStack {
            List {
                Section("동작") {
                    actionButton(
                        songOpenPreferenceStore.target.openButtonTitle,
                        systemImage: "play.rectangle",
                        url: SongLinkPolicy.videoURL(for: song, target: songOpenPreferenceStore.target)
                    ) { openSongURL($0) }
                    if let url = SongLinkPolicy.videoURL(for: song) {
                        ShareLink(item: url) {
                            Label("링크 공유", systemImage: "square.and.arrow.up")
                        }
                        .songDetailActionRow()
                        Button {
                            UIPasteboard.general.url = url
                            UIAccessibility.post(notification: .announcement, argument: "링크를 복사했습니다")
                        } label: {
                            Label("링크 복사", systemImage: "doc.on.doc")
                        }
                        .songDetailActionRow()
                    } else {
                        disabledAction("링크 공유", systemImage: "square.and.arrow.up")
                        disabledAction("링크 복사", systemImage: "doc.on.doc")
                    }
                    Button {
                        favoritesStore.toggle(song)
                    } label: {
                        Label(
                            favoritesStore.contains(song) ? "즐겨찾기 해제" : "즐겨찾기 추가",
                            systemImage: favoritesStore.contains(song) ? "star.fill" : "star"
                        )
                    }
                    .songDetailActionRow()
                }

                Section {
                    Text(IOSSongPagePolicy.titleDisplayText(song))
                        .font(.title3.weight(.semibold))
                        .accessibilityAddTraits(.isHeader)
                    ForEach(SongDetailPolicy.rows(for: song)) { row in
                        LabeledContent(row.label, value: row.value)
                    }
                }

                Section("관련 노래") {
                    ForEach(song.members, id: \.id) { member in
                        Button("\(member.nameKo) 참여곡 보기") {
                            onMemberFilter(member.id)
                            dismiss()
                        }
                        .songDetailActionRow()
                    }
                    if song.members.count > 1 {
                        Button("참여 멤버 모두 포함") {
                            onAllMembersFilter(song)
                            dismiss()
                        }
                        .songDetailActionRow()
                    }
                    Button("같은 종류 보기") {
                        onSameTypeFilter(song)
                        dismiss()
                    }
                    .songDetailActionRow()
                }

                if !song.sourcePlaylists.isEmpty {
                    Section("원본 플레이리스트") {
                        ForEach(song.sourcePlaylists, id: \.youtubePlaylistId) { playlist in
                            if let url = SongLinkPolicy.playlistURL(id: playlist.youtubePlaylistId) {
                                Link(destination: url) {
                                    LabeledContent(
                                        playlist.title,
                                        value: playlist.isPrimary ? "기본" : playlist.type
                                    )
                                    .frame(minHeight: 44)
                                }
                                .accessibilityHint("YouTube 플레이리스트를 엽니다")
                            }
                        }
                    }
                }
            }
            .navigationTitle("곡 상세")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") { dismiss() }
                }
            }
            .task {
                discoveryStore.acknowledge([fallback], catalog: serverStore.serverSongs)
                song = await serverStore.loadSongDetail(id: fallback.id, fallback: fallback)
            }
            .alert("링크를 열 수 없습니다", isPresented: $isOpenFailurePresented) {
                Button("확인", role: .cancel) {}
            } message: {
                Text("이 링크를 처리할 수 있는 앱을 찾지 못했습니다.")
            }
        }
    }

    private func openSongURL(_ url: URL) {
        openURL(url) { accepted in
            if !accepted { isOpenFailurePresented = true }
        }
    }

    @ViewBuilder
    private func actionButton(
        _ title: String,
        systemImage: String,
        url: URL?,
        action: @escaping (URL) -> Void
    ) -> some View {
        if let url {
            Button { action(url) } label: {
                Label(title, systemImage: systemImage)
            }
            .songDetailActionRow()
            .accessibilityLabel(title)
        } else {
            disabledAction(title, systemImage: systemImage)
        }
    }

    private func disabledAction(_ title: String, systemImage: String) -> some View {
        Label(title, systemImage: systemImage)
            .foregroundStyle(.secondary)
            .accessibilityLabel("\(title), \(SongLinkPolicy.unavailableReason)")
            .songDetailActionRow()
    }
}

private extension View {
    func songDetailActionRow() -> some View {
        frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
            .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
    }
}
