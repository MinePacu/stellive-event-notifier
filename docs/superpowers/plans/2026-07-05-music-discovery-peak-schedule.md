# Music Discovery Peak Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run YouTube music channel discovery every 5 minutes from 12:00 through 23:59 KST and every 60 minutes from 00:00 through 11:59 KST without skipping either schedule boundary.

**Architecture:** Add validated peak-window settings to the existing environment schema, implement a pure time-zone-aware scheduling policy, and call that policy after every discovery attempt in the existing single worker. Keep API ingestion, Redis locking, classification, mobile contracts, and Docker topology unchanged.

**Tech Stack:** TypeScript ES2022, Node.js `Intl.DateTimeFormat`, Zod, Vitest, Docker Compose

---

## File Map

- Create `backend/stellive-hub-api/src/workers/musicChannelDiscoverySchedule.ts`: pure peak-window classification and next-delay calculation.
- Create `backend/stellive-hub-api/test/musicChannelDiscoverySchedule.test.ts`: boundary and host-time-zone-independent policy tests.
- Create `backend/stellive-hub-api/test/musicChannelDiscoveryWorker.test.ts`: success/failure cycle integration tests without real sleeping.
- Modify `backend/stellive-hub-api/src/config/env.ts`: parse and validate peak interval, hours, and IANA time zone.
- Modify `backend/stellive-hub-api/test/foundation.test.ts`: pin configuration defaults, overrides, and rejection cases.
- Modify `backend/stellive-hub-api/test/chzzkAuthRoutes.test.ts`: keep its explicit `AppEnv`-compatible route fixture complete.
- Modify `backend/stellive-hub-api/src/workers/musicChannelDiscoveryWorker.ts`: calculate a fresh delay after every attempt.
- Modify `backend/stellive-hub-api/.env.example`: expose production defaults.
- Modify `docs/API_SETUP.md`: document schedule semantics and boundary behavior.
- Modify `docs/AI_HANDOFF.md`: replace the hourly-worker description.
- Modify `CODEMAP.md`: register the new schedule policy and focused tests.

### Task 1: Add and validate peak schedule configuration

**Files:**
- Modify: `backend/stellive-hub-api/src/config/env.ts:1-125`
- Modify: `backend/stellive-hub-api/test/foundation.test.ts:8-106`
- Modify: `backend/stellive-hub-api/test/chzzkAuthRoutes.test.ts:6-27`

- [ ] **Step 1: Add a failing environment configuration test**

Append this test inside `describe("foundation configuration", ...)` in `backend/stellive-hub-api/test/foundation.test.ts`:

```ts
  it("validates music channel discovery peak schedule configuration", () => {
    const defaults = loadEnv(baseEnv);
    expect(defaults.MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES).toBe(60);
    expect(defaults.MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES).toBe(5);
    expect(defaults.MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR).toBe(12);
    expect(defaults.MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR).toBe(24);
    expect(defaults.MUSIC_CHANNEL_DISCOVERY_TIME_ZONE).toBe("Asia/Seoul");

    const configured = loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES: "30",
      MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES: "3",
      MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR: "10",
      MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR: "22",
      MUSIC_CHANNEL_DISCOVERY_TIME_ZONE: "Asia/Tokyo",
    });
    expect(configured.MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES).toBe(30);
    expect(configured.MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES).toBe(3);
    expect(configured.MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR).toBe(10);
    expect(configured.MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR).toBe(22);
    expect(configured.MUSIC_CHANNEL_DISCOVERY_TIME_ZONE).toBe("Asia/Tokyo");

    expect(() => loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES: "0",
    })).toThrow(/MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES/);
    expect(() => loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR: "24",
    })).toThrow(/MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR/);
    expect(() => loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR: "25",
    })).toThrow(/MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR/);
    expect(() => loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR: "18",
      MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR: "12",
    })).toThrow(/MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR/);
    expect(() => loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_TIME_ZONE: "Mars/Olympus_Mons",
    })).toThrow(/MUSIC_CHANNEL_DISCOVERY_TIME_ZONE/);
  });
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
rtk npm test -- --run test/foundation.test.ts
```

Working directory: `backend/stellive-hub-api`

