import type { PlatformEvent } from "../types.js";

export const SUMMARY_WINDOW_MS = 10 * 60_000;

export function summaryWindow(at: Date): { windowStart: Date; deliverAfter: Date } {
  const startMs = Math.floor(at.getTime() / SUMMARY_WINDOW_MS) * SUMMARY_WINDOW_MS;
  return {
    windowStart: new Date(startMs),
    deliverAfter: new Date(startMs + SUMMARY_WINDOW_MS)
  };
}

export function summaryTopicKey(event: PlatformEvent): string {
  if (event.source === "hub_event") return "hub_event";
  if (event.generationId === "official" || event.memberId === "stellive-official") {
    return `official:${event.source}`;
  }
  return `member:${event.memberId}:${event.source}`;
}
