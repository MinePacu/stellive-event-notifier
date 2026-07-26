import type { HubCalendarEntry, HubCalendarSpecialDay } from "../types.js";

export interface SpecialDayProjectionOptions {
  from: Date;
  to: Date;
  timezone: string;
  now: Date;
  generationId?: string;
  memberId?: string;
  includeVerifyRequired?: boolean;
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

interface SpecialDayStatusSnapshot {
  todayLocalDate: string;
  timezone: string;
}

const statusSnapshotCache = new Map<string, SpecialDayStatusSnapshot>();

export function clearSpecialDayStatusSnapshotCache(): { cleared: true } {
  statusSnapshotCache.clear();
  return { cleared: true };
}

export function anniversaryYearFor(displayYear: number, startYear: number): number | undefined {
  const anniversaryYear = displayYear - startYear;
  return anniversaryYear > 0 ? anniversaryYear : undefined;
}

function localDateParts(value: Date, timezone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function localDateString(parts: LocalDateParts): string {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0")
  ].join("-");
}

function specialDayStatus(
  displayDate: string,
  snapshot: SpecialDayStatusSnapshot
): "ended" | "open" | "upcoming" {
  if (displayDate < snapshot.todayLocalDate) return "ended";
  if (displayDate === snapshot.todayLocalDate) return "open";
  return "upcoming";
}

function specialDayStatusSnapshot(options: SpecialDayProjectionOptions): SpecialDayStatusSnapshot {
  const todayLocalDate = localDateString(localDateParts(options.now, options.timezone));
  const cacheKey = `special-day-status:${options.timezone}:${todayLocalDate}`;
  const cached = statusSnapshotCache.get(cacheKey);
  if (cached) return cached;

  const snapshot = { todayLocalDate, timezone: options.timezone };
  statusSnapshotCache.set(cacheKey, snapshot);
  return snapshot;
}

function compareLocalDate(left: LocalDateParts, right: LocalDateParts): number {
  return (
    left.year - right.year ||
    left.month - right.month ||
    left.day - right.day
  );
}

function yearsInRange(from: Date, to: Date, timezone: string): number[] {
  const fromYear = localDateParts(from, timezone).year;
  const toYear = localDateParts(to, timezone).year;
  const years: number[] = [];

  for (let year = fromYear; year <= toYear; year += 1) {
    years.push(year);
  }

  return years;
}

function isAllowedSpecialDay(day: HubCalendarSpecialDay, options: SpecialDayProjectionOptions): boolean {
  if (!options.includeVerifyRequired && day.policyState !== "catalog_verified") return false;
  if (day.generationId === ("official" as HubCalendarSpecialDay["generationId"])) return false;
  if (day.activeStatus !== "active" && day.activeStatus !== "upcoming") return false;
  if (day.catalogRole === ("official_channel" as HubCalendarSpecialDay["catalogRole"])) return false;
  if (options.generationId && day.generationId !== options.generationId) return false;
  if (options.memberId && day.memberId !== options.memberId) return false;
  if (day.kind === "member_birthday" && !day.memberId) return false;
  if (day.kind === "generation_anniversary" && !day.startYear) return false;
  return true;
}

function entryForSpecialDay(
  day: HubCalendarSpecialDay,
  displayDate: string,
  displayYear: number,
  status: "ended" | "open" | "upcoming"
): HubCalendarEntry | undefined {
  if (day.kind === "generation_anniversary") {
    const anniversaryYear = anniversaryYearFor(displayYear, day.startYear ?? displayYear);
    if (!anniversaryYear) return undefined;
    const specialDayLabel = `${anniversaryYear}주년`;

    return {
      id: `${day.id}:${displayDate}`,
      eventId: day.id,
      entryKind: "generation_anniversary",
      specialDayKind: "generation_anniversary",
      specialDayLabel,
      title: `${day.title} ${specialDayLabel}`,
      displayTitle: `${day.title} ${specialDayLabel}`,
      category: "online_goods",
      tags: [],
      status,
      participationMode: "online",
      generationId: day.generationId,
      memberId: day.memberId,
      displayDate,
      displayTimeText: "종일",
      sourceLabel: day.sourceLabel,
      appDeepLink: `stellivehub://calendar/special-days/${day.id}?date=${displayDate}`
    };
  }

  return {
    id: `${day.id}:${displayDate}`,
    eventId: day.id,
    entryKind: "member_birthday",
    specialDayKind: "member_birthday",
    specialDayLabel: "생일",
    title: day.title,
    displayTitle: day.title,
    category: "online_goods",
    tags: [],
    status,
    participationMode: "online",
    generationId: day.generationId,
    memberId: day.memberId,
    displayDate,
    displayTimeText: "종일",
    sourceLabel: day.sourceLabel,
    appDeepLink: `stellivehub://calendar/special-days/${day.id}?date=${displayDate}`
  };
}

export function buildSpecialDayEntries(
  specialDays: HubCalendarSpecialDay[],
  options: SpecialDayProjectionOptions
): HubCalendarEntry[] {
  const fromLocal = localDateParts(options.from, options.timezone);
  const toLocal = localDateParts(options.to, options.timezone);
  const statusSnapshot = specialDayStatusSnapshot(options);

  return specialDays.flatMap((day) => {
    if (!isAllowedSpecialDay(day, options)) return [];

    return yearsInRange(options.from, options.to, options.timezone).flatMap((year) => {
      const candidate = { year, month: day.month, day: day.day };
      if (compareLocalDate(candidate, fromLocal) < 0 || compareLocalDate(candidate, toLocal) > 0) return [];

      const displayDate = localDateString(candidate);
      const entry = entryForSpecialDay(day, displayDate, year, specialDayStatus(displayDate, statusSnapshot));
      return entry ? [entry] : [];
    });
  });
}
