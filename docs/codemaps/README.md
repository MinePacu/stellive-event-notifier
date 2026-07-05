# Codemap Directory

The root `CODEMAP.md` is the default entry point. It routes repository work to a small area-specific file map instead of loading the full monorepo map.

Agents should not load all codemaps at once. Use changed file paths or task scope to choose exactly one relevant codemap, or at most two when work crosses an explicit area boundary.

## Area Maps

- Root metadata and repository config: `docs/codemaps/root.md`
- Backend API and control plane: `docs/codemaps/backend.md`
- Android app: `docs/codemaps/android.md`
- iOS app and widgets: `docs/codemaps/ios.md`
- Shared schemas, catalog, and OpenAPI: `docs/codemaps/shared.md`
- Documentation, plans, and mockups: `docs/codemaps/docs.md`

## Reading Rules

- Read only the map selected by the active task or changed paths.
- Do not load every codemap for general orientation.
- For merge-only PR/MR work, do not read codemaps unless a conflict or failed check directly references one.
- Archived and historical documents, including `docs/superpowers/**` and `docs/handoff/archive/**`, are not active context and must not be read by default.
