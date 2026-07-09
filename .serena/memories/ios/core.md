# iOS Core

- Root: `ios/StelliveHubiOS`; Xcode project `StelliveHubiOS.xcodeproj`; shared scheme `StelliveHubiOS`; app bundle target plus `StelliveHubiOSTests` and calendar widget extension.
- Entry/root: `StelliveHubiOS/App.swift`; main SwiftUI composition under `StelliveHubiOS/Views`, with `ContentView.swift` as tab/navigation composition.
- Models/services: `Models/HubModels.swift` defines domain models; `Services/HubAPIClient.swift`, `ServerHubStore.swift`, `MockHubStore.swift`, `RealtimeStreamClient.swift`, notification policy/payload/thread/collapse/token services, and widget store own app state and backend integration.
- Calendar/widgets: `Views/HubEventsCalendarView*.swift` and `Services/HubCalendarWidgetStore.swift`; calendar rows can be date-expanded for markers/bars, while feed/list projections should dedupe canonical hub events by `eventId` and retain special-day behavior.
- Songs page: `Views/SongsView.swift` uses backend-only song APIs via store/client; iOS must not call YouTube directly.
- CHZZK/platform boundary: iOS consumes normalized backend DTOs from `/v1/bootstrap` and `/v1/live-status`; no direct CHZZK host calls or backend-only credential names/values in app source.
- UI constraints: original SwiftUI grouped-settings style is allowed, but do not clone Apple Settings or any platform/Stellive proprietary logos/assets/designs. Do not add profile/logo/fan-art/captured image assets.
- Tests live in `StelliveHubiOSTests`; use focused `-only-testing:` when possible because simulator availability may vary.