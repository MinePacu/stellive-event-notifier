import type { HubEvent, HubEventScheduleItem, HubEventStatus } from "../types.js";

const closingSoonWindowMs = 24 * 60 * 60 * 1000;

function asDate(value?: string | Date): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function localDateKey(value: Date, timezone: string): string {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(value).map((part) => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return localDateKey(value, "Asia/Seoul");
  }
}

export function koreaDateKey(value: Date): string {
  return localDateKey(value, "Asia/Seoul");
}

type ScheduleTiming = "future" | "open" | "closing_soon" | "ended";

export function resolveScheduleItemTiming(item: HubEventScheduleItem, now: Date): ScheduleTiming {
  const startsAt = asDate(item.startsAt);
  if (!startsAt) return "ended";
  const endsAt = asDate(item.endsAt);

  if (item.timePrecision === "date") {
    const timezone = item.timezone || "Asia/Seoul";
    const nowDate = localDateKey(now, timezone);
    const startDate = localDateKey(startsAt, timezone);
    const endDate = endsAt ? localDateKey(endsAt, timezone) : startDate;
    if (nowDate < startDate) return "future";
    if (nowDate > endDate) return "ended";
    return nowDate === endDate ? "closing_soon" : "open";
  }

  const nowTime = now.getTime();
  const startsTime = startsAt.getTime();
  if (nowTime < startsTime) return "future";
  if (!endsAt) return nowTime === startsTime ? "open" : "ended";
  const endsTime = endsAt.getTime();
  if (nowTime >= endsTime) return "ended";
  return endsTime - nowTime <= closingSoonWindowMs ? "closing_soon" : "open";
}

function resolveLegacyStatus(event: HubEvent, now: Date): HubEventStatus {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "ended") return "ended";

  const nowTime = now.getTime();
  const startsAt = asDate(event.startsAt);
  const endsAt = asDate(event.endsAt);

  if (!endsAt && startsAt && koreaDateKey(now) > koreaDateKey(startsAt)) return "ended";
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

export function resolveEffectiveHubEventStatus(event: HubEvent, now: Date = new Date()): HubEventStatus {
  if (event.status === "cancelled") return "cancelled";

  const allScheduleItems = event.scheduleItems ?? [];
  if (allScheduleItems.length === 0) return resolveLegacyStatus(event, now);

  const activeItems = allScheduleItems.filter((item) => !item.cancelledAt);
  if (activeItems.length === 0) return "ended";

  const timings = activeItems.map((item) => resolveScheduleItemTiming(item, now));
  if (timings.includes("closing_soon")) return "closing_soon";
  if (timings.includes("open")) return "open";
  if (timings.includes("future")) return "upcoming";
  return "ended";
}

export function withEffectiveHubEventStatus(event: HubEvent, now: Date = new Date()): HubEvent {
  return {
    ...event,
    status: resolveEffectiveHubEventStatus(event, now)
  };
}
