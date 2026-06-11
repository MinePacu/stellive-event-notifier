import Foundation

protocol PushTokenAPI {
    func updateDeviceToken(_ request: UpdateDeviceTokenRequest) async throws -> UpdateDeviceTokenResponse
}

extension HubAPIClient: PushTokenAPI {}

final class PushTokenSyncer {
    private let deviceIDStore: DeviceIDStore
    private let api: PushTokenAPI
    private let defaults: UserDefaults
    private let pendingTokenKey: String

    init(
        deviceIDStore: DeviceIDStore,
        api: PushTokenAPI,
        defaults: UserDefaults = .standard,
        pendingTokenKey: String = "dev.stellive.hub.pendingPushToken"
    ) {
        self.deviceIDStore = deviceIDStore
        self.api = api
        self.defaults = defaults
        self.pendingTokenKey = pendingTokenKey
    }

    func syncToken(_ token: String) async {
        guard let deviceID = deviceIDStore.loadDeviceID() else {
            defaults.set(token, forKey: pendingTokenKey)
            return
        }
        await send(token, deviceID: deviceID)
    }

    func flushPendingToken() async {
        guard let token = defaults.string(forKey: pendingTokenKey),
              let deviceID = deviceIDStore.loadDeviceID()
        else {
            return
        }
        let sent = await send(token, deviceID: deviceID)
        if sent {
            defaults.removeObject(forKey: pendingTokenKey)
        }
    }

    private func send(_ token: String, deviceID: String) async -> Bool {
        do {
            _ = try await api.updateDeviceToken(
                UpdateDeviceTokenRequest(
                    deviceId: deviceID,
                    platform: "ios",
                    provider: "apns_via_fcm",
                    token: token,
                    appVersion: nil,
                    locale: Locale.current.identifier,
                    timezone: TimeZone.current.identifier
                )
            )
            return true
        } catch {
            return false
        }
    }
}
