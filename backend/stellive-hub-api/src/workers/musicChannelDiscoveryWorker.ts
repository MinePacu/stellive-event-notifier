import { pathToFileURL } from "node:url";
import loadEnv from "../config/env.js";
import type { AppEnv } from "../config/env.js";
import {
  msUntilNextMusicDiscovery,
  type MusicChannelDiscoverySchedule,
} from "./musicChannelDiscoverySchedule.js";

function schedulerBaseUrl(): string {
  const env = loadEnv();
  return process.env.MUSIC_CHANNEL_DISCOVERY_SCHEDULER_BASE_URL ??
    (env.NODE_ENV === "development" ? "http://127.0.0.1:4000" : "http://api:4000");
}

export async function discoverOnce(fetchImpl: typeof fetch = fetch): Promise<void> {
  const env = loadEnv();
  if (!env.MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED) return;
  const response = await fetchImpl(
    new URL("/v1/internal/schedulers/music/discover-channel-uploads", schedulerBaseUrl()),
    {
      method: "POST",
      headers: { authorization: `Bearer ${env.INTERNAL_API_TOKEN}` },
    },
  );
  if (response.status === 401 || response.status === 403) throw new Error(`fatal_auth_${response.status}`);
  if (!response.ok) throw new Error(`music_channel_discovery_http_${response.status}`);
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
