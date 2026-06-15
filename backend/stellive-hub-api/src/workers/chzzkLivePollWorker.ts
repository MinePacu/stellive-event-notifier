import "dotenv/config";
import loadEnv from "../config/env.js";

const env = loadEnv();

const schedulerBaseUrl =
  process.env.CHZZK_LIVE_POLL_SCHEDULER_BASE_URL ??
  (env.NODE_ENV === "development" ? "http://127.0.0.1:4000" : "http://api:4000");

function readPositiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readNonNegativeInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

const intervalMs = readPositiveInt("CHZZK_LIVE_POLL_INTERVAL_SECONDS", 60) * 1000;
const jitterMs = readNonNegativeInt("CHZZK_LIVE_POLL_JITTER_SECONDS", 10) * 1000;
const backoffMs = readPositiveInt("CHZZK_LIVE_POLL_BACKOFF_SECONDS", 300) * 1000;

function nextDelay(baseMs: number): number {
  if (jitterMs === 0) return baseMs;
  return baseMs + Math.floor(Math.random() * jitterMs);
}

async function pollOnce(): Promise<number> {
  const url = new URL("/v1/internal/schedulers/chzzk/live-status", schedulerBaseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.INTERNAL_API_TOKEN}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(`fatal_auth_${response.status}`);
  }

  if (response.status === 429) {
    console.warn("chzzk live poll rate-limited");
    return backoffMs;
  }

  if (!response.ok) {
    console.warn(`chzzk live poll failed: http_${response.status}`);
    return backoffMs;
  }

  const body = await response.json().catch(() => undefined);
  const counts = body && typeof body === "object" && "counts" in body ? body.counts : body;
  console.info("chzzk live poll completed", counts);
  return intervalMs;
}

async function runLoop(): Promise<void> {
  if (!env.CHZZK_LIVE_POLLING_ENABLED) {
    console.info("chzzk live poll worker disabled");
    return;
  }

  if (!env.INTERNAL_API_TOKEN) {
    throw new Error("INTERNAL_API_TOKEN is required for chzzk live poll worker");
  }

  let delayMs = 0;
  while (true) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, nextDelay(delayMs)));
    }

    try {
      delayMs = await pollOnce();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("fatal_auth_")) {
        throw error;
      }
      console.warn("chzzk live poll error", error instanceof Error ? error.message : "unknown_error");
      delayMs = backoffMs;
    }
  }
}

runLoop().catch((error) => {
  console.error(error instanceof Error ? error.message : "chzzk live poll worker failed");
  process.exitCode = 1;
});
