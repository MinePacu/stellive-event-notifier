import Foundation

enum ReservationActionPolicy {
    static func kind(for linkKind: HubEventLinkKind, scheduleCancelled: Bool = false) -> ReservationKind? {
        guard !scheduleCancelled else { return nil }
        return switch linkKind {
        case .ticket: .ticket
        case .purchase: .purchase
        case .reservation: .reservation
        default: nil
        }
    }
}

enum ReservationDeepLinkPolicy {
    static func route(from url: URL?) -> ReservationRoute? {
        guard let url, url.scheme == "stellivehub", url.host == "reservations" else { return nil }
        let components = url.path.split(separator: "/").map(String.init)
        if components.isEmpty { return .list }
        if components[0] == "new" {
            let value = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "sessionId" }?.value
            return .quickAdd(sessionID: value.flatMap(UUID.init(uuidString:)))
        }
        guard let id = UUID(uuidString: components[0]) else { return nil }
        return components.dropFirst().first == "edit" ? .edit(id) : .detail(id)
    }
}

struct ReservationScheduleWindow: Equatable {
    let startsAt: Date?
    let endsAt: Date?
    let timePrecision: ReservationTimePrecision
    let timezone: String
}

enum ReservationSchedulePolicy {
    /// Picks the official schedule a reservation snapshot stores. Auxiliary items such as
    /// ticket or sales openings never become the record's schedule.
    static func window(event: HubEvent, scheduleItem: HubEventScheduleItem?) -> ReservationScheduleWindow? {
        if let scheduleItem, scheduleItem.kind == .mainWindow {
            return window(from: scheduleItem)
        }
        if let primary = event.scheduleItems.first(where: { $0.isPrimary && $0.cancelledAt == nil }) {
            return window(from: primary)
        }
        guard event.startsAt != nil || event.endsAt != nil else { return nil }
        return ReservationScheduleWindow(
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            timePrecision: .datetime,
            timezone: ReservationEventSnapshot.defaultTimezone
        )
    }

    static func linkedScheduleItem(record: ReservationRecord, in event: HubEvent) -> HubEventScheduleItem? {
        guard let id = record.scheduleItemID else { return nil }
        return event.scheduleItems.first { $0.id == id }
    }

    private static func window(from item: HubEventScheduleItem) -> ReservationScheduleWindow {
        ReservationScheduleWindow(
            startsAt: item.startsAt,
            endsAt: item.endsAt,
            timePrecision: item.timePrecision == .date ? .date : .datetime,
            timezone: item.timezone
        )
    }
}

enum ReservationDisplayPolicy {
    static func officialEventChanged(record: ReservationRecord, latestEvent: HubEvent?) -> Bool {
        guard let latestEvent else { return false }
        let window = ReservationSchedulePolicy.window(
            event: latestEvent,
            scheduleItem: ReservationSchedulePolicy.linkedScheduleItem(record: record, in: latestEvent)
        )
        return latestEvent.title != record.eventSnapshot.title ||
            window?.startsAt != record.eventSnapshot.startsAt ||
            window?.endsAt != record.eventSnapshot.endsAt ||
            latestEvent.venueName != record.eventSnapshot.venueName
    }

    static func officialEventCancelled(record: ReservationRecord, latestEvent: HubEvent?) -> Bool {
        guard let latestEvent else { return false }
        if latestEvent.status == .cancelled { return true }
        guard let item = ReservationSchedulePolicy.linkedScheduleItem(record: record, in: latestEvent) else { return false }
        return item.kind == .mainWindow && item.cancelledAt != nil
    }

    static func linkedEventTitle(record: ReservationRecord) -> String? {
        guard record.eventID != nil else { return nil }
        return ReservationTextPolicy.nonEmpty(record.eventSnapshot.title)
    }

    static func linkedScheduleLabel(
        record: ReservationRecord,
        format: (Date) -> String
    ) -> String? {
        guard record.scheduleItemID != nil, let startsAt = record.eventSnapshot.startsAt else { return nil }
        return format(startsAt)
    }
}

