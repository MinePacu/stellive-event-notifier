import Foundation
import Security

protocol SecureValueStore {
    func get(_ account: String) -> String?
    /// Returns false when the value could not be persisted.
    @discardableResult func set(_ value: String, for account: String) -> Bool
    func remove(_ account: String)
}

/// Generic-password Keychain items. `AfterFirstUnlockThisDeviceOnly` keeps background
/// push-token sync working and keeps the items out of backups/device migration.
struct KeychainSecureValueStore: SecureValueStore {
    private let service: String

    init(service: String = "dev.minepacu.stelliveeventnotifier.device") {
        self.service = service
    }

    private func baseQuery(_ account: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }

    func get(_ account: String) -> String? {
        var query = baseQuery(account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func set(_ value: String, for account: String) -> Bool {
        let data = Data(value.utf8)
        let updateStatus = SecItemUpdate(
            baseQuery(account) as CFDictionary,
            [kSecValueData as String: data] as CFDictionary
        )
        if updateStatus == errSecSuccess { return true }
        guard updateStatus == errSecItemNotFound else { return false }
        var add = baseQuery(account)
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }

    func remove(_ account: String) {
        SecItemDelete(baseQuery(account) as CFDictionary)
    }
}

/// Used by unit tests, where the real Keychain is unavailable (unsigned builds).
final class InMemorySecureValueStore: SecureValueStore {
    private var values: [String: String] = [:]
    var failsWrites = false

    func get(_ account: String) -> String? { values[account] }

    func set(_ value: String, for account: String) -> Bool {
        guard !failsWrites else { return false }
        values[account] = value
        return true
    }

    func remove(_ account: String) { values[account] = nil }
}

final class DeviceIDStore {
    private static let deviceIDAccount = "deviceID"
    private static let deviceSecretAccount = "deviceSecret"

    private let defaults: UserDefaults
    private let key: String
    private let secureStore: SecureValueStore

    init(
        defaults: UserDefaults = .standard,
        key: String = "dev.minepacu.stelliveeventnotifier.deviceID",
        secureStore: SecureValueStore = KeychainSecureValueStore()
    ) {
        self.defaults = defaults
        self.key = key
        self.secureStore = secureStore
    }

    func loadDeviceID() -> String? {
        if let value = secureStore.get(Self.deviceIDAccount) { return value }
        // Legacy UserDefaults id: move it into the Keychain, keeping it if the write fails.
        guard let legacy = defaults.string(forKey: key) else { return nil }
        if secureStore.set(legacy, for: Self.deviceIDAccount) {
            defaults.removeObject(forKey: key)
        }
        return legacy
    }

    func saveDeviceID(_ value: String) {
        if secureStore.set(value, for: Self.deviceIDAccount) {
            defaults.removeObject(forKey: key)
        } else {
            defaults.set(value, forKey: key)
        }
    }

    func loadDeviceSecret() -> String? {
        secureStore.get(Self.deviceSecretAccount)
    }

    func saveDeviceSecret(_ value: String) {
        secureStore.set(value, for: Self.deviceSecretAccount)
    }

    func clearCredentials() {
        secureStore.remove(Self.deviceIDAccount)
        secureStore.remove(Self.deviceSecretAccount)
        defaults.removeObject(forKey: key)
    }
}