Expected: FAIL because `MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES` and the other new properties are undefined.

- [ ] **Step 3: Add the environment fields and cross-field validation**

Add this helper near the other schema helpers in `backend/stellive-hub-api/src/config/env.ts`:

```ts
function ianaTimeZone(defaultValue: string) {
  return z.string().default(defaultValue).superRefine((value, context) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "must be a valid IANA time zone",
      });
    }
  });
}
```

Extend the music discovery fields in the object schema:

```ts
    MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED: booleanFlag(false),
    MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
    MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES: z.coerce.number().int().positive().default(5),
    MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR: z.coerce.number().int().min(0).max(23).default(12),
    MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR: z.coerce.number().int().min(1).max(24).default(24),
    MUSIC_CHANNEL_DISCOVERY_TIME_ZONE: ianaTimeZone("Asia/Seoul"),
    MUSIC_CHANNEL_DISCOVERY_RECENT_PAGES: z.coerce.number().int().positive().default(1),
```

Insert `superRefine` between the closing `object({...})` and the existing `transform`:

```ts
  .superRefine((env, context) => {
    if (env.MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR >= env.MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR"],
        message: "must be greater than MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR",
      });
    }
  })
  .transform((env) => ({
```

Add the new required values after `MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES` in the explicit `routeEnv` fixture in `backend/stellive-hub-api/test/chzzkAuthRoutes.test.ts`:

```ts
  MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES: 5,
  MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR: 12,
  MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR: 24,
  MUSIC_CHANNEL_DISCOVERY_TIME_ZONE: "Asia/Seoul",
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
rtk npm test -- --run test/foundation.test.ts
```

Expected: PASS for all `foundation configuration` and `Prisma storage` tests.

- [ ] **Step 5: Commit the configuration slice**

```bash
rtk git add backend/stellive-hub-api/src/config/env.ts backend/stellive-hub-api/test/foundation.test.ts backend/stellive-hub-api/test/chzzkAuthRoutes.test.ts
rtk git commit -m "feat: configure peak music discovery schedule"
```

### Task 2: Implement the time-zone-aware scheduling policy

**Files:**
- Create: `backend/stellive-hub-api/src/workers/musicChannelDiscoverySchedule.ts`
- Create: `backend/stellive-hub-api/test/musicChannelDiscoverySchedule.test.ts`

- [ ] **Step 1: Write the failing boundary tests**

Create `backend/stellive-hub-api/test/musicChannelDiscoverySchedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isMusicDiscoveryPeakTime,
  msUntilNextMusicDiscovery,
  type MusicChannelDiscoverySchedule,
} from "../src/workers/musicChannelDiscoverySchedule.js";

const schedule: MusicChannelDiscoverySchedule = {
  offPeakIntervalMinutes: 60,
  peakIntervalMinutes: 5,
  peakStartHour: 12,
  peakEndHour: 24,
  timeZone: "Asia/Seoul",
};

describe("music channel discovery schedule", () => {
  it.each([
    ["2026-07-05T02:30:00.000Z", false, 30 * 60_000], // 11:30 KST
    ["2026-07-05T02:59:00.000Z", false, 1 * 60_000],  // 11:59 KST
    ["2026-07-05T03:00:00.000Z", true, 5 * 60_000],   // 12:00 KST
    ["2026-07-05T14:58:00.000Z", true, 2 * 60_000],   // 23:58 KST
    ["2026-07-05T15:00:00.000Z", false, 60 * 60_000], // 00:00 KST
  ])("classifies %s and returns the boundary-aware delay", (iso, peak, delayMs) => {
    const now = new Date(iso);
    expect(isMusicDiscoveryPeakTime(now, schedule)).toBe(peak);
    expect(msUntilNextMusicDiscovery(now, schedule)).toBe(delayMs);
  });

  it("uses the configured IANA time zone instead of the process time zone", () => {
    const instant = new Date("2026-07-05T09:00:00.000Z");
    expect(isMusicDiscoveryPeakTime(instant, schedule)).toBe(true);
    expect(isMusicDiscoveryPeakTime(instant, {
      ...schedule,
      timeZone: "America/Los_Angeles",
    })).toBe(false);
  });

  it("preserves millisecond precision when capping at a boundary", () => {
    const now = new Date("2026-07-05T02:59:59.999Z");
    expect(msUntilNextMusicDiscovery(now, schedule)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the schedule test and confirm it fails**

Run:

```bash
rtk npm test -- --run test/musicChannelDiscoverySchedule.test.ts
```

Working directory: `backend/stellive-hub-api`

Expected: FAIL with a module-not-found error for `musicChannelDiscoverySchedule.js`.

- [ ] **Step 3: Implement the pure scheduling policy**

Create `backend/stellive-hub-api/src/workers/musicChannelDiscoverySchedule.ts`:

```ts
export interface MusicChannelDiscoverySchedule {
  offPeakIntervalMinutes: number;
  peakIntervalMinutes: number;
  peakStartHour: number;
  peakEndHour: number;
  timeZone: string;
}

