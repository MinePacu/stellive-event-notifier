import SwiftUI
import UIKit

struct ReservationHelpView: View {
    let page: ReservationHelpPage
    var currentRecordID: UUID? = nil
    var existingRecordID: UUID? = nil
    @EnvironmentObject private var store: ReservationStore
    @Environment(\.dismiss) private var dismiss
    @State private var expandedFAQIDs: Set<ReservationHelpFAQID> = []

    var body: some View {
        let context = ReservationHelpContextPolicy.context(
            drafts: store.activeDrafts,
            records: store.records,
            currentRecordID: currentRecordID,
            existingRecordID: existingRecordID
        )
        let presentation = ReservationHelpPolicy.presentation(page, context: context)
        let content = presentation.content
        List {
            if let status = presentation.status, status.kind != .gettingStarted {
                Section {
                    ReservationHelpStatusRow(status: status)
                        .listRowBackground(status.tone.backgroundColor)
                    if let action = status.action {
                        helpAction(action, context: context)
                    }
                }
            }

            if !content.steps.isEmpty {
                Section {
                    ForEach(content.steps, id: \.number) { step in
                        ReservationHelpStepRow(step: step)
                    }
                } header: {
                    Text(String(localized: "reservation_help_steps_header"))
                } footer: {
                    Text(content.summary)
                }
            }

            ForEach(content.sections, id: \.id) { section in
                Section {
                    ReservationHelpSectionRow(section: section)
                        .listRowBackground(section.tone.backgroundColor)
                    if let action = section.action {
                        helpAction(action, context: context)
                    }
                }
            }

            if !content.faqs.isEmpty {
                Section(String(localized: "reservation_help_faq_header")) {
                    ForEach(content.faqs, id: \.id) { faq in
                        ReservationHelpFAQRow(
                            faq: faq,
                            isExpanded: Binding(
                                get: { expandedFAQIDs.contains(faq.id) },
                                set: { expanded in
                                    if expanded {
                                        expandedFAQIDs.insert(faq.id)
                                    } else {
                                        expandedFAQIDs.remove(faq.id)
                                    }
                                }
                            )
                        )
                        if expandedFAQIDs.contains(faq.id), let action = faq.action {
                            helpAction(action, context: context)
                        }
                    }
                }
            }
        }
        .navigationTitle(content.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func helpAction(_ action: ReservationHelpAction, context: ReservationHelpContext) -> some View {
        switch action {
        case .viewPending:
            Button {
                NotificationCenter.default.post(
                    name: .reservationHelpListFocusRequested,
                    object: ReservationHelpListFocus.pending.rawValue
                )
                dismiss()
            } label: {
                Label(action.localizedLabel, systemImage: action.systemImage)
            }
        case .viewUpcoming:
            Button {
                NotificationCenter.default.post(
                    name: .reservationHelpListFocusRequested,
                    object: ReservationHelpListFocus.upcoming.rawValue
                )
                dismiss()
            } label: {
                Label(action.localizedLabel, systemImage: action.systemImage)
            }
        case .addWithoutLink:
            NavigationLink(value: ReservationRoute.quickAdd(sessionID: context.firstDraftSessionID)) {
                Label(action.localizedLabel, systemImage: action.systemImage)
            }
        case .editCurrentRecord:
            if let id = context.currentRecordID {
                NavigationLink(value: ReservationRoute.edit(id)) {
                    Label(action.localizedLabel, systemImage: action.systemImage)
                }
            }
        case .viewExistingRecord:
            if let id = context.existingRecordID {
                NavigationLink(value: ReservationRoute.detail(id)) {
                    Label(action.localizedLabel, systemImage: action.systemImage)
                }
            }
        }
    }
}

private struct ReservationHelpStepRow: View {
    let step: ReservationHelpStep

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(step.number)")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Color(uiColor: .systemBackground))
                .frame(width: 32, height: 32)
                .background(Color.accentColor, in: Circle())
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(step.title)
                    .font(.headline)
                Text(step.body)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            String(
                format: String(localized: "reservation_help_step_accessibility_format"),
                step.number,
                step.title,
                step.body
            )
        )
    }
}

