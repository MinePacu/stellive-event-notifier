# Android Core

- Root: `android/StelliveHubAndroid`, app module `:app`, package/application id `dev.stellive.hub`, minSdk 26, target/compileSdk 36, Java/Kotlin JVM 17.
- Build config reads `HUB_BASE_URL` from `local.properties`, defaulting emulator access to `http://10.0.2.2:4000/`.
- Main shell: `app/src/main/java/dev/stellive/hub/MainActivity.kt` contains much current view rendering/navigation; shared chrome/cards/filter helpers live under `ui/chrome` and `ui/components`.
- App state/network: `feature/home/ServerHubRepository.kt` maps backend DTOs; `MockHubRepository.kt` provides fallback data; `core/network/HubApi*.kt` defines backend-only API access. Android must not call CHZZK/YouTube/X directly or contain protected credential names/values.
- Domain models live in `core/model/Models.kt`; DTOs in `core/network/HubApiModels.kt`; local notification/history/prefs/device pieces are under `core/notification`, `core/database`, `core/datastore`, `core/device`.
- Calendar/widgets: `feature/calendar/*` owns calendar policy, widget provider/text formatting, deep links, view model/view. Special-day rows can exist without canonical `HubEvent`; canonical hub-event feed cards should dedupe date-expanded calendar rows by `eventId`.
- UI constraints from project docs: original mobile settings-inspired UI; do not clone Samsung/Apple/CHZZK/YouTube/X/Naver/Stellive proprietary designs/assets/logos. Use placeholders and runtime allowed API image URLs only with fallback.
- Tests are under `app/src/test/java/dev/stellive/hub`; many policy tests enforce backend boundaries, preference behavior, calendar/song/live UI policies, and notification constraints.