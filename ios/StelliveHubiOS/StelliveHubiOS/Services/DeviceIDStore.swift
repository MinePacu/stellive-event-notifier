import Foundation

final class DeviceIDStore {
    private let defaults: UserDefaults
    private let key: String

    init(defaults: UserDefaults = .standard, key: String = "dev.minepacu.stelliveeventnotifier.deviceID") {
        self.defaults = defaults
        self.key = key
    }

    func loadDeviceID() -> String? {
        defaults.string(forKey: key)
    }

    func saveDeviceID(_ value: String) {
        defaults.set(value, forKey: key)
    }
}