enum ReservationListSectionKind {
    case upcoming
    case past
}

struct ReservationListSections: Equatable {
    let upcoming: [ReservationRecord]
    let past: [ReservationRecord]
}

enum ReservationListPolicy {
    static func sections(records: [ReservationRecord], now: Date) -> ReservationListSections {
        var upcoming: [ReservationRecord] = []
        var past: [ReservationRecord] = []
        for record in records {
            if isUpcoming(record, now: now) { upcoming.append(record) } else { past.append(record) }
        }
        return ReservationListSections(
            upcoming: upcoming.sorted { ($0.effectiveStartsAt ?? .distantFuture) < ($1.effectiveStartsAt ?? .distantFuture) },
            past: past.sorted { ($0.effectiveStartsAt ?? $0.updatedAt) > ($1.effectiveStartsAt ?? $1.updatedAt) }
        )
    }

    static func isUpcoming(_ record: ReservationRecord, now: Date) -> Bool {
        switch record.status {
        case .cancelled, .refunded, .completed:
            return false
        case .confirmed, .pendingConfirmation:
            break
        }
        let snapshot = record.eventSnapshot
        let reference: Date
        let isSnapshotValue: Bool
        if let value = record.endsAtOverride {
            (reference, isSnapshotValue) = (value, false)
        } else if let value = snapshot.endsAt {
            (reference, isSnapshotValue) = (value, true)
        } else if let value = record.startsAtOverride {
            (reference, isSnapshotValue) = (value, false)
        } else if let value = snapshot.startsAt {
            (reference, isSnapshotValue) = (value, true)
        } else {
            return true
        }
        guard isSnapshotValue, snapshot.resolvedTimePrecision == .date else { return now < reference }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = snapshot.resolvedTimeZone
        let startOfDay = calendar.startOfDay(for: reference)
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else { return now < reference }
        return now < endOfDay
    }
}

enum ReservationDateDisplayPolicy {
    /// True when the record's displayed start comes from a date-only snapshot (no user override).
    static func startIsDateOnly(_ record: ReservationRecord) -> Bool {
        record.startsAtOverride == nil && record.eventSnapshot.resolvedTimePrecision == .date
    }

    static func text(
        _ date: Date,
        dateOnly: Bool,
        timeZone: TimeZone,
        dateStyle: Date.FormatStyle.DateStyle,
        locale: Locale = .autoupdatingCurrent
    ) -> String {
        guard dateOnly else { return date.formatted(date: dateStyle, time: .shortened) }
        return date.formatted(Date.FormatStyle(date: dateStyle, time: .omitted, locale: locale, timeZone: timeZone))
    }

    static func startText(
        record: ReservationRecord,
        _ date: Date,
        dateStyle: Date.FormatStyle.DateStyle
    ) -> String {
        text(
            date,
            dateOnly: startIsDateOnly(record),
            timeZone: record.eventSnapshot.resolvedTimeZone,
            dateStyle: dateStyle
        )
    }

    static func snapshotText(
        snapshot: ReservationEventSnapshot,
        _ date: Date,
        dateStyle: Date.FormatStyle.DateStyle
    ) -> String {
        text(
            date,
            dateOnly: snapshot.resolvedTimePrecision == .date,
            timeZone: snapshot.resolvedTimeZone,
            dateStyle: dateStyle
        )
    }
}

enum ReservationListPresentationPolicy {
    static func timestampLabel(
        record: ReservationRecord,
        section: ReservationListSectionKind,
        format: (Date) -> String
    ) -> String? {
        let timestamp: Date?
        switch section {
        case .upcoming:
            timestamp = record.effectiveStartsAt
        case .past:
            timestamp = record.createdAt
        }
        guard let timestamp else { return nil }
        let formatted = format(timestamp)
        switch section {
        case .upcoming:
            return formatted
        case .past:
            return "저장 시각 · \(formatted)"
        }
    }
}

