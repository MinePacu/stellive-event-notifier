# Handoff Documents

The default and only general entry point is `docs/AI_HANDOFF.md`.

## Structure

- `backend-current.md`: current backend/API/control-plane context.
- `android-current.md`: current Android context.
- `ios-current.md`: current iOS and WidgetKit context.
- `ops-current.md`: current deployment and operational context.
- `archive/`: preserved historical records, not active instructions.

Read only the current file selected by the active task or changed paths. Do not load all current files for general orientation.

Do not read `docs/handoff/archive/**` during normal feature work, merge-only work, routine debugging, or routine PR review. Use an exact archived file only when the user requests history, a regression investigation requires it, a merge conflict touches it, or a current document links to it explicitly.
