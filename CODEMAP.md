# CODEMAP

This file is a lightweight routing index only. Do not read every codemap by default.

## Area Maps

- Root metadata and repository config: `docs/codemaps/root.md`
- Backend API and control plane: `docs/codemaps/backend.md`
- Android app: `docs/codemaps/android.md`
- iOS app and widgets: `docs/codemaps/ios.md`
- Shared schemas, catalog, and OpenAPI: `docs/codemaps/shared.md`
- Documentation, plans, and mockups: `docs/codemaps/docs.md`
- Codemap usage guide: `docs/codemaps/README.md`

## Reading Rule

Read only the codemap for the area touched by the task or changed files. Use one map by default and a second only when the task crosses an explicit boundary.

For merge-only PR/MR work, do not read codemaps unless a conflict or failed check directly references a codemap file.

Archived and historical documents are not active context. Do not read `docs/superpowers/**`, `docs/handoff/archive/**`, or other historical areas by default.

Generated outputs, local secrets, dependencies, IDE files, build artifacts, screenshots, and private platform configuration are intentionally excluded from codemaps.