private struct ReservationHelpSectionRow: View {
    let section: ReservationHelpSection

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: section.tone.systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(section.tone.foregroundColor)
                .frame(width: 24, height: 24)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 7) {
                Text(section.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityLabel("\(section.tone.accessibilityName), \(section.title)")
                Text(section.body)
                    .font(.body)
                    .fixedSize(horizontal: false, vertical: true)
                ForEach(section.points, id: \.self) { point in
                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        Image(systemName: "circle.fill")
                            .font(.system(size: 5))
                            .accessibilityHidden(true)
                        Text(point)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .font(.subheadline)
                }
            }
        }
        .padding(.vertical, 5)
    }
}

private struct ReservationHelpStatusRow: View {
    let status: ReservationHelpStatusPresentation

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: status.tone.systemImage)
                .foregroundStyle(status.tone.foregroundColor)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 5) {
                Text(status.title)
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                Text(status.body)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 5)
    }
}

private struct ReservationHelpFAQRow: View {
    let faq: ReservationHelpFAQ
    @Binding var isExpanded: Bool

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            Text(faq.answer)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.vertical, 6)
        } label: {
            Label {
                Text(faq.question)
                    .font(.body.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
            } icon: {
                Image(systemName: faq.tone.systemImage)
                    .foregroundStyle(faq.tone.foregroundColor)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityHint(
            isExpanded
                ? String(localized: "reservation_help_faq_collapse_hint")
                : String(localized: "reservation_help_faq_expand_hint")
        )
    }
}

private extension ReservationHelpAction {
    var localizedLabel: String {
        switch self {
        case .viewPending: return String(localized: "reservation_action_view_pending")
        case .addWithoutLink: return String(localized: "reservation_action_add_without_link")
        case .viewUpcoming: return String(localized: "reservation_action_view_upcoming")
        case .editCurrentRecord: return String(localized: "reservation_action_edit_record")
        case .viewExistingRecord: return String(localized: "reservation_action_view_existing")
        }
    }

    var systemImage: String {
        switch self {
        case .viewPending: return "clock"
        case .addWithoutLink: return "plus.circle"
        case .viewUpcoming: return "calendar"
        case .editCurrentRecord: return "pencil"
        case .viewExistingRecord: return "doc.text.magnifyingglass"
        }
    }
}

private extension ReservationHelpStatusPresentation {
    var title: String {
        switch kind {
        case .gettingStarted:
            return String(localized: "reservation_help_status_getting_started_title")
        case .pending:
            return String(localized: "reservation_help_status_pending_title")
        case .manageRecords:
            return String(localized: "reservation_help_status_manage_title")
        }
    }

    var body: String {
        switch kind {
        case .gettingStarted:
            return String(localized: "reservation_help_status_getting_started_body")
        case .pending:
            let expiryText = expiry?.localizedText ?? String(localized: "reservation_draft_expiry_soon")
            return String(
                format: String(localized: "reservation_help_status_pending_body_format"),
                activeDraftCount,
                expiryText
            )
        case .manageRecords:
            return String(localized: "reservation_help_status_manage_body")
        }
    }
}

private extension ReservationHelpTone {
    var systemImage: String {
        switch self {
        case .normal: return "info.circle"
        case .info: return "info.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .security: return "lock.shield.fill"
        case .danger: return "trash.fill"
        }
    }

    var accessibilityName: String {
        switch self {
        case .normal: return String(localized: "reservation_help_tone_normal")
        case .info: return String(localized: "reservation_help_tone_info")
        case .warning: return String(localized: "reservation_help_tone_warning")
        case .security: return String(localized: "reservation_help_tone_security")
        case .danger: return String(localized: "reservation_help_tone_danger")
        }
    }

    var foregroundColor: Color {
        switch self {
        case .normal: return .secondary
        case .info, .security: return .accentColor
        case .warning: return .orange
        case .danger: return .red
        }
    }

    var backgroundColor: Color {
        switch self {
        case .normal: return Color.secondary.opacity(0.07)
        case .info, .security: return Color.accentColor.opacity(0.1)
        case .warning: return Color.orange.opacity(0.12)
        case .danger: return Color.red.opacity(0.12)
        }
    }
}
