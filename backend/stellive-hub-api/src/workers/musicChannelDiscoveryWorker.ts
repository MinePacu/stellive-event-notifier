import { pathToFileURL } from "node:url";
import loadEnv from "../config/env.js";

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

async function main(): Promise<void> {
  const env = loadEnv();
  const intervalMs = env.MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES * 60_000;
  for (;;) {
    try {
      await discoverOnce();
    } catch (error) {
      console.error("music channel discovery failed", error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
