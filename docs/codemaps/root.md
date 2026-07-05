# Root CODEMAP

Read this file only for root metadata and repository configuration work, or when changed files are root-level config files.

Do not read this file for merge-only work unless a conflict or failed check directly references root metadata.

## Root And Project Metadata

- `.dockerignore` - Docker build context exclusion rules for the backend container.
- `.gitignore` - Repository ignore rules used to keep dependencies, build outputs, local config, secrets, and screenshots out of source control.
- `.gitlab-ci.yml` - GitLab CI pipeline definition for project validation.
- `.serena/.gitignore` - Serena tool ignore rules for its local project metadata.
- `.serena/project.yml` - Serena project metadata for this workspace.
- `AGENTS.md` - Repository-wide agent rules, project constraints, command conventions, and internal test-server notes.
- `CODEMAP.md` - Human-maintained map of non-ignored repository files and their roles.
- `README.md` - Project overview, goals, architecture summary, setup notes, and current development status.
- `.github/copilot-instructions.md` - GitHub Copilot guidance mirroring project policies for generated code.
- `.github/workflows/ci.yml` - GitHub Actions workflow for CI checks.