const minuteMs = 60_000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function hourFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function localHour(now: Date, timeZone: string): number {
  const hourPart = hourFormatter(timeZone)
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  if (hourPart === undefined) throw new Error("music_discovery_local_hour_unavailable");
  return Number(hourPart) % 24;
}

export function isMusicDiscoveryPeakTime(
  now: Date,
  schedule: MusicChannelDiscoverySchedule,
): boolean {
  const hour = localHour(now, schedule.timeZone);
  return hour >= schedule.peakStartHour && hour < schedule.peakEndHour;
}

export function msUntilNextMusicDiscovery(
  now: Date,
  schedule: MusicChannelDiscoverySchedule,
): number {
  const peak = isMusicDiscoveryPeakTime(now, schedule);
  const intervalMinutes = peak
    ? schedule.peakIntervalMinutes
    : schedule.offPeakIntervalMinutes;
  const baseDelayMs = intervalMinutes * minuteMs;
  let previousElapsedMs = 0;

  for (let elapsedMs = Math.min(minuteMs, baseDelayMs);
    elapsedMs <= baseDelayMs;
    elapsedMs = Math.min(elapsedMs + minuteMs, baseDelayMs)) {
    const candidatePeak = isMusicDiscoveryPeakTime(
      new Date(now.getTime() + elapsedMs),
      schedule,
    );
    if (candidatePeak !== peak) {
      let low = previousElapsedMs;
      let high = elapsedMs;
      while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        const middlePeak = isMusicDiscoveryPeakTime(
          new Date(now.getTime() + middle),
          schedule,
        );
        if (middlePeak === peak) low = middle;
        else high = middle;
      }
      return Math.max(1, high);
    }
    if (elapsedMs === baseDelayMs) break;
    previousElapsedMs = elapsedMs;
  }

  return Math.max(1, baseDelayMs);
}
```

This scans only until the configured base interval and binary-searches the first detected wall-clock boundary. It therefore remains independent of the host time zone and does not assume a fixed UTC offset for `Asia/Seoul`.

- [ ] **Step 4: Run the schedule test and confirm it passes**

Run:

```bash
rtk npm test -- --run test/musicChannelDiscoverySchedule.test.ts
```

Expected: PASS for all seven boundary/time-zone cases.

- [ ] **Step 5: Commit the scheduling policy slice**

```bash
rtk git add backend/stellive-hub-api/src/workers/musicChannelDiscoverySchedule.ts backend/stellive-hub-api/test/musicChannelDiscoverySchedule.test.ts
rtk git commit -m "feat: calculate boundary-aware music discovery delays"
```

### Task 3: Recalculate the delay after every worker attempt

**Files:**
- Create: `backend/stellive-hub-api/test/musicChannelDiscoveryWorker.test.ts`
- Modify: `backend/stellive-hub-api/src/workers/musicChannelDiscoveryWorker.ts:1-39`

- [ ] **Step 1: Write the failing worker-cycle tests**

Create `backend/stellive-hub-api/test/musicChannelDiscoveryWorker.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { runDiscoveryCycle } from "../src/workers/musicChannelDiscoveryWorker.js";
import type { MusicChannelDiscoverySchedule } from "../src/workers/musicChannelDiscoverySchedule.js";

