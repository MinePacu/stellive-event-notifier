import SwiftUI

private enum HubEventDetailColors {
    static let background = Color(.systemGroupedBackground)
    static let card = Color(.secondarySystemGroupedBackground)
    static let text = Color(.label)
    static let muted = Color(.secondaryLabel)
    static let line = Color(.separator)
}

struct HubEventDetailView: View {
    let event: HubEvent
    @State private var showCollapsedTitle = false

    var body: some View {
        ZStack(alignment: .top) {
            HubEventDetailColors.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    hero
                    VStack(spacing: 14) {
                        detailSection(HubEventDetailFormatting.summaryLabel) {
                            summaryCard
                        }
                        detailSection("행사 정보") {
                            infoCard
                        }
                        noticeCard
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 18)
                    .padding(.bottom, 28)
                }
                .padding(.top, -36)
                .frame(width: UIScreen.main.bounds.width)
            }
            .simultaneousGesture(DragGesture(minimumDistance: 12).onChanged { value in
                withAnimation(.easeInOut(duration: 0.16)) {
                    if value.translation.height < -18 {
                        showCollapsedTitle = true
                    } else if value.translation.height > 18 {
                        showCollapsedTitle = false
                    }
                }
            })
            .ignoresSafeArea(edges: .top)
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .principal) {
                collapsedTitleBar
                    .opacity(showCollapsedTitle ? 1 : 0)
                    .accessibilityHidden(!showCollapsedTitle)
            }
        }
    }

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            HubEventHeroImage(url: HubEventImagePolicy.displayURL(for: event.image))
            LinearGradient(
                colors: [.clear, .black.opacity(0.46)],
                startPoint: .center,
                endPoint: .bottom
            )
            VStack(alignment: .leading, spacing: 10) {
                Text(event.category.displayName)
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.white.opacity(0.18), in: Capsule())
            Text(event.title)
                .font(.system(size: 25, weight: .bold))
                .lineLimit(3)
                .minimumScaleFactor(0.84)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: UIScreen.main.bounds.width - 36, alignment: .leading)
                Text(heroSubtitle)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.84))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.22), radius: 12, y: 4)
            .padding(.horizontal, 18)
            .padding(.bottom, 10)
        }
        .frame(width: UIScreen.main.bounds.width, height: 390)
        .clipped()
        .ignoresSafeArea(edges: .top)
    }

    private var collapsedTitleBar: some View {
        VStack(spacing: 2) {
            Text(event.title)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .truncationMode(.tail)
                .minimumScaleFactor(0.82)
            Text("상세")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(0.72))
        }
        .foregroundStyle(.white.opacity(0.88))
        .frame(maxWidth: 240)
    }

    private func detailSection<Content: View>(
        _ title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(HubEventDetailColors.muted)
                .padding(.horizontal, 2)
            content()
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                HubEventStatusBadge(status: event.status)
                Spacer()
                Text(HubEventDetailFormatting.statusTimingText(for: event))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color.orange)
            }
            Text(event.summary?.isEmpty == false ? event.summary! : "공식 출처 기반 굿즈/행사 정보입니다.")
                .font(.subheadline)
                .foregroundStyle(HubEventDetailColors.muted)
                .lineSpacing(3)
            ctaRow
        }
        .padding(17)
        .background(HubEventDetailColors.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var ctaRow: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            Button("캘린더 추가") {}
                .buttonStyle(HubEventCTAButtonStyle(primary: true))
            if let ticketUrl = url(from: event.ticketUrl) {
                Link("티켓 링크", destination: ticketUrl)
                    .buttonStyle(HubEventCTAButtonStyle(primary: false))
            } else if let purchaseUrl = url(from: event.purchaseUrl) {
                Link("구매 링크", destination: purchaseUrl)
                    .buttonStyle(HubEventCTAButtonStyle(primary: false))
            } else if let sourceUrl = url(from: event.sourceUrl) {
                Link("출처 열기", destination: sourceUrl)
                    .buttonStyle(HubEventCTAButtonStyle(primary: false))
            }
        }
        .padding(.top, 5)
    }

    private var infoCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(HubEventDetailFormatting.rows(for: event).enumerated()), id: \.offset) { index, row in
                if index > 0 {
                    Divider()
                }
                HStack(alignment: .top, spacing: 12) {
                    Text(row.label)
                        .font(.footnote)
                        .foregroundStyle(HubEventDetailColors.muted)
                        .frame(width: 72, alignment: .leading)
                    Text(row.value)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(HubEventDetailColors.text)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.vertical, 12)
            }
        }
        .padding(16)
        .background(HubEventDetailColors.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var noticeCard: some View {
        Text(HubEventDetailFormatting.noticeText)
            .font(.footnote)
            .foregroundStyle(HubEventDetailColors.muted)
            .lineSpacing(3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(HubEventDetailColors.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var heroSubtitle: String {
        let rows = HubEventDetailFormatting.rows(for: event)
        let venue = rows.first { $0.label == "장소" }?.value
        let period = rows.first { $0.label == "기간" }?.value
        return [venue, period].compactMap { $0 }.joined(separator: " · ")
    }

    private func url(from rawValue: String?) -> URL? {
        guard let rawValue, !rawValue.isEmpty else { return nil }
        return URL(string: rawValue)
    }
}

struct HubEventDetailRow: Equatable {
    let label: String
    let value: String
}

enum HubEventDetailFormatting {
    static let summaryLabel = "핵심 안내"
    static let noticeText = "일정, 장소, 판매/입장 조건은 공식 공지 변경에 따라 달라질 수 있습니다. 앱은 확인용 요약만 제공하므로 참여 전 반드시 출처 링크에서 최신 공지를 확인하세요."

    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        formatter.dateFormat = "yyyy.MM.dd (E) HH:mm"
        return formatter
    }()

    static func rows(for event: HubEvent) -> [HubEventDetailRow] {
        var rows: [HubEventDetailRow] = []
        if let venueName = event.venueName, !venueName.isEmpty {
            rows.append(HubEventDetailRow(label: "장소", value: venueName))
        }
        rows.append(HubEventDetailRow(label: "시작", value: event.startsAt.map(format) ?? "미정"))
        rows.append(HubEventDetailRow(label: "기간", value: periodText(for: event)))
        rows.append(HubEventDetailRow(label: "참여 방식", value: event.participationMode.displayName))
        rows.append(HubEventDetailRow(label: "분류", value: event.category.displayName))
        rows.append(HubEventDetailRow(label: "출처", value: event.sourceLabel))
        return rows
    }

    static func periodText(for event: HubEvent) -> String {
        switch (event.startsAt, event.endsAt) {
        case let (start?, end?):
            return "\(format(start)) - \(format(end))"
        case let (start?, nil):
            return "\(format(start)) 시작 · 종료 미정"
        default:
            return "미정"
        }
    }

    static func statusTimingText(for event: HubEvent) -> String {
        if event.status == .open {
            return "진행 중"
        }
        if event.status == .closingSoon {
            return "마감 임박"
        }
        return event.status.displayName
    }

    static func format(_ date: Date) -> String {
        formatter.string(from: date)
    }
}

private struct HubEventHeroImage: View {
    let url: URL?

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black)
            default:
                fallback
            }
                }
            } else {
                fallback
            }
        }
    }

    private var fallback: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.21, green: 0.31, blue: 0.39), Color(red: 0.06, green: 0.17, blue: 0.21), Color(red: 0.06, green: 0.08, blue: 0.09)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Circle()
                .fill(.white.opacity(0.18))
                .frame(width: 94, height: 94)
                .offset(x: -110, y: -70)
            RoundedRectangle(cornerRadius: 40, style: .continuous)
                .fill(.white.opacity(0.13))
                .frame(width: 260, height: 150)
                .rotationEffect(.degrees(-8))
                .offset(x: 86, y: 86)
        }
    }
}

private struct HubEventStatusBadge: View {
    let status: HubEventStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption.weight(.bold))
            .foregroundStyle(Color(red: 0.08, green: 0.44, blue: 0.33))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(red: 0.08, green: 0.44, blue: 0.33).opacity(0.1), in: Capsule())
    }
}

private struct HubEventCTAButtonStyle: ButtonStyle {
    let primary: Bool

    func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .font(.subheadline.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.82)
                .foregroundStyle(primary ? .white : HubEventDetailColors.text)
                .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(primary ? Color(red: 0.04, green: 0.48, blue: 0.44) : HubEventDetailColors.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(primary ? .clear : HubEventDetailColors.line, lineWidth: 1)
            }
            .opacity(configuration.isPressed ? 0.82 : 1)
    }
}
