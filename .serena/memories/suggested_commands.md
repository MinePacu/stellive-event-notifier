# Suggested Commands

- Always prefix shell commands with `rtk`; in command chains prefix each segment separately.
- Inspect repo: `rtk git status --short`; `rtk read CODEMAP.md`; `rtk fd <name-or-pattern>`; `rtk rg -n "pattern" <paths>`; `rtk git diff --check`.
- Backend setup/run: `cd backend/stellive-hub-api && rtk npm ci`; `rtk npm run dev`; server default `http://localhost:4000`, docs at `/docs`.
- Backend verify: `cd backend/stellive-hub-api && rtk npm run build`; `rtk npm test`; focused tests via `rtk npm test -- <pattern>`; Prisma via `rtk npm run prisma:generate`, `rtk npm run prisma:migrate`, `rtk npm run prisma:push`.
- Backend workers: `rtk npm run dev:chzzk-live-worker`; `rtk npm run dev:hub-event-status-worker`; `rtk npm run dev:music-channel-discovery-worker`.
- Backend Docker: `cd backend/stellive-hub-api && rtk docker compose up`; copy `.env.example` to local `.env` only, never commit `.env` or secrets.
- Android build/test: `cd android/StelliveHubAndroid && rtk ./gradlew assembleDebug`; `rtk ./gradlew :app:testDebugUnitTest`; focused tests via `rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.TestClassName`.
- iOS build/test: `cd ios/StelliveHubiOS && rtk xcodebuild -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build`; replace `build` with `test` for tests; use `-only-testing:StelliveHubiOSTests/TestClassName` for focused tests.
- Internal server testing only when needed: sync to `minepacu@192.168.50.9:~/StelLiveNoti` with AGENTS.md rsync exclusions, rebuild Docker compose on fixed port 4000, verify at `http://192.168.50.9:4000`; never transfer secrets/assets/prohibited media.