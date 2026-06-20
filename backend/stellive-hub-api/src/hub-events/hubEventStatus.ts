import type { HubEvent, HubEventStatus } from "../types.js";

const closingSoonWindowMs = 24 * 60 * 60 * 1000;

function asDate(value?: string | Date): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function resolveEffectiveHubEventStatus(event: HubEvent, now: Date = new Date()): HubEventStatus {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "ended") return "ended";

  const nowTime = now.getTime();
  const startsAt = asDate(event.startsAt);
  const endsAt = asDate(event.endsAt);

  if (event.status === "closing_soon") {
    if (endsAt && nowTime >= endsAt.getTime()) return "ended";
    return "closing_soon";
  }

  if (endsAt && nowTime >= endsAt.getTime()) return "ended";
  if (startsAt && nowTime < startsAt.getTime()) return "upcoming";
  if (endsAt && endsAt.getTime() - nowTime <= closingSoonWindowMs) return "closing_soon";
  if (startsAt && nowTime >= startsAt.getTime()) return "open";
  return "announced";
}

export function withEffectiveHubEventStatus(event: HubEvent, now: Date = new Date()): HubEvent {
  return {
    ...event,
    status: resolveEffectiveHubEventStatus(event, now)
  };
}
