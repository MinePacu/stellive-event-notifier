import SwiftUI

struct HubEventDetailView: View {
    let event: HubEvent

    var body: some View {
        List {
            Section {
                if let thumbnailURL = HubEventImagePolicy.displayURL(for: event.image) {
                    HubEventRemoteImage(url: thumbnailURL)
                }

                HStack(alignment: .center, spacing: 10) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(event.title)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(.primary)
                            .lineLimit(3)
                            .minimumScaleFactor(0.84)

                        if let summary = event.summary, !summary.isEmpty {
                            Text(summary)
                                .font(.body)
                                .foregroundStyle(.secondary)
                                .lineLimit(nil)
                        }
                    }
                    .layoutPriority(1)

                    Spacer(minLength: 8)

                    HubEventStatusBadge(status: event.status)
                }
                .padding(.vertical, 2)
            }

            Section("정보") {
                LabeledContent("분류", value: event.category.displayName)
                LabeledContent("참여 방식", value: event.participationMode.displayName)
                LabeledContent("출처", value: event.sourceLabel)

                if let venueName = event.venueName, !venueName.isEmpty {
                    LabeledContent("장소", value: venueName)
                }
            }

            Section("링크") {
                if let sourceUrl = url(from: event.sourceUrl) {
                    Link("출처 열기", destination: sourceUrl)
                }
                if let purchaseUrl = url(from: event.purchaseUrl) {
                    Link("구매 링크 열기", destination: purchaseUrl)
                }
                if let ticketUrl = url(from: event.ticketUrl) {
                    Link("티켓 링크 열기", destination: ticketUrl)
                }
            }

            Section {
                Text("공식 이미지, 로고, 포스터는 앱에 저장하거나 재사용하지 않습니다.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("상세")
    }

    private func url(from string: String?) -> URL? {
        guard let string, let url = URL(string: string) else { return nil }
        guard url.scheme?.lowercased() == "https" else { return nil }
        return url
    }
}

private struct HubEventStatusBadge: View {
    let status: HubEventStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption.weight(.semibold))
            .foregroundStyle(status == .closingSoon ? Color.red : Color.teal)
            .lineLimit(HubEventStatusRowLayout.statusLineLimit)
            .minimumScaleFactor(HubEventStatusRowLayout.statusMinimumScaleFactor)
            .multilineTextAlignment(.trailing)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                Capsule()
                    .fill((status == .closingSoon ? Color.red : Color.teal).opacity(0.14))
            )
            .fixedSize(horizontal: HubEventStatusRowLayout.preservesStatusIntrinsicWidth, vertical: false)
    }
}
