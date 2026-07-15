# Android CODEMAP

Read this file only for Android work or when changed files are under `android/StelliveHubAndroid/**`.

Do not read this file for merge-only work unless a conflict or failed check directly references Android files.

## Android Shared UI Chrome Planning

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/chrome/MainScreenChromePolicy.kt` - Root/detail screen header, scroll-title, and top action visibility policy.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/HubCardFactory.kt` - Shared semantic Android card styles.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/HubBottomSheetDialog.kt` - Shared inset-aware, width-limited Android bottom-sheet shell.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/HubSingleChoiceBottomSheet.kt` - Shared single-choice bottom sheet for app-owned selection flows.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/HubDatePickerBottomSheet.kt` - Shared confirm-only date picker bottom sheet.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/SectionHeaderView.kt` - Shared external section/date header.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/TopFilterStripPolicy.kt` - Filter group data and equal-width/scroll layout policy.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/ui/components/TopFilterStripView.kt` - Fixed top filter strip renderer and scroll-position preservation.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainScreenChromePolicyTest.kt` - Screen chrome behavior tests.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/TopFilterStripPolicyTest.kt` - Filter strip layout policy tests.


## Android: `android/StelliveHubAndroid`

- `android/StelliveHubAndroid/build.gradle.kts` - Android root Gradle build configuration.
- `android/StelliveHubAndroid/settings.gradle.kts` - Android Gradle settings and module inclusion.
- `android/StelliveHubAndroid/gradle.properties` - Android Gradle and Kotlin build properties.
- `android/StelliveHubAndroid/gradle/wrapper/gradle-wrapper.properties` - Gradle wrapper distribution configuration.
- `android/StelliveHubAndroid/app/build.gradle.kts` - Android app module dependencies, build types, and generated config fields.
- `android/StelliveHubAndroid/app/src/main/AndroidManifest.xml` - Android app manifest, permissions, activities, services, and widget declarations.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt` - Main Android activity containing the current view rendering, navigation, settings, history, live, and hub event UI flows.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/StelliveHubApplication.kt` - Android application class and app-level initialization.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/database/NotificationHistoryEntity.kt` - Local notification history persistence entity.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/datastore/PreferenceKeys.kt` - DataStore preference key definitions.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/device/DeviceIdStore.kt` - Stable anonymous device ID storage.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/device/PushTokenSyncer.kt` - Push token registration and backend sync logic.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt` - Android domain models for catalog, preferences, live status, history, and hub events.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt` - Retrofit-style backend API contract.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiClient.kt` - Android backend API client factory.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt` - Android DTOs for backend request and response payloads.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubNetworkResult.kt` - Network result wrapper for backend calls.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/notification/AndroidNotificationPresenterPolicy.kt` - Android notification presentation and foreground display policy.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/notification/NotificationChannelRegistrar.kt` - Android notification channel creation.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/notification/NotificationChannels.kt` - Notification channel identifiers and metadata.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/notification/NotificationPayload.kt` - Android push payload parser/model.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/notification/NotificationPermissionPromptPolicy.kt` - Android notification permission prompt timing policy.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/notification/NotificationTopicKey.kt` - Notification topic key model for preference and payload grouping.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/notification/StelliveFirebaseMessagingService.kt` - Firebase Messaging service that receives push notifications.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/realtime/ForegroundRealtimeClient.kt` - Foreground realtime stream client for live backend updates.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarUiPolicy.kt` - Android calendar UI formatting and display policy.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/CalendarWidgetTextFormatter.kt` - Text formatter for Android calendar widget entries.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubCalendarDeepLinkPolicy.kt` - Deep-link parsing and creation policy for hub calendar event navigation.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubCalendarWidgetProvider.kt` - Android home-screen widget provider for hub calendar entries.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarView.kt` - Custom Android view for the hub events calendar.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/calendar/HubEventsCalendarViewModel.kt` - Android calendar state and projection view model.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/HubRepository.kt` - Android repository contract for hub home, live, history, settings, and events state.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/LiveMemberOrderingPolicy.kt` - Android policy for live member ordering and manual reorder behavior.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainNavigationHistory.kt` - Android navigation stack helper for main screens.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt` - Android main screen display policy, labels, and formatting helpers.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt` - Local Android mock repository used as fallback app data.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt` - Android server-backed repository that maps backend bootstrap data into app state.
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/hubevents/HubEventImagePolicy.kt` - Android policy for displaying or falling back from hub event image metadata.
- `android/StelliveHubAndroid/app/src/main/res/color/hub_bottom_nav_selector.xml` - Bottom navigation color state selector.
- `android/StelliveHubAndroid/app/src/main/res/color/hub_popup_menu_text.xml` - Enabled and disabled Hub popup-menu text colors.
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_avatar_placeholder.xml` - Placeholder avatar drawable.
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_hub_bottom_sheet.xml` - Rounded Hub bottom-sheet surface background.
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_hub_drag_handle.xml` - Shared bottom-sheet drag handle background.
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_hub_popup_menu.xml` - Rounded Hub popup-menu background.
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_button_glass.xml` - Top bar button background drawable.
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_glass.xml` - Top bar background drawable.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_arrow_back.xml` - Back navigation icon.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_launcher_placeholder.xml` - Placeholder launcher icon.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_metric_clock.xml` - Clock metric icon for live elapsed time.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_metric_viewers.xml` - Viewer count metric icon.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_goods_events.xml` - Bottom tab icon for goods/events.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_history.xml` - Bottom tab icon for history.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_home.xml` - Bottom tab icon for home.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_live.xml` - Bottom tab icon for live.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_songs.xml` - Bottom tab icon for the song catalog screen.
- `android/StelliveHubAndroid/app/src/main/res/drawable/ic_tab_settings.xml` - Bottom tab icon for settings.
- `android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml` - Main Android activity layout shell.
- `android/StelliveHubAndroid/app/src/main/res/layout/item_member.xml` - Member row/item layout.
- `android/StelliveHubAndroid/app/src/main/res/layout/widget_hub_calendar.xml` - Android widget layout for hub calendar entries.
- `android/StelliveHubAndroid/app/src/main/res/menu/bottom_navigation.xml` - Bottom navigation menu items.
- `android/StelliveHubAndroid/app/src/main/res/navigation/nav_graph.xml` - Navigation graph resource.
- `android/StelliveHubAndroid/app/src/main/res/values/colors.xml` - Default Android color tokens.
- `android/StelliveHubAndroid/app/src/main/res/values/styles.xml` - Default Android style resources.
- `android/StelliveHubAndroid/app/src/main/res/values-night/colors.xml` - Night-mode Android color tokens.
- `android/StelliveHubAndroid/app/src/main/res/values-night/styles.xml` - Night-mode Android style resources.
- `android/StelliveHubAndroid/app/src/main/res/values/strings.xml` - Android string resources.
- `android/StelliveHubAndroid/app/src/main/res/xml/hub_calendar_widget.xml` - Android app widget provider metadata.
- `android/StelliveHubAndroid/gradle/wrapper/gradle-wrapper.jar` - Gradle wrapper executable jar.
- `android/StelliveHubAndroid/gradlew` - Unix Gradle wrapper script.
- `android/StelliveHubAndroid/gradlew.bat` - Windows Gradle wrapper script.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/AndroidColorTokenPolicyTest.kt` - Unit test for Android color-token policy constraints.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/BottomNavigationIconPolicyTest.kt` - Unit test for bottom navigation icon policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarProjectionTest.kt` - Unit test for calendar projection behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarUiPolicyTest.kt` - Unit test for Android calendar UI policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/CalendarWidgetTextFormatterTest.kt` - Unit test for calendar widget text formatting.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ChzzkBackendBoundaryTest.kt` - Unit test enforcing Android CHZZK backend boundary rules.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/DeviceRegistrationTest.kt` - Unit test for Android device registration behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubApiClientTest.kt` - Unit test for Android backend API client behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubCalendarDeepLinkPolicyTest.kt` - Unit test for hub calendar deep-link policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventImagePolicyTest.kt` - Unit test for Android hub event image policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsCalendarViewModelTest.kt` - Unit test for Android calendar view model behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/HubEventsPolicyTest.kt` - Unit test for hub events display and policy behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ListDateNavigationPolicyTest.kt` - Unit test for list date navigation policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ListDateNavigationViewModelTest.kt` - Unit test for list date navigation view model behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/LiveMemberOrderingPolicyTest.kt` - Unit test for live member ordering.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainNavigationHistoryTest.kt` - Unit test for Android main navigation history.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainUiPolicyTest.kt` - Unit test for Android main UI policy.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/NotificationLoadReductionAndroidTest.kt` - Unit test for Android notification load-reduction behavior.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/PreferenceResolutionStateTest.kt` - Unit test for Android preference resolution state.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/ServerHubRepositoryTest.kt` - Unit test for server-backed Android repository mapping.
- `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt` - Unit test for Android song tab navigation, song filters, and history relocation policy.
