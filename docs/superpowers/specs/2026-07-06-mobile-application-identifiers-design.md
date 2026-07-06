# Mobile Application Identifier Migration Design

## Goal

Migrate the Android application ID/package namespace and the iOS app, test,
widget, and App Group identifiers to the `dev.minepacu.stelliveeventnotifier`
family while preserving product names, target names, resource names, and the
`stellivehub` deep-link scheme.

## Scope

- Change Android `namespace` and `applicationId` and move main, unit-test, and
  instrumented-test package directories when present.
- Update Kotlin package and import declarations to match the new directory
  hierarchy.
- Change iOS app, test, and widget bundle identifiers, both App Group
  entitlements, the shared-container constant, UserDefaults keys, and the URL
  type name.
- Update repository documentation, including archived design and planning
  documents, so ordinary text files contain no legacy identifier or package
  path.
- Leave display names, project and target names, directory names outside the
  Android package hierarchy, themes, resources, and deep-link schemes intact.

## Implementation Approach

Use exact, scope-limited replacements for tracked source and documentation,
plus `git mv` for Android package directories. Apply longer derived identifiers
before the base identifier where necessary, then inspect the diff to ensure the
resulting values match the required app, test, widget, and App Group forms.

Do not create or modify secret or local Firebase configuration. Report tracked
Firebase configuration if present and explain any required console-side
reconfiguration.

## Verification

1. Confirm no legacy dotted identifier, slash-form package path, or App Group
   identifier remains outside excluded build, dependency, cache, and Git paths.
2. Run Android unit tests and a debug assembly.
3. Lint the iOS app, widget, and entitlement property lists and list the Xcode
   project.
4. Build the iOS app for an available simulator destination when the local
   Xcode environment permits it.
5. Inspect the final diff for accidental changes to `stellivehub`, display
   names, project names, target names, or unrelated user files.

## Deployment Impact

The new Android and iOS identifiers represent different store applications if
the previous identifiers have already shipped. Firebase registrations, APNs,
provisioning profiles, App Groups, and App Store Connect may require new
configuration. Existing iOS installations do not automatically share the old
App Group container or UserDefaults keys, so a migration is required for
preserving those values in an already released application.
