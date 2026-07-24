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

enum ReservationDisplayPolicy {
    static func officialEventChanged(record: ReservationRecord, latestEvent: HubEvent?) -> Bool {
        guard let latestEvent else { return false }
        return latestEvent.title != record.eventSnapshot.title ||
            latestEvent.startsAt != record.eventSnapshot.startsAt ||
            latestEvent.endsAt != record.eventSnapshot.endsAt ||
            latestEvent.venueName != record.eventSnapshot.venueName
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

enum ReservationHelpPage {
    case list
    case detail
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

    init(
        id: ReservationHelpSectionID,
        tone: ReservationHelpTone,
        title: String,
        body: String,
        points: [String] = []
    ) {
        self.id = id
        self.tone = tone
        self.title = title
        self.body = body
        self.points = points
    }
}

struct ReservationHelpContent: Equatable {
    let title: String
    let summary: String
    let steps: [ReservationHelpStep]
    let sections: [ReservationHelpSection]
}

enum ReservationHelpPolicy {
    static func content(_ page: ReservationHelpPage) -> ReservationHelpContent {
        switch page {
        case .list:
            return ReservationHelpContent(
                title: "내 예약·구매 도움말",
                summary: "링크를 열 때 생기는 확인 필요 항목은 임시 기록입니다. 앱은 외부 서비스의 실제 완료 여부를 자동으로 확인하지 않으며, 내역으로 추가한 정보는 이 기기에 저장합니다.",
                steps: [
                    ReservationHelpStep(
                        number: 1,
                        title: "굿즈·행사에서 링크 열기",
                        body: "티켓·구매·예약 링크를 엽니다."
                    ),
                    ReservationHelpStep(
                        number: 2,
                        title: "외부 페이지에서 진행",
                        body: "외부 서비스에서 예매·결제·예약을 진행합니다."
                    ),
                    ReservationHelpStep(
                        number: 3,
                        title: "앱으로 돌아와 내역 추가",
                        body: "확인 필요 항목을 내역에 추가합니다. 상세 링크를 찾지 못했다면 링크 없이 추가할 수 있습니다."
                    )
                ],
                sections: [
                    ReservationHelpSection(
                        id: .pendingDraft,
                        tone: .warning,
                        title: "확인 필요는 임시 항목입니다",
                        body: "링크를 열면 확인 필요 항목이 생기며 최대 2시간 동안 유지된 뒤 자동으로 정리됩니다. 앱은 외부 서비스에서 예매·결제·예약이 실제로 완료됐는지 자동 확인하지 않습니다.",
                        points: ["앱 복귀 안내가 보이지 않아도 내 예약·구매의 확인 필요에서 직접 추가할 수 있습니다."]
                    ),
                    ReservationHelpSection(
                        id: .linklessAdd,
                        tone: .info,
                        title: "상세 링크가 없어도 추가할 수 있습니다",
                        body: "외부 페이지에서 상세 링크를 찾지 못했다면 링크 없이 추가를 선택해 상태와 필요한 정보를 직접 기록하세요."
                    ),
                    ReservationHelpSection(
                        id: .listGroups,
                        tone: .normal,
                        title: "예정된 내역과 지난 내역",
                        body: "예매 완료·구매 완료·예약 완료 상태이고 일정이 남은 항목은 예정된 내역에 표시됩니다. 취소·환불·이용 완료 상태이거나 일정이 지난 항목은 지난 내역에 표시됩니다.",
                        points: ["지난 내역에는 내역을 저장한 시각을 표시합니다."]
                    ),
                    ReservationHelpSection(
                        id: .localStorage,
                        tone: .security,
                        title: "내역은 이 기기에만 저장됩니다",
                        body: "정식 내역은 서버로 전송되지 않고 이 기기에만 저장됩니다. 예약 데이터는 백업 대상에서 제외되므로 앱을 삭제하거나 기기를 변경하면 복구되지 않을 수 있습니다.",
                        points: ["예매·주문·예약번호와 민감한 링크를 다른 사람과 공유하지 마세요."]
                    )
                ]
            )
        case .detail:
            return ReservationHelpContent(
                title: "내역 상세 도움말",
                summary: "이 화면에서 저장한 정보를 확인하고 수정하거나 내역 링크를 다시 열 수 있습니다.",
                steps: [],
                sections: [
                    ReservationHelpSection(
                        id: .detailActions,
                        tone: .info,
                        title: "이 화면에서 할 수 있는 일",
                        body: "저장한 내역을 확인하고 필요한 정보를 직접 관리할 수 있습니다.",
                        points: [
                            "내역 링크 열기로 상세 내역 확인",
                            "상태·일정·장소 수정",
                            "옵션·수량·예매/주문/예약번호·메모 기록",
                        ]
                    ),
                    ReservationHelpSection(
                        id: .linkPriority,
                        tone: .normal,
                        title: "내역 링크 사용 순서",
                        body: "상세 링크가 있으면 그 링크를 우선 엽니다. 상세 링크가 없으면 제공사 내역 URL 또는 처음 열었던 링크를 사용할 수 있습니다."
                    ),
                    ReservationHelpSection(
                        id: .userOverrides,
                        tone: .info,
                        title: "직접 수정한 정보가 먼저 표시됩니다",
                        body: "직접 수정한 제목·일정·장소는 저장 당시 공식 정보보다 우선 표시됩니다. 옵션·수량·번호·메모도 수정해 기록할 수 있습니다."
                    ),
                    ReservationHelpSection(
                        id: .officialEvent,
                        tone: .warning,
                        title: "공식 정보는 내 내역을 자동 변경하지 않습니다",
                        body: "연결된 공식 행사의 정보가 변경되거나 행사가 취소되어도 예매 완료·구매 완료·예약 완료 같은 내역 상태와 직접 수정한 값은 자동으로 바뀌지 않습니다."
                    ),
                    ReservationHelpSection(
                        id: .deleteWarning,
                        tone: .danger,
                        title: "내역 삭제는 외부 취소가 아닙니다",
                        body: "앱에서 내역을 삭제해도 외부 서비스의 실제 예매·주문·예약은 취소되지 않습니다. 취소가 필요하면 해당 외부 서비스에서 별도로 진행하세요."
                    )
                ]
            )
        }
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

    static func decision(
        drafts: [ReservationDraft],
        externallyOpenedSessionIDs: Set<UUID>,
        promptedSessionIDs: Set<UUID>,
        now: Date
    ) -> ReservationReturnPromptDecision {
        let eligible = ReservationDraftPolicy.active(drafts, now: now).filter {
            externallyOpenedSessionIDs.contains($0.sessionID) &&
                !promptedSessionIDs.contains($0.sessionID) &&
                now.timeIntervalSince($0.openedAt) >= minimumExternalDuration
        }
        switch eligible.count {
        case 0: return .none
        case 1: return .single(eligible[0].sessionID)
        default: return .multiple(Set(eligible.map(\.sessionID)))
        }
    }
}
