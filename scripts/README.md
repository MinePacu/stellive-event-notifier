# Build And Install Scripts

These scripts wrap Gradle, adb, xcodebuild, and simctl so Codex can run builds without placing full build logs into the conversation. Command output is written to `scripts/logs/*.log`; on failure the scripts print the log path and only the last 160 lines by default.

## Android

- `android-build.sh` builds the debug APK with the Gradle wrapper at `android/StelliveHubAndroid/gradlew`.
- `android-install.sh` installs the debug APK with `adb install -r`.
- `android-build-install.sh` runs the build script, then the install script.

Defaults:

```bash
ANDROID_PROJECT_DIR=android/StelliveHubAndroid
ANDROID_GRADLE_TASK=:app:assembleDebug
APK_PATH=android/StelliveHubAndroid/app/build/outputs/apk/debug/app-debug.apk
```

If more than one Android device is connected, set `ANDROID_SERIAL` explicitly:

```bash
ANDROID_SERIAL=emulator-5554 scripts/android-install.sh
```

## iOS Simulator

- `ios-build-simulator.sh` builds the iOS simulator app with `xcodebuild`.
- `ios-install-simulator.sh` installs the built `.app` into the booted simulator with `xcrun simctl install booted`.
- `ios-build-install-simulator.sh` runs the build script, then the install script.

Project defaults discovered in this repository:

```bash
IOS_PROJECT_DIR=ios/StelliveHubiOS
IOS_PROJECT_PATH=ios/StelliveHubiOS/StelliveHubiOS.xcodeproj
IOS_SCHEME=StelliveHubiOS
IOS_CONFIGURATION=Debug
IOS_DESTINATION='platform=iOS Simulator,name=iPhone 16'
IOS_DERIVED_DATA_DIR=scripts/logs/DerivedData-ios-simulator
IOS_APP_PATH=scripts/logs/DerivedData-ios-simulator/Build/Products/Debug-iphonesimulator/StelliveHubiOS.app
```

Change the simulator destination by setting `IOS_DESTINATION`:

```bash
IOS_DESTINATION='platform=iOS Simulator,name=iPhone 17 Pro' scripts/ios-build-simulator.sh
```

`ios-install-simulator.sh` expects a simulator to already be booted. It intentionally does not print the full simulator list; boot the desired simulator from Xcode or Simulator first.

## Log Policy

The scripts store logs under `scripts/logs/`. Successful runs print only a short success message and the selected APK or `.app` path. Failed runs print the log file path plus the last `${LOG_TAIL_LINES:-160}` lines. Override the tail size if needed:

```bash
LOG_TAIL_LINES=200 scripts/android-build.sh
```

For Codex work, ask Codex to run these scripts instead of raw Gradle, adb, xcodebuild, or simctl commands. That keeps long build/install output out of the conversation context while preserving the full log file locally for debugging.
