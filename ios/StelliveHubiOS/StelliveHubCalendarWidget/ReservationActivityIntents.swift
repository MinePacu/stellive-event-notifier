import ActivityKit
import AppIntents
import Foundation

struct CompleteReservationIntent: AppIntent {
    static var title: LocalizedStringResource = "내역 기록"
    static var description = IntentDescription("현재 진행 중인 예약·예매·구매 내역을 링크 없이 이 기기에 기록합니다.")
    static var openAppWhenRun = false

    @Parameter(title: "내역 세션") var sessionID: String

    init() {}
    init(sessionID: UUID) { self.sessionID = sessionID.uuidString }

    func perform() async throws -> some IntentResult {
        guard let id = UUID(uuidString: sessionID) else { return .result() }
        let store = try ReservationSharedStore()
        _ = try store.confirm(sessionID: id, detailURL: nil, linkSource: .liveActivity, now: Date())
        if #available(iOSApplicationExtension 16.1, *) {
            for activity in Activity<ReservationActivityAttributes>.activities where activity.attributes.sessionID == id {
                await activity.end(dismissalPolicy: .immediate)
            }
        }
        return .result()
    }
}