struct ReservationEditInitialValues: Equatable {
    let title: String
    let startsAt: Date?
    let endsAt: Date?
    let venue: String
}

enum ReservationEditPresentationPolicy {
    static func initialValues(record: ReservationRecord) -> ReservationEditInitialValues {
        ReservationEditInitialValues(
            title: record.displayTitle,
            startsAt: record.effectiveStartsAt,
            endsAt: record.effectiveEndsAt,
            venue: record.effectiveVenue ?? ""
        )
    }

    static func editableRecord(_ record: ReservationRecord) -> ReservationRecord {
        let values = initialValues(record: record)
        var editable = record
        editable.displayTitleOverride = values.title
        editable.startsAtOverride = values.startsAt
        editable.endsAtOverride = values.endsAt
        editable.venueOverride = values.venue
        return editable
    }

    static func normalizedRecord(_ record: ReservationRecord) -> ReservationRecord {
        var normalized = record
        let title = ReservationTextPolicy.nonEmpty(record.displayTitleOverride)
        let venue = ReservationTextPolicy.nonEmpty(record.venueOverride)
        normalized.displayTitleOverride = title == record.eventSnapshot.title ? nil : title
        normalized.startsAtOverride = record.startsAtOverride == record.eventSnapshot.startsAt ? nil : record.startsAtOverride
        normalized.endsAtOverride = record.endsAtOverride == record.eventSnapshot.endsAt ? nil : record.endsAtOverride
        normalized.venueOverride = venue == record.eventSnapshot.venueName ? nil : venue
        return normalized
    }
}

enum ReservationHelpPage: Equatable {
    case list
    case detail
}

enum ReservationHelpAction: Hashable {
    case viewPending
    case addWithoutLink
    case viewUpcoming
    case editCurrentRecord
    case viewExistingRecord
}

enum ReservationHelpTone: Equatable {
    case normal
    case info
    case warning
    case security
    case danger
}

enum ReservationHelpSectionID: Hashable {
    case pendingDraft
    case linklessAdd
    case listGroups
    case localStorage
    case detailActions
    case linkPriority
    case userOverrides
    case officialEvent
    case deleteWarning
}

enum ReservationHelpFAQID: Hashable {
    case returnPromptMissing
    case detailLinkMissing
    case duplicateLink
    case sensitiveLink
    case officialEventCancelled
}

struct ReservationHelpStep: Equatable {
    let number: Int
    let title: String
    let body: String
}

struct ReservationHelpSection: Equatable {
    let id: ReservationHelpSectionID
    let tone: ReservationHelpTone
    let title: String
    let body: String
    let points: [String]
    let action: ReservationHelpAction?

    init(
        id: ReservationHelpSectionID,
        tone: ReservationHelpTone,
        title: String,
        body: String,
        points: [String] = [],
        action: ReservationHelpAction? = nil
    ) {
        self.id = id
        self.tone = tone
        self.title = title
        self.body = body
        self.points = points
        self.action = action
    }
}

struct ReservationHelpFAQ: Equatable {
    let id: ReservationHelpFAQID
    let tone: ReservationHelpTone
    let question: String
    let answer: String
    let action: ReservationHelpAction?
}

struct ReservationHelpContent: Equatable {
    let title: String
    let summary: String
    let steps: [ReservationHelpStep]
    let sections: [ReservationHelpSection]
    let faqs: [ReservationHelpFAQ]
}

struct ReservationHelpContext: Equatable {
    let activeDraftCount: Int
    let earliestDraftExpiresAt: Date?
    let firstDraftSessionID: UUID?
    let hasRecords: Bool
    let hasUpcomingRecords: Bool
    let currentRecordID: UUID?
    let existingRecordID: UUID?
}

enum ReservationHelpStatusKind: Equatable {
    case gettingStarted
    case pending
    case manageRecords
}

