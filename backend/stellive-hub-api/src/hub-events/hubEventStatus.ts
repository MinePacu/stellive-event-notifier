import type { HubEvent, HubEventStatus } from "../types.js";

const closingSoonWindowMs = 24 * 60 * 60 * 1000;
const koreaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function asDate(value?: string | Date): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function koreaDateKey(value: Date): string {
  const parts = Object.fromEntries(koreaDateFormatter.formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isAfterKoreaDate(now: Date, date: Date): boolean {
  return koreaDateKey(now) > koreaDateKey(date);
}

export function resolveEffectiveHubEventStatus(event: HubEvent, now: Date = new Date()): HubEventStatus {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "ended") return "ended";

  const nowTime = now.getTime();
  const startsAt = asDate(event.startsAt);
  const endsAt = asDate(event.endsAt);

  if (!endsAt && startsAt && isAfterKoreaDate(now, startsAt)) return "ended";

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
