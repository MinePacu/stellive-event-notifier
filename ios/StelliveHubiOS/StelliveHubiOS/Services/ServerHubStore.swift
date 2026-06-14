import Foundation

@MainActor
final class ServerHubStore: ObservableObject {
    private let api: HubAPIClient
    private let deviceIDStore: DeviceIDStore
    private let fallback: MockHubStore

    init(
        api: HubAPIClient,
        deviceIDStore: DeviceIDStore = DeviceIDStore(),
        fallback: MockHubStore
    ) {
        self.api = api
        self.deviceIDStore = deviceIDStore
        self.fallback = fallback
    }

    func bootstrap() async -> MockHubStore {
        do {
            let response = try await api.bootstrap(deviceId: deviceIDStore.loadDeviceID())
            if response.serverTime.isEmpty == false, deviceIDStore.loadDeviceID() == nil {
                try await registerDevice()
            }
            fallback.applyBootstrap(response)
            try? HubCalendarWidgetStore.saveToSharedContainer(fallback.calendarWidgetSnapshot())
            return fallback
        } catch {
            return fallback
        }
    }

    private func registerDevice() async throws {
        let response = try await api.registerDevice(
            RegisterDeviceRequest(
                deviceId: deviceIDStore.loadDeviceID(),
                platform: "ios",
                appVersion: nil,
                locale: Locale.current.identifier,
                timezone: TimeZone.current.identifier,
                installationId: nil
            )
        )
        deviceIDStore.saveDeviceID(response.deviceId)
    }
}
