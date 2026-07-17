import FirebaseCore
import FirebaseMessaging
import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    private lazy var pushRegistrationCoordinator = PushRegistrationCoordinator(
        syncToken: PushTokenSyncer(
            deviceIDStore: DeviceIDStore(),
            api: HubAPIClient(baseURL: Bundle.main.hubBaseURL ?? URL(string: "http://127.0.0.1:4000")!)
        ).syncToken
    )

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        if FirebaseApp.app() == nil, Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        }
        UNUserNotificationCenter.current().delegate = self
        if FirebaseApp.app() != nil {
            Messaging.messaging().delegate = self
            application.registerForRemoteNotifications()
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        Task {
            await pushRegistrationCoordinator.didReceiveFcmRegistrationToken(fcmToken)
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard
            let rawValue = response.notification.request.content.userInfo["appDeepLink"] as? String,
            let url = URL(string: rawValue),
            AnnouncementDeepLinkPolicy.id(from: url) != nil
        else { return }
        await UIApplication.shared.open(url)
    }
}
