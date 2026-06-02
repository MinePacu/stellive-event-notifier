import Foundation

final class RealtimeStreamClient {
    private var task: URLSessionWebSocketTask?

    func connect(url: URL) {
        task = URLSession.shared.webSocketTask(with: url)
        task?.resume()
    }

    func disconnect() {
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }
}

