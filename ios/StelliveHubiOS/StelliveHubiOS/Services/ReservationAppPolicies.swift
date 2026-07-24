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

struct ReservationHelpSection: Equatable {
    let title: String
    let body: String
    let points: [String]

    init(title: String, body: String, points: [String] = []) {
        self.title = title
        self.body = body
        self.points = points
    }
}

struct ReservationHelpContent: Equatable {
    let title: String
    let summary: String
    let sections: [ReservationHelpSection]
}

enum ReservationHelpPolicy {
    static func content(_ page: ReservationHelpPage) -> ReservationHelpContent {
        switch page {
        case .list:
            return ReservationHelpContent(
                title: "내 예약·구매 도움말",
                summary: "외부 서비스의 결제나 예약 완료 여부를 자동으로 확인하지 않으며, 사용자가 확인한 기록만 이 기기에 저장합니다.",
                sections: [
                    ReservationHelpSection(
                        title: "내역 추가",
                        body: "굿즈·행사에서 티켓·구매·예약 링크를 열면 확인 필요 항목이 생깁니다. 외부 작업을 마친 뒤 내역 추가를 선택하세요."
                    ),
                    ReservationHelpSection(
                        title: "확인 필요",
                        body: "링크를 열었지만 아직 내역으로 저장하지 않은 임시 기록입니다. 외부 작업을 완료하지 않았다면 취소할 수 있습니다."
                    ),
                    ReservationHelpSection(
                        title: "예정된 내역과 지난 내역",
                        body: "확정 상태이고 일정이 지나지 않은 기록은 예정된 내역에 표시됩니다. 취소·환불·완료 상태이거나 일정이 지난 기록은 지난 내역으로 분류됩니다.",
                        points: ["지난 내역에는 내역을 저장한 시각을 표시합니다."]
                    ),
                    ReservationHelpSection(
                        title: "저장과 보안",
                        body: "제목, 관련 링크, 예매·주문·예약번호와 메모는 기기에 저장됩니다. 민감한 링크나 번호를 다른 사람과 공유하지 마세요."
                    )
                ]
            )
        case .detail:
            return ReservationHelpContent(
                title: "내역 상세 도움말",
                summary: "상세 화면은 저장 당시 행사 정보와 사용자가 직접 수정한 내역 정보를 함께 보여줍니다.",
                sections: [
                    ReservationHelpSection(
                        title: "내역 상태",
                        body: "예매·구매·예약 상태는 사용자가 직접 관리합니다. 앱은 외부 서비스의 실제 처리 결과를 자동으로 검증하거나 변경하지 않습니다."
                    ),
                    ReservationHelpSection(
                        title: "내역 링크",
                        body: "내역 링크 열기는 저장된 상세 링크, 제공사 내역 URL, 처음 열었던 링크 순서로 사용 가능한 주소를 엽니다."
                    ),
                    ReservationHelpSection(
                        title: "연결된 공식 행사",
                        body: "저장 당시 행사와 현재 공식 행사 정보를 비교해 일정 변경이나 취소를 안내합니다. 공식 정보가 바뀌어도 내역 상태와 사용자 수정값은 자동으로 바뀌지 않습니다."
                    ),
                    ReservationHelpSection(
                        title: "수정한 정보",
                        body: "직접 수정한 제목, 일정과 장소는 저장 당시 행사 정보보다 우선 표시됩니다. 관련 링크, 옵션, 수량, 번호와 메모도 수정할 수 있습니다."
                    ),
                    ReservationHelpSection(
                        title: "내역 삭제",
                        body: "내역 삭제는 이 기기에 저장된 기록만 제거합니다. 외부 서비스의 예매·주문·예약을 취소하지 않습니다."
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
