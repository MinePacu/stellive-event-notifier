# Documentation Agent Rules

Read this file only for documentation, planning, policy, handoff, codemap, or mockup documentation work.

## Context Discipline

- Do not read all docs by default. Read only the document family directly related to the task.
- Do not read `handoff/archive/**`, archived logs, or broad historical plans unless the user requests historical context, a regression investigation requires a specific file, or a current document links to it.
- Do not append long historical logs to active documents. Prefer short current summaries and archive stale or completed notes separately.

## Document Roles

- `PROJECT_RULES.md` is the authoritative project-policy summary.
- `NOTIFICATION_POLICY.md` defines notification preferences and delivery behavior.
- `REALTIME_DELIVERY.md` defines best-effort realtime behavior and disclosures.
- `API_IMPLEMENTATION_PLAN.md` defines backend/API integration boundaries.
- `UI_GUIDELINES.md` defines cross-platform visual constraints.
- `AI_HANDOFF.md` records current implementation state and verification history; keep it factual and concise.
- `superpowers/**` contains scoped designs and plans. Read or update only the files directly relevant to the active task.

## Editing Rules

- Keep policy statements consistent across authoritative documents; link instead of copying large sections.
- Do not place credentials, tokens, production identifiers, private responses, local-only configuration, or prohibited assets in documentation or examples.
- Clearly separate implemented behavior, planned work, assumptions, and manual verification results.
- Use exact repository paths and commands. Prefix shell command examples with `rtk` where repository command rules require it.
- Avoid broad handoff rewrites for small changes. Update only affected sections and preserve useful history.
- Documentation-only changes do not require application test suites; validate links, commands, formatting, or generated output only when relevant.

## Verification

- Prefer Markdown, link, path, and heading checks.
- Run `rtk git diff --check` for whitespace validation.
- Do not run backend, Android, or iOS tests for documentation-only changes.
