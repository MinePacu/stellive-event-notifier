import Foundation

struct MobileConfigResponse: Codable, Equatable {
    let unofficialProject: Bool
    let catalogVersion: String
    let officialYoutubeLiveExcluded: Bool
    let xNotificationsEnabled: Bool
    let xDisabledReason: String?
    let hubCalendarEnabled: Bool
    let foregroundRealtimeEnabled: Bool
}

struct BootstrapResponse: Codable, Equatable {
    let config: MobileConfigResponse
    let preferences: [PreferenceResponse]
    let liveStatus: [LiveStatusResponse]
    let hubEventsSummary: HubEventsSummaryResponse?
    let hubCalendarWidgetSnapshot: HubCalendarWidgetSnapshot?
    let serverTime: String
}

struct PreferenceResponse: Codable, Equatable {
    let deviceId: String?
    let scope: String
    let enabled: Bool
    let explicitOverride: Bool
    let tapAction: String
    let deliveryMode: String
    let updatedAt: String
}

struct LiveStatusResponse: Codable, Equatable {
    let memberId: String
    let generationId: String
    let platform: String
    let isLive: Bool
    let title: String?
    let viewerCount: Int?
    let startedAt: String?
    let platformUrl: String?
    let lastCheckedAt: String
    let sourceVerificationState: String
}

struct HubEventsSummaryResponse: Codable, Equatable {
    let openCount: Int
    let upcomingCount: Int
    let closingSoonCount: Int
}

struct RegisterDeviceRequest: Codable, Equatable {
    let deviceId: String?
    let platform: String
    let appVersion: String?
    let locale: String?
    let timezone: String?
    let installationId: String?
}

struct RegisterDeviceResponse: Codable, Equatable {
    let deviceId: String
    let registered: Bool
    let serverTime: String
}

struct UpdateDeviceTokenRequest: Codable, Equatable {
    let deviceId: String
    let platform: String
    let provider: String
    let token: String
    let appVersion: String?
    let locale: String?
    let timezone: String?
}

struct UpdateDeviceTokenResponse: Codable, Equatable {
    let updated: Bool
    let tokenStatus: String
    let serverTime: String
}

struct PreferencesResponse: Codable, Equatable {
    let deviceId: String
    let preferences: [PreferenceResponse]
    let updatedAt: String
    let conflict: String?
}

struct UpdatePreferencesRequest: Codable, Equatable {
    let deviceId: String
    let preferences: [PreferenceResponse]
    let clientUpdatedAt: String
}

struct UpdatePreferencesResponse: Codable, Equatable {
    let deviceId: String
    let preferences: [PreferenceResponse]
    let updatedAt: String
    let conflict: String?
}

enum HubAPIError: Error, Equatable {
    case invalidResponse
    case httpStatus(Int)
}

final class HubAPIClient {
    private let baseURL: URL
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        self.encoder = JSONEncoder()
        self.decoder = JSONDecoder()
    }

    func bootstrap(deviceId: String?) async throws -> BootstrapResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/bootstrap"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "deviceId", value: deviceId),
            URLQueryItem(name: "platform", value: "ios"),
        ].filter { $0.value != nil }
        return try await send(URLRequest(url: components.url!), responseType: BootstrapResponse.self)
    }

    func registerDevice(_ request: RegisterDeviceRequest) async throws -> RegisterDeviceResponse {
        try await sendJSON(path: "v1/devices/register", method: "POST", body: request, responseType: RegisterDeviceResponse.self)
    }

    func updateDeviceToken(_ request: UpdateDeviceTokenRequest) async throws -> UpdateDeviceTokenResponse {
        try await sendJSON(path: "v1/devices/token", method: "PUT", body: request, responseType: UpdateDeviceTokenResponse.self)
    }

    func preferences(deviceId: String) async throws -> PreferencesResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("v1/preferences"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "deviceId", value: deviceId)]
        return try await send(URLRequest(url: components.url!), responseType: PreferencesResponse.self)
    }

    func updatePreferences(_ request: UpdatePreferencesRequest) async throws -> UpdatePreferencesResponse {
        try await sendJSON(path: "v1/preferences", method: "PUT", body: request, responseType: UpdatePreferencesResponse.self)
    }

    private func sendJSON<RequestBody: Encodable, ResponseBody: Decodable>(
        path: String,
        method: String,
        body: RequestBody,
        responseType: ResponseBody.Type
    ) async throws -> ResponseBody {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try encoder.encode(body)
        return try await send(request, responseType: responseType)
    }

    private func send<ResponseBody: Decodable>(
        _ request: URLRequest,
        responseType: ResponseBody.Type
    ) async throws -> ResponseBody {
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw HubAPIError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw HubAPIError.httpStatus(httpResponse.statusCode)
        }
        return try decoder.decode(responseType, from: data)
    }
}