const schedule: MusicChannelDiscoverySchedule = {
  offPeakIntervalMinutes: 60,
  peakIntervalMinutes: 5,
  peakStartHour: 12,
  peakEndHour: 24,
  timeZone: "Asia/Seoul",
};

describe("music channel discovery worker", () => {
  it("recalculates the delay after each successful attempt", async () => {
    const discover = vi.fn().mockResolvedValue(undefined);
    const firstDelay = await runDiscoveryCycle({
      discover,
      now: () => new Date("2026-07-05T02:30:00.000Z"),
      schedule,
    });
    const secondDelay = await runDiscoveryCycle({
      discover,
      now: () => new Date("2026-07-05T03:00:00.000Z"),
      schedule,
    });

    expect(discover).toHaveBeenCalledTimes(2);
    expect(firstDelay).toBe(30 * 60_000);
    expect(secondDelay).toBe(5 * 60_000);
  });

  it("logs a failed attempt and still calculates the current schedule delay", async () => {
    const failure = new Error("api unavailable");
    const logError = vi.fn();
    const delay = await runDiscoveryCycle({
      discover: vi.fn().mockRejectedValue(failure),
      now: () => new Date("2026-07-05T14:58:00.000Z"),
      schedule,
      logError,
    });

    expect(logError).toHaveBeenCalledWith("music channel discovery failed", failure);
    expect(delay).toBe(2 * 60_000);
  });
});
```

- [ ] **Step 2: Run the worker test and confirm it fails**

Run:

```bash
rtk npm test -- --run test/musicChannelDiscoveryWorker.test.ts
```

Working directory: `backend/stellive-hub-api`

Expected: FAIL because `runDiscoveryCycle` is not exported.

- [ ] **Step 3: Add the schedule mapping and cycle function to the worker**

Add these imports to `backend/stellive-hub-api/src/workers/musicChannelDiscoveryWorker.ts`:

```ts
import type { AppEnv } from "../config/env.js";
import {
  msUntilNextMusicDiscovery,
  type MusicChannelDiscoverySchedule,
} from "./musicChannelDiscoverySchedule.js";
```

Add these definitions above `main()`:

```ts
function scheduleFromEnv(env: AppEnv): MusicChannelDiscoverySchedule {
  return {
    offPeakIntervalMinutes: env.MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES,
    peakIntervalMinutes: env.MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES,
    peakStartHour: env.MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR,
    peakEndHour: env.MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR,
    timeZone: env.MUSIC_CHANNEL_DISCOVERY_TIME_ZONE,
  };
}

export interface DiscoveryCycleOptions {
  discover?: () => Promise<void>;
  now?: () => Date;
  schedule: MusicChannelDiscoverySchedule;
  logError?: (message: string, error: unknown) => void;
}

