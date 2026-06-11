import XCTest

final class ChzzkBackendBoundaryTests: XCTestCase {
    func testIOSAppDoesNotContainChzzkSecretsOrDirectHosts() throws {
        let sourceRoot = try repositoryRoot()
            .appendingPathComponent("ios/StelliveHubiOS/StelliveHubiOS", isDirectory: true)
        let forbidden = [
            "CHZZK_CLIENT_ID",
            "CHZZK_CLIENT_SECRET",
            "CHZZK_ACCESS_TOKEN",
            "CHZZK_REFRESH_TOKEN",
            "api.chzzk",
            "chzzk.naver",
            "NID_AUT",
            "NID_SES"
        ]

        let files = FileManager.default.enumerator(
            at: sourceRoot,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )?.compactMap { $0 as? URL } ?? []

        let violations = try files.flatMap { file -> [String] in
            guard file.pathExtension == "swift" else { return [] }
            let text = try String(contentsOf: file, encoding: .utf8)
            return forbidden
                .filter { text.contains($0) }
                .map { "\(file.lastPathComponent) contains \($0)" }
        }

        XCTAssertTrue(violations.isEmpty, "iOS app must use backend-mediated CHZZK access only: \(violations)")
    }

    private func repositoryRoot() throws -> URL {
        var url = URL(fileURLWithPath: #filePath)
        while url.lastPathComponent != "StelLiveNoti" {
            let next = url.deletingLastPathComponent()
            if next.path == url.path {
                throw NSError(domain: "ChzzkBackendBoundaryTests", code: 1)
            }
            url = next
        }
        return url
    }
}
