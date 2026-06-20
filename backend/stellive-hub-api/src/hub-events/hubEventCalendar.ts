import type {
  HubCalendarDay,
  HubCalendarEntry,
  HubCalendarEntryKind,
  HubCalendarResponse,
  HubCalendarSpecialDay,
  HubCalendarWidgetSnapshot,
  HubEvent,
  HubEventCategory,
  HubEventParticipationMode,
  HubEventStatus
} from "../types.js";
import { buildSpecialDayEntries } from "./hubCalendarSpecialDays.js";
import type { SpecialDayOccurrence } from "./hubCalendarSpecialDayMaterializer.js";

export type { HubCalendarDay, HubCalendarEntry, HubCalendarResponse, HubCalendarWidgetSnapshot } from "../types.js";

export interface CalendarResponseOptions {
  from: Date;
  to: Date;
  timezone: string;
  now: Date;
  includeSpecialDays?: boolean;
  entryKinds?: HubCalendarEntryKind[];
  generationId?: string;
  memberId?: string;
}

export interface WidgetSnapshotOptions {
  timezone: string;
  now: Date;
  limit: number;
  includeSpecialDays?: boolean;
  entryKinds?: HubCalendarEntryKind[];
  generationId?: string;
  memberId?: string;
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

function specialDayOccurrenceStatus(occurrence: SpecialDayOccurrence, now: Date): "ended" | "open" | "upcoming" {
  const nowTime = now.getTime();
  if (nowTime < occurrence.startsAt.getTime()) return "upcoming";
  if (nowTime >= occurrence.endsAt.getTime()) return "ended";
  return "open";
}

function toSpecialDayOccurrenceEntry(occurrence: SpecialDayOccurrence, now: Date): HubCalendarEntry {
  return {
    id: `${occurrence.specialDayId}:${occurrence.displayDate}`,
    eventId: occurrence.specialDayId,
    entryKind: occurrence.kind,
    specialDayKind: occurrence.kind,
    specialDayLabel: occurrence.specialDayLabel,
    title: occurrence.title,
    category: "online_goods",
    status: specialDayOccurrenceStatus(occurrence, now),
    participationMode: "online",
    generationId: occurrence.generationId,
    memberId: occurrence.memberId,
    startsAt: occurrence.startsAt.toISOString(),
    endsAt: occurrence.endsAt.toISOString(),
    displayDate: occurrence.displayDate,
    displayTimeText: "종일",
    sourceLabel: occurrence.sourceLabel,
    appDeepLink: `stellivehub://calendar/special-days/${occurrence.specialDayId}?date=${occurrence.displayDate}`
  };
}

function specialDayEntryKey(entry: HubCalendarEntry): string {
  return [entry.entryKind, entry.eventId, entry.displayDate].join(":");
}

function mergeSpecialDayEntries(materialized: HubCalendarEntry[], projected: HubCalendarEntry[]): HubCalendarEntry[] {
  const entries = new Map<string, HubCalendarEntry>();
  for (const entry of materialized) entries.set(specialDayEntryKey(entry), entry);
  for (const entry of projected) {
    const key = specialDayEntryKey(entry);
    if (!entries.has(key)) entries.set(key, entry);
  }
  return [...entries.values()];
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
    entryKind: "hub_event",
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

export function buildHubCalendarResponse(
  events: HubEvent[],
  options: CalendarResponseOptions,
  specialDays: HubCalendarSpecialDay[] = [],
  specialDayOccurrences: SpecialDayOccurrence[] = []
): HubCalendarResponse {
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

  const materializedSpecialDayEntries = options.includeSpecialDays === false
    ? []
    : specialDayOccurrences.map((occurrence) => toSpecialDayOccurrenceEntry(occurrence, options.now));
  const projectedSpecialDayEntries = options.includeSpecialDays === false
    ? []
    : buildSpecialDayEntries(specialDays, {
      from: options.from,
      to: options.to,
      timezone: options.timezone,
      now: options.now,
      generationId: options.generationId,
      memberId: options.memberId
    });
  const specialDayEntries = mergeSpecialDayEntries(materializedSpecialDayEntries, projectedSpecialDayEntries);

  for (const entry of specialDayEntries) {
    const entries = days.get(entry.displayDate) ?? [];
    entries.push(entry);
    days.set(entry.displayDate, entries);
  }

  if (options.entryKinds?.length) {
    for (const [date, entries] of days) {
      const filtered = entries.filter((entry) => options.entryKinds?.includes(entry.entryKind));
      if (filtered.length === 0) days.delete(date);
      else days.set(date, filtered);
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
  options: WidgetSnapshotOptions,
  specialDays: HubCalendarSpecialDay[] = [],
  specialDayOccurrences: SpecialDayOccurrence[] = []
): HubCalendarWidgetSnapshot {
  const hubEventEntries = events.map((event) => {
    const date = localDateString(primaryStart(event), options.timezone);
    return toEntry(event, date, effectiveStatus(event, options.now), options.timezone);
  });
  const materializedSpecialDayEntries = options.includeSpecialDays === false
    ? []
    : specialDayOccurrences.map((occurrence) => toSpecialDayOccurrenceEntry(occurrence, options.now));
  const projectedSpecialDayEntries = options.includeSpecialDays === false
    ? []
    : buildSpecialDayEntries(specialDays, {
      from: options.now,
      to: new Date(options.now.getTime() + 90 * 24 * 60 * 60 * 1000),
      timezone: options.timezone,
      now: options.now,
      generationId: options.generationId,
      memberId: options.memberId
    });
  const specialDayEntries = mergeSpecialDayEntries(materializedSpecialDayEntries, projectedSpecialDayEntries);
  const entries = options.entryKinds?.length
    ? [...hubEventEntries, ...specialDayEntries].filter((entry) => options.entryKinds?.includes(entry.entryKind))
    : [...hubEventEntries, ...specialDayEntries];
  const hubEntries = entries.filter((entry) => entry.entryKind === "hub_event").sort(compareCalendarEntries);
  const fallbackEntries = entries.filter((entry) => entry.entryKind !== "hub_event").sort(compareCalendarEntries);
  const sourceEntries = [
    ...hubEntries,
    ...fallbackEntries,
  ];

  return {
    generatedAt: options.now.toISOString(),
    timezone: options.timezone,
    entries: sourceEntries.slice(0, Math.max(1, options.limit)),
    staleAfter: new Date(options.now.getTime() + widgetStaleAfterMs).toISOString()
  };
}
