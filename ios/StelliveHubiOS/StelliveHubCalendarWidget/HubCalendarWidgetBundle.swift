import SwiftUI
import WidgetKit

@main
struct HubCalendarWidgetBundle: WidgetBundle {
    var body: some Widget {
        HubCalendarWidget()
    }
}

struct HubCalendarWidget: Widget {
    let kind = "HubCalendarWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HubCalendarTimelineProvider()) { entry in
            HubCalendarWidgetView(entry: entry)
        }
        .configurationDisplayName("굿즈/행사")
        .description("굿즈와 행사 일정을 보여주는 캘린더 위젯")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct HubCalendarTimelineEntry: TimelineEntry {
    let date: Date
    let snapshot: HubCalendarWidgetSnapshot?
}

struct HubCalendarTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> HubCalendarTimelineEntry {
        HubCalendarTimelineEntry(date: Date(), snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (HubCalendarTimelineEntry) -> Void) {
        completion(HubCalendarTimelineEntry(date: Date(), snapshot: loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HubCalendarTimelineEntry>) -> Void) {
        let entry = HubCalendarTimelineEntry(date: Date(), snapshot: loadSnapshot())
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(6 * 60 * 60))))
    }

    private func loadSnapshot() -> HubCalendarWidgetSnapshot? {
        try? HubCalendarWidgetStore.loadFromSharedContainer()
    }
}

struct HubCalendarWidgetView: View {
    let entry: HubCalendarTimelineEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("굿즈/행사")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            if let first = entry.snapshot?.entries.first {
                Text(first.title)
                    .font(.headline)
                    .lineLimit(2)
                    Text("\(HubCalendarPolicy.entryLabel(first)) · \(first.displayDate) · \(first.displayTimeText)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            } else {
                Text(HubCalendarPolicy.emptyWidgetText)
                    .font(.headline)
                    .lineLimit(2)
            }

            Spacer(minLength: 0)
        }
        .padding()
        .background(Color(.systemBackground))
        .widgetURL(widgetDeepLink)
    }

    private var widgetDeepLink: URL? {
        guard
            let first = entry.snapshot?.entries.first,
            HubCalendarDeepLinkPolicy.canNavigateToDetail(first)
        else {
            return nil
        }

        return URL(string: first.appDeepLink)
    }
}