struct ReservationHelpStatusPresentation: Equatable {
    let kind: ReservationHelpStatusKind
    let tone: ReservationHelpTone
    let activeDraftCount: Int
    let expiry: ReservationDraftExpiryPresentation?
    let action: ReservationHelpAction?
}

struct ReservationHelpPresentation: Equatable {
    let content: ReservationHelpContent
    let status: ReservationHelpStatusPresentation?
}

enum ReservationHelpContextPolicy {
    static func context(
        drafts: [ReservationDraft],
        records: [ReservationRecord],
        currentRecordID: UUID? = nil,
        existingRecordID: UUID? = nil,
        now: Date = Date()
    ) -> ReservationHelpContext {
        let activeDrafts = ReservationDraftPolicy.active(drafts, now: now)
        let hasUpcomingRecords = records.contains { ReservationListPolicy.isUpcoming($0, now: now) }
        let earliest = activeDrafts.min { $0.expiresAt < $1.expiresAt }
        return ReservationHelpContext(
            activeDraftCount: activeDrafts.count,
            earliestDraftExpiresAt: earliest?.expiresAt,
            firstDraftSessionID: earliest?.sessionID,
            hasRecords: !records.isEmpty,
            hasUpcomingRecords: hasUpcomingRecords,
            currentRecordID: currentRecordID.flatMap { id in records.contains { $0.id == id } ? id : nil },
            existingRecordID: existingRecordID.flatMap { id in records.contains { $0.id == id } ? id : nil }
        )
    }
}

