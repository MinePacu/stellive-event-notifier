# iOS CODEMAP

Read this file only for iOS app or widget work or when changed files are under `ios/StelliveHubiOS/**`.

Do not read this file for merge-only work unless a conflict or failed check directly references iOS files.

## iOS: `ios/StelliveHubiOS`

- `ios/StelliveHubiOS/Config/Default.xcconfig` - Default iOS build configuration values.
- `ios/StelliveHubiOS/StelliveHubiOS.xcodeproj/project.pbxproj` - Xcode project file.
- `ios/StelliveHubiOS/StelliveHubiOS.xcodeproj/xcshareddata/xcschemes/StelliveHubiOS.xcscheme` - Shared Xcode scheme for building and testing the iOS app.
- `ios/StelliveHubiOS/StelliveHubCalendarWidget/HubCalendarWidgetBundle.swift` - WidgetKit bundle entry point for the calendar widget.
- `ios/StelliveHubiOS/StelliveHubCalendarWidget/Info.plist` - Calendar widget extension property list.
- `ios/StelliveHubiOS/StelliveHubCalendarWidget/StelliveHubCalendarWidget.entitlements` - Calendar widget app group and capability entitlements.
- `ios/StelliveHubiOS/StelliveHubiOS/App.swift` - SwiftUI app entry point and root environment setup.
- `ios/StelliveHubiOS/StelliveHubiOS/Info.plist` - iOS app property list and runtime configuration keys.
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift` - Swift domain models for catalog, live status, preferences, notifications, and hub events.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/DeliveredNotificationCleanupService.swift` - Cleans delivered notifications according to retention/collapse rules.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/DeviceIDStore.swift` - Stores a stable anonymous iOS device ID.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift` - iOS backend API client.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubCalendarWidgetStore.swift` - Shared app-group storage for widget calendar snapshots.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift` - Local mock store for app state and previews.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/NotificationCollapsePolicy.swift` - Notification collapse/grouping policy.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/NotificationPayload.swift` - iOS push payload parser/model.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/NotificationPermissionService.swift` - Notification permission request and status service.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/NotificationSummaryTextPolicy.swift` - User-facing notification summary text policy.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/NotificationThreadPolicy.swift` - iOS notification thread/category grouping policy.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/PushTokenSyncer.swift` - APNs/FCM token sync logic with the backend.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/RealtimeStreamClient.swift` - Foreground realtime stream client.
- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift` - Server-backed store that maps backend DTOs into app state.
- `ios/StelliveHubiOS/StelliveHubiOS/StelliveHubiOS.entitlements` - Main iOS app entitlements.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/ContentView.swift` - Root SwiftUI view and tab/navigation composition.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HistoryView.swift` - Notification history screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HomeView.swift` - Home summary screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift` - Hub event detail screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarView.swift` - Calendar UI for hub events and special days.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsCalendarViewModel.swift` - Calendar view model and date/filter state logic.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift` - Hub event list and navigation screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift` - Live status screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/MemberDetailView.swift` - Member detail screen.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/SettingsView.swift` - Notification settings and preference controls.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift` - Server-backed iOS song catalog screen that reuses existing grouped styling, toolbar behavior, and song filters.
- `ios/StelliveHubiOS/StelliveHubiOSTests/ChzzkBackendBoundaryTests.swift` - Tests iOS CHZZK backend-boundary assumptions.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift` - Tests iOS backend API client mapping.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubCalendarPolicyTests.swift` - Tests calendar display policy.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubCalendarStoreTests.swift` - Tests hub calendar store behavior.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubCalendarWidgetStoreTests.swift` - Tests widget snapshot storage.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift` - Tests calendar view model behavior.
- `ios/StelliveHubiOS/StelliveHubiOSTests/NotificationLoadReductionPolicyTests.swift` - Tests notification load-reduction policy on iOS.
- `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift` - Tests preference state modeling.
- `ios/StelliveHubiOS/StelliveHubiOSTests/ServerLiveStatusMappingTests.swift` - Tests backend live-status DTO mapping.
- `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift` - Tests iOS song tab navigation, song filters, and history relocation policy.
