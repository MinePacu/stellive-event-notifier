import Foundation

final class PushRegistrationCoordinator {
    private let syncToken: (String) async -> Void

    init(syncToken: @escaping (String) async -> Void) {
        self.syncToken = syncToken
    }

    func didReceiveFcmRegistrationToken(_ token: String?) async {
        guard let token = token?.trimmingCharacters(in: .whitespacesAndNewlines), !token.isEmpty else {
            return
        }
        await syncToken(token)
    }
}
