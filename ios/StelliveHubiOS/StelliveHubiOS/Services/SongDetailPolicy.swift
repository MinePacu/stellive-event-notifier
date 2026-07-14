import Foundation

struct SongDetailRow: Identifiable, Equatable {
    let label: String
    let value: String
    var id: String { label }
}

enum SongDetailPolicy {
    static func durationText(for song: SongCatalogItem) -> String? {
        if let seconds = song.durationSeconds, seconds >= 0 { return formatDuration(seconds) }
        guard let raw = song.duration, let seconds = parseISODuration(raw) else { return nil }
        return formatDuration(seconds)
    }

    static func formatDuration(_ totalSeconds: Int) -> String {
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, seconds)
            : String(format: "%d:%02d", minutes, seconds)
    }

    static func rows(for song: SongCatalogItem) -> [SongDetailRow] {
        var rows = [
            SongDetailRow(label: "참여 멤버", value: IOSSongPagePolicy.memberDisplayText(song)),
            SongDetailRow(label: "종류", value: song.type.displayName)
        ]
        if let duration = durationText(for: song) { rows.append(.init(label: "재생 시간", value: duration)) }
        if let date = song.publishedAt { rows.append(.init(label: "공개일", value: date.formatted(date: .numeric, time: .omitted))) }
        if let premiere = song.premiere {
            let assumed = premiere.classification == "assumed" ? " (추정)" : ""
            rows.append(.init(label: "YouTube 최초 공개", value: premiereLabel(premiere.state) + assumed))
        }
        if song.isInstrumental { rows.append(.init(label: "반주곡", value: "예")) }
        let flags = song.specialFlags.compactMap(specialFlagLabel)
        if !flags.isEmpty { rows.append(.init(label: "특수 플래그", value: flags.joined(separator: ", "))) }
        if let classification = classificationLabel(song.classificationStatus) {
            rows.append(.init(label: "분류 상태", value: classification))
        }
        return rows
    }

    static func memberFilter(id: String) -> SongMemberFilterState {
        SongMemberFilterState(selectedMemberIds: [id])
    }

    static func allMembersFilter(for song: SongCatalogItem) -> SongMemberFilterState {
        SongMemberFilterState(
            selectedMemberIds: Set(song.members.map(\.id).filter { !$0.isEmpty }),
            matchMode: .all
        ).normalized()
    }

    static func classificationLabel(_ value: String?) -> String? {
        switch value?.uppercased() {
        case "AUTO_CLASSIFIED": return "자동 분류"
        case "MANUAL_CONFIRMED": return "검토 완료"
        case "NEEDS_REVIEW": return "검토 필요"
        case "MANUAL_EXCLUDED": return "목록 제외"
        default: return value?.isEmpty == false ? value : nil
        }
    }

    static func specialFlagLabel(_ value: String) -> String? {
        switch value.lowercased() {
        case "short_or_preview": return "쇼츠 또는 미리보기"
        case "live_or_long_form": return "라이브 또는 장편 영상"
        default:
            let label = value.replacingOccurrences(of: "_", with: " ")
            return label.isEmpty ? nil : label
        }
    }

    private static func parseISODuration(_ value: String) -> Int? {
        let pattern = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
        guard let match = value.wholeMatch(of: pattern) else { return nil }
        let hours = Int(match.1 ?? "0") ?? 0
        let minutes = Int(match.2 ?? "0") ?? 0
        let seconds = Int(match.3 ?? "0") ?? 0
        return hours * 3600 + minutes * 60 + seconds
    }

    private static func premiereLabel(_ value: String) -> String {
        switch value.lowercased() {
        case "scheduled": return "예정"
        case "live": return "진행 중"
        case "completed": return "완료"
        default: return "정보 있음"
        }
    }
}
