# iOS Hub Event Hero Tag Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make iPhone event-detail hero tags readable over bright and complex images while preserving their semantic colors.

**Architecture:** Keep the change inside the existing `HubEventHeroTagView`. Add a small internal style policy for testable opacity values, then render a stronger tone-colored capsule with dark text, a tone border, and a restrained black shadow.

**Tech Stack:** Swift, SwiftUI, XCTest, Xcode

---

### Task 1: Strengthen the hero tag surface

**Files:**
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift:315-340`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift`

- [x] **Step 1: Write the failing style-policy test**

Add this test beside the existing hero-tag formatting test:

```swift
func testHubEventHeroTagStyleUsesReadableImageOverlayOpacities() {
    XCTAssertEqual(HubEventHeroTagStyle.backgroundOpacity, 0.78, accuracy: 0.001)
    XCTAssertEqual(HubEventHeroTagStyle.borderOpacity, 0.95, accuracy: 0.001)
    XCTAssertEqual(HubEventHeroTagStyle.shadowOpacity, 0.35, accuracy: 0.001)
}
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests/testHubEventHeroTagStyleUsesReadableImageOverlayOpacities
```

Expected: FAIL because `HubEventHeroTagStyle` does not exist.

- [x] **Step 3: Add the minimal style policy and apply it**

Add above `HubEventHeroTagView`:

```swift
enum HubEventHeroTagStyle {
    static let backgroundOpacity = 0.78
    static let borderOpacity = 0.95
    static let shadowOpacity = 0.35
}
```

Update `HubEventHeroTagView` so its body and colors are:

```swift
var body: some View {
    Text(tag.label)
        .font(.caption.weight(.bold))
        .foregroundStyle(Color.black.opacity(0.78))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(background, in: Capsule())
        .overlay {
            Capsule()
                .stroke(toneColor.opacity(HubEventHeroTagStyle.borderOpacity), lineWidth: 1)
        }
        .shadow(
            color: .black.opacity(HubEventHeroTagStyle.shadowOpacity),
            radius: 3,
            y: 1
        )
}

private var toneColor: Color {
    switch tag.tone {
    case .status:
        return Color(red: 0.22, green: 0.78, blue: 0.61)
    case .category:
        return Color(red: 1.0, green: 0.74, blue: 0.32)
    case .participation:
        return Color(red: 0.64, green: 0.83, blue: 1.0)
    }
}

private var background: Color {
    toneColor.opacity(HubEventHeroTagStyle.backgroundOpacity)
}
```

- [x] **Step 4: Run focused tests and verify GREEN**

Run the focused command from Step 2, then:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 17 Pro" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

Expected: PASS with no test failures.

- [x] **Step 5: Build and visually verify**

Build the `StelliveHubiOS` scheme for an available iPhone simulator. Open an image-backed event detail and verify that all three tags have readable dark text, retain distinct green/orange/blue surfaces, remain unclipped, and separate clearly from the image without darkening the full hero.

- [x] **Step 6: Run diff hygiene and commit**

```bash
rtk git diff --check
rtk git add ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift ios/StelliveHubiOS/StelliveHubiOSTests/HubEventsCalendarViewModelTests.swift docs/superpowers/plans/2026-06-28-ios-hub-event-hero-tag-readability.md
rtk git commit -m "Improve iOS event hero tag readability"
```
