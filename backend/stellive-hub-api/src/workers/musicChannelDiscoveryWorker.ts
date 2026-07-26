import { pathToFileURL } from "node:url";
import loadEnv from "../config/env.js";
import type { AppEnv } from "../config/env.js";
import {
  msUntilNextMusicDiscovery,
  type MusicChannelDiscoverySchedule,
} from "./musicChannelDiscoverySchedule.js";

function schedulerBaseUrl(env: AppEnv): string {
  return env.MUSIC_CHANNEL_DISCOVERY_SCHEDULER_BASE_URL ??
    (env.NODE_ENV === "development" ? "http://127.0.0.1:4000" : "http://api:4000");
}

const discoveryCounterKeys = [
  "channelsChecked",
  "playlistItemsChecked",
  "uniqueVideos",
  "inserted",
  "updated",
  "needsReview",
  "excludedCandidates",
  "skippedUntrusted",
  "skippedUntrustedChannel",
  "apiCallsEstimated",
  "failed",
] as const;

type DiscoveryCounterKey = typeof discoveryCounterKeys[number];

export type RedactedDiscoverySummary = {
  status: "ok" | "lock_not_acquired" | "disabled" | "not_available" | "unknown";
} & Partial<Record<DiscoveryCounterKey, number>>;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function parseRedactedDiscoverySummary(value: unknown): RedactedDiscoverySummary | null {
  const input = record(value);
  if (Object.keys(input).length === 0) return null;
  const status = input.status === "ok" ||
      input.status === "lock_not_acquired" ||
      input.status === "disabled" ||
      input.status === "not_available"
    ? input.status
    : "unknown";
  const summary: RedactedDiscoverySummary = { status };
  for (const key of discoveryCounterKeys) {
    const counter = input[key];
    if (typeof counter === "number" && Number.isFinite(counter) && counter >= 0) {
      summary[key] = Math.trunc(counter);
    }
  }
  return summary;
}

export async function discoverOnce(
  fetchImpl: typeof fetch = fetch,
  logInfo: (message: string, summary: RedactedDiscoverySummary) => void = console.info,
): Promise<RedactedDiscoverySummary | undefined> {
  const env = loadEnv();
  if (!env.MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED) return;
  const response = await fetchImpl(
    new URL("/v1/internal/schedulers/music/discover-channel-uploads", schedulerBaseUrl(env)),
    {
      method: "POST",
      headers: { authorization: `Bearer ${env.INTERNAL_API_TOKEN}` },
    },
  );
  if (response.status === 401 || response.status === 403) throw new Error(`fatal_auth_${response.status}`);
  if (!response.ok) throw new Error(`music_channel_discovery_http_${response.status}`);
  const summary = parseRedactedDiscoverySummary(await response.json());
  if (!summary) throw new Error("music_channel_discovery_response_invalid");
  logInfo("music channel discovery completed", summary);
  return summary;
}

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

async function main(): Promise<void> {
  const env = loadEnv();
  const schedule = scheduleFromEnv(env);
  for (;;) {
    const delayMs = await runDiscoveryCycle({ schedule });
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
