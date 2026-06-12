import type {
  HubCalendarDay,
  HubCalendarEntry,
  HubCalendarResponse,
  HubCalendarWidgetSnapshot,
  HubEvent,
  HubEventCategory,
  HubEventParticipationMode,
  HubEventStatus
} from "../types.js";

export type { HubCalendarDay, HubCalendarEntry, HubCalendarResponse, HubCalendarWidgetSnapshot } from "../types.js";

export interface CalendarResponseOptions {
  from: Date;
  to: Date;
  timezone: string;
  now: Date;
}

export interface WidgetSnapshotOptions {
  timezone: string;
  now: Date;
  limit: number;
}

const closingSoonWindowMs = 24 * 60 * 60 * 1000;
const widgetStaleAfterMs = 6 * 60 * 60 * 1000;
const statusRank: Record<HubEventStatus, number> = {
  closing_soon: 0,
  open: 1,
  upcoming: 2,
  announced: 3,
  cancelled: 4,
  ended: 5
};

function asDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function primaryStart(event: HubEvent): Date {
  return asDate(event.startsAt) ?? asDate(event.endsAt) ?? asDate(event.updatedAt) ?? new Date(event.createdAt);
}

function primaryEnd(event: HubEvent): Date {
  return asDate(event.endsAt) ?? asDate(event.startsAt) ?? asDate(event.updatedAt) ?? new Date(event.createdAt);
}

function localDateString(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function localTimeString(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(value);
}

function addLocalDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0, 0));
  return next.toISOString().slice(0, 10);
}

function enumerateLocalDates(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addLocalDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

function eventOverlapsWindow(event: HubEvent, from: Date, to: Date): boolean {
  return primaryStart(event).getTime() <= to.getTime() && primaryEnd(event).getTime() >= from.getTime();
}

export function effectiveStatus(event: HubEvent, now: Date): HubEventStatus {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "ended") return "ended";

  const nowTime = now.getTime();
  const startsAt = asDate(event.startsAt);
  const endsAt = asDate(event.endsAt);

  if (event.status === "closing_soon") {
    return endsAt && nowTime >= endsAt.getTime() ? "ended" : "closing_soon";
  }
  if (endsAt && nowTime >= endsAt.getTime()) return "ended";
  if (startsAt && nowTime < startsAt.getTime()) return "upcoming";
  if (endsAt && endsAt.getTime() - nowTime <= closingSoonWindowMs) return "closing_soon";
  if (startsAt || endsAt) return "open";
  return "announced";
}

function displayTimeText(event: HubEvent, date: string, timezone: string): string {
  const startsAt = asDate(event.startsAt);
  const endsAt = asDate(event.endsAt);
  if (startsAt && localDateString(startsAt, timezone) === date) {
    return `${localTimeString(startsAt, timezone)} 시작`;
  }
  if (endsAt && localDateString(endsAt, timezone) === date) {
    return `${localTimeString(endsAt, timezone)} 마감`;
  }
  return "종일";
}

function calendarDatesFor(event: HubEvent, options: CalendarResponseOptions): string[] {
  const eventStart = localDateString(primaryStart(event), options.timezone);
  const eventEnd = localDateString(primaryEnd(event), options.timezone);
  const windowStart = localDateString(options.from, options.timezone);
  const windowEnd = localDateString(options.to, options.timezone);
  const dates = enumerateLocalDates(eventStart, eventEnd).filter((date) => date >= windowStart && date <= windowEnd);
  const windowLengthMs = options.to.getTime() - options.from.getTime();

  if (windowLengthMs <= 31 * 24 * 60 * 60 * 1000) {
    return dates;
  }

  const sparseDates = new Set<string>();
  const current = localDateString(options.now, options.timezone);
  for (const date of [eventStart, eventEnd, current]) {
    if (dates.includes(date)) sparseDates.add(date);
  }
  return [...sparseDates].sort();
}

function toEntry(event: HubEvent, date: string, status: HubEventStatus, timezone: string): HubCalendarEntry {
  return {
    id: `${event.id}:${date}`,
    eventId: event.id,
    title: event.title,
    category: event.category,
    status,
    participationMode: event.participationMode,
    generationId: event.generationId,
    memberId: event.memberId,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    displayDate: date,
    displayTimeText: displayTimeText(event, date, timezone),
    sourceLabel: event.sourceLabel,
    appDeepLink: `stellivehub://hub-events/${event.id}`,
    platformUrl: event.purchaseUrl ?? event.ticketUrl ?? event.sourceUrl
  };
}

export function compareCalendarEntries(left: HubCalendarEntry, right: HubCalendarEntry): number {
  const statusDiff = statusRank[left.status] - statusRank[right.status];
  if (statusDiff !== 0) return statusDiff;
  const leftTime = Date.parse(left.endsAt ?? left.startsAt ?? "");
  const rightTime = Date.parse(right.endsAt ?? right.startsAt ?? "");
  const dateDiff = (Number.isNaN(leftTime) ? Number.POSITIVE_INFINITY : leftTime) -
    (Number.isNaN(rightTime) ? Number.POSITIVE_INFINITY : rightTime);
  if (dateDiff !== 0) return dateDiff;
  return left.title.localeCompare(right.title, "ko-KR");
}

export function buildHubCalendarResponse(events: HubEvent[], options: CalendarResponseOptions): HubCalendarResponse {
  const days = new Map<string, HubCalendarEntry[]>();

  for (const event of events) {
    if (!eventOverlapsWindow(event, options.from, options.to)) continue;
    const status = effectiveStatus(event, options.now);
    for (const date of calendarDatesFor(event, options)) {
      const entries = days.get(date) ?? [];
      entries.push(toEntry(event, date, status, options.timezone));
      days.set(date, entries);
    }
  }

  return {
    timezone: options.timezone,
    from: localDateString(options.from, options.timezone),
    to: localDateString(options.to, options.timezone),
    days: [...days.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, entries]) => ({ date, entries: entries.sort(compareCalendarEntries) }))
  };
}

export function buildHubCalendarWidgetSnapshot(
  events: HubEvent[],
  options: WidgetSnapshotOptions
): HubCalendarWidgetSnapshot {
  const entries = events.map((event) => {
    const date = localDateString(primaryStart(event), options.timezone);
    return toEntry(event, date, effectiveStatus(event, options.now), options.timezone);
  });
  const actionableEntries = entries.filter((entry) => entry.status !== "ended" && entry.status !== "cancelled");
  const sourceEntries = actionableEntries.length >= options.limit ? actionableEntries : entries;

  return {
    generatedAt: options.now.toISOString(),
    timezone: options.timezone,
    entries: sourceEntries.sort(compareCalendarEntries).slice(0, Math.max(1, options.limit)),
    staleAfter: new Date(options.now.getTime() + widgetStaleAfterMs).toISOString()
  };
}
