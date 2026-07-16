import SwiftUI

struct AnnouncementHomeSection: View {
    let announcement: ServiceAnnouncement
    let destination: GlobalToolbarRoute

    var body: some View {
        Section("중요 공지") {
            NavigationLink(value: destination) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(announcement.type.displayName + " · " + announcement.severity.displayName).font(.caption).foregroundStyle(.secondary)
                    Text(announcement.title).font(.headline)
                    Text(announcement.summary).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                    Text(announcement.publishedAt, style: .date).font(.caption).foregroundStyle(.secondary)
                }.padding(.vertical, 4)
            }
        }
    }
}

struct AnnouncementBellLabel: View {
    let unreadCount: Int

    var body: some View {
        Image(systemName: "bell")
            .font(.system(size: 15, weight: .semibold))
            .frame(width: 34, height: 34)
            .overlay(alignment: .topTrailing) {
                if let text = AnnouncementPolicy.badgeText(unreadCount) {
                    Text(text).font(.system(size: 9, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 4).frame(minWidth: 17, minHeight: 17).background(Color.red, in: Capsule())
                }
            }
            .accessibilityLabel(AnnouncementPolicy.accessibilityLabel(unreadCount))
    }
}

struct AnnouncementsView: View {
    @EnvironmentObject private var serverStore: ServerHubStore
    @EnvironmentObject private var readStore: AnnouncementReadStore

    var body: some View {
        List {
            let sorted = AnnouncementPolicy.sorted(serverStore.serviceAnnouncements)
            let pinned = sorted.filter(\.isPinned)
            if !pinned.isEmpty { Section("고정 공지") { ForEach(pinned) { row($0) } } }
            Section("최근 공지") {
                if sorted.filter({ !$0.isPinned }).isEmpty { Text("등록된 공지가 없습니다.").foregroundStyle(.secondary) }
                ForEach(sorted.filter { !$0.isPinned }) { row($0) }
                if serverStore.announcementNextCursor != nil {
                    Button("더 불러오기") { Task { await serverStore.refreshAnnouncements(reset: false) } }
                }
            }
        }
        .navigationTitle("공지사항")
        .refreshable { await serverStore.refreshAnnouncements(reset: true) }
        .task { if serverStore.serviceAnnouncements.isEmpty { await serverStore.refreshAnnouncements(reset: true) } }
    }

    private func row(_ item: ServiceAnnouncement) -> some View {
        let unread = !readStore.readKeys.contains(AnnouncementPolicy.readKey(id: item.id, attentionRevision: item.attentionRevision))
        return NavigationLink(value: GlobalToolbarRoute.announcementDetail(item.id)) {
            VStack(alignment: .leading, spacing: 5) {
                HStack { Text(item.type.displayName + " · " + item.severity.displayName).font(.caption).foregroundStyle(.secondary); if unread { Text("읽지 않음").font(.caption.weight(.semibold)).foregroundStyle(.red) } }
                Text(item.title).font(.headline).lineLimit(2)
                Text(item.summary).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                HStack { Text(item.publishedAt, style: .date); if item.resolvedAt != nil { Text("해결됨") } }.font(.caption).foregroundStyle(.secondary)
            }.padding(.vertical, 3)
        }
    }
}

struct AnnouncementDetailView: View {
    let announcementID: String
    @EnvironmentObject private var serverStore: ServerHubStore
    @EnvironmentObject private var readStore: AnnouncementReadStore
    @Environment(\.openURL) private var openURL

    private var announcement: ServiceAnnouncement? { serverStore.cachedAnnouncement(id: announcementID) }

    var body: some View {
        Group {
            if let announcement {
                List {
                    Section {
                        Text(announcement.type.displayName + " · " + announcement.severity.displayName).font(.subheadline).foregroundStyle(.secondary)
                        Text(announcement.title).font(.title2.weight(.bold))
                        Text("게시 \(announcement.publishedAt.formatted(date: .abbreviated, time: .shortened)) · 수정 \(announcement.updatedAt.formatted(date: .abbreviated, time: .shortened))").font(.caption).foregroundStyle(.secondary)
                    }
                    Section { Text(announcement.body).textSelection(.enabled) }
                    if announcement.resolvedAt != nil { Section { Label("해결됨", systemImage: "checkmark.circle") } }
                    if let label = announcement.actionLabel, let raw = announcement.appDeepLink ?? announcement.externalUrl, let url = URL(string: raw) {
                        Section { Button(label) { openURL(url) } }
                    }
                    if let raw = announcement.externalUrl, let url = URL(string: raw) { Section { Link("외부 링크 열기", destination: url) } }
                }
                .onAppear { readStore.markRead(announcement) }
            } else { ProgressView("공지 불러오는 중") }
        }
        .navigationTitle("공지사항")
        .navigationBarTitleDisplayMode(.inline)
        .task { if announcement == nil { _ = await serverStore.loadAnnouncementDetail(id: announcementID) } }
    }
}
