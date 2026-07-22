import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@available(iOSApplicationExtension 16.1, *)
struct ReservationLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ReservationActivityAttributes.self) { context in
            HStack(spacing: 12) {
                Image(systemName: "ticket")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.teal)
                VStack(alignment: .leading, spacing: 3) {
                    Text(context.state.title).font(.headline).lineLimit(1)
                    Text("\(ReservationPresentationPolicy.inProgressLabel(context.state.kind)) · \(context.state.providerHost)")
                        .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    Text(context.state.openedAt, style: .timer)
                        .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            }
            .padding()
            .activityBackgroundTint(Color(.secondarySystemBackground))
            .activitySystemActionForegroundColor(.teal)
            .widgetURL(deepLink(sessionID: context.attributes.sessionID))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(ReservationPresentationPolicy.inProgressLabel(context.state.kind), systemImage: "ticket").font(.caption.weight(.semibold))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.openedAt, style: .timer).font(.caption.monospacedDigit())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(context.state.title).font(.headline).lineLimit(1)
                        Text(context.state.providerHost).font(.caption).foregroundStyle(.secondary)
                        HStack(spacing: 10) {
                            if #available(iOSApplicationExtension 17.0, *) {
                                Button(intent: CompleteReservationIntent(sessionID: context.attributes.sessionID)) {
                                    Label(ReservationPresentationPolicy.recordActionLabel(context.state.kind), systemImage: "checkmark.circle")
                                }
                            }
                            Link(destination: deepLink(sessionID: context.attributes.sessionID)) {
                                Label("링크와 함께 추가", systemImage: "link")
                            }
                        }
                        .font(.caption.weight(.semibold))
                    }
                }
            } compactLeading: {
                Image(systemName: "ticket")
            } compactTrailing: {
                Circle().fill(Color.teal).frame(width: 7, height: 7)
            } minimal: {
                Image(systemName: "ticket").foregroundStyle(.teal)
            }
            .widgetURL(deepLink(sessionID: context.attributes.sessionID))
            .keylineTint(.teal)
        }
    }

    private func deepLink(sessionID: UUID) -> URL {
        URL(string: "stellivehub://reservations/new?sessionId=\(sessionID.uuidString)")!
    }
}

@available(iOSApplicationExtension 18.0, *)
struct ReservationControlWidget: ControlWidget {
    static let kind = "dev.minepacu.stelliveeventnotifier.reservation-control"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind, provider: ReservationControlValueProvider()) { value in
            ControlWidgetButton(action: OpenURLIntent(value.deepLink)) {
                Label(value.label, systemImage: value.draftCount == 0 ? "ticket" : "ticket.fill")
            }
        }
        .displayName("최근 예약·구매 내역 추가")
        .description("앱에서 연 예매·구매·예약 링크의 내역을 추가합니다.")
    }
}

@available(iOSApplicationExtension 18.0, *)
private struct ReservationControlValue: Codable, Hashable, Sendable {
    let sessionID: UUID?
    let draftCount: Int
    let kind: ReservationKind?

    var label: String {
        ReservationPresentationPolicy.systemShortcutLabel(draftCount: draftCount, kind: kind)
    }

    var deepLink: URL {
        if draftCount == 1, let sessionID {
            return URL(string: "stellivehub://reservations/new?sessionId=\(sessionID.uuidString)")!
        }
        return URL(string: "stellivehub://reservations/new")!
    }
}

@available(iOSApplicationExtension 18.0, *)
private struct ReservationControlValueProvider: ControlValueProvider {
    var previewValue: ReservationControlValue { .init(sessionID: nil, draftCount: 0, kind: nil) }

    func currentValue() async throws -> ReservationControlValue {
        guard let store = try? ReservationSharedStore() else { return previewValue }
        let drafts = (try? store.loadState().drafts) ?? []
        let active = drafts.filter { $0.expiresAt > Date() }.sorted { $0.openedAt > $1.openedAt }
        return ReservationControlValue(
            sessionID: active.count == 1 ? active[0].sessionID : nil,
            draftCount: active.count,
            kind: active.count == 1 ? active[0].kind : nil
        )
    }
}