enum ReservationHelpPolicy {
    static func content(_ page: ReservationHelpPage) -> ReservationHelpContent {
        switch page {
        case .list:
            return ReservationHelpContent(
                title: String(localized: "reservation_help_list_title"),
                summary: String(localized: "reservation_help_list_summary"),
                steps: [
                    ReservationHelpStep(
                        number: 1,
                        title: String(localized: "reservation_help_step_open_title"),
                        body: String(localized: "reservation_help_step_open_body")
                    ),
                    ReservationHelpStep(
                        number: 2,
                        title: String(localized: "reservation_help_step_external_title"),
                        body: String(localized: "reservation_help_step_external_body")
                    ),
                    ReservationHelpStep(
                        number: 3,
                        title: String(localized: "reservation_help_step_add_title"),
                        body: String(localized: "reservation_help_step_add_body")
                    )
                ],
                sections: [
                    ReservationHelpSection(
                        id: .pendingDraft,
                        tone: .warning,
                        title: String(localized: "reservation_help_pending_title"),
                        body: String(localized: "reservation_help_pending_body"),
                        points: [String(localized: "reservation_help_pending_point")],
                        action: .viewPending
                    ),
                    ReservationHelpSection(
                        id: .linklessAdd,
                        tone: .info,
                        title: String(localized: "reservation_help_linkless_title"),
                        body: String(localized: "reservation_help_linkless_body"),
                        action: .addWithoutLink
                    ),
                    ReservationHelpSection(
                        id: .listGroups,
                        tone: .normal,
                        title: String(localized: "reservation_help_groups_title"),
                        body: String(localized: "reservation_help_groups_body"),
                        points: [String(localized: "reservation_help_groups_point")],
                        action: .viewUpcoming
                    ),
                    ReservationHelpSection(
                        id: .localStorage,
                        tone: .security,
                        title: String(localized: "reservation_help_storage_title"),
                        body: String(localized: "reservation_help_storage_body"),
                        points: [String(localized: "reservation_help_storage_point")]
                    )
                ],
                faqs: [
                    ReservationHelpFAQ(
                        id: .returnPromptMissing,
                        tone: .warning,
                        question: String(localized: "reservation_help_faq_return_question"),
                        answer: String(localized: "reservation_help_faq_return_answer"),
                        action: .viewPending
                    ),
                    ReservationHelpFAQ(
                        id: .detailLinkMissing,
                        tone: .info,
                        question: String(localized: "reservation_help_faq_link_question"),
                        answer: String(localized: "reservation_help_faq_link_answer"),
                        action: .addWithoutLink
                    ),
                    ReservationHelpFAQ(
                        id: .duplicateLink,
                        tone: .warning,
                        question: String(localized: "reservation_help_faq_duplicate_question"),
                        answer: String(localized: "reservation_help_faq_duplicate_answer"),
                        action: .viewExistingRecord
                    ),
                    ReservationHelpFAQ(
                        id: .sensitiveLink,
                        tone: .security,
                        question: String(localized: "reservation_help_faq_sensitive_question"),
                        answer: String(localized: "reservation_help_faq_sensitive_answer"),
                        action: nil
                    ),
                    ReservationHelpFAQ(
                        id: .officialEventCancelled,
                        tone: .warning,
                        question: String(localized: "reservation_help_faq_cancelled_question"),
                        answer: String(localized: "reservation_help_faq_cancelled_answer"),
                        action: nil
                    )
                ]
            )
        case .detail:
            return ReservationHelpContent(
                title: String(localized: "reservation_help_detail_title"),
                summary: String(localized: "reservation_help_detail_summary"),
                steps: [],
                sections: [
                    ReservationHelpSection(
                        id: .detailActions,
                        tone: .info,
                        title: String(localized: "reservation_help_detail_actions_title"),
                        body: String(localized: "reservation_help_detail_actions_body"),
                        points: [
                            String(localized: "reservation_help_detail_actions_link"),
                            String(localized: "reservation_help_detail_actions_edit"),
                            String(localized: "reservation_help_detail_actions_notes"),
                        ],
                        action: .editCurrentRecord
                    ),
                    ReservationHelpSection(
                        id: .linkPriority,
                        tone: .normal,
                        title: String(localized: "reservation_help_link_priority_title"),
                        body: String(localized: "reservation_help_link_priority_body")
                    ),
                    ReservationHelpSection(
                        id: .userOverrides,
                        tone: .info,
                        title: String(localized: "reservation_help_overrides_title"),
                        body: String(localized: "reservation_help_overrides_body")
                    ),
                    ReservationHelpSection(
                        id: .officialEvent,
                        tone: .warning,
                        title: String(localized: "reservation_help_official_title"),
                        body: String(localized: "reservation_help_official_body")
                    ),
                    ReservationHelpSection(
                        id: .deleteWarning,
                        tone: .danger,
                        title: String(localized: "reservation_help_delete_title"),
                        body: String(localized: "reservation_help_delete_body")
                    )
                ],
                faqs: []
            )
        }
    }

    static func presentation(
        _ page: ReservationHelpPage,
        context: ReservationHelpContext,
        now: Date = Date()
    ) -> ReservationHelpPresentation {
        let base = content(page)
        let filtered = ReservationHelpContent(
            title: base.title,
            summary: base.summary,
            steps: base.steps,
            sections: base.sections.map { section in
                ReservationHelpSection(
                    id: section.id,
                    tone: section.tone,
                    title: section.title,
                    body: section.body,
                    points: section.points,
                    action: section.action.flatMap { isActionAvailable($0, context: context) ? $0 : nil }
                )
            },
            faqs: base.faqs.map { faq in
                ReservationHelpFAQ(
                    id: faq.id,
                    tone: faq.tone,
                    question: faq.question,
                    answer: faq.answer,
                    action: faq.action.flatMap { isActionAvailable($0, context: context) ? $0 : nil }
                )
            }
        )
        let status: ReservationHelpStatusPresentation?
        if page == .list {
            if context.activeDraftCount > 0 {
                status = ReservationHelpStatusPresentation(
                    kind: .pending,
                    tone: .warning,
                    activeDraftCount: context.activeDraftCount,
                    expiry: context.earliestDraftExpiresAt.flatMap {
                        ReservationDraftExpiryPresentationPolicy.presentation(expiresAt: $0, now: now)
                    },
                    action: .viewPending
                )
            } else if context.hasRecords {
                status = ReservationHelpStatusPresentation(
                    kind: .manageRecords,
                    tone: .info,
                    activeDraftCount: 0,
                    expiry: nil,
                    action: context.hasUpcomingRecords ? .viewUpcoming : nil
                )
            } else {
                status = ReservationHelpStatusPresentation(
                    kind: .gettingStarted,
                    tone: .info,
                    activeDraftCount: 0,
                    expiry: nil,
                    action: nil
                )
            }
        } else {
            status = nil
        }
        return ReservationHelpPresentation(content: filtered, status: status)
    }

