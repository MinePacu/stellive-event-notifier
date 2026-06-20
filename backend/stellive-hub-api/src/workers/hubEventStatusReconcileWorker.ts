import { pathToFileURL } from "node:url";
import loadEnv from "../config/env.js";

function readPositiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const backoffMs = readPositiveInt("HUB_EVENT_STATUS_RECONCILE_BACKOFF_SECONDS", 300) * 1000;

function schedulerBaseUrl(): string {
  const env = loadEnv();
  return (
    process.env.HUB_EVENT_STATUS_RECONCILE_SCHEDULER_BASE_URL ??
    (env.NODE_ENV === "development" ? "http://127.0.0.1:4000" : "http://api:4000")
  );
}

export function msUntilNextHour(now: Date = new Date()): number {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return Math.max(1, next.getTime() - now.getTime());
}

export async function reconcileOnce(fetchImpl: typeof fetch = fetch): Promise<number> {
  const env = loadEnv();
  const url = new URL("/v1/internal/schedulers/hub-events/statuses/reconcile", schedulerBaseUrl());
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.INTERNAL_API_TOKEN}`
    }
  });

  if (response.status === 401 || response.status === 403) throw new Error(`fatal_auth_${response.status}`);
  if (!response.ok) {
    console.warn(`hub event status reconcile failed: http_${response.status}`);
    return backoffMs;
  }

  return msUntilNextHour();
}

async function main(): Promise<void> {
  let delayMs = msUntilNextHour();
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      delayMs = await reconcileOnce();
    } catch (error) {
      console.error("hub event status reconcile worker stopped", error);
      process.exitCode = 1;
      return;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