export async function runDiscoveryCycle(options: DiscoveryCycleOptions): Promise<number> {
  try {
    await (options.discover ?? (() => discoverOnce()))();
  } catch (error) {
    (options.logError ?? console.error)("music channel discovery failed", error);
  }
  return msUntilNextMusicDiscovery(
    (options.now ?? (() => new Date()))(),
    options.schedule,
  );
}
```

Replace the existing fixed-delay `main()` with:

```ts
async function main(): Promise<void> {
  const env = loadEnv();
  const schedule = scheduleFromEnv(env);
  for (;;) {
    const delayMs = await runDiscoveryCycle({ schedule });
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
```

- [ ] **Step 4: Run the focused worker and schedule tests**

Run:

```bash
rtk npm test -- --run test/musicChannelDiscoveryWorker.test.ts test/musicChannelDiscoverySchedule.test.ts
```

Expected: PASS for both test files. The worker tests must complete immediately without invoking a real timer or HTTP request.

- [ ] **Step 5: Run the TypeScript build**

Run:

```bash
rtk npm run build
```

Working directory: `backend/stellive-hub-api`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 6: Commit the worker integration slice**

```bash
rtk git add backend/stellive-hub-api/src/workers/musicChannelDiscoveryWorker.ts backend/stellive-hub-api/test/musicChannelDiscoveryWorker.test.ts
rtk git commit -m "feat: apply peak schedule to music discovery worker"
```

### Task 4: Document configuration and operational behavior

**Files:**
- Modify: `backend/stellive-hub-api/.env.example:29-34`
- Modify: `docs/API_SETUP.md:116-130`
- Modify: `docs/AI_HANDOFF.md:10-18`
- Modify: `CODEMAP.md:12-15`

- [ ] **Step 1: Add the environment defaults**

Replace the discovery block in `backend/stellive-hub-api/.env.example` with:

```env
MUSIC_SYNC_ENABLED=false
MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED=false
MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES=60
MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES=5
MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR=12
MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR=24
MUSIC_CHANNEL_DISCOVERY_TIME_ZONE=Asia/Seoul
MUSIC_CHANNEL_DISCOVERY_RECENT_PAGES=1
```

- [ ] **Step 2: Update API setup documentation**

Replace the matching discovery variables in the `docs/API_SETUP.md` environment example with the same seven `MUSIC_CHANNEL_DISCOVERY_*` lines from Step 1, then add this paragraph immediately below the environment block:

```md
The discovery worker runs immediately at startup. It then uses `MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES` during the half-open local-time window `[MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR, MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR)` and `MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES` outside that window. Delays are capped at the next boundary, so the default schedule switches at exactly 12:00 and 00:00 in `Asia/Seoul` instead of carrying the previous interval across the boundary.
```

- [ ] **Step 3: Update handoff and code map entries**

Replace the hourly-worker sentence in `docs/AI_HANDOFF.md` with:

```md
- Docker includes a single discovery worker that runs every 5 minutes from 12:00 through 23:59 KST and every 60 minutes otherwise. The boundary-aware schedule is controlled by `MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES`, `MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES`, `MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR`, `MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR`, and `MUSIC_CHANNEL_DISCOVERY_TIME_ZONE`; `MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED` remains the feature flag.
```

In the backend section of `CODEMAP.md`, replace the existing worker entry and add the schedule/test entries so it contains:

```md
- `backend/stellive-hub-api/src/workers/musicChannelDiscoveryWorker.ts` - Calls the internal music discovery scheduler immediately and recalculates a boundary-aware delay after every attempt.
- `backend/stellive-hub-api/src/workers/musicChannelDiscoverySchedule.ts` - Pure IANA-time-zone peak-window policy for the music discovery worker.
- `backend/stellive-hub-api/test/musicChannelDiscoveryWorker.test.ts` - Verifies success/failure cycle delay recalculation without real waiting.
- `backend/stellive-hub-api/test/musicChannelDiscoverySchedule.test.ts` - Verifies KST peak/off-peak boundaries and time-zone-independent delay calculation.
```

- [ ] **Step 4: Check documentation and formatting**

Run:

```bash
rtk sh -lc "rg -n 'MUSIC_CHANNEL_DISCOVERY_(INTERVAL|PEAK|TIME_ZONE)' backend/stellive-hub-api/.env.example docs/API_SETUP.md docs/AI_HANDOFF.md CODEMAP.md"
rtk git diff --check
```

Expected: all seven discovery schedule variables appear in `.env.example` and `docs/API_SETUP.md`; no whitespace errors are reported.

- [ ] **Step 5: Commit the documentation slice**

```bash
rtk git add backend/stellive-hub-api/.env.example docs/API_SETUP.md docs/AI_HANDOFF.md CODEMAP.md
rtk git commit -m "docs: explain peak music discovery schedule"
```

### Task 5: Run complete verification and deploy to the internal test server

**Files:**
- Verify only; no source files should change.

- [ ] **Step 1: Run the complete backend test suite**

Run:

```bash
rtk npm test
```

Working directory: `backend/stellive-hub-api`

Expected: all Vitest files pass with zero failed tests.

- [ ] **Step 2: Run a clean backend build**

Run:

```bash
rtk npm run build
```

Working directory: `backend/stellive-hub-api`

Expected: exit code 0 and generated JavaScript includes both worker modules under `dist/backend/stellive-hub-api/src/workers/`.

- [ ] **Step 3: Confirm the final change scope**

Run:

```bash
rtk git status --short
rtk git diff HEAD~4 -- backend/stellive-hub-api/src/config/env.ts backend/stellive-hub-api/src/workers backend/stellive-hub-api/test backend/stellive-hub-api/.env.example docs/API_SETUP.md docs/AI_HANDOFF.md CODEMAP.md
```

Expected: only the configuration, schedule policy, worker, focused tests, and documentation listed in this plan changed. Existing unrelated untracked `.serena` and `mockups` files remain untouched.

- [ ] **Step 4: Sync the verified workspace to the internal server**

From the repository root, run the project-prescribed sync command:

```bash
rtk rsync -az --delete \
  --exclude '.git/' \
  --exclude '.gradle/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'build/' \
  --exclude 'qa-screenshots/' \
  --exclude '.serena/' \
  --exclude 'mockups/stellive-admin-dashboard-settings-dark-mode-transparent-nav-uptime.html' \
  --exclude 'mockups/stellive-admin-login-screen-no-preview.html' \
  --exclude '.DS_Store' \
  --exclude '.env' \
  --exclude '.env.*' \
  ./ minepacu@192.168.50.9:~/StelLiveNoti/
```

Expected: transfer succeeds without sending environment files, credentials, generated output, or prohibited assets.

- [ ] **Step 5: Rebuild and recreate the server containers**

```bash
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti && docker compose -f backend/stellive-hub-api/docker-compose.yml up -d --build --force-recreate'
```

Expected: the API and all three workers are rebuilt and recreated successfully.

- [ ] **Step 6: Wait for API readiness, restart the scheduler, and verify effective non-secret settings**

```bash
rtk ssh minepacu@192.168.50.9 'until curl -fsS http://127.0.0.1:4000/health >/dev/null; do sleep 2; done; docker restart stellive-hub-api-music-channel-discovery-worker-1; docker ps --format "table {{.Names}}\t{{.Status}}" | grep stellive-hub-api; docker exec stellive-hub-api-music-channel-discovery-worker-1 node --input-type=module -e '\''const { loadEnv } = await import("./dist/backend/stellive-hub-api/src/config/env.js"); const env = loadEnv(); console.log(JSON.stringify({ offPeak: env.MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES, peak: env.MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES, start: env.MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR, end: env.MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR, timeZone: env.MUSIC_CHANNEL_DISCOVERY_TIME_ZONE }));'\'''
```

Expected: every container is `Up`; the effective configuration prints `{"offPeak":60,"peak":5,"start":12,"end":24,"timeZone":"Asia/Seoul"}`. Restarting only after `/health` succeeds avoids the known API-startup race and causes one immediate discovery attempt. No secret values are printed.

- [ ] **Step 7: Verify startup execution and the next boundary window**

```bash
rtk ssh minepacu@192.168.50.9 "docker logs --since 15m --timestamps stellive-hub-api-music-channel-discovery-worker-1 2>&1 | tail -80; docker exec stellive-hub-api-postgres-1 psql -U stellive -d stellive_hub -P pager=off -c \"SELECT operation, count(*) AS calls, sum(\\\"quotaUnits\\\") AS units, min(\\\"requestedAt\\\") AS first_call, max(\\\"requestedAt\\\") AS last_call FROM \\\"ExternalApiCallLog\\\" WHERE source='youtube' AND \\\"requestedAt\\\" >= now() - interval '15 minutes' GROUP BY operation ORDER BY operation;\""
```

Expected: no repeated worker error is present and recent `youtube.channels.list`, `youtube.playlistItems.list`, and `youtube.videos.list` calls show a successful startup discovery. At the next 12:00 or 00:00 KST boundary, repeat the aggregate query with an appropriate lookback and confirm call timestamps switch to the configured cadence.

- [ ] **Step 8: Check the 24-hour quota guardrail**

After the worker has run for 24 hours, run:

```bash
rtk ssh minepacu@192.168.50.9 "docker exec stellive-hub-api-postgres-1 psql -U stellive -d stellive_hub -P pager=off -c \"SELECT count(*) AS calls, sum(\\\"quotaUnits\\\") AS units FROM \\\"ExternalApiCallLog\\\" WHERE source='youtube' AND \\\"requestedAt\\\" >= now() - interval '24 hours';\""
```

Expected: usage is near the projected 4,992 discovery units plus unrelated YouTube work and remains below the operational guardrail of 8,000 units per 24 hours.