    static func isActionAvailable(_ action: ReservationHelpAction, context: ReservationHelpContext) -> Bool {
        switch action {
        case .viewPending, .addWithoutLink:
            return context.activeDraftCount > 0 && context.firstDraftSessionID != nil
        case .viewUpcoming:
            return context.hasUpcomingRecords
        case .editCurrentRecord:
            return context.currentRecordID != nil
        case .viewExistingRecord:
            return context.existingRecordID != nil
        }
    }
}

enum ReservationDraftExpiryKind: Equatable {
    case hours
    case minutes
    case soon
}

struct ReservationDraftExpiryPresentation: Equatable {
    let kind: ReservationDraftExpiryKind
    let value: Int?
}

enum ReservationDraftExpiryPresentationPolicy {
    static func presentation(expiresAt: Date, now: Date = Date()) -> ReservationDraftExpiryPresentation? {
        let remainingSeconds = expiresAt.timeIntervalSince(now)
        guard remainingSeconds > 0 else { return nil }
        if remainingSeconds < 120 {
            return ReservationDraftExpiryPresentation(kind: .soon, value: nil)
        }
        let remainingMinutes = Int(ceil(remainingSeconds / 60))
        if remainingMinutes < 10 {
            return ReservationDraftExpiryPresentation(kind: .minutes, value: remainingMinutes)
        }
        if remainingMinutes < 60 {
            return ReservationDraftExpiryPresentation(kind: .minutes, value: ((remainingMinutes + 4) / 5) * 5)
        }
        return ReservationDraftExpiryPresentation(kind: .hours, value: Int(ceil(remainingSeconds / 3_600)))
    }
}

enum ReservationExternalLinkPolicy {
    static func openFailOpen(
        openExternal: () -> Void,
        recordBestEffort: () throws -> Void,
        onRecordingFailure: () -> Void
    ) {
        openExternal()
        do {
            try recordBestEffort()
        } catch {
            onRecordingFailure()
        }
    }
}

enum ReservationReturnPromptDecision: Equatable {
    case none
    case single(UUID)
    case multiple(Set<UUID>)
}

enum ReservationReturnPromptPolicy {
    static let minimumExternalDuration: TimeInterval = 10

    /// Prompting only snoozes a draft: it is asked about again after a relink or a fresh 10s+ absence.
    static func decision(
        drafts: [ReservationDraft],
        promptedAt: [UUID: Date],
        lastBackgroundedAt: Date?,
        now: Date
    ) -> ReservationReturnPromptDecision {
        let eligible = ReservationDraftPolicy.active(drafts, now: now).filter { draft in
            guard now.timeIntervalSince(draft.openedAt) >= minimumExternalDuration else { return false }
            guard let prompted = promptedAt[draft.sessionID] else { return true }
            if draft.openedAt > prompted { return true }
            if let lastBackgroundedAt,
               lastBackgroundedAt > prompted,
               now.timeIntervalSince(lastBackgroundedAt) >= minimumExternalDuration {
                return true
            }
            return false
        }
        switch eligible.count {
        case 0: return .none
        case 1: return .single(eligible[0].sessionID)
        default: return .multiple(Set(eligible.map(\.sessionID)))
        }
    }
}
